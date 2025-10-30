import { Connection, PublicKey } from '@solana/web3.js';
import { TroveData } from './types';
import { fetchAllTroves } from './fetchTroves';
import { sortTrovesByICR, findNeighbors, buildNeighborAccounts } from './sortTroves';
import { calculateICR } from './calculateICR';
import { PROTOCOL_PROGRAM_ID } from '@/lib/constants/solana';

/**
 * Get neighbor hints for trove insertion validation
 * 
 * This function:
 * 1. Fetches all existing troves from blockchain
 * 2. Calculates ICR for the new trove
 * 3. Sorts all troves (including the new one) by ICR
 * 4. Finds prev/next neighbors in sorted list
 * 5. Returns only the neighbor LiquidityThreshold PDA addresses
 * 
 * @param connection - Solana RPC connection
 * @param userPublicKey - Public key of the user opening the trove
 * @param collateralAmount - Amount of collateral in lamports
 * @param loanAmount - Loan amount as string (to avoid overflow)
 * @param collateralDenom - Collateral denomination (e.g., "SOL")
 * @returns Array of neighbor LiquidityThreshold PDA addresses (0-2 accounts)
 */
export async function getNeighborHints(
  connection: Connection,
  userPublicKey: PublicKey,
  collateralAmount: number, // in lamports
  loanAmount: string, // as string
  collateralDenom: string
): Promise<PublicKey[]> {
  // 1. Fetch all existing troves
  const allTroves = await fetchAllTroves(connection, collateralDenom);

  // 2. Sort by ICR
  const sortedTroves = sortTrovesByICR(allTroves);

  // 3. Calculate ICR for new trove
  // Using simplified price estimate ($100/SOL)
  // Production should fetch actual price from Pyth oracle
  const estimatedSolPrice = BigInt(100);
  const collateralAmountBigInt = BigInt(collateralAmount);
  const loanAmountBigInt = BigInt(loanAmount);

  const newICR = calculateICR(collateralAmountBigInt, loanAmountBigInt, estimatedSolPrice);

  // 4. Create temporary TroveData for new trove
  const [liquidityThresholdPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('liquidity_threshold'), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );

  const newTrove: TroveData = {
    owner: userPublicKey,
    debt: loanAmountBigInt,
    collateralAmount: collateralAmountBigInt,
    collateralDenom,
    icr: newICR,
    liquidityThresholdAccount: liquidityThresholdPDA,
  };

  // 5. Insert into sorted position
  const insertIndex = sortedTroves.findIndex((t) => t.icr > newICR);
  const finalIndex = insertIndex === -1 ? sortedTroves.length : insertIndex;

  const newSortedTroves = [
    ...sortedTroves.slice(0, finalIndex),
    newTrove,
    ...sortedTroves.slice(finalIndex),
  ];

  // 6. Find neighbors
  const neighbors = findNeighbors(newTrove, newSortedTroves);

  // 7. Build and return neighbor accounts
  return buildNeighborAccounts(neighbors);
}

