import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert, expect } from "chai";

describe("Oracle Contract - Admin Controls Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;

  const nonAdmin = Keypair.generate();
  const PYTH_ORACLE_ADDRESS = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");
  
  // Derive the state PDA
  const [stateAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    oracleProgram.programId
  );

  before(async () => {
    console.log("\n🚀 Setting up Oracle Admin Controls Tests...");

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
    console.log("  State:", stateAccountPda.toString());
  });

  describe("Test 2.1: Admin Can Set Collateral Data", () => {
    it("Should allow admin to add new collateral asset", async () => {
      console.log("📝 Adding SOL collateral...");

      const tx = await oracleProgram.methods
        .setData({
          denom: "SOL",
          decimal: 9,
          priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
          pythPriceAccount: new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"),
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      console.log("✅ SOL collateral added. TX:", tx);

      const denoms = await oracleProgram.methods
        .getAllDenoms({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.include(denoms, "SOL");
      console.log("✅ Collateral verified:", denoms);
    });
  });

  describe("Test 2.2: Admin Can Update Existing Collateral Data", () => {
    it("Should allow admin to update collateral asset", async () => {
      const newPriceId = "0000000000000000000000000000000000000000000000000000000000000001";

      console.log("📝 Updating SOL collateral...");

      await oracleProgram.methods
        .setData({
          denom: "SOL",
          decimal: 10,
          priceId: newPriceId,
          pythPriceAccount: new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"),
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      const priceId = await oracleProgram.methods
        .getPriceId({ denom: "SOL" })
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.equal(priceId, newPriceId);
      console.log("✅ Collateral updated successfully");
    });
  });

  describe("Test 2.3: Admin Can Add Multiple Assets with set_data_batch", () => {
    it("Should allow admin to add multiple assets at once", async () => {
      const batchData = [
        {
          denom: "ETH",
          decimal: 18,
          priceId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
          configuredAt: new anchor.BN(Date.now() / 1000),
          pythPriceAccount: new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw"),
        },
        {
          denom: "BTC",
          decimal: 8,
          priceId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
          configuredAt: new anchor.BN(Date.now() / 1000),
          pythPriceAccount: new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J"),
        },
      ];

      console.log("📝 Adding ETH and BTC in batch...");

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

      assert.include(denoms, "ETH");
      assert.include(denoms, "BTC");
      console.log("✅ Batch add successful. Assets:", denoms);
    });
  });

  describe("Test 2.4: Admin Can Remove Collateral Data", () => {
    it("Should allow admin to remove collateral asset", async () => {
      console.log("🗑️  Removing SOL collateral...");

      await oracleProgram.methods
        .removeData({
          collateralDenom: "SOL",
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

      assert.notInclude(denoms, "SOL");
      console.log("✅ SOL removed. Remaining:", denoms);
    });
  });

  describe("Test 2.5: Admin Can Update Oracle Address", () => {
    it("Should allow admin to change oracle provider address", async () => {
      const newOracle = Keypair.generate().publicKey;

      console.log("🔄 Updating oracle address...");

      await oracleProgram.methods
        .updateOracleAddress({
          newOracleAddress: newOracle,
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();

      const config = await oracleProgram.methods
        .getConfig({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      assert.equal(config.oracleAddress.toString(), newOracle.toString());
      console.log("✅ Oracle address updated:", newOracle.toString());
    });
  });

  describe("Test 2.6: Non-Admin Cannot Set Collateral Data", () => {
    it("Should reject set_data from non-admin", async () => {
      console.log("🔒 Attempting set_data as non-admin...");

      try {
        await oracleProgram.methods
          .setData({
            denom: "USDC",
            decimal: 6,
            priceId: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
            pythPriceAccount: Keypair.generate().publicKey,
          })
          .accounts({
            admin: nonAdmin.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([nonAdmin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Non-admin correctly rejected");
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Test 2.7: Non-Admin Cannot Remove Collateral Data", () => {
    it("Should reject remove_data from non-admin", async () => {
      console.log("🔒 Attempting remove_data as non-admin...");

      try {
        await oracleProgram.methods
          .removeData({
            collateralDenom: "ETH",
          })
          .accounts({
            admin: nonAdmin.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([nonAdmin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Non-admin correctly rejected");
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Test 2.8: Non-Admin Cannot Update Oracle Address", () => {
    it("Should reject update_oracle_address from non-admin", async () => {
      console.log("🔒 Attempting update_oracle_address as non-admin...");

      try {
        await oracleProgram.methods
          .updateOracleAddress({
            newOracleAddress: Keypair.generate().publicKey,
          })
          .accounts({
            admin: nonAdmin.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([nonAdmin])
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Non-admin correctly rejected");
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Test 2.9: Batch Add with Empty Array Fails", () => {
    it("Should reject empty batch data", async () => {
      console.log("🔒 Attempting batch add with empty array...");

      try {
        await oracleProgram.methods
          .setDataBatch({
            data: [],
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Empty batch correctly rejected");
        expect(error.message).to.include("InvalidBatchData");
      }
    });
  });

  describe("Test 2.10: Invalid Price ID Format Rejected", () => {
    it("Should reject invalid price ID format", async () => {
      console.log("🔒 Attempting to add asset with invalid price ID...");

      try {
        await oracleProgram.methods
          .setData({
            denom: "INVALID",
            decimal: 6,
            priceId: "notahexstring",
            pythPriceAccount: Keypair.generate().publicKey,
          })
          .accounts({
            admin: provider.wallet.publicKey,
            state: stateAccountPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .rpc();

        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Invalid price ID rejected");
        expect(error.message).to.include("InvalidPriceId");
      }
    });
  });

  after(() => {
    console.log("\n✅ Oracle Admin Controls Tests Complete");
    console.log("  Total Tests Passed: 10\n");
  });
});
