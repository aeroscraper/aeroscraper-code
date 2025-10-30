import GradientButton from '@/components/Buttons/GradientButton';
import SkeletonLoading from '@/components/Table/SkeletonLoading';
import { Table } from '@/components/Table/Table';
import { TableBodyCol } from '@/components/Table/TableBodyCol';
import { TableHeaderCol } from '@/components/Table/TableHeaderCol';
import { useNotification } from '@/contexts/NotificationProvider';
import useAppContract from '@/contracts/app/useAppContract';

import { RiskyTrovesModelV2 } from '@/types/types';
import { getIsInjectiveResponse, convertAmount, getRatioColor } from '@/utils/contractUtils';
import { getCroppedString } from '@/utils/stringUtils';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NumericFormat } from 'react-number-format';
import Text from '@/components/Texts/Text';
import { ChevronUpIcon, RocketIcon } from '@/components/Icons/Icons';
import graphql from '@/services/graphql';
import { delay } from '@/utils/promiseUtils';
import useChainAdapter from '@/hooks/useChainAdapter';
import { ChainName } from '@/enums/Chain';
import { CollateralInfo, isV2TroveResponse } from '@/contracts/app/types';
import OutlinedButton from '@/components/Buttons/OutlinedButton';
import { usePrice } from '@/contexts/PriceProvider';
import { DefaultAssetByChainName, assetByDenom } from '@/constants/assetConstants';
import Dropdown from '@/components/Dropdown/Dropdown';
import BorderedContainer from '@/components/Containers/BorderedContainer';
import { isNil } from 'lodash';

type Props = {
    getPageData: () => void;
    basePrice: number;
}

const RiskyTrovesTabV2: FC<Props> = ({ getPageData, basePrice }) => {
    const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
    const { selectedChainName = ChainName.INJECTIVE, selectedAppVersion, baseCoin } = useChainAdapter();
    const { coinPricesByDenom } = usePrice();
    const contract = useAppContract();
    const [loading, setLoading] = useState(true);
    const [riskyTroves, setRiskyTroves] = useState<RiskyTrovesModelV2[]>([]);
    const { addNotification, setProcessLoading, processLoading } = useNotification();

    const { requestRiskyTroves } = useMemo(() => graphql({ selectedChainName, selectedAppVersion }), [selectedChainName, selectedAppVersion]);

    const liquidateTroves = async (address: string) => {
        try {
            setProcessLoading(true);

            const res:any = await contract.liquidateTrovesV2(address);
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

                        if (!isV2TroveResponse(troveRes)) throw new Error('Invalid trove response');

                        const collateralAmounts = troveRes.collateral_amounts.map<CollateralInfo>(item => {
                            const asset = assetByDenom[item.denom];

                            return {
                                denom: item.denom,
                                amount: convertAmount(item.amount, asset?.decimal)
                            }
                        })

                        const totalDollarValue = collateralAmounts.reduce((acc, curr) => {
                            const dollarValue = (coinPricesByDenom[curr.denom] ?? 0) * curr.amount;
                            return acc + dollarValue;
                        }, 0)

                        return {
                            owner: item.owner,
                            liquidityThreshold: item.liquidityThreshold ?? Number(isFinite(Number((totalDollarValue / convertAmount(troveRes?.debt_amount ?? 0, baseCoin?.ausdDecimal)) * 100)) ? Number((totalDollarValue / convertAmount(troveRes?.debt_amount ?? 0, baseCoin?.ausdDecimal)) * 100).toFixed(3) : (convertAmount(troveRes?.debt_amount ?? 0, baseCoin?.ausdDecimal) > 0) ? -1 : 0),
                            collateralAmounts,
                            debtAmount: convertAmount(troveRes?.debt_amount ?? 0, baseCoin?.ausdDecimal),
                            totalDollarValue
                        };
                    } catch (err) {
                        return {
                            owner: item.owner,
                            liquidityThreshold: item.liquidityThreshold ?? 0,
                            collateralAmounts: [],
                            debtAmount: 0,
                            totalDollarValue: 0
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
    }, [contract, coinPricesByDenom, baseCoin, requestRiskyTroves]);

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
                        <TableHeaderCol col={1} text="Debt" textCenter />
                        <TableHeaderCol col={1} text="Coll. Ratio" textCenter />
                        <TableHeaderCol col={1} text="" textEnd />
                    </div>}
                    bodyCss='space-y-1 max-h-[350px] overflow-auto overflow-x-hidden'
                    loading={loading}
                    renderItem={(item: RiskyTrovesModelV2) => {
                        return <div className="grid grid-cols-6 gap-4 border-b border-white/10">
                            <TableBodyCol col={2} text="XXXXXX" value={
                                <Text size='xs' className='whitespace-nowrap text-start ml-4'>{getCroppedString(item.owner, 6, 8)}</Text>
                            } />
                            <TableBodyCol col={1} text="XXXXXX" value={
                                <div className='w-full h-full flex justify-center items-center gap-2 shrink-0'>
                                    <NumericFormat
                                        value={item.totalDollarValue}
                                        thousandsGroupStyle="thousand"
                                        thousandSeparator=","
                                        fixedDecimalScale
                                        decimalScale={2}
                                        displayType="text"
                                        renderText={(value) =>
                                            <Text size='xs' responsive={true} className='whitespace-nowrap'>{value} {DefaultAssetByChainName[selectedChainName]?.shortName}</Text>
                                        }
                                    />
                                </div>
                                // <Dropdown
                                //     toggleButton={
                                //         <div className='w-full h-full flex justify-center items-center gap-2 shrink-0'>
                                //             <NumericFormat
                                //                 value={item.totalDollarValue}
                                //                 thousandsGroupStyle="thousand"
                                //                 thousandSeparator=","
                                //                 fixedDecimalScale
                                //                 decimalScale={2}
                                //                 displayType="text"
                                //                 renderText={(value) =>
                                //                     <Text size='xs' responsive={true} className='whitespace-nowrap'>{value} USD</Text>
                                //                 }
                                //             />
                                //             <ChevronUpIcon className='w-6 h-6 text-white shrink-0 rotate-180' />
                                //         </div>
                                //     }
                                // >
                                //     <BorderedContainer
                                //         containerClassName='w-[168px] notification-dropdown-gradient p-[1px]'
                                //         className='flex flex-col p-4 gap-4 rounded-[7px]'
                                //     >
                                //         {
                                //             item.collateralAmounts.map((collateralInfo) => {
                                //                 const asset = assetByDenom[collateralInfo.denom];
                                //                 if (isNil(asset)) return null;

                                //                 return (
                                //                     <div key={collateralInfo.denom} className='flex items-center gap-1'>
                                //                         <img alt={asset.name} src={asset.imageURL} className='w-4 h-4' />
                                //                         <Text size='xs' responsive={true} className='whitespace-nowrap'>{collateralInfo.amount} {asset.shortName}</Text>
                                //                     </div>
                                //                 )
                                //             })
                                //         }
                                //     </BorderedContainer>
                                // </Dropdown>
                            } />
                            <TableBodyCol col={1} text="XXXXXX" value={
                                <NumericFormat
                                    value={item.debtAmount}
                                    thousandsGroupStyle="thousand"
                                    thousandSeparator=","
                                    fixedDecimalScale
                                    decimalScale={2}
                                    displayType="text"
                                    renderText={(value) =>
                                        <Text size='xs' responsive={true} className='whitespace-nowrap'>{1 > Number(value) && Number(value) >= 0 ? ' < 0.00' : value} AUSD</Text>
                                    }
                                />} />
                            <TableBodyCol col={1} text="XXXXXX" value={
                                <NumericFormat
                                    value={item.liquidityThreshold}
                                    thousandsGroupStyle="thousand"
                                    thousandSeparator=","
                                    fixedDecimalScale
                                    decimalScale={2}
                                    displayType="text"
                                    renderText={(value) =>
                                        <Text size='xs' responsive={true} className='whitespace-nowrap text-end pr-10' dynamicTextColor={getRatioColor(item.liquidityThreshold)}>{item.liquidityThreshold / 1000000 > 1 ? "∞" : item.liquidityThreshold}%</Text>
                                    }
                                />}
                            />
                            <TableBodyCol col={1} text="XXXXXX" value={
                                item.liquidityThreshold <= 115 ?
                                    <OutlinedButton
                                        containerClassName='w-[103px] mx-auto shrink-0'
                                        className='text-xs h-8'
                                        onClick={() => liquidateTroves(item.owner)}
                                        loading={processLoading}
                                    >
                                        Liquidate
                                    </OutlinedButton>
                                    :
                                    ''
                            }
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
        </div>
    )
}

export default RiskyTrovesTabV2