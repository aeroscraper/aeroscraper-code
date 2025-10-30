"use client";

import React, { useEffect, useState } from "react";
import Text from "@/components/Texts/Text";
import { ExitIcon, LogoSecondary, SolanaIcon } from "@/components/Icons/Icons";
import NotificationDropdown from "@/app/app/dashboard/_components/NotificationDropdown";
import { isNil } from "lodash";
import AccountModal from "@/components/AccountModal/AccountModal";
import { convertAmount } from "@/utils/contractUtils";
import NotificationModal from "@/components/Modal/NotificationModal";
import WalletButton from "@/components/Buttons/WalletButton";
import useChainAdapter from "@/hooks/useChainAdapter";
import { WalletType } from "@/enums/WalletType";
import VersionSelector from "@/components/VersionSelector/VersionSelector";
import { useProfile } from "@/contexts/ProfileProvider";
import { usePageData } from "@/contexts/DashboardProvider";
import { useBalances } from "@/contexts/BalanceProvider";
import { ChainName } from "@/enums/Chain";
import { useNotification } from "@/contexts/NotificationProvider";
import Swal from "sweetalert2";
import ChainData from "@/services/data/chain.json";
import { PublicKey } from "@solana/web3.js";
import { useProtocolState } from "@/hooks/useProtocolState";

import {
  useAppKitAccount,
  useAppKitBalance,
  useDisconnect,
} from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";

import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { BaseCoinByChainName } from "@/constants/chainConstants";
import { CollateralAsset } from "@/types/types";
import { DefaultAssetByChainName } from "@/constants/assetConstants";
import { useSolanaAdapter } from "@/hooks/useSolanaAdapter";
import RequestCollateralButton from "@/components/Buttons/RequestCollateralButton";

const AppTheme = () => {
  const { walletInfo, address, isWalletConnected, username } =
    useSolanaAdapter();
  const { connection } = useAppKitConnection();
  const baseCoin = BaseCoinByChainName[ChainName.SOLANA];

  const { disconnect } = useDisconnect();
  const { formattedBalance, balance, symbol, balanceByDenom } =
    useSolanaBalance();
  const [mounted, setMounted] = useState(false);
  const [ausdBalance, setAusdBalance] = useState<bigint>(BigInt(0));
  const { protocolState } = useProtocolState();
  const [accountModal, setAccountModal] = useState(false);
  const { profileDetail } = useProfile();
  const [chainData, setChainData] = useState<any>(ChainData);

  useEffect(() => {
    const fetchAusdBalance = async () => {
      if (!address || !connection || !protocolState) {
        setAusdBalance(BigInt(0));
        return;
      }

      try {
        const { getAccount, getAssociatedTokenAddress } = await import(
          "@solana/spl-token"
        );
        const userPublicKey = new PublicKey(address);
        const userATA = await getAssociatedTokenAddress(
          protocolState.stablecoinMint,
          userPublicKey
        );

        try {
          const accountInfo = await getAccount(connection, userATA);
          setAusdBalance(accountInfo.amount);
        } catch (err) {
          setAusdBalance(BigInt(0));
        }
      } catch (err) {
        console.error("Error fetching aUSD balance:", err);
        setAusdBalance(BigInt(0));
      }
    };

    fetchAusdBalance();
    const interval = setInterval(fetchAusdBalance, 5000);
    return () => clearInterval(interval);
  }, [address, connection, protocolState]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render consistent default state during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <>
        <div className="bg-[#5C5CFF] opacity-[0.09] h-[600px] w-full md:w-[600px] absolute -top-60 -translate-x-1/3 left-1/3 rounded-full blur-3xl -z-10 px-3" />
        <header className="md:mb-[88px] w-full container mx-auto mt-8 flex justify-between items-center px-3 md:px-[64px]">
          <div className="flex items-center gap-2 mr-2">
            <LogoSecondary className="w-6 md:w-10 h-6 md:h-10" />
            <Text size="2xl">Aeroscraper</Text>
          </div>
          <div className="flex items-center">
            <div className="items-center gap-2 mr-8 md:flex hidden">
              <Text size="base">$1.00</Text>
              <img
                alt="ausd"
                className="w-5 h-5"
                src="/images/token-images/ausd-blue.svg"
              />
            </div>
            <WalletButton
              ausdBalance={0}
              className="rounded-lg w-[200px] md:w-[287px] ml-2 h-[36px] md:h-[48px]"
              baseCoinBalance={0}
              basePrice={0}
            />
          </div>
        </header>
      </>
    );
  }
  // const [selectedAsset, setSelectedAsset] = useState<CollateralAsset>(
  //   DefaultAssetByChainName[selectedChainName ?? ChainName.INJECTIVE]
  // );

  // const {
  //   selectedChainName,
  //   isWalletConnected,
  //   baseCoin,
  //   walletInfo,
  //   // address,
  //   username,
  //   selectedWallet,
  //   // disconnect,
  //   // disconnectMetamask,
  //   // disconnectXion,
  // } = useChainAdapter();
  // const { addNotification } = useNotification();
  // const { balanceByDenom } = useBalances();

  // const disconnectWallet = () => {
  //   if (selectedChainName === ChainName.XION) {
  //     disconnectXion();
  //   } else if (walletInfo?.name === WalletType.METAMASK) {
  //     disconnectMetamask();
  //   } else {
  //     disconnect();
  //   }
  //   localStorage.removeItem("selectedWallet");
  //   localStorage.removeItem("profile-detail");
  // };

  // useEffect(() => {
  //   if (
  //     window.ethereum &&
  //     typeof window !== "undefined" &&
  //     selectedWallet === WalletType.METAMASK &&
  //     isWalletConnected
  //   ) {
  //     const getChainId = async () => {
  //       const { ethereum } = window as any;
  //       const chainIdMetamask: any = await ethereum?.request({
  //         method: "eth_chainId",
  //       });

  //       if (chainIdMetamask != chainID) {
  //         CheckChain(chainIdMetamask);
  //       }
  //     };
  //     getChainId();

  //     window.ethereum?.on("chainChanged", (chainId: any) => {
  //       CheckChain(chainId);
  //       if (chainID === Number(chainId)) {
  //         /* ToastSuccess.fire({
  //           title: "Network Changed",
  //         }); */
  //         addNotification({
  //           status: "networkchange",
  //           directLink: "",
  //           message: "Network Changed",
  //         });
  //         //window.location.reload();
  //       }
  //     });
  //   }
  // }, [selectedWallet, isWalletConnected]);

  // const CheckChain = (id: number) => {
  //   try {
  //     id = Number(id);
  //     if (id !== chainID) {
  //       const { name } = chainData[id.toString()] || { name: "UNKNOW" };
  //       const fromNetwork = name || "Unknown Network";
  //       const toNetwork =
  //         chainData[chainID.toString()]?.name || "GOERLI NETWORK ";
  //       const alert = async () =>
  //         await Swal.fire({
  //           title: "Please Change Network",
  //           text: `From ${fromNetwork} to ${toNetwork}`,
  //           iconColor: "white",
  //           showCancelButton: false,
  //           showCloseButton: true,
  //           backdrop: true,
  //           background: "#150A17",
  //           iconHtml: `<img src="/images/checkchain.svg" width="150" height="150" class="w-full shrink-0 " style="background:#150A17" />`,
  //           color: "#fff",
  //           confirmButtonText: "Change Network",
  //           customClass: {
  //             icon: "!bg-[#150A17] w-[150px] h-auto !border-0",
  //             confirmButton:
  //               "w-full md:w-[350px] py-2 px-8 h-[50px] text-base font-normal confirmBtn md:mb-8",
  //             htmlContainer: "!text-white/50 !text-sm md:mb-3",
  //             title: "!text-[32px] ",
  //             popup: " lg:!p-10",
  //           },
  //         }).then((result) => {
  //           if (result.isConfirmed) {
  //             window.ethereum?.request({
  //               method: "wallet_switchEthereumChain",
  //               params: [{ chainId: chainData[chainID.toString()].chainId }],
  //             }) ||
  //               window.ethereum.request({
  //                 method: "wallet_addEthereumChain",
  //                 params: [
  //                   {
  //                     chainId: chainData[chainID.toString()].chainId,
  //                     chainName: chainData[chainID.toString()].name,
  //                     nativeCurrency: {
  //                       name: chainData[chainID.toString()].nativeCurrency.name,
  //                       symbol:
  //                         chainData[chainID.toString()].nativeCurrency.symbol,
  //                       decimals: 18,
  //                     },
  //                     rpcUrls: chainData[chainID.toString()].rpcUrls,
  //                     blockExplorerUrls:
  //                       chainData[chainID.toString()].blockExplorerUrls,
  //                   },
  //                 ],
  //               });
  //           }
  //         });
  //       alert();
  //     }
  //   } catch (error) {
  //     console.log("CheckChain error:", error);
  //   }
  // };

  return (
    <>
      <div className="bg-[#5C5CFF] opacity-[0.09] h-[600px] w-full  md:w-[600px] absolute -top-60 -translate-x-1/3 left-1/3 rounded-full blur-3xl -z-10 px-3" />
      <header className="md:mb-[88px]  w-full container mx-auto mt-8 flex justify-between items-center px-3 md:px-[64px]">
        <div className="flex items-center gap-2 mr-2">
          <LogoSecondary className="w-6 md:w-10 h-6 md:h-10" />
          <Text size="2xl">Aeroscraper</Text>
        </div>
        <div className="flex items-center">
          <div className="items-center gap-2 mr-8 md:flex hidden">
            <Text size="base">$1.00</Text>
            <img
              alt="ausd"
              className="w-5 h-5"
              src="/images/token-images/ausd-blue.svg"
            />
          </div>
          {isWalletConnected && (
            <div className="items-center gap-2 mr-12 md:flex hidden">
              <Text size="base">
                {Number(formattedBalance).toFixed(4)} {symbol}
              </Text>
              <SolanaIcon className="w-5 h-5" />
            </div>
          )}
          {isWalletConnected && !isNil(baseCoin) ? (
            <>
              <div className="md:flex hidden mr-4">
                <VersionSelector />
              </div>
              <div className="md:flex hidden">
                <NotificationDropdown />
              </div>
              <div className="md:flex hidden items-center ml-4 gap-2">
                <RequestCollateralButton />
              </div>
              <button
                className="flex ml-12 gap-2 items-center hover:blur-[1px] transition-all duration-300"
                onClick={() => {
                  setAccountModal(true);
                }}
              >
                <img
                  alt="user-profile-image"
                  src={
                    profileDetail?.photoUrl ??
                    "/images/profile-images/profile-i-1.jpg"
                  }
                  className="rounded-sm bg-raisin-black w-12 h-12"
                />
                <div className="flex flex-col">
                  <div className="flex items-center ml-auto">
                    <img
                      alt={walletInfo?.name}
                      className="w-4 h-4 object-contain rounded"
                      src={walletInfo?.logo as string}
                    />
                    <Text
                      size="lg"
                      weight="font-regular"
                      className="truncate ml-2"
                    >
                      {username}
                    </Text>
                  </div>
                  <Text size="sm">
                    {address?.slice(0, 6)}...{address?.slice(-6)}
                  </Text>
                </div>
                <button
                  className="w-12 h-12 flex items-center justify-center hover:blur-[1px] transition-all duration-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    // disconnectWallet();
                    disconnect();
                  }}
                >
                  <ExitIcon className="text-white" />
                </button>
              </button>
            </>
          ) : (
            <WalletButton
              ausdBalance={Number(ausdBalance) / 1e18}
              className="rounded-lg w-[200px] md:w-[287px] ml-2 h-[36px] md:h-[48px]"
              baseCoinBalance={
                !isNil(baseCoin)
                  ? Number(
                    convertAmount(
                      balanceByDenom[baseCoin.denom]?.amount ?? 0,
                      baseCoin.decimal
                    )
                  )
                  : 0
              }
              basePrice={Number(ausdBalance) / 1e18}
            />
          )}
        </div>
        <NotificationModal />

        <AccountModal
          balance={{
            ausd: Number(ausdBalance) / 1e18,
            base: !isNil(baseCoin)
              ? Number(
                convertAmount(
                  balanceByDenom[baseCoin.denom]?.amount ?? 0,
                  baseCoin.decimal
                )
              )
              : 0,
          }}
          basePrice={Number(ausdBalance) / 1e18}
          showModal={accountModal}
          onClose={() => {
            setAccountModal(false);
          }}
        />
      </header>
      {isWalletConnected && !isNil(baseCoin) && (
        <div className="items-center md:hidden flex border h-[50px] border-white/20 mx-4 rounded-lg mt-8 pl-4 z-50">
          <div className="flex items-center gap-2 mr-8">
            <Text size="base">$1.00</Text>
            <img
              alt="ausd"
              className="w-5 h-5"
              src="/images/token-images/ausd-blue.svg"
            />
          </div>
          {!isNil(baseCoin) && (
            <div className="flex items-center gap-2 mr-12">
              <Text size="base">$ {Number(ausdBalance) / 1e18}</Text>
              <img
                alt={baseCoin.name}
                className="w-5 h-5"
                src={baseCoin.tokenImage}
              />
            </div>
          )}
          {isWalletConnected && (
            <div className="ml-auto">
              <NotificationDropdown />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AppTheme;
