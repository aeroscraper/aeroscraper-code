import { Connection, PublicKey } from '@solana/web3.js';
import { PROTOCOL_PROGRAM_ID } from '@/lib/constants/solana';

/**
 * Fetches and calculates user's claimable liquidation gains for a given collateral denom
 * Formula: gain = user_stake_amount.amount × (s_factor - s_snapshot) / p_snapshot
 * 
 * @param connection Solana connection
 * @param userPublicKey User's public key
 * @param collateralDenom Collateral denomination (e.g., "SOL")
 * @returns BigInt liquidation gain amount in lamports, or 0n if no gains available
 */
export async function fetchLiquidationGains(
  connection: Connection,
  userPublicKey: PublicKey,
  collateralDenom: string = 'SOL'
): Promise<bigint> {
  try {
    // 1. Derive user_stake_amount PDA
    const [userStakeAmountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_stake_amount'), userPublicKey.toBuffer()],
      PROTOCOL_PROGRAM_ID
    );

    // Fetch user stake account
    const userStakeAccountInfo = await connection.getAccountInfo(userStakeAmountPDA);
    if (!userStakeAccountInfo) {
      // User has no stake, so no gains
      return BigInt(0);
    }

    // Parse UserStakeAmount struct
    // Layout: discriminator (8) + owner (32) + amount (8) + p_snapshot (16) + epoch_snapshot (8) + last_update_block (8)
    const stakeData = userStakeAccountInfo.data;
    const stakeView = new DataView(stakeData.buffer, stakeData.byteOffset);
    
    let offset = 8; // Skip discriminator
    offset += 32; // Skip owner
    
    // amount: u64 (8 bytes, little-endian)
    const stakeAmount = BigInt(stakeView.getBigUint64(offset, true));
    offset += 8;
    
    // p_snapshot: u128 (16 bytes, little-endian)
    const p_snapshot_low = BigInt(stakeView.getBigUint64(offset, true));
    offset += 8;
    const p_snapshot_high = BigInt(stakeView.getBigUint64(offset, true));
    offset += 8;
    const p_snapshot = (p_snapshot_high << BigInt(64)) | p_snapshot_low;

    // Check if user has stake
    if (stakeAmount === BigInt(0)) {
      return BigInt(0);
    }

    // 2. Derive and fetch stability_pool_snapshot PDA
    const [stabilityPoolSnapshotPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('stability_pool_snapshot'), Buffer.from(collateralDenom)],
      PROTOCOL_PROGRAM_ID
    );

    const stabilitySnapshotInfo = await connection.getAccountInfo(stabilityPoolSnapshotPDA);
    if (!stabilitySnapshotInfo) {
      // No stability pool snapshot exists, no gains
      return BigInt(0);
    }

    // Parse StabilityPoolSnapshot struct
    // Layout: discriminator (8) + denom (String) + s_factor (16) + total_collateral_gained (8) + epoch (8)
    const snapshotData = stabilitySnapshotInfo.data;
    const snapshotView = new DataView(snapshotData.buffer, snapshotData.byteOffset);
    
    let snapshotOffset = 8; // Skip discriminator
    
    // Parse denom length (4 bytes u32)
    const denomLength = snapshotView.getUint32(snapshotOffset, true);
    snapshotOffset += 4;
    
    // Skip denom bytes
    snapshotOffset += denomLength;
    
    // s_factor: u128 (16 bytes, little-endian)
    const s_factor_low = BigInt(snapshotView.getBigUint64(snapshotOffset, true));
    snapshotOffset += 8;
    const s_factor_high = BigInt(snapshotView.getBigUint64(snapshotOffset, true));
    snapshotOffset += 8;
    const s_factor = (s_factor_high << BigInt(64)) | s_factor_low;

    // 3. Derive and fetch user_collateral_snapshot PDA
    const [userCollateralSnapshotPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_collateral_snapshot'), userPublicKey.toBuffer(), Buffer.from(collateralDenom)],
      PROTOCOL_PROGRAM_ID
    );

    const userSnapshotInfo = await connection.getAccountInfo(userCollateralSnapshotPDA);
    let s_snapshot = BigInt(0); // Default to 0 if snapshot doesn't exist (first claim)

    if (userSnapshotInfo) {
      // Parse UserCollateralSnapshot struct
      // Layout: discriminator (8) + owner (32) + denom (String) + s_snapshot (16) + pending_collateral_gain (8)
      const userSnapshotData = userSnapshotInfo.data;
      const userSnapshotView = new DataView(userSnapshotData.buffer, userSnapshotData.byteOffset);
      
      let userSnapshotOffset = 8; // Skip discriminator
      userSnapshotOffset += 32; // Skip owner
      
      // Parse denom length and skip denom
      const userDenomLength = userSnapshotView.getUint32(userSnapshotOffset, true);
      userSnapshotOffset += 4 + userDenomLength;
      
      // s_snapshot: u128 (16 bytes, little-endian)
      const s_snapshot_low = BigInt(userSnapshotView.getBigUint64(userSnapshotOffset, true));
      userSnapshotOffset += 8;
      const s_snapshot_high = BigInt(userSnapshotView.getBigUint64(userSnapshotOffset, true));
      s_snapshot = (s_snapshot_high << BigInt(64)) | s_snapshot_low;
    }

    // 4. Calculate collateral gain: amount × (s_factor - s_snapshot) / p_snapshot
    if (s_factor <= s_snapshot || p_snapshot === BigInt(0)) {
      // No gains or invalid state
      return BigInt(0);
    }

    // Calculate gain = stakeAmount × (s_factor - s_snapshot) / p_snapshot
    // Multiply first for precision, then divide
    const gain = (stakeAmount * (s_factor - s_snapshot)) / p_snapshot;

    return gain > BigInt(0) ? gain : BigInt(0);
  } catch (error) {
    console.error('Error fetching liquidation gains:', error);
    // Return 0 on error to avoid breaking UI
    return BigInt(0);
  }
}

