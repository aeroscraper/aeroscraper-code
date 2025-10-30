"use client";

import React, { FC, PropsWithChildren } from "react";
import AppProvider from "@/contexts/AppProvider";
import { NotificationProvider } from "@/contexts/NotificationProvider";
import { ChainProvider } from "@cosmos-kit/react";
import { chains, assets } from "chain-registry";
import { wallets as keplrWallets } from "@cosmos-kit/keplr";
import { wallets as leapWallets } from "@cosmos-kit/leap";
import { wallets as ninjiWallets } from "@cosmos-kit/ninji";
import { wallets as ledgerWallets } from "@cosmos-kit/ledger";
import { wallets as cosmostationWallets } from "@cosmos-kit/cosmostation";
import { ChainName } from "@/enums/Chain";
import { GasPrice } from "@cosmjs/stargate";
import ProfileProvider from "./ProfileProvider";
import PriceProvider from "./PriceProvider";
import DashboardProvider from "./DashboardProvider";
import BalanceProvider from "./BalanceProvider";
import { XionProviders } from "./xionProviders";

const Providers: FC<PropsWithChildren> = ({ children }) => {
  return (
    <XionProviders>
      <ChainProvider
        chains={chains}
        assetLists={assets}
        wallets={[
          keplrWallets[0],
          leapWallets[0],
          ninjiWallets[0],
          cosmostationWallets[0],
          ledgerWallets[0],
        ]}
        throwErrors={true}
        signerOptions={{
          signingCosmwasm: (chain) => {
            switch (typeof chain === "string" ? chain : chain.chain_name) {
              case ChainName.INJECTIVE:
                return {
                  gasPrice: GasPrice.fromString("0.025inj"),
                };
              case ChainName.SEI:
                return {
                  gasPrice: GasPrice.fromString("0.025sei"),
                };
              case ChainName.ARCHWAY:
                return {
                  gasPrice: GasPrice.fromString("0.025uatom"),
                };
              case ChainName.NEUTRON:
                return {
                  gasPrice: GasPrice.fromString("0.025untrn"),
                };
              default:
                return {
                  gasPrice: GasPrice.fromString("0.025inj"),
                };
            }
          },
        }}
      >
        <PriceProvider>
          <AppProvider>
            <NotificationProvider>
              <ProfileProvider>
                <BalanceProvider>
                  <DashboardProvider>
                    {children}
                  </DashboardProvider>
                </BalanceProvider>
              </ProfileProvider>
            </NotificationProvider>
          </AppProvider>
        </PriceProvider>
      </ChainProvider>
    </XionProviders>
  );
};

export default Providers;
