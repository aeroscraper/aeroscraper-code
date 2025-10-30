import StatisticCard from "@/components/Cards/StatisticCard";
import { ChevronUpIcon } from "@/components/Icons/Icons";
import useIsMobile from "@/hooks/useIsMobile";
import useChainAdapter from "@/hooks/useChainAdapter";
import { motion } from "framer-motion";
import { isNil } from "lodash";
import Link from "next/link";
import React, { FC, useEffect, useState } from "react";
// import { usePageData } from "@/contexts/DashboardProvider";
import { ChainName } from "@/enums/Chain";
import RenderContent from "./renderContent";
import { defaultContent, injContent } from "@/data/injContent";

interface Props {
  basePrice: number;
}

const INTERVAL_TIME = 8000;

const StatisticSide: FC<Props> = ({ basePrice }) => {
  const isMobile = useIsMobile();
  const selectedChainName = ChainName.SOLANA;
  // const { baseCoin, walletInfo, selectedChainName } = useChainAdapter();
  const [showStatistic, setShowStatistic] = useState<boolean>(true);
  const [content, setContent] = useState(defaultContent);
  // useEffect(() => {
  //   setContent(
  //     ChainName.SOLANA === selectedChainName ? injContent : defaultContent
  //   );
  // }, [selectedChainName]);
  // const { pageData } = usePageData();
  const [showContentIdx, setShowContentIdx] = useState(0);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    isMobile && setShowStatistic(false);
  }, [isMobile]);
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (!hovering) {
      timer = setInterval(() => {
        setShowContentIdx((prev) =>
          prev + 1 === content.length ? 0 : prev + 1
        );
      }, INTERVAL_TIME);
    }

    return () => {
      clearInterval(timer);
    };
  }, [hovering]);

  const handleHover = (isHovering: boolean) => {
    setHovering(isHovering);
  };

  // console.log(
  //   "Coin Name",
  //   baseCoin?.name,
  //   Number(pageData.baseTotalCollateralAmount).toFixed(6) + " " + baseCoin?.name
  // );

  return (
    <div
      className="md:max-w-[400px] w-full md:w-[379px] px-4 pt-6 md:p-0 group"
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
    >
      <motion.div
        key={showContentIdx}
        animate={{ opacity: 1, scale: 1 }}
        initial={{ opacity: 0, scale: 0.98 }}
        transition={{ ease: "easeInOut", duration: 1.2 }}
        layout
        className="min-h-[172px] md:min-h-[266px] text-white"
      >
        <RenderContent showContentIdx={showContentIdx} />
      </motion.div>
      <div className="space-x-2 md:space-x-1 group-hover:opacity-100 md:opacity-0 transition-opacity my-2">
        {content.map((i, idx) => {
          return (
            <button
              key={idx}
              onClick={() => {
                setShowContentIdx(idx);
              }}
              className={`md:w-2 md:h-2 w-6 h-1 rounded-sm ${
                showContentIdx === idx ? "bg-[#E4462D]" : "bg-ghost-white"
              }`}
            />
          );
        })}
      </div>

      <button
        onClick={() => {
          setShowStatistic((prev) => !prev);
        }}
        className="text-base font-medium text-[#E4462D] hover:text-[#F8B810] transition-colors duration-300 flex gap-1 mb-4"
      >
        Protocol statistics
        <ChevronUpIcon
          className={`w-5 h-5 mt-0.5 transition-all duration-300 ${
            showStatistic ? "rotate-180" : ""
          }`}
        />
      </button>
      {showStatistic && (
        <motion.div
          layout
          initial={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="grid grid-cols-2 justify-center overflow-hidden gap-x-16 gap-y-4 mt-6 z-[50]"
        >
          <StatisticCard
            title="Management Fee"
            description="0.5%"
            className="w-[191px] h-14"
            tooltip="This amount is deducted from the collateral amount as a management fee. There are no recurring fees for borrowing, which is thus interest-free."
            tooltipPlacement="bottom"
          />
          <StatisticCard
            title="Liquidation Threshold"
            description="115%"
            className="w-[191px] h-14"
            tooltip="Liquidation Threshold Ratio"
            tooltipPlacement="left-bottom-corner"
          />
          <StatisticCard
            title="Total Value Locked"
            // description={
            //   isNil(baseCoin)
            //     ? "-"
            //     : `${Number(pageData.baseTotalCollateralAmount).toFixed(6)}`
            // }
            className="w-[191px] h-14"
            tooltip="The Total Value Locked (TVL) is the total value of sei locked as collateral in the system."
            tooltipPlacement="bottom"
            coinName={"Solana"}
            isNumeric
          />
          <StatisticCard
            title="AUSD in Stability Pool"
            tooltipPlacement="left-bottom"
            // description={
            //   isNil(baseCoin)
            //     ? "-"
            //     : Number(pageData.totalStakedAmount).toFixed(3).toString()
            // }
            className="w-[191px] h-14"
            tooltip="The total AUSD currently held in the Stability Pool."
            isNumeric
          />
          <StatisticCard
            title="Troves"
            // description={`${
            //   isNil(walletInfo) ? "-" : pageData.totalTrovesAmount
            // }`}
            className="w-[191px] h-14"
            tooltip="The total number of active Troves in the system."
            tooltipPlacement="right-top"
          />
          <StatisticCard
            title="Total Collateral Ratio"
            tooltipPlacement="left-top"
            // description={`${
            //   isNil(baseCoin)
            //     ? "-"
            //     : isFinite(
            //         Number(
            //           ((pageData.baseTotalCollateralAmount * basePrice) /
            //             pageData.totalDebtAmount) *
            //             100
            //         )
            //       )
            //     ? Number(
            //         ((pageData.baseTotalCollateralAmount * basePrice) /
            //           pageData.totalDebtAmount) *
            //           100
            //       ).toFixed(3)
            //     : 0
            // } %`}
            className="w-[191px] h-14"
            tooltip={`The ratio of the Dollar value of the entire system collateral at the current Solana:AUSD price, to the entire system debt.`}
          />
          <StatisticCard
            title="AUSD Supply"
            // description={
            //   isNil(baseCoin)
            //     ? "-"
            //     : Number(pageData.totalAusdSupply).toFixed(3).toString()
            // }
            className="w-[191px] h-14"
            tooltip="The total AUSD minted by the Aeroscraper Protocol."
            tooltipPlacement="top"
            isNumeric
          />
        </motion.div>
      )}
    </div>
  );
};

export default React.memo(StatisticSide);
