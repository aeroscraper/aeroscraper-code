import { AppContextState, useAppContext } from "@/contexts/AppProvider";
import { ChainName } from "@/enums/Chain";
import { useChain } from "@cosmos-kit/react"
import { ChainContext } from "@cosmos-kit/core"
import { useMemo } from "react";
import { BaseCoin, WalletInfo } from "@/types/types";
import { BaseCoinByChainName, ChainInfoByName } from "@/constants/chainConstants";
import { WalletType } from "@/enums/WalletType";
import { isEmpty, isNil } from "lodash";
import { useAbstraxionAccount } from "@/hooks/xion";

type ChainAdapterValue = ChainContext & AppContextState & {
    baseCoin?: BaseCoin;
    walletInfo?: WalletInfo;
}

const useChainAdapter = () => {
    const { isConnected: isAbstraxionConnected } = useAbstraxionAccount();
    const appContextValue = useAppContext();
    const chainContextValue = useChain(
        appContextValue.selectedChainName === undefined ||
            appContextValue.selectedChainName === ChainName.XION ?
            ChainName.INJECTIVE
            :
            appContextValue.selectedChainName
    );

    const address = useMemo<string | undefined>(() =>
        appContextValue.selectedWallet === WalletType.METAMASK ||
            appContextValue.selectedChainName === ChainName.XION ?
            appContextValue.userAddress
            :
            chainContextValue.address,
        [appContextValue.selectedWallet, appContextValue.userAddress, chainContextValue.address, appContextValue.selectedChainName]
    );

    const username = useMemo<string | undefined>(() =>
        appContextValue.selectedChainName === ChainName.XION ?
            ChainInfoByName[ChainName.XION].displayName
            :
            appContextValue.selectedWallet === WalletType.METAMASK ?
                "Metamask"
                :
                chainContextValue.username,
        [appContextValue.selectedWallet, appContextValue.selectedChainName, chainContextValue.username]
    );

    const walletInfo = useMemo<WalletInfo | undefined>(() =>
        (appContextValue.selectedChainName === ChainName.XION && isAbstraxionConnected) ?
            {
                name: ChainName.XION,
                prettyName: ChainInfoByName[ChainName.XION].displayName,
                logo: ChainInfoByName[ChainName.XION].logo
            }
            :
            appContextValue.selectedWallet === WalletType.METAMASK ?
                {
                    name: WalletType.METAMASK,
                    prettyName: 'Metamask',
                    logo: '/images/wallet-images/metamask-icon.png'
                }
                :
                chainContextValue.isWalletConnected ?
                    {
                        name: (chainContextValue.wallet?.name ?? '') as WalletType,
                        prettyName: chainContextValue.wallet?.prettyName ?? '',
                        logo: (chainContextValue.wallet?.logo ?? '') as string
                    } :
                    undefined,
        [appContextValue.selectedWallet, chainContextValue.isWalletConnected, chainContextValue.wallet, appContextValue.selectedChainName, isAbstraxionConnected]
    );

    const isWalletConnected = useMemo(() =>
        appContextValue.selectedChainName === ChainName.XION ?
            isAbstraxionConnected
            :
            appContextValue.selectedWallet === WalletType.METAMASK ?
                !isNil(appContextValue.userAddress) && !isEmpty(appContextValue.userAddress)
                :
                chainContextValue.isWalletConnected,
        [appContextValue.userAddress, appContextValue.selectedWallet, appContextValue.selectedChainName, chainContextValue.isWalletConnected, isAbstraxionConnected]
    )

    const isWalletConnecting = useMemo(() =>
        appContextValue.selectedWallet === WalletType.METAMASK ?
            appContextValue.isConnecting
            :
            chainContextValue.isWalletConnecting,
        [appContextValue.isConnecting, appContextValue.selectedWallet, chainContextValue.isWalletConnecting]
    )

    const baseCoin = useMemo<BaseCoin | undefined>(() => appContextValue.selectedChainName ? BaseCoinByChainName[appContextValue.selectedChainName] : undefined, [appContextValue.selectedChainName]);

    const value = useMemo<ChainAdapterValue>(() => ({
        ...appContextValue,
        ...chainContextValue,
        baseCoin,
        address,
        walletInfo,
        isWalletConnected,
        isWalletConnecting,
        username
    }), [appContextValue, chainContextValue, address, baseCoin, walletInfo, isWalletConnected, isWalletConnecting, username])

    return value;
}

export default useChainAdapter;