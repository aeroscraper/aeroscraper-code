import { ChainName } from '@/enums/Chain';
import useChainAdapter from '@/hooks/useChainAdapter';
import { useAbstraxionSigningClient } from '@/hooks/xion';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { Coin } from '@cosmjs/proto-signing';
import { Dictionary, isNil } from 'lodash';
import React, { FC, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type BalanceContextValue = {
    balanceByDenom: Dictionary<Coin | undefined>;
    refreshBalance: () => void;
}

const BalanceContext = React.createContext<BalanceContextValue>({
    balanceByDenom: {},
    refreshBalance: () => { }
});

const BalanceProvider: FC<PropsWithChildren> = ({ children }) => {
    const debounceRef = useRef<NodeJS.Timeout | undefined>();
    const { chain, address, baseCoin, selectedChainName } = useChainAdapter();
    const { client: absraxionClient } = useAbstraxionSigningClient();
    const [balanceByDenom, setBalanceByDenom] = useState<Dictionary<Coin | undefined>>({});

    const getBalances = useCallback(async () => {
        try {
            if (!address || !baseCoin) return;

            if (selectedChainName === ChainName.XION) {
                if (isNil(absraxionClient)) return;

                const balance = await absraxionClient.getBalance(address, baseCoin.denom);
                setBalanceByDenom({ [balance.denom]: balance });
            }
            else {
                const client = await SigningCosmWasmClient.connect(chain.apis?.rpc?.[0].address ?? '')
                const balance = await client.getBalance(address, baseCoin.denom);
                setBalanceByDenom({ [balance.denom]: balance });
            }
        }
        catch (err) {
            console.log(err)
        }
    }, [chain, address, baseCoin, selectedChainName, absraxionClient])

    const debouncedGetBalances = useCallback(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            getBalances();
        }, 500);
    }, [getBalances])

    const value = useMemo<BalanceContextValue>(() => ({
        balanceByDenom,
        refreshBalance: getBalances
    }), [balanceByDenom, getBalances])

    useEffect(() => {
        debouncedGetBalances();
    }, [debouncedGetBalances])

    useEffect(() => {
        return () => {
            clearTimeout(debounceRef.current);
        }
    }, [])

    return (
        <BalanceContext.Provider value={value}>
            {children}
        </BalanceContext.Provider>
    )
}

export const useBalances = () => useContext(BalanceContext);

export default BalanceProvider