import GradientButton from "@/components/Buttons/GradientButton";
import Text from "@/components/Texts/Text";
import React, { FC, useEffect, useMemo, useState } from "react";
import { NumericFormat } from "react-number-format";
import { motion } from "framer-motion";
import Checkbox from "@/components/Checkbox";
import BorderedNumberInput from "@/components/Input/BorderedNumberInput";
import { useNotification } from "@/contexts/NotificationProvider";
import { useAppKitAccount } from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import { PublicKey } from "@solana/web3.js";
import { useSolanaProtocol } from "@/hooks/useSolanaProtocol";
import { useProtocolState } from "@/hooks/useProtocolState";
import { validateSolBalance, validateAusdBalance } from "@/lib/solana/validateBalances";

enum TABS {
  DEPOSIT = 0,
  WITHDRAW,
}

const StabilityPoolTab: FC = () => {
  const { addNotification } = useNotification();
  const { address, isConnected } = useAppKitAccount();
  const { connection } = useAppKitConnection();
  const { stake, unstake, loading: protocolLoading } = useSolanaProtocol();
  const { protocolState } = useProtocolState();

  const [selectedTab, setSelectedTab] = useState<TABS>(TABS.DEPOSIT);

  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [unstakeAmount, setUnstakeAmount] = useState<number>(0);

  const [totalStakeAmount, setTotalStakeAmount] = useState<bigint>(BigInt(0));

  const [ausdBalance, setAusdBalance] = useState<bigint>(BigInt(0));
  const [compoundedStake, setCompoundedStake] = useState<bigint>(BigInt(0));

  // Fetch stake state and balance
  useEffect(() => {
    const fetchStakeData = async () => {
      if (!address || !connection || !protocolState) {
        setAusdBalance(BigInt(0));
        setCompoundedStake(BigInt(0));
        setTotalStakeAmount(BigInt(0));
        return;
      }

      try {
        // Fetch user stake state
        const { fetchUserStakeState } = await import("@/lib/solana/fetchStakeState");
        const userPublicKey = new PublicKey(address);
        const stakeState = await fetchUserStakeState(connection, userPublicKey);

        if (stakeState) {
          setCompoundedStake(stakeState.compounded_stake);
        } else {
          setCompoundedStake(BigInt(0));
        }

        // Get total stake amount from protocol state
        setTotalStakeAmount(protocolState.totalStakeAmount || BigInt(0));

        // Fetch aUSD balance
        const { getAccount, getAssociatedTokenAddress } = await import("@solana/spl-token");
        const userATA = await getAssociatedTokenAddress(protocolState.stablecoinMint, userPublicKey);

        try {
          const accountInfo = await getAccount(connection, userATA);
          setAusdBalance(accountInfo.amount);
        } catch (err) {
          setAusdBalance(BigInt(0));
        }
      } catch (err) {
        console.error("Error fetching stake state:", err);
        setAusdBalance(BigInt(0));
        setCompoundedStake(BigInt(0));
        setTotalStakeAmount(BigInt(0));
      }
    };

    fetchStakeData();
    const interval = setInterval(fetchStakeData, 5000);
    return () => clearInterval(interval);
  }, [address, connection, protocolState]);

  const stakeDisabled = useMemo(
    () =>
      stakeAmount <= 0 ||
      stakeAmount > 999 ||
      BigInt(Math.floor(stakeAmount * 1e18)) > ausdBalance,
    [stakeAmount, ausdBalance]
  );

  const unstakeDisabled = useMemo(
    () =>
      unstakeAmount <= 0 ||
      unstakeAmount > 999 ||
      BigInt(Math.floor(unstakeAmount * 1e18)) > compoundedStake,
    [unstakeAmount, compoundedStake]
  );

  const poolShare = useMemo(() => {
    if (totalStakeAmount === BigInt(0) || compoundedStake === BigInt(0)) {
      return 0;
    }
    return (Number(compoundedStake) / Number(totalStakeAmount)) * 100;
  }, [compoundedStake, totalStakeAmount]);

  const stakePool = async () => {
    try {
      if (!address || !connection || !protocolState) {
        throw new Error("Wallet not connected or protocol state not loaded");
      }

      const userPublicKey = new PublicKey(address);
      
      // Convert stakeAmount to smallest unit (1e18)
      const stakeInSmallestUnit = Math.floor(stakeAmount * 1e18);

      // Validate balances before transaction
      await validateSolBalance(connection, userPublicKey);
      await validateAusdBalance(connection, userPublicKey, protocolState.stablecoinMint, stakeInSmallestUnit);

      const signature = await stake({
        stakeAmount: stakeInSmallestUnit,
      });

      addNotification({
        status: "success",
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: `${stakeAmount} AUSD Staked to Stability Pool`,
      });

      setStakeAmount(0);
    } catch (err: any) {
      addNotification({
        status: "error",
        message: err.message || "Failed to stake",
        directLink: "",
      });
      console.error(err);
    }
  };

  const unStakePool = async () => {
    try {
      if (!address || !connection) {
        throw new Error("Wallet not connected");
      }

      const userPublicKey = new PublicKey(address);
      
      // Convert unstakeAmount to smallest unit (1e18)
      const unstakeInSmallestUnit = Math.floor(unstakeAmount * 1e18);

      // Validate SOL balance for transaction fees
      await validateSolBalance(connection, userPublicKey);

      const signature = await unstake({
        unstakeAmount: unstakeInSmallestUnit,
      });

      addNotification({
        status: "success",
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: `${unstakeAmount} AUSD Withdrawn from Stability Pool`,
      });

      setUnstakeAmount(0);

      // Refresh state immediately
      if (connection && address && protocolState) {
        const { fetchUserStakeState } = await import("@/lib/solana/fetchStakeState");
        const userPublicKey = new PublicKey(address);
        const updatedStake = await fetchUserStakeState(connection, userPublicKey);

        if (updatedStake) {
          setCompoundedStake(updatedStake.compounded_stake);
        } else {
          setCompoundedStake(BigInt(0));
        }

        // Refresh aUSD balance
        const { getAccount, getAssociatedTokenAddress } = await import("@solana/spl-token");
        const userATA = await getAssociatedTokenAddress(protocolState.stablecoinMint, userPublicKey);
        try {
          const accountInfo = await getAccount(connection, userATA);
          setAusdBalance(accountInfo.amount);
        } catch (err) {
          setAusdBalance(BigInt(0));
        }
      }
    } catch (err: any) {
      addNotification({
        status: "error",
        message: err.message || "Failed to unstake",
        directLink: "",
      });
      console.error(err);
    }
  };

  return (
    <div className="overflow-hidden md:overflow-visible">
      <Text size="3xl">Add to stability pool to earn rewards</Text>
      <Text size="base" weight="font-regular" className="mt-1 mb-8">
        Deposit or Withdraw AUSD from your wallet to the Aeroscraper protocol to
        earn rewards.{" "}
      </Text>
      <div className="flex flex-col">
        {/* Always show deposit tab */}
        <Checkbox
          label={"Deposit"}
          checked={selectedTab === TABS.DEPOSIT}
          onChange={() => {
            setSelectedTab(TABS.DEPOSIT);
          }}
        />
        {selectedTab === TABS.DEPOSIT && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3, ease: "easeIn" }}
          >
            <div className="w-full bg-cetacean-dark-blue border backdrop-blur-[37px] border-white/10 rounded-xl md:rounded-2xl px-3 pt-4 pb-3 md:px-6 md:py-8 flex flex-col gap-4 mt-6">
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
                  value={stakeAmount}
                  onValueChange={(e) => {
                    setStakeAmount(Number(e.value));
                  }}
                  containerClassName="h-10 text-end flex-1 ml-6"
                  bgVariant="blue"
                  className="text-end"
                />
              </div>
              <div className="flex justify-between mt-6">
                <div className="flex text-white">
                  <label className="font-regular text-xs md:text-base">
                    Pool Share:
                  </label>
                  <p className="font-regular text-sm md:text-base ml-3">
                    {poolShare.toFixed(2)}%
                  </p>
                </div>
                <NumericFormat
                  value={Number(ausdBalance) / 1e18}
                  thousandsGroupStyle="thousand"
                  thousandSeparator=","
                  fixedDecimalScale
                  decimalScale={2}
                  displayType="text"
                  renderText={(value) => (
                    <Text size="base" className="flex ml-2 gap-2">
                      Available Balance: {value} AUSD
                    </Text>
                  )}
                />
              </div>
            </div>
            <div className="flex items-center justify-end pr-4 gap-4 mt-10 md:mt-4">
              <GradientButton
                disabled={stakeDisabled}
                disabledText={
                  "Enter the AUSD amount. 999 AUSD is the upper limit for now."
                }
                loading={protocolLoading}
                onClick={stakePool}
                className="w-[240px] md:w-[374px] h-11 "
                rounded="rounded-lg"
              >
                <Text>Deposit</Text>
              </GradientButton>
            </div>
          </motion.div>
        )}
        {compoundedStake > BigInt(0) && (
          <Checkbox
            label={"Withdraw"}
            checked={selectedTab === TABS.WITHDRAW}
            onChange={() => {
              setSelectedTab(TABS.WITHDRAW);
            }}
            className="mt-8"
          />
        )}
        {selectedTab === TABS.WITHDRAW && (
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3, ease: "easeIn" }}
          >
            <div className="w-full bg-cetacean-dark-blue border backdrop-blur-[37px] border-white/10 rounded-xl md:rounded-2xl px-3 pt-4 pb-3 md:px-6 md:py-8 flex flex-col gap-4 mt-6">
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
                  value={unstakeAmount}
                  onValueChange={(e) => {
                    setUnstakeAmount(Number(e.value));
                  }}
                  containerClassName="h-10 text-end flex-1 ml-6"
                  bgVariant="blue"
                  className="text-end"
                />
              </div>
              <div className="flex justify-between mt-6">
                <div className="flex text-white">
                  <label className="font-regular text-xs md:text-base">
                    Pool Share:
                  </label>
                  <p className="font-regular text-sm md:text-base ml-3">
                    {poolShare.toFixed(2)}%
                  </p>
                </div>
                <NumericFormat
                  value={Number(compoundedStake) / 1e18}
                  thousandsGroupStyle="thousand"
                  thousandSeparator=","
                  fixedDecimalScale
                  decimalScale={2}
                  displayType="text"
                  renderText={(value) => (
                    <Text size="base" className="flex ml-2 gap-2">
                      Available Balance: {value} AUSD
                    </Text>
                  )}
                />
              </div>
            </div>
            <div className="flex items-center justify-end pr-4 gap-4 mt-10 md:mt-4">
              <GradientButton
                disabled={unstakeDisabled}
                disabledText={
                  "Enter the AUSD amount. 999 AUSD is the upper limit for now."
                }
                loading={protocolLoading}
                onClick={unStakePool}
                className="min-w-[240px] md:w-[374px] h-11 "
                rounded="rounded-lg"
              >
                <Text>Withdraw</Text>
              </GradientButton>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default StabilityPoolTab;
