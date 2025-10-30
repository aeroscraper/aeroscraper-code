import SkeletonLoading from "@/components/Table/SkeletonLoading";
import Tabs from "@/components/Tabs";
import { motion } from "framer-motion";
import { isNil } from "lodash";
import React, { Dispatch, FC, useEffect, useRef, useState } from "react";
import ClaimRewardTab from "./Tabs/ClaimRewardTab";
import LeaderboardTab from "./Tabs/LeaderboardTab";
import RedeemTab from "./Tabs/RedeemTab";
import RiskyTrovesTabV1 from "./Tabs/RiskyTrovesTabV1";
import RiskyTrovesTabV2 from "./Tabs/RiskyTrovesTabV2";
import RiskyTrovesTabV3 from "./Tabs/RiskyTrovesTabV3";
import StabilityPoolTab from "./Tabs/StabilityPoolTab";
import TroveTab from "./Tabs/TroveTab";
import useChainAdapter from "@/hooks/useChainAdapter";
import { useRouter, useSearchParams } from "next/navigation";
import { AppVersion } from "@/types/types";
import Missions from "./Tabs/Missions";
import { usePageData } from "@/contexts/DashboardProvider";
import { useBalances } from "@/contexts/BalanceProvider";
import { ChainName } from "@/enums/Chain";

interface Props {
  setTabPosition: Dispatch<DashboardTabs>;
}

export type DashboardTabs =
  | "trove"
  | "createTrove"
  | "stabilityPool"
  | "redeem"
  | "riskyTroves"
  | "rewards"
  | "leaderboard"
  | "missions";
const TabsSide: FC<Props> = ({ setTabPosition }) => {
  // const { selectedChainName } = useChainAdapter();
  const router = useRouter();
  const params = useSearchParams();

  const ref = useRef<HTMLDivElement>(null);

  // const { basePrice, walletInfo, selectedAppVersion } = useChainAdapter();
  // const { pageData, getPageData, loading } = usePageData();
  // const { refreshBalance } = useBalances();

  const [isTroveOpened, setIsTroveOpened] = useState(false);

  let TabList: DashboardTabs[] = [
    isTroveOpened ? "trove" : "createTrove",
    "stabilityPool",
    "redeem",
    "riskyTroves",
    "rewards",
    // "leaderboard",
    // "missions",
  ];

  // if (
  //   selectedChainName === ChainName.XION ||
  //   selectedChainName === ChainName.SEI
  // ) {
  //   TabList = TabList.filter(
  //     (tab) => tab !== "missions" && tab !== "leaderboard"
  //   );
  // }

  const [selectedTab, setSelectedTab] = useState<DashboardTabs>(
    isTroveOpened ? "trove" : "createTrove"
  );

  // useEffect(() => {
  //   setIsTroveOpened(pageData.baseCollateralAmount > 0);

  //   if (selectedTab === "trove" || selectedTab === "createTrove") {
  //     setSelectedTab(
  //       pageData.baseCollateralAmount > 0 ? "trove" : "createTrove"
  //     );
  //   }
  // }, [pageData]);

  useEffect(() => {
    if (typeof window !== "undefined" && window?.innerWidth <= 768) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedTab]);

  useEffect(() => {
    if (params.get("tab")) {
      setSelectedTab(params.get("tab") as DashboardTabs);
    }
  }, []);

  const handleChangeTab = (e: DashboardTabs) => {
    router.push(`/app/dashboard?tab=${e}`);

    setSelectedTab(e);
    setTabPosition(e);
  };

  return (
    <div
      ref={ref}
      className="md:flex-1 md:max-w-[778px] px-3 md:px-0 md:ml-auto"
    >
      <Tabs
        tabs={TabList}
        // dots={pageData.rewardAmount > 0 ? ["rewards"] : undefined}
        selectedTab={selectedTab}
        onTabSelected={(e) => {
          handleChangeTab(e);
        }}
        // loading={loading}
      />
      {/* {loading ? (
        <>
          <div className="mt-16">
            <SkeletonLoading
              height={"h-10"}
              width={"w-1/2"}
              noPadding
              noMargin
            />
            <SkeletonLoading height={"h-6"} width={"w-1/3 mt-1"} noPadding />
            <SkeletonLoading
              height={"h-8"}
              width={"w-1/4 mt-8"}
              noPadding
              noMargin
            />
            <SkeletonLoading
              height={"h-36"}
              width={"w-full mt-4"}
              noPadding
              noMargin
            />
          </div>
          <div className="grid grid-cols-4 gap-20 mt-10">
            <SkeletonLoading height={"h-10"} noPadding />
            <SkeletonLoading height={"h-10"} noPadding />
            <SkeletonLoading height={"h-10"} noPadding />
            <SkeletonLoading height={"h-10"} noPadding />
          </div>
          <SkeletonLoading height={"h-10"} width="mt-4" noPadding />
          <SkeletonLoading height={"h-8"} width="mt-4 w-1/4" noPadding />
        </>
      ) : ( */}
      <motion.main
        key={selectedTab}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
        // className={`md:mt-6 ${isNil(walletInfo) ? "blur-[2px]" : ""} relative`}
      >
        {/* {isNil(walletInfo) && (
            <div className="cursor-not-allowed h-full w-full absolute top-0 bottom-0 left-0 z-50" />
          )}
          {isNil(walletInfo) && (
            <div className="cursor-not-allowed h-full w-full absolute top-0 bottom-0 left-0 z-50" />
          )} */}
        {(selectedTab === "trove" || selectedTab === "createTrove") && (
          <TroveTab />
        )}
        {selectedTab === "stabilityPool" && <StabilityPoolTab />}
        {selectedTab === "riskyTroves" && <RiskyTrovesTabV3 />}
        {selectedTab === "redeem" && <RedeemTab />}
        {selectedTab === "rewards" && <ClaimRewardTab />}
        {/*{selectedTab === "leaderboard" && <LeaderboardTab />}
        {selectedTab === "missions" && <Missions />} */}
      </motion.main>
      {/* )} */}
    </div>
  );
};

export default React.memo(TabsSide);
