const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");

async function addSolPrice() {
  console.log("🔧 Adding SOL price data to oracle...");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const oracleProgram = anchor.workspace.AerospacerOracle;
  const admin = provider.wallet;

  // Use the correct oracle state account from our protocol state
  const [oracleStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    oracleProgram.programId
  );

  console.log("Oracle State PDA:", oracleStatePDA.toString());

  // SOL price data - using correct addresses from oracle test files
  const SOL_DENOM = "SOL";
  const SOL_DECIMALS = 9;
  const SOL_PRICE_ID = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
  // Use the correct Pyth price feed address from oracle tests (this works on devnet)
  const PYTH_ORACLE_ADDRESS = "gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s"; // "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix";

  try {
    // Add SOL price data
    const tx = await oracleProgram.methods
      .setData({
        denom: SOL_DENOM,
        decimal: SOL_DECIMALS,
        priceId: SOL_PRICE_ID,
        pythPriceAccount: new PublicKey(PYTH_ORACLE_ADDRESS),
      })
      .accounts({
        state: oracleStatePDA,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin.payer])
      .rpc();

    console.log("✅ SOL price data added successfully!");
    console.log("Transaction signature:", tx);

    // Verify the data was added
    try {
      const state = await oracleProgram.account.stateAccount.fetch(oracleStatePDA);
      console.log("\n📊 Oracle State:");
      console.log("- Admin:", state.admin.toString());
      console.log("- Collateral Data Count:", state.collateralData.length);

      if (state.collateralData.length > 0) {
        console.log("- First Collateral Data:");
        console.log("  - Denom:", state.collateralData[0].denom);
        console.log("  - Decimal:", state.collateralData[0].decimal.toString());
        console.log("  - Price ID:", state.collateralData[0].priceId);
      }
    } catch (error) {
      console.log("⚠️  Could not verify state (account type may be different)");
      console.log("   But the transaction succeeded, so SOL price data should be added");
    }

  } catch (error) {
    console.error("❌ Error adding SOL price data:", error);
    throw error;
  }
}

// Run the script
addSolPrice()
  .then(() => {
    console.log("\n🎉 SOL price data addition completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Failed to add SOL price data:", error);
    process.exit(1);
  });
