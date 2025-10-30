import { BaseCoinByChainName, XION_STATIC_PRICE } from "@/constants/chainConstants";
import { ChainName } from "@/enums/Chain";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { isNil } from "lodash";
import { FC, PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type PriceContextValue = {
    coinPricesByDenom: Record<string, number>;
    refreshPrices: () => void;
    getPriceByChainName: (chainName?: ChainName) => number;
}

const PriceContext = createContext<PriceContextValue>({
    coinPricesByDenom: {},
    refreshPrices: () => { },
    getPriceByChainName: () => 0
});

const PriceProvider: FC<PropsWithChildren> = ({ children }) => {
    const [coinPricesByDenom, setCoinPricesByDenom] = useState<Record<string, number>>({});

    const getInjPrice = useCallback(async () => {
        try {
            const denom = BaseCoinByChainName[ChainName.INJECTIVE].denom;
            const connection = new PriceServiceConnection(
                "https://hermes-beta.pyth.network/",
                {
                    priceFeedRequestConfig: {
                        binary: true,
                    },
                }
            )

            const priceId = ["2d9315a88f3019f8efa88dfe9c0f0843712da0bac814461e27733f6b83eb51b3"];

            const currentPrices = await connection.getLatestPriceFeeds(priceId);

            if (currentPrices) {
                setCoinPricesByDenom(prev => ({
                    ...prev,
                    [denom]: Number(currentPrices[0].getPriceUnchecked().price) / 100000000
                }))
            }
        }
        catch (err) {
            console.log(err);
        }
    }, [])

    const getSeiPrice = useCallback(async () => {
        try {
            const denom = BaseCoinByChainName[ChainName.SEI].denom;
            const connection = new PriceServiceConnection(
                "https://hermes.pyth.network/",
                {
                    priceFeedRequestConfig: {
                        binary: true,
                    },
                }
            )

            const priceId = ["53614f1cb0c031d4af66c04cb9c756234adad0e1cee85303795091499a4084eb"];

            const currentPrices = await connection.getLatestPriceFeeds(priceId);

            if (currentPrices) {
                setCoinPricesByDenom(prev => ({
                    ...prev,
                    [denom]: Number(currentPrices[0].getPriceUnchecked().price) / 100000000
                }))
            }
        }
        catch (err) {
            console.log(err);
        }
    }, [])

    const getArchPrice = useCallback(async () => {
        try {
            const denom = BaseCoinByChainName[ChainName.ARCHWAY].denom;
            const connection = new PriceServiceConnection(
                "https://hermes.pyth.network/",
                {
                    priceFeedRequestConfig: {
                        binary: true,
                    },
                }
            )

            const priceId = ["b00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819"];

            const currentPrices = await connection.getLatestPriceFeeds(priceId);

            if (currentPrices) {
                setCoinPricesByDenom(prev => ({
                    ...prev,
                    [denom]: Number(currentPrices[0].getPriceUnchecked().price) / 100000000
                }))
            }
        }
        catch (err) {
            console.log(err);
        }
    }, [])

    const getNeutronPrice = useCallback(async () => {
        try {
            const denom = BaseCoinByChainName[ChainName.NEUTRON].denom;
            const connection = new PriceServiceConnection(
                "https://hermes-beta.pyth.network/",
                {
                    priceFeedRequestConfig: {
                        binary: true,
                    },
                }
            )

            const priceId = ["8112fed370f3d9751e513f7696472eab61b7f4e2487fd9f46c93de00a338631c"];

            const currentPrices = await connection.getLatestPriceFeeds(priceId);

            if (currentPrices) {
                setCoinPricesByDenom(prev => ({
                    ...prev,
                    [denom]: Number(currentPrices[0].getPriceUnchecked().price) / 100000000
                }))
            }
        }
        catch (err) {
            console.log(err);
        }
    }, [])

    const getXionPrice = useCallback(async () => {
        const denom = BaseCoinByChainName[ChainName.XION].denom;
        setCoinPricesByDenom(prev => ({
            ...prev,
            [denom]: XION_STATIC_PRICE
        }))
    }, [])

    const getAllPrices = useCallback(async () => {
        getInjPrice();
        getSeiPrice();
        getArchPrice();
        getNeutronPrice();
        getXionPrice();
    }, [getInjPrice, getSeiPrice, getArchPrice, getNeutronPrice, getXionPrice])

    const getPriceByChainName = useCallback((chainName?: ChainName) => {
        if (isNil(chainName)) return 0;
        return coinPricesByDenom[BaseCoinByChainName[chainName].denom] ?? 0;
    }, [coinPricesByDenom])

    const contextValue = useMemo<PriceContextValue>(() => ({
        coinPricesByDenom,
        refreshPrices: getAllPrices,
        getPriceByChainName
    }), [coinPricesByDenom, getAllPrices, getPriceByChainName])

    useEffect(() => {
        getAllPrices();
    }, [getAllPrices])

    return (
        <PriceContext.Provider value={contextValue}>
            {children}
        </PriceContext.Provider>
    );
}

export const usePrice = () => useContext(PriceContext);

export default PriceProvider;