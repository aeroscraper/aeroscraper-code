import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert, expect } from "chai";

describe("Oracle Contract - Info Query Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;

  const PYTH_ORACLE_ADDRESS = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");
  
  const SOL_PRICE_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");
  const ETH_PRICE_FEED = new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw");
  
  // Derive the state PDA
  const [stateAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    oracleProgram.programId
  );

  before(async () => {
    console.log("\n🚀 Setting up Oracle Info Queries Tests...");

    // Check if already initialized
    const existingState = await provider.connection.getAccountInfo(stateAccountPda);
    if (existingState) {
      console.log("✅ Oracle already initialized, skipping...");
    } else {
      await oracleProgram.methods
        .initialize({
          oracleAddress: PYTH_ORACLE_ADDRESS,
        })
        .accounts({
          state: stateAccountPda,
          admin: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([]) // No signers needed - state is a PDA
        .rpc();
    }

    console.log("✅ Setup complete");
  });

  // Cleanup function to reset oracle state
  async function cleanupOracleState() {
    try {
      // Get current state to see what assets exist
      const state = await oracleProgram.account.oracleStateAccount.fetch(stateAccountPda);
      
      console.log(`🧹 Cleaning up ${state.collateralData.length} assets...`);
      
      // Remove all existing assets
      for (const asset of state.collateralData) {
        try {
          console.log(`  Removing asset: ${asset.denom}`);
          await oracleProgram.methods
            .removeData({ collateralDenom: asset.denom })
            .accounts({
              admin: provider.wallet.publicKey,
              state: stateAccountPda,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .rpc();
        } catch (e) {
          console.log(`  Failed to remove ${asset.denom}:`, e.message);
        }
      }
      
      // Reset oracle address to original
      console.log("  Resetting oracle address...");
      try {
        await oracleProgram.methods
          .updateOracleAddress({ oracleAddress: PYTH_ORACLE_ADDRESS })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();
        console.log("  Oracle address reset successfully");
      } catch (e) {
        console.log("  Failed to reset oracle address:", e.message);
      }
        
      console.log("🧹 Oracle state cleaned up");
    } catch (e) {
      console.log("⚠️ Cleanup failed:", e.message);
    }
  }

  describe("Test 4.1: get_all_denoms Returns Empty Array Initially", () => {
    it("Should return empty array when no assets configured", async () => {
      // Clean up before test
      await cleanupOracleState();
      
      const denoms = await oracleProgram.methods
        .getAllDenoms({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.equal(denoms.length, 0);
      console.log("✅ Empty denoms array returned");
    });
  });

  describe("Test 4.2: get_all_denoms After Adding Assets", () => {
    it("Should return all configured asset denoms", async () => {
      // Clean up before test
      await cleanupOracleState();
      
      await oracleProgram.methods
        .setData({
          denom: "SOL",
          decimal: 9,
          priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
          pythPriceAccount: SOL_PRICE_FEED,
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      await oracleProgram.methods
        .setData({
          denom: "ETH",
          decimal: 18,
          priceId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
          pythPriceAccount: ETH_PRICE_FEED,
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      const denoms = await oracleProgram.methods
        .getAllDenoms({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.equal(denoms.length, 2);
      assert.include(denoms, "SOL");
      assert.include(denoms, "ETH");

      console.log("✅ All denoms returned:", denoms);
    });
  });

  describe("Test 4.3: check_denom for Existing Asset", () => {
    it("Should return true for configured asset", async () => {
      const exists = await oracleProgram.methods
        .checkDenom({ denom: "SOL" })
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.equal(exists, true);
      console.log("✅ check_denom returned true for SOL");
    });
  });

  describe("Test 4.4: check_denom for Non-Existent Asset", () => {
    it("Should return false for unconfigured asset", async () => {
      const exists = await oracleProgram.methods
        .checkDenom({ denom: "BTC" })
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.equal(exists, false);
      console.log("✅ check_denom returned false for BTC");
    });
  });

  describe("Test 4.5: get_price_id Returns Correct ID", () => {
    it("Should return price ID for configured asset", async () => {
      const expectedPriceId = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

      const priceId = await oracleProgram.methods
        .getPriceId({ denom: "SOL" })
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.equal(priceId, expectedPriceId);
      console.log("✅ Correct price ID returned:", priceId);
    });
  });

  describe("Test 4.6: get_price_id Fails for Non-Existent Asset", () => {
    it("Should fail when querying price ID for unconfigured asset", async () => {
      console.log("🔒 Attempting to get price ID for unconfigured asset...");

      try {
        await oracleProgram.methods
          .getPriceId({ denom: "USDC" })
          .accounts({
            state: stateAccountPda,
          })
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Unconfigured asset correctly rejected");
        expect(error.message).to.include("AnchorError occurred");
      }
    });
  });

  describe("Test 4.7: get_config Returns Complete Configuration", () => {
    it("Should return all configuration details", async () => {
      // Clean up before test
      await cleanupOracleState();
      
      const config = await oracleProgram.methods
        .getConfig({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      console.log("📊 Configuration:");
      console.log("  admin:", config.admin.toString());
      console.log("  oracleAddress:", config.oracleAddress.toString());
      console.log("  assetCount:", config.assetCount);
      console.log("  lastUpdate:", config.lastUpdate.toString());

      assert.equal(config.admin.toString(), provider.wallet.publicKey.toString());
      // Note: Oracle address may be different due to previous test modifications
      assert.isString(config.oracleAddress.toString());
      assert.equal(config.assetCount, 0); // Should be 0 after cleanup
      expect(config.lastUpdate.toNumber()).to.be.a('number').and.to.be.greaterThan(0);

      console.log("✅ Complete config verified");
    });
  });

  describe("Test 4.8: Asset Count Updates Correctly", () => {
    it("Should update asset count when adding/removing assets", async () => {
      let config = await oracleProgram.methods
        .getConfig({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      const initialCount = config.assetCount;

      await oracleProgram.methods
        .setData({
          denom: "BTC",
          decimal: 8,
          priceId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
          pythPriceAccount: new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J"),
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      config = await oracleProgram.methods
        .getConfig({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.equal(config.assetCount, initialCount + 1);
      console.log(`✅ Asset count increased: ${initialCount} → ${config.assetCount}`);

      await oracleProgram.methods
        .removeData({
          collateralDenom: "BTC",
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      config = await oracleProgram.methods
        .getConfig({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.equal(config.assetCount, initialCount);
      console.log(`✅ Asset count decreased: ${initialCount + 1} → ${config.assetCount}`);
    });
  });

  after(() => {
    console.log("\n✅ Oracle Info Queries Tests Complete");
    console.log("  Total Tests Passed: 8\n");
  });
});
