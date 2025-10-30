import { LogoSecondary } from "@/components/Icons/Icons";
import Text from "@/components/Texts/Text";
import { useAppContext } from "@/contexts/AppProvider";
import { ChainName } from "@/enums/Chain";
import useChainAdapter from "@/hooks/useChainAdapter";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Footer({}) {
  const { selectedChainName, selectedAppVersion } = useAppContext();

  return (
    <footer className="flex flex-col md:gap-x-48 md:gap-y-16 items-top flex-wrap px-6 md:px-20 bg-transparent md:-mx-20 md:pr-16 mt-40 pb-24 relative">
      <div className="flex items-center gap-6 md:mt-20">
        <LogoSecondary />
        <Text size="2xl" textColor="text-white">
          Aeroscraper
        </Text>
      </div>
      <div className="grid md:grid-cols-4 gap-10 md:gap-40 md:mt-0 mt-10">
        <div className="flex flex-col content-start justify-start gap-4">
          <Text size="sm" textColor="text-white" weight="font-semibold">
            Product
          </Text>
          <Link
            href={"https://beosin.com/audits/Aeroscraper_202402020919.pdf"}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:scale-105 transition-all gap-2 flex"
          >
            <Text size="sm" textColor="text-white" className="cursor-pointer">
              Audit
            </Text>
            <img
              alt="external-link"
              src="/images/external-link.svg"
              className="w-4 h-4"
            />
          </Link>
          <Link
            href={"/?scroll=FAQ"}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:scale-105 transition-all flex gap-2"
          >
            <Text size="sm" textColor="text-white" className="cursor-pointer">
              FAQ
            </Text>
          </Link>
          <Link
            href={
              "https://novaratio.gitbook.io/aeroscraper/aeroscraper/whitepaper"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="hover:scale-105 transition-all flex gap-2"
          >
            <Text size="sm" textColor="text-white" className="cursor-pointer">
              Whitepaper
            </Text>
            <img
              alt="external-link"
              src="/images/external-link.svg"
              className="w-4 h-4"
            />
          </Link>
          <Link
            href={
              "https://aeroscraper.gitbook.io/aeroscraper/brand-identity/brand-kit"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="hover:scale-105 transition-all flex gap-2"
          >
            <Text size="sm" textColor="text-white">
              Brand Identity
            </Text>
            <img
              alt="external-link"
              src="/images/external-link.svg"
              className="w-4 h-4"
            />
          </Link>
          {selectedChainName === ChainName.INJECTIVE && (
            <Link
              href={"https://testnet.faucet.injective.network/"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Injective Faucet
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
          )}
        </div>
        <div className="flex flex-col content-start justify-start gap-6">
          <Text size="sm" weight="font-semibold">
            Deep dive
          </Text>
          <div className="flex flex-col content-start gap-3">
            <Link
              href={
                "https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-name"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Definition of name
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            <Link
              href={
                "https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-icon"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Definition of icon
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            <Link
              href={
                "https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-colors"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Definition of colors
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            <Link
              href={
                "https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-typography"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Definition of typography
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            <Link
              href={"https://aeroscraper.gitbook.io/aeroscraper/"}
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Definition of concept
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
          </div>
        </div>
        <div className="flex flex-col content-start justify-start gap-6">
          <Text size="sm" weight="font-semibold">
            Hackathon
          </Text>
          <div className="flex flex-col content-start gap-3">
              <Link
                href={
                  "https://twitter.com/Injective_/status/1745933949132488934?s=20"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="hover:scale-105 transition-all flex gap-2 whitespace-nowrap"
              >
                <Text size="sm" textColor="text-white">
                  Injective Illuminate Hackathon
                </Text>
                <img
                  alt="external-link"
                  src="/images/external-link.svg"
                  className="w-4 h-4"
                />
              </Link>
            <Link
              href={"https://x.com/SeiNetwork/status/1705128171534717322?s=20"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Code Sei Hackathon
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
          </div>
        </div>
        <div className="flex flex-col content-start justify-start gap-6">
          <Text size="sm" weight="font-semibold">
            Social
          </Text>
          <div className="flex flex-col content-start gap-4">
            <Link
              href={"https://twitter.com/aeroscraper"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                X
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            <Link
              href={"https://discord.gg/3R6yTqB8hC"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Discord
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            {selectedChainName === ChainName.INJECTIVE && (
            <Link
              href={"https://zealy.io/c/aeroscraper/questboard"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Zealy
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            )}
            <Link
              href={"https://medium.com/@aeroscraper"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Medium
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            {selectedChainName === ChainName.INJECTIVE && (
            <Link
              href={"https://guild.xyz/aeroscraper"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-105 transition-all flex gap-2"
            >
              <Text size="sm" textColor="text-white">
                Guild
              </Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
