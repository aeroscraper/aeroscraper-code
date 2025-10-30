import GradientButton from '@/components/Buttons/GradientButton';
import SkeletonLoading from '@/components/Table/SkeletonLoading';
import { Table } from '@/components/Table/Table';
import { TableBodyCol } from '@/components/Table/TableBodyCol';
import { TableHeaderCol } from '@/components/Table/TableHeaderCol';
import { useNotification } from '@/contexts/NotificationProvider';
import useAppContract from '@/contracts/app/useAppContract';

import { RiskyTrovesModelV1 } from '@/types/types';
import { getIsInjectiveResponse, convertAmount, getRatioColor } from '@/utils/contractUtils';
import { getCroppedString } from '@/utils/stringUtils';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NumericFormat } from 'react-number-format';
import { PageData } from '../../_types/types';
import Text from '@/components/Texts/Text';
import { RocketIcon } from '@/components/Icons/Icons';
import graphql from '@/services/graphql';
import { delay } from '@/utils/promiseUtils';
import useChainAdapter from '@/hooks/useChainAdapter';
import { ChainName } from '@/enums/Chain';
import { isV2TroveResponse } from '@/contracts/app/types';

type Props = {
  getPageData: () => void;
  basePrice: number;
}

const RiskyTrovesTabV1: FC<Props> = ({ getPageData, basePrice }) => {
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const { baseCoin, selectedChainName = ChainName.INJECTIVE, selectedAppVersion } = useChainAdapter();
  const contract = useAppContract();
  const [loading, setLoading] = useState(true);
  const [riskyTroves, setRiskyTroves] = useState<RiskyTrovesModelV1[]>([]);
  const { addNotification, setProcessLoading, processLoading } = useNotification();

  const { requestRiskyTroves } = useMemo(() => graphql({ selectedChainName, selectedAppVersion }), [selectedChainName, selectedAppVersion]);

  const liquidateTroves = async () => {
    try {
      setProcessLoading(true);

      const res:any = await contract.liquidateTroves();
      addNotification({
        status: 'success',
        directLink: getIsInjectiveResponse(res) ? res?.txHash : res?.transactionHash,
        message: 'Risky Troves Liquidated'
      });
      getPageData();
      getRiskyTroves();
    }
    catch (err) {
      console.error(err);
      addNotification({
        message: "",
        status: 'error',
        directLink: ""
      })
    }
    finally {
      setProcessLoading(false);
    }
  }

  const getRiskyTroves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestRiskyTroves();

      const batchSize = 10;
      const batches = Math.ceil(res.troves.nodes.length / batchSize);

      const getTrovesPromises = [];

      for (let i = 0; i < batches; i++) {
        const batchStart = i * batchSize;
        const batchEnd = (i + 1) * batchSize;
        const batchItems = res.troves.nodes.slice(batchStart, batchEnd);

        const batchPromises = batchItems.map(async (item) => {
          try {
            const troveRes = await contract.getTroveByAddress(item.owner);

            const collateralAmount = isV2TroveResponse(troveRes) ? convertAmount(troveRes?.collateral_amounts.find(item => item.denom === baseCoin?.denom)?.amount ?? 0, baseCoin?.decimal) : convertAmount(troveRes?.collateral_amount ?? 0, baseCoin?.decimal);

            return {
              owner: item.owner,
              liquidityThreshold: item.liquidityThreshold || Number(isFinite(Number(((collateralAmount * basePrice) / convertAmount(troveRes?.debt_amount ?? 0, baseCoin?.ausdDecimal)) * 100)) ? Number(((collateralAmount * basePrice) / convertAmount(troveRes?.debt_amount ?? 0, baseCoin?.ausdDecimal)) * 100).toFixed(3) : 0),
              collateralAmount,
              debtAmount: convertAmount(troveRes?.debt_amount ?? 0, baseCoin?.ausdDecimal),
            };
          } catch (err) {
            return {
              owner: item.owner,
              liquidityThreshold: item.liquidityThreshold,
              collateralAmount: 0,
              debtAmount: 0,
            };
          }
        });

        getTrovesPromises.push(...batchPromises);

        await delay(1000);
      }

      const data = await Promise.all(getTrovesPromises);
      setRiskyTroves(data.sort((a, b) => a.liquidityThreshold - b.liquidityThreshold));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [contract, baseCoin, requestRiskyTroves]);

  const debouncedGetRiskyTroves = useCallback(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      getRiskyTroves();
    }, 1500);
  }, [getRiskyTroves]);

  useEffect(() => {
    selectedChainName && debouncedGetRiskyTroves();
  }, [debouncedGetRiskyTroves, selectedChainName])

  return (
    <div>
      <Text size='3xl' className='mb-4'>Liquidate Risky Troves</Text>
      <div className='-ml-4'>
        <Table
          listData={riskyTroves}
          header={<div className="grid-cols-6 grid gap-5 lg:gap-0 mt-4 mr-6">
            <TableHeaderCol col={2} text="Owner" />
            <TableHeaderCol col={1} text="Collateral" textCenter />
            <TableHeaderCol col={1} text="Debt" textEnd />
            <TableHeaderCol col={2} text="Coll. Ratio" textEnd />
          </div>}
          bodyCss='space-y-1 max-h-[350px] overflow-auto overflow-x-hidden'
          loading={loading}
          renderItem={(item: RiskyTrovesModelV1) => {
            return <div className="grid grid-cols-6 gap-4 border-b border-white/10">
              <TableBodyCol col={2} text="XXXXXX" value={
                <Text size='xs' className='whitespace-nowrap text-start ml-4'>{getCroppedString(item.owner, 6, 8)}</Text>
              } />
              <TableBodyCol col={1} text="XXXXXX" value={
                <NumericFormat
                  value={item.collateralAmount}
                  thousandsGroupStyle="thousand"
                  thousandSeparator=","
                  fixedDecimalScale
                  decimalScale={2}
                  displayType="text"
                  renderText={(value) =>
                    <Text size='xs' responsive={true} className='whitespace-nowrap'>{value} {baseCoin?.name}</Text>
                  }
                />} />
              <TableBodyCol col={1} text="XXXXXX" value={
                <NumericFormat
                  value={item.debtAmount}
                  thousandsGroupStyle="thousand"
                  thousandSeparator=","
                  fixedDecimalScale
                  decimalScale={2}
                  displayType="text"
                  renderText={(value) =>
                    <Text size='xs' responsive={true} className='whitespace-nowrap'>{value} AUSD</Text>
                  }
                />} />
              <TableBodyCol col={2} text="XXXXXX" value={
                <NumericFormat
                  value={item.liquidityThreshold}
                  thousandsGroupStyle="thousand"
                  thousandSeparator=","
                  fixedDecimalScale
                  decimalScale={2}
                  displayType="text"
                  renderText={(value) =>
                    selectedChainName === ChainName.INJECTIVE ?
                      <Text size='xs' responsive={true} className='whitespace-nowrap text-end pr-10' dynamicTextColor={getRatioColor(item.liquidityThreshold)}>{item.liquidityThreshold}%</Text>
                      :
                      <Text size='xs' responsive={true} className='whitespace-nowrap text-end pr-10' dynamicTextColor={getRatioColor(((item.liquidityThreshold ?? 0) * (basePrice ?? 0))) ?? 0}>{Number((item.liquidityThreshold ?? 0) * (basePrice ?? 0)).toFixed(3)}%</Text>
                  }
                />}
              />
            </div>
          }} />
      </div>
      {(riskyTroves.length === 0 && !loading) && (
        <div className='my-10'>
          <RocketIcon className='w-5 h-5 text-red-500 mx-auto' />
          <Text size='base' className='whitespace-nowrap text-center mt-6'>Risky troves list is empty</Text>
        </div>
      )}
      <GradientButton
        disabled={riskyTroves.length === 0}
        className='w-full md:w-[374px] h-11 ml-auto mt-6'
        onClick={liquidateTroves}
        rounded="rounded-lg"
        loading={processLoading}
      >
        Liquidate Risky Troves
      </GradientButton>
    </div>
  )
}

export default RiskyTrovesTabV1