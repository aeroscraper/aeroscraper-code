"use client";

import { useEffect, useState, useRef } from "react";
import { useAppKitBalance, useAppKitAccount } from "@reown/appkit/react";
import { Dictionary } from "lodash";

export function useSolanaBalance() {
  const { isConnected } = useAppKitAccount();
  const { fetchBalance } = useAppKitBalance();
  const [balance, setBalance] = useState<any | null>(null);
  const [balanceByDenom, setBalanceByDenom] = useState<Dictionary<any>>({});

  // ✅ prevent infinite re-run by keeping a stable reference
  const fetchedOnce = useRef(false);

  useEffect(() => {
    if (!isConnected || fetchedOnce.current) return;
    fetchedOnce.current = true; // run only once per connection

    const getBalance = async () => {
      try {
        const res = await fetchBalance();
        const bal = res?.data?.balance ?? "0";
        const symbol = res?.data?.symbol ?? "SOL";
        setBalanceByDenom({
          [symbol]: { denom: symbol, amount: bal.toString() },
        });
        setBalance(res);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    getBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]); // 👈 removed fetchBalance from deps

  const formattedBalance = balance?.data?.balance ?? "0.00";
  const symbol = balance?.data?.symbol ?? "SOL";

  return { balance, formattedBalance, symbol, balanceByDenom };
}
