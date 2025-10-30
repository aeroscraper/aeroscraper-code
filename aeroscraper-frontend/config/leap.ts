import { AppConfig } from "./app";

export interface LeapConfig {
    chainId: string;
    chainName: string;
    rest: string;
    rpc: string;
    bip44: LeapConfigBip44;
    bech32Config: LeapConfigBech32Config;
    currencies: LeapConfigCurrencies[];
    feeCurrencies: LeapConfigFeeCurrencies[];
    stakeCurrency: LeapConfigStakeCurrency;
    image: string;
    theme: LeapConfigTheme;
}
export interface LeapConfigBip44 {
    coinType: number;
}
export interface LeapConfigBech32Config {
    bech32PrefixAccAddr: string;
    bech32PrefixAccPub: string;
    bech32PrefixValAddr: string;
    bech32PrefixValPub: string;
    bech32PrefixConsAddr: string;
    bech32PrefixConsPub: string;
}
export interface LeapConfigCurrencies {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
}
export interface LeapConfigFeeCurrenciesGasPriceStep {
    low: number;
    average: number;
    high: number;
}
export interface LeapConfigFeeCurrencies {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
    gasPriceStep?: LeapConfigFeeCurrenciesGasPriceStep;
}
export interface LeapConfigStakeCurrency {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
}
export interface LeapConfigTheme {
    primaryColor: string;
    gradient: string;
}

export const getLeapConfig = (config: AppConfig): LeapConfig => ({
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
    image: "https://raw.githubusercontent.com/leapwallet/assets/2289486990e1eaf9395270fffd1c41ba344ef602/images/logo.svg",
    theme: {
        primaryColor: "#fff",
        gradient: "linear-gradient(180deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0) 100%)"
    }
})