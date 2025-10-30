import { useMemo } from "react";
import {
  useWalletInfo as useReownWalletInfo,
  useAppKitAccount,
} from "@reown/appkit/react";
import { ChainName } from "@/enums/Chain";
import { WalletInfo } from "@/types/types";

interface SolanaAdapterValue {
  address?: string;
  username?: string;
  walletInfo?: WalletInfo;
  isWalletConnected: boolean;
  isWalletConnecting: boolean;
}

export const useSolanaAdapter = (): SolanaAdapterValue => {
  const { walletInfo: reownWalletInfo } = useReownWalletInfo();
  const { address, isConnected } = useAppKitAccount();

  const walletInfo = useMemo<WalletInfo | undefined>(() => {
    if (!isConnected || !reownWalletInfo) return undefined;

    return {
      name: ChainName.SOLANA,
      prettyName: reownWalletInfo.name || "Solana Wallet",
      logo: reownWalletInfo.icon || "/images/token-images/solana.svg",
    };
  }, [isConnected, reownWalletInfo]);

  const username = useMemo<string | undefined>(() => {
    if (!isConnected) return undefined;

    // Prefer wallet-provided name
    if (reownWalletInfo?.name) return reownWalletInfo.name;

    // Fallback to shortened address
    if (address) {
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }

    return undefined;
  }, [isConnected, reownWalletInfo, address]);

  const isWalletConnecting = !isConnected && !!address;

  const value = useMemo<SolanaAdapterValue>(
    () => ({
      address,
      username,
      walletInfo,
      isWalletConnected: isConnected,
      isWalletConnecting,
    }),
    [address, username, walletInfo, isConnected, isWalletConnecting]
  );

  return value;
};
