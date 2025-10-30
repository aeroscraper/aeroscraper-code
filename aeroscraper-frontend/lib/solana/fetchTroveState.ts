import { Connection, PublicKey } from '@solana/web3.js';
import { PROTOCOL_PROGRAM_ID } from '@/lib/constants/solana';

export interface UserTroveState {
  debt: bigint;
  collateralAmount: bigint;
  icr: bigint;
}

export async function fetchUserTroveState(
  connection: Connection,
  userPublicKey: PublicKey,
  collateralDenom: string
): Promise<UserTroveState | null> {
  // Derive PDAs
  const [userDebtPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_debt_amount'), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );
  
  const [userCollateralPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_collateral_amount'), userPublicKey.toBuffer(), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );
  
  const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('liquidity_threshold'), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );
  
  // Fetch accounts
  const [debtAccount, collateralAccount, thresholdAccount] = await Promise.all([
    connection.getAccountInfo(userDebtPda),
    connection.getAccountInfo(userCollateralPda),
    connection.getAccountInfo(liquidityThresholdPda),
  ]);
  
  if (!debtAccount || !collateralAccount || !thresholdAccount) {
    return null; // Trove doesn't exist
  }
  
  // Parse debt (skip 8-byte discriminator + 32-byte owner)
  const debtData = debtAccount.data;
  const debtView = new DataView(debtData.buffer, debtData.byteOffset + 8 + 32);
  const debt = BigInt(debtView.getBigUint64(0, true));
  
  // Parse collateral (skip 8-byte discriminator + 32-byte owner + string length + string)
  const collateralData = collateralAccount.data;
  const denomLengthView = new DataView(collateralData.buffer, collateralData.byteOffset + 8 + 32);
  const denomLength = denomLengthView.getUint32(0, true);
  const collateralOffset = 8 + 32 + 4 + denomLength;
  const collateralView = new DataView(collateralData.buffer, collateralData.byteOffset + collateralOffset);
  const collateralAmount = BigInt(collateralView.getBigUint64(0, true));
  
  // Parse ICR (skip 8-byte discriminator + 32-byte owner)
  const thresholdData = thresholdAccount.data;
  const icrView = new DataView(thresholdData.buffer, thresholdData.byteOffset + 8 + 32);
  const icr = BigInt(icrView.getBigUint64(0, true));
  
  return { debt, collateralAmount, icr };
}

