import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";

interface PriceData {
  denom: string;
  price: number;
  decimal: number;
  timestamp: number;
  confidence: number;
  exponent: number;
}

function parsePriceFromLogs(logs: string[]): PriceData | null {
  let denom = "";
  let decimal = 0;
  let timestamp = 0;
  let price = 0;
  let confidence = 0;
  let exponent = 0;

  for (const log of logs) {
    if (log.includes("Program log: Denom:")) {
      denom = log.split("Denom: ")[1].trim();
    } else if (log.includes("Program log: Decimal:")) {
      decimal = parseInt(log.split("Decimal: ")[1].trim());
    } else if (log.includes("Program log: Publish Time:")) {
      timestamp = parseInt(log.split("Publish Time: ")[1].trim());
    } else if (log.includes("Program log: Price:")) {
      const priceMatch = log.match(/Price: (-?\d+) ± (\d+) x 10\^(-?\d+)/);
      if (priceMatch) {
        price = parseInt(priceMatch[1]);
        confidence = parseInt(priceMatch[2]);
        exponent = parseInt(priceMatch[3]);
      }
    }
  }

  if (denom && price !== 0) {
    return { denom, price, decimal, timestamp, confidence, exponent };
  }

  return null;
}

async function main() {
  console.log("\n🔍 Testing Real-Time Pyth Price Feeds on Devnet...\n");

  const provider = anchor.AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const program = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;

  let stateAccountPubkey: PublicKey;

  try {
    const configData = fs.readFileSync("scripts/.oracle-devnet-config.json", "utf-8");
    const config = JSON.parse(configData);
    stateAccountPubkey = new PublicKey(config.stateAccount);
  } catch (error) {
    console.error("❌ Error: Could not load oracle config.");
    console.error("   Please run 'npm run init_oracle_devnet' and 'npm run add_assets_devnet' first!");
    process.exit(1);
  }

  const priceFeeds = [
    {
      denom: "SOL",
      pythAccount: new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"),
      pair: "SOL/USD",
    },
    {
      denom: "ETH",
      pythAccount: new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw"),
      pair: "ETH/USD",
    },
    {
      denom: "BTC",
      pythAccount: new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J"),
      pair: "BTC/USD",
    },
  ];

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("           REAL-TIME PYTH PRICE FEEDS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for (const feed of priceFeeds) {
    try {
      console.log(`📊 Querying ${feed.pair}...`);

      const ix = await program.methods
        .getPrice({ denom: feed.denom })
        .accounts({
          state: stateAccountPubkey,
          pythPriceAccount: feed.pythAccount,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .instruction();

      const { blockhash } = await provider.connection.getLatestBlockhash();
      const tx = new anchor.web3.Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = provider.wallet.publicKey;
      tx.add(ix);

      const simulation = await provider.connection.simulateTransaction(tx);

      if (simulation.value.err) {
        console.error(`   ❌ Simulation error:`, simulation.value.err);
        if (simulation.value.logs) {
          console.error("   📋 Logs:", simulation.value.logs.join("\n   "));
        }
        console.log("");
        continue;
      }

      const logs = simulation.value.logs || [];
      const priceData = parsePriceFromLogs(logs);

      if (!priceData) {
        console.error(`   ❌ Failed to parse price data from logs`);
        console.error("   📋 Logs:", logs.join("\n   "));
        console.log("");
        continue;
      }

      const humanPrice = priceData.price * Math.pow(10, priceData.exponent);
      const humanConfidence = priceData.confidence * Math.pow(10, priceData.exponent);

      const timestamp = new Date(priceData.timestamp * 1000);
      const now = new Date();
      const ageSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

      console.log(`   ✅ Price: $${humanPrice.toFixed(2)} ± $${humanConfidence.toFixed(2)}`);
      console.log(`   📈 Raw: ${priceData.price} × 10^${priceData.exponent}`);
      console.log(`   🔒 Confidence: ${priceData.confidence}`);
      console.log(`   ⏰ Updated: ${ageSeconds}s ago`);
      console.log(`   📅 Timestamp: ${timestamp.toISOString()}`);
      console.log(`   🔢 Decimal: ${priceData.decimal}`);
      console.log("");

    } catch (error: any) {
      console.error(`   ❌ Failed to query ${feed.pair}:`, error.message || error);
      console.log("");
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Price Feed Test Complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔍 Testing get_all_prices (batch query)...\n");

  try {
    const ix = await program.methods
      .getAllPrices({})
      .accounts({
        state: stateAccountPubkey,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      } as any)
      .remainingAccounts(
        priceFeeds.map((feed) => ({
          pubkey: feed.pythAccount,
          isSigner: false,
          isWritable: false,
        }))
      )
      .instruction();

    const { blockhash } = await provider.connection.getLatestBlockhash();
    const tx = new anchor.web3.Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = provider.wallet.publicKey;
    tx.add(ix);

    const simulation = await provider.connection.simulateTransaction(tx);

    if (simulation.value.err) {
      console.error("❌ Simulation error:", simulation.value.err);
      if (simulation.value.logs) {
        console.error("   📋 Logs:", simulation.value.logs.join("\n   "));
      }
      console.log("");
      return;
    }

    const logs = simulation.value.logs || [];
    const priceMatches: { denom: string; price: string }[] = [];

    for (const log of logs) {
      const match = log.match(/- (\w+): (-?\d+) ± (\d+) x 10\^(-?\d+)/);
      if (match) {
        const denom = match[1];
        const price = parseInt(match[2]);
        const exponent = parseInt(match[4]);
        const humanPrice = price * Math.pow(10, exponent);
        priceMatches.push({ denom, price: `$${humanPrice.toFixed(2)}` });
      }
    }

    if (priceMatches.length > 0) {
      console.log(`✅ Retrieved ${priceMatches.length} prices in a single batch query:\n`);
      priceMatches.forEach(({ denom, price }) => {
        console.log(`   ${denom}: ${price}`);
      });
      console.log("");
      console.log("🎉 All Pyth integrations working correctly on devnet!");
    } else {
      console.log("⚠️  Batch query executed but no prices found in logs");
      console.log("   📋 Logs:", logs.join("\n   "));
    }

    console.log("");
    console.log("🎯 Ready for comprehensive testing:");
    console.log("   Run: npm run test-oracle-devnet");
    console.log("");

  } catch (error: any) {
    console.error("❌ Batch query failed:", error.message || error);
    console.log("");
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
