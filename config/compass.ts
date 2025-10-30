import { AppConfig } from "./app";

export interface CompassConfig {
    chainId: string;
    chainName: string;
    rest: string;
    rpc: string;
    bip44: CompassConfigBip44;
    bech32Config: CompassConfigBech32Config;
    currencies: CompassConfigCurrencies[];
    feeCurrencies: CompassConfigFeeCurrencies[];
    stakeCurrency: CompassConfigStakeCurrency;
    image: string;
    theme: CompassConfigTheme;
}
export interface CompassConfigBip44 {
    coinType: number;
}
export interface CompassConfigBech32Config {
    bech32PrefixAccAddr: string;
    bech32PrefixAccPub: string;
    bech32PrefixValAddr: string;
    bech32PrefixValPub: string;
    bech32PrefixConsAddr: string;
    bech32PrefixConsPub: string;
}
export interface CompassConfigCurrencies {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
}
export interface CompassConfigFeeCurrenciesGasPriceStep {
    low: number;
    average: number;
    high: number;
}
export interface CompassConfigFeeCurrencies {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
    gasPriceStep?: CompassConfigFeeCurrenciesGasPriceStep;
}
export interface CompassConfigStakeCurrency {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
}
export interface CompassConfigTheme {
    primaryColor: string;
    gradient: string;
}

export const getCompassConfig = (config: AppConfig): CompassConfig => ({
    chainId: config.chainId,
    chainName: config.chainName,
    rpc: config.rpcUrl,
    rest: config.httpUrl ?? '',
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
    image: "",
    theme: {
        primaryColor: "#fff",
        gradient: "linear-gradient(180deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0) 100%)"
    }
})