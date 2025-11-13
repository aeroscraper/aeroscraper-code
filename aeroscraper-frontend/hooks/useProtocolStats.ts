'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppKitConnection } from '@reown/appkit-adapter-solana/react';
import { fetchProtocolState, ProtocolStateData } from '@/lib/solana/fetchProtocolState';
import { fetchAllTroves } from '@/lib/solana/fetchTroves';
import { getPrice as getSolPrice } from '@/lib/solana/getSolPriceInUsd';
import { calculateICR } from '@/lib/solana/calculateICR';
import { bigIntToDecimalString } from '@/lib/solana/units';
import {
    AUSD_DECIMALS,
    COLLATERAL_DENOM,
    SOL_DECIMALS,
} from '@/lib/constants/solana';

type ProtocolStats = {
    managementFeePercent: number | null;
    liquidationThresholdPercent: number | null;
    totalValueLockedUsd: number | null;
    totalCollateralSol: number | null;
    ausdInStabilityPool: number | null;
    troveCount: number;
    totalCollateralRatioPercent: number | null;
    totalAusdSupply: number | null;
    solPriceUsd: number | null;
};

const numberFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const toNumber = (value: string | null): number | null => {
    if (!value) {
        return null;
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export function useProtocolStats() {
    const { connection } = useAppKitConnection();
    const [protocolState, setProtocolState] = useState<ProtocolStateData | null>(null);
    const [stats, setStats] = useState<ProtocolStats | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let didCancel = false;

        const loadStats = async () => {
            if (!connection) {
                setError('Connection not available');
                setStats(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const [state, troves, solPriceUsd] = await Promise.all([
                    fetchProtocolState(connection),
                    fetchAllTroves(connection, COLLATERAL_DENOM),
                    getSolPrice('SOL'),
                ]);

                if (didCancel) {
                    return;
                }

                setProtocolState(state);

                const totalCollateralLamports = troves.reduce<bigint>(
                    (sum, trove) => sum + trove.collateralAmount,
                    BigInt(0)
                );

                const totalDebtAmount = troves.reduce<bigint>(
                    (sum, trove) => sum + trove.debt,
                    BigInt(0)
                );

                const solPrice =
                    Number.isFinite(solPriceUsd) && solPriceUsd > 0 ? solPriceUsd : null;

                let totalValueLockedUsd: number | null = null;
                let totalCollateralRatioPercent: number | null = null;

                if (solPrice) {
                    const priceMicro = BigInt(Math.round(solPrice * 1_000_000));
                    const collateralUsdMicro =
                        (totalCollateralLamports * priceMicro) / BigInt(1_000_000_000);
                    const tvlString = bigIntToDecimalString(collateralUsdMicro, 6, 2);
                    totalValueLockedUsd = toNumber(tvlString);

                    if (totalDebtAmount > BigInt(0) && totalCollateralLamports > BigInt(0)) {
                        const systemIcr = calculateICR(
                            totalCollateralLamports,
                            totalDebtAmount,
                            solPrice
                        );
                        totalCollateralRatioPercent = Number(systemIcr) / 1_000_000;
                    }
                }

                const totalCollateralSol = toNumber(
                    bigIntToDecimalString(totalCollateralLamports, SOL_DECIMALS, 4)
                );

                const totalAusdSupply = toNumber(
                    bigIntToDecimalString(totalDebtAmount, AUSD_DECIMALS, 2)
                );

                const ausdInStabilityPool = toNumber(
                    bigIntToDecimalString(state.totalStakeAmount, AUSD_DECIMALS, 2)
                );

                const managementFeePercent = state.protocolFee ?? null;
                const liquidationThresholdPercent = Number(state.minimumCollateralRatio) / 1_000_000;

                setStats({
                    managementFeePercent,
                    liquidationThresholdPercent,
                    totalValueLockedUsd,
                    totalCollateralSol,
                    ausdInStabilityPool,
                    troveCount: troves.length,
                    totalCollateralRatioPercent,
                    totalAusdSupply,
                    solPriceUsd: solPrice,
                });
            } catch (err: any) {
                if (didCancel) {
                    return;
                }
                const message = err?.message ?? 'Failed to load protocol statistics';
                console.error('Error loading protocol statistics:', err);
                setError(message);
                setStats(null);
            } finally {
                if (!didCancel) {
                    setLoading(false);
                }
            }
        };

        loadStats();

        return () => {
            didCancel = true;
        };
    }, [connection]);

    const formattedStats = useMemo(() => {
        if (!stats) {
            return null;
        }

        return {
            managementFee: stats.managementFeePercent !== null
                ? `${decimalFormatter.format(stats.managementFeePercent)}%`
                : null,
            liquidationThreshold: stats.liquidationThresholdPercent !== null
                ? `${decimalFormatter.format(stats.liquidationThresholdPercent)}%`
                : null,
            totalValueLocked: stats.totalValueLockedUsd !== null
                ? `$${decimalFormatter.format(stats.totalValueLockedUsd)}`
                : null,
            stabilityPoolAusd: stats.ausdInStabilityPool !== null
                ? `${decimalFormatter.format(stats.ausdInStabilityPool)} AUSD`
                : null,
            troves: numberFormatter.format(stats.troveCount),
            totalCollateralRatio: stats.totalCollateralRatioPercent !== null
                ? `${decimalFormatter.format(stats.totalCollateralRatioPercent)}%`
                : null,
            totalAusdSupply: stats.totalAusdSupply !== null
                ? `${decimalFormatter.format(stats.totalAusdSupply)} AUSD`
                : null,
        };
    }, [stats]);

    return {
        stats: formattedStats,
        rawStats: stats,
        protocolState,
        loading,
        error,
    };
}

