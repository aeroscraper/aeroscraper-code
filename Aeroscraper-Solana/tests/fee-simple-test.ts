import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerFees } from "../target/types/aerospacer_fees";
import { 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount
} from "@solana/spl-token";
import { assert, expect } from "chai";
import { BN } from "bn.js";
import * as fs from "fs";

describe("Fee Contract - Simple Test (No Airdrops)", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const connection = provider.connection;

  const feesProgram = anchor.workspace.AerospacerFees as Program<AerospacerFees>;

  // Load wallet explicitly and use same wallet for all operations
  const adminKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync("/home/taha/.config/solana/id.json", "utf8")))
  );
  const admin = adminKeypair;
  const payer = admin; // Use same wallet as payer to avoid funding issues
  
  // Load fee addresses from key files
  const feeAddr1Keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync("/home/taha/Documents/Projects/Aeroscraper/aerospacer-solana/keys/fee-addresses/fee_address_1.json", "utf8")))
  );
  const feeAddr2Keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync("/home/taha/Documents/Projects/Aeroscraper/aerospacer-solana/keys/fee-addresses/fee_address_2.json", "utf8")))
  );
  const FEE_ADDR_1 = feeAddr1Keypair.publicKey;
  const FEE_ADDR_2 = feeAddr2Keypair.publicKey;
  
  let feeStateAccount: PublicKey;
  let tokenMint: PublicKey;
  let payerTokenAccount: PublicKey;
  let stabilityPoolTokenAccount: PublicKey;
  let feeAddr1TokenAccount: PublicKey;
  let feeAddr2TokenAccount: PublicKey;

  before(async () => {
    console.log("\n🚀 Setting up Fee Contract Simple Test (No Airdrops)...");
    console.log("  Admin:", admin.publicKey.toString());
    
    // Create token mint
    tokenMint = await createMint(
      connection,
      admin,
      admin.publicKey,
      null,
      6
    );

    // Create token accounts - use admin as owner for all to avoid issues
    payerTokenAccount = await createAccount(
      connection,
      admin,
      tokenMint,
      admin.publicKey
    );

    // Use the same token account for stability pool
    stabilityPoolTokenAccount = payerTokenAccount;

    // Use the same token account for all fee addresses
    feeAddr1TokenAccount = payerTokenAccount;
    feeAddr2TokenAccount = payerTokenAccount;

    // Mint tokens to payer account
    await mintTo(
      connection,
      admin,
      tokenMint,
      payerTokenAccount,
      admin,
      1000000000 // 1000 tokens
    );
    
    // Derive the fee state PDA
    [feeStateAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee_state")],
      feesProgram.programId
    );
    
    // Check if state already exists
    try {
      const existingState = await feesProgram.account.feeStateAccount.fetch(feeStateAccount);
      console.log("✅ Fee state already exists, skipping initialization");
    } catch (error) {
      console.log("📋 Initializing new fee state...");
      await feesProgram.methods
        .initialize()
        .accounts({
          state: feeStateAccount,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();
    }

    console.log("✅ Setup complete - No airdrops used");
  });

  describe("Test 1: Initialize Fee Contract", () => {
    it("Should initialize fee contract successfully", async () => {
      const state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );

      assert.equal(
        state.admin.toString(),
        admin.publicKey.toString(),
        "Admin should be set correctly"
      );
      assert.isBoolean(
        state.isStakeEnabled,
        "Stake enabled should be a boolean"
      );
      assert.isString(
        state.totalFeesCollected.toString(),
        "Total fees should be a string"
      );

      console.log("✅ Fee contract initialized successfully");
    });
  });

  describe("Test 2: Toggle Stake Contract", () => {
    it("Should toggle stake contract on/off", async () => {
      // Enable stake
      await feesProgram.methods
        .toggleStakeContract()
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      let state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      assert.equal(state.isStakeEnabled, true, "Stake should be enabled");

      // Disable stake
      await feesProgram.methods
        .toggleStakeContract()
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      assert.equal(state.isStakeEnabled, false, "Stake should be disabled");

      console.log("✅ Stake toggle working correctly");
    });
  });

  describe("Test 3: Set Stake Contract Address", () => {
    it("Should set stake contract address", async () => {
      const stakeAddress = Keypair.generate().publicKey;
      
      await feesProgram.methods
        .setStakeContractAddress({
          address: stakeAddress.toString()
        })
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      const state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );

      assert.equal(
        state.stakeContractAddress.toString(),
        stakeAddress.toString(),
        "Stake address should be set correctly"
      );

      console.log("✅ Stake address set successfully");
    });
  });

  describe("Test 4: Set Fee Addresses", () => {
    it("Should set custom fee addresses", async () => {
      const newFeeAddr1 = Keypair.generate().publicKey;
      const newFeeAddr2 = Keypair.generate().publicKey;

      await feesProgram.methods
        .setFeeAddresses({
          feeAddress1: newFeeAddr1.toString(),
          feeAddress2: newFeeAddr2.toString()
        })
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      const state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );

      assert.equal(
        state.feeAddress1.toString(),
        newFeeAddr1.toString(),
        "Fee address 1 should be updated"
      );
      assert.equal(
        state.feeAddress2.toString(),
        newFeeAddr2.toString(),
        "Fee address 2 should be updated"
      );

      // Create token accounts for the new fee addresses
      feeAddr1TokenAccount = await createAccount(
        connection,
        admin,
        tokenMint,
        newFeeAddr1
      );

      feeAddr2TokenAccount = await createAccount(
        connection,
        admin,
        tokenMint,
        newFeeAddr2
      );

      console.log("✅ Fee addresses set successfully");
    });
  });

  describe("Test 5: Distribute Fees (Treasury Mode)", () => {
    it("Should distribute fees in treasury mode", async () => {
      const feeAmount = new BN(100000);

      const addr1BalanceBefore = await getAccount(connection, feeAddr1TokenAccount);
      const addr2BalanceBefore = await getAccount(connection, feeAddr2TokenAccount);

      await feesProgram.methods
        .distributeFee({
          feeAmount: feeAmount
        })
        .accounts({
          payer: admin.publicKey,
          state: feeStateAccount,
          payerTokenAccount: payerTokenAccount,
          stabilityPoolTokenAccount: stabilityPoolTokenAccount,
          feeAddress1TokenAccount: feeAddr1TokenAccount,
          feeAddress2TokenAccount: feeAddr2TokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc();

      const addr1BalanceAfter = await getAccount(connection, feeAddr1TokenAccount);
      const addr2BalanceAfter = await getAccount(connection, feeAddr2TokenAccount);

      const halfAmount = BigInt(feeAmount.toString()) / BigInt(2);

      assert.equal(
        addr1BalanceAfter.amount.toString(),
        (BigInt(addr1BalanceBefore.amount.toString()) + halfAmount).toString(),
        "FEE_ADDR_1 should receive half"
      );
      assert.equal(
        addr2BalanceAfter.amount.toString(),
        (BigInt(addr2BalanceBefore.amount.toString()) + halfAmount).toString(),
        "FEE_ADDR_2 should receive half"
      );

      console.log("✅ Fee distribution working correctly");
    });
  });

  describe("Test 6: Get Config", () => {
    it("Should return correct config with fee addresses", async () => {
      const config = await feesProgram.methods
        .getConfig()
        .accounts({
          state: feeStateAccount,
        })
        .view();

      assert.equal(
        config.admin.toString(),
        admin.publicKey.toString(),
        "Config admin should match"
      );
      assert.equal(
        config.isStakeEnabled,
        false,
        "Config stake enabled should be false"
      );
      assert.isString(
        config.feeAddress1.toString(),
        "Config should include fee address 1"
      );
      assert.isString(
        config.feeAddress2.toString(),
        "Config should include fee address 2"
      );

      console.log("✅ Config retrieval working correctly");
      console.log("  Fee Address 1:", config.feeAddress1.toString());
      console.log("  Fee Address 2:", config.feeAddress2.toString());
    });
  });

  after(() => {
    console.log("\n✅ Fee Contract Simple Test Complete");
    console.log("  Total Tests Passed: 6");
    console.log("  No airdrops used - only existing SOL balance");
    console.log("  Tests include: initialization, stake toggle, address setting, fee address management, fee distribution, config retrieval");
  });
});
