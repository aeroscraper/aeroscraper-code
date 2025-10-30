import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";

/**
 * Initialize Oracle Contract on Solana Devnet
 * 
 * This script initializes the Aerospacer Oracle contract on devnet with the Pyth oracle provider.
 * It will create a new state account and save the address for future use.
 */

async function main() {
  console.log("\n🚀 Initializing Aerospacer Oracle on Devnet...\n");

  // Configure provider for devnet
  const provider = anchor.AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const program = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;

  const adminKeypair = provider.wallet.payer;

  // Use PDA for oracle state (same as protocol)
  const [oracleStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );

  // Pyth oracle program address on Solana devnet
  const PYTH_ORACLE_ADDRESS = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");

  console.log("📋 Configuration:");
  console.log("  Network: Solana Devnet");
  console.log("  Oracle Program:", program.programId.toString());
  console.log("  State Account:", oracleStatePDA.toString());
  console.log("  Admin:", provider.wallet.publicKey.toString());
  console.log("  Pyth Oracle:", PYTH_ORACLE_ADDRESS.toString());
  console.log("");

  try {
    const tx = await program.methods
      .initialize({
        oracleAddress: PYTH_ORACLE_ADDRESS,
      })
      .accounts({
        state: oracleStatePDA,
        admin: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      } as any)
      .signers([adminKeypair])
      .rpc();

    console.log("✅ Oracle initialized successfully!");
    console.log("  Transaction:", tx);
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📝 IMPORTANT - Save this state account address:");
    console.log("");
    console.log("  STATE_ACCOUNT =", oracleStatePDA.toString());
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    // Save state account to file for other scripts to use
    const config = {
      stateAccount: oracleStatePDA.toString(),
      admin: provider.wallet.publicKey.toString(),
      oracleAddress: PYTH_ORACLE_ADDRESS.toString(),
      network: "devnet",
      timestamp: new Date().toISOString(),
      txSignature: tx,
    };

    fs.writeFileSync(
      "scripts/.oracle-devnet-config.json",
      JSON.stringify(config, null, 2)
    );

    console.log("💾 Configuration saved to scripts/.oracle-devnet-config.json");
    console.log("");
    console.log("🎯 Next Steps:");
    console.log("  1. Run: npm run add_assets_devnet");
    console.log("  2. Run: npm run test_prices_devnet");
    console.log("  3. Run: npm run test-oracle-devnet");
    console.log("");

  } catch (error) {
    console.error("❌ Initialization failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("✨ Done!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
