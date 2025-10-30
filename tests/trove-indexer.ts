/**
 * Trove Indexer - Off-chain sorting and neighbor finding for Aerospacer Protocol
 * 
 * NEW ARCHITECTURE:
 * - Fetch all troves from Solana via RPC (no size limits)
 * - Sort troves by ICR off-chain (efficient, no compute limits)
 * - Find 2-3 neighbor accounts for validation
 * - Pass only neighbors via remainingAccounts (~6-9 accounts = ~200 bytes)
 * 
 * Benefits:
 * - No transaction size limits (was hitting 1287 bytes > 1232 limit at 3-4 troves)
 * - Scales to 1000+ troves easily
 * - Contract only validates, doesn't store or traverse
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { AerospacerProtocol } from "../target/types/aerospacer_protocol";

export interface TroveData {
  owner: PublicKey;
  debt: bigint;
  collateralAmount: bigint;
  collateralDenom: string;
  icr: bigint; // Individual Collateralization Ratio

  // Account addresses for passing to contract
  debtAccount: PublicKey;
  collateralAccount: PublicKey;
  liquidityThresholdAccount: PublicKey;
}

export interface NeighborHints {
  prev: TroveData | null;
  next: TroveData | null;
}

/**
 * Fetch all troves from the blockchain
 * 
 * Uses getProgramAccounts to fetch all UserDebtAmount accounts (one per trove)
 * Then fetches corresponding collateral and ICR data
 * 
 * @param connection - Solana connection
 * @param program - Aerospacer protocol program instance
 * @param collateralDenom - Optional filter by collateral denomination
 * @returns Array of trove data
 */
export async function fetchAllTroves(
  connection: Connection,
  program: Program<AerospacerProtocol>,
  collateralDenom?: string
): Promise<TroveData[]> {
  const troves: TroveData[] = [];

  // Fetch all UserDebtAmount accounts (one per trove)
  const debtAccounts = await program.account.userDebtAmount.all();

  for (const debtAccountInfo of debtAccounts) {
    const owner = debtAccountInfo.account.owner;
    const debt = BigInt(debtAccountInfo.account.amount.toString());

    // Skip closed troves (zero debt)
    if (debt === 0n) {
      continue;
    }

    // Fetch LiquidityThreshold to get ICR
    const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("liquidity_threshold"), owner.toBuffer()],
      program.programId
    );

    try {
      const liquidityThreshold = await program.account.liquidityThreshold.fetch(
        liquidityThresholdPda
      );
      const icr = BigInt(liquidityThreshold.ratio.toString());

      // Fetch UserCollateralAmount (we may have multiple denoms per user in future)
      // For now, assume single collateral type per trove
      const collateralAccounts = await program.account.userCollateralAmount.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: owner.toBase58(),
          },
        },
      ]);

      for (const collateralAccountInfo of collateralAccounts) {
        const denom = collateralAccountInfo.account.denom;

        // Apply collateral filter if specified
        if (collateralDenom && denom !== collateralDenom) {
          continue;
        }

        const collateralAmount = BigInt(collateralAccountInfo.account.amount.toString());

        // Skip if no collateral
        if (collateralAmount === 0n) {
          continue;
        }

        const [collateralPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("user_collateral_amount"), owner.toBuffer(), Buffer.from(denom)],
          program.programId
        );

        troves.push({
          owner,
          debt,
          collateralAmount,
          collateralDenom: denom,
          icr,
          debtAccount: debtAccountInfo.publicKey,
          collateralAccount: collateralPda,
          liquidityThresholdAccount: liquidityThresholdPda,
        });
      }
    } catch (err) {
      // Skip troves with missing data (shouldn't happen in normal operation)
      console.warn(`Failed to fetch data for trove ${owner.toBase58()}:`, err);
    }
  }

  return troves;
}

/**
 * Sort troves by ICR (ascending order: riskiest first)
 * 
 * Lower ICR = riskier = earlier in list
 * Higher ICR = safer = later in list
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
 * Find all liquidatable troves (ICR < threshold)
 * 
 * Uses sorted list optimization: stops at first trove with ICR >= threshold
 * 
 * @param sortedTroves - Pre-sorted array of all troves (ascending ICR)
 * @param liquidationThreshold - ICR threshold (typically 110 for 110%)
 * @returns Array of liquidatable troves
 */
export function findLiquidatableTroves(
  sortedTroves: TroveData[],
  liquidationThreshold: number
): TroveData[] {
  const liquidatable: TroveData[] = [];

  for (const trove of sortedTroves) {
    if (trove.icr < BigInt(liquidationThreshold)) {
      liquidatable.push(trove);
    } else {
      // Sorted list optimization: stop at first safe trove
      break;
    }
  }

  return liquidatable;
}

/**
 * Build remainingAccounts array for liquidation instruction
 * 
 * Pattern: [UserDebtAmount, UserCollateralAmount, LiquidityThreshold] for each trove
 * 
 * @param troves - Array of troves to liquidate (should be pre-sorted)
 * @returns Array of account metas for remainingAccounts
 */
export function buildLiquidationAccounts(troves: TroveData[]): PublicKey[] {
  const accounts: PublicKey[] = [];

  for (const trove of troves) {
    accounts.push(trove.debtAccount);
    accounts.push(trove.collateralAccount);
    accounts.push(trove.liquidityThresholdAccount);
  }

  return accounts;
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

/**
 * Calculate ICR from collateral and debt
 * 
 * ICR = (collateral_value / debt) * 100
 * where collateral_value = collateral_amount * collateral_price
 * 
 * @param collateralAmount - Amount of collateral (native token units)
 * @param collateralPrice - Price per unit (with decimals)
 * @param debtAmount - Debt amount (aUSD with 18 decimals)
 * @returns ICR as percentage (e.g., 150 for 150%)
 */
export function calculateICR(
  collateralAmount: bigint,
  collateralPrice: bigint,
  debtAmount: bigint
): number {
  if (debtAmount === 0n) {
    return Number.MAX_SAFE_INTEGER; // Infinite ICR (no debt)
  }

  // ICR = (collateral * price / debt) * 100
  // Scale up before division to maintain precision
  const collateralValue = collateralAmount * collateralPrice;
  const icr = (collateralValue * 100n) / debtAmount;

  return Number(icr);
}

/**
 * EXAMPLE USAGE:
 * 
 * ```typescript
 * import { fetchAllTroves, sortTrovesByICR, findNeighbors, buildNeighborAccounts } from './trove-indexer';
 * 
 * // 1. Fetch all troves from blockchain (no size limits)
 * const allTroves = await fetchAllTroves(connection, program);
 * 
 * // 2. Sort off-chain by ICR (efficient)
 * const sortedTroves = sortTrovesByICR(allTroves);
 * 
 * // 3. Find neighbors for a new trove
 * const myTrove = { owner: userPubkey, icr: 150n, ... };
 * const neighbors = findNeighbors(myTrove, sortedTroves);
 * 
 * // 4. Build remainingAccounts for validation (only 2-3 accounts, ~200 bytes)
 * const neighborAccounts = buildNeighborAccounts(neighbors);
 * 
 * // 5. Send transaction with minimal remainingAccounts
 * await program.methods
 *   .openTrove(params)
 *   .accounts({ ... })
 *   .remainingAccounts(neighborAccounts.map(pubkey => ({
 *     pubkey,
 *     isWritable: false,
 *     isSigner: false,
 *   })))
 *   .rpc();
 * ```
 */
