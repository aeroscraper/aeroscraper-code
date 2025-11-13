import { Connection, PublicKey } from '@solana/web3.js';
import { PROTOCOL_PROGRAM_ID } from '@/lib/constants/solana';

export interface ProtocolStateData {
  admin: PublicKey;
  stablecoinMint: PublicKey;
  collateralMint: PublicKey;
  oracleProgramId: PublicKey;
  oracleState: PublicKey;
  feesProgramId: PublicKey;
  feesState: PublicKey;
  minimumCollateralRatio: bigint;
  protocolFee: number;
  stableCoinCodeId: bigint;
  totalDebtAmount: bigint;
  totalStakeAmount: bigint;
  pFactor: bigint;
  epoch: bigint;
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
  // - minimum_collateral_ratio: 8 bytes (u64)
  // - protocol_fee: 1 byte (u8)
  // - stable_coin_addr: 32 bytes (pubkey)
  // - stable_coin_code_id: 8 bytes (u64)
  // - total_debt_amount: 8 bytes (u64)
  // - total_stake_amount: 8 bytes (u64)
  // - p_factor: 16 bytes (u128)
  // - epoch: 8 bytes (u64)

  const data = accountInfo.data;
  const view = new DataView(data.buffer, data.byteOffset, data.length);
  let offset = 8; // Skip discriminator

  const readPubkey = () => {
    const key = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    return key;
  };

  const admin = readPubkey();
  const oracleProgramId = readPubkey();
  const oracleState = readPubkey();
  const feesProgramId = readPubkey();
  const feesState = readPubkey();

  const minimumCollateralRatio = view.getBigUint64(offset, true);
  offset += 8;
  const protocolFee = data[offset];
  offset += 1;

  const stablecoinMint = readPubkey();
  const stableCoinCodeId = view.getBigUint64(offset, true);
  offset += 8;
  const totalDebtAmount = view.getBigUint64(offset, true);
  offset += 8;
  const totalStakeAmount = view.getBigUint64(offset, true);
  offset += 8;

  const pFactorLow = view.getBigUint64(offset, true);
  offset += 8;
  const pFactorHigh = view.getBigUint64(offset, true);
  offset += 8;
  const pFactor = (pFactorHigh << BigInt(64)) | pFactorLow;

  const epoch = view.getBigUint64(offset, true);
  offset += 8;

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
    minimumCollateralRatio,
    protocolFee,
    stableCoinCodeId,
    totalDebtAmount,
    totalStakeAmount,
    pFactor,
    epoch,
  };
}

