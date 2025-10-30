import { PublicKey } from '@solana/web3.js';
import { PROTOCOL_PROGRAM_ID, COLLATERAL_DENOM } from '@/lib/constants/solana';

const textEncoder = new TextEncoder();

export function deriveProtocolPDAs(userPublicKey: PublicKey, collateralDenom: string = COLLATERAL_DENOM) {
  // User-specific PDAs
  const [userDebtAmount] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("user_debt_amount"), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );

  const [liquidityThreshold] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("liquidity_threshold"), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );

  const [userCollateralAmount] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("user_collateral_amount"), userPublicKey.toBuffer(), textEncoder.encode(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  // Protocol-level PDAs
  const [protocolState] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("state")],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolCollateralAccount] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("protocol_collateral_vault"), textEncoder.encode(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  const [totalCollateralAmount] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("total_collateral_amount"), textEncoder.encode(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolStablecoinAccount] = PublicKey.findProgramAddressSync(
    [textEncoder.encode("protocol_stablecoin_vault")],
    PROTOCOL_PROGRAM_ID
  );

  return {
    userDebtAmount,
    liquidityThreshold,
    userCollateralAmount,
    protocolState,
    protocolCollateralAccount,
    totalCollateralAmount,
    protocolStablecoinAccount,
  };
}

