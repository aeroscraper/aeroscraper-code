import { getRequestAmount, jsonToBinary } from "@/utils/contractUtils";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate"
import { coin } from "@cosmjs/proto-signing";
import { CW20BalanceResponse, CW20TokenInfoResponse, GetStakeResponse, GetTroveResponseV1, GetTroveResponseV2 } from "./types";
import { PriceServiceConnection } from '@pythnetwork/price-service-client'
import { AppVersion, BaseCoin, CollateralAsset } from "@/types/types";
import { BaseCoinByChainName, priceIdByChainName } from "@/constants/chainConstants";
import { ChainGrpcWasmApi, fromBase64, toBase64, MsgExecuteContract } from "@injectivelabs/sdk-ts";
import { Network } from "@injectivelabs/networks";
import { MsgBroadcaster, Wallet, WalletStrategy } from '@injectivelabs/wallet-ts'
import { ChainId } from '@injectivelabs/ts-types';
import { isNil } from "lodash";
import { WalletType } from "@/enums/WalletType";
import { TotalCollateralModel } from "@/app/app/dashboard/_types/types";
import { ChainName } from "@/enums/Chain";
import { getContractAddressesByChain } from "@/constants/chainConstants";
import { InjSdkWalletByCosmosWallet } from "@/constants/walletConstants";
import { DefaultAssetByChainName } from "@/constants/assetConstants";

const injectivePrivRpc = process.env.NEXT_PUBLIC_INJECTIVE_PRIV_RPC as string;
const injectivePrivGrpc = process.env.NEXT_PUBLIC_INJECTIVE_PRIV_GRPC as string;
const injectivePrivRest = process.env.NEXT_PUBLIC_INJECTIVE_PRIV_REST as string;

export const getAppContract = (
    client: SigningCosmWasmClient,
    baseCoin: BaseCoin,
    appVersion: AppVersion,
    chainName: ChainName,
    walletType?: WalletType
) => {
    const defaultAsset = DefaultAssetByChainName[chainName];
    const { contractAddress, oraclecontractAddress, ausdContractAddress } = getContractAddressesByChain(appVersion, chainName);

    const injSdkWallet = walletType ? InjSdkWalletByCosmosWallet[walletType as WalletType] : Wallet.Keplr;
    const walletStrategy = new WalletStrategy({
        chainId: ChainId.Testnet,
        wallet: injSdkWallet,
    });

    const NETWORK = Network.TestnetSentry;

    const chainGrpcWasmApi = new ChainGrpcWasmApi(injectivePrivGrpc);
    const msgBroadcastClient = new MsgBroadcaster({
        walletStrategy,
        network: NETWORK,
        networkEndpoints: {
            indexerApi: '',
            sentryHttpApi: injectivePrivRest,
            sentryGrpcApi: injectivePrivGrpc
        }
    });

    //GET QUERIES

    const getVAA = async (asset?: CollateralAsset): Promise<any> => {
        if (isNil(chainName)) {
            throw new Error("Error getting client")
        }

        const priceId = appVersion === AppVersion.V1 || isNil(asset) ?
            priceIdByChainName[chainName].priceId :
            asset.priceId;
        const serviceUrl = appVersion === AppVersion.V1 || isNil(asset) ?
            priceIdByChainName[chainName].serviceUrl :
            asset.priceServiceUrl;

        const connection = new PriceServiceConnection(serviceUrl,
            {
                priceFeedRequestConfig: {
                    binary: true,
                },
            }
        )

        const res = await connection.getLatestPriceFeeds([priceId]);

        if (res) {
            return res[0].getVAA()
        } else {
            throw new Error("Error getting price feed")
        }
    }

    const getTotalCollateralAmounts = async (): Promise<TotalCollateralModel | undefined> => {
        if (chainName === ChainName.INJECTIVE) {
            const res = await chainGrpcWasmApi.fetchSmartContractState(contractAddress, toBase64({ total_collateral_amounts: {} }))
            const data: any = fromBase64(res.data as any);
            return data;
        }

        return await client.queryContractSmart(contractAddress, { total_collateral_amounts: {} });
    }

    const getTotalDebtAmount = async (): Promise<string> => {

        if (chainName === ChainName.INJECTIVE) {
            const res = await chainGrpcWasmApi.fetchSmartContractState(contractAddress, toBase64({ total_debt_amount: {} }))
            const data: any = fromBase64(res.data as any);
            return data;
        }

        return await client.queryContractSmart(contractAddress, { total_debt_amount: {} });
    }

    const getTrove = async (user_addr: string): Promise<GetTroveResponseV1 | GetTroveResponseV2> => {
        if (chainName === ChainName.INJECTIVE) {
            const res = await chainGrpcWasmApi.fetchSmartContractState(contractAddress, toBase64({ trove: { user_addr } }))
            const data: any = fromBase64(res.data as any);
            return data;
        }

        return await client.queryContractSmart(contractAddress, { trove: { user_addr } });
    }

    const getStake = async (user_addr: string): Promise<GetStakeResponse> => {
        if (chainName === ChainName.INJECTIVE) {
            const res = await chainGrpcWasmApi.fetchSmartContractState(contractAddress, toBase64({ stake: { user_addr } }))
            const data: any = fromBase64(res.data as any);
            return data;
        }

        return await client.queryContractSmart(contractAddress, { stake: { user_addr } });
    }

    const getTotalStake = async (): Promise<string> => {
        if (chainName === ChainName.INJECTIVE) {
            const res = await chainGrpcWasmApi.fetchSmartContractState(contractAddress, toBase64({ total_stake_amount: {} }))
            const data: any = fromBase64(res.data as any);
            return data;
        }

        return await client.queryContractSmart(contractAddress, { total_stake_amount: {} });
    }

    const getCollateralPrice = async () => {
        if (chainName === ChainName.INJECTIVE) {
            const res = await chainGrpcWasmApi.fetchSmartContractState(contractAddress, toBase64({ collateral_price: {} }))
            const data: any = fromBase64(res.data as any);
            return data;
        }

        return await client.queryContractSmart(contractAddress, { collateral_price: {} });
    }

    const getAusdBalance = async (address: string): Promise<CW20BalanceResponse> => {
        if (chainName === ChainName.INJECTIVE) {
            const res = await chainGrpcWasmApi.fetchSmartContractState(ausdContractAddress, toBase64({ balance: { address } }))
            const data: any = fromBase64(res.data as any);
            return data;
        }

        return await client.queryContractSmart(ausdContractAddress, { balance: { address } })
    }

    const getAusdInfo = async (): Promise<CW20TokenInfoResponse> => {
        if (chainName === ChainName.INJECTIVE) {
            const res = await chainGrpcWasmApi.fetchSmartContractState(ausdContractAddress, toBase64({ token_info: {} }))
            const data: any = fromBase64(res.data as any);
            return data;
        }

        return await client.queryContractSmart(ausdContractAddress, { token_info: {} })
    }

    const getReward = async (user_addr: string): Promise<string> => {
        if (chainName === ChainName.INJECTIVE) {
            const res = await chainGrpcWasmApi.fetchSmartContractState(contractAddress, toBase64({ liquidation_gains: { user_addr } }))
            const data: any = fromBase64(res.data as any);
            return data;
        }

        return await client.queryContractSmart(contractAddress, { liquidation_gains: { user_addr } })
    }

    //EXECUTE QUERIES
    const openTrove = async (senderAddress: string, amount: number, loanAmount: number, asset: CollateralAsset = defaultAsset) => {

        if (chainName === ChainName.INJECTIVE) {
            const vaa = await getVAA(asset);

            const msg = MsgExecuteContract.fromJSON({
                contractAddress: asset.oracleContractAddress,
                sender: senderAddress,
                msg: {
                    update_price_feeds: {
                        data: [
                            vaa
                        ]
                    }
                },
                funds: [coin("1", asset.denom)]
            })

            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress: contractAddress,
                sender: senderAddress,
                msg: {
                    open_trove: {
                        loan_amount: getRequestAmount(loanAmount, asset.ausdDecimal)
                    }
                },
                funds: [coin(getRequestAmount(amount, asset.decimal), asset.denom)]
            })

            return await msgBroadcastClient.broadcast({
                msgs: [msg, msg1],
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            });
        }

        if (chainName === ChainName.ARCHWAY) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { open_trove: { loan_amount: getRequestAmount(loanAmount, asset.ausdDecimal) } },
                "auto",
                "Open Trove",
                [coin(getRequestAmount(amount, asset.decimal), asset.denom)]
            )
        }

        if (chainName === ChainName.NEUTRON) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { open_trove: { loan_amount: getRequestAmount(loanAmount, asset.ausdDecimal) } },
                "auto",
                "Open Trove",
                [coin(getRequestAmount(amount, asset.decimal), asset.denom)]
            )
        }

        const vaa = await getVAA();

        return await client.executeMultiple(
            senderAddress,
            [
                {
                    contractAddress: oraclecontractAddress,
                    msg: {
                        update_price_feeds: {
                            data: [
                                vaa
                            ]
                        }
                    },
                    funds: [{ amount: "1", denom: "usei" }],
                },
                {
                    contractAddress,
                    msg: { open_trove: { loan_amount: getRequestAmount(loanAmount, asset.ausdDecimal) } },
                    funds: [coin(getRequestAmount(amount, asset.decimal), asset.denom)]
                }
            ],
            "auto",
            "Open Trove",
        )
    }

    const addCollateral = async (senderAddress: string, amount: number, asset: CollateralAsset = defaultAsset) => {
        if (chainName === ChainName.ARCHWAY) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { add_collateral: {} },
                "auto",
                "Add Collateral",
                [coin(getRequestAmount(amount, asset.decimal), asset.denom)]
            )
        }

        if (chainName === ChainName.NEUTRON) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { add_collateral: {} },
                "auto",
                "Add Collateral",
                [coin(getRequestAmount(amount, asset.decimal), asset.denom)]
            )
        }

        const vaa = await getVAA(asset);

        if (chainName === ChainName.INJECTIVE) {
            const msg = MsgExecuteContract.fromJSON({
                contractAddress: asset.oracleContractAddress,
                sender: senderAddress,
                msg: {
                    update_price_feeds: {
                        data: [
                            vaa
                        ]
                    }
                },
                funds: [coin("1", asset.denom)]
            })

            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress: contractAddress,
                sender: senderAddress,
                msg: { add_collateral: {} },
                funds: [coin(getRequestAmount(amount, asset.decimal), asset.denom)]
            })

            return await msgBroadcastClient.broadcast({
                msgs: [msg, msg1],
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return await client.executeMultiple(
            senderAddress,
            [
                {
                    contractAddress: oraclecontractAddress,
                    msg: {
                        update_price_feeds: {
                            data: [
                                vaa
                            ]
                        }
                    },
                    funds: [{ amount: "1", denom: "usei" }],
                },
                {
                    contractAddress,
                    msg: { add_collateral: {} },
                    funds: [coin(getRequestAmount(amount, asset.decimal), asset.denom)]
                }
            ],
            "auto",
            "Add Collateral",
        )
    }

    const removeCollateral = async (senderAddress: string, amount: number, asset: CollateralAsset = defaultAsset) => {
        if (chainName === ChainName.ARCHWAY) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { remove_collateral: { collateral_amount: getRequestAmount(amount, asset.decimal) } },
                "auto",
                "Remove Collateral"
            )
        }

        if (chainName === ChainName.NEUTRON) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { remove_collateral: { collateral_amount: getRequestAmount(amount, baseCoin.decimal) } },
                "auto",
                "Remove Collateral"
            )
        }

        const vaa = await getVAA();

        if (chainName === ChainName.INJECTIVE) {
            const msg = MsgExecuteContract.fromJSON({
                contractAddress: asset.oracleContractAddress,
                sender: senderAddress,
                msg: {
                    update_price_feeds: {
                        data: [
                            vaa
                        ]
                    }
                },
                funds: [coin("1", asset.denom)]
            })

            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress: contractAddress,
                sender: senderAddress,
                msg: {
                    remove_collateral: {
                        collateral_denom: asset.denom,
                        collateral_amount: getRequestAmount(amount, asset.decimal)
                    }
                }
            })

            return await msgBroadcastClient.broadcast({
                msgs: [msg, msg1],
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return await client.executeMultiple(
            senderAddress,
            [
                {
                    contractAddress: oraclecontractAddress,
                    msg: {
                        update_price_feeds: {
                            data: [
                                vaa
                            ]
                        }
                    },
                    funds: [{ amount: "1", denom: "usei" }],
                },
                {
                    contractAddress,
                    msg: { remove_collateral: { collateral_amount: getRequestAmount(amount, asset.decimal) } }
                }
            ],
            "auto",
            "Remove Collateral",
        )
    }

    const borrowLoan = async (senderAddress: string, amount: number) => {
        if (chainName === ChainName.ARCHWAY) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { borrow_loan: { loan_amount: getRequestAmount(amount, baseCoin.ausdDecimal) } },
                "auto",
                "Borrow Loan"
            )
        }

        if (chainName === ChainName.NEUTRON) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { borrow_loan: { loan_amount: getRequestAmount(amount, baseCoin.ausdDecimal) } },
                "auto",
                "Borrow Loan"
            )
        }

        const vaa = await getVAA();

        if (chainName === ChainName.INJECTIVE) {
            const msg = MsgExecuteContract.fromJSON({
                contractAddress: oraclecontractAddress,
                sender: senderAddress,
                msg: {
                    update_price_feeds: {
                        data: [
                            vaa
                        ]
                    }
                },
                funds: [coin("1", BaseCoinByChainName[chainName].denom)]
            })

            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress: contractAddress,
                sender: senderAddress,
                msg: { borrow_loan: { loan_amount: getRequestAmount(amount, baseCoin.ausdDecimal) } }
            })

            return await msgBroadcastClient.broadcast({
                msgs: [msg, msg1],
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return await client.executeMultiple(
            senderAddress,
            [
                {
                    contractAddress: oraclecontractAddress,
                    msg: {
                        update_price_feeds: {
                            data: [
                                vaa
                            ]
                        }
                    },
                    funds: [{ amount: "1", denom: "usei" }],
                },
                {
                    contractAddress,
                    msg: { borrow_loan: { loan_amount: getRequestAmount(amount, baseCoin.ausdDecimal) } }
                }
            ],
            "auto",
            "Borrow Loan",
        )
    }

    const repayLoan = async (senderAddress: string, amount: number) => {
        const msg = {
            send: {
                contract: contractAddress,
                amount: getRequestAmount(amount, baseCoin.ausdDecimal),
                msg: jsonToBinary({ repay_loan: {} })
            }
        }

        if (chainName === ChainName.ARCHWAY) {
            return await client.execute(
                senderAddress,
                ausdContractAddress,
                msg,
                "auto",
                "Repay Loan"
            )
        }

        if (chainName === ChainName.NEUTRON) {
            return await client.execute(
                senderAddress,
                ausdContractAddress,
                msg,
                "auto",
                "Repay Loan"
            )
        }

        const vaa = await getVAA();

        if (chainName === ChainName.INJECTIVE) {
            const msgVAA = MsgExecuteContract.fromJSON({
                contractAddress: oraclecontractAddress,
                sender: senderAddress,
                msg: {
                    update_price_feeds: {
                        data: [
                            vaa
                        ]
                    }
                },
                funds: [coin("1", BaseCoinByChainName[chainName].denom)]
            })

            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress: ausdContractAddress,
                sender: senderAddress,
                msg
            })

            return await msgBroadcastClient.broadcast({
                msgs: [msgVAA, msg1],
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return await client.executeMultiple(
            senderAddress,
            [
                {
                    contractAddress: oraclecontractAddress,
                    msg: {
                        update_price_feeds: {
                            data: [
                                vaa
                            ]
                        }
                    },
                    funds: [{ amount: "1", denom: "usei" }],
                },
                {
                    msg,
                    contractAddress: ausdContractAddress,
                }
            ],
            "auto",
            "Repay Loan",
        )
    }

    const stake = async (senderAddress: string, amount: number) => {
        const msg = {
            send: {
                contract: contractAddress,
                amount: getRequestAmount(amount, baseCoin.ausdDecimal),
                msg: jsonToBinary({ stake: {} })
            }
        }

        if (chainName === ChainName.INJECTIVE) {
            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress: ausdContractAddress,
                sender: senderAddress,
                msg
            })

            return await msgBroadcastClient.broadcast({
                msgs: msg1,
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return client.execute(
            senderAddress,
            ausdContractAddress,
            msg,
            "auto",
            "Stake"
        )
    }

    const unstake = async (senderAddress: string, amount: number) => {
        if (chainName === ChainName.INJECTIVE) {
            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress: contractAddress,
                sender: senderAddress,
                msg: { unstake: { amount: getRequestAmount(amount, baseCoin.ausdDecimal) } }
            })

            return await msgBroadcastClient.broadcast({
                msgs: msg1,
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return await client.execute(
            senderAddress,
            contractAddress,
            { unstake: { amount: getRequestAmount(amount, baseCoin.ausdDecimal) } },
            "auto",
            "Unstake"
        )
    }

    const redeem = async (senderAddress: string, amount: number) => {
        const msg = {
            send: {
                contract: contractAddress,
                amount: getRequestAmount(amount, baseCoin.decimal),
                msg: jsonToBinary({ redeem: {} })
            }
        }

        if (chainName === ChainName.ARCHWAY) {
            return await client.execute(
                senderAddress,
                ausdContractAddress,
                msg,
                "auto",
                "Redeem"
            )
        }

        if (chainName === ChainName.NEUTRON) {
            return await client.execute(
                senderAddress,
                ausdContractAddress,
                msg,
                "auto",
                "Redeem"
            )
        }

        const vaa = await getVAA();

        if (chainName === ChainName.INJECTIVE) {
            const msg0 = MsgExecuteContract.fromJSON({
                contractAddress: oraclecontractAddress,
                sender: senderAddress,
                msg: {
                    update_price_feeds: {
                        data: [
                            vaa
                        ]
                    }
                },
                funds: [coin("1", BaseCoinByChainName[chainName].denom)]
            })

            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress: ausdContractAddress,
                sender: senderAddress,
                msg
            })

            return await msgBroadcastClient.broadcast({
                msgs: [msg0, msg1],
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return client.executeMultiple(
            senderAddress,
            [
                {
                    contractAddress: oraclecontractAddress,
                    msg: {
                        update_price_feeds: {
                            data: [
                                vaa
                            ]
                        }
                    },
                    funds: [{ amount: "1", denom: "usei" }],
                },
                {
                    msg,
                    contractAddress: ausdContractAddress
                }
            ],
            "auto",
            "Redeem"
        )
    }

    const liquidateTroves = async (senderAddress: string) => {
        if (chainName === ChainName.ARCHWAY) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { liquidate_troves: {} },
                "auto",
                "Liquidate Troves"
            )
        }

        if (chainName === ChainName.NEUTRON) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { liquidate_troves: {} },
                "auto",
                "Liquidate Troves"
            )
        }

        const vaa = await getVAA();

        if (chainName === ChainName.INJECTIVE) {
            const msg0 = MsgExecuteContract.fromJSON({
                contractAddress: oraclecontractAddress,
                sender: senderAddress,
                msg: {
                    update_price_feeds: {
                        data: [
                            vaa
                        ]
                    }
                },
                funds: [coin("1", BaseCoinByChainName[chainName].denom)]
            })

            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress,
                sender: senderAddress,
                msg: { liquidate_troves: {} }
            })

            return await msgBroadcastClient.broadcast({
                msgs: [msg0, msg1],
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return await client.executeMultiple(
            senderAddress,
            [
                {
                    contractAddress: oraclecontractAddress,
                    msg: {
                        update_price_feeds: {
                            data: [
                                vaa
                            ]
                        }
                    },
                    funds: [{ amount: "1", denom: "usei" }],
                },
                {
                    contractAddress,
                    msg: { liquidate_troves: {} }
                }
            ],
            "auto",
            "Liquidate Troves",
        )
    }

    const liquidateTrovesV2 = async (senderAddress: string, owner: string) => {
        if (chainName === ChainName.ARCHWAY) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { liquidate_troves: {} },
                "auto",
                "Liquidate Troves"
            )
        }

        if (chainName === ChainName.NEUTRON) {
            return await client.execute(
                senderAddress,
                contractAddress,
                { liquidate_troves: {} },
                "auto",
                "Liquidate Troves"
            )
        }

        const vaa = await getVAA();

        if (chainName === ChainName.INJECTIVE) {
            const msg0 = MsgExecuteContract.fromJSON({
                contractAddress: oraclecontractAddress,
                sender: senderAddress,
                msg: {
                    update_price_feeds: {
                        data: [
                            vaa
                        ]
                    }
                },
                funds: [coin("1", BaseCoinByChainName[chainName].denom)]
            })

            const msg1 = MsgExecuteContract.fromJSON({
                contractAddress,
                sender: senderAddress,
                msg: {
                    liquidate_troves: {
                        liquidation_list: [owner],
                        safe_list: []
                    }
                }
            })

            return await msgBroadcastClient.broadcast({
                msgs: [msg0, msg1],
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return await client.executeMultiple(
            senderAddress,
            [
                {
                    contractAddress: oraclecontractAddress,
                    msg: {
                        update_price_feeds: {
                            data: [
                                vaa
                            ]
                        }
                    },
                    funds: [{ amount: "1", denom: "usei" }],
                },
                {
                    contractAddress,
                    msg: { liquidate_troves: {} }
                }
            ],
            "auto",
            "Liquidate Troves",
        )
    }

    const withdrawLiquidationGains = async (senderAddress: string) => {
        if (chainName === ChainName.INJECTIVE) {
            const msg = MsgExecuteContract.fromJSON({
                contractAddress,
                sender: senderAddress,
                msg: { withdraw_liquidation_gains: {} }
            })

            return await msgBroadcastClient.broadcast({
                msgs: msg,
                injectiveAddress: senderAddress,
                gas: { gas: 40000000 }
            })
        }

        return await client.execute(
            senderAddress,
            contractAddress,
            { withdraw_liquidation_gains: {} },
            "auto",
            "Withdraw Liquidation Gains"
        )
    }

    return {
        getTotalCollateralAmounts,
        getTotalDebtAmount,
        getTrove,
        getStake,
        getTotalStake,
        getCollateralPrice,
        getAusdBalance,
        getAusdInfo,
        getReward,
        openTrove,
        addCollateral,
        removeCollateral,
        borrowLoan,
        repayLoan,
        stake,
        unstake,
        redeem,
        liquidateTroves,
        liquidateTrovesV2,
        withdrawLiquidationGains
    }
}
