import {
  TransactionInstruction,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  AccountMeta,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { serialize } from 'borsh';

// Define the schema structure
interface BorshField {
  kind: string;
  fields: any[];
}

interface BorshSchema {
  struct: { kind: string; fields: any[] };
}
import { OpenTroveParams, OpenTroveParamsSchema } from './instructionSchemas';
import { RedeemParams, RedeemParamsSchema } from './instructionSchemas';
import { deriveProtocolPDAs } from './derivePDAs';
import {
  PROTOCOL_PROGRAM_ID,
  SOL_PYTH_PRICE_FEED,
  FEE_ADDRESS_1,
  FEE_ADDRESS_2,
  STABILITY_POOL_OWNER,
} from '@/lib/constants/solana';

export async function buildOpenTroveInstruction(
  userPublicKey: PublicKey,
  collateralMint: PublicKey,
  stablecoinMint: PublicKey,
  oracleProgramId: PublicKey,
  oracleState: PublicKey,
  feesProgramId: PublicKey,
  feesState: PublicKey,
  collateralAmount: number, // in lamports
  loanAmount: string, // as string to avoid overflow
  collateralDenom: string = 'SOL',
  neighborHints: PublicKey[] = [] // New parameter for neighbor hints
): Promise<{ instruction: TransactionInstruction; accountMetas: AccountMeta[] }> {
  console.log('🔨 Building open_trove instruction...');
  console.log('User:', userPublicKey.toBase58());
  console.log('Collateral amount:', collateralAmount, 'lamports');
  console.log('Loan amount:', loanAmount);
  console.log('Collateral denom:', collateralDenom);
  console.log('Neighbor hints:', neighborHints.length, 'accounts');

  // 1. Derive all PDAs
  const pdas = deriveProtocolPDAs(userPublicKey, collateralDenom);
  console.log('✅ Derived PDAs');
  console.log('📍 All PDA addresses:');
  console.log('  - userDebtAmount:', pdas.userDebtAmount.toBase58());
  console.log('  - liquidityThreshold:', pdas.liquidityThreshold.toBase58());
  console.log('  - userCollateralAmount:', pdas.userCollateralAmount.toBase58());
  console.log('  - protocolState:', pdas.protocolState.toBase58());
  console.log('  - protocolCollateralAccount:', pdas.protocolCollateralAccount.toBase58());
  console.log('  - totalCollateralAmount:', pdas.totalCollateralAmount.toBase58());
  console.log('  - protocolStablecoinAccount:', pdas.protocolStablecoinAccount.toBase58());

  // 2. Get token accounts
  console.log('📝 Getting token accounts...');
  const userCollateralTokenAccount = await getAssociatedTokenAddress(collateralMint, userPublicKey);
  const userStablecoinTokenAccount = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);
  // Fix: Use protocol stability pool owner instead of user
  const stabilityPoolTokenAccount = await getAssociatedTokenAddress(stablecoinMint, STABILITY_POOL_OWNER);
  const feeAddress1TokenAccount = await getAssociatedTokenAddress(stablecoinMint, FEE_ADDRESS_1);
  const feeAddress2TokenAccount = await getAssociatedTokenAddress(stablecoinMint, FEE_ADDRESS_2);
  console.log('✅ Token accounts derived');
  console.log('📍 All token account addresses:');
  console.log('  - userCollateralAccount:', userCollateralTokenAccount.toBase58());
  console.log('  - userStablecoinAccount:', userStablecoinTokenAccount.toBase58());
  console.log('  - stabilityPoolTokenAccount:', stabilityPoolTokenAccount.toBase58());
  console.log('  - feeAddress1TokenAccount:', feeAddress1TokenAccount.toBase58());
  console.log('  - feeAddress2TokenAccount:', feeAddress2TokenAccount.toBase58());
  console.log('  - collateralMint:', collateralMint.toBase58());
  console.log('  - stablecoinMint:', stablecoinMint.toBase58());

  // 3. Build instruction data manually (Borsh serialization)
  console.log('📦 Serializing instruction data...');
  const discriminator = new Uint8Array([203, 232, 64, 109, 35, 83, 74, 109]); // From IDL

  // Serialize params manually
  const loanAmountBigInt = BigInt(loanAmount);
  const collateralAmountBigInt = BigInt(collateralAmount);

  // u64 serialization (8 bytes, little-endian)
  const loanAmountBuffer = new Uint8Array(8);
  const loanAmountView = new DataView(loanAmountBuffer.buffer);
  loanAmountView.setBigUint64(0, loanAmountBigInt, true);

  const collateralAmountBuffer = new Uint8Array(8);
  const collateralAmountView = new DataView(collateralAmountBuffer.buffer);
  collateralAmountView.setBigUint64(0, collateralAmountBigInt, true);

  // String serialization (length + bytes)
  const denomBytes = new TextEncoder().encode(collateralDenom);
  const denomLengthBuffer = new Uint8Array(4);
  new DataView(denomLengthBuffer.buffer).setUint32(0, denomBytes.length, true);

  // Combine all data
  const totalLength = discriminator.length + loanAmountBuffer.length + denomLengthBuffer.length + denomBytes.length + collateralAmountBuffer.length;
  const data = new Uint8Array(totalLength);
  let offset = 0;
  data.set(discriminator, offset);
  offset += discriminator.length;
  data.set(loanAmountBuffer, offset);
  offset += loanAmountBuffer.length;
  data.set(denomLengthBuffer, offset);
  offset += denomLengthBuffer.length;
  data.set(denomBytes, offset);
  offset += denomBytes.length;
  data.set(collateralAmountBuffer, offset);
  console.log('✅ Instruction data serialized, length:', totalLength);

  // 4. Build account metas (order must match IDL exactly)
  console.log('📋 Building account metas (23 required accounts)...');
  const accountMetas: AccountMeta[] = [
    { pubkey: userPublicKey, isSigner: true, isWritable: true }, // user
    { pubkey: pdas.userDebtAmount, isSigner: false, isWritable: true }, // user_debt_amount
    { pubkey: pdas.liquidityThreshold, isSigner: false, isWritable: true }, // liquidity_threshold
    { pubkey: pdas.userCollateralAmount, isSigner: false, isWritable: true }, // user_collateral_amount
    { pubkey: userCollateralTokenAccount, isSigner: false, isWritable: true }, // user_collateral_account
    { pubkey: collateralMint, isSigner: false, isWritable: false }, // collateral_mint
    { pubkey: pdas.protocolCollateralAccount, isSigner: false, isWritable: true }, // protocol_collateral_account
    { pubkey: pdas.totalCollateralAmount, isSigner: false, isWritable: true }, // total_collateral_amount
    { pubkey: pdas.protocolState, isSigner: false, isWritable: true }, // state
    { pubkey: userStablecoinTokenAccount, isSigner: false, isWritable: true }, // user_stablecoin_account
    { pubkey: pdas.protocolStablecoinAccount, isSigner: false, isWritable: true }, // protocol_stablecoin_account
    { pubkey: stablecoinMint, isSigner: false, isWritable: true }, // stable_coin_mint
    { pubkey: oracleProgramId, isSigner: false, isWritable: false }, // oracle_program
    { pubkey: oracleState, isSigner: false, isWritable: true }, // oracle_state
    { pubkey: SOL_PYTH_PRICE_FEED, isSigner: false, isWritable: false }, // pyth_price_account
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // clock
    { pubkey: feesProgramId, isSigner: false, isWritable: false }, // fees_program
    { pubkey: feesState, isSigner: false, isWritable: true }, // fees_state
    { pubkey: stabilityPoolTokenAccount, isSigner: false, isWritable: true }, // stability_pool_token_account
    { pubkey: feeAddress1TokenAccount, isSigner: false, isWritable: true }, // fee_address_1_token_account
    { pubkey: feeAddress2TokenAccount, isSigner: false, isWritable: true }, // fee_address_2_token_account
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  // Log all account addresses with their roles
  console.log('📋 Account metas list:');
  accountMetas.forEach((meta, idx) => {
    const flags = `${meta.isSigner ? 'S' : '-'}${meta.isWritable ? 'W' : '-'}`;
    console.log(`  [${idx}] ${meta.pubkey.toBase58()} ${flags}`);
  });

  // Add remaining accounts for neighbor validation (read-only)
  const remainingAccounts: AccountMeta[] = neighborHints.map(pubkey => ({
    pubkey,
    isSigner: false,
    isWritable: false, // Read-only for ICR validation
  }));

  const instruction = new TransactionInstruction({
    keys: [...accountMetas, ...remainingAccounts], // Append neighbors
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data), // Convert Uint8Array to Buffer
  });

  console.log('✅ Instruction built successfully');
  console.log('📊 Total accounts:', accountMetas.length + remainingAccounts.length);
  console.log('🔗 Program ID:', PROTOCOL_PROGRAM_ID.toBase58());

  // Log detailed account information for debugging
  console.log('\n📋 Complete Account List for open_trove:');
  const allAccounts = [...accountMetas, ...remainingAccounts];
  allAccounts.forEach((meta, idx) => {
    const flags = `${meta.isSigner ? 'S' : '-'}${meta.isWritable ? 'W' : '-'}`;
    console.log(`  [${idx}] ${meta.pubkey.toBase58()} ${flags}`);
  });
  console.log('');

  return { instruction, accountMetas };
}

export async function buildAddCollateralInstruction(
  userPublicKey: PublicKey,
  collateralMint: PublicKey,
  oracleProgramId: PublicKey,
  oracleState: PublicKey,
  collateralAmount: number, // in lamports
  collateralDenom: string = 'SOL',
  neighborHints: PublicKey[] = []
): Promise<{ instruction: TransactionInstruction }> {
  console.log('🔨 Building add_collateral instruction...');

  // 1. Derive PDAs
  const pdas = deriveProtocolPDAs(userPublicKey, collateralDenom);

  // 2. Get token accounts
  const userCollateralTokenAccount = await getAssociatedTokenAddress(collateralMint, userPublicKey);

  // 3. Build instruction data (discriminator from IDL: [127, 82, 121, 42, 161, 176, 249, 206])
  const discriminator = new Uint8Array([127, 82, 121, 42, 161, 176, 249, 206]);

  // Serialize params manually
  const collateralAmountBigInt = BigInt(collateralAmount);

  // u64 serialization
  const amountBuffer = new Uint8Array(8);
  new DataView(amountBuffer.buffer).setBigUint64(0, collateralAmountBigInt, true);

  // String serialization
  const denomBytes = new TextEncoder().encode(collateralDenom);
  const denomLengthBuffer = new Uint8Array(4);
  new DataView(denomLengthBuffer.buffer).setUint32(0, denomBytes.length, true);

  // Option<Pubkey> for prev_node_id (None = 0x00)
  const prevNodeIdBuffer = new Uint8Array(1);
  prevNodeIdBuffer[0] = 0; // None

  // Option<Pubkey> for next_node_id (None = 0x00)
  const nextNodeIdBuffer = new Uint8Array(1);
  nextNodeIdBuffer[0] = 0; // None

  // Combine all data
  const totalLength = discriminator.length + amountBuffer.length +
    denomLengthBuffer.length + denomBytes.length +
    prevNodeIdBuffer.length + nextNodeIdBuffer.length;
  const data = new Uint8Array(totalLength);
  let offset = 0;
  data.set(discriminator, offset); offset += discriminator.length;
  data.set(amountBuffer, offset); offset += amountBuffer.length;
  data.set(denomLengthBuffer, offset); offset += denomLengthBuffer.length;
  data.set(denomBytes, offset); offset += denomBytes.length;
  data.set(prevNodeIdBuffer, offset); offset += prevNodeIdBuffer.length;
  data.set(nextNodeIdBuffer, offset);

  // 4. Build account metas (15 required accounts from IDL)
  const accountMetas: AccountMeta[] = [
    { pubkey: userPublicKey, isSigner: true, isWritable: true }, // user
    { pubkey: pdas.userDebtAmount, isSigner: false, isWritable: true }, // user_debt_amount
    { pubkey: pdas.userCollateralAmount, isSigner: false, isWritable: true }, // user_collateral_amount
    { pubkey: pdas.liquidityThreshold, isSigner: false, isWritable: true }, // liquidity_threshold
    { pubkey: pdas.protocolState, isSigner: false, isWritable: true }, // state
    { pubkey: userCollateralTokenAccount, isSigner: false, isWritable: true }, // user_collateral_account
    { pubkey: collateralMint, isSigner: false, isWritable: false }, // collateral_mint
    { pubkey: pdas.protocolCollateralAccount, isSigner: false, isWritable: true }, // protocol_collateral_account
    { pubkey: pdas.totalCollateralAmount, isSigner: false, isWritable: true }, // total_collateral_amount
    { pubkey: oracleProgramId, isSigner: false, isWritable: false }, // oracle_program
    { pubkey: oracleState, isSigner: false, isWritable: true }, // oracle_state
    { pubkey: SOL_PYTH_PRICE_FEED, isSigner: false, isWritable: false }, // pyth_price_account
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // clock
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  // Add remaining accounts for neighbor validation
  const remainingAccounts: AccountMeta[] = neighborHints.map(pubkey => ({
    pubkey,
    isSigner: false,
    isWritable: false,
  }));

  const instruction = new TransactionInstruction({
    keys: [...accountMetas, ...remainingAccounts],
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data),
  });

  console.log('✅ add_collateral instruction built');
  console.log('📊 Total accounts:', accountMetas.length + remainingAccounts.length);

  return { instruction };
}

export async function buildRemoveCollateralInstruction(
  userPublicKey: PublicKey,
  collateralMint: PublicKey,
  oracleProgramId: PublicKey,
  oracleState: PublicKey,
  collateralAmount: number, // in lamports
  collateralDenom: string = 'SOL',
  neighborHints: PublicKey[] = []
): Promise<{ instruction: TransactionInstruction }> {
  console.log('🔨 Building remove_collateral instruction...');

  // 1. Derive PDAs
  const pdas = deriveProtocolPDAs(userPublicKey, collateralDenom);

  // 2. Get token accounts
  const userCollateralTokenAccount = await getAssociatedTokenAddress(collateralMint, userPublicKey);

  // 3. Build instruction data (discriminator from IDL: [86, 222, 130, 86, 92, 20, 72, 65])
  const discriminator = new Uint8Array([86, 222, 130, 86, 92, 20, 72, 65]);

  // Serialize params manually
  const collateralAmountBigInt = BigInt(collateralAmount);

  // u64 serialization
  const amountBuffer = new Uint8Array(8);
  new DataView(amountBuffer.buffer).setBigUint64(0, collateralAmountBigInt, true);

  // String serialization
  const denomBytes = new TextEncoder().encode(collateralDenom);
  const denomLengthBuffer = new Uint8Array(4);
  new DataView(denomLengthBuffer.buffer).setUint32(0, denomBytes.length, true);

  // Option<Pubkey> for prev_node_id (None = 0x00)
  const prevNodeIdBuffer = new Uint8Array(1);
  prevNodeIdBuffer[0] = 0; // None

  // Option<Pubkey> for next_node_id (None = 0x00)
  const nextNodeIdBuffer = new Uint8Array(1);
  nextNodeIdBuffer[0] = 0; // None

  // Combine all data
  const totalLength = discriminator.length + amountBuffer.length +
    denomLengthBuffer.length + denomBytes.length +
    prevNodeIdBuffer.length + nextNodeIdBuffer.length;
  const data = new Uint8Array(totalLength);
  let offset = 0;
  data.set(discriminator, offset); offset += discriminator.length;
  data.set(amountBuffer, offset); offset += amountBuffer.length;
  data.set(denomLengthBuffer, offset); offset += denomLengthBuffer.length;
  data.set(denomBytes, offset); offset += denomBytes.length;
  data.set(prevNodeIdBuffer, offset); offset += prevNodeIdBuffer.length;
  data.set(nextNodeIdBuffer, offset);

  // 4. Build account metas (15 required accounts from IDL)
  const accountMetas: AccountMeta[] = [
    { pubkey: userPublicKey, isSigner: true, isWritable: true }, // user
    { pubkey: pdas.userDebtAmount, isSigner: false, isWritable: true }, // user_debt_amount
    { pubkey: pdas.userCollateralAmount, isSigner: false, isWritable: true }, // user_collateral_amount
    { pubkey: pdas.liquidityThreshold, isSigner: false, isWritable: true }, // liquidity_threshold
    { pubkey: pdas.protocolState, isSigner: false, isWritable: true }, // state
    { pubkey: userCollateralTokenAccount, isSigner: false, isWritable: true }, // user_collateral_account
    { pubkey: collateralMint, isSigner: false, isWritable: false }, // collateral_mint
    { pubkey: pdas.protocolCollateralAccount, isSigner: false, isWritable: true }, // protocol_collateral_account
    { pubkey: pdas.totalCollateralAmount, isSigner: false, isWritable: true }, // total_collateral_amount
    { pubkey: oracleProgramId, isSigner: false, isWritable: false }, // oracle_program
    { pubkey: oracleState, isSigner: false, isWritable: true }, // oracle_state
    { pubkey: SOL_PYTH_PRICE_FEED, isSigner: false, isWritable: false }, // pyth_price_account
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // clock
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  // Add remaining accounts for neighbor validation
  const remainingAccounts: AccountMeta[] = neighborHints.map(pubkey => ({
    pubkey,
    isSigner: false,
    isWritable: false,
  }));

  const instruction = new TransactionInstruction({
    keys: [...accountMetas, ...remainingAccounts],
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data),
  });

  console.log('✅ remove_collateral instruction built');
  console.log('📊 Total accounts:', accountMetas.length + remainingAccounts.length);

  return { instruction };
}

export async function buildBorrowLoanInstruction(
  userPublicKey: PublicKey,
  collateralMint: PublicKey,
  stablecoinMint: PublicKey,
  oracleProgramId: PublicKey,
  oracleState: PublicKey,
  feesProgramId: PublicKey,
  feesState: PublicKey,
  loanAmount: number, // in smallest unit (1e18 for aUSD)
  collateralDenom: string = 'SOL',
  neighborHints: PublicKey[] = []
): Promise<{ instruction: TransactionInstruction }> {
  console.log('🔨 Building borrow_loan instruction...');
  console.log('  - Loan amount:', loanAmount);

  // 1. Derive PDAs
  const pdas = deriveProtocolPDAs(userPublicKey, collateralDenom);

  // 2. Get token accounts
  const userCollateralTokenAccount = await getAssociatedTokenAddress(collateralMint, userPublicKey);
  const userStablecoinAccount = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);
  const stabilityPoolTokenAccount = await getAssociatedTokenAddress(stablecoinMint, STABILITY_POOL_OWNER);
  const feeAddress1TokenAccount = await getAssociatedTokenAddress(stablecoinMint, FEE_ADDRESS_1);
  const feeAddress2TokenAccount = await getAssociatedTokenAddress(stablecoinMint, FEE_ADDRESS_2);

  // 3. Build instruction data (discriminator from IDL: [102, 104, 167, 127, 209, 245, 251, 194])
  const discriminator = new Uint8Array([102, 104, 167, 127, 209, 245, 251, 194]);

  // Serialize params
  const loanAmountBigInt = BigInt(loanAmount);

  // u64 serialization for loan_amount
  const amountBuffer = new Uint8Array(8);
  new DataView(amountBuffer.buffer).setBigUint64(0, loanAmountBigInt, true);

  // String serialization for collateral_denom
  const denomBytes = new TextEncoder().encode(collateralDenom);
  const denomLengthBuffer = new Uint8Array(4);
  new DataView(denomLengthBuffer.buffer).setUint32(0, denomBytes.length, true);

  // Option<Pubkey> for prev_node_id (None = 0x00)
  const prevNodeIdBuffer = new Uint8Array(1);
  prevNodeIdBuffer[0] = 0; // None

  // Option<Pubkey> for next_node_id (None = 0x00)
  const nextNodeIdBuffer = new Uint8Array(1);
  nextNodeIdBuffer[0] = 0; // None

  // Combine all data
  const totalLength = discriminator.length + amountBuffer.length +
    denomLengthBuffer.length + denomBytes.length +
    prevNodeIdBuffer.length + nextNodeIdBuffer.length;
  const data = new Uint8Array(totalLength);
  let offset = 0;
  data.set(discriminator, offset); offset += discriminator.length;
  data.set(amountBuffer, offset); offset += amountBuffer.length;
  data.set(denomLengthBuffer, offset); offset += denomLengthBuffer.length;
  data.set(denomBytes, offset); offset += denomBytes.length;
  data.set(prevNodeIdBuffer, offset); offset += prevNodeIdBuffer.length;
  data.set(nextNodeIdBuffer, offset);

  // 4. Build account metas (21 required accounts from IDL)
  const accountMetas: AccountMeta[] = [
    { pubkey: userPublicKey, isSigner: true, isWritable: true }, // user
    { pubkey: pdas.userDebtAmount, isSigner: false, isWritable: true }, // user_debt_amount
    { pubkey: pdas.liquidityThreshold, isSigner: false, isWritable: true }, // liquidity_threshold
    { pubkey: pdas.protocolState, isSigner: false, isWritable: true }, // state
    { pubkey: userStablecoinAccount, isSigner: false, isWritable: true }, // user_stablecoin_account
    { pubkey: stablecoinMint, isSigner: false, isWritable: true }, // stable_coin_mint
    { pubkey: pdas.protocolStablecoinAccount, isSigner: false, isWritable: true }, // protocol_stablecoin_account
    { pubkey: pdas.userCollateralAmount, isSigner: false, isWritable: true }, // user_collateral_amount
    { pubkey: userCollateralTokenAccount, isSigner: false, isWritable: true }, // user_collateral_account
    { pubkey: collateralMint, isSigner: false, isWritable: false }, // collateral_mint
    { pubkey: pdas.protocolCollateralAccount, isSigner: false, isWritable: true }, // protocol_collateral_account
    { pubkey: pdas.totalCollateralAmount, isSigner: false, isWritable: true }, // total_collateral_amount
    { pubkey: oracleProgramId, isSigner: false, isWritable: true }, // oracle_program
    { pubkey: oracleState, isSigner: false, isWritable: true }, // oracle_state
    { pubkey: SOL_PYTH_PRICE_FEED, isSigner: false, isWritable: false }, // pyth_price_account
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // clock
    { pubkey: feesProgramId, isSigner: false, isWritable: false }, // fees_program
    { pubkey: feesState, isSigner: false, isWritable: true }, // fees_state
    { pubkey: stabilityPoolTokenAccount, isSigner: false, isWritable: true }, // stability_pool_token_account
    { pubkey: feeAddress1TokenAccount, isSigner: false, isWritable: true }, // fee_address_1_token_account
    { pubkey: feeAddress2TokenAccount, isSigner: false, isWritable: true }, // fee_address_2_token_account
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  // Add remaining accounts for neighbor validation
  const remainingAccounts: AccountMeta[] = neighborHints.map(pubkey => ({
    pubkey,
    isSigner: false,
    isWritable: false,
  }));

  const instruction = new TransactionInstruction({
    keys: [...accountMetas, ...remainingAccounts],
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data),
  });

  console.log('✅ borrow_loan instruction built');
  console.log('📊 Total accounts:', accountMetas.length + remainingAccounts.length);

  return { instruction };
}

export async function buildRepayLoanInstruction(
  userPublicKey: PublicKey,
  collateralMint: PublicKey,
  stablecoinMint: PublicKey,
  oracleProgramId: PublicKey,
  oracleState: PublicKey,
  repayAmount: number,
  collateralDenom: string = 'SOL',
  neighborHints: PublicKey[] = []
): Promise<{ instruction: TransactionInstruction }> {
  console.log('🔨 Building repay_loan instruction...');
  console.log('  - Repay amount:', repayAmount);

  // 1. Derive PDAs
  const pdas = deriveProtocolPDAs(userPublicKey, collateralDenom);

  // 2. Get token accounts
  const userCollateralTokenAccount = await getAssociatedTokenAddress(collateralMint, userPublicKey);
  const userStablecoinAccount = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);

  // 3. Build instruction data (discriminator from IDL: [224, 93, 144, 77, 61, 17, 137, 54])
  const discriminator = new Uint8Array([224, 93, 144, 77, 61, 17, 137, 54]);

  // Serialize params
  const repayAmountBigInt = BigInt(repayAmount);

  // u64 serialization for amount
  const amountBuffer = new Uint8Array(8);
  new DataView(amountBuffer.buffer).setBigUint64(0, repayAmountBigInt, true);

  // String serialization for collateral_denom
  const denomBytes = new TextEncoder().encode(collateralDenom);
  const denomLengthBuffer = new Uint8Array(4);
  new DataView(denomLengthBuffer.buffer).setUint32(0, denomBytes.length, true);

  // Option<Pubkey> for prev_node_id (None = 0x00)
  const prevNodeIdBuffer = new Uint8Array(1);
  prevNodeIdBuffer[0] = 0; // None

  // Option<Pubkey> for next_node_id (None = 0x00)
  const nextNodeIdBuffer = new Uint8Array(1);
  nextNodeIdBuffer[0] = 0; // None

  // Combine all data
  const totalLength = discriminator.length + amountBuffer.length +
    denomLengthBuffer.length + denomBytes.length +
    prevNodeIdBuffer.length + nextNodeIdBuffer.length;
  const data = new Uint8Array(totalLength);
  let offset = 0;
  data.set(discriminator, offset); offset += discriminator.length;
  data.set(amountBuffer, offset); offset += amountBuffer.length;
  data.set(denomLengthBuffer, offset); offset += denomLengthBuffer.length;
  data.set(denomBytes, offset); offset += denomBytes.length;
  data.set(prevNodeIdBuffer, offset); offset += prevNodeIdBuffer.length;
  data.set(nextNodeIdBuffer, offset);

  // 4. Build account metas (17 required accounts from IDL)
  const accountMetas: AccountMeta[] = [
    { pubkey: userPublicKey, isSigner: true, isWritable: true }, // user
    { pubkey: pdas.userDebtAmount, isSigner: false, isWritable: true }, // user_debt_amount
    { pubkey: pdas.userCollateralAmount, isSigner: false, isWritable: true }, // user_collateral_amount
    { pubkey: pdas.liquidityThreshold, isSigner: false, isWritable: true }, // liquidity_threshold
    { pubkey: pdas.protocolState, isSigner: false, isWritable: true }, // state
    { pubkey: userStablecoinAccount, isSigner: false, isWritable: true }, // user_stablecoin_account
    { pubkey: userCollateralTokenAccount, isSigner: false, isWritable: true }, // user_collateral_account
    { pubkey: collateralMint, isSigner: false, isWritable: false }, // collateral_mint
    { pubkey: pdas.protocolCollateralAccount, isSigner: false, isWritable: true }, // protocol_collateral_account
    { pubkey: stablecoinMint, isSigner: false, isWritable: true }, // stable_coin_mint
    { pubkey: pdas.totalCollateralAmount, isSigner: false, isWritable: true }, // total_collateral_amount
    { pubkey: oracleProgramId, isSigner: false, isWritable: false }, // oracle_program
    { pubkey: oracleState, isSigner: false, isWritable: true }, // oracle_state
    { pubkey: SOL_PYTH_PRICE_FEED, isSigner: false, isWritable: false }, // pyth_price_account
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // clock
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  // Add remaining accounts for neighbor validation
  const remainingAccounts: AccountMeta[] = neighborHints.map(pubkey => ({
    pubkey,
    isSigner: false,
    isWritable: false,
  }));

  const instruction = new TransactionInstruction({
    keys: [...accountMetas, ...remainingAccounts],
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data),
  });

  console.log('✅ repay_loan instruction built');
  console.log('📊 Total accounts:', accountMetas.length + remainingAccounts.length);

  return { instruction };
}

export async function buildStakeInstruction(
  userPublicKey: PublicKey,
  stablecoinMint: PublicKey,
  stakeAmount: number, // in smallest unit (1e18 for aUSD)
): Promise<{ instruction: TransactionInstruction }> {
  console.log('🔨 Building stake instruction...');
  console.log('User:', userPublicKey.toBase58());
  console.log('Stake amount:', stakeAmount);

  // 1. Derive PDAs
  const [userStakeAmountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_stake_amount'), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolStablecoinVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_stablecoin_vault')],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROTOCOL_PROGRAM_ID
  );

  console.log('✅ Derived PDAs');
  console.log('📍 PDA addresses:');
  console.log('  - userStakeAmount:', userStakeAmountPDA.toBase58());
  console.log('  - protocolStablecoinVault:', protocolStablecoinVaultPDA.toBase58());
  console.log('  - protocolState:', protocolStatePDA.toBase58());

  // 2. Get token accounts
  const userStablecoinAccount = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);
  console.log('📝 User stablecoin ATA:', userStablecoinAccount.toBase58());

  // 3. Build instruction data (discriminator from IDL: [206, 176, 202, 18, 200, 209, 179, 108])
  const discriminator = new Uint8Array([206, 176, 202, 18, 200, 209, 179, 108]);

  // Serialize params
  const stakeAmountBigInt = BigInt(stakeAmount);

  // u64 serialization for amount
  const amountBuffer = new Uint8Array(8);
  new DataView(amountBuffer.buffer).setBigUint64(0, stakeAmountBigInt, true);

  // Combine all data
  const totalLength = discriminator.length + amountBuffer.length;
  const data = new Uint8Array(totalLength);
  let offset = 0;
  data.set(discriminator, offset);
  offset += discriminator.length;
  data.set(amountBuffer, offset);

  console.log('✅ Instruction data serialized, length:', totalLength);

  // 4. Build account metas (8 accounts from IDL lines 2269-2366)
  const accountMetas: AccountMeta[] = [
    { pubkey: userPublicKey, isSigner: true, isWritable: true }, // user
    { pubkey: userStakeAmountPDA, isSigner: false, isWritable: true }, // user_stake_amount
    { pubkey: protocolStatePDA, isSigner: false, isWritable: true }, // state
    { pubkey: userStablecoinAccount, isSigner: false, isWritable: true }, // user_stablecoin_account
    { pubkey: protocolStablecoinVaultPDA, isSigner: false, isWritable: true }, // protocol_stablecoin_vault
    { pubkey: stablecoinMint, isSigner: false, isWritable: false }, // stable_coin_mint
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  console.log('📋 Account metas list:');
  accountMetas.forEach((meta, idx) => {
    const flags = `${meta.isSigner ? 'S' : '-'}${meta.isWritable ? 'W' : '-'}`;
    console.log(`  [${idx}] ${meta.pubkey.toBase58()} ${flags}`);
  });

  const instruction = new TransactionInstruction({
    keys: accountMetas,
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data),
  });

  console.log('✅ stake instruction built');
  console.log('📊 Total accounts:', accountMetas.length);
  console.log('🔗 Program ID:', PROTOCOL_PROGRAM_ID.toBase58());

  return { instruction };
}

export async function buildUnstakeInstruction(
  userPublicKey: PublicKey,
  stablecoinMint: PublicKey,
  unstakeAmount: number, // in smallest unit (1e18 for aUSD)
): Promise<{ instruction: TransactionInstruction }> {
  console.log('🔨 Building unstake instruction...');
  console.log('User:', userPublicKey.toBase58());
  console.log('Unstake amount:', unstakeAmount);

  // 1. Derive PDAs
  const [userStakeAmountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_stake_amount'), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolStablecoinVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_stablecoin_vault')],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROTOCOL_PROGRAM_ID
  );

  console.log('✅ Derived PDAs');
  console.log('📍 PDA addresses:');
  console.log('  - userStakeAmount:', userStakeAmountPDA.toBase58());
  console.log('  - protocolStablecoinVault:', protocolStablecoinVaultPDA.toBase58());
  console.log('  - protocolState:', protocolStatePDA.toBase58());

  // 2. Get token accounts
  const userStablecoinAccount = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);
  console.log('📝 User stablecoin ATA:', userStablecoinAccount.toBase58());

  // 3. Build instruction data (discriminator from IDL line 2439: [90, 95, 107, 42, 205, 124, 50, 225])
  const discriminator = new Uint8Array([90, 95, 107, 42, 205, 124, 50, 225]);

  // Serialize params
  const unstakeAmountBigInt = BigInt(unstakeAmount);

  // u64 serialization for amount
  const amountBuffer = new Uint8Array(8);
  new DataView(amountBuffer.buffer).setBigUint64(0, unstakeAmountBigInt, true);

  // Combine all data
  const totalLength = discriminator.length + amountBuffer.length;
  const data = new Uint8Array(totalLength);
  let offset = 0;
  data.set(discriminator, offset);
  offset += discriminator.length;
  data.set(amountBuffer, offset);

  console.log('✅ Instruction data serialized, length:', totalLength);

  // 4. Build account metas (7 accounts from IDL lines 2449-2542)
  const accountMetas: AccountMeta[] = [
    { pubkey: userPublicKey, isSigner: true, isWritable: true }, // user
    { pubkey: userStakeAmountPDA, isSigner: false, isWritable: true }, // user_stake_amount
    { pubkey: protocolStatePDA, isSigner: false, isWritable: true }, // state
    { pubkey: userStablecoinAccount, isSigner: false, isWritable: true }, // user_stablecoin_account
    { pubkey: protocolStablecoinVaultPDA, isSigner: false, isWritable: true }, // protocol_stablecoin_vault
    { pubkey: stablecoinMint, isSigner: false, isWritable: false }, // stable_coin_mint
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
  ];

  console.log('📋 Account metas list:');
  accountMetas.forEach((meta, idx) => {
    const flags = `${meta.isSigner ? 'S' : '-'}${meta.isWritable ? 'W' : '-'}`;
    console.log(`  [${idx}] ${meta.pubkey.toBase58()} ${flags}`);
  });

  const instruction = new TransactionInstruction({
    keys: accountMetas,
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data),
  });

  console.log('✅ unstake instruction built');
  console.log('📊 Total accounts:', accountMetas.length);
  console.log('🔗 Program ID:', PROTOCOL_PROGRAM_ID.toBase58());

  return { instruction };
}

export async function buildLiquidateTrovesInstruction(
  liquidator: PublicKey,
  liquidationList: PublicKey[],
  collateralDenom: string,
  collateralMint: PublicKey,
  stablecoinMint: PublicKey,
  oracleProgramId: PublicKey,
  oracleState: PublicKey
): Promise<{ instruction: TransactionInstruction }> {
  console.log('🔨 Building liquidate_troves instruction...');
  console.log('Liquidator:', liquidator.toBase58());
  console.log('Troves to liquidate:', liquidationList.length);
  console.log('Collateral denom:', collateralDenom);

  // 1. Derive PDAs
  const [protocolStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolStablecoinVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_stablecoin_vault')],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolCollateralVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_collateral_vault'), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  const [totalCollateralAmountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('total_collateral_amount'), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  // 2. Build instruction data (discriminator from IDL: [151, 204, 230, 0, 127, 203, 57, 28])
  const discriminator = new Uint8Array([151, 204, 230, 0, 127, 203, 57, 28]);

  // Serialize Vec<Pubkey>
  // First, serialize the length of the vector as u32 (4 bytes, little-endian)
  const vecLength = liquidationList.length;
  const vecLengthBuffer = new Uint8Array(new ArrayBuffer(4));
  new DataView(vecLengthBuffer.buffer).setUint32(0, vecLength, true);

  // Serialize each Pubkey (32 bytes each)
  const liquidationListBytes: Uint8Array[] = [];
  liquidationList.forEach(pubkey => {
    const pkBytes = pubkey.toBytes();
    // Verify pubkey is exactly 32 bytes
    if (pkBytes.length !== 32) {
      throw new Error(`Invalid pubkey length: ${pkBytes.length}, expected 32 bytes`);
    }
    // Create a proper copy (not a view) to ensure data integrity
    liquidationListBytes.push(new Uint8Array(pkBytes));
  });

  // String serialization for collateral_denom (length u32 + bytes)
  const denomBytes = new TextEncoder().encode(collateralDenom);
  const denomLengthBuffer = new Uint8Array(new ArrayBuffer(4));
  new DataView(denomLengthBuffer.buffer).setUint32(0, denomBytes.length, true);

  // Combine all data using Uint8Array only
  // Calculate actual length using reduce to sum all byte lengths
  const totalPubkeyBytes = liquidationListBytes.reduce((sum, bytes) => sum + bytes.length, 0);
  const liquidationListDataLength = vecLengthBuffer.length + totalPubkeyBytes;

  // Create a contiguous buffer for liquidation list data
  const liquidationListData = new Uint8Array(liquidationListDataLength);
  let listOffset = 0;

  // Copy vec length (u32, 4 bytes)
  liquidationListData.set(vecLengthBuffer, listOffset);
  listOffset += vecLengthBuffer.length;

  // Copy each pubkey (32 bytes each)
  for (const pkBytes of liquidationListBytes) {
    liquidationListData.set(pkBytes, listOffset);
    listOffset += pkBytes.length;
  }

  // Verify we filled the buffer correctly
  if (listOffset !== liquidationListDataLength) {
    throw new Error(`Liquidation list data offset mismatch: expected ${liquidationListDataLength}, got ${listOffset}`);
  }

  const totalLength = discriminator.length + liquidationListData.length + denomLengthBuffer.length + denomBytes.length;

  // Validate expected length matches calculated length
  const expectedLength = 8 + // discriminator
    4 + // vec length (u32)
    (vecLength * 32) + // pubkeys (32 bytes each)
    4 + // string length (u32)
    denomBytes.length; // string bytes

  if (totalLength !== expectedLength) {
    console.error('❌ Length mismatch!');
    console.error(`  Expected: ${expectedLength} bytes`);
    console.error(`  Calculated: ${totalLength} bytes`);
    console.error(`  Breakdown:`);
    console.error(`    Discriminator: 8`);
    console.error(`    Vec length: 4`);
    console.error(`    Pubkeys: ${vecLength} * 32 = ${vecLength * 32}`);
    console.error(`    String length: 4`);
    console.error(`    String bytes: ${denomBytes.length}`);
    throw new Error(`Serialization length mismatch: expected ${expectedLength}, got ${totalLength}`);
  }

  // Build final data array with proper copying
  const data = new Uint8Array(totalLength);
  let offset = 0;

  // Copy discriminator
  data.set(discriminator, offset);
  offset += discriminator.length;

  // Copy liquidation list data (vec length + pubkeys)
  data.set(liquidationListData, offset);
  offset += liquidationListData.length;

  // Copy string length
  data.set(denomLengthBuffer, offset);
  offset += denomLengthBuffer.length;

  // Copy string bytes
  data.set(denomBytes, offset);

  // Verify final length
  if (offset + denomBytes.length !== totalLength) {
    throw new Error(`Final offset mismatch: expected ${totalLength}, got ${offset + denomBytes.length}`);
  }

  console.log('✅ Instruction data serialized, length:', totalLength);
  console.log('📊 Serialization details:');
  console.log(`  - Vec length: ${vecLength}`);
  console.log(`  - Pubkeys: ${vecLength} × 32 = ${vecLength * 32} bytes`);
  console.log(`  - Collateral denom: "${collateralDenom}" (${denomBytes.length} bytes)`);

  // 3. Build account metas for main accounts (11 accounts from IDL)
  const accountMetas: AccountMeta[] = [
    { pubkey: liquidator, isSigner: true, isWritable: true }, // liquidator
    { pubkey: protocolStatePDA, isSigner: false, isWritable: true }, // state
    { pubkey: stablecoinMint, isSigner: false, isWritable: true }, // stable_coin_mint
    { pubkey: protocolStablecoinVaultPDA, isSigner: false, isWritable: true }, // protocol_stablecoin_vault
    { pubkey: protocolCollateralVaultPDA, isSigner: false, isWritable: true }, // protocol_collateral_vault
    { pubkey: totalCollateralAmountPDA, isSigner: false, isWritable: true }, // total_collateral_amount
    { pubkey: oracleProgramId, isSigner: false, isWritable: true }, // oracle_program
    { pubkey: oracleState, isSigner: false, isWritable: true }, // oracle_state
    { pubkey: SOL_PYTH_PRICE_FEED, isSigner: false, isWritable: false }, // pyth_price_account
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // clock
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  // 4. Build remaining accounts for each trove (4 accounts per trove)
  const remainingAccounts: AccountMeta[] = [];

  for (const troveOwner of liquidationList) {
    // UserDebtAmount PDA
    const [userDebtAmountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_debt_amount'), troveOwner.toBuffer()],
      PROTOCOL_PROGRAM_ID
    );
    remainingAccounts.push({ pubkey: userDebtAmountPDA, isSigner: false, isWritable: true });

    // UserCollateralAmount PDA
    const [userCollateralAmountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_collateral_amount'), troveOwner.toBuffer(), Buffer.from(collateralDenom)],
      PROTOCOL_PROGRAM_ID
    );
    remainingAccounts.push({ pubkey: userCollateralAmountPDA, isSigner: false, isWritable: true });

    // LiquidityThreshold PDA
    const [liquidityThresholdPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('liquidity_threshold'), troveOwner.toBuffer()],
      PROTOCOL_PROGRAM_ID
    );
    remainingAccounts.push({ pubkey: liquidityThresholdPDA, isSigner: false, isWritable: true });

    // User's collateral token account ATA
    const userCollateralTokenAccount = await getAssociatedTokenAddress(collateralMint, troveOwner);
    remainingAccounts.push({ pubkey: userCollateralTokenAccount, isSigner: false, isWritable: true });
  }

  console.log('📋 Account metas list:');
  accountMetas.forEach((meta, idx) => {
    const flags = `${meta.isSigner ? 'S' : '-'}${meta.isWritable ? 'W' : '-'}`;
    console.log(`  [${idx}] ${meta.pubkey.toBase58()} ${flags}`);
  });
  console.log(`  ...${remainingAccounts.length} remaining accounts (${liquidationList.length} troves * 4 accounts)`);

  const instruction = new TransactionInstruction({
    keys: [...accountMetas, ...remainingAccounts],
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data),
  });

  console.log('✅ liquidate_troves instruction built');
  console.log('📊 Total accounts:', accountMetas.length + remainingAccounts.length);
  console.log('🔗 Program ID:', PROTOCOL_PROGRAM_ID.toBase58());

  return { instruction };
}

export async function buildRedeemInstruction(
  userPublicKey: PublicKey,
  redeemAmount: bigint,
  collateralDenom: string,
  collateralMint: PublicKey,
  stablecoinMint: PublicKey,
  oracleProgramId: PublicKey,
  oracleState: PublicKey,
  feesProgramId: PublicKey,
  feesState: PublicKey,
  stabilityPoolTokenAccount: PublicKey,
  feeAddress1TokenAccount: PublicKey,
  feeAddress2TokenAccount: PublicKey,
  targetTroves: PublicKey[] // Array of trove owners to redeem from
): Promise<{ instruction: TransactionInstruction }> {
  console.log('🔨 Building redeem instruction...');
  console.log('User:', userPublicKey.toBase58());
  console.log('Redeem amount:', redeemAmount.toString());
  console.log('Collateral denom:', collateralDenom);
  console.log('Target troves:', targetTroves.length);

  // 1. Derive PDAs
  const [protocolStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROTOCOL_PROGRAM_ID
  );

  const [userDebtAmountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_debt_amount'), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );

  const [liquidityThresholdPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('liquidity_threshold'), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );

  const [userCollateralAmountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_collateral_amount'), userPublicKey.toBuffer(), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolStablecoinVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_stablecoin_vault')],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolCollateralVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_collateral_vault'), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  const [totalCollateralAmountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('total_collateral_amount'), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  // 2. Get user's token accounts
  const userStablecoinATA = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);
  const userCollateralATA = await getAssociatedTokenAddress(collateralMint, userPublicKey);

  // 3. Build instruction data (discriminator from IDL: [184, 12, 86, 149, 70, 196, 97, 225])
  const discriminator = new Uint8Array([184, 12, 86, 149, 70, 196, 97, 225]);

  // Serialize amount (u64)
  const amountBuffer = new Uint8Array(8);
  new DataView(amountBuffer.buffer).setBigUint64(0, redeemAmount, true);

  // Serialize collateral_denom (string)
  const denomBytes = new TextEncoder().encode(collateralDenom);
  const denomLengthBuffer = new Uint8Array(4);
  new DataView(denomLengthBuffer.buffer).setUint32(0, denomBytes.length, true);

  // Combine all data
  const totalLength = discriminator.length + amountBuffer.length + denomLengthBuffer.length + denomBytes.length;
  const data = new Uint8Array(totalLength);
  let offset = 0;
  data.set(discriminator, offset); offset += discriminator.length;
  data.set(amountBuffer, offset); offset += amountBuffer.length;
  data.set(denomLengthBuffer, offset); offset += denomLengthBuffer.length;
  data.set(denomBytes, offset);

  console.log('✅ Instruction data serialized, length:', data.length);

  // 4. Build main account metas (19 accounts from IDL)
  const accountMetas: AccountMeta[] = [
    { pubkey: userPublicKey, isSigner: true, isWritable: true }, // user
    { pubkey: protocolStatePDA, isSigner: false, isWritable: true }, // state
    { pubkey: userDebtAmountPDA, isSigner: false, isWritable: true }, // user_debt_amount
    { pubkey: liquidityThresholdPDA, isSigner: false, isWritable: true }, // liquidity_threshold
    { pubkey: userStablecoinATA, isSigner: false, isWritable: true }, // user_stablecoin_account
    { pubkey: userCollateralAmountPDA, isSigner: false, isWritable: true }, // user_collateral_amount
    { pubkey: userCollateralATA, isSigner: false, isWritable: true }, // user_collateral_account
    { pubkey: protocolStablecoinVaultPDA, isSigner: false, isWritable: true }, // protocol_stablecoin_vault
    { pubkey: protocolCollateralVaultPDA, isSigner: false, isWritable: true }, // protocol_collateral_vault
    { pubkey: stablecoinMint, isSigner: false, isWritable: true }, // stable_coin_mint
    { pubkey: totalCollateralAmountPDA, isSigner: false, isWritable: true }, // total_collateral_amount
    { pubkey: oracleProgramId, isSigner: false, isWritable: true }, // oracle_program
    { pubkey: oracleState, isSigner: false, isWritable: true }, // oracle_state
    { pubkey: feesProgramId, isSigner: false, isWritable: false }, // fees_program
    { pubkey: feesState, isSigner: false, isWritable: true }, // fees_state
    { pubkey: stabilityPoolTokenAccount, isSigner: false, isWritable: true }, // stability_pool_token_account
    { pubkey: feeAddress1TokenAccount, isSigner: false, isWritable: true }, // fee_address_1_token_account
    { pubkey: feeAddress2TokenAccount, isSigner: false, isWritable: true }, // fee_address_2_token_account
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
  ];

  // 5. Build remaining accounts for each target trove (4 accounts per trove)
  const remainingAccounts: AccountMeta[] = [];

  for (const troveOwner of targetTroves) {
    // UserDebtAmount PDA
    const [troveUserDebtAmountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_debt_amount'), troveOwner.toBuffer()],
      PROTOCOL_PROGRAM_ID
    );
    remainingAccounts.push({ pubkey: troveUserDebtAmountPDA, isSigner: false, isWritable: true });

    // UserCollateralAmount PDA
    const [troveUserCollateralAmountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_collateral_amount'), troveOwner.toBuffer(), Buffer.from(collateralDenom)],
      PROTOCOL_PROGRAM_ID
    );
    remainingAccounts.push({ pubkey: troveUserCollateralAmountPDA, isSigner: false, isWritable: true });

    // LiquidityThreshold PDA
    const [troveLiquidityThresholdPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('liquidity_threshold'), troveOwner.toBuffer()],
      PROTOCOL_PROGRAM_ID
    );
    remainingAccounts.push({ pubkey: troveLiquidityThresholdPDA, isSigner: false, isWritable: true });

    // User's collateral token account ATA
    const troveUserCollateralTokenAccount = await getAssociatedTokenAddress(collateralMint, troveOwner);
    remainingAccounts.push({ pubkey: troveUserCollateralTokenAccount, isSigner: false, isWritable: true });
  }

  console.log('📋 Account metas list:');
  accountMetas.forEach((meta, idx) => {
    const flags = `${meta.isSigner ? 'S' : '-'}${meta.isWritable ? 'W' : '-'}`;
    console.log(`  [${idx}] ${meta.pubkey.toBase58()} ${flags}`);
  });
  console.log(`  ...${remainingAccounts.length} remaining accounts (${targetTroves.length} troves * 4 accounts)`);

  const instruction = new TransactionInstruction({
    keys: [...accountMetas, ...remainingAccounts],
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data),
  });

  console.log('✅ redeem instruction built');
  console.log('📊 Total accounts:', accountMetas.length + remainingAccounts.length);
  console.log('🔗 Program ID:', PROTOCOL_PROGRAM_ID.toBase58());

  return { instruction };
}

export async function buildWithdrawLiquidationGainsInstruction(
  userPublicKey: PublicKey,
  collateralDenom: string,
  collateralMint: PublicKey,
  stablecoinMint: PublicKey,
): Promise<{ instruction: TransactionInstruction }> {
  console.log('🔨 Building withdraw_liquidation_gains instruction...');
  console.log('User:', userPublicKey.toBase58());
  console.log('Collateral denom:', collateralDenom);

  // 1. Derive PDAs
  const [userStakeAmountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_stake_amount'), userPublicKey.toBuffer()],
    PROTOCOL_PROGRAM_ID
  );

  const [userCollateralSnapshotPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_collateral_snapshot'), userPublicKey.toBuffer(), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  const [stabilityPoolSnapshotPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('stability_pool_snapshot'), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('state')],
    PROTOCOL_PROGRAM_ID
  );

  const [protocolCollateralVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_collateral_vault'), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  const [totalCollateralAmountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('total_collateral_amount'), Buffer.from(collateralDenom)],
    PROTOCOL_PROGRAM_ID
  );

  console.log('✅ Derived PDAs');
  console.log('📍 PDA addresses:');
  console.log('  - userStakeAmount:', userStakeAmountPDA.toBase58());
  console.log('  - userCollateralSnapshot:', userCollateralSnapshotPDA.toBase58());
  console.log('  - stabilityPoolSnapshot:', stabilityPoolSnapshotPDA.toBase58());
  console.log('  - protocolState:', protocolStatePDA.toBase58());
  console.log('  - protocolCollateralVault:', protocolCollateralVaultPDA.toBase58());
  console.log('  - totalCollateralAmount:', totalCollateralAmountPDA.toBase58());

  // 2. Get user collateral token account (ATA)
  const userCollateralAccount = await getAssociatedTokenAddress(collateralMint, userPublicKey);
  console.log('📝 User collateral ATA:', userCollateralAccount.toBase58());

  // 3. Build instruction data (discriminator from IDL: [29, 116, 45, 182, 143, 7, 59, 218])
  const discriminator = new Uint8Array([29, 116, 45, 182, 143, 7, 59, 218]);

  // Serialize collateral_denom as String (length u32 + bytes)
  const denomBytes = new TextEncoder().encode(collateralDenom);
  const denomLengthBuffer = new Uint8Array(4);
  new DataView(denomLengthBuffer.buffer).setUint32(0, denomBytes.length, true);

  // Combine all data
  const totalLength = discriminator.length + denomLengthBuffer.length + denomBytes.length;
  const data = new Uint8Array(totalLength);
  let offset = 0;
  data.set(discriminator, offset);
  offset += discriminator.length;
  data.set(denomLengthBuffer, offset);
  offset += denomLengthBuffer.length;
  data.set(denomBytes, offset);

  console.log('✅ Instruction data serialized, length:', totalLength);

  // 4. Build account metas (9 accounts from IDL lines 2614-2837)
  const accountMetas: AccountMeta[] = [
    { pubkey: userPublicKey, isSigner: true, isWritable: true }, // user
    { pubkey: userStakeAmountPDA, isSigner: false, isWritable: true }, // user_stake_amount
    { pubkey: userCollateralSnapshotPDA, isSigner: false, isWritable: true }, // user_collateral_snapshot
    { pubkey: stabilityPoolSnapshotPDA, isSigner: false, isWritable: true }, // stability_pool_snapshot
    { pubkey: protocolStatePDA, isSigner: false, isWritable: true }, // state
    { pubkey: userCollateralAccount, isSigner: false, isWritable: true }, // user_collateral_account
    { pubkey: protocolCollateralVaultPDA, isSigner: false, isWritable: true }, // protocol_collateral_vault (CHECK)
    { pubkey: totalCollateralAmountPDA, isSigner: false, isWritable: true }, // total_collateral_amount (CHECK)
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  console.log('📋 Account metas list:');
  accountMetas.forEach((meta, idx) => {
    const flags = `${meta.isSigner ? 'S' : '-'}${meta.isWritable ? 'W' : '-'}`;
    console.log(`  [${idx}] ${meta.pubkey.toBase58()} ${flags}`);
  });

  const instruction = new TransactionInstruction({
    keys: accountMetas,
    programId: PROTOCOL_PROGRAM_ID,
    data: Buffer.from(data),
  });

  console.log('✅ withdraw_liquidation_gains instruction built');
  console.log('📊 Total accounts:', accountMetas.length);
  console.log('🔗 Program ID:', PROTOCOL_PROGRAM_ID.toBase58());

  return { instruction };
}

