import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";

async function main() {
  console.log("🔧 Fixing Price IDs for Pyth Integration...\n");

  // Set up provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;

  // Load state account from config
  const fs = require('fs');
  const configPath = './scripts/.oracle-devnet-config.json';
  
  if (!fs.existsSync(configPath)) {
    console.error("❌ Oracle config not found. Please run init-oracle-devnet.ts first.");
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const stateAccountPubkey = new PublicKey(config.stateAccount);

  // Get the state account data
  const stateAccount = await program.account.oracleStateAccount.fetch(stateAccountPubkey);
  
  console.log("📊 Current Configuration:");
  console.log(`  State Account: ${stateAccountPubkey.toString()}`);
  console.log(`  Admin: ${stateAccount.admin.toString()}\n`);

  // The correct approach is to use the Pyth account addresses as the price IDs
  // Since we can't directly derive the price ID from the account address,
  // we need to use a different approach
  
  console.log("🔍 Current Price IDs vs Pyth Accounts:");
  for (const asset of stateAccount.collateralData) {
    console.log(`  ${asset.denom}:`);
    console.log(`    Price ID: ${asset.priceId}`);
    console.log(`    Pyth Account: ${asset.pythPriceAccount.toString()}`);
  }

  console.log("\n💡 Solution: We need to use the Pyth account addresses directly");
  console.log("   instead of trying to derive them from price IDs.");
  console.log("   The price ID validation in the oracle contract needs to be updated.");

  console.log("\n✨ Analysis complete!");
}

main().catch(console.error);
