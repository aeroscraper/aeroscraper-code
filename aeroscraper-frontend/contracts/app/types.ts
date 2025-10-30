import { isNil } from "lodash";

export type GetTroveResponseV1 = {
    collateral_amount: string;
    debt_amount: string;
}

export type GetTroveResponseV2 = {
    collateral_amounts: CollateralAmount[];
    debt_amount: string;
}

export type CollateralAmount = {
    amount: string,
    denom: string,
}

export type GetStakeResponse = {
    amount: string;
    percentage: number;
}

export type CW20BalanceResponse = {
    balance: string;
}

export type CW20TokenInfoResponse = {
    name: string;
    symbol: string;
    decimals: number;
    total_supply: string;
}

export type CollateralInfo = {
    amount: number;
    denom: string;
}

export interface TotalInfoResponseV1 {
    page: number
    perPage: number
    totalItems: number
    totalPages: number
    items: ItemV1[]
}

export interface TotalInfoResponseV2 {
    page: number
    perPage: number
    totalItems: number
    totalPages: number
    items: ItemV2[]
}

export interface ItemV1 {
    ausdInfo: AusdInfo
    chainName: string
    collectionId: string
    collectionName: string
    created: string
    id: string
    totalCollateralAmount: string
    totalCollateralAmounts: number
    totalDebtAmount: string
    totalStake: string
    updated: string
}

export interface ItemV2 {
    ausdInfo: AusdInfo
    chainName: string
    collectionId: string
    collectionName: string
    created: string
    id: string
    totalCollateralAmount: string
    totalCollateralAmounts: CollateralInfo[];
    totalDebtAmount: string
    totalStake: string
    updated: string
}

export interface AusdInfo {
    decimals: number
    name: string
    symbol: string
    total_supply: string
}

export const isV2TroveResponse = (data: GetTroveResponseV1 | GetTroveResponseV2 | undefined): data is GetTroveResponseV2 =>
    !isNil((data as GetTroveResponseV2)?.collateral_amounts) && Array.isArray((data as GetTroveResponseV2)?.collateral_amounts);