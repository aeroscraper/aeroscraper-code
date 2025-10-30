import { AppConfig } from "./app";

export interface FinCoin {
    readonly coinDenom: string;
    readonly coinMinimalDenom: string;
    readonly coinDecimals: number;
}

export interface FinConfig {
    readonly chainId: string;
    readonly chainName: string;
    readonly rpc: string;
    readonly rest?: string;
    readonly bech32Config: {
        readonly bech32PrefixAccAddr: string;
        readonly bech32PrefixAccPub: string;
        readonly bech32PrefixValAddr: string;
        readonly bech32PrefixValPub: string;
        readonly bech32PrefixConsAddr: string;
        readonly bech32PrefixConsPub: string;
    };
    readonly currencies: readonly FinCoin[];
    readonly feeCurrencies: readonly FinCoin[];
    readonly stakeCurrency: FinCoin;
    readonly bip44: { readonly coinType: number };
    readonly coinType: number;
    readonly features: string[];
}

export const getFinConfig = (config: AppConfig): FinConfig => ({
    chainId: config.chainId,
    chainName: config.chainName,
    rpc: config.rpcUrl,
    rest: config.httpUrl,
    bech32Config: {
        bech32PrefixAccAddr: `${config.addressPrefix}`,
        bech32PrefixAccPub: `${config.addressPrefix}pub`,
        bech32PrefixValAddr: `${config.addressPrefix}valoper`,
        bech32PrefixValPub: `${config.addressPrefix}valoperpub`,
        bech32PrefixConsAddr: `${config.addressPrefix}valcons`,
        bech32PrefixConsPub: `${config.addressPrefix}valconspub`,
    },
    currencies: [
        {
            coinDenom: config.coinMap[config.feeToken].denom,
            coinMinimalDenom: config.feeToken,
            coinDecimals: config.coinMap[config.feeToken].fractionalDigits,
        },
    ],
    feeCurrencies: [
        {
            coinDenom: config.coinMap[config.feeToken].denom,
            coinMinimalDenom: config.feeToken,
            coinDecimals: config.coinMap[config.feeToken].fractionalDigits,
        },
    ],
    stakeCurrency: {
        coinDenom: config.coinMap[config.stakingToken].denom,
        coinMinimalDenom: config.stakingToken,
        coinDecimals: config.coinMap[config.stakingToken].fractionalDigits,
    },
    bip44: { coinType: 118 },
    coinType: 118,
    features: [
        "stargate",
        "no-legacy-stdTx",
        "ibc-transfer",
        "ibc-go",
        "cosmwasm",
        "wasmd_0.24+",
    ],
});
