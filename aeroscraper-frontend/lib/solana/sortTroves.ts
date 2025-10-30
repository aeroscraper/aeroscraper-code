import { PublicKey } from '@solana/web3.js';
import { TroveData, NeighborHints } from './types';

/**
 * Sort troves by ICR (ascending order: riskiest first)
 * 
 * Lower ICR = riskier = earlier in list
 * Higher ICR = safer = later in list
 * 
 * Tie-breaker: larger debt first
 * 
 * @param troves - Array of trove data
 * @returns Sorted array (ascending ICR)
 */
export function sortTrovesByICR(troves: TroveData[]): TroveData[] {
  return [...troves].sort((a, b) => {
    // Sort by ICR ascending (lowest/riskiest first)
    if (a.icr < b.icr) return -1;
    if (a.icr > b.icr) return 1;

    // Tie-breaker: sort by debt descending (larger debt first)
    if (a.debt > b.debt) return -1;
    if (a.debt < b.debt) return 1;

    return 0;
  });
}

/**
 * Find neighbors for a specific trove in the sorted list
 * 
 * Returns the previous and next troves for ICR validation
 * 
 * @param trove - The trove to find neighbors for
 * @param sortedTroves - Pre-sorted array of all troves
 * @returns Neighbor hints (prev and next)
 */
export function findNeighbors(
  trove: TroveData,
  sortedTroves: TroveData[]
): NeighborHints {
  const index = sortedTroves.findIndex((t) => t.owner.equals(trove.owner));

  if (index === -1) {
    throw new Error(`Trove not found in sorted list: ${trove.owner.toBase58()}`);
  }

  return {
    prev: index > 0 ? sortedTroves[index - 1] : null,
    next: index < sortedTroves.length - 1 ? sortedTroves[index + 1] : null,
  };
}

/**
 * Build remainingAccounts array for neighbor validation
 * 
 * Pattern: [prev_LT, next_LT] or [prev_LT] or [next_LT] or []
 * 
 * @param neighbors - Neighbor hints from findNeighbors()
 * @returns Array of LiquidityThreshold accounts for validation
 */
export function buildNeighborAccounts(neighbors: NeighborHints): PublicKey[] {
  const accounts: PublicKey[] = [];

  if (neighbors.prev) {
    accounts.push(neighbors.prev.liquidityThresholdAccount);
  }

  if (neighbors.next) {
    accounts.push(neighbors.next.liquidityThresholdAccount);
  }

  return accounts;
}

