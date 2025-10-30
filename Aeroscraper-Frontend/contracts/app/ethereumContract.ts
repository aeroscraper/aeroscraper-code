import { getRequestAmount, jsonToBinary } from "@/utils/contractUtils";
import { coin } from "@cosmjs/proto-signing";
import { CW20BalanceResponse, CW20TokenInfoResponse, GetStakeResponse, GetTroveResponseV1, GetTroveResponseV2 } from "./types";
import { PriceServiceConnection } from '@pythnetwork/price-service-client'
import { AppVersion, BaseCoin, CollateralAsset } from "@/types/types";
import { MsgExecuteContractCompat, ChainGrpcWasmApi, toBase64, fromBase64 } from "@injectivelabs/sdk-ts";
import { Network } from "@injectivelabs/networks";
import { ChainId } from "@injectivelabs/ts-types";
import { isNil } from "lodash";
import {
  MsgBroadcaster,
  Wallet,
  WalletStrategy,
} from "@injectivelabs/wallet-ts";
import { WalletType } from "@/enums/WalletType";
import { TotalCollateralModel } from "@/app/app/dashboard/_types/types";
import { ChainName } from "@/enums/Chain";
import { Chain } from '@chain-registry/types';
import { BaseCoinByChainName, getContractAddressesByChain, priceIdByChainName } from "@/constants/chainConstants";
import { InjSdkWalletByCosmosWallet } from "@/constants/walletConstants";
import { DefaultAssetByChainName } from "@/constants/assetConstants";

const injectivePrivRpc = process.env.NEXT_PUBLIC_INJECTIVE_PRIV_RPC as string;
const injectivePrivGrpc = process.env.NEXT_PUBLIC_INJECTIVE_PRIV_GRPC as string;
const injectivePrivRest = process.env.NEXT_PUBLIC_INJECTIVE_PRIV_REST as string;
const ethereumChainId = 5; // Goerli chain ID

export const getAppEthContract = (
  chain: Chain,
  baseCoin: BaseCoin,
  appVersion: AppVersion,
  chainName: ChainName,
  walletType?: WalletType
) => {
  const defaultAsset = DefaultAssetByChainName[chainName];
  const { contractAddress, oraclecontractAddress, ausdContractAddress } =
    getContractAddressesByChain(appVersion, chainName);
  const rpcUrl = injectivePrivRpc;
  const injSdkWallet = walletType
    ? InjSdkWalletByCosmosWallet[walletType as WalletType]
    : Wallet.Keplr;
  const walletStrategy = new WalletStrategy({
    chainId: chain.chain_id as ChainId,
    ethereumOptions: {
      ethereumChainId: ethereumChainId,
      rpcUrl: rpcUrl,
    },
    wallet: injSdkWallet,
  });
  const chainGrpcWasmApi = new ChainGrpcWasmApi(injectivePrivGrpc);

  const msgBroadcastClient = new MsgBroadcaster({
    walletStrategy,
    network: Network.Testnet,
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
  };

  const getTotalCollateralAmounts = async (): Promise<
    TotalCollateralModel[] | undefined
  > => {
    if (chainName === ChainName.INJECTIVE) {
      const res = await chainGrpcWasmApi.fetchSmartContractState(
        contractAddress,
        toBase64({ total_collateral_amount: {} })
      );
      const data: any = fromBase64(res.data as any);
      return data;
    }

    return;
  };

  const getTotalDebtAmount = async (): Promise<string | undefined> => {
    if (chainName === ChainName.INJECTIVE) {
      const res = await chainGrpcWasmApi.fetchSmartContractState(
        contractAddress,
        toBase64({ total_debt_amount: {} })
      );
      const data: any = fromBase64(res.data as any);
      return data;
    }

    return;
  };

  const getTrove = async (user_addr: string): Promise<GetTroveResponseV1 | GetTroveResponseV2 | undefined> => {
    if (chainName === ChainName.INJECTIVE) {
      const res = await chainGrpcWasmApi.fetchSmartContractState(contractAddress, toBase64({ trove: { user_addr } }))
      const data: any = fromBase64(res.data as any);
      return data;
    }
  }

  const getStake = async (
    user_addr: string
  ): Promise<GetStakeResponse | undefined> => {
    if (chainName === ChainName.INJECTIVE) {
      const res = await chainGrpcWasmApi.fetchSmartContractState(
        contractAddress,
        toBase64({ stake: { user_addr } })
      );
      const data: any = fromBase64(res.data as any);
      return data;
    }

    return;
  };

  const getTotalStake = async (): Promise<string | undefined> => {
    if (chainName === ChainName.INJECTIVE) {
      const res = await chainGrpcWasmApi.fetchSmartContractState(
        contractAddress,
        toBase64({ total_stake_amount: {} })
      );
      const data: any = fromBase64(res.data as any);
      return data;
    }

    return;
  };

  const getCollateralPrice = async () => {
    if (chainName === ChainName.INJECTIVE) {
      const res = await chainGrpcWasmApi.fetchSmartContractState(
        contractAddress,
        toBase64({ collateral_price: {} })
      );
      const data: any = fromBase64(res.data as any);
      return data;
    }

    return;
  };

  const getAusdBalance = async (
    address: string
  ): Promise<CW20BalanceResponse | undefined> => {
    if (chainName === ChainName.INJECTIVE) {
      const res = await chainGrpcWasmApi.fetchSmartContractState(
        ausdContractAddress,
        toBase64({ balance: { address } })
      );
      const data: any = fromBase64(res.data as any);
      return data;
    }

    return;
  };

  const getAusdInfo = async (): Promise<CW20TokenInfoResponse | undefined> => {
    if (chainName === ChainName.INJECTIVE) {
      const res = await chainGrpcWasmApi.fetchSmartContractState(
        ausdContractAddress,
        toBase64({ token_info: {} })
      );
      const data: any = fromBase64(res.data as any);
      return data;
    }

    return;
  };

  const getReward = async (user_addr: string): Promise<string | undefined> => {
    if (chainName === ChainName.INJECTIVE) {
      const res = await chainGrpcWasmApi.fetchSmartContractState(
        contractAddress,
        toBase64({ liquidation_gains: { user_addr } })
      );
      const data: any = fromBase64(res.data as any);
      return data;
    }

    return;
  };

  //EXECUTE QUERIES
  const openTrove = async (senderAddress: string, amount: number, loanAmount: number, asset: CollateralAsset = defaultAsset) => {

    if (chainName === ChainName.INJECTIVE) {
      const vaa = await getVAA(asset);

      const msg = MsgExecuteContractCompat.fromJSON({
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

      const msg1 = MsgExecuteContractCompat.fromJSON({
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
  }

  const addCollateral = async (senderAddress: string, amount: number, asset: CollateralAsset = defaultAsset) => {

    const vaa = await getVAA(asset);

    if (chainName === ChainName.INJECTIVE) {
      const msg = MsgExecuteContractCompat.fromJSON({
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

      const msg1 = MsgExecuteContractCompat.fromJSON({
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
  }

  const removeCollateral = async (senderAddress: string, amount: number, asset: CollateralAsset = defaultAsset) => {
    const vaa = await getVAA(asset);

    if (chainName === ChainName.INJECTIVE) {
      const msg = MsgExecuteContractCompat.fromJSON({
        contractAddress: asset.oracleContractAddress,
        sender: senderAddress,
        msg: {
          update_price_feeds: {
            data: [
              vaa
            ]
          }
        },
        funds: [coin("14", asset.denom)]
      })

      const msg1 = MsgExecuteContractCompat.fromJSON({
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
  };

  const borrowLoan = async (senderAddress: string, amount: number) => {

    const vaa = await getVAA();

    if (chainName === ChainName.INJECTIVE) {
      const msg = MsgExecuteContractCompat.fromJSON({
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

      const msg1 = MsgExecuteContractCompat.fromJSON({
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
  }

  const repayLoan = async (senderAddress: string, amount: number) => {
    const msg = {
      send: {
        contract: contractAddress,
        amount: getRequestAmount(amount, baseCoin.ausdDecimal),
        msg: jsonToBinary({ repay_loan: {} }),
      },
    };

    const vaa = await getVAA();

    if (chainName === ChainName.INJECTIVE) {
      const msgVAA = MsgExecuteContractCompat.fromJSON({
        contractAddress: oraclecontractAddress,
        sender: senderAddress,
        msg: {
          update_price_feeds: {
            data: [vaa],
          },
        },
        funds: [coin("14", BaseCoinByChainName[chainName].denom)],
      });

      const msg1 = MsgExecuteContractCompat.fromJSON({
        contractAddress: ausdContractAddress,
        sender: senderAddress,
        msg,
      });

      return await msgBroadcastClient.broadcast({
        msgs: [msgVAA, msg1],
        injectiveAddress: senderAddress,
        gas: { gas: 40000000 }
      })
    }
  };

  const stake = async (senderAddress: string, amount: number) => {
    const msg = {
      send: {
        contract: contractAddress,
        amount: getRequestAmount(amount, baseCoin.ausdDecimal),
        msg: jsonToBinary({ stake: {} }),
      },
    };

    if (chainName === ChainName.INJECTIVE) {
      const msg1 = MsgExecuteContractCompat.fromJSON({
        contractAddress: ausdContractAddress,
        sender: senderAddress,
        msg,
      });

      return await msgBroadcastClient.broadcast({
        msgs: msg1,
        injectiveAddress: senderAddress,
        gas: { gas: 40000000 }
      })
    }
  };

  const unstake = async (senderAddress: string, amount: number) => {
    if (chainName === ChainName.INJECTIVE) {
      const msg1 = MsgExecuteContractCompat.fromJSON({
        contractAddress: contractAddress,
        sender: senderAddress,
        msg: {
          unstake: { amount: getRequestAmount(amount, baseCoin.ausdDecimal) },
        },
      });

      return await msgBroadcastClient.broadcast({
        msgs: msg1,
        injectiveAddress: senderAddress,
        gas: { gas: 40000000 }
      })
    }
  };

  const redeem = async (senderAddress: string, amount: number) => {
    const msg = {
      send: {
        contract: contractAddress,
        amount: getRequestAmount(amount, baseCoin.decimal),
        msg: jsonToBinary({ redeem: {} }),
      },
    };

    const vaa = await getVAA();

    if (chainName === ChainName.INJECTIVE) {
      const msg0 = MsgExecuteContractCompat.fromJSON({
        contractAddress: oraclecontractAddress,
        sender: senderAddress,
        msg: {
          update_price_feeds: {
            data: [vaa],
          },
        },
        funds: [coin("1", BaseCoinByChainName[chainName].denom)],
      });

      const msg1 = MsgExecuteContractCompat.fromJSON({
        contractAddress: ausdContractAddress,
        sender: senderAddress,
        msg,
      });

      return await msgBroadcastClient.broadcast({
        msgs: [msg0, msg1],
        injectiveAddress: senderAddress,
        gas: { gas: 40000000 }
      })
    }
  };

  const liquidateTroves = async (senderAddress: string) => {
    const vaa = await getVAA();

    if (chainName === ChainName.INJECTIVE) {
      const msg0 = MsgExecuteContractCompat.fromJSON({
        contractAddress: oraclecontractAddress,
        sender: senderAddress,
        msg: {
          update_price_feeds: {
            data: [vaa],
          },
        },
        funds: [coin("1", BaseCoinByChainName[chainName].denom)],
      });

      const msg1 = MsgExecuteContractCompat.fromJSON({
        contractAddress,
        sender: senderAddress,
        msg: { liquidate_troves: {} },
      });

      return await msgBroadcastClient.broadcast({
        msgs: [msg0, msg1],
        injectiveAddress: senderAddress,
        gas: { gas: 40000000 }
      })
    }
  };

  const liquidateTrovesV2 = async (senderAddress: string, owner: string) => {

    const vaa = await getVAA();

    if (chainName === ChainName.INJECTIVE) {
      const msg0 = MsgExecuteContractCompat.fromJSON({
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

      const msg1 = MsgExecuteContractCompat.fromJSON({
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

  }

  const withdrawLiquidationGains = async (senderAddress: string) => {
    if (chainName === ChainName.INJECTIVE) {
      const msg = MsgExecuteContractCompat.fromJSON({
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
