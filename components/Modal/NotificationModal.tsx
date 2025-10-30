import { useNotification } from "@/contexts/NotificationProvider";
import { AnimatePresence, motion } from "framer-motion";
import React, { FC, useEffect } from "react";
import { CloseIcon } from "../Icons/Icons";
import { TransactionDomainByChainName } from "@/constants/chainConstants";
import useChainAdapter from "@/hooks/useChainAdapter";
import { ChainName } from "@/enums/Chain";

const VARIANTS: Record<Status, any> = {
  success: {
    icon: (
      <img alt="transaction-success" src="/images/transaction-success.svg" />
    ),
    title: "Transaction Successful",
    borderColor: "border-[#00CF30]/70",
    backgroundColor: "bg-[#001A0666]/40",
  },
  error: {
    icon: <CloseIcon className="w-5 h-5" />,
    title: "Transaction Failed",
    borderColor: "border-[#ED0E00]/70",
    backgroundColor: "bg-[#2E030066]/40",
  },
  networkchange: {
    icon: (
      <img alt="transaction-success" src="/images/transaction-success.svg" />
    ),
    title: "Network Changed",
    borderColor: "border-[#00CF30]/70",
    backgroundColor: "bg-[#001A0666]/40",
  },
};

type Status = "error" | "success" | "networkchange";

const NotificationModal: FC = () => {
  const selectedChainName = ChainName.SOLANA;
  // const { selectedChainName } = useChainAdapter();
  const { notification, setOnHover } = useNotification();

  let scanDomain =
    TransactionDomainByChainName[selectedChainName ?? ChainName.INJECTIVE]
      ?.txDetailUrl;

  return (
    <>
      <AnimatePresence>
        {notification && (
          <motion.div
            onMouseEnter={() => {
              setOnHover(true);
            }}
            onMouseLeave={() => {
              setOnHover(false);
            }}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
              duration: 0.5,
              ease: "backInOut",
            }}
            className={`fixed z-[999] right-4 md:right-20 backdrop-blur-2xl top-[112px] border-[0.6px] rounded-lg px-6 py-4 ${
              VARIANTS[notification.status].borderColor
            } ${VARIANTS[notification.status].backgroundColor}`}
          >
            <div className="">
              <div className="flex justify-center items-center gap-5 whitespace-nowrap">
                <div className="w-5 h-5 text-white">
                  {VARIANTS[notification.status].icon}
                </div>
                <span className="text-base font-medium text-white flex-1">
                  {VARIANTS[notification.status].title}
                </span>
              </div>
              {notification.directLink && (
                <a
                  href={
                    notification.directLink
                      ? `${scanDomain}${notification.directLink}`
                      : undefined
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex justify-end items-center gap-2 mt-1.5 cursor-pointer"
                >
                  <span className="text-white underline font-medium text-lg">
                    View Explorer
                  </span>
                  <img
                    alt="external-link"
                    src="/images/external-link.svg"
                    className="w-[18px] h-[18px]"
                  />
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NotificationModal;
