'use client';

import React, { FC, useState, useEffect, useCallback } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { useAppKitConnection } from '@reown/appkit-adapter-solana/react';
import { useProtocolState } from '@/hooks/useProtocolState';
import { useSolanaProtocol } from '@/hooks/useSolanaProtocol';
import { useNotification } from '@/contexts/NotificationProvider';
import { fetchAllTroves } from '@/lib/solana/fetchTroves';
import { TroveData } from '@/lib/solana/types';
import { Table } from '@/components/Table/Table';
import { TableBodyCol } from '@/components/Table/TableBodyCol';
import { TableHeaderCol } from '@/components/Table/TableHeaderCol';
import { NumericFormat } from 'react-number-format';
import Text from '@/components/Texts/Text';
import { RocketIcon } from '@/components/Icons/Icons';
import OutlinedButton from '@/components/Buttons/OutlinedButton';
import { getCroppedString } from '@/utils/stringUtils';

// Helper to convert BigInt to display format
const formatICR = (icr: bigint): string => {
  // ICR is in micro-percent (115000000 = 115%)
  const percentage = Number(icr) / 1_000_000;
  return percentage.toFixed(2);
};

const formatCollateral = (amount: bigint): number => {
  // Convert lamports to SOL (1 SOL = 1e9 lamports)
  return Number(amount) / 1e9;
};

const formatDebt = (amount: bigint): number => {
  // Convert smallest unit to aUSD (1 aUSD = 1e18)
  return Number(amount) / 1e18;
};

const getRatioColor = (icr: string): string => {
  const icrValue = parseFloat(icr);
  if (icrValue < 115) return 'text-red-500';
  if (icrValue < 150) return 'text-orange-500';
  return 'text-green-500';
};

interface RiskyTrovesTabV3Props { }

const RiskyTrovesTabV3: FC<RiskyTrovesTabV3Props> = () => {
  const { connection } = useAppKitConnection();
  const { protocolState } = useProtocolState();
  const { liquidateTroves, liquidateTrove, loading: protocolLoading } = useSolanaProtocol();
  const { addNotification, setProcessLoading, processLoading } = useNotification();

  const [riskyTroves, setRiskyTroves] = useState<TroveData[]>([]);
  const [loading, setLoading] = useState(true);
  const [liquidationPending, setLiquidationPending] = useState<Set<string>>(new Set());

  const fetchRiskyTroves = useCallback(async () => {
    if (!connection) {
      console.log('No connection available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('📋 Fetching all troves...');

      const allTroves = await fetchAllTroves(connection, 'SOL');
      console.log(`Found ${allTroves.length} total troves`);

      // 🐛 DEBUG: Log all troves with their ICR values
      if (allTroves.length > 0) {
        console.log('📊 All troves ICR values:');
        allTroves.forEach((trove, idx) => {
          const icrPercent = Number(trove.icr) / 1_000_000;
          console.log(`  Trove ${idx + 1}: Owner=${trove.owner.toBase58().slice(0, 8)}..., ICR=${icrPercent.toFixed(2)}%, Debt=${Number(trove.debt) / 1e18} aUSD, Collateral=${Number(trove.collateralAmount) / 1e9} SOL`);
        });
      } else {
        console.warn('⚠️ No troves found at all!');
      }

      // Filter for troves with ICR < 115% (115000000 in micro-percent format)
      const RISKY_THRESHOLD = BigInt(115000000);
      console.log(`🔍 Filtering troves with ICR < ${RISKY_THRESHOLD} (${Number(RISKY_THRESHOLD) / 1_000_000}%)`);

      const risky = allTroves.filter(trove => {
        const isRisky = trove.icr < RISKY_THRESHOLD;
        if (isRisky) {
          console.log(`  ✅ Risky trove found: ICR=${Number(trove.icr) / 1_000_000}%, Owner=${trove.owner.toBase58()}`);
        }
        return isRisky;
      });

      // Sort by ICR ascending (lowest ICR = riskiest = first)
      // Lower ICR means higher risk, so riskiest troves appear at the top
      const sortedRisky = [...risky].sort((a, b) => {
        // Compare BigInt ICR values - lower ICR = riskier = should come first
        if (a.icr < b.icr) return -1;
        if (a.icr > b.icr) return 1;
        return 0;
      });

      console.log(`Found ${sortedRisky.length} risky troves (ICR < 115%)`);
      console.log('📊 Sorted by riskiness (lowest ICR first):');
      sortedRisky.forEach((trove, idx) => {
        const icrPercent = Number(trove.icr) / 1_000_000;
        console.log(`  Rank ${idx + 1}: ICR=${icrPercent.toFixed(2)}%, Owner=${trove.owner.toBase58().slice(0, 8)}...`);
      });

      setRiskyTroves(sortedRisky);
    } catch (err) {
      console.error('❌ Error fetching risky troves:', err);
      console.error('Error details:', err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchRiskyTroves();
  }, [fetchRiskyTroves]);

  const handleLiquidate = async (owner: PublicKey) => {
    const ownerKey = owner.toBase58();

    if (liquidationPending.has(ownerKey)) {
      return; // Already liquidating
    }

    try {
      setProcessLoading(true);
      setLiquidationPending(prev => new Set(prev).add(ownerKey));

      // Use single-trove liquidation for per-row action
      const signature = await liquidateTrove(owner);

      addNotification({
        status: 'success',
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: 'Trove liquidated successfully',
      });

      // Refresh troves list
      await fetchRiskyTroves();
    } catch (err: any) {
      console.error('Liquidation error:', err);
      addNotification({
        status: 'error',
        message: err.message || 'Failed to liquidate trove',
        directLink: '',
      });
    } finally {
      setLiquidationPending(prev => {
        const next = new Set(prev);
        next.delete(ownerKey);
        return next;
      });
      setProcessLoading(false);
    }
  };

  return (
    <div>
      <Text size='3xl' className='mb-4'>Liquidate Risky Troves</Text>
      <div className='-ml-4'>
        <Table
          listData={riskyTroves}
          header={
            <div className="grid-cols-6 grid gap-5 lg:gap-0 mt-4 mr-6">
              <TableHeaderCol col={2} text="Owner" />
              <TableHeaderCol col={1} text="Collateral" textCenter />
              <TableHeaderCol col={1} text="Debt" textCenter />
              <TableHeaderCol col={1} text="Coll. Ratio" textCenter />
              <TableHeaderCol col={1} text="" textEnd />
            </div>
          }
          bodyCss='space-y-1 max-h-[350px] overflow-auto overflow-x-hidden'
          loading={loading || protocolLoading}
          renderItem={(item: TroveData) => {
            const icrDisplay = formatICR(item.icr);
            const collateralDisplay = formatCollateral(item.collateralAmount);
            const debtDisplay = formatDebt(item.debt);
            const isLiquidating = liquidationPending.has(item.owner.toBase58());

            return (
              <div className="grid grid-cols-6 gap-4 border-b border-white/10">
                <TableBodyCol
                  col={2}
                  text="XXXXXX"
                  value={
                    <Text size='xs' className='whitespace-nowrap text-start ml-4'>
                      {getCroppedString(item.owner.toBase58(), 6, 8)}
                    </Text>
                  }
                />
                <TableBodyCol
                  col={1}
                  text="XXXXXX"
                  value={
                    <NumericFormat
                      value={collateralDisplay}
                      thousandsGroupStyle="thousand"
                      thousandSeparator=","
                      fixedDecimalScale
                      decimalScale={2}
                      displayType="text"
                      renderText={(value) => (
                        <Text size='xs' responsive={true} className='whitespace-nowrap'>
                          {value} SOL
                        </Text>
                      )}
                    />
                  }
                />
                <TableBodyCol
                  col={1}
                  text="XXXXXX"
                  value={
                    <NumericFormat
                      value={debtDisplay}
                      thousandsGroupStyle="thousand"
                      thousandSeparator=","
                      fixedDecimalScale
                      decimalScale={2}
                      displayType="text"
                      renderText={(value) => (
                        <Text size='xs' responsive={true} className='whitespace-nowrap'>
                          {value} AUSD
                        </Text>
                      )}
                    />
                  }
                />
                <TableBodyCol
                  col={1}
                  text="XXXXXX"
                  value={
                    <Text
                      size='xs'
                      responsive={true}
                      className='whitespace-nowrap text-center'
                      dynamicTextColor={getRatioColor(icrDisplay)}
                    >
                      {icrDisplay}%
                    </Text>
                  }
                />
                <TableBodyCol
                  col={1}
                  text="XXXXXX"
                  value={
                    <div className='flex justify-end pr-4'>
                      <OutlinedButton
                        containerClassName='w-[103px] shrink-0'
                        className='text-xs h-8'
                        onClick={() => handleLiquidate(item.owner)}
                        loading={isLiquidating}
                      >
                        Liquidate
                      </OutlinedButton>
                    </div>
                  }
                />
              </div>
            );
          }}
        />
      </div>
      {riskyTroves.length === 0 && !loading && (
        <div className='my-10'>
          <RocketIcon className='w-5 h-5 text-red-500 mx-auto' />
          <Text size='base' className='whitespace-nowrap text-center mt-6'>
            Risky troves list is empty
          </Text>
        </div>
      )}
    </div>
  );
};

export default RiskyTrovesTabV3;

