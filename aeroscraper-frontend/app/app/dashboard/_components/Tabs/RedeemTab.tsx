'use client';

import React, { FC, useCallback, useEffect, useMemo, useState } from "react";
import Text from "@/components/Texts/Text";
import { useNotification } from "@/contexts/NotificationProvider";
import { isNil } from "lodash";
import { NumberFormatValues, NumericFormat } from "react-number-format";
import OutlinedButton from "@/components/Buttons/OutlinedButton";
import TransactionButton from "@/components/Buttons/TransactionButton";
import {
  ArrowDownIcon,
  Logo,
  LogoSecondary,
  RedeemIcon,
  SolanaIcon,
} from "@/components/Icons/Icons";
import BorderedNumberInput from "@/components/Input/BorderedNumberInput";
import BorderedContainer from "@/components/Containers/BorderedContainer";
import { useAppKitAccount } from '@reown/appkit/react';
import { useAppKitConnection } from '@reown/appkit-adapter-solana/react';
import { useSolanaProtocol } from "@/hooks/useSolanaProtocol";
import { useProtocolState } from "@/hooks/useProtocolState";
import { PublicKey, Connection } from "@solana/web3.js";
import { fetchAllTroves } from "@/lib/solana/fetchTroves";

const RedeemTab: FC = () => {
  const { address, isConnected } = useAppKitAccount();
  const { connection } = useAppKitConnection();
  const { redeem, loading: processLoading } = useSolanaProtocol();
  const { protocolState } = useProtocolState();
  const { addNotification } = useNotification();

  const [redeemAmount, setRedeemAmount] = useState(0);
  const [ausdBalance, setAusdBalance] = useState<bigint>(BigInt(0));
  const [estimatedSOL, setEstimatedSOL] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingTroves, setLoadingTroves] = useState(false);
  const [sortedTroves, setSortedTroves] = useState<any[]>([]);
  const [maxRedeemableGross, setMaxRedeemableGross] = useState(0);
  const [exceededHint, setExceededHint] = useState(false);

  // Fetch user's aUSD balance
  useEffect(() => {
    const fetchAusdBalance = async () => {
      if (!address || !connection || !protocolState) {
        setAusdBalance(BigInt(0));
        return;
      }

      try {
        const { getAccount, getAssociatedTokenAddress } = await import("@solana/spl-token");
        const userPublicKey = new PublicKey(address);
        const userATA = await getAssociatedTokenAddress(protocolState.stablecoinMint, userPublicKey);

        try {
          const accountInfo = await getAccount(connection as unknown as Connection, userATA);
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

  // Background trove polling (fast UX): fetch once and every 12s
  useEffect(() => {
    if (!connection) { setSortedTroves([]); return; }
    let aborted = false;
    const poll = async () => {
      try {
        setLoadingTroves(true);
        const allTroves = await fetchAllTroves(connection as unknown as Connection, 'SOL');
        if (aborted) return;
        const s = allTroves.sort((a, b) => (a.icr < b.icr ? -1 : a.icr > b.icr ? 1 : 0));
        setSortedTroves(s);
      } catch (e) {
        if (!aborted) {
          console.error('Error fetching troves:', e);
          setSortedTroves([]);
        }
      } finally {
        if (!aborted) setLoadingTroves(false);
      }
    };
    poll();
    const id = setInterval(poll, 12000);
    return () => { aborted = true; clearInterval(id); };
  }, [connection]);

  // Compute max redeemable and estimate from cached troves + balance
  useEffect(() => {
    const MAX_TROVES = 3;
    const feePercent = 0.05; // fallback
    if (!sortedTroves || sortedTroves.length === 0) {
      setMaxRedeemableGross(0);
      setEstimatedSOL(0);
      return;
    }
    const limited = sortedTroves.slice(0, MAX_TROVES);
    const netCap = limited.reduce((acc, t) => acc + Number(t.debt) / 1e18, 0);
    const userAusd = Number(ausdBalance) / 1e18;
    // Compute gross cap with safe floor to avoid rounding up beyond on-chain debt
    const grossCapRaw = netCap > 0 ? netCap / (1 - feePercent) : 0;
    const grossCapFloored = Math.floor(grossCapRaw * 1e6) / 1e6; // floor to 6 decimals
    const grossCap = Math.min(grossCapFloored, userAusd, 999);
    setMaxRedeemableGross(grossCap);
    if (grossCap > 0 && Math.abs(redeemAmount - grossCap) > 1e-12) {
      setRedeemAmount(grossCap);
    }
    const effectiveGross = grossCap > 0 ? Math.min(redeemAmount || grossCap, grossCap) : 0;
    const effectiveNet = effectiveGross * (1 - feePercent);
    let remainingAmount = BigInt(Math.floor(effectiveNet * 1e18));
    let totalCollateralToReceive = BigInt(0);
    for (const t of sortedTroves) {
      if (remainingAmount <= BigInt(0)) break;
      if (t.debt <= 0) continue;
      const take = remainingAmount < t.debt ? remainingAmount : t.debt;
      const ratio = Number(take) / Number(t.debt);
      const coll = BigInt(Math.floor(Number(t.collateralAmount) * ratio));
      totalCollateralToReceive += coll;
      remainingAmount -= take;
    }
    setEstimatedSOL(Number(totalCollateralToReceive) / 1e9);
  }, [sortedTroves, ausdBalance, redeemAmount]);

  const changeRedeemAmount = useCallback(
    (values: NumberFormatValues) => {
      const raw = Number(values.value);
      if (!raw || raw <= 0) {
        setRedeemAmount(0);
        setExceededHint(false);
        return;
      }
      const cap = maxRedeemableGross > 0 ? maxRedeemableGross : 0;
      if (cap > 0 && raw > cap) {
        setRedeemAmount(cap);
        setExceededHint(true);
      } else {
        setRedeemAmount(raw);
        setExceededHint(false);
      }
    },
    [maxRedeemableGross]
  );

  const redeemDisabled = useMemo(
    () =>
      isNil(redeemAmount) ||
      redeemAmount <= 0 ||
      redeemAmount > 999 ||
      (maxRedeemableGross > 0 && redeemAmount > maxRedeemableGross) ||
      redeemAmount > Number(ausdBalance) / 1e18 ||
      processLoading ||
      loading,
    [redeemAmount, maxRedeemableGross, ausdBalance, processLoading, loading]
  );

  const handleRedeem = async () => {
    try {
      const signature = await redeem({ redeemAmount });

      addNotification({
        status: "success",
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: `${redeemAmount} AUSD has been redeemed, Received ${estimatedSOL.toFixed(6)} SOL`,
      });

      // Reset form
      setRedeemAmount(0);
      setEstimatedSOL(0);
    } catch (err: any) {
      addNotification({
        status: "error",
        message: err.message || "Failed to redeem aUSD",
        directLink: "",
      });
    }
  };

  return (
    <section>
      <Text size="3xl">Convert your AUSD directly to SOL</Text>
      <div className="mt-6">
        <div className="relative w-full bg-cetacean-dark-blue border backdrop-blur-[37px] border-white/10 rounded-xl md:rounded-2xl px-3 pt-4 pb-3 md:px-6 md:py-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                alt="ausd"
                className="w-6 h-6"
                src="/images/token-images/ausd-blue.svg"
              />
              <Text size="base" weight="font-medium">
                AUSD
              </Text>
            </div>
            <BorderedNumberInput
              value={redeemAmount}
              onValueChange={changeRedeemAmount}
              containerClassName="h-10 text-end flex-1 ml-6"
              bgVariant="blue"
              className="text-end"
              disabled
            />
          </div>
          <NumericFormat
            value={Number(ausdBalance) / 1e18}
            thousandsGroupStyle="thousand"
            thousandSeparator=","
            fixedDecimalScale
            decimalScale={2}
            displayType="text"
            renderText={(value) => (
              <Text size="base" className="md:mt-4 ml-auto">
                Available:{" "}
                <span className="font-regular ml-2">{value} AUSD</span>
                <span className="opacity-60 mx-2">|</span>
                Max redeemable:{" "}
                {loadingTroves ? (
                  <span className="inline-block ml-2 w-24 h-4 rounded bg-white/10 animate-pulse" />
                ) : (
                  <span className="font-regular ml-2">{maxRedeemableGross} AUSD</span>
                )}
              </Text>
            )}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-[60px]">
            <BorderedContainer containerClassName="md:w-12 w-10 h-10 md:h-12 mx-auto -mt-4 md:mt-2 p-[1.8px]">
              <div className="bg-cetacean-dark-blue h-full w-full rounded-lg flex items-center justify-center">
                <ArrowDownIcon className="w-4 h-4 text-white " />
              </div>
            </BorderedContainer>
          </div>
        </div>
        <div className="w-full bg-cetacean-dark-blue border border-white/10 rounded-xl md:rounded-2xl px-3 pt-6 pb-3 md:px-6 md:py-8 flex items-center justify-between mt-6">
          <div className="flex items-center gap-2">
            {/* <img
              alt="sol"
              src="/images/token-images/sol.svg"
              className="w-6 h-6"
            /> */}
            <SolanaIcon />
            <Text size="base" weight="font-medium">
              SOL
            </Text>
          </div>
          <NumericFormat
            value={estimatedSOL}
            thousandsGroupStyle="thousand"
            thousandSeparator=","
            fixedDecimalScale
            decimalScale={6}
            displayType="text"
            renderText={(value) => (
              <Text size="5xl" textColor="text-gradient" weight="font-normal">
                {loadingTroves || loading ? (
                  <span className="inline-block w-28 h-6 rounded bg-white/10 animate-pulse" />
                ) : (
                  value
                )}
              </Text>
            )}
          />
        </div>
        <div className="flex items-center justify-end pr-4 gap-4 mt-10 md:mt-4">
          <TransactionButton
            loading={processLoading}
            className="w-full md:w-[375px] h-11"
            onClick={handleRedeem}
            text="Redeem"
            disabled={redeemDisabled}
            disabledText={
              redeemAmount <= 0
                ? "Enter the AUSD amount to redeem"
                : (maxRedeemableGross > 0 && redeemAmount > maxRedeemableGross)
                  ? "Exceeds single-transaction max redeemable"
                  : redeemAmount > Number(ausdBalance) / 1e18
                    ? "Insufficient aUSD balance"
                    : redeemAmount > 999
                      ? "Maximum 999 AUSD per redemption"
                      : "Calculating estimated SOL..."
            }
          />
        </div>
      </div>
    </section>
  );
};

export default RedeemTab;