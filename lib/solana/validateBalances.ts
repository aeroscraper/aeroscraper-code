import { Connection, PublicKey } from '@solana/web3.js';

/**
 * Minimum SOL balance required for transaction fees
 * 0.001 SOL = 1,000,000 lamports
 */
export const MIN_SOL_BALANCE_FOR_FEES = 1_000_000; // 0.001 SOL

/**
 * Validate SOL balance is sufficient for transaction fees
 * @param connection - Solana RPC connection
 * @param userPublicKey - User's wallet public key
 * @param minRequired - Minimum required balance in lamports (defaults to MIN_SOL_BALANCE_FOR_FEES)
 * @throws Error if balance is insufficient
 */
export async function validateSolBalance(
  connection: Connection,
  userPublicKey: PublicKey,
  minRequired: number = MIN_SOL_BALANCE_FOR_FEES
): Promise<number> {
  try {
    const balance = await connection.getBalance(userPublicKey, 'confirmed');
    
    if (balance < minRequired) {
      const requiredSOL = minRequired / 1e9;
      const availableSOL = balance / 1e9;
      throw new Error(
        `Insufficient SOL balance. You need at least ${requiredSOL.toFixed(6)} SOL for transaction fees. Available: ${availableSOL.toFixed(6)} SOL`
      );
    }
    
    return balance;
  } catch (error: any) {
    // Re-throw if it's already our error, otherwise wrap it
    if (error.message?.includes('Insufficient SOL balance')) {
      throw error;
    }
    throw new Error(`Failed to check SOL balance: ${error.message}`);
  }
}

/**
 * Validate collateral token balance is sufficient
 * @param connection - Solana RPC connection
 * @param userPublicKey - User's wallet public key
 * @param collateralMint - Collateral token mint address
 * @param requiredAmount - Required amount in lamports (smallest unit of the token)
 * @throws Error if balance is insufficient or account doesn't exist
 */
export async function validateCollateralBalance(
  connection: Connection,
  userPublicKey: PublicKey,
  collateralMint: PublicKey,
  requiredAmount: number
): Promise<bigint> {
  try {
    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
    
    const ata = await getAssociatedTokenAddress(collateralMint, userPublicKey);
    
    try {
      const accountInfo = await getAccount(connection, ata);
      const balance = accountInfo.amount;
      
      if (balance < BigInt(requiredAmount)) {
        const requiredSOL = requiredAmount / 1e9;
        const availableSOL = Number(balance) / 1e9;
        throw new Error(
          `Insufficient collateral tokens. Required: ${requiredSOL.toFixed(6)} SOL, Available: ${availableSOL.toFixed(6)} SOL`
        );
      }
      
      return balance;
    } catch (error: any) {
      if (error.code === 2002 || error.name === 'TokenAccountNotFoundError') {
        throw new Error('Collateral token account not found. Please receive collateral tokens first.');
      }
      throw error;
    }
  } catch (error: any) {
    // Re-throw if it's already our error, otherwise wrap it
    if (error.message?.includes('Insufficient collateral') || error.message?.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to check collateral balance: ${error.message}`);
  }
}

/**
 * Validate aUSD token balance is sufficient
 * @param connection - Solana RPC connection
 * @param userPublicKey - User's wallet public key
 * @param stablecoinMint - aUSD token mint address
 * @param requiredAmount - Required amount in smallest unit (1e18 = 1 aUSD)
 * @throws Error if balance is insufficient or account doesn't exist
 */
export async function validateAusdBalance(
  connection: Connection,
  userPublicKey: PublicKey,
  stablecoinMint: PublicKey,
  requiredAmount: bigint | number
): Promise<bigint> {
  try {
    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
    
    const ata = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);
    
    try {
      const accountInfo = await getAccount(connection, ata);
      const balance = accountInfo.amount;
      
      const requiredBigInt = typeof requiredAmount === 'bigint' ? requiredAmount : BigInt(requiredAmount);
      
      if (balance < requiredBigInt) {
        const requiredAUSD = Number(requiredBigInt) / 1e18;
        const availableAUSD = Number(balance) / 1e18;
        throw new Error(
          `Insufficient aUSD balance. Required: ${requiredAUSD.toFixed(6)} AUSD, Available: ${availableAUSD.toFixed(6)} AUSD`
        );
      }
      
      return balance;
    } catch (error: any) {
      if (error.code === 2002 || error.name === 'TokenAccountNotFoundError') {
        throw new Error('aUSD token account not found. Please receive aUSD tokens first.');
      }
      throw error;
    }
  } catch (error: any) {
    // Re-throw if it's already our error, otherwise wrap it
    if (error.message?.includes('Insufficient aUSD') || error.message?.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to check aUSD balance: ${error.message}`);
  }
}

