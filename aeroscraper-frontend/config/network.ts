import { AppConfig } from "./app"
import { ChainName } from "@/enums/Chain"

export const mainnetArchwayConfig: AppConfig = {
    chainId: 'archway-1',
    chainName: 'Archway Mainnet',
    addressPrefix: 'archway',
    rpcUrl: 'https://rpc.mainnet.archway.io:443',
    httpUrl: 'https://api.mainnet.archway.io',
    feeToken: 'ARCH',
    stakingToken: 'ARCH',
    coinMap: {
        ARCH: { denom: 'ARCH', fractionalDigits: 18 },
        'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2': { denom: 'ATOM', fractionalDigits: 6 }
    },
    gasPrice: 0.025,
    fees: {
        upload: 1500000,
        init: 500000,
        exec: 200000,
    },
}

export const testnetInjectiveConfig: AppConfig = {
    chainId: 'injective-888',
    chainName: 'Injective (Testnet)',
    addressPrefix: 'inj',
    rpcUrl: 'https://testnet.sentry.tm.injective.network/',
    httpUrl: 'https://injective-testnet-rest.publicnode.com',
    feeToken: 'inj',
    stakingToken: 'inj',
    coinMap: {
        inj: { denom: 'inj', fractionalDigits: 18 }
    },
    gasPrice: 0.025,
    fees: {
        upload: 1500000,
        init: 500000,
        exec: 2000000,
    },
}

export const mainnetNeutronConfig: AppConfig = {
    chainId: 'pion-1',
    chainName: 'Neutron Testnet',
    addressPrefix: 'neutron',
    rpcUrl: 'https://rpc-palvus.pion-1.ntrn.tech',
    httpUrl: 'https://rest-palvus.pion-1.ntrn.tech',
    feeToken: 'untrn',
    stakingToken: 'untrn',
    coinMap: {
        NTRN: { denom: 'untrn', fractionalDigits: 6 },
    },
    gasPrice: 0.025,
    fees: {
        upload: 1500000,
        init: 500000,
        exec: 200000,
    },
}

export const mainnetNibiruConfig: AppConfig = {
    chainId: 'nibiru-itn-3',
    chainName: 'nibiru-itn-3',
    addressPrefix: 'nibiru',
    rpcUrl: 'https://rpc.itn-3.nibiru.fi/',
    httpUrl: 'https://lcd.itn-3.nibiru.fi/',
    feeToken: 'unibi',
    stakingToken: 'unibi',
    coinMap: {
        unibi: { denom: 'unibi', fractionalDigits: 6 },
    },
    gasPrice: 0.025,
    fees: {
        upload: 1500000,
        init: 500000,
        exec: 200000,
    },
}

export const mainnetSeiConfig: AppConfig = {
    chainId: 'pacific-1',
    chainName: 'Sei Mainnet',
    addressPrefix: 'sei',
    rpcUrl: 'https://sei-rpc.polkachu.com/',
    httpUrl: 'https://sei-api.polkachu.com/',
    feeToken: 'usei',
    stakingToken: 'usei',
    coinMap: {
        usei: { denom: 'SEI', fractionalDigits: 6 },
    },
    gasPrice: 0.025,
    fees: {
        upload: 1500000,
        init: 500000,
        exec: 200000,
    },
}

export const uniTestnetConfig: AppConfig = {
    chainId: 'pacific-1',
    chainName: 'Sei Mainnet',
    addressPrefix: 'sei',
    rpcUrl: 'https://rpc-sei.stingray.plus/',
    httpUrl: 'https://api-sei.stingray.plus/',
    feeToken: 'usei',
    stakingToken: 'usei',
    coinMap: {
        usei: { denom: 'SEI', fractionalDigits: 6 },
    }
}


export const getConfig = (network: string, selectedChainName?: ChainName): AppConfig => {
    /* if (network === 'mainnet') return mainnetConfig
    return mainnetConfig */
    if (selectedChainName === ChainName.ARCHWAY) {
        return mainnetArchwayConfig
    }
    if (selectedChainName === ChainName.NEUTRON) {
        return mainnetNeutronConfig
    }
    if (selectedChainName === ChainName.INJECTIVE) {
        return testnetInjectiveConfig
    }

    return uniTestnetConfig
}