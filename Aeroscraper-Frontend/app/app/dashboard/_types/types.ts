import { CollateralInfo } from "@/contracts/app/types";

export type PageData = {
    baseCollateralAmount: number;
    collateralAmountsByDenom: Record<string, CollateralInfo | undefined>;
    baseTotalCollateralAmount: number;
    totalCollateralAmountsByDenom: Record<string, CollateralInfo | undefined>;
    baseMinCollateralRatio: number;
    minCollateralRatioByDenom: Record<string, number | undefined>;
    baseMinRedeemAmount: number;
    minRedeemAmountByDenom: Record<string, number | undefined>;
    debtAmount: number;
    totalDebtAmount: number;
    ausdBalance: number;
    stakedAmount: number;
    totalStakedAmount: number;
    totalAusdSupply: number;
    poolShare: number;
    rewardAmount: number;
    totalTrovesAmount: number;
}

export type TotalCollateralModel = {
    amount: number,
    denom: string
}

export type Chain = {
    id: string;
    name: string;
    imageUrl: string;
}