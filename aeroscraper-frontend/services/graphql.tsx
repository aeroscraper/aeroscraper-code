"use client";
import { ChainName } from "@/enums/Chain";
import {
  AppVersion,
  RiskyTrovesResponse,
  TotalTrovesResponse,
} from "@/types/types";
import { request, gql } from "graphql-request";

export default function graphql({
  selectedChainName = ChainName.INJECTIVE,
  selectedAppVersion = AppVersion.V1,
}: {
  selectedChainName?: ChainName;
  selectedAppVersion: AppVersion;
}) {
  const URL = (): string => {
    switch (selectedChainName) {
      case ChainName.ARCHWAY:
        return process.env.NEXT_PUBLIC_INDEXER_ARCH as string;
      case ChainName.SEI:
        return process.env.NEXT_PUBLIC_INDEXER_DOMAIN as string;
      case ChainName.NEUTRON:
        return process.env.NEXT_PUBLIC_INDEXER_NEUTRON as string;
      case ChainName.INJECTIVE:
        if (selectedAppVersion === AppVersion.V1) {
          return process.env.NEXT_PUBLIC_INDEXER_INJ_V1 as string;
        }
        return process.env.NEXT_PUBLIC_INDEXER_INJ_V2 as string;
      case ChainName.XION:
        return process.env.NEXT_PUBLIC_INDEXER_XION as string;
      default:
        return process.env.NEXT_PUBLIC_INDEXER_DOMAIN as string;
    }
  };

  const getRiskyTrovesQuery =
    selectedChainName === ChainName.INJECTIVE
      ? gql`
          query {
            troves {
              nodes {
                owner
              }
            }
          }
        `
      : selectedChainName === ChainName.XION
      ? gql`
          query {
            troves {
              nodes {
                owner
                ratio
              }
            }
          }
        `
      : gql`
          query {
            troves {
              nodes {
                owner
                liquidityThreshold
              }
            }
          }
        `;

  const getTotalTrovesQuery = gql`
    query {
      troves {
        totalCount
      }
    }
  `;
  const requestRiskyTroves = async (): Promise<RiskyTrovesResponse> => {
    return await request(URL(), getRiskyTrovesQuery);
  };

  const requestTotalTroves = async (): Promise<TotalTrovesResponse> => {
    return await request(URL(), getTotalTrovesQuery);
  };
  return {
    requestRiskyTroves,
    requestTotalTroves,
  };
}
