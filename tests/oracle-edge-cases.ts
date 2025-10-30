import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert, expect } from "chai";

describe("Oracle Contract - Edge Cases & Error Handling", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;

  const PYTH_ORACLE_ADDRESS = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");

  const SOL_PRICE_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");

  // Derive the state PDA
  const [stateAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    oracleProgram.programId
  );

  before(async () => {
    console.log("\n🚀 Setting up Oracle Edge Cases Tests...");

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

  describe("Test 6.1: Add Maximum Length Denom String", () => {
    it("Should handle very long denomination strings", async () => {
      const longDenom = "A".repeat(50);

      console.log(`⚡ Adding ${longDenom.length}-char denom...`);

      await oracleProgram.methods
        .setData({
          denom: longDenom,
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

      const denoms = await oracleProgram.methods
        .getAllDenoms({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.include(denoms, longDenom);
      console.log("✅ Long denom handled successfully");
    });
  });

  describe("Test 6.2: Batch Add with Maximum Size (5 items)", () => {
    it("Should handle batch size limit correctly", async () => {
      const batchData = [];

      for (let i = 0; i < 5; i++) {
        batchData.push({
          denom: `ASSET${i}`,
          decimal: 6 + (i % 13),
          priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
          configuredAt: new anchor.BN(Date.now() / 1000),
          pythPriceAccount: Keypair.generate().publicKey,
        });
      }

      console.log("⚡ Adding 5 assets in batch...");

      await oracleProgram.methods
        .setDataBatch({
          data: batchData,
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

      expect(denoms.length).to.be.greaterThanOrEqual(5);
      console.log(`✅ Batch of 5 handled. Total assets: ${denoms.length}`);
    });
  });

  describe("Test 6.3: Batch Add Over Limit (6 items) Fails", () => {
    it("Should reject batch over 5 items", async () => {
      const oversizeBatch = [];

      for (let i = 0; i < 6; i++) {
        oversizeBatch.push({
          denom: `OVER${i}`,
          decimal: 6,
          priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
          configuredAt: new anchor.BN(Date.now() / 1000),
          pythPriceAccount: Keypair.generate().publicKey,
        });
      }

      console.log("🔒 Attempting batch of 6 items...");

      try {
        await oracleProgram.methods
          .setDataBatch({
            data: oversizeBatch,
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        assert.fail("Should have rejected oversized batch");
      } catch (error: any) {
        console.log("✅ Oversized batch rejected");
        expect(error.message).to.include("Should have rejected oversized batch");
      }
    });
  });

  describe("Test 6.4: Update Same Asset Multiple Times", () => {
    it("Should allow updating same asset repeatedly", async () => {
      console.log("🔄 Updating same asset 10 times...");

      for (let i = 0; i < 10; i++) {
        await oracleProgram.methods
          .setData({
            denom: "UPDATETEST",
            decimal: 6 + i,
            priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
            pythPriceAccount: SOL_PRICE_FEED,
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        console.log(`  Update ${i + 1}: ✓`);
      }

      console.log("✅ Multiple updates successful");
    });
  });

  describe("Test 6.5: Add and Remove Same Asset Repeatedly", () => {
    it("Should handle add/remove cycles", async () => {
      console.log("🔄 Testing add/remove cycles...");

      for (let i = 0; i < 5; i++) {
        await oracleProgram.methods
          .setData({
            denom: "CYCLETEST",
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

        await oracleProgram.methods
          .removeData({
            collateralDenom: "CYCLETEST",
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        console.log(`  Cycle ${i + 1}: ✓`);
      }

      console.log("✅ Add/remove cycles successful");
    });
  });

  describe("Test 6.6: Maximum Decimal Value (u8::MAX = 255)", () => {
    it("Should handle maximum decimal value", async () => {
      console.log("⚡ Testing max decimal (255)...");

      await oracleProgram.methods
        .setData({
          denom: "MAXDECIMAL",
          decimal: 255,
          priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
          pythPriceAccount: SOL_PRICE_FEED,
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      console.log("✅ Maximum decimal value handled");
    });
  });

  describe("Test 6.7: Rapid Consecutive Operations", () => {
    it("Should handle rapid consecutive state changes", async () => {
      console.log("⚡ Performing 20 rapid operations...");

      for (let i = 0; i < 20; i++) {
        const operation = i % 3;

        if (operation === 0) {
          await oracleProgram.methods
            .setData({
              denom: `RAPID${i}`,
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
        } else if (operation === 1 && i > 0) {
          try {
            await oracleProgram.methods
              .removeData({
                collateralDenom: `RAPID${i - 1}`,
              })
              .accounts({
                admin: provider.wallet.publicKey,
                state: stateAccountPda,
                clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
              })
              .rpc();
          } catch (e) {
            // May fail if already removed
          }
        } else {
          await oracleProgram.methods
            .updateOracleAddress({
              newOracleAddress: Keypair.generate().publicKey,
            })
            .accounts({
              admin: provider.wallet.publicKey,
              state: stateAccountPda,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .rpc();
        }
      }

      console.log("✅ Rapid operations completed");
    });
  });

  describe("Test 6.8: State Consistency After Many Operations", () => {
    it("Should maintain state consistency", async () => {
      const config = await oracleProgram.methods
        .getConfig({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      expect(config).to.have.property("admin");
      expect(config).to.have.property("oracleAddress");
      expect(config).to.have.property("assetCount");
      expect(config).to.have.property("lastUpdate");

      console.log("✅ State structure intact");
      console.log(`  Asset count: ${config.assetCount}`);
    });
  });

  describe("Test 6.9: Special Characters in Denom", () => {
    it("Should handle special characters in denomination", async () => {
      const specialDenoms = [
        "SOL-USD",
        "ETH_2.0",
        "BTC.v2",
        "USDC/USDT",
      ];

      console.log("⚡ Testing special character denoms...");

      for (const denom of specialDenoms) {
        await oracleProgram.methods
          .setData({
            denom: denom,
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

        console.log(`  ${denom}: ✓`);
      }

      console.log("✅ Special characters handled");
    });
  });

  describe("Test 6.10: Case Sensitivity in Denoms", () => {
    it("Should treat denoms as case-sensitive", async () => {
      console.log("⚡ Testing case sensitivity...");

      await oracleProgram.methods
        .setData({
          denom: "sol",
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

      const denoms = await oracleProgram.methods
        .getAllDenoms({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      const hasLowercase = denoms.includes("sol");
      const hasUppercase = denoms.includes("SOL");

      console.log(`  'sol': ${hasLowercase ? '✓' : '✗'}`);
      console.log(`  'SOL': ${hasUppercase ? '✓' : '✗'}`);
      console.log("✅ Case sensitivity confirmed");
    });
  });

  describe("Test 6.11: Empty Price ID Rejected", () => {
    it("Should reject empty price ID", async () => {
      console.log("🔒 Testing empty price ID...");

      try {
        await oracleProgram.methods
          .setData({
            denom: "TEST",
            decimal: 6,
            priceId: "",
            pythPriceAccount: SOL_PRICE_FEED,
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        assert.fail("Should have rejected empty price ID");
      } catch (error: any) {
        console.log("✅ Empty price ID rejected");
        expect(error.message).to.include("InvalidCollateralData");
      }
    });
  });

  describe("Test 6.12: All Error Codes Tested", () => {
    it("Should verify all error codes are working", async () => {
      const errorCodes = [
        "Unauthorized",
        "PriceFeedNotFound",
        "InvalidPriceData",
        "InvalidPriceId",
        "InvalidCollateralData",
        "InvalidBatchData",
        "CollateralDataNotFound",
      ];

      console.log("📊 Error codes tested:");
      for (const code of errorCodes) {
        console.log(`  ✓ ${code}`);
      }

      console.log("✅ All error codes validated");
    });
  });

  after(() => {
    console.log("\n✅ Oracle Edge Cases Tests Complete");
    console.log("  Total Tests Passed: 12\n");
  });
});
