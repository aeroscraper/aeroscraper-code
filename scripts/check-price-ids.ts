import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";

async function main() {
  console.log("🔍 Checking Price IDs and Pyth Account Addresses...\n");

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
  
  console.log("📊 Price ID Analysis:");
  console.log("===================\n");

  for (const asset of stateAccount.collateralData) {
    console.log(`🔍 Asset: ${asset.denom}`);
    console.log(`  Price ID: ${asset.priceId}`);
    console.log(`  Pyth Account: ${asset.pythPriceAccount.toString()}`);
    
    // Convert price ID to bytes
    const priceIdBytes = Buffer.from(asset.priceId, 'hex');
    console.log(`  Price ID Length: ${priceIdBytes.length} bytes`);
    
    if (priceIdBytes.length === 32) {
      const derivedAddress = new PublicKey(priceIdBytes);
      console.log(`  Derived Address: ${derivedAddress.toString()}`);
      console.log(`  Match: ${derivedAddress.equals(asset.pythPriceAccount) ? '✅' : '❌'}`);
    } else {
      console.log(`  ❌ Invalid price ID length`);
    }
    console.log("");
  }

  console.log("✨ Analysis complete!");
}

main().catch(console.error);
