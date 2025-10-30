import React, { FC, useEffect, useState } from "react";
import Text from "@/components/Texts/Text";
import { useNotification } from "@/contexts/NotificationProvider";
import { NumericFormat } from "react-number-format";
import TransactionButton from "@/components/Buttons/TransactionButton";
import { useAppKitAccount } from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import { useSolanaProtocol } from "@/hooks/useSolanaProtocol";
import { useProtocolState } from "@/hooks/useProtocolState";
import { PublicKey } from "@solana/web3.js";
import { fetchLiquidationGains } from "@/lib/solana/fetchLiquidationGains";
import { SolanaIcon } from "@/components/Icons/Icons";

const ClaimRewardTab: FC = () => {
  const { address, isConnected } = useAppKitAccount();
  const { connection } = useAppKitConnection();
  const { withdrawLiquidationGains, loading: protocolLoading } =
    useSolanaProtocol();
  const { protocolState } = useProtocolState();
  const { addNotification } = useNotification();

  const [liquidationGain, setLiquidationGain] = useState<bigint>(BigInt(0));

  // Fetch liquidation gains
  useEffect(() => {
    const fetchGains = async () => {
      if (!address || !connection || !protocolState) {
        setLiquidationGain(BigInt(0));
        return;
      }

      try {
        const userPublicKey = new PublicKey(address);
        const gain = await fetchLiquidationGains(
          connection,
          userPublicKey,
          "SOL"
        );
        setLiquidationGain(gain);
      } catch (err) {
        console.error("Error fetching liquidation gains:", err);
        setLiquidationGain(BigInt(0));
      }
    };

    fetchGains();
    const interval = setInterval(fetchGains, 5000);
    return () => clearInterval(interval);
  }, [address, connection, protocolState]);

  const rewardClaim = async () => {
    try {
      const signature = await withdrawLiquidationGains({
        collateralDenom: "SOL",
      });

      addNotification({
        status: "success",
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: `${Number(liquidationGain) / 1e9} SOL Reward Received`,
      });

      // Refresh liquidation gain amount after success
      if (address && connection) {
        const userPublicKey = new PublicKey(address);
        const gain = await fetchLiquidationGains(
          connection,
          userPublicKey,
          "SOL"
        );
        setLiquidationGain(gain);
      }
    } catch (err: any) {
      console.error(err);
      addNotification({
        message: err.message || "Failed to claim rewards",
        status: "error",
        directLink: "",
      });
    }
  };

  const rewardAmount = Number(liquidationGain) / 1e9; // Convert from lamports to SOL

  return (
    <section>
      <Text size="3xl">Claim your rewards in SOL</Text>
      <div className="mt-6">
        <div className="w-full bg-cetacean-dark-blue border border-white/10 rounded-xl md:rounded-2xl px-3 pt-4 pb-3 md:px-6 md:py-8 flex items-end justify-between mt-6">
          <div>
            <Text size="sm" weight="mb-2">
              Reward
            </Text>
            <div className="flex items-center gap-2">
              <SolanaIcon />
              <Text size="base" weight="font-medium">
                SOL
              </Text>
            </div>
          </div>
          <NumericFormat
            value={rewardAmount}
            thousandsGroupStyle="thousand"
            thousandSeparator=","
            fixedDecimalScale
            decimalScale={6}
            displayType="text"
            renderText={(value) => (
              <Text size="5xl" textColor="text-gradient" weight="font-normal">
                {value}
              </Text>
            )}
          />
        </div>
        <div className="flex items-center justify-end pr-4 gap-4 mt-10 md:mt-4">
          <TransactionButton
            loading={protocolLoading}
            disabled={liquidationGain === BigInt(0)}
            disabledText={"No rewards are available."}
            className="w-full md:w-[375px] h-11"
            onClick={() => {
              rewardClaim();
            }}
            text="Claim Rewards"
          />
        </div>
      </div>
    </section>
  );
};

export default ClaimRewardTab;
