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

  // Calculate estimated SOL to receive
  useEffect(() => {
    const calculateEstimatedSOL = async () => {
      if (!redeemAmount || !connection || redeemAmount <= 0) {
        setEstimatedSOL(0);
        return;
      }

      try {
        setLoading(true);

        // Fetch all troves
        const allTroves = await fetchAllTroves(connection as unknown as Connection, 'SOL');

        // Sort by ICR (ascending - lowest first)
        const sortedTroves = allTroves.sort((a, b) => {
          if (a.icr < b.icr) return -1;
          if (a.icr > b.icr) return 1;
          return 0;
        });

        // Select troves to redeem from (max 3)
        const MAX_TROVES = 3;
        const redeemAmountInSmallestUnit = BigInt(Math.floor(redeemAmount * 1e18));
        let remainingAmount = redeemAmountInSmallestUnit;
        let totalCollateralToReceive = BigInt(0);

        for (const trove of sortedTroves) {
          if (remainingAmount <= 0) break;
          if (trove.debt <= 0) continue;

          const redeemFromTrove = remainingAmount < trove.debt ? remainingAmount : trove.debt;

          // Calculate proportional collateral
          const collateralRatio = Number(redeemFromTrove) / Number(trove.debt);
          const collateralToReceive = BigInt(Math.floor(Number(trove.collateralAmount) * collateralRatio));

          totalCollateralToReceive += collateralToReceive;
          remainingAmount -= redeemFromTrove;
        }

        // Convert to SOL (divide by 1e9)
        const solAmount = Number(totalCollateralToReceive) / 1e9;
        setEstimatedSOL(solAmount);

      } catch (err) {
        console.error("Error calculating estimated SOL:", err);
        setEstimatedSOL(0);
      } finally {
        setLoading(false);
      }
    };

    calculateEstimatedSOL();
  }, [redeemAmount, connection]);

  const changeRedeemAmount = useCallback(
    (values: NumberFormatValues) => {
      setRedeemAmount(Number(values.value));
    },
    []
  );

  const redeemDisabled = useMemo(
    () =>
      isNil(redeemAmount) ||
      redeemAmount <= 0 ||
      redeemAmount > 999 ||
      redeemAmount > Number(ausdBalance) / 1e18 ||
      processLoading ||
      loading,
    [redeemAmount, ausdBalance, processLoading, loading]
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
            <img
              alt="sol"
              src="/images/token-images/sol.svg"
              className="w-6 h-6"
            />
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
                {loading ? "..." : value}
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