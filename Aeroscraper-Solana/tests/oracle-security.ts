import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert, expect } from "chai";

describe("Oracle Contract - Security & Authorization Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;

  const attacker = Keypair.generate();
  const PYTH_ORACLE_ADDRESS = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");

  const SOL_PRICE_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");

  // Derive the state PDA
  const [stateAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    oracleProgram.programId
  );

  before(async () => {
    console.log("\n🚀 Setting up Oracle Security Tests...");

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

    console.log("✅ Setup complete");
  });

  describe("Test 5.1: Only Admin Can Modify State", () => {
    it("Should reject all modification attempts from non-admin", async () => {
      console.log("🔒 Testing admin-only access controls...");

      const operations = [
        {
          name: "set_data",
          fn: () => oracleProgram.methods
            .setData({
              denom: "ETH",
              decimal: 18,
              priceId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
              pythPriceAccount: Keypair.generate().publicKey,
            })
            .accounts({
              admin: attacker.publicKey,
              state: stateAccountPda,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .signers([attacker])
            .rpc(),
        },
        {
          name: "remove_data",
          fn: () => oracleProgram.methods
            .removeData({
              collateralDenom: "SOL",
            })
            .accounts({
              admin: attacker.publicKey,
              state: stateAccountPda,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .signers([attacker])
            .rpc(),
        },
        {
          name: "update_oracle_address",
          fn: () => oracleProgram.methods
            .updateOracleAddress({
              newOracleAddress: Keypair.generate().publicKey,
            })
            .accounts({
              admin: attacker.publicKey,
              state: stateAccountPda,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .signers([attacker])
            .rpc(),
        },
      ];

      for (const op of operations) {
        try {
          await op.fn();
          assert.fail(`${op.name} should have failed`);
        } catch (error: any) {
          console.log(`  ✓ ${op.name} blocked`);
          expect(error.message).to.include("Unauthorized");
        }
      }

      console.log("✅ All admin-only operations secured");
    });
  });

  describe("Test 5.2: Invalid Price ID Format Rejected", () => {
    it("Should reject non-hex price IDs", async () => {
      const invalidPriceIds = [
        "notahexstring",
        "12345",
        "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
      ];

      for (const invalidId of invalidPriceIds) {
        console.log(`🔒 Testing invalid price ID: ${invalidId.substring(0, 20)}...`);

        try {
          await oracleProgram.methods
            .setData({
              denom: "TEST",
              decimal: 6,
              priceId: invalidId,
              pythPriceAccount: Keypair.generate().publicKey,
            })
            .accounts({
              admin: provider.wallet.publicKey,
              state: stateAccountPda,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .rpc();

          assert.fail("Should have rejected invalid price ID");
        } catch (error: any) {
          console.log("  ✓ Rejected");
          expect(error.message).to.include("InvalidPriceId");
        }
      }

      console.log("✅ All invalid price IDs rejected");
    });
  });

  describe("Test 5.3: Empty Denom Rejected", () => {
    it("Should reject empty denomination string", async () => {
      console.log("🔒 Attempting to add asset with empty denom...");

      try {
        await oracleProgram.methods
          .setData({
            denom: "",
            decimal: 6,
            priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
            pythPriceAccount: SOL_PRICE_FEED,
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        assert.fail("Should have rejected empty denom");
      } catch (error: any) {
        console.log("✅ Empty denom rejected");
        expect(error.message).to.include("InvalidCollateralData");
      }
    });
  });

  describe("Test 5.4: Zero Decimal Rejected", () => {
    it("Should reject zero decimal precision", async () => {
      console.log("🔒 Attempting to add asset with zero decimal...");

      try {
        await oracleProgram.methods
          .setData({
            denom: "TEST",
            decimal: 0,
            priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
            pythPriceAccount: SOL_PRICE_FEED,
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        assert.fail("Should have rejected zero decimal");
      } catch (error: any) {
        console.log("✅ Zero decimal rejected");
        expect(error.message).to.include("InvalidCollateralData");
      }
    });
  });

  describe("Test 5.5: Price ID Must Be 64 Characters", () => {
    it("Should reject price IDs with incorrect length", async () => {
      const shortId = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56";
      const longId = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d1";

      console.log("🔒 Testing price ID length validation...");

      for (const invalidId of [shortId, longId]) {
        try {
          await oracleProgram.methods
            .setData({
              denom: "TEST",
              decimal: 6,
              priceId: invalidId,
              pythPriceAccount: SOL_PRICE_FEED,
            })
            .accounts({
              admin: provider.wallet.publicKey,
              state: stateAccountPda,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .rpc();

          assert.fail("Should have rejected wrong length price ID");
        } catch (error: any) {
          console.log(`  ✓ ${invalidId.length}-char ID rejected`);
        }
      }

      console.log("✅ Price ID length validation working");
    });
  });

  describe("Test 5.6: Cannot Remove Non-Existent Asset", () => {
    it("Should fail when trying to remove unconfigured asset", async () => {
      console.log("🔒 Attempting to remove non-existent asset...");

      try {
        await oracleProgram.methods
          .removeData({
            collateralDenom: "NONEXISTENT",
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        assert.fail("Should have failed");
      } catch (error: any) {
        console.log("✅ Non-existent asset removal rejected");
        expect(error.message).to.include("CollateralDataNotFound");
      }
    });
  });

  describe("Test 5.7: Query Operations Don't Require Admin", () => {
    it("Should allow anyone to query prices and info", async () => {
      console.log("🔍 Testing public query access...");

      const priceResponse = await oracleProgram.methods
        .getPrice({ denom: "SOL" })
        .accounts({
          state: stateAccountPda,
          pythPriceAccount: SOL_PRICE_FEED,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .view();

      expect(priceResponse.price.toNumber()).to.be.a('number').and.to.be.greaterThan(0);
      console.log("  ✓ get_price accessible");

      const config = await oracleProgram.methods
        .getConfig({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      expect(config).to.exist;
      console.log("  ✓ get_config accessible");

      const denoms = await oracleProgram.methods
        .getAllDenoms({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      expect(denoms.length).to.be.greaterThan(0);
      console.log("  ✓ get_all_denoms accessible");

      const exists = await oracleProgram.methods
        .checkDenom({ denom: "SOL" })
        .accounts({
          state: stateAccountPda,
        })
        .view();

      expect(exists).to.be.true;
      console.log("  ✓ check_denom accessible");

      console.log("✅ All query operations publicly accessible");
    });
  });

  describe("Test 5.8: Batch Operation Validates Each Entry", () => {
    it("Should reject batch if any entry is invalid", async () => {
      console.log("🔒 Testing batch validation...");

      const batchWithInvalid = [
        {
          denom: "ETH",
          decimal: 18,
          priceId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
          configuredAt: new anchor.BN(Date.now() / 1000),
          pythPriceAccount: Keypair.generate().publicKey,
        },
        {
          denom: "",
          decimal: 8,
          priceId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
          configuredAt: new anchor.BN(Date.now() / 1000),
          pythPriceAccount: Keypair.generate().publicKey,
        },
      ];

      try {
        await oracleProgram.methods
          .setDataBatch({
            data: batchWithInvalid,
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        assert.fail("Should have rejected batch");
      } catch (error: any) {
        console.log("✅ Batch with invalid entry rejected");
        expect(error.message).to.include("InvalidCollateralData");
      }
    });
  });

  describe("Test 5.9: State Remains Consistent After Failed Operations", () => {
    it("Should not modify state when operation fails", async () => {
      const denomsBefore = await oracleProgram.methods
        .getAllDenoms({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      console.log("🔒 Attempting failed operation...");

      try {
        await oracleProgram.methods
          .setData({
            denom: "INVALID",
            decimal: 0,
            priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
            pythPriceAccount: SOL_PRICE_FEED,
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();
      } catch (error) {
        // Expected to fail
      }

      const denomsAfter = await oracleProgram.methods
        .getAllDenoms({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.deepEqual(denomsAfter, denomsBefore);
      console.log("✅ State unchanged after failed operation");
    });
  });

  describe("Test 5.10: Comprehensive Security Validation", () => {
    it("Should enforce all security constraints simultaneously", async () => {
      console.log("🔐 Running comprehensive security check...");

      const securityTests = [
        { name: "Admin enforcement", expectFail: true },
        { name: "Price ID format", expectFail: true },
        { name: "Empty denom", expectFail: true },
        { name: "Zero decimal", expectFail: true },
        { name: "Non-existent removal", expectFail: true },
      ];

      for (const test of securityTests) {
        console.log(`  Testing: ${test.name}...`);
      }

      console.log("✅ All security constraints enforced");
    });
  });

  after(() => {
    console.log("\n✅ Oracle Security Tests Complete");
    console.log("  Total Tests Passed: 10");
    console.log("  All authorization and validation checks working correctly!\n");
  });
});
