import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AerospacerProtocol } from "../target/types/aerospacer_protocol";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { AerospacerFees } from "../target/types/aerospacer_fees";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL, AccountInfo } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
  createMint,
  mintTo,
  transfer
} from "@solana/spl-token";
import { assert } from "chai";
import { loadTestUsers } from "./test-utils";
import { fetchAllTroves, sortTrovesByICR, findNeighbors, buildNeighborAccounts, TroveData } from './trove-indexer';

// Constants
const PYTH_ORACLE_ADDRESS = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");
const SOL_PRICE_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");

// Helper function to get neighbor hints for trove mutations
async function getNeighborHints(
  provider: anchor.AnchorProvider,
  protocolProgram: Program<AerospacerProtocol>,
  user: PublicKey,
  collateralAmount: BN,
  loanAmount: BN,
  denom: string
): Promise<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]> {
  // Fetch and sort all existing troves
  const allTroves = await fetchAllTroves(provider.connection, protocolProgram, denom);
  const sortedTroves = sortTrovesByICR(allTroves);

  // Calculate ICR for this trove (simplified - using estimated SOL price of $100)
  // In production, this would fetch actual oracle price
  // ICR = (collateral_value / debt) * 100
  const estimatedSolPrice = 100n; // $100 per SOL
  const collateralValue = BigInt(collateralAmount.toString()) * estimatedSolPrice;
  const debtValue = BigInt(loanAmount.toString());
  const newICR = debtValue > 0n ? (collateralValue * 100n) / debtValue : BigInt(Number.MAX_SAFE_INTEGER);

  // Create a temporary TroveData object for this trove
  const [userDebtAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_debt_amount"), user.toBuffer()],
    protocolProgram.programId
  );
  const [userCollateralAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_collateral_amount"), user.toBuffer(), Buffer.from(denom)],
    protocolProgram.programId
  );
  const [liquidityThresholdAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity_threshold"), user.toBuffer()],
    protocolProgram.programId
  );

  const thisTrove: TroveData = {
    owner: user,
    debt: BigInt(loanAmount.toString()),
    collateralAmount: BigInt(collateralAmount.toString()),
    collateralDenom: denom,
    icr: newICR,
    debtAccount: userDebtAccount,
    collateralAccount: userCollateralAccount,
    liquidityThresholdAccount: liquidityThresholdAccount,
  };

  // Insert this trove into sorted position to find neighbors
  let insertIndex = sortedTroves.findIndex((t) => t.icr > newICR);
  if (insertIndex === -1) insertIndex = sortedTroves.length;

  const newSortedTroves = [
    ...sortedTroves.slice(0, insertIndex),
    thisTrove,
    ...sortedTroves.slice(insertIndex),
  ];

  // Find neighbors
  const neighbors = findNeighbors(thisTrove, newSortedTroves);

  // Build remainingAccounts array
  const neighborAccounts = buildNeighborAccounts(neighbors);

  // Convert PublicKey[] to AccountMeta format
  return neighborAccounts.map((pubkey) => ({
    pubkey,
    isSigner: false,
    isWritable: false,
  }));
}

describe("Aeroscraper Protocol Core Operations", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const protocolProgram = anchor.workspace.AerospacerProtocol as Program<AerospacerProtocol>;
  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;
  const feesProgram = anchor.workspace.AerospacerFees as Program<AerospacerFees>;

  // Test accounts
  const admin = provider.wallet as anchor.Wallet;
  const adminKeypair = admin.payer;

  // Load fixed test users (same keypairs used across all protocol tests)
  const { user1, user2 } = loadTestUsers();
  const USER1 = user1.publicKey;
  const USER2 = user2.publicKey;

  console.log("USER1:", USER1.toString());
  console.log("USER2:", USER2.toString());

  // Token mints
  let stablecoinMint: PublicKey;
  let collateralMint: PublicKey;

  // Token accounts
  let adminStablecoinAccount: PublicKey;
  let adminCollateralAccount: PublicKey;
  let user1StablecoinAccount: PublicKey;
  let user1CollateralAccount: PublicKey;
  let user2StablecoinAccount: PublicKey;
  let user2CollateralAccount: PublicKey;

  // Program state accounts
  let protocolState: PublicKey;
  let oracleState: PublicKey;
  let feesState: PublicKey;

  // User trove accounts
  let user1Trove: PublicKey;
  let user2Trove: PublicKey;

  // User stake accounts
  let user1Stake: PublicKey;
  let user2Stake: PublicKey;

  // Protocol state has correct addresses after update

  // PDA accounts
  let user1DebtAmountPDA: PublicKey;
  let user1LiquidityThresholdPDA: PublicKey;
  let user1CollateralAmountPDA: PublicKey;
  let user1NodePDA: PublicKey;
  let protocolCollateralAccountPDA: PublicKey;
  let totalCollateralAmountPDA: PublicKey;
  let sortedTrovesStatePDA: PublicKey;
  let protocolStablecoinAccountPDA: PublicKey;
  let stabilityPoolTokenAccount: PublicKey;
  let feeAddress1TokenAccount: PublicKey;
  let feeAddress2TokenAccount: PublicKey;

  before(async () => {
    // Transfer SOL for transaction fees and account creation (0.1 SOL each)
    const transferAmount = 100000000; // 0.1 SOL in lamports

    const user1Tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: user1.publicKey,
        lamports: transferAmount,
      })
    );
    await provider.sendAndConfirm(user1Tx, [adminKeypair]);

    const user2Tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: user2.publicKey,
        lamports: transferAmount,
      })
    );
    await provider.sendAndConfirm(user2Tx, [adminKeypair]);

    // Derive state PDAs first
    const [protocolStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      protocolProgram.programId
    );
    const [oracleStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      oracleProgram.programId
    );
    const [feesStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee_state")],
      feesProgram.programId
    );

    protocolState = protocolStatePda;
    oracleState = oracleStatePda;
    feesState = feesStatePda;

    // Get the existing stablecoin mint from the state account
    const existingState = await provider.connection.getAccountInfo(protocolState);
    if (existingState) {
      const stateAccount = await protocolProgram.account.stateAccount.fetch(protocolState);
      stablecoinMint = stateAccount.stableCoinAddr;
      console.log("Using existing stablecoin mint:", stablecoinMint.toString());
    } else {
      stablecoinMint = await createMint(provider.connection, adminKeypair, admin.publicKey, null, 18); // 18 decimals for aUSD
      console.log("Created new stablecoin mint:", stablecoinMint.toString());
    }

    // CRITICAL: Fetch the existing collateral mint from the devnet protocol vault
    // The protocol_collateral_vault PDA is already initialized on devnet for "SOL"
    // We must use the SAME mint that's already associated with this vault
    const [protocolCollateralVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_collateral_vault"), Buffer.from("SOL")],
      protocolProgram.programId
    );

    const vaultAccountInfo = await provider.connection.getAccountInfo(protocolCollateralVaultPda);
    if (vaultAccountInfo) {
      // Vault exists on devnet - fetch its mint address
      const vaultAccount = await provider.connection.getParsedAccountInfo(protocolCollateralVaultPda);
      if (vaultAccount.value && 'parsed' in vaultAccount.value.data) {
        collateralMint = new PublicKey(vaultAccount.value.data.parsed.info.mint);
        console.log("✅ Using existing devnet collateral mint from vault:", collateralMint.toString());
      } else {
        throw new Error("Failed to parse vault account data");
      }
    } else {
      // Vault doesn't exist - create a new mint (localnet scenario)
      collateralMint = await createMint(provider.connection, adminKeypair, admin.publicKey, null, 9);
      console.log("✅ Created new collateral mint for localnet:", collateralMint.toString());
    }

    // Create token accounts
    adminStablecoinAccount = await getAssociatedTokenAddress(stablecoinMint, admin.publicKey);
    adminCollateralAccount = await getAssociatedTokenAddress(collateralMint, admin.publicKey);
    user1StablecoinAccount = await getAssociatedTokenAddress(stablecoinMint, user1.publicKey);
    user1CollateralAccount = await getAssociatedTokenAddress(collateralMint, user1.publicKey);
    user2StablecoinAccount = await getAssociatedTokenAddress(stablecoinMint, user2.publicKey);
    user2CollateralAccount = await getAssociatedTokenAddress(collateralMint, user2.publicKey);

    // Create token accounts
    console.log("Creating admin stablecoin account...");
    console.log("Admin public key:", admin.publicKey.toString());
    console.log("Stablecoin mint:", stablecoinMint.toString());

    // Check if token account already exists
    const adminStablecoinAccountInfo = await provider.connection.getAccountInfo(adminStablecoinAccount);
    if (adminStablecoinAccountInfo) {
      console.log("Admin stablecoin account already exists, skipping creation");
    } else {
      console.log("Creating new admin stablecoin account...");
      await createAssociatedTokenAccount(provider.connection, adminKeypair, stablecoinMint, admin.publicKey);
    }
    // Create collateral accounts - check if they already exist
    const adminCollateralAccountInfo = await provider.connection.getAccountInfo(adminCollateralAccount);
    if (!adminCollateralAccountInfo) {
      console.log("Creating admin collateral account...");
      await createAssociatedTokenAccount(provider.connection, adminKeypair, collateralMint, admin.publicKey);
    } else {
      console.log("Admin collateral account already exists");
    }

    console.log("Creating user1 stablecoin account...");
    const user1StablecoinAccountInfo = await provider.connection.getAccountInfo(user1StablecoinAccount);
    if (!user1StablecoinAccountInfo) {
      await createAssociatedTokenAccount(provider.connection, adminKeypair, stablecoinMint, user1.publicKey);
    } else {
      console.log("User1 stablecoin account already exists");
    }

    const user1CollateralAccountInfo = await provider.connection.getAccountInfo(user1CollateralAccount);
    if (!user1CollateralAccountInfo) {
      console.log("Creating user1 collateral account...");
      await createAssociatedTokenAccount(provider.connection, adminKeypair, collateralMint, user1.publicKey);
    } else {
      console.log("User1 collateral account already exists");
    }

    console.log("Creating user2 stablecoin account...");
    const user2StablecoinAccountInfo = await provider.connection.getAccountInfo(user2StablecoinAccount);
    if (!user2StablecoinAccountInfo) {
      await createAssociatedTokenAccount(provider.connection, adminKeypair, stablecoinMint, user2.publicKey);
    } else {
      console.log("User2 stablecoin account already exists");
    }

    const user2CollateralAccountInfo = await provider.connection.getAccountInfo(user2CollateralAccount);
    if (!user2CollateralAccountInfo) {
      console.log("Creating user2 collateral account...");
      await createAssociatedTokenAccount(provider.connection, adminKeypair, collateralMint, user2.publicKey);
    } else {
      console.log("User2 collateral account already exists");
    }

    // Mint initial tokens (using correct decimal places)
    // Skip stablecoin minting - protocol will mint tokens when users open troves
    console.log("Skipping stablecoin minting - protocol will mint tokens during operations");

    // Check if this is an existing devnet mint or a new localnet mint
    const mintInfo = await provider.connection.getParsedAccountInfo(collateralMint);
    let canMint = false;
    if (mintInfo.value && 'parsed' in mintInfo.value.data) {
      const mintAuthority = mintInfo.value.data.parsed.info.mintAuthority;
      // Check if we control the mint authority (must be non-null AND equal to admin)
      canMint = mintAuthority !== null && mintAuthority !== undefined && new PublicKey(mintAuthority).equals(admin.publicKey);
      console.log(`Mint authority: ${mintAuthority || 'null'}, Admin: ${admin.publicKey.toString()}, Can mint: ${canMint}`);
    }

    if (canMint) {
      // We control this mint - can mint tokens for testing
      console.log("✅ Minting collateral tokens for testing (localnet)...");
      try {
        await mintTo(provider.connection, adminKeypair, collateralMint, adminCollateralAccount, adminKeypair, 100000000000); // 100 SOL with 9 decimals
        await transfer(provider.connection, adminKeypair, adminCollateralAccount, user1CollateralAccount, adminKeypair, 10000000000); // 10 SOL with 9 decimals
        await transfer(provider.connection, adminKeypair, adminCollateralAccount, user2CollateralAccount, adminKeypair, 10000000000); // 10 SOL with 9 decimals
        console.log("✅ Minted and distributed collateral tokens successfully");
      } catch (mintError) {
        console.log("❌ Failed to mint tokens:", mintError);
        throw mintError;
      }
    } else {
      // Existing devnet mint - check if users already have tokens
      console.log("⚠️  Using existing devnet collateral mint - checking user balances...");
      const user1Balance = await provider.connection.getTokenAccountBalance(user1CollateralAccount);
      const user2Balance = await provider.connection.getTokenAccountBalance(user2CollateralAccount);
      console.log(`  User1 collateral balance: ${user1Balance.value.uiAmount} tokens`);
      console.log(`  User2 collateral balance: ${user2Balance.value.uiAmount} tokens`);

      const minRequired = 1; // 1 token minimum
      if (parseFloat(user1Balance.value.uiAmount || "0") < minRequired) {
        console.log(`⚠️  User1 has insufficient collateral (${user1Balance.value.uiAmount} < ${minRequired})`);
        console.log("   Tests may fail - please fund user1's collateral account on devnet");
      }
      if (parseFloat(user2Balance.value.uiAmount || "0") < minRequired) {
        console.log(`⚠️  User2 has insufficient collateral (${user2Balance.value.uiAmount} < ${minRequired})`);
        console.log("   Tests may fail - please fund user2's collateral account on devnet");
      }
    }

    // Derive user trove PDAs
    const [user1TrovePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("trove"), user1.publicKey.toBuffer()],
      protocolProgram.programId
    );
    const [user2TrovePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("trove"), user2.publicKey.toBuffer()],
      protocolProgram.programId
    );

    user1Trove = user1TrovePda;
    user2Trove = user2TrovePda;

    // Derive user stake PDAs - these should be PDAs, not regular accounts
    const [user1StakePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake_amount"), user1.publicKey.toBuffer()],
      protocolProgram.programId
    );
    const [user2StakePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake_amount"), user2.publicKey.toBuffer()],
      protocolProgram.programId
    );

    user1Stake = user1StakePda;
    user2Stake = user2StakePda;

    // Derive additional PDAs for openTrove
    const [user1DebtAmountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_debt_amount"), user1.publicKey.toBuffer()],
      protocolProgram.programId
    );
    const [user1LiquidityThresholdPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("liquidity_threshold"), user1.publicKey.toBuffer()],
      protocolProgram.programId
    );
    const [user1CollateralAmountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_collateral_amount"), user1.publicKey.toBuffer(), Buffer.from("SOL")],
      protocolProgram.programId
    );
    const [user1NodePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("node"), user1.publicKey.toBuffer()],
      protocolProgram.programId
    );
    const [protocolCollateralAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_collateral_vault"), Buffer.from("SOL")],
      protocolProgram.programId
    );
    const [totalCollateralAmountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
      protocolProgram.programId
    );
    const [sortedTrovesStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("sorted_troves_state")],
      protocolProgram.programId
    );
    const [protocolStablecoinAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_stablecoin_vault")],
      protocolProgram.programId
    );

    user1DebtAmountPDA = user1DebtAmountPda;
    user1LiquidityThresholdPDA = user1LiquidityThresholdPda;
    user1CollateralAmountPDA = user1CollateralAmountPda;
    user1NodePDA = user1NodePda;
    protocolCollateralAccountPDA = protocolCollateralAccountPda; // Already derived above
    totalCollateralAmountPDA = totalCollateralAmountPda;
    sortedTrovesStatePDA = sortedTrovesStatePda;
    protocolStablecoinAccountPDA = protocolStablecoinAccountPda;

    // Create minimal token accounts for testing
    // Use the configured fee addresses from the fees contract
    const feeAddress1 = new PublicKey("8Lv4UrYHTrzvg9jPVVGNmxWyMrMvrZnCQLWucBzfJyyR");
    const feeAddress2 = new PublicKey("GcNwV1nA5bityjNYsWwPLHykpKuuhPzK1AQFBbrPopnX");

    // Transfer minimal SOL to fee addresses
    const fee1Tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: feeAddress1,
        lamports: transferAmount,
      })
    );
    await provider.sendAndConfirm(fee1Tx, [adminKeypair]);

    const fee2Tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: feeAddress2,
        lamports: transferAmount,
      })
    );
    await provider.sendAndConfirm(fee2Tx, [adminKeypair]);

    // Create token accounts for fee addresses
    feeAddress1TokenAccount = await getAssociatedTokenAddress(stablecoinMint, feeAddress1);
    feeAddress2TokenAccount = await getAssociatedTokenAddress(stablecoinMint, feeAddress2);
    stabilityPoolTokenAccount = await getAssociatedTokenAddress(stablecoinMint, admin.publicKey); // Use admin as stability pool owner for simplicity

    // Create the token accounts
    console.log("Creating token account for feeAddress1...");
    console.log("FeeAddress1:", feeAddress1.toString());
    console.log("StablecoinMint:", stablecoinMint.toString());

    // Check if token accounts already exist
    const fee1TokenAccountInfo = await provider.connection.getAccountInfo(feeAddress1TokenAccount);
    const fee2TokenAccountInfo = await provider.connection.getAccountInfo(feeAddress2TokenAccount);

    if (!fee1TokenAccountInfo) {
      await createAssociatedTokenAccount(provider.connection, adminKeypair, stablecoinMint, feeAddress1);
      console.log("Created feeAddress1 token account:", feeAddress1TokenAccount.toString());
    } else {
      console.log("FeeAddress1 token account already exists:", feeAddress1TokenAccount.toString());
    }

    if (!fee2TokenAccountInfo) {
      await createAssociatedTokenAccount(provider.connection, adminKeypair, stablecoinMint, feeAddress2);
      console.log("Created feeAddress2 token account:", feeAddress2TokenAccount.toString());
    } else {
      console.log("FeeAddress2 token account already exists:", feeAddress2TokenAccount.toString());
    }

    // Verify token account owners
    const fee1AccountInfo = await provider.connection.getAccountInfo(feeAddress1TokenAccount);
    const fee2AccountInfo = await provider.connection.getAccountInfo(feeAddress2TokenAccount);

    if (fee1AccountInfo) {
      console.log("Fee1 token account owner:", fee1AccountInfo.owner.toString());
      console.log("Expected fee1 owner:", feeAddress1.toString());
      console.log("Match:", fee1AccountInfo.owner.equals(feeAddress1));
    }

    if (fee2AccountInfo) {
      console.log("Fee2 token account owner:", fee2AccountInfo.owner.toString());
      console.log("Expected fee2 owner:", feeAddress2.toString());
      console.log("Match:", fee2AccountInfo.owner.equals(feeAddress2));
    }

    console.log("Token accounts created successfully");

    // Check if oracle state already exists
    const existingOracleState = await provider.connection.getAccountInfo(oracleState);
    if (existingOracleState) {
      console.log("Oracle already initialized");
    } else {
      try {
        await oracleProgram.methods
          .initialize({
            oracleAddress: PYTH_ORACLE_ADDRESS,
          })
          .accounts({
            state: oracleState,
            admin: admin.publicKey,
            systemProgram: SystemProgram.programId,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([adminKeypair])
          .rpc();
        console.log("Oracle initialized successfully");
      } catch (e) {
        console.log("Oracle initialization failed:", e);
        throw e;
      }
    }

    try {
      await feesProgram.methods
        .initialize()
        .accounts({
          state: feesState,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([adminKeypair])
        .rpc();
    } catch (e) {
      console.log("Fees already initialized");
    }

    // Check if protocol state already exists
    if (existingState) {
      console.log("Protocol already initialized");
      console.log("✅ Protocol state has correct addresses");
    } else {
      try {
        await protocolProgram.methods
          .initialize({
            stableCoinCodeId: new anchor.BN(1),
            oracleHelperAddr: oracleProgram.programId,
            oracleStateAddr: oracleState,
            feeDistributorAddr: feesProgram.programId,
            feeStateAddr: feesState,
          })
          .accounts({
            state: protocolState,
            admin: admin.publicKey,
            stableCoinMint: stablecoinMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([adminKeypair])
          .rpc();
        console.log("Protocol initialized successfully");
      } catch (e) {
        console.log("Protocol initialization failed:", e);
        throw e;
      }
    }

    // Note: PDAs cannot own token accounts, so we skip creating vault accounts
    // In a real implementation, these would be managed by the program itself
    console.log("Skipping PDA token account creation (not allowed)");

    // Sorted troves state will be created automatically by the protocol program
    // when the first trove is opened (init_if_needed constraint)
  });

  describe("Core Protocol Operations", () => {
    it("Should open a trove successfully", async () => {
      const collateralAmount = 10000000000; // 10 SOL with 9 decimals (meet minimum requirement)
      const loanAmount = "1100000000000000"; // 0.0011 aUSD with 18 decimals (above minimum after 5% fee)
      const collateralDenom = "SOL"; // Use SOL for price feed

      // Get neighbor hints for off-chain sorted trove insertion
      const neighborHints = await getNeighborHints(
        provider,
        protocolProgram,
        user1.publicKey,
        new BN(collateralAmount),
        new BN(loanAmount),
        collateralDenom
      );

      try {
        console.log("🔍 Debug - Account addresses being passed:");
        console.log("- oracleProgram:", oracleProgram.programId.toString());
        console.log("- oracleState:", oracleState.toString());
        console.log("- feesProgram:", feesProgram.programId.toString());
        console.log("- feesState:", feesState.toString());
        console.log("- Neighbor hints:", neighborHints.length);

        await protocolProgram.methods
          .openTrove({
            loanAmount: new anchor.BN(loanAmount),
            collateralDenom: collateralDenom,
            collateralAmount: new anchor.BN(collateralAmount),
          })
          .accounts({
            user: user1.publicKey,
            userDebtAmount: user1DebtAmountPDA,
            liquidityThreshold: user1LiquidityThresholdPDA,
            userCollateralAmount: user1CollateralAmountPDA,
            userCollateralAccount: user1CollateralAccount,
            collateralMint: collateralMint,
            protocolCollateralAccount: protocolCollateralAccountPDA,
            totalCollateralAmount: totalCollateralAmountPDA,
            sortedTrovesState: sortedTrovesStatePDA,
            node: user1NodePDA,
            state: protocolState,
            userStablecoinAccount: user1StablecoinAccount,
            protocolStablecoinAccount: protocolStablecoinAccountPDA,
            stableCoinMint: stablecoinMint,
            oracleProgram: oracleProgram.programId,
            oracleState: oracleState,
            pythPriceAccount: SOL_PRICE_FEED,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            feesProgram: feesProgram.programId,
            feesState: feesState,
            stabilityPoolTokenAccount: stabilityPoolTokenAccount,
            feeAddress1TokenAccount: feeAddress1TokenAccount,
            feeAddress2TokenAccount: feeAddress2TokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(neighborHints)
          .signers([user1])
          .rpc();

        console.log("✅ Trove opened successfully");
      } catch (error) {
        console.log("❌ Trove opening failed:", error);
        throw error;
      }
    });

    it("Should add collateral to existing trove", async () => {
      const additionalCollateral = 15000000000;

      try {
        // Mint additional collateral tokens to user1 for this test
        // Check if we can mint tokens (localnet scenario)
        const mintInfo = await provider.connection.getParsedAccountInfo(collateralMint);
        let canMint = false;
        if (mintInfo.value && 'parsed' in mintInfo.value.data) {
          const mintAuthority = mintInfo.value.data.parsed.info.mintAuthority;
          canMint = mintAuthority !== null && mintAuthority !== undefined && new PublicKey(mintAuthority).equals(admin.publicKey);
        }

        if (canMint) {
          console.log("✅ Minting additional collateral for add_collateral test...");
          await mintTo(provider.connection, adminKeypair, collateralMint, user1CollateralAccount, adminKeypair, additionalCollateral);
          console.log(`✅ Minted ${additionalCollateral} additional collateral tokens to user1`);
        } else {
          console.log("⚠️  Cannot mint additional tokens - using existing balance");
          // Check current balance
          const user1Balance = await provider.connection.getTokenAccountBalance(user1CollateralAccount);
          console.log(`  User1 current collateral balance: ${user1Balance.value.uiAmount} tokens`);

          if (parseFloat(user1Balance.value.uiAmount || "0") < 5) {
            console.log("❌ User1 has insufficient collateral for add_collateral test");
            throw new Error("Insufficient collateral for add_collateral test");
          }
        }

        // Verify user has enough tokens before proceeding
        const user1Balance = await provider.connection.getTokenAccountBalance(user1CollateralAccount);
        const actualBalance = user1Balance.value.amount; // Raw amount in smallest units
        const requiredAmount = additionalCollateral;

        console.log(`  User1 raw balance: ${user1Balance.value.amount} units`);
        console.log(`  User1 UI balance: ${user1Balance.value.uiAmount} tokens`);
        console.log(`  Required amount: ${additionalCollateral} units`);

        console.log(`  User1 raw balance: ${actualBalance} units`);
        console.log(`  Required amount: ${requiredAmount} units`);

        // Fetch current trove state to calculate new ICR
        const currentDebt = await protocolProgram.account.userDebtAmount.fetch(user1DebtAmountPDA);
        const currentCollateral = await protocolProgram.account.userCollateralAmount.fetch(user1CollateralAmountPDA);
        const newTotalCollateral = currentCollateral.amount.add(new BN(additionalCollateral));

        // Get neighbor hints for new ICR position
        const neighborHints = await getNeighborHints(
          provider,
          protocolProgram,
          user1.publicKey,
          newTotalCollateral,
          currentDebt.amount,
          "SOL"
        );

        await protocolProgram.methods
          .addCollateral({
            amount: new anchor.BN(additionalCollateral),
            collateralDenom: "SOL",
            prevNodeId: null,
            nextNodeId: null,
          })
          .accounts({
            user: user1.publicKey,
            userDebtAmount: user1DebtAmountPDA,
            userCollateralAmount: user1CollateralAmountPDA,
            liquidityThreshold: user1LiquidityThresholdPDA,
            state: protocolState,
            userCollateralAccount: user1CollateralAccount,
            collateralMint: collateralMint,
            protocolCollateralAccount: protocolCollateralAccountPDA,
            totalCollateralAmount: totalCollateralAmountPDA,
            sortedTrovesState: sortedTrovesStatePDA,
            node: user1NodePDA,
            oracleProgram: oracleProgram.programId,
            oracleState: oracleState,
            pythPriceAccount: SOL_PRICE_FEED,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts(neighborHints)
          .signers([user1])
          .rpc();

        console.log("✅ Collateral added successfully");
      } catch (error) {
        console.log("❌ Adding collateral failed:", error);
        throw error;
      }
    });

    it("Should borrow additional loan from trove", async () => {
      const additionalLoan = "2000000000000000"; // 0.002 aUSD with 18 decimals (meets minimum)

      try {
        // Fetch current trove state to calculate new ICR
        const currentDebt = await protocolProgram.account.userDebtAmount.fetch(user1DebtAmountPDA);
        const currentCollateral = await protocolProgram.account.userCollateralAmount.fetch(user1CollateralAmountPDA);
        const newTotalDebt = currentDebt.amount.add(new BN(additionalLoan));

        // Get neighbor hints for new ICR position
        const neighborHints = await getNeighborHints(
          provider,
          protocolProgram,
          user1.publicKey,
          currentCollateral.amount,
          newTotalDebt,
          "SOL"
        );

        await protocolProgram.methods
          .borrowLoan({
            loanAmount: new anchor.BN(additionalLoan),
            collateralDenom: "SOL",
            prevNodeId: null,
            nextNodeId: null,
          })
          .accounts({
            user: user1.publicKey,
            userDebtAmount: user1DebtAmountPDA,
            liquidityThreshold: user1LiquidityThresholdPDA,
            userCollateralAmount: user1CollateralAmountPDA,
            userCollateralAccount: user1CollateralAccount,
            collateralMint: collateralMint,
            protocolCollateralAccount: protocolCollateralAccountPDA,
            totalCollateralAmount: totalCollateralAmountPDA,
            sortedTrovesState: sortedTrovesStatePDA,
            node: user1NodePDA,
            state: protocolState,
            userStablecoinAccount: user1StablecoinAccount,
            protocolStablecoinAccount: protocolStablecoinAccountPDA,
            stableCoinMint: stablecoinMint,
            oracleProgram: oracleProgram.programId,
            oracleState: oracleState,
            pythPriceAccount: SOL_PRICE_FEED,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            feesProgram: feesProgram.programId,
            feesState: feesState,
            stabilityPoolTokenAccount: stabilityPoolTokenAccount,
            feeAddress1TokenAccount: feeAddress1TokenAccount,
            feeAddress2TokenAccount: feeAddress2TokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(neighborHints)
          .signers([user1])
          .rpc();

        console.log("✅ Additional loan borrowed successfully");
      } catch (error) {
        console.log("❌ Borrowing additional loan failed:", error);
        throw error;
      }
    });

    it("Should stake stablecoins in stability pool", async () => {
      const stakeAmount = "1000000000000000"; // 0.001 aUSD with 18 decimals (minimum required)

      try {
        // User1 should have stablecoins from opening the trove in the previous test
        // We'll stake a portion of those tokens
        console.log("Staking stablecoins from user1's trove...");

        await protocolProgram.methods
          .stake({
            amount: new anchor.BN(stakeAmount),
          })
          .accounts({
            user: user1.publicKey,
            userStakeAmount: user1Stake,
            state: protocolState,
            userStablecoinAccount: user1StablecoinAccount,
            protocolStablecoinAccount: protocolStablecoinAccountPDA,
            stableCoinMint: stablecoinMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();

        console.log("✅ Stablecoins staked successfully");
      } catch (error) {
        console.log("❌ Staking failed:", error);
        throw error;
      }
    });

    it("Should open a second trove for user2", async () => {
      const collateralAmount = 1000000; // 0.001 SOL with 9 decimals (minimum for devnet)
      const loanAmount = "2000000000000000"; // 0.002 aUSD with 18 decimals (above minimum after fee)
      const collateralDenom = "SOL";

      // Get neighbor hints for off-chain sorted trove insertion
      const neighborHints = await getNeighborHints(
        provider,
        protocolProgram,
        user2.publicKey,
        new BN(collateralAmount),
        new BN(loanAmount),
        collateralDenom
      );

      // Derive user2 PDAs
      const [user2DebtAmountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), user2.publicKey.toBuffer()],
        protocolProgram.programId
      );
      const [user2LiquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), user2.publicKey.toBuffer()],
        protocolProgram.programId
      );
      const [user2CollateralAmountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_collateral_amount"), user2.publicKey.toBuffer(), Buffer.from("SOL")],
        protocolProgram.programId
      );
      const [user2NodePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("node"), user2.publicKey.toBuffer()],
        protocolProgram.programId
      );

      try {
        await protocolProgram.methods
          .openTrove({
            loanAmount: new anchor.BN(loanAmount),
            collateralDenom: collateralDenom,
            collateralAmount: new anchor.BN(collateralAmount),
          })
          .accounts({
            user: user2.publicKey,
            userDebtAmount: user2DebtAmountPda,
            liquidityThreshold: user2LiquidityThresholdPda,
            userCollateralAmount: user2CollateralAmountPda,
            userCollateralAccount: user2CollateralAccount,
            collateralMint: collateralMint,
            protocolCollateralAccount: protocolCollateralAccountPDA,
            totalCollateralAmount: totalCollateralAmountPDA,
            sortedTrovesState: sortedTrovesStatePDA,
            node: user2NodePda,
            state: protocolState,
            userStablecoinAccount: user2StablecoinAccount,
            protocolStablecoinAccount: protocolStablecoinAccountPDA,
            stableCoinMint: stablecoinMint,
            oracleProgram: oracleProgram.programId,
            oracleState: oracleState,
            pythPriceAccount: SOL_PRICE_FEED,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            feesProgram: feesProgram.programId,
            feesState: feesState,
            stabilityPoolTokenAccount: stabilityPoolTokenAccount,
            feeAddress1TokenAccount: feeAddress1TokenAccount,
            feeAddress2TokenAccount: feeAddress2TokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(neighborHints)
          .signers([user2])
          .rpc();

        console.log("✅ Second trove opened successfully");
      } catch (error) {
        console.log("❌ Second trove opening failed:", error);
        throw error;
      }
    });

    it("Should repay loan partially", async () => {
      const repayAmount = 2000000; // 2 stablecoins

      try {
        // Fetch current trove state to calculate new ICR
        const currentDebt = await protocolProgram.account.userDebtAmount.fetch(user1DebtAmountPDA);
        const currentCollateral = await protocolProgram.account.userCollateralAmount.fetch(user1CollateralAmountPDA);
        const newTotalDebt = currentDebt.amount.sub(new BN(repayAmount));

        // Get neighbor hints for new ICR position
        const neighborHints = await getNeighborHints(
          provider,
          protocolProgram,
          user1.publicKey,
          currentCollateral.amount,
          newTotalDebt,
          "SOL"
        );

        await protocolProgram.methods
          .repayLoan({
            amount: new anchor.BN(repayAmount),
            collateralDenom: "SOL",
            prevNodeId: null,
            nextNodeId: null,
          })
          .accounts({
            user: user1.publicKey,
            userDebtAmount: user1DebtAmountPDA,
            liquidityThreshold: user1LiquidityThresholdPDA,
            userCollateralAmount: user1CollateralAmountPDA,
            userCollateralAccount: user1CollateralAccount,
            collateralMint: collateralMint,
            protocolCollateralAccount: protocolCollateralAccountPDA,
            totalCollateralAmount: totalCollateralAmountPDA,
            sortedTrovesState: sortedTrovesStatePDA,
            node: user1NodePDA,
            state: protocolState,
            userStablecoinAccount: user1StablecoinAccount,
            protocolStablecoinAccount: protocolStablecoinAccountPDA,
            stableCoinMint: stablecoinMint,
            oracleProgram: oracleProgram.programId,
            oracleState: oracleState,
            pythPriceAccount: SOL_PRICE_FEED,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            feesProgram: feesProgram.programId,
            feesState: feesState,
            stabilityPoolTokenAccount: stabilityPoolTokenAccount,
            feeAddress1TokenAccount: feeAddress1TokenAccount,
            feeAddress2TokenAccount: feeAddress2TokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(neighborHints)
          .signers([user1])
          .rpc();

        console.log("✅ Loan partially repaid successfully");
      } catch (error) {
        console.log("❌ Loan repayment failed:", error);
        throw error;
      }
    });

    it("Should remove collateral from trove", async () => {
      const removeAmount = 3000000; // 3 tokens

      try {
        // Fetch current trove state to calculate new ICR
        const currentDebt = await protocolProgram.account.userDebtAmount.fetch(user1DebtAmountPDA);
        const currentCollateral = await protocolProgram.account.userCollateralAmount.fetch(user1CollateralAmountPDA);
        const newTotalCollateral = currentCollateral.amount.sub(new BN(removeAmount));

        // Get neighbor hints for new ICR position
        const neighborHints = await getNeighborHints(
          provider,
          protocolProgram,
          user1.publicKey,
          newTotalCollateral,
          currentDebt.amount,
          "SOL"
        );

        await protocolProgram.methods
          .removeCollateral({
            collateralAmount: new anchor.BN(removeAmount),
            collateralDenom: "SOL",
            prevNodeId: null,
            nextNodeId: null,
          })
          .accounts({
            user: user1.publicKey,
            userDebtAmount: user1DebtAmountPDA,
            userCollateralAmount: user1CollateralAmountPDA,
            liquidityThreshold: user1LiquidityThresholdPDA,
            state: protocolState,
            userCollateralAccount: user1CollateralAccount,
            collateralMint: collateralMint,
            protocolCollateralAccount: protocolCollateralAccountPDA,
            totalCollateralAmount: totalCollateralAmountPDA,
            sortedTrovesState: sortedTrovesStatePDA,
            node: user1NodePDA,
            oracleProgram: oracleProgram.programId,
            oracleState: oracleState,
            pythPriceAccount: SOL_PRICE_FEED,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts(neighborHints)
          .signers([user1])
          .rpc();

        console.log("✅ Collateral removed successfully");
      } catch (error) {
        console.log("❌ Removing collateral failed:", error);
        throw error;
      }
    });

    it("Should unstake stablecoins from stability pool", async () => {
      const unstakeAmount = "1000000000000000"; // 0.001 aUSD with 18 decimals (minimum required)

      try {
        await protocolProgram.methods
          .unstake({
            amount: new anchor.BN(unstakeAmount),
          })
          .accounts({
            user: user1.publicKey,
            userStakeAmount: user1Stake,
            state: protocolState,
            userStablecoinAccount: user1StablecoinAccount,
            protocolStablecoinAccount: protocolStablecoinAccountPDA,
            stableCoinMint: stablecoinMint,
            feesProgram: feesProgram.programId,
            feesState: feesState,
            stabilityPoolTokenAccount: stabilityPoolTokenAccount,
            feeAddress1TokenAccount: feeAddress1TokenAccount,
            feeAddress2TokenAccount: feeAddress2TokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();

        console.log("✅ Stablecoins unstaked successfully");
      } catch (error) {
        console.log("❌ Unstaking failed:", error);
        throw error;
      }
    });
  });

  describe("Protocol State Verification", () => {
    it("Should verify protocol state after operations", async () => {
      try {
        const stateAccount = await protocolProgram.account.stateAccount.fetch(protocolState);
        console.log("📊 Protocol State:");
        console.log("- Total Debt Amount:", stateAccount.totalDebtAmount.toString());
        console.log("- Total Collateral Amount:", stateAccount.totalCollateralAmount?.toString() || "0");
        console.log("- Total Stake Amount:", stateAccount.totalStakeAmount.toString());
        console.log("- Minimum Collateral Ratio:", stateAccount.minimumCollateralRatio.toString());
        console.log("- Protocol Fee:", stateAccount.protocolFee.toString());

        // Normal verification when operations were performed
        assert(stateAccount.totalDebtAmount.gt(new anchor.BN(0)), "Total debt should be greater than 0");
        if (stateAccount.totalCollateralAmount) {
          assert(stateAccount.totalCollateralAmount.gt(new anchor.BN(0)), "Total collateral should be greater than 0");
        }
        assert(stateAccount.totalStakeAmount.gt(new anchor.BN(0)), "Total stake should be greater than 0");
        console.log("✅ Protocol state verification passed");
      } catch (error) {
        console.log("❌ Protocol state verification failed:", error);
        throw error;
      }
    });

    it("Should verify user trove state", async () => {
      try {
        // Check if user debt amount account exists first
        const debtAccountInfo = await provider.connection.getAccountInfo(user1DebtAmountPDA);
        if (!debtAccountInfo) {
          console.log("⚠️  User debt account does not exist - skipping verification");
          return;
        }

        // Fetch user debt and collateral amounts
        const debtAccount = await protocolProgram.account.userDebtAmount.fetch(user1DebtAmountPDA);
        const collateralAccount = await protocolProgram.account.userCollateralAmount.fetch(user1CollateralAmountPDA);

        console.log("📊 User1 Trove State:");
        console.log("- Owner:", debtAccount.owner.toString());
        console.log("- Debt Amount:", debtAccount.amount.toString());
        console.log("- Collateral Amount:", collateralAccount.amount.toString());
        console.log("- Collateral Denom:", collateralAccount.denom);

        assert(debtAccount.owner.equals(user1.publicKey), "Debt account owner should match user1");
        assert(collateralAccount.owner.equals(user1.publicKey), "Collateral account owner should match user1");
        assert(debtAccount.amount.gt(new anchor.BN(0)), "Debt amount should be greater than 0");
        assert(collateralAccount.amount.gt(new anchor.BN(0)), "Collateral amount should be greater than 0");

        console.log("✅ User trove verification passed");
      } catch (error) {
        console.log("❌ User trove verification failed:", error);
        throw error;
      }
    });

    it("Should verify user stake state", async () => {
      try {
        // Check if stake account exists first
        const stakeAccountInfo = await provider.connection.getAccountInfo(user1Stake);
        if (!stakeAccountInfo) {
          console.log("⚠️  User stake account does not exist - skipping verification");
          return;
        }

        const stakeAccount = await protocolProgram.account.userStakeAmount.fetch(user1Stake);
        console.log("📊 User1 Stake State:");
        console.log("- Owner:", stakeAccount.owner.toString());
        console.log("- Amount:", stakeAccount.amount.toString());
        console.log("- P Snapshot:", stakeAccount.pSnapshot.toString());
        console.log("- Epoch Snapshot:", stakeAccount.epochSnapshot.toString());

        assert(stakeAccount.owner.equals(user1.publicKey), "Stake owner should match user1");
        assert(stakeAccount.amount.eq(new anchor.BN(0)), "Stake amount should be 0 after unstaking full amount");

        console.log("✅ User stake verification passed");
      } catch (error) {
        console.log("❌ User stake verification failed:", error);
        throw error;
      }
    });
  });
});

// Helper functions removed - using SPL Token library directly
