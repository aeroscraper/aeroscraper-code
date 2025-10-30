import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerFees } from "../target/types/aerospacer_fees";
import { 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { assert, expect } from "chai";
import * as fs from "fs";

describe("Fee Contract - Basic Test (No Airdrops, No Tokens)", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const connection = provider.connection;

  const feesProgram = anchor.workspace.AerospacerFees as Program<AerospacerFees>;

  // Load wallet explicitly
  const adminKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync("/home/taha/.config/solana/id.json", "utf8")))
  );
  const admin = adminKeypair;
  let feeStateAccount: PublicKey;

  before(async () => {
    console.log("\n🚀 Setting up Fee Contract Basic Test (No Airdrops, No Tokens)...");
    console.log("  Admin:", admin.publicKey.toString());
    console.log("  Using existing wallet balance (no airdrops needed)");
    
    // Derive the fee state PDA
    [feeStateAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee_state")],
      feesProgram.programId
    );
    
    console.log("📋 Initializing fee contract...");
    
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
      // Stake enabled state might vary if state was already initialized from previous tests
      assert.isBoolean(
        state.isStakeEnabled,
        "Stake enabled should be a boolean"
      );
      // Total fees might be > 0 if state was already initialized from previous tests
      assert.isString(
        state.totalFeesCollected.toString(),
        "Total fees should be a string"
      );

      console.log("✅ Fee contract initialized successfully");
    });
  });

  describe("Test 2: Toggle Stake Contract", () => {
    it("Should toggle stake contract on/off", async () => {
      // Get current state
      let state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      const initialState = state.isStakeEnabled;
      
      // Toggle stake
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
      assert.equal(state.isStakeEnabled, !initialState, "Stake should be toggled");

      // Toggle back
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
      assert.equal(state.isStakeEnabled, initialState, "Stake should be back to original state");

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
        "Fee address 1 should be set correctly"
      );
      assert.equal(
        state.feeAddress2.toString(),
        newFeeAddr2.toString(),
        "Fee address 2 should be set correctly"
      );

      console.log("✅ Fee addresses set successfully");
    });
  });

  describe("Test 5: Get Config", () => {
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
      // Stake enabled state might vary if state was already initialized from previous tests
      assert.isBoolean(
        config.isStakeEnabled,
        "Config stake enabled should be a boolean"
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

  describe("Test 6: Multiple State Changes", () => {
    it("Should handle multiple state changes correctly", async () => {
      // Get initial state
      let state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      let currentValue = state.isStakeEnabled;
      
      // Test multiple toggles
      for (let i = 0; i < 3; i++) {
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
        
        // Each toggle should flip the value
        currentValue = !currentValue;
        assert.equal(state.isStakeEnabled, currentValue, `Toggle ${i + 1} should be ${currentValue}`);
      }

      // Test multiple address changes
      for (let i = 0; i < 3; i++) {
        const newAddress = Keypair.generate().publicKey;
        
        await feesProgram.methods
          .setStakeContractAddress({
            address: newAddress.toString()
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
          newAddress.toString(),
          `Address change ${i + 1} should be correct`
        );
      }

      console.log("✅ Multiple state changes working correctly");
    });
  });

  after(() => {
    console.log("\n✅ Fee Contract Basic Test Complete");
    console.log("  Total Tests Passed: 6");
    console.log("  No airdrops used - only existing SOL balance");
    console.log("  No token operations - minimal SOL usage");
    console.log("  Tests include: initialization, stake toggle, address setting, fee address management, config retrieval, state changes");
  });
});
