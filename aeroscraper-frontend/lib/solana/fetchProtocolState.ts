import { Connection, PublicKey } from '@solana/web3.js';
import { PROTOCOL_PROGRAM_ID, ORACLE_PROGRAM_ID, FEES_PROGRAM_ID } from '@/lib/constants/solana';

export interface ProtocolStateData {
  admin: PublicKey;
  stablecoinMint: PublicKey;
  collateralMint: PublicKey;
  oracleProgramId: PublicKey;
  oracleState: PublicKey;
  feesProgramId: PublicKey;
  feesState: PublicKey;
  totalStakeAmount: bigint;
}

/**
 * Fetches protocol state from on-chain data
 */
export async function fetchProtocolState(connection: Connection): Promise<ProtocolStateData> {
  // Derive protocol state PDA
  const [protocolStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROTOCOL_PROGRAM_ID
  );

  // Fetch protocol state account
  const accountInfo = await connection.getAccountInfo(protocolStatePDA);
  if (!accountInfo) {
    throw new Error('Protocol state not found on devnet');
  }

  // Parse the StateAccount structure from the buffer
  // StateAccount layout (from IDL):
  // - discriminator: 8 bytes
  // - admin: 32 bytes (pubkey)
  // - oracle_helper_addr: 32 bytes (pubkey)
  // - oracle_state_addr: 32 bytes (pubkey)
  // - fee_distributor_addr: 32 bytes (pubkey)
  // - fee_state_addr: 32 bytes (pubkey)
  // - minimum_collateral_ratio: 1 byte (u8)
  // - protocol_fee: 1 byte (u8)
  // - stable_coin_addr: 32 bytes (pubkey)
  // - total_debt_amount: 8 bytes (u64)
  // - total_stake_amount: 8 bytes (u64)
  // - p_factor: 16 bytes (u128)
  // - epoch: 8 bytes (u64)

  const data = accountInfo.data;
  let offset = 8; // Skip discriminator

  // Read admin (32 bytes)
  const admin = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read oracle_helper_addr (this is the oracle program ID)
  const oracleProgramId = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read oracle_state_addr
  const oracleState = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read fee_distributor_addr (this is the fees program ID)
  const feesProgramId = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read fee_state_addr
  const feesState = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Skip minimum_collateral_ratio (1 byte) and protocol_fee (1 byte)
  offset += 2;

  // Read stable_coin_addr (stablecoin mint)
  const stablecoinMint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // Read total_debt_amount (u64, 8 bytes)
  const totalDebtAmount = new DataView(data.buffer, offset, 8).getBigUint64(0, true);
  offset += 8;

  // Read total_stake_amount (u64, 8 bytes)
  const totalStakeAmount = new DataView(data.buffer, offset, 8).getBigUint64(0, true);

  // Fetch collateral mint from devnet vault (same as tests in protocol-core.ts)
  const [protocolCollateralVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_collateral_vault"), Buffer.from("SOL")],
    PROTOCOL_PROGRAM_ID
  );

  const vaultAccountInfo = await connection.getAccountInfo(protocolCollateralVaultPDA);
  let collateralMint: PublicKey;

  if (vaultAccountInfo) {
    // Vault exists on devnet - fetch its mint address
    const vaultAccount = await connection.getParsedAccountInfo(protocolCollateralVaultPDA);
    if (vaultAccount.value && 'parsed' in vaultAccount.value.data) {
      collateralMint = new PublicKey(vaultAccount.value.data.parsed.info.mint);
      console.log("✅ Using existing devnet collateral mint from vault:", collateralMint.toString());
    } else {
      throw new Error("Failed to parse vault account data");
    }
  } else {
    throw new Error("Protocol collateral vault not found on devnet");
  }

  return {
    admin,
    stablecoinMint,
    collateralMint,
    oracleProgramId,
    oracleState,
    feesProgramId,
    feesState,
    totalStakeAmount,
  };
}

