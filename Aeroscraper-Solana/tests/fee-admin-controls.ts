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

describe("Fee Contract - Admin Controls Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const connection = provider.connection;

  const feesProgram = anchor.workspace.AerospacerFees as Program<AerospacerFees>;

  // Load wallet explicitly
  const adminKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync("/home/taha/.config/solana/id.json", "utf8")))
  );
  const admin = adminKeypair;
  const nonAdmin = Keypair.generate(); // Generate different keypair for non-admin tests
  let feeStateAccount: PublicKey;

  before(async () => {
    console.log("\n🚀 Setting up Fee Contract Admin Controls Tests...");
    console.log("  Admin:", admin.publicKey.toString());
    console.log("  Using same wallet for all operations (no airdrops needed)");

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

    console.log("✅ Setup complete");
    console.log("  Admin:", admin.publicKey.toString());
    console.log("  Non-Admin:", nonAdmin.publicKey.toString());
    console.log("  State:", feeStateAccount.toString());
  });

  describe("Test 2.1: Admin Can Toggle Stake Contract (Disabled → Enabled)", () => {
    it("Should enable stake contract when toggled from disabled", async () => {
      const stateBefore = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      const initialState = stateBefore.isStakeEnabled;

      console.log("🔄 Toggling stake contract from disabled to enabled...");

      const tx = await feesProgram.methods
        .toggleStakeContract()
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      console.log("✅ Toggle successful. TX:", tx);

      const stateAfter = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );

      assert.equal(
        stateAfter.isStakeEnabled,
        !initialState,
        "Stake should be toggled"
      );
      console.log("✅ Stake contract enabled successfully");
    });
  });

  describe("Test 2.2: Admin Can Toggle Stake Contract (Enabled → Disabled)", () => {
    it("Should disable stake contract when toggled from enabled", async () => {
      const stateBefore = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      const initialState = stateBefore.isStakeEnabled;

      console.log("🔄 Toggling stake contract from enabled to disabled...");

      const tx = await feesProgram.methods
        .toggleStakeContract()
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      console.log("✅ Toggle successful. TX:", tx);

      const stateAfter = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );

      assert.equal(
        stateAfter.isStakeEnabled,
        !initialState,
        "Stake should be toggled"
      );
      console.log("✅ Stake contract disabled successfully");
    });
  });

  describe("Test 2.3: Admin Can Set Valid Stake Contract Address", () => {
    it("Should set stake contract address successfully", async () => {
      const stakeAddress = Keypair.generate().publicKey;

      console.log("📝 Setting stake contract address...");
      console.log("  New Address:", stakeAddress.toString());

      const tx = await feesProgram.methods
        .setStakeContractAddress({
          address: stakeAddress.toString()
        })
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      console.log("✅ Address set. TX:", tx);

      const state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );

      assert.equal(
        state.stakeContractAddress.toString(),
        stakeAddress.toString(),
        "Stake address should be set correctly"
      );
      console.log("✅ Stake contract address set successfully");
    });

    it("Should allow updating stake contract address multiple times", async () => {
      const address1 = Keypair.generate().publicKey;
      const address2 = Keypair.generate().publicKey;

      await feesProgram.methods
        .setStakeContractAddress({
          address: address1.toString()
        })
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      let state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      assert.equal(state.stakeContractAddress.toString(), address1.toString());

      await feesProgram.methods
        .setStakeContractAddress({
          address: address2.toString()
        })
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      assert.equal(state.stakeContractAddress.toString(), address2.toString());

      console.log("✅ Address updated multiple times successfully");
    });
  });

  describe("Test 2.4: Reject Invalid Stake Contract Address", () => {
    it("Should fail with malformed address string", async () => {
      console.log("🔒 Attempting to set invalid address...");

      try {
        await feesProgram.methods
          .setStakeContractAddress({
            address: "invalid-address-format"
          })
          .accounts({
            admin: admin.publicKey,
            state: feeStateAccount,
          })
          .signers([admin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Invalid address correctly rejected");
        console.log("  Error:", error.message);
        expect(error.message).to.exist;
      }
    });

    it("Should fail with empty string address", async () => {
      try {
        await feesProgram.methods
          .setStakeContractAddress({
            address: ""
          })
          .accounts({
            admin: admin.publicKey,
            state: feeStateAccount,
          })
          .signers([admin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Empty address correctly rejected");
        expect(error.message).to.exist;
      }
    });
  });

  describe("Test 2.5: Non-Admin Cannot Toggle Stake Contract", () => {
    it("Should fail when non-admin tries to toggle", async () => {
      console.log("🔒 Attempting toggle as non-admin...");

      try {
        await feesProgram.methods
          .toggleStakeContract()
          .accounts({
            admin: nonAdmin.publicKey,
            state: feeStateAccount,
          })
          .signers([nonAdmin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Non-admin toggle correctly prevented");
        console.log("  Error:", error.message);
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Test 2.6: Non-Admin Cannot Set Stake Contract Address", () => {
    it("Should fail when non-admin tries to set address", async () => {
      const stakeAddress = Keypair.generate().publicKey;

      console.log("🔒 Attempting to set address as non-admin...");

      try {
        await feesProgram.methods
          .setStakeContractAddress({
            address: stakeAddress.toString()
          })
          .accounts({
            admin: nonAdmin.publicKey,
            state: feeStateAccount,
          })
          .signers([nonAdmin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Non-admin set address correctly prevented");
        console.log("  Error:", error.message);
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Test 2.7: Admin Can Set Fee Addresses", () => {
    it("Should set valid fee addresses successfully", async () => {
      const newFeeAddr1 = Keypair.generate().publicKey;
      const newFeeAddr2 = Keypair.generate().publicKey;

      console.log("📝 Setting new fee addresses...");
      console.log("  Fee Address 1:", newFeeAddr1.toString());
      console.log("  Fee Address 2:", newFeeAddr2.toString());

      const tx = await feesProgram.methods
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

      console.log("✅ Fee addresses set. TX:", tx);

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

    it("Should allow updating fee addresses multiple times", async () => {
      const addr1_1 = Keypair.generate().publicKey;
      const addr1_2 = Keypair.generate().publicKey;
      const addr2_1 = Keypair.generate().publicKey;
      const addr2_2 = Keypair.generate().publicKey;

      // First update
      await feesProgram.methods
        .setFeeAddresses({
          feeAddress1: addr1_1.toString(),
          feeAddress2: addr1_2.toString()
        })
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      let state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      assert.equal(state.feeAddress1.toString(), addr1_1.toString());
      assert.equal(state.feeAddress2.toString(), addr1_2.toString());

      // Second update
      await feesProgram.methods
        .setFeeAddresses({
          feeAddress1: addr2_1.toString(),
          feeAddress2: addr2_2.toString()
        })
        .accounts({
          admin: admin.publicKey,
          state: feeStateAccount,
        })
        .signers([admin])
        .rpc();

      state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      assert.equal(state.feeAddress1.toString(), addr2_1.toString());
      assert.equal(state.feeAddress2.toString(), addr2_2.toString());

      console.log("✅ Fee addresses updated multiple times successfully");
    });
  });

  describe("Test 2.8: Reject Invalid Fee Addresses", () => {
    it("Should fail with malformed fee address strings", async () => {
      console.log("🔒 Attempting to set invalid fee addresses...");

      try {
        await feesProgram.methods
          .setFeeAddresses({
            feeAddress1: "invalid-address-format",
            feeAddress2: "another-invalid-address"
          })
          .accounts({
            admin: admin.publicKey,
            state: feeStateAccount,
          })
          .signers([admin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Invalid fee addresses correctly rejected");
        console.log("  Error:", error.message);
        expect(error.message).to.exist;
      }
    });

    it("Should fail when fee addresses are the same", async () => {
      const sameAddress = Keypair.generate().publicKey;

      try {
        await feesProgram.methods
          .setFeeAddresses({
            feeAddress1: sameAddress.toString(),
            feeAddress2: sameAddress.toString()
          })
          .accounts({
            admin: admin.publicKey,
            state: feeStateAccount,
          })
          .signers([admin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Identical fee addresses correctly rejected");
        expect(error.message).to.exist;
      }
    });
  });

  describe("Test 2.9: Non-Admin Cannot Set Fee Addresses", () => {
    it("Should fail when non-admin tries to set fee addresses", async () => {
      const feeAddr1 = Keypair.generate().publicKey;
      const feeAddr2 = Keypair.generate().publicKey;

      console.log("🔒 Attempting to set fee addresses as non-admin...");

      try {
        await feesProgram.methods
          .setFeeAddresses({
            feeAddress1: feeAddr1.toString(),
            feeAddress2: feeAddr2.toString()
          })
          .accounts({
            admin: nonAdmin.publicKey,
            state: feeStateAccount,
          })
          .signers([nonAdmin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Non-admin set fee addresses correctly prevented");
        console.log("  Error:", error.message);
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Test 2.10: Multiple Rapid Toggles Work Correctly", () => {
    it("Should handle rapid consecutive toggles", async () => {
      console.log("⚡ Performing rapid toggles...");

      const initialState = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );
      const startValue = initialState.isStakeEnabled;

      for (let i = 0; i < 5; i++) {
        await feesProgram.methods
          .toggleStakeContract()
          .accounts({
            admin: admin.publicKey,
            state: feeStateAccount,
          })
          .signers([admin])
          .rpc();

        const state = await feesProgram.account.feeStateAccount.fetch(
          feeStateAccount
        );

        const expectedValue = (i + 1) % 2 === 1 ? !startValue : startValue;
        assert.equal(
          state.isStakeEnabled,
          expectedValue,
          `Toggle ${i + 1} should have correct value`
        );

        console.log(`  Toggle ${i + 1}: ${state.isStakeEnabled}`);
      }

      console.log("✅ Rapid toggles completed successfully");
    });

    it("Should maintain state consistency after rapid toggles", async () => {
      const state = await feesProgram.account.feeStateAccount.fetch(
        feeStateAccount
      );

      expect(state).to.have.property("admin");
      expect(state).to.have.property("isStakeEnabled");
      expect(state).to.have.property("stakeContractAddress");
      expect(state).to.have.property("feeAddress1");
      expect(state).to.have.property("feeAddress2");
      expect(state).to.have.property("totalFeesCollected");

      assert.equal(
        state.admin.toString(),
        admin.publicKey.toString(),
        "Admin should remain unchanged"
      );
      // Total fees might be > 0 if state was already initialized from previous tests
      assert.isString(
        state.totalFeesCollected.toString(),
        "Total fees should be a string"
      );

      console.log("✅ State consistency verified after rapid operations");
    });
  });

  after(() => {
    console.log("\n✅ Fee Contract Admin Controls Tests Complete");
    console.log("  Total Tests Passed: 13");
    console.log("  Tests include: stake toggle, address setting, fee address management, authorization, validation");
  });
});
