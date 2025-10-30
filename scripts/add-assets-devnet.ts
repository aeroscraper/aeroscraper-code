import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";

/**
 * Add Collateral Assets to Oracle on Devnet
 * 
 * This script configures SOL, ETH, and BTC with real Pyth devnet price feeds.
 * Make sure you've run init-oracle-devnet.ts first!
 */

async function main() {
  console.log("\n🔧 Adding Collateral Assets to Oracle on Devnet...\n");

  // Configure provider for devnet
  const provider = anchor.AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const program = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;
  
  // Load state account from saved config
  let stateAccountPubkey: PublicKey;
  
  try {
    const configData = fs.readFileSync("scripts/.oracle-devnet-config.json", "utf-8");
    const config = JSON.parse(configData);
    stateAccountPubkey = new PublicKey(config.stateAccount);
    console.log("📋 Loaded state account:", stateAccountPubkey.toString());
  } catch (error) {
    console.error("❌ Error: Could not load oracle config.");
    console.error("   Please run 'npm run init_oracle_devnet' first!");
    process.exit(1);
  }

  // Pyth Devnet Price Feeds
  // Source: https://pyth.network/developers/price-feed-ids (Solana Devnet)
  const collateralAssets = [
    {
      denom: "SOL",
      decimal: 9,
      priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
      pythPriceAccount: new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"),
      description: "Solana / USD",
    },
    {
      denom: "ETH",
      decimal: 18,
      priceId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
      pythPriceAccount: new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw"),
      description: "Ethereum / USD",
    },
    {
      denom: "BTC",
      decimal: 8,
      priceId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      pythPriceAccount: new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J"),
      description: "Bitcoin / USD",
    },
  ];

  console.log(`📊 Configuring ${collateralAssets.length} assets:\n`);

  for (const asset of collateralAssets) {
    console.log(`⚡ Adding ${asset.denom} (${asset.description})...`);
    console.log(`   Decimal: ${asset.decimal}`);
    console.log(`   Price ID: ${asset.priceId}`);
    console.log(`   Pyth Account: ${asset.pythPriceAccount.toString()}`);

    try {
      const tx = await program.methods
        .setData({
          denom: asset.denom,
          decimal: asset.decimal,
          priceId: asset.priceId,
          pythPriceAccount: asset.pythPriceAccount,
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPubkey,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .rpc();

      console.log(`   ✅ ${asset.denom} configured successfully!`);
      console.log(`   TX: ${tx}`);
      console.log("");

    } catch (error) {
      console.error(`   ❌ Failed to add ${asset.denom}:`, error);
      process.exit(1);
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 All assets configured successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("🔍 Verifying configuration...\n");

  // Verify by getting all denoms
  try {
    const denoms = await program.methods
      .getAllDenoms({})
      .accounts({
        state: stateAccountPubkey,
      })
      .view();

    console.log("✅ Supported assets:", denoms.join(", "));
    console.log("");
    console.log("🎯 Next Steps:");
    console.log("  1. Test prices: npm run test_prices_devnet");
    console.log("  2. Run full tests: npm run test-oracle-devnet");
    console.log("");

  } catch (error) {
    console.error("❌ Failed to verify configuration:", error);
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
