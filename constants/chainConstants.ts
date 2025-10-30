import { ChainName } from "@/enums/Chain";
import { AppVersion, BaseCoin, ChainInfo } from "@/types/types";
import { chains } from 'chain-registry'

const visibleChains: ChainName[] = [
    ChainName.SEI,
    ChainName.INJECTIVE
]

export const availableChains = Object.values(chains).filter(chain => visibleChains.includes(chain.chain_name as ChainName));

export const BaseCoinByChainName: Record<ChainName, BaseCoin> = {
    [ChainName.SEI]: {
        name: "SEI",
        denom: "usei",
        image: "/images/token-images/sei.png",
        tokenImage: "/images/token-images/sei.png",
        decimal: 6,
        ausdDecimal: 6
    },
    [ChainName.ARCHWAY]: {
        name: "ATOM",
        denom: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
        image: "/images/token-images/archway-coin.png",
        tokenImage: "/images/token-images/atom.svg",
        decimal: 6,
        ausdDecimal: 6
    },
    [ChainName.INJECTIVE]: {
        name: "INJ",
        denom: "inj",
        image: "/images/token-images/inj.svg",
        tokenImage: "/images/token-images/inj.svg",
        decimal: 18,
        ausdDecimal: 18
    },
    [ChainName.NEUTRON]: {
        name: "NTRN",
        denom: "untrn",
        image: "/images/token-images/neutron.svg",
        tokenImage: "/images/token-images/neutron.svg",
        decimal: 6,
        ausdDecimal: 6
    },
    [ChainName.XION]: {
        name: "XION",
        denom: "uxion",
        image: "/images/token-images/xion.png",
        tokenImage: "/images/token-images/xion.png",
        decimal: 6,
        ausdDecimal: 6
    },
    [ChainName.SOLANA]: {
        name: "SOL",
        denom: "SOL",
        image: "/images/token-images/sol.svg",
        tokenImage: "/images/token-images/sol.svg",
        decimal: 9,
        ausdDecimal: 18
    }
}

export const BaseCoinByDenom = Object.values(BaseCoinByChainName).reduce<Record<string, BaseCoin>>((acc, baseCoin) => {
    acc[baseCoin.denom] = baseCoin;
    return acc;
}, {});

export const TransactionDomainByChainName: Record<ChainName, { accountUrl: string, txDetailUrl: string }> = {
    [ChainName.SEI]: {
        txDetailUrl: "https://sei.explorers.guru/transaction/",
        accountUrl: "https://sei.explorers.guru/account/"
    },
    [ChainName.ARCHWAY]: {
        txDetailUrl: "https://www.mintscan.io/archway/transactions/",
        accountUrl: "https://www.mintscan.io/archway/account/"
    },
    [ChainName.INJECTIVE]: {
        txDetailUrl: "https://testnet.explorer.injective.network/transaction/",
        accountUrl: "https://testnet.explorer.injective.network/account/"
    },
    [ChainName.NEUTRON]: {
        txDetailUrl: "https://neutron.celat.one/transactions/",
        accountUrl: "https://neutron.celat.one/account/"
    },
    [ChainName.XION]: {
        txDetailUrl: "https://explorer.burnt.com/xion-testnet-1/tx/",
        accountUrl: "https://explorer.burnt.com/xion-testnet-1/account/"
    },
    [ChainName.SOLANA]: {
        txDetailUrl: "https://solscan.io/tx/",
        accountUrl: "https://solscan.io/address/"
    }
}

export const getContractAddressesByChain = (appVersion: AppVersion, chainName?: ChainName) => {
    if (chainName === ChainName.SEI) {
        return {
            contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string,
            ausdContractAddress: process.env.NEXT_PUBLIC_AUSD_CONTRACT_ADDRESS as string,
            oraclecontractAddress: process.env.NEXT_PUBLIC_ORACLE_CONTRACT_ADDRESS as string
        }
    }
    else if (chainName === ChainName.ARCHWAY) {
        return {
            contractAddress: process.env.NEXT_PUBLIC_ARCH_CONTRACT_ADDRESS as string,
            ausdContractAddress: process.env.NEXT_PUBLIC_ARCH_AUSD_CONTRACT_ADDRESS as string,
            oraclecontractAddress: ''
        }
    } else if (chainName === ChainName.NEUTRON) {
        return {
            contractAddress: process.env.NEXT_PUBLIC_NEUTRON_CONTRACT_ADDRESS as string,
            ausdContractAddress: process.env.NEXT_PUBLIC_NEUTRON_AUSD_CONTRACT_ADDRESS as string,
            oraclecontractAddress: process.env.NEXT_PUBLIC_NEUTRON_ORACLE_CONTRACT_ADDRESS as string
        }
    } else if (chainName === ChainName.INJECTIVE) {
        if (appVersion === AppVersion.V1) {
            return {
                contractAddress: process.env.NEXT_PUBLIC_INJECTIVE_CONTRACT_ADDRESS_V1 as string,
                ausdContractAddress: process.env.NEXT_PUBLIC_INJECTIVE_AUSD_CONTRACT_ADDRESS_V1 as string,
                oraclecontractAddress: process.env.NEXT_PUBLIC_INJECTIVE_ORACLE_CONTRACT_ADDRESS_V1 as string
            }
        }

        return {
            contractAddress: process.env.NEXT_PUBLIC_INJECTIVE_CONTRACT_ADDRESS_V2 as string,
            ausdContractAddress: process.env.NEXT_PUBLIC_INJECTIVE_AUSD_CONTRACT_ADDRESS_V2 as string,
            oraclecontractAddress: process.env.NEXT_PUBLIC_INJECTIVE_ORACLE_CONTRACT_ADDRESS_V2 as string
        }
    } else if (chainName === ChainName.XION) {
        return {
            contractAddress: process.env.NEXT_PUBLIC_AERO_XION as string,
            ausdContractAddress: process.env.NEXT_PUBLIC_CW20_AUSD_XION as string,
            oraclecontractAddress: process.env.NEXT_PUBLIC_ORACLE_HELPER_XION as string,
        }
    }

    return {
        contractAddress: '',
        ausdContractAddress: '',
        oraclecontractAddress: '',
    }
}

export const ChainInfoByName: Record<ChainName, ChainInfo> = {
    [ChainName.SEI]: {
        name: ChainName.SEI,
        displayName: "SEI",
        logo: "/images/token-images/sei.png",
        bech32Prefix: "sei"
    },
    [ChainName.ARCHWAY]: {
        name: ChainName.ARCHWAY,
        displayName: "ARCH",
        logo: "/images/token-images/archway-coin.png",
        bech32Prefix: "archway"
    },
    [ChainName.INJECTIVE]: {
        name: ChainName.INJECTIVE,
        displayName: "INJ",
        logo: "/images/token-images/inj.svg",
        bech32Prefix: "inj"
    },
    [ChainName.NEUTRON]: {
        name: ChainName.NEUTRON,
        displayName: "NTRN",
        logo: "/images/token-images/neutron.svg",
        bech32Prefix: "neutron"
    },
    [ChainName.XION]: {
        name: ChainName.XION,
        displayName: "XION",
        logo: "/images/token-images/xion.png",
        bech32Prefix: "xion"
    },
    [ChainName.SOLANA]: {
        name: ChainName.SOLANA,
        displayName: "SOL",
        logo: "/images/token-images/sol.svg",
        bech32Prefix: ""
    }
}

export const priceIdByChainName: Record<ChainName, { priceId: string, serviceUrl: string }> = {
    [ChainName.SEI]: { priceId: "53614f1cb0c031d4af66c04cb9c756234adad0e1cee85303795091499a4084eb", serviceUrl: "https://hermes.pyth.network/" },
    [ChainName.ARCHWAY]: { priceId: "b00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819", serviceUrl: "https://hermes.pyth.network/" },
    [ChainName.NEUTRON]: { priceId: "8112fed370f3d9751e513f7696472eab61b7f4e2487fd9f46c93de00a338631c", serviceUrl: "https://hermes-beta.pyth.network/" },
    [ChainName.INJECTIVE]: { priceId: "2d9315a88f3019f8efa88dfe9c0f0843712da0bac814461e27733f6b83eb51b3", serviceUrl: "https://hermes-beta.pyth.network/" },
    [ChainName.XION]: { priceId: "", serviceUrl: "" },
    [ChainName.SOLANA]: { priceId: "0e9a9d9b1e6e1e3a1f1b7f1e1a1e1a1e1a1e1a1e1a1e1a1e1a1e1a1e1a", serviceUrl: "https://pyth.network/" }
}

export const XION_STATIC_PRICE = 3;