import { Connection, PublicKey } from '@solana/web3.js';
import { TroveData } from './types';
import { fetchAllTroves } from './fetchTroves';
import { sortTrovesByICR, findNeighbors, buildNeighborAccounts } from './sortTroves';
import { calculateICR } from './calculateICR';
import { PROTOCOL_PROGRAM_ID } from '@/lib/constants/solana';
import { getPrice as getSolPrice } from './getSolPriceInUsd';

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
  console.log('[neighborHints] total troves:', allTroves.length);

  // 2. Sort by ICR
  const sortedTroves = sortTrovesByICR(allTroves);
  console.log('[neighborHints] top-5 sorted ICRs (micro-%):');
  sortedTroves.slice(0, 5).forEach((t, i) => {
    console.log(
      `  ${i + 1}. ${t.owner.toBase58()} icr=${t.icr.toString()} debt=${t.debt.toString()}`
    );
  });

  // 3. Calculate ICR for new trove using live SOL price
  const solPriceUsd = await getSolPrice('SOL');
  if (!Number.isFinite(solPriceUsd) || solPriceUsd <= 0) {
    throw new Error('Unable to fetch current SOL price for neighbor hint calculation.');
  }
  const collateralAmountBigInt = BigInt(collateralAmount);
  const loanAmountBigInt = BigInt(loanAmount);

  const newICR = calculateICR(collateralAmountBigInt, loanAmountBigInt, solPriceUsd);
  console.log('[neighborHints] new trove params:', {
    user: userPublicKey.toBase58(),
    collateralAmount,
    loanAmount,
    solPriceUsd,
    newICR: newICR.toString(),
  });

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

  // 5. Remove the user's existing trove (if any) before inserting preview
  const trovesExcludingUser = sortedTroves.filter(
    (trove) => !trove.owner.equals(userPublicKey)
  );

  // Insert into sorted position using filtered list
  const insertIndex = trovesExcludingUser.findIndex((t) => t.icr > newICR);
  const finalIndex = insertIndex === -1 ? trovesExcludingUser.length : insertIndex;
  console.log('[neighborHints] insertIndex:', insertIndex, 'finalIndex:', finalIndex);

  const newSortedTroves = [
    ...trovesExcludingUser.slice(0, finalIndex),
    newTrove,
    ...trovesExcludingUser.slice(finalIndex),
  ];

  // 6. Find neighbors
  const neighbors = findNeighbors(newTrove, newSortedTroves);
  console.log('[neighborHints] neighbors:', {
    prev:
      neighbors.prev && {
        owner: neighbors.prev.owner.toBase58(),
        icr: neighbors.prev.icr.toString(),
        lt: neighbors.prev.liquidityThresholdAccount?.toBase58?.(),
      },
    next:
      neighbors.next && {
        owner: neighbors.next.owner.toBase58(),
        icr: neighbors.next.icr.toString(),
        lt: neighbors.next.liquidityThresholdAccount?.toBase58?.(),
      },
  });

  // 7. Build and return neighbor accounts with protocol rules
  // If inserting at head, return [] to avoid single 'next' being misread as 'prev' on-chain
  if (finalIndex === 0) {
    console.log('[neighborHints] at head → returning no hints to avoid misinterpretation');
    return [];
  }

  const accounts = buildNeighborAccounts(neighbors);
  console.log('[neighborHints] returning hint accounts:', accounts.map((a) => a.toBase58()));
  return accounts;
}

