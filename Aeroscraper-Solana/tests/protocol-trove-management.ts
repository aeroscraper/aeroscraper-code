import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AerospacerProtocol } from "../target/types/aerospacer_protocol";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { AerospacerFees } from "../target/types/aerospacer_fees";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert, expect } from "chai";
import { fetchAllTroves, sortTrovesByICR, findNeighbors, buildNeighborAccounts, TroveData } from './trove-indexer';
import { loadTestUsers } from "./test-utils";

// Helper function to get neighbor hints for trove mutations
async function getNeighborHints(
  provider: anchor.AnchorProvider,
  protocolProgram: Program<AerospacerProtocol>,
  user: PublicKey,
  collateralAmount: BN,
  loanAmount: BN,
  denom: string,
  isNewTrove: boolean = true
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

describe("Protocol Contract - Trove Management Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const protocolProgram = anchor.workspace.AerospacerProtocol as Program<AerospacerProtocol>;
  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;
  const feesProgram = anchor.workspace.AerospacerFees as Program<AerospacerFees>;

  const admin = provider.wallet;
  const { user3, user4 } = loadTestUsers();
  const USER3 = user3.publicKey;
  const USER4 = user4.publicKey;

  console.log("user3:", user3.toString());
  console.log("user4:", user4.toString());

  const PYTH_ORACLE_ADDRESS = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");

  let stablecoinMint: PublicKey;
  let collateralMint: PublicKey;
  let protocolState: PublicKey;
  let oracleState: PublicKey;
  let feeState: PublicKey;
  let protocolVault: PublicKey;
  let protocolStablecoinVault: PublicKey;
  let user3CollateralAccount: PublicKey;
  let user3StablecoinAccount: PublicKey;
  let user4CollateralAccount: PublicKey;

  before(async () => {
    console.log("\n🚀 Setting up Trove Management Tests for devnet...");

    // Transfer minimal SOL for transaction fees and account creation
    const transferAmount = 1000000000; // 1 SOL in lamports

    const user3Tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: user3.publicKey,
        lamports: transferAmount,
      })
    );
    await provider.sendAndConfirm(user3Tx, [admin.payer]);

    const user4Tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: user4.publicKey,
        lamports: transferAmount,
      })
    );
    await provider.sendAndConfirm(user4Tx, [admin.payer]);

    // Create mints
    stablecoinMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 18);
    collateralMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 9);

    // Create token accounts
    user3CollateralAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      collateralMint,
      user3.publicKey
    );
    user3StablecoinAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      stablecoinMint,
      user3.publicKey
    );
    user4CollateralAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      collateralMint,
      user4.publicKey
    );

    // Mint collateral to users
    await mintTo(
      provider.connection,
      admin.payer,
      collateralMint,
      user3CollateralAccount,
      admin.publicKey,
      100_000_000_000
    );
    await mintTo(
      provider.connection,
      admin.payer,
      collateralMint,
      user4CollateralAccount,
      admin.publicKey,
      100_000_000_000
    );

    // Initialize oracle using PDA
    const [oracleStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      oracleProgram.programId
    );
    oracleState = oracleStatePDA;

    try {
      const existingState = await oracleProgram.account.oracleStateAccount.fetch(oracleState);
      console.log("✅ Oracle already initialized on devnet");
    } catch (error) {
      console.log("Initializing oracle...");
      await oracleProgram.methods
        .initialize({ oracleAddress: PYTH_ORACLE_ADDRESS })
        .accounts({
          state: oracleState,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([admin.payer])
        .rpc();
      console.log("✅ Oracle initialized");
    }

    // Initialize fees using PDA
    const [feesStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee_state")],
      feesProgram.programId
    );
    feeState = feesStatePDA;

    try {
      const existingState = await feesProgram.account.feeStateAccount.fetch(feeState);
      console.log("✅ Fees already initialized on devnet");
    } catch (error) {
      console.log("Initializing fees...");
      await feesProgram.methods
        .initialize()
        .accounts({
          state: feeState,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin.payer])
        .rpc();
      console.log("✅ Fees initialized");
    }

    // Initialize protocol using PDA
    const [protocolStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      protocolProgram.programId
    );
    protocolState = protocolStatePDA;

    try {
      const existingState = await protocolProgram.account.stateAccount.fetch(protocolState);
      console.log("✅ Protocol already initialized on devnet");
    } catch (error) {
      console.log("Initializing protocol...");
      await protocolProgram.methods
        .initialize({
          stableCoinCodeId: new anchor.BN(1),
          oracleHelperAddr: oracleProgram.programId,
          oracleStateAddr: oracleState,
          feeDistributorAddr: feesProgram.programId,
          feeStateAddr: feeState,
        })
        .accounts({
          state: protocolState,
          admin: admin.publicKey,
          stableCoinMint: stablecoinMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin.payer])
        .rpc();
      console.log("✅ Protocol initialized");
    }

    // Derive protocol collateral vault
    [protocolVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_collateral_vault"), collateralMint.toBuffer()],
      protocolProgram.programId
    );

    // Derive protocol stablecoin vault
    [protocolStablecoinVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_stablecoin_vault"), stablecoinMint.toBuffer()],
      protocolProgram.programId
    );

    console.log("✅ Setup complete");
    console.log("  user3:", user3.publicKey.toString());
    console.log("  Protocol State:", protocolState.toString());
    console.log("  Collateral Mint:", collateralMint.toString());
    console.log("  Stablecoin Mint:", stablecoinMint.toString());
  });

  describe("Test 2.1: Open Trove with Valid Collateral", () => {
    it("Should successfully open trove with sufficient collateral", async () => {
      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), user3.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          user3.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), user3.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const collateralAmount = new BN(10000000000); // 10 SOL
      const loanAmount = new BN(1100000000000000); // 1 aUSD

      console.log("📋 Opening trove...");
      console.log("  Collateral:", collateralAmount.toString(), "lamports (10 SOL)");
      console.log("  Loan:", loanAmount.toString(), "base units (1 aUSD)");

      // Fetch and sort all troves to find neighbors
      const remainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        user3.publicKey,
        collateralAmount,
        loanAmount,
        "SOL",
        true
      );

      const tx = await protocolProgram.methods
        .openTrove({
          collateralAmount,
          loanAmount,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: user3.publicKey,
          userCollateralAccount: user3CollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: user3StablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: user3StablecoinAccount, // Use user account for now
          feeAddress1TokenAccount: user3StablecoinAccount, // Use user account for now
          feeAddress2TokenAccount: user3StablecoinAccount, // Use user account for now
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .signers([user3])
        .rpc();

      console.log("✅ Trove opened. TX:", tx);

      const userDebt = await protocolProgram.account.userDebtAmount.fetch(userDebtPda);
      const userCollateral = await protocolProgram.account.userCollateralAmount.fetch(
        userCollateralPda
      );

      assert.equal(userDebt.amount.toString(), loanAmount.toString());
      assert.equal(userCollateral.amount.toString(), collateralAmount.toString());

      console.log("✅ Trove state verified");
    });
  });

  describe("Test 2.2: Reject Duplicate Trove Opening", () => {
    it("Should fail when user tries to open second trove", async () => {
      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), user4.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          user4.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), user4.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const user4StablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        user4.publicKey
      );

      // First trove opens successfully
      const collateralAmount1 = new BN(10000000000);
      const loanAmount1 = new BN(1100000000000000);

      const remainingAccounts1 = await getNeighborHints(
        provider,
        protocolProgram,
        user4.publicKey,
        collateralAmount1,
        loanAmount1,
        "SOL",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount: collateralAmount1,
          loanAmount: loanAmount1,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: user4.publicKey,
          userCollateralAccount: user4CollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: user4StablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: user4StablecoinAccount,
          feeAddress1TokenAccount: user4StablecoinAccount,
          feeAddress2TokenAccount: user4StablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts1)
        .signers([user4])
        .rpc();

      console.log("🔒 Attempting to open duplicate trove...");

      try {
        const collateralAmount2 = new BN(5000000000);
        const loanAmount2 = new BN(500000000000000000);

        const remainingAccounts2 = await getNeighborHints(
          provider,
          protocolProgram,
          user4.publicKey,
          collateralAmount2,
          loanAmount2,
          "SOL",
          true
        );

        await protocolProgram.methods
          .openTrove({
            collateralAmount: collateralAmount2,
            loanAmount: loanAmount2,
            collateralDenom: "SOL",
          })
          .accounts({
            state: protocolState,
            userDebtAmount: userDebtPda,
            userCollateralAmount: userCollateralPda,
            totalCollateralAmount: totalCollateralPda,
            user: user4.publicKey,
            userCollateralAccount: user4CollateralAccount,
            protocolCollateralAccount: protocolVault,
            userStablecoinAccount: user4StablecoinAccount,
            protocolStablecoinAccount: protocolStablecoinVault,
            stableCoinMint: stablecoinMint,
            collateralMint: collateralMint,
            liquidityThreshold: liquidityThresholdPda,
            oracleProgram: oracleProgram.programId,
            oracleState: oracleState,
            pythPriceAccount: PYTH_ORACLE_ADDRESS,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            feesProgram: feesProgram.programId,
            feesState: feeState,
            stabilityPoolTokenAccount: user4StablecoinAccount,
            feeAddress1TokenAccount: user4StablecoinAccount,
            feeAddress2TokenAccount: user4StablecoinAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(remainingAccounts2)
          .signers([user4])
          .rpc();

        assert.fail("Should have rejected duplicate trove");
      } catch (error: any) {
        console.log("✅ Duplicate trove correctly rejected");
        expect(error.message).to.include("already in use");
      }
    });
  });

  describe("Test 2.3: Add Collateral to Existing Trove", () => {
    it("Should successfully add collateral", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      // Open trove
      const openCollateralAmount = new BN(10000000000);
      const openLoanAmount = new BN(1100000000000000);

      const openRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        openCollateralAmount,
        openLoanAmount,
        "SOL",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount: openCollateralAmount,
          loanAmount: openLoanAmount,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: testStablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(openRemainingAccounts)
        .signers([testUser])
        .rpc();

      const initialCollateral = await protocolProgram.account.userCollateralAmount.fetch(
        userCollateralPda
      );

      console.log("📋 Adding collateral...");
      console.log("  Initial:", initialCollateral.amount.toString());

      // Add collateral
      const addCollateralAmount = new BN(5000000000);
      const newTotalCollateral = openCollateralAmount.add(addCollateralAmount);

      const addCollateralRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        newTotalCollateral,
        openLoanAmount,
        "SOL",
        false
      );

      await protocolProgram.methods
        .addCollateral({
          amount: addCollateralAmount,
          collateralDenom: "SOL",
          prevNodeId: null,
          nextNodeId: null,
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          liquidityThreshold: liquidityThresholdPda,
          userCollateralAccount: testCollateralAccount,
          collateralMint: collateralMint,
          protocolCollateralAccount: protocolVault,
          totalCollateralAmount: totalCollateralPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          user: testUser.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(addCollateralRemainingAccounts)
        .signers([testUser])
        .rpc();

      const finalCollateral = await protocolProgram.account.userCollateralAmount.fetch(
        userCollateralPda
      );

      console.log("  Final:", finalCollateral.amount.toString());

      const expected = initialCollateral.amount.add(new BN(5000000000));
      assert.equal(finalCollateral.amount.toString(), expected.toString());

      console.log("✅ Collateral added successfully");
    });
  });

  describe("Test 2.4: Borrow Loan from Trove", () => {
    it("Should successfully borrow additional loan", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      // Open trove with high collateral
      const highCollateralAmount = new BN(20000000000);
      const initialLoanAmount = new BN(1100000000000000);

      const highCollateralRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        highCollateralAmount,
        initialLoanAmount,
        "SOL",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount: highCollateralAmount,
          loanAmount: initialLoanAmount,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: testStablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(highCollateralRemainingAccounts)
        .signers([testUser])
        .rpc();

      const initialDebt = await protocolProgram.account.userDebtAmount.fetch(userDebtPda);
      console.log("📋 Borrowing additional loan...");
      console.log("  Initial debt:", initialDebt.amount.toString());

      // Borrow more
      const additionalLoan = new BN(500000000000000000);
      const newTotalDebt = initialLoanAmount.add(additionalLoan);

      const borrowLoanRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        highCollateralAmount,
        newTotalDebt,
        "SOL",
        false
      );

      await protocolProgram.methods
        .borrowLoan({
          loanAmount: additionalLoan,
          collateralDenom: "SOL",
          prevNodeId: null,
          nextNodeId: null,
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          liquidityThreshold: liquidityThresholdPda,
          userStablecoinAccount: testStablecoinAccount,
          stableCoinMint: stablecoinMint,
          protocolStablecoinAccount: protocolStablecoinVault,
          userCollateralAmount: userCollateralPda,
          userCollateralAccount: testCollateralAccount,
          collateralMint: collateralMint,
          protocolCollateralAccount: protocolVault,
          totalCollateralAmount: totalCollateralPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          user: testUser.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(borrowLoanRemainingAccounts)
        .signers([testUser])
        .rpc();

      const finalDebt = await protocolProgram.account.userDebtAmount.fetch(userDebtPda);
      console.log("  Final debt:", finalDebt.amount.toString());

      const expected = initialDebt.amount.add(additionalLoan);
      assert.equal(finalDebt.amount.toString(), expected.toString());

      console.log("✅ Loan borrowed successfully");
    });
  });

  describe("Test 2.5: Repay Loan Partially", () => {
    it("Should successfully repay part of the loan", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      // Open trove
      const loanAmount = new BN(2000000000000000000);
      const repayTestCollateralAmount = new BN(20000000000);

      const repayTestRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        repayTestCollateralAmount,
        loanAmount,
        "SOL",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount: repayTestCollateralAmount,
          loanAmount,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: testStablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(repayTestRemainingAccounts)
        .signers([testUser])
        .rpc();

      const initialDebt = await protocolProgram.account.userDebtAmount.fetch(userDebtPda);
      console.log("📋 Repaying loan partially...");
      console.log("  Initial debt:", initialDebt.amount.toString());

      // Repay half
      const repayAmount = new BN(1100000000000000);
      await protocolProgram.methods
        .repayLoan({
          amount: repayAmount,
          collateralDenom: "SOL",
          prevNodeId: null,
          nextNodeId: null,
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          liquidityThreshold: liquidityThresholdPda,
          userStablecoinAccount: testStablecoinAccount,
          userCollateralAccount: testCollateralAccount,
          collateralMint: collateralMint,
          protocolCollateralAccount: protocolVault,
          stableCoinMint: stablecoinMint,
          totalCollateralAmount: totalCollateralPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          user: testUser.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      const finalDebt = await protocolProgram.account.userDebtAmount.fetch(userDebtPda);
      console.log("  Final debt:", finalDebt.amount.toString());

      const expected = initialDebt.amount.sub(repayAmount);
      assert.equal(finalDebt.amount.toString(), expected.toString());

      console.log("✅ Loan repaid partially");
    });
  });

  describe("Test 2.6: Repay Loan Fully", () => {
    it("Should successfully repay all debt", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      // Open trove
      const loanAmount = new BN(1100000000000000);
      const fullRepayCollateralAmount = new BN(15000000000);

      const fullRepayRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        fullRepayCollateralAmount,
        loanAmount,
        "SOL",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount: fullRepayCollateralAmount,
          loanAmount,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: testStablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(fullRepayRemainingAccounts)
        .signers([testUser])
        .rpc();

      console.log("📋 Repaying full loan...");

      // Repay all
      await protocolProgram.methods
        .repayLoan({
          amount: loanAmount,
          collateralDenom: "SOL",
          prevNodeId: null,
          nextNodeId: null,
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          liquidityThreshold: liquidityThresholdPda,
          userStablecoinAccount: testStablecoinAccount,
          userCollateralAccount: testCollateralAccount,
          collateralMint: collateralMint,
          protocolCollateralAccount: protocolVault,
          stableCoinMint: stablecoinMint,
          totalCollateralAmount: totalCollateralPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          user: testUser.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      const finalDebt = await protocolProgram.account.userDebtAmount.fetch(userDebtPda);
      assert.equal(finalDebt.amount.toString(), "0");

      console.log("✅ Loan fully repaid");
    });
  });

  describe("Test 2.7: Close Trove", () => {
    it("Should successfully close trove after full repayment", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      const loanAmount = new BN(1100000000000000);
      const collateralAmount = new BN(15000000000);

      // Open trove
      const closeTroveRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        collateralAmount,
        loanAmount,
        "SOL",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount,
          loanAmount,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: testStablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(closeTroveRemainingAccounts)
        .signers([testUser])
        .rpc();

      console.log("📋 Closing trove...");

      // Close trove
      await protocolProgram.methods
        .closeTrove({
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          liquidityThreshold: liquidityThresholdPda,
          userStablecoinAccount: testStablecoinAccount,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralVault: protocolVault,
          stableCoinMint: stablecoinMint,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([testUser])
        .rpc();

      // Verify accounts are closed
      const debtAccount = await provider.connection.getAccountInfo(userDebtPda);
      const collateralAccount = await provider.connection.getAccountInfo(userCollateralPda);

      assert.isNull(debtAccount, "Debt account should be closed");
      assert.isNull(collateralAccount, "Collateral account should be closed");

      console.log("✅ Trove closed successfully");
    });
  });

  describe("Test 2.8: Remove Collateral (Maintaining MCR)", () => {
    it("Should successfully remove collateral while maintaining MCR", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      // Open trove with excess collateral
      const excessCollateralAmount = new BN(30000000000);
      const removeLoanAmount = new BN(1100000000000000);

      const excessCollateralRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        excessCollateralAmount,
        removeLoanAmount,
        "SOL",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount: excessCollateralAmount,
          loanAmount: removeLoanAmount,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: testStablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(excessCollateralRemainingAccounts)
        .signers([testUser])
        .rpc();

      const initialCollateral = await protocolProgram.account.userCollateralAmount.fetch(
        userCollateralPda
      );

      console.log("📋 Removing collateral...");
      console.log("  Initial:", initialCollateral.amount.toString());

      // Remove some collateral (maintaining MCR)
      const removeAmount = new BN(5000000000);
      const newCollateralAmount = excessCollateralAmount.sub(removeAmount);

      const removeCollateralRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        newCollateralAmount,
        removeLoanAmount,
        "SOL",
        false
      );

      await protocolProgram.methods
        .removeCollateral({
          collateralAmount: removeAmount,
          collateralDenom: "SOL",
          prevNodeId: null,
          nextNodeId: null,
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          liquidityThreshold: liquidityThresholdPda,
          userCollateralAccount: testCollateralAccount,
          collateralMint: collateralMint,
          protocolCollateralAccount: protocolVault,
          totalCollateralAmount: totalCollateralPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          user: testUser.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(removeCollateralRemainingAccounts)
        .signers([testUser])
        .rpc();

      const finalCollateral = await protocolProgram.account.userCollateralAmount.fetch(
        userCollateralPda
      );

      console.log("  Final:", finalCollateral.amount.toString());

      const expected = initialCollateral.amount.sub(new BN(5000000000));
      assert.equal(finalCollateral.amount.toString(), expected.toString());

      console.log("✅ Collateral removed successfully");
    });
  });

  describe("Test 2.9: Reject Collateral Removal Below MCR", () => {
    it("Should fail when removing collateral would violate MCR", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      // Open trove with minimal collateral
      const minimalCollateralAmount = new BN(12000000000);
      const minimalLoanAmount = new BN(1100000000000000);

      const minimalCollateralRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        minimalCollateralAmount,
        minimalLoanAmount,
        "SOL",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount: minimalCollateralAmount,
          loanAmount: minimalLoanAmount,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: testStablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(minimalCollateralRemainingAccounts)
        .signers([testUser])
        .rpc();

      console.log("🔒 Attempting to remove collateral below MCR...");

      try {
        const invalidRemoveAmount = new BN(10000000000);
        const invalidNewCollateral = minimalCollateralAmount.sub(invalidRemoveAmount);

        const invalidRemoveRemainingAccounts = await getNeighborHints(
          provider,
          protocolProgram,
          testUser.publicKey,
          invalidNewCollateral,
          minimalLoanAmount,
          "SOL",
          false
        );

        await protocolProgram.methods
          .removeCollateral({
            collateralAmount: invalidRemoveAmount,
            collateralDenom: "SOL",
            prevNodeId: null,
            nextNodeId: null,
          })
          .accounts({
            state: protocolState,
            userDebtAmount: userDebtPda,
            userCollateralAmount: userCollateralPda,
            liquidityThreshold: liquidityThresholdPda,
            userCollateralAccount: testCollateralAccount,
            collateralMint: collateralMint,
            protocolCollateralAccount: protocolVault,
            totalCollateralAmount: totalCollateralPda,
            oracleProgram: oracleProgram.programId,
            oracleState: oracleState,
            pythPriceAccount: PYTH_ORACLE_ADDRESS,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            user: testUser.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(invalidRemoveRemainingAccounts)
          .signers([testUser])
          .rpc();

        assert.fail("Should have rejected removal below MCR");
      } catch (error: any) {
        console.log("✅ Removal below MCR correctly rejected");
        expect(error.message).to.include("InvalidCollateralRatio");
      }
    });
  });

  describe("Test 2.10: Reject Borrow Below Minimum Loan Amount", () => {
    it("Should fail when borrowing below minimum loan amount", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      console.log("🔒 Attempting to open trove with loan below minimum...");

      try {
        const belowMinCollateralAmount = new BN(10000000000);
        const belowMinLoanAmount = new BN(100000000000000000); // 0.1 aUSD (below 1 aUSD minimum)

        const belowMinRemainingAccounts = await getNeighborHints(
          provider,
          protocolProgram,
          testUser.publicKey,
          belowMinCollateralAmount,
          belowMinLoanAmount,
          "SOL",
          true
        );

        await protocolProgram.methods
          .openTrove({
            collateralAmount: belowMinCollateralAmount,
            loanAmount: belowMinLoanAmount,
            collateralDenom: "SOL",
          })
          .accounts({
            state: protocolState,
            userDebtAmount: userDebtPda,
            userCollateralAmount: userCollateralPda,
            totalCollateralAmount: totalCollateralPda,
            user: testUser.publicKey,
            userCollateralAccount: testCollateralAccount,
            protocolCollateralAccount: protocolVault,
            userStablecoinAccount: testStablecoinAccount,
            protocolStablecoinAccount: protocolStablecoinVault,
            stableCoinMint: stablecoinMint,
            collateralMint: collateralMint,
            liquidityThreshold: liquidityThresholdPda,
            oracleProgram: oracleProgram.programId,
            oracleState: oracleState,
            pythPriceAccount: PYTH_ORACLE_ADDRESS,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            feesProgram: feesProgram.programId,
            feesState: feeState,
            stabilityPoolTokenAccount: testStablecoinAccount,
            feeAddress1TokenAccount: testStablecoinAccount,
            feeAddress2TokenAccount: testStablecoinAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(belowMinRemainingAccounts)
          .signers([testUser])
          .rpc();

        assert.fail("Should have rejected loan below minimum");
      } catch (error: any) {
        console.log("✅ Loan below minimum correctly rejected");
        expect(error.message).to.include("LoanAmountBelowMinimum");
      }
    });
  });

  describe("Test 2.11: Reject Close Trove with Outstanding Debt", () => {
    it("Should fail when trying to close trove with debt", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("SOL"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("SOL")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      // Open trove
      const closeWithDebtCollateralAmount = new BN(15000000000);
      const closeWithDebtLoanAmount = new BN(1100000000000000);

      const closeWithDebtRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        closeWithDebtCollateralAmount,
        closeWithDebtLoanAmount,
        "SOL",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount: closeWithDebtCollateralAmount,
          loanAmount: closeWithDebtLoanAmount,
          collateralDenom: "SOL",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: testStablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(closeWithDebtRemainingAccounts)
        .signers([testUser])
        .rpc();

      console.log("🔒 Attempting to close trove with outstanding debt...");

      try {
        await protocolProgram.methods
          .closeTrove({
            collateralDenom: "SOL",
          })
          .accounts({
            state: protocolState,
            userDebtAmount: userDebtPda,
            userCollateralAmount: userCollateralPda,
            liquidityThreshold: liquidityThresholdPda,
            userStablecoinAccount: testStablecoinAccount,
            userCollateralAccount: testCollateralAccount,
            protocolCollateralVault: protocolVault,
            stableCoinMint: stablecoinMint,
            totalCollateralAmount: totalCollateralPda,
            user: testUser.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testUser])
          .rpc();

        assert.fail("Should have rejected closing trove with debt");
      } catch (error: any) {
        console.log("✅ Close with outstanding debt correctly rejected");
        expect(error.message).to.include("OutstandingDebt");
      }
    });
  });

  describe("Test 2.12: Open Trove with Multiple Collateral Types", () => {
    it("Should support multiple collateral denominations", async () => {
      const testUser = Keypair.generate();
      const transferAmount = 1000000000; // 0.01 SOL in lamports
      const testUserTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: testUser.publicKey,
          lamports: transferAmount,
        })
      );
      await provider.sendAndConfirm(testUserTx, [admin.payer]);

      const testCollateralAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        collateralMint,
        testUser.publicKey
      );

      await mintTo(
        provider.connection,
        admin.payer,
        collateralMint,
        testCollateralAccount,
        admin.publicKey,
        50_000_000_000
      );

      const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_collateral_amount"),
          testUser.publicKey.toBuffer(),
          Buffer.from("USDC"),
        ],
        protocolProgram.programId
      );

      const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from("USDC")],
        protocolProgram.programId
      );

      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), testUser.publicKey.toBuffer()],
        protocolProgram.programId
      );

      const testStablecoinAccount = await createAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        stablecoinMint,
        testUser.publicKey
      );

      console.log("📋 Opening trove with USDC collateral...");

      const usdcCollateralAmount = new BN(10000000000);
      const usdcLoanAmount = new BN(1100000000000000);

      const usdcRemainingAccounts = await getNeighborHints(
        provider,
        protocolProgram,
        testUser.publicKey,
        usdcCollateralAmount,
        usdcLoanAmount,
        "USDC",
        true
      );

      await protocolProgram.methods
        .openTrove({
          collateralAmount: usdcCollateralAmount,
          loanAmount: usdcLoanAmount,
          collateralDenom: "USDC",
        })
        .accounts({
          state: protocolState,
          userDebtAmount: userDebtPda,
          userCollateralAmount: userCollateralPda,
          totalCollateralAmount: totalCollateralPda,
          user: testUser.publicKey,
          userCollateralAccount: testCollateralAccount,
          protocolCollateralAccount: protocolVault,
          userStablecoinAccount: testStablecoinAccount,
          protocolStablecoinAccount: protocolStablecoinVault,
          stableCoinMint: stablecoinMint,
          collateralMint: collateralMint,
          liquidityThreshold: liquidityThresholdPda,
          oracleProgram: oracleProgram.programId,
          oracleState: oracleState,
          pythPriceAccount: PYTH_ORACLE_ADDRESS,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          feesProgram: feesProgram.programId,
          feesState: feeState,
          stabilityPoolTokenAccount: testStablecoinAccount,
          feeAddress1TokenAccount: testStablecoinAccount,
          feeAddress2TokenAccount: testStablecoinAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(usdcRemainingAccounts)
        .signers([testUser])
        .rpc();

      const userCollateral = await protocolProgram.account.userCollateralAmount.fetch(
        userCollateralPda
      );

      assert.equal(userCollateral.denom, "USDC");
      assert.equal(userCollateral.amount.toString(), "10000000000");

      console.log("✅ Multiple collateral types supported");
    });
  });
});
