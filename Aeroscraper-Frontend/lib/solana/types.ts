import { PublicKey } from '@solana/web3.js';

export interface TroveData {
  owner: PublicKey;
  debt: bigint;
  collateralAmount: bigint;
  collateralDenom: string;
  icr: bigint; // Individual Collateralization Ratio
  liquidityThresholdAccount: PublicKey;
}

export interface NeighborHints {
  prev: TroveData | null;
  next: TroveData | null;
}

