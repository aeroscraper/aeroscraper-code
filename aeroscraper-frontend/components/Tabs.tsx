import { camelCaseToTitleCase } from "@/utils/stringUtils";
import { motion } from "framer-motion";
import React, { FC, useEffect, useRef, useState } from "react";
import {
  ActiveChevronLeftIcon,
  ActiveChevronRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShapeIcon,
} from "./Icons/Icons";
import SkeletonLoading from "./Table/SkeletonLoading";
import useChainAdapter from "@/hooks/useChainAdapter";
import { ChainName } from "@/enums/Chain";
import { useAppContext } from "@/contexts/AppProvider";

interface TabsProps<T> {
  tabs: T[];
  selectedTab: T;
  onTabSelected?: (tab: any) => void;
  dots?: T[];
  loading?: boolean;
}

function Tabs({
  tabs,
  selectedTab,
  onTabSelected,
  loading,
  dots,
}: TabsProps<string>) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const tabsRef = useRef<HTMLUListElement>(null);
  const { selectedChainName, selectedAppVersion } = useAppContext();

  useEffect(() => {
    scrollTabs("left");
  }, [selectedChainName,selectedAppVersion]);

  const scrollTabs = (direction: "left" | "right") => {
    const container = tabsRef.current;

    if (scrollPosition === 0 && direction === "left") return;
    if (scrollPosition === 600 && direction === "right") return;

    if (container) {
      const scrollAmount = 600; // Adjust this value as needed
      const newScrollPosition =
        direction === "left"
          ? scrollPosition - scrollAmount
          : scrollPosition + scrollAmount;

      container.scrollTo({ left: newScrollPosition, behavior: "smooth" });
      setScrollPosition(newScrollPosition);
    }
  };

  if (loading) {
    return (
      <nav>
        <ul className="flex flex-auto border border-white/10 items-center rounded-lg">
          {tabs.map((tab) => (
            <li
              key={tab}
              className={`m-0.5 text-base font-medium text-white relative cursor-pointer rounded-md hover:text-red-500 duration-700 flex-1 whitespace-nowrap text-center`}
            >
              <SkeletonLoading height={"h-12"} noPadding noMargin />
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav className="relative">
      <ul className="grid grid-cols-6 gap-2 py-4 left-0 bottom-0 fixed shadow shadow-white/10 w-full bg-chinese-black md:hidden z-[999]">
        {tabs.map((tab) => (
          <motion.li
            key={tab}
            onClick={() => onTabSelected?.(tab)}
            className={`m-1 text-[8px] font-medium text-white relative cursor-pointer rounded-md hover:text-red-500 duration-700 flex-1 whitespace-wrap items-center justify-center flex text-center`}
          >
            {camelCaseToTitleCase(tab)}
            {dots?.includes(tab) && (
              <div className="h-2 w-2 absolute bg-red-500 right-3 -top-2.5 md:top-2 animate-pulse rounded-full" />
            )}
          </motion.li>
        ))}
      </ul>

      <ul
        ref={tabsRef}
        className="flex-auto gap-3 border border-white/10 rounded-lg md:flex hidden overflow-y-hidden overflow-x-scroll scrollbar-hidden"
      >
        {tabs.length > 5 && (
          <motion.button
            onClick={() => scrollTabs("left")}
            className="absolute -left-2 top-0 h-full py-0 px-4 z-[999] active:scale-90"
          >
            {scrollPosition === 0 ? (
              <ChevronLeftIcon />
            ) : (
              <ActiveChevronLeftIcon />
            )}
          </motion.button>
        )}

        {tabs.map((tab, _index) => (
          <motion.li
            key={tab}
            onClick={() => onTabSelected?.(tab)}
            className={`
            ${tabs.length === _index + 1 ? "mr-16" : ""}
            ${_index === 0 ? "ml-8" : ""}
            px-6 py-3 m-1 text-base font-medium text-white relative cursor-pointer rounded-md hover:text-red-500 duration-700 flex-1 whitespace-nowrap text-center`}
          >
            {camelCaseToTitleCase(tab)}
            {dots?.includes(tab) && (
              <div className="h-2 w-2 absolute bg-red-500 right-3 top-2 animate-pulse rounded-full" />
            )}
            {tab === selectedTab && (
              <motion.div
                layoutId={"gliding"}
                className="absolute bottom-0 h-[48px] border rounded-md border-red-500 left-0 right-0"
              />
            )}
          </motion.li>
        ))}

        {tabs.length > 5 && (
          <motion.button
            onClick={() => scrollTabs("right")}
            className="absolute flex -right-[0.5px] h-full py-5 px-3 top-0 z-[999] scale-[0.93] scale rounded-md bg-[#1a0c1c]"
          >
            {scrollPosition === 600 ? (
              <ChevronRightIcon />
            ) : (
              <ActiveChevronRightIcon />
            )}
          </motion.button>
        )}
      </ul>
    </nav>
  );
}

export default Tabs;
