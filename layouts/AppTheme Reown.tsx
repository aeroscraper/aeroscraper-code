"use client";

import React from "react";
import Text from "@/components/Texts/Text";
import { LogoSecondary, ExitIcon } from "@/components/Icons/Icons";
import WalletConnectButton from "@/components/Buttons/WalletButton";
import { useAppKitAccount, useDisconnect } from "@reown/appkit/react";

const AppTheme = () => {
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();

  return (
    <>
      {/* Background Glow */}
      <div className="bg-[#5C5CFF] opacity-[0.09] h-[600px] w-full md:w-[600px] absolute -top-60 -translate-x-1/3 left-1/3 rounded-full blur-3xl -z-10" />

      {/* Header */}
      <header className="md:mb-[88px] w-full container mx-auto mt-8 flex justify-between items-center px-3 md:px-[64px]">
        {/* Logo Section */}
        <div className="flex items-center gap-2 mr-2">
          <LogoSecondary className="w-6 md:w-10 h-6 md:h-10" />
          <Text size="2xl">Aeroscraper</Text>
        </div>

        {/* Wallet + User Section */}
        <div className="flex items-center">
          {isConnected ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end text-right">
                <Text size="sm" className="text-gray-400">
                  Connected
                </Text>
                <Text size="base" className="font-mono truncate w-[140px]">
                  {address?.slice(0, 6)}...{address?.slice(-6)}
                </Text>
              </div>

              <button
                onClick={() => disconnect()}
                className="flex items-center justify-center bg-red-500 hover:bg-red-600 transition text-white rounded-lg px-4 py-2"
              >
                <ExitIcon className="w-5 h-5 mr-1" />
                Disconnect
              </button>
            </div>
          ) : (
            <WalletConnectButton className="rounded-lg w-[200px] md:w-[287px] ml-2 h-[36px] md:h-[48px]" />
          )}
        </div>
      </header>

      {/* Optional: Token Info (mock, you can bind later from API) */}
      {isConnected && (
        <div className="flex items-center justify-center gap-8 border border-white/20 mx-4 rounded-lg mt-6 p-4">
          <div className="flex items-center gap-2">
            <Text size="base">$1.00</Text>
            <img
              alt="ausd"
              className="w-5 h-5"
              src="/images/token-images/ausd-blue.svg"
            />
          </div>
          <div className="flex items-center gap-2">
            <Text size="base">$ 0.1234</Text>
            <img
              alt="SOL"
              className="w-5 h-5"
              src="/images/token-images/solana.svg"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AppTheme;
