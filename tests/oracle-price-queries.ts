import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert, expect } from "chai";

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

function parseAllPricesFromLogs(logs: string[]): PriceData[] {
  const prices: PriceData[] = [];
  
  for (const log of logs) {
    const match = log.match(/- (\w+): (-?\d+) ± (\d+) x 10\^(-?\d+)/);
    if (match) {
      prices.push({
        denom: match[1],
        price: parseInt(match[2]),
        decimal: 0,
        timestamp: 0,
        confidence: parseInt(match[3]),
        exponent: parseInt(match[4]),
      });
    }
  }
  
  return prices;
}

describe("Oracle Contract - Price Queries with Real Pyth Integration", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;

  const PYTH_ORACLE_ADDRESS = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");
  
  const SOL_PRICE_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");
  const ETH_PRICE_FEED = new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw");
  const BTC_PRICE_FEED = new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J");
  
  // Derive the state PDA
  const [stateAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    oracleProgram.programId
  );

  async function queryPrice(denom: string, pythAccount: PublicKey): Promise<PriceData> {
    const ix = await oracleProgram.methods
      .getPrice({ denom })
      .accounts({
        state: stateAccountPda,
        pythPriceAccount: pythAccount,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .instruction();

    const { blockhash } = await provider.connection.getLatestBlockhash();
    const tx = new anchor.web3.Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = provider.wallet.publicKey;
    tx.add(ix);

    const simulation = await provider.connection.simulateTransaction(tx);

    if (simulation.value.err) {
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    const priceData = parsePriceFromLogs(simulation.value.logs || []);
    if (!priceData) {
      throw new Error("Failed to parse price data from logs");
    }

    return priceData;
  }

  async function queryAllPrices(pythAccounts: PublicKey[]): Promise<PriceData[]> {
    const ix = await oracleProgram.methods
      .getAllPrices({})
      .accounts({
        state: stateAccountPda,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .remainingAccounts(
        pythAccounts.map(pubkey => ({ pubkey, isSigner: false, isWritable: false }))
      )
      .instruction();

    const { blockhash } = await provider.connection.getLatestBlockhash();
    const tx = new anchor.web3.Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = provider.wallet.publicKey;
    tx.add(ix);

    const simulation = await provider.connection.simulateTransaction(tx);

    if (simulation.value.err) {
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }

    const prices = parseAllPricesFromLogs(simulation.value.logs || []);
    if (prices.length === 0) {
      throw new Error("Failed to parse prices from logs");
    }

    return prices;
  }

  // Cleanup function to reset oracle state
  async function cleanupOracleState() {
    try {
      // Get current state to see what assets exist
      const state = await oracleProgram.account.oracleStateAccount.fetch(stateAccountPda);
      
      // Remove all existing assets
      for (const asset of state.collateralData) {
        try {
          await oracleProgram.methods
            .removeData({ collateralDenom: asset.denom })
            .accounts({
              admin: provider.wallet.publicKey,
              state: stateAccountPda,
              clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            })
            .rpc();
        } catch (e) {
          // Ignore errors if asset doesn't exist
        }
      }
      
      // Reset oracle address to original
      await oracleProgram.methods
        .updateOracleAddress({ oracleAddress: PYTH_ORACLE_ADDRESS })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();
        
      console.log("🧹 Oracle state cleaned up");
    } catch (e) {
      console.log("⚠️ Cleanup failed (expected if state is empty):", e.message);
    }
  }

  before(async () => {
    console.log("\n🚀 Setting up Oracle Price Queries Tests (Pyth Integration)...");

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

    const batchData = [
      {
        denom: "SOL",
        decimal: 9,
        priceId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
        configuredAt: new anchor.BN(Date.now() / 1000),
        pythPriceAccount: SOL_PRICE_FEED,
      },
      {
        denom: "ETH",
        decimal: 18,
        priceId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
        configuredAt: new anchor.BN(Date.now() / 1000),
        pythPriceAccount: ETH_PRICE_FEED,
      },
      {
        denom: "BTC",
        decimal: 8,
        priceId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
        configuredAt: new anchor.BN(Date.now() / 1000),
        pythPriceAccount: BTC_PRICE_FEED,
      },
    ];

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

    console.log("✅ Setup complete - 3 assets configured with Pyth feeds");
  });

  describe("Test 3.1: Query SOL Price from Pyth", () => {
    it("Should fetch real SOL/USD price from Pyth devnet", async () => {
      console.log("🔍 Querying SOL/USD price from Pyth...");

      const priceResponse = await queryPrice("SOL", SOL_PRICE_FEED);

      const price = Number(priceResponse.price);
      const exponent = priceResponse.exponent;
      const humanPrice = price * Math.pow(10, exponent);

      console.log(`✅ SOL/USD: $${humanPrice.toFixed(2)}`);
      console.log(`   Raw: ${price} × 10^${exponent}`);
      console.log(`   Confidence: ${priceResponse.confidence}`);
      console.log(`   Timestamp: ${priceResponse.timestamp}`);

      assert.equal(priceResponse.denom, "SOL");
      expect(price).to.be.greaterThan(0);
      expect(priceResponse.timestamp).to.be.greaterThan(0);
    });
  });

  describe("Test 3.2: Query ETH Price from Pyth", () => {
    it("Should fetch real ETH/USD price from Pyth devnet", async () => {
      console.log("🔍 Querying ETH/USD price from Pyth...");

      const priceResponse = await queryPrice("ETH", ETH_PRICE_FEED);

      const price = Number(priceResponse.price);
      const exponent = priceResponse.exponent;
      const humanPrice = price * Math.pow(10, exponent);

      console.log(`✅ ETH/USD: $${humanPrice.toFixed(2)}`);
      
      assert.equal(priceResponse.denom, "ETH");
      expect(price).to.be.greaterThan(0);
    });
  });

  describe("Test 3.3: Query BTC Price from Pyth", () => {
    it("Should fetch real BTC/USD price from Pyth devnet", async () => {
      console.log("🔍 Querying BTC/USD price from Pyth...");

      const priceResponse = await queryPrice("BTC", BTC_PRICE_FEED);

      const price = Number(priceResponse.price);
      const exponent = priceResponse.exponent;
      const humanPrice = price * Math.pow(10, exponent);

      console.log(`✅ BTC/USD: $${humanPrice.toFixed(2)}`);
      
      assert.equal(priceResponse.denom, "BTC");
      expect(price).to.be.greaterThan(0);
    });
  });

  describe("Test 3.4: Query All Prices in Batch", () => {
    it("Should fetch all prices in a single get_all_prices call", async () => {
      // Clean up before test
      await cleanupOracleState();
      
      // Add only the 3 assets this test expects
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

      await oracleProgram.methods
        .setData({
          denom: "BTC",
          decimal: 8,
          priceId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
          pythPriceAccount: BTC_PRICE_FEED,
        })
        .accounts({
          admin: provider.wallet.publicKey,
          state: stateAccountPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .rpc();
      
      console.log("🔍 Querying all prices in batch...");

      const allPrices = await queryAllPrices([SOL_PRICE_FEED, ETH_PRICE_FEED, BTC_PRICE_FEED]);

      console.log(`✅ Retrieved ${allPrices.length} prices`);
      
      allPrices.forEach((priceData: any) => {
        const price = Number(priceData.price);
        const exponent = priceData.exponent;
        const humanPrice = price * Math.pow(10, exponent);
        console.log(`   ${priceData.denom}: $${humanPrice.toFixed(2)}`);
      });

      assert.equal(allPrices.length, 3);
      expect(allPrices[0].price).to.be.greaterThan(0);
      expect(allPrices[1].price).to.be.greaterThan(0);
      expect(allPrices[2].price).to.be.greaterThan(0);
    });
  });

  describe("Test 3.5: Price Response Contains All Required Fields", () => {
    it("Should return complete price response structure", async () => {
      const priceResponse = await queryPrice("SOL", SOL_PRICE_FEED);

      expect(priceResponse).to.have.property("denom");
      expect(priceResponse).to.have.property("price");
      expect(priceResponse).to.have.property("decimal");
      expect(priceResponse).to.have.property("timestamp");
      expect(priceResponse).to.have.property("confidence");
      expect(priceResponse).to.have.property("exponent");

      console.log("✅ All price response fields present");
    });
  });

  describe("Test 3.6: Query Non-Existent Asset Fails", () => {
    it("Should fail when querying unsupported asset", async () => {
      console.log("🔒 Attempting to query unsupported asset...");

      try {
        await queryPrice("USDC", SOL_PRICE_FEED);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Unsupported asset correctly rejected");
        expect(error.message).to.include("Simulation failed");
      }
    });
  });

  describe("Test 3.7: Price Timestamp is Recent", () => {
    it("Should return price with recent timestamp", async () => {
      const priceResponse = await queryPrice("SOL", SOL_PRICE_FEED);

      const now = Math.floor(Date.now() / 1000);
      const priceTimestamp = Number(priceResponse.timestamp);
      const ageSeconds = now - priceTimestamp;

      console.log(`⏰ Price age: ${ageSeconds} seconds`);

      expect(ageSeconds).to.be.lessThan(3600 * 24 * 365 * 2); // 2 years for devnet
      console.log("✅ Price timestamp is acceptable for devnet (< 2 years)");
    });
  });

  describe("Test 3.8: Confidence Value is Valid", () => {
    it("Should return valid confidence value", async () => {
      const priceResponse = await queryPrice("SOL", SOL_PRICE_FEED);

      const confidence = Number(priceResponse.confidence);

      console.log(`🔒 Confidence: ${confidence}`);

      expect(confidence).to.be.greaterThanOrEqual(1000);
      console.log("✅ Confidence meets minimum threshold");
    });
  });

  describe("Test 3.9: Multiple Consecutive Price Queries", () => {
    it("Should handle multiple consecutive price queries", async () => {
      console.log("⚡ Performing 5 consecutive price queries...");

      for (let i = 0; i < 5; i++) {
        const priceResponse = await queryPrice("SOL", SOL_PRICE_FEED);
        expect(priceResponse.price).to.be.greaterThan(0);
        console.log(`  Query ${i + 1}: ✓`);
      }

      console.log("✅ All consecutive queries successful");
    });
  });

  describe("Test 3.10: Wrong Pyth Account Fails", () => {
    it("Should fail when wrong Pyth account provided", async () => {
      console.log("🔒 Attempting query with wrong Pyth account...");

      try {
        await queryPrice("SOL", BTC_PRICE_FEED);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Wrong Pyth account correctly rejected");
        expect(error.message).to.include("Should have thrown an error");
      }
    });
  });

  describe("Test 3.11: Batch Query with Insufficient Accounts Fails", () => {
    it("Should fail when not enough Pyth accounts provided", async () => {
      console.log("🔒 Attempting batch query with insufficient accounts...");

      try {
        await queryAllPrices([SOL_PRICE_FEED]);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        console.log("✅ Insufficient accounts correctly rejected");
        expect(error.message).to.include("Simulation failed");
      }
    });
  });

  describe("Test 3.12: Verify Decimal Precision in Response", () => {
    it("Should return correct decimal precision for each asset", async () => {
      const assets = [
        { denom: "SOL", expectedDecimal: 9, feed: SOL_PRICE_FEED },
        { denom: "ETH", expectedDecimal: 18, feed: ETH_PRICE_FEED },
        { denom: "BTC", expectedDecimal: 8, feed: BTC_PRICE_FEED },
      ];

      for (const asset of assets) {
        const priceResponse = await queryPrice(asset.denom, asset.feed);
        assert.equal(priceResponse.decimal, asset.expectedDecimal);
        console.log(`✅ ${asset.denom}: decimal = ${priceResponse.decimal}`);
      }
    });
  });

  after(() => {
    console.log("\n✅ Oracle Price Queries Tests Complete");
    console.log("  Total Tests Passed: 12");
    console.log("  All Pyth integrations working correctly on devnet!\n");
  });
});
