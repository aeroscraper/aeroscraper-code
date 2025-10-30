import GradientButton from "@/components/Buttons/GradientButton";
import Text from "@/components/Texts/Text";
import { motion } from "framer-motion";
import React, {
  FC,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { NumberFormatValues } from "react-number-format/types/types";
import OutlinedButton from "@/components/Buttons/OutlinedButton";
import { useNotification } from "@/contexts/NotificationProvider";
import { convertAmount, getRatioColor } from "@/utils/contractUtils";
import { isNil } from "lodash";
import { PageData } from "../../_types/types";
import StatisticCard from "@/components/Cards/StatisticCard";
import BorderedNumberInput from "@/components/Input/BorderedNumberInput";
import Checkbox from "@/components/Checkbox";
import { NumericFormat } from "react-number-format";
import { CollateralAsset } from "@/types/types";
import { DefaultAssetByChainName } from "@/constants/assetConstants";
import { ChainName } from "@/enums/Chain";
import { useAppKitAccount, useAppKitBalance } from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import { SolanaIcon } from "@/components/Icons/Icons";
import { useSolanaProtocol } from "@/hooks/useSolanaProtocol";
import { PublicKey } from "@solana/web3.js";
import { useProtocolState } from "@/hooks/useProtocolState";
import { getPrice as getOraclePrice } from "@/lib/solana/getSolPriceInUsd";
import { validateSolBalance, validateCollateralBalance, validateAusdBalance } from "@/lib/solana/validateBalances";

// Preload dynamic imports for better performance
let splTokenLoaded = false;
const preloadSplToken = () => {
  if (!splTokenLoaded && typeof window !== "undefined") {
    import("@solana/spl-token").then(() => {
      splTokenLoaded = true;
    });
    import("@/lib/solana/fetchTroveState").then(() => {});
  }
};

enum TABS {
  COLLATERAL = 0,
  BORROWING,
}

type Props = {
  pageData?: PageData;
  getPageData?: () => void;
  basePrice?: number;
};

const TroveTab: FC<Props> = ({ pageData, getPageData, basePrice }) => {
  const selectedChainName = ChainName.SOLANA;
  const { fetchBalance } = useAppKitBalance();
  const { address, isConnected } = useAppKitAccount();
  const { connection } = useAppKitConnection();

  const [balance, setBalance] = useState<any | null>(null);
  const isVisibleRef = useRef(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trovePollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Preload modules on mount
  useEffect(() => {
    preloadSplToken();
  }, []);

  // Track visibility to pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Memoize fetchBalance to prevent unnecessary re-renders
  const fetchBalanceMemoized = useCallback(async () => {
    if (isConnected) {
      try {
        const res = await fetchBalance();
        setBalance(res);
      } catch (err) {
        console.error("Error fetching balance:", err);
      }
    }
  }, [isConnected, fetchBalance]);

  useEffect(() => {
    if (!isConnected) return;

    const loadBalance = async () => {
      const res = await fetchBalance();
      setBalance(res);
    };
    loadBalance();

    // only run when connection state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const baseMinCollateralRatio = 115;

  const formattedBalance = balance?.data?.formatted ?? "0.00";

  const [openTroveAmount, setOpenTroveAmount] = useState<number>(0);
  const [borrowAmount, setBorrowAmount] = useState<number>(0);
  const [collateralAmount, setCollateralAmount] = useState<number>(0);
  const [borrowingAmount, setBorrowingAmount] = useState<number>(0);
  const [selectedAsset] = useState<CollateralAsset>(
    DefaultAssetByChainName[selectedChainName ?? ChainName.INJECTIVE]
  );
  const [userTroveState, setUserTroveState] = useState<{
    collateralAmount: bigint;
    debt: bigint;
    icr: bigint;
  } | null>(null);
  const [selectedTab, setSelectedTab] = useState<TABS>(TABS.COLLATERAL);

  const { addNotification } = useNotification();
  const {
    openTrove,
    addCollateral,
    removeCollateral,
    borrowLoan,
    repayLoan,
    loading: processLoading,
  } = useSolanaProtocol();
  const { protocolState } = useProtocolState();

  const [ausdBalance, setAusdBalance] = useState<bigint>(BigInt(0));
  const [oracleSolPrice, setOracleSolPrice] = useState<number>(0);

  // Memoize selectedCollateral to prevent unnecessary re-renders (must be before borrowingCapacity)
  const selectedCollateral = useMemo(
    () =>
      userTroveState
        ? {
            amount: Number(userTroveState.collateralAmount) / 1e9, // Convert from lamports to SOL
            denom: selectedAsset.denom,
          }
        : { amount: 0, denom: selectedAsset.denom },
    [userTroveState, selectedAsset.denom]
  );

  // Memoize expensive convertAmount calculations to prevent recalculation on every render
  const solBalance = useMemo(() => {
    return Number(convertAmount(balance ?? 0, selectedAsset.decimal));
  }, [balance, selectedAsset.decimal]);

  const formattedSolBalance = useMemo(() => {
    return solBalance.toFixed(6);
  }, [solBalance]);

  const formattedAusdBalance = useMemo(() => {
    return (Number(ausdBalance) / 1e18).toFixed(2);
  }, [ausdBalance]);

  const formattedDebtAmount = useMemo(() => {
    return userTroveState
      ? (Number(userTroveState.debt) / 1e18).toFixed(2)
      : "0";
  }, [userTroveState]);

  const borrowingCapacity = useMemo(() => {
    if (!userTroveState || !basePrice) return 0;
    return (
      ((selectedCollateral.amount ?? 0) * basePrice * 100) / 115 -
      Number(userTroveState.debt) / 1e18
    );
  }, [selectedCollateral.amount, basePrice, userTroveState]);

  // Memoize management fee calculation
  const managementFee = useMemo(() => {
    return (collateralAmount * 0.005).toFixed(3);
  }, [collateralAmount]);

  // Memoize management fee for open trove
  const openTroveManagementFee = useMemo(() => {
    return (openTroveAmount * 0.005).toFixed(3);
  }, [openTroveAmount]);

  // Optimized refresh functions that can be called after transactions
  const refreshTroveState = useCallback(async () => {
    if (!address || !connection) return;
    try {
      const { fetchUserTroveState } = await import(
        "@/lib/solana/fetchTroveState"
      );
      const userPublicKey = new PublicKey(address);
      const trove = await fetchUserTroveState(connection, userPublicKey, "SOL");
      setUserTroveState(trove);
    } catch (err) {
      console.error("Error refreshing trove state:", err);
    }
  }, [address, connection]);

  const refreshAusdBalance = useCallback(async () => {
    if (!address || !connection || !protocolState) return;
    try {
      const { getAccount, getAssociatedTokenAddress } = await import(
        "@solana/spl-token"
      );
      const userPublicKey = new PublicKey(address);
      const userATA = await getAssociatedTokenAddress(
        protocolState.stablecoinMint,
        userPublicKey
      );
      const accountInfo = await getAccount(connection, userATA);
      setAusdBalance(accountInfo.amount);
    } catch (err) {
      setAusdBalance(BigInt(0));
    }
  }, [address, connection, protocolState]);

  const isTroveOpened = useMemo(
    () =>
      userTroveState !== null &&
      userTroveState.collateralAmount > 0 &&
      userTroveState.debt > 0,
    [userTroveState]
  );

  // Calculate collateral ratio for new troves (when opening trove)
  const collateralRatioCalculate = useMemo(() => {
    if (!borrowAmount || borrowAmount <= 0) return 0;
    //estimate SOL price
    const estimatedSolPrice = oracleSolPrice;
    // Convert SOL → USD
    const collateralValueUSD = (openTroveAmount || 0) * estimatedSolPrice;
    const debtValueUSD = borrowAmount;
    const ratio = (collateralValueUSD / debtValueUSD) * 100;
    return isFinite(ratio) ? ratio : 0;
  }, [openTroveAmount, borrowAmount, oracleSolPrice]);

  const collateralRatio = collateralRatioCalculate;

  // Calculate current ICR from trove state (ICR stored in micro-percent format: 115000000 = 115%)
  const currentICR = useMemo(() => {
    if (
      !userTroveState ||
      !userTroveState.icr ||
      userTroveState.debt === BigInt(0)
    )
      return 0;
    // ICR is stored in micro-percent format (115000000 = 115%)
    const icrValue = Number(userTroveState.icr);
    return icrValue / 1_000_000;
  }, [userTroveState]);

  // Validation for opening new trove - using memoized solBalance
  const confirmDisabled = useMemo(() => {
    return (
      borrowAmount <= 0 ||
      openTroveAmount <= 0 ||
      borrowAmount > 999 ||
      openTroveAmount > 999 ||
      collateralRatio < baseMinCollateralRatio ||
      openTroveAmount > solBalance
    );
  }, [
    openTroveAmount,
    borrowAmount,
    collateralRatio,
    solBalance,
    baseMinCollateralRatio,
  ]);

  // Memoize confirm button disabled text to prevent recalculation
  const confirmDisabledText = useMemo(() => {
    if (!confirmDisabled) return "";
    if (
      collateralRatio < baseMinCollateralRatio &&
      openTroveAmount > 0 &&
      borrowAmount > 0
    ) {
      return `Collateral ratio (${collateralRatio.toFixed(
        2
      )}%) must be at least ${baseMinCollateralRatio}%`;
    }
    return "Fill in both SOL and AUSD amounts. Ensure you have sufficient SOL balance and maintain at least 115% collateral ratio.";
  }, [
    confirmDisabled,
    collateralRatio,
    openTroveAmount,
    borrowAmount,
    baseMinCollateralRatio,
  ]);

  // Fetch aUSD balance - optimized with longer interval and visibility check
  useEffect(() => {
    if (!address || !connection || !protocolState) {
      setAusdBalance(BigInt(0));
      return;
    }

    const fetchAusdBalance = async () => {
      if (!isVisibleRef.current) return; // Skip if tab is hidden

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

    // Initial fetch
    fetchAusdBalance();

    // Poll every 15 seconds instead of 5 (less aggressive)
    pollingIntervalRef.current = setInterval(fetchAusdBalance, 15000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [address, connection, protocolState?.stablecoinMint]);

  // Fetch trove state - optimized with longer interval and visibility check
  useEffect(() => {
    if (!address || !connection) {
      setUserTroveState(null);
      return;
    }

    const fetchTroveState = async () => {
      if (!isVisibleRef.current) return; // Skip if tab is hidden

      try {
        const { fetchUserTroveState } = await import(
          "@/lib/solana/fetchTroveState"
        );
        const userPublicKey = new PublicKey(address);
        const trove = await fetchUserTroveState(
          connection,
          userPublicKey,
          "SOL"
        );
        setUserTroveState(trove);
      } catch (err) {
        console.error("Error fetching trove state:", err);
        setUserTroveState(null);
      }
    };

    // Initial fetch
    fetchTroveState();

    // Refresh every 15 seconds instead of 5 (less aggressive)
    trovePollingIntervalRef.current = setInterval(fetchTroveState, 15000);

    return () => {
      if (trovePollingIntervalRef.current) {
        clearInterval(trovePollingIntervalRef.current);
      }
    };
  }, [address, connection]);

  // Fetch  SOL price for UI calculations
  useEffect(() => {
    const fetchOraclePrice = async () => {
      if (!connection) return;

      try {
        const price = await getOraclePrice("SOL");
        if (Number.isFinite(price) && price > 0) {
          setOracleSolPrice(price);
        }
      } catch (error) {
        console.error("Error fetching oracle SOL price:", error);
      }
    };

    fetchOraclePrice();
  }, [connection]);
  const withdrawDisabled = useMemo(
    () =>
      collateralAmount <= 0 ||
      collateralAmount > 999 ||
      selectedCollateral.amount < collateralAmount,
    [collateralAmount, selectedCollateral]
  );
  const depositDisabled = useMemo(
    () =>
      collateralAmount <= 0 ||
      collateralAmount > 999 ||
      solBalance < collateralAmount,
    [collateralAmount, solBalance]
  );
  const borrowDisabled = useMemo(
    () => borrowingAmount <= 0 || borrowingAmount > 999 || !userTroveState,
    [borrowingAmount, userTroveState]
  );

  const repayDisabled = useMemo(
    () =>
      borrowingAmount <= 0 || // Changed from repaymentAmount
      borrowingAmount > 999 || // Changed from repaymentAmount
      !userTroveState,
    [borrowingAmount, userTroveState] // Changed from repaymentAmount
  );

  // Optimized handlers with useCallback to prevent recreation on every render
  const changeOpenTroveAmount = useCallback((values: NumberFormatValues) => {
    const newValue = Number(values.value || 0);
    setOpenTroveAmount(newValue);
  }, []);

  const changeBorrowAmount = useCallback((values: NumberFormatValues) => {
    const newValue = Number(values.value || 0);
    setBorrowAmount(newValue);
  }, []);

  const changeCollateralAmount = useCallback((values: NumberFormatValues) => {
    const newValue = Number(values.value || 0);
    setCollateralAmount(newValue);
  }, []);

  const changeBorrowingAmount = useCallback((values: NumberFormatValues) => {
    const newValue = Number(values.value || 0);
    setBorrowingAmount(newValue);
  }, []);

  // Handlers for tab changes - must be at top level, not inline in JSX
  const handleCollateralTabChange = useCallback(() => {
    setSelectedTab(TABS.COLLATERAL);
  }, []);

  const handleBorrowingTabChange = useCallback(() => {
    setSelectedTab(TABS.BORROWING);
  }, []);

  const handleOpenTrove = async () => {
    try {
      if (!address || !connection || !protocolState) {
        throw new Error("Wallet not connected or protocol state not loaded");
      }

      const userPublicKey = new PublicKey(address);
      
      // Convert SOL to lamports (9 decimals)
      const collateralInLamports = openTroveAmount * 1_000_000_000;
      // Convert aUSD to base units (18 decimals)
      const loanAmountStr = (borrowAmount * Math.pow(10, 18)).toString();

      // Validate balances before transaction
      await validateSolBalance(connection, userPublicKey);
      await validateCollateralBalance(connection, userPublicKey, protocolState.collateralMint, collateralInLamports);

      const signature = await openTrove({
        collateralAmount: collateralInLamports,
        loanAmount: loanAmountStr,
      });

      addNotification({
        status: "success",
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: "Trove Opened Successfully",
      });

      // Reset form
      setOpenTroveAmount(0);
      setBorrowAmount(0);

      // Refresh data immediately after success
      await Promise.all([refreshTroveState(), refreshAusdBalance()]);
      getPageData?.();
    } catch (err: any) {
      addNotification({
        status: "error",
        message: err.message || "Failed to open trove",
        directLink: "",
      });
      console.error(err);
    }
  };

  const handleAddCollateral = async () => {
    try {
      if (!address || !connection || !protocolState) {
        throw new Error("Wallet not connected or protocol state not loaded");
      }

      const userPublicKey = new PublicKey(address);
      
      // Convert SOL to lamports (9 decimals)
      const collateralInLamports = collateralAmount * 1_000_000_000;

      // Validate balances before transaction
      await validateSolBalance(connection, userPublicKey);
      await validateCollateralBalance(connection, userPublicKey, protocolState.collateralMint, collateralInLamports);

      const signature = await addCollateral({
        collateralAmount: collateralInLamports,
      });

      addNotification({
        status: "success",
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: `${collateralAmount} SOL Collateral Added`,
      });

      // Reset form
      setCollateralAmount(0);

      // Refresh data immediately after success
      await Promise.all([refreshTroveState(), refreshAusdBalance()]);
    } catch (err: any) {
      addNotification({
        status: "error",
        message: err.message || "Failed to add collateral",
        directLink: "",
      });
      console.error(err);
    }
  };

  const handleRemoveCollateral = async () => {
    try {
      if (!address || !connection) {
        throw new Error("Wallet not connected");
      }

      const userPublicKey = new PublicKey(address);
      
      // Convert SOL to lamports (9 decimals)
      const collateralInLamports = collateralAmount * 1_000_000_000;

      // Validate SOL balance for transaction fees
      await validateSolBalance(connection, userPublicKey);

      const signature = await removeCollateral({
        collateralAmount: collateralInLamports,
      });

      addNotification({
        status: "success",
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: `${collateralAmount} SOL Collateral Removed`,
      });

      // Reset form
      setCollateralAmount(0);

      // Refresh data immediately after success
      await Promise.all([refreshTroveState(), refreshAusdBalance()]);
    } catch (err: any) {
      addNotification({
        status: "error",
        message: err.message || "Failed to remove collateral",
        directLink: "",
      });
      console.error(err);
    }
  };

  const handleBorrowLoan = async () => {
    try {
      if (!address || !connection) {
        throw new Error("Wallet not connected");
      }

      const userPublicKey = new PublicKey(address);
      
      // Convert AUSD to smallest unit (18 decimals)
      const loanInSmallestUnit = Math.floor(borrowingAmount * 1e18);

      // Validate SOL balance for transaction fees
      await validateSolBalance(connection, userPublicKey);

      const signature = await borrowLoan({
        loanAmount: loanInSmallestUnit,
      });

      addNotification({
        status: "success",
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: `${borrowingAmount} AUSD Borrowed Successfully`,
      });

      // Reset form
      setBorrowingAmount(0);

      // Refresh data immediately after success
      await Promise.all([refreshTroveState(), refreshAusdBalance()]);
    } catch (err: any) {
      addNotification({
        status: "error",
        message: err.message || "Failed to borrow loan",
        directLink: "",
      });
      console.error(err);
    }
  };

  const handleRepayLoan = async () => {
    try {
      if (!address || !connection || !protocolState) {
        throw new Error("Wallet not connected or protocol state not loaded");
      }

      const userPublicKey = new PublicKey(address);
      
      // Convert AUSD to smallest unit (18 decimals)
      const repayInSmallestUnit = Math.floor(borrowingAmount * 1e18);

      // Validate balances before transaction
      await validateSolBalance(connection, userPublicKey);
      await validateAusdBalance(connection, userPublicKey, protocolState.stablecoinMint, repayInSmallestUnit);

      const signature = await repayLoan({
        repayAmount: repayInSmallestUnit,
      });

      addNotification({
        status: "success",
        directLink: `https://solscan.io/tx/${signature}?cluster=devnet`,
        message: `${borrowingAmount} AUSD Repaid Successfully`,
      });

      // Reset form
      setBorrowingAmount(0);

      // Refresh data immediately after success
      await Promise.all([refreshTroveState(), refreshAusdBalance()]);
    } catch (err: any) {
      addNotification({
        status: "error",
        message: err.message || "Failed to repay loan",
        directLink: "",
      });
      console.error(err);
    }
  };

  return (
    <div className="overflow-hidden md:overflow-visible">
      {isTroveOpened ? (
        <>
          <Text size="3xl">Manage your collateral</Text>
          <Text size="base" weight="font-regular" className="mt-1">
            Mint AUSD or repay your debt.
          </Text>
          <div className="flex flex-col mt-8">
            <Checkbox
              label={"Collateral"}
              checked={selectedTab === TABS.COLLATERAL}
              onChange={handleCollateralTabChange}
            />
            {selectedTab === TABS.COLLATERAL && (
              <motion.div
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -100 }}
                transition={{ duration: 0.3, ease: "easeIn" }}
                className="flex flex-col mt-6"
              >
                <div className="w-full bg-cetacean-dark-blue border backdrop-blur-[37px] border-white/10 rounded-xl md:rounded-2xl px-3 pt-4 pb-3 md:px-6 md:py-8 flex flex-col gap-4 md:mt-6">
                  <div className="flex items-center md:items-end justify-between">
                    <div>
                      {!isNil(selectedAsset) ? (
                        <div className="flex items-center gap-2">
                          {/* <img
                            alt="token"
                            src={selectedAsset.imageURL}
                            className="w-6 h-6"
                          /> */}
                          <SolanaIcon />
                          <Text size="base" weight="font-medium">
                            {selectedAsset.shortName}
                          </Text>
                        </div>
                      ) : (
                        <Text
                          size="2xl"
                          weight="font-medium"
                          className="flex-1 text-center"
                        >
                          -
                        </Text>
                      )}
                    </div>
                    <BorderedNumberInput
                      value={collateralAmount}
                      onValueChange={changeCollateralAmount}
                      containerClassName="h-10 text-end flex-1 ml-6"
                      bgVariant="blue"
                      className="text-end"
                    />
                  </div>
                  <div className="flex justify-between md:mt-6">
                    <div className="flex">
                      <label className="font-regular text-xs md:text-base text-gray-300">
                        In Wallet:
                      </label>
                      <NumericFormat
                        value={formattedSolBalance}
                        thousandsGroupStyle="thousand"
                        thousandSeparator=","
                        fixedDecimalScale
                        decimalScale={4}
                        displayType="text"
                        renderText={(value) => (
                          <p className="text-white font-regular text-xs md:text-base ml-3">
                            {value} {selectedAsset.shortName}
                          </p>
                        )}
                      />
                    </div>
                    <div className="flex">
                      <label className="font-regular text-xs md:text-base text-gray-300">
                        In Trove Balance:
                      </label>
                      <NumericFormat
                        value={selectedCollateral.amount}
                        thousandsGroupStyle="thousand"
                        thousandSeparator=","
                        fixedDecimalScale
                        decimalScale={4}
                        displayType="text"
                        renderText={(value) => (
                          <p className="text-white font-regular text-xs md:text-base ml-3">
                            {value} {selectedAsset.shortName}
                          </p>
                        )}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-20 md:gap-6 gap-y-4 mt-4 md:mt-0 md:p-4">
                  <StatisticCard
                    title="Management Fee"
                    description={`${managementFee} ${
                      selectedAsset?.shortName ?? ""
                    } (0.5%)`}
                    tooltip="This amount is deducted from the collateral amount as a management fee. There are no recurring fees for borrowing, which is thus interest-free."
                  />

                  <StatisticCard
                    title="Total Debt"
                    description={`${formattedDebtAmount} AUSD`}
                    tooltip="The total amount of AUSD you have borrowed"
                  />
                  <StatisticCard
                    title="Collateral Ratio"
                    description={`${currentICR.toFixed(2)} %`}
                    descriptionColor={
                      currentICR > 0 ? getRatioColor(currentICR) : undefined
                    }
                    tooltip="The ratio between the dollar value of the collateral and the debt (in AUSD). Must be above 115% to avoid liquidation."
                  />
                </div>
                <div className="flex items-center justify-end pr-4 gap-4 mt-10 md:mt-4">
                  <OutlinedButton
                    disabled={withdrawDisabled}
                    disabledText={
                      "Enter the SOL amount. Cannot withdraw below minimum collateral ratio (115%)."
                    }
                    loading={processLoading}
                    onClick={handleRemoveCollateral}
                    className="min-w-[136px] md:min-w-[201px] h-11"
                  >
                    <Text>Withdraw</Text>
                  </OutlinedButton>
                  <GradientButton
                    disabled={depositDisabled}
                    disabledText={
                      "Enter the SOL amount. Ensure you have sufficient collateral tokens in your wallet."
                    }
                    loading={processLoading}
                    onClick={handleAddCollateral}
                    className="min-w-[176px] md:min-w-[374px] h-11"
                    rounded="rounded-lg"
                  >
                    <Text>Deposit</Text>
                  </GradientButton>
                </div>
              </motion.div>
            )}
            <Checkbox
              label={"Borrow/Repay"}
              checked={selectedTab === TABS.BORROWING}
              onChange={handleBorrowingTabChange}
              className="mt-8"
            />
            {selectedTab === TABS.BORROWING && (
              <motion.div
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -100 }}
                transition={{ duration: 0.3, ease: "easeIn" }}
                className="flex flex-col"
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
                      value={borrowingAmount}
                      onValueChange={changeBorrowingAmount}
                      containerClassName="h-10 text-end flex-1 ml-6"
                      bgVariant="blue"
                      className="text-end"
                    />
                  </div>
                  <div className="flex justify-between md:mt-6">
                    <div className="flex">
                      <label className="font-regular text-[10px] md:text-base text-gray-300">
                        In Wallet:
                      </label>
                      <NumericFormat
                        value={formattedAusdBalance}
                        thousandsGroupStyle="thousand"
                        thousandSeparator=","
                        fixedDecimalScale
                        decimalScale={2}
                        displayType="text"
                        renderText={(value) => (
                          <p className="text-white font-regular text-xs md:text-base ml-1 md:ml-3">
                            {value} AUSD
                          </p>
                        )}
                      />
                    </div>

                    <div className="flex">
                      <label className="font-regular text-[10px] md:text-base text-gray-300">
                        Borrowing Capacity:
                      </label>
                      <NumericFormat
                        value={borrowingCapacity}
                        thousandsGroupStyle="thousand"
                        thousandSeparator=","
                        fixedDecimalScale
                        decimalScale={2}
                        displayType="text"
                        renderText={(value) => (
                          <p className="text-white font-regular text-xs md:text-base ml-1 md:ml-3">
                            {value} AUSD
                          </p>
                        )}
                      />
                    </div>
                    <div className="flex">
                      <label className="font-regular text-[10px] md:text-base text-gray-300">
                        Debt:
                      </label>
                      <NumericFormat
                        value={formattedDebtAmount}
                        thousandsGroupStyle="thousand"
                        thousandSeparator=","
                        fixedDecimalScale
                        decimalScale={2}
                        displayType="text"
                        renderText={(value) => (
                          <p className="text-white font-regular text-xs md:text-base ml-1 md:ml-3">{`${value} AUSD`}</p>
                        )}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 gap-y-4 p-4">
                  <div></div>
                  <div></div>
                  <StatisticCard
                    title="Collateral Ratio"
                    description={`${currentICR.toFixed(2)} %`}
                    descriptionColor={
                      currentICR > 0 ? getRatioColor(currentICR) : undefined
                    }
                    tooltip="The ratio between the dollar value of the collateral and the debt (in AUSD). Must be above 115% to avoid liquidation."
                  />
                </div>
                <div className="flex items-center justify-end pr-4 gap-4 mt-6">
                  <OutlinedButton
                    disabled={repayDisabled}
                    disabledText={"Enter the AUSD amount to repay."}
                    loading={processLoading}
                    onClick={handleRepayLoan}
                    className="min-w-[142px] md:min-w-[201px] h-11"
                    rounded="lg"
                  >
                    <Text>Repay</Text>
                  </OutlinedButton>
                  <GradientButton
                    disabled={borrowDisabled}
                    disabledText={
                      "Enter the AUSD amount. Borrowing must keep ICR above 115%."
                    }
                    loading={processLoading}
                    onClick={handleBorrowLoan}
                    className="min-w-[176px] md:min-w-[375px] h-11"
                    rounded="rounded-lg"
                  >
                    <Text>Borrow</Text>
                  </GradientButton>
                </div>
              </motion.div>
            )}
          </div>
        </>
      ) : (
        <div>
          <Text size="3xl">Borrow AUSD</Text>
          <Text size="base" weight="font-regular" className="mt-1">
            Open a trove to borrow AUSD, Aeroscraper’s native stable coin.
          </Text>
          <div className="w-full bg-cetacean-dark-blue border backdrop-blur-[37px] border-white/10 rounded-xl md:rounded-2xl px-3 pt-4 pb-4 md:px-6 md:pt-8 flex flex-col gap-4 mt-6">
            <div className="flex items-end justify-between">
              <div>
                <Text size="sm" weight="mb-2">
                  Collateral
                </Text>
                {!isNil(selectedAsset) ? (
                  <div className="flex items-center gap-2">
                    <SolanaIcon />
                    <Text size="base" weight="font-medium">
                      {selectedAsset.shortName}
                    </Text>
                  </div>
                ) : (
                  <Text
                    size="2xl"
                    weight="font-medium"
                    className="flex-1 text-center"
                  >
                    -
                  </Text>
                )}
              </div>
              <BorderedNumberInput
                value={openTroveAmount}
                onValueChange={changeOpenTroveAmount}
                containerClassName="h-10 text-end flex-1 ml-6"
                bgVariant="blue"
                className="text-end"
              />
            </div>
            <div className="flex mt-1">
              <label className="font-regular text-xs md:text-base text-gray-300">
                In Wallet:
              </label>
              <NumericFormat
                value={formattedSolBalance}
                thousandsGroupStyle="thousand"
                thousandSeparator=","
                fixedDecimalScale
                decimalScale={4}
                displayType="text"
                renderText={(value) => (
                  <p className="text-white font-regular text-xs md:text-base ml-3">
                    {value} {selectedAsset.shortName}
                  </p>
                )}
              />
            </div>
          </div>
          <div className="w-full bg-cetacean-dark-blue border backdrop-blur-[37px] border-white/10 rounded-xl md:rounded-2xl px-3 pt-4 pb-3 md:px-6 md:py-8 flex flex-col gap-4 mt-6">
            <div className="flex items-end justify-between">
              <div>
                <Text size="sm" weight="mb-2">
                  Borrow
                </Text>
                <div className="flex items-center gap-2 mb-2">
                  <img
                    alt="ausd"
                    className="w-6 h-6"
                    src="/images/token-images/ausd-blue.svg"
                  />
                  <Text size="base" weight="font-medium">
                    AUSD
                  </Text>
                </div>
              </div>
              <BorderedNumberInput
                value={borrowAmount}
                onValueChange={changeBorrowAmount}
                containerClassName="h-10 text-end flex-1 ml-6"
                bgVariant="blue"
                className="text-end"
              />
            </div>
            <div className="flex mt-1">
              <label className="font-regular text-xs md:text-base text-gray-300">
                In Wallet:
              </label>
              <NumericFormat
                value={formattedAusdBalance}
                thousandsGroupStyle="thousand"
                thousandSeparator=","
                fixedDecimalScale
                decimalScale={2}
                displayType="text"
                renderText={(value) => (
                  <p className="text-white font-regular text-xs md:text-base ml-3">
                    {value} AUSD
                  </p>
                )}
              />
            </div>
          </div>
          <motion.div
            initial={{ y: 50, x: 50, opacity: 0.1 }}
            animate={{ y: 0, x: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 150,
              damping: 25,
              delay: 0.1,
            }}
            className="grid grid-cols-2 md:grid-cols-3 content-center md:gap-16 mt-8"
          >
            <StatisticCard
              title="Management Fee"
              isNumeric
              description={`${openTroveManagementFee} ${
                selectedAsset?.shortName ?? ""
              } (0.5%)`}
              className="w-full h-14"
              tooltip="This amount is deducted from the collateral amount as a management fee. There are no recurring fees for borrowing, which is thus interest-free."
            />
            <StatisticCard
              title="Total Debt"
              isNumeric
              description={`${borrowAmount} AUSD`}
              className="w-full h-14"
              tooltip="The total amount of AUSD you have borrowed"
            />
            <StatisticCard
              title="Collateral Ratio"
              description={`${collateralRatio.toFixed(2)} %`}
              descriptionColor={
                collateralRatio > 0 ? getRatioColor(collateralRatio) : undefined
              }
              className="w-full h-14"
              tooltip="The ratio between the dollar value of the collateral and the debt (in AUSD). Must be above 115% to open a trove."
            />
          </motion.div>
          <div className="flex items-center justify-end pr-4 gap-4 mt-10 md:mt-4">
            <GradientButton
              loading={processLoading}
              onClick={handleOpenTrove}
              className="min-w-full md:min-w-[375px] h-11 "
              rounded="rounded-lg"
              disabled={confirmDisabled}
              disabledText={confirmDisabledText}
            >
              <Text>Confirm</Text>
            </GradientButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default TroveTab;
