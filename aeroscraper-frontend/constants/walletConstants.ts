import { ChainName } from "@/enums/Chain";
import { WalletType } from "@/enums/WalletType";
import { WalletInfo } from "@/types/types";
import { Wallet } from "@injectivelabs/wallet-ts";

export const WalletsByChainName: Record<ChainName, WalletType[]> = {
    [ChainName.SEI]: [
        WalletType.LEAP,
        WalletType.KEPLR,
        // WalletType.LEDGER,
        // WalletType.COSMOSTATION
    ],
    [ChainName.ARCHWAY]: [
        WalletType.LEAP,
        WalletType.KEPLR,
    ],
    [ChainName.NEUTRON]: [
        WalletType.LEAP,
        WalletType.KEPLR,
    ],
    [ChainName.INJECTIVE]: [
        WalletType.METAMASK,
        WalletType.LEAP,
        WalletType.KEPLR,
        // WalletType.NINJI,
        // WalletType.LEDGER,
        // WalletType.COSMOSTATION
    ],
    [ChainName.XION]: [],
    [ChainName.SOLANA]: []
}

export const InjSdkWalletByCosmosWallet: Record<WalletType, Wallet> = {
    [WalletType.KEPLR]: Wallet.Keplr,
    [WalletType.LEAP]: Wallet.Leap,
    [WalletType.METAMASK]: Wallet.Metamask,
    [WalletType.NINJI]: Wallet.Ninji,
    [WalletType.LEDGER]: Wallet.Ledger,
    [WalletType.COSMOSTATION]: Wallet.Cosmostation
}

export const metamaskWalletInfo: WalletInfo = {
    name: WalletType.METAMASK,
    prettyName: 'Metamask',
    logo: '/images/wallet-images/metamask-icon.png'
}