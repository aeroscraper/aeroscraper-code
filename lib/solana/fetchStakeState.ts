import { Connection, PublicKey } from '@solana/web3.js';
import { PROTOCOL_PROGRAM_ID } from '@/lib/constants/solana';

export interface UserStakeState {
  amount: bigint;
  p_snapshot: bigint;  // u128
  epoch_snapshot: bigint;
  last_update_block: bigint;
  compounded_stake: bigint; // Calculated from p_snapshot vs current P
}

export async function fetchUserStakeState(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<UserStakeState | null> {
  // Derive user_stake_amount PDA
  const [userStakeAmountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_stake_amount'), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );

  // Fetch account
  const accountInfo = await connection.getAccountInfo(userStakeAmountPDA);
  if (!accountInfo) {
    return null; // Account doesn't exist yet
  }

  // Parse UserStakeAmount struct (from IDL lines 3691-3729)
  // Layout: discriminator (8) + owner (32) + amount (8) + p_snapshot (16) + epoch_snapshot (8) + last_update_block (8)
  const data = accountInfo.data;
  const view = new DataView(data.buffer, data.byteOffset);

  let offset = 8; // Skip discriminator
  offset += 32; // Skip owner

  // amount: u64 (8 bytes, little-endian)
  const amount = BigInt(view.getBigUint64(offset, true));
  offset += 8;

  // p_snapshot: u128 (16 bytes, little-endian)
  const p_snapshot_low = BigInt(view.getBigUint64(offset, true));
  offset += 8;
  const p_snapshot_high = BigInt(view.getBigUint64(offset, true));
  offset += 8;
  const p_snapshot = (p_snapshot_high << BigInt(64)) | p_snapshot_low;

  // epoch_snapshot: u64 (8 bytes, little-endian)
  const epoch_snapshot = BigInt(view.getBigUint64(offset, true));
  offset += 8;

  // last_update_block: u64 (8 bytes, little-endian)
  const last_update_block = BigInt(view.getBigUint64(offset, true));

  // Fetch protocol state to get current p_factor
  const [protocolStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROTOCOL_PROGRAM_ID
  );

  const protocolStateInfo = await connection.getAccountInfo(protocolStatePDA);
  if (!protocolStateInfo) {
    throw new Error('Protocol state not found');
  }

  // Parse p_factor from state (skip: discriminator + admin + oracle_helper + oracle_state + fee_distributor + fee_state
  // + minimum_collateral_ratio (8) + protocol_fee (1) + stable_coin_addr + stable_coin_code_id + total_debt + total_stake)
  const stateData = protocolStateInfo.data;
  const stateView = new DataView(stateData.buffer, stateData.byteOffset);
  let stateOffset = 8; // Skip discriminator
  stateOffset += 32; // admin
  stateOffset += 32; // oracle_helper_addr
  stateOffset += 32; // oracle_state_addr
  stateOffset += 32; // fee_distributor_addr
  stateOffset += 32; // fee_state_addr
  stateOffset += 8; // minimum_collateral_ratio (u64)
  stateOffset += 1; // protocol_fee (u8)
  stateOffset += 32; // stable_coin_addr
  stateOffset += 8; // stable_coin_code_id
  stateOffset += 8; // total_debt_amount
  stateOffset += 8; // total_stake_amount

  // p_factor: u128 (16 bytes, little-endian)
  const p_factor_low = BigInt(stateView.getBigUint64(stateOffset, true));
  stateOffset += 8;
  const p_factor_high = BigInt(stateView.getBigUint64(stateOffset, true));
  const p_factor = (p_factor_high << BigInt(64)) | p_factor_low;

  // Calculate compounded stake: amount * (P_current / P_snapshot)
  // Guard against division by zero when snapshot is 0 (e.g., brand new stake)
  const compounded_stake =
    p_snapshot === BigInt(0) ? amount : (amount * p_factor) / p_snapshot;

  return {
    amount,
    p_snapshot,
    epoch_snapshot,
    last_update_block,
    compounded_stake,
  };
}
