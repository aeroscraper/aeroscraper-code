"use client"

import React, { FC, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { PageData } from '../app/app/dashboard/_types/types';
import { BaseCoinByDenom } from '@/constants/chainConstants';
import { usePrice } from '@/contexts/PriceProvider';
import { CollateralAmount, isV2TroveResponse, CollateralInfo, TotalInfoResponseV1, TotalInfoResponseV2 } from '@/contracts/app/types';
import useAppContract from '@/contracts/app/useAppContract';
import { ChainName } from '@/enums/Chain';
import useChainAdapter from '@/hooks/useChainAdapter';
import graphql from '@/services/graphql';
import { AppVersion } from '@/types/types';
import { convertAmount } from '@/utils/contractUtils';
import axios from 'axios';
import { isNil } from 'lodash';

const FilterParamByChainName: Record<ChainName, string> = {
    [ChainName.INJECTIVE]: 'INJECTIVE',
    [ChainName.SEI]: 'SEI',
    [ChainName.ARCHWAY]: 'ARCH',
    [ChainName.NEUTRON]: 'NEUTRON',
    [ChainName.XION]: 'XION',
    [ChainName.SOLANA]: 'SOLANA'
}

type DashboardContextValue = {
    pageData: PageData;
    loading: boolean;
    getPageData: () => void;
}

const DashboardContext = React.createContext<DashboardContextValue>({
    pageData: {
        baseCollateralAmount: 0,
        baseTotalCollateralAmount: 0,
        collateralAmountsByDenom: {},
        totalCollateralAmountsByDenom: {},
        baseMinCollateralRatio: 0,
        minCollateralRatioByDenom: {},
        baseMinRedeemAmount: 0,
        minRedeemAmountByDenom: {},
        debtAmount: 0,
        ausdBalance: 0,
        stakedAmount: 0,
        totalDebtAmount: 0,
        totalAusdSupply: 0,
        totalStakedAmount: 0,
        totalTrovesAmount: 0,
        poolShare: 0,
        rewardAmount: 0
    },
    loading: false,
    getPageData: () => { }
});

const DashboardProvider: FC<PropsWithChildren> = ({ children }) => {
    const debounceTimer = useRef<NodeJS.Timeout | undefined>();
    const { selectedAppVersion, selectedChainName, baseCoin } = useChainAdapter();
    const { coinPricesByDenom } = usePrice();

    const { requestTotalTroves } = useMemo(() => graphql({ selectedChainName: selectedChainName ?? ChainName.INJECTIVE, selectedAppVersion }), [selectedChainName, selectedAppVersion]);
    const contract = useAppContract();

    const [pageData, setPageData] = useState<PageData>({
        baseCollateralAmount: 0,
        baseTotalCollateralAmount: 0,
        collateralAmountsByDenom: {},
        totalCollateralAmountsByDenom: {},
        baseMinCollateralRatio: 0,
        minCollateralRatioByDenom: {},
        baseMinRedeemAmount: 0,
        minRedeemAmountByDenom: {},
        debtAmount: 0,
        ausdBalance: 0,
        stakedAmount: 0,
        totalDebtAmount: 0,
        totalAusdSupply: 0,
        totalStakedAmount: 0,
        totalTrovesAmount: 0,
        poolShare: 0,
        rewardAmount: 0
    });

    const [troveLoading, setTroveLoading] = useState<boolean>(true);
    const [ausdBalanceLoading, setAusdBalanceLoading] = useState<boolean>(true);
    const [stakeLoading, setStakeLoading] = useState<boolean>(true);
    const [rewardLoading, setRewardLoading] = useState<boolean>(true);
    const [totalTrovesLoading, setTotalTrovesLoading] = useState<boolean>(true);
    const [totalInfoLoading, setTotalInfoLoading] = useState<boolean>(true);

    const loading = useMemo(() =>
        troveLoading ||
        ausdBalanceLoading ||
        stakeLoading ||
        rewardLoading ||
        totalTrovesLoading ||
        totalInfoLoading, [
        troveLoading,
        ausdBalanceLoading,
        stakeLoading,
        rewardLoading,
        totalTrovesLoading,
        totalInfoLoading
    ])

    const getTrove = useCallback(async () => {
        try {
            setTroveLoading(true);
            const troveRes = await contract.getTrove();
            if (isNil(troveRes)) throw new Error('Trove is undefined');

            let collateralAmounts: CollateralAmount[] = [];
            if (isV2TroveResponse(troveRes)) {
                collateralAmounts = troveRes.collateral_amounts;
            }
            else {
                collateralAmounts = [{
                    amount: troveRes.collateral_amount,
                    denom: baseCoin?.denom ?? ''
                }]
            }

            const debtAmount = convertAmount(troveRes?.debt_amount ?? 0, baseCoin?.ausdDecimal);

            const collateralAmountsByDenom = collateralAmounts.reduce<Record<string, CollateralInfo>>((acc, item) => {
                const decimal = BaseCoinByDenom[item.denom]?.decimal ?? 0;
                const amount = convertAmount(item.amount, decimal);
                const denom = item.denom;

                return {
                    ...acc,
                    [denom]: {
                        amount,
                        denom
                    }
                }
            }, {});
            const baseCollateralAmount = collateralAmountsByDenom[baseCoin?.denom ?? '']?.amount ?? 0;

            const minCollateralRatioByDenom = Object.entries(collateralAmountsByDenom).reduce<Record<string, number>>((acc, [denom, collateralInfo]) => {
                const basePrice = coinPricesByDenom[denom] ?? 0;
                return {
                    ...acc,
                    [denom]: (collateralInfo.amount * basePrice) / (debtAmount || 1)
                };
            }, {})
            const baseMinCollateralRatio = minCollateralRatioByDenom[baseCoin?.denom ?? ''] ?? 0;

            setPageData(prev => ({
                ...prev,
                collateralAmountsByDenom,
                baseCollateralAmount,
                minCollateralRatioByDenom,
                baseMinCollateralRatio,
                minRedeemAmountByDenom: coinPricesByDenom,
                baseMinRedeemAmount: coinPricesByDenom[baseCoin?.denom ?? ''] ?? 0,
                debtAmount
            }))
        }
        catch (err) {
            setPageData(prev => ({
                ...prev,
                collateralAmountsByDenom: {},
                baseCollateralAmount: 0,
                minCollateralRatioByDenom: {},
                baseMinCollateralRatio: 0,
                minRedeemAmountByDenom: {},
                baseMinRedeemAmount: 0,
                debtAmount: 0
            }))
        }
        finally {
            setTroveLoading(false);
        }
    }, [contract, baseCoin, coinPricesByDenom])

    const getAusdBalance = useCallback(async () => {
        try {
            setAusdBalanceLoading(true);
            const ausdBalanceRes = await contract.getAusdBalance();

            setPageData(prev => ({
                ...prev,
                ausdBalance: convertAmount(ausdBalanceRes?.balance ?? 0, baseCoin?.ausdDecimal)
            }))
        }
        catch (err) {
            setPageData(prev => ({
                ...prev,
                ausdBalance: 0
            }))
        }
        finally {
            setAusdBalanceLoading(false);
        }
    }, [contract, baseCoin])

    const getStake = useCallback(async () => {
        try {
            setStakeLoading(true);
            const stakeRes = await contract.getStake();

            setPageData(prev => ({
                ...prev,
                stakedAmount: convertAmount(stakeRes?.amount ?? 0, baseCoin?.decimal),
                poolShare: Number(Number(stakeRes?.percentage).toFixed(6))
            }))
        }
        catch (err) {
            setPageData(prev => ({
                ...prev,
                stakedAmount: 0,
                poolShare: 0
            }))
        }
        finally {
            setStakeLoading(false);
        }
    }, [contract, baseCoin])

    const getReward = useCallback(async () => {
        try {
            setRewardLoading(true);
            const rewardRes = await contract.getReward();

            setPageData(prev => ({
                ...prev,
                rewardAmount: convertAmount(rewardRes ?? 0, baseCoin?.decimal)
            }))
        }
        catch (err) {
            setPageData(prev => ({
                ...prev,
                rewardAmount: 0
            }))
        }
        finally {
            setRewardLoading(false);
        }
    }, [contract, baseCoin])

    const getTotalTroves = useCallback(async () => {
        try {
            setTotalTrovesLoading(true);
            const totalTrovesRes = await requestTotalTroves();

            setPageData(prev => ({
                ...prev,
                totalTrovesAmount: totalTrovesRes?.troves.totalCount ?? 0
            }))
        }
        catch (err) {
            setPageData(prev => ({
                ...prev,
                totalTrovesAmount: 0
            }))
        }
        finally {
            setTotalTrovesLoading(false);
        }
    }, [requestTotalTroves, baseCoin])

    const getTotalInfo = useCallback(async () => {
        try {
            setTotalInfoLoading(true);
            let chainNameQuery = FilterParamByChainName[selectedChainName ?? ChainName.INJECTIVE];

            if (selectedChainName === ChainName.INJECTIVE && selectedAppVersion === AppVersion.V2) {
                chainNameQuery = `${chainNameQuery}2`;
            }

            const { data } = await axios.get<TotalInfoResponseV1 | TotalInfoResponseV2>(
                `https://db.aeroscraper.io/api/collections/protocol/records?filter=chainName="${chainNameQuery}"`
            )
            const res = data.items[0];

            const totalCollateralAmountsByDenom = Array.isArray(res.totalCollateralAmounts) ?
                res.totalCollateralAmounts.reduce<Record<string, CollateralInfo>>((acc, item) => {
                    const decimal = BaseCoinByDenom[item.denom]?.decimal ?? 0;
                    const amount = convertAmount(item.amount, decimal);
                    const denom = item.denom;

                    return {
                        ...acc,
                        [denom]: {
                            amount,
                            denom
                        }
                    }
                }, {}) : { [baseCoin?.denom ?? '']: { denom: baseCoin?.denom ?? '', amount: convertAmount(res.totalCollateralAmount ?? 0, baseCoin?.decimal) } };
            const baseTotalCollateralAmount = totalCollateralAmountsByDenom[baseCoin?.denom ?? '']?.amount ?? 0;

            setPageData(prev => ({
                ...prev,
                totalStakedAmount: convertAmount(res.totalStake ?? 0, baseCoin?.decimal),
                baseTotalCollateralAmount,
                totalCollateralAmountsByDenom,
                totalDebtAmount: convertAmount(res.totalDebtAmount ?? 0, baseCoin?.ausdDecimal),
                totalAusdSupply: convertAmount(res.ausdInfo.total_supply ?? 0, baseCoin?.ausdDecimal),
            }))
        }
        catch (err) {
            setPageData(prev => ({
                ...prev,
                totalStakedAmount: 0,
                totalCollateralAmount: 0,
                totalDebtAmount: 0,
                totalAusdSupply: 0
            }))
        }
        finally {
            setTotalInfoLoading(false);
        }
    }, [selectedAppVersion, selectedChainName, baseCoin])

    const getPageData = useCallback(() => {
        getTrove()
        getAusdBalance()
        getStake()
        getReward()
        getTotalTroves()
        getTotalInfo()
    }, [
        getTrove,
        getAusdBalance,
        getStake,
        getReward,
        getTotalTroves,
        getTotalInfo
    ]);

    const debouncedGetPageData = useCallback(() => {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            getPageData()
        }, 1000);
    }, [getPageData]);

    useEffect(() => {
        debouncedGetPageData();
    }, [debouncedGetPageData]);

    useEffect(() => {
        return () => {
            clearTimeout(debounceTimer.current);
        }
    }, [])

    const value = useMemo<DashboardContextValue>(() => ({
        pageData,
        loading,
        getPageData
    }), [
        pageData,
        loading,
        getPageData
    ])

    return (
        <DashboardContext.Provider value={value}>
            {children}
        </DashboardContext.Provider>
    )
}

export const usePageData = () => useContext(DashboardContext);

export default DashboardProvider