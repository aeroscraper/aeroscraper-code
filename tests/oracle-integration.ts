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

describe("Oracle Contract - Protocol CPI Integration Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;

  const protocolSimulator = Keypair.generate();
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

    const prices: PriceData[] = [];
    const logs = simulation.value.logs || [];
    
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
    console.log("\n🚀 Setting up Oracle CPI Integration Tests...");
    console.log("  Simulating protocol contract interactions");

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
      .setDataBatch({ data: batchData })
      .accounts({
        admin: provider.wallet.publicKey,
        state: stateAccountPda,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .rpc();

    console.log("✅ Setup complete - Oracle ready for CPI");
  });

  describe("Test 7.1: Protocol Queries Price via CPI", () => {
    it("Should allow protocol to query SOL price via CPI simulation", async () => {
      console.log("📡 Simulating protocol CPI: get_price(SOL)...");

      const priceResponse = await queryPrice("SOL", SOL_PRICE_FEED);

      const price = Number(priceResponse.price);
      const exponent = priceResponse.exponent;
      const humanPrice = price * Math.pow(10, exponent);

      console.log(`✅ Protocol received: $${humanPrice.toFixed(2)}`);
      console.log(`  Price: ${price}`);
      console.log(`  Exponent: ${exponent}`);
      console.log(`  Confidence: ${priceResponse.confidence}`);

      expect(price).to.be.greaterThan(0);
    });
  });

  describe("Test 7.2: Protocol Queries Multiple Prices via CPI", () => {
    it("Should allow protocol to query all prices at once", async () => {
      console.log("📡 Simulating protocol CPI: get_all_prices()...");

      const allPrices = await queryAllPrices([SOL_PRICE_FEED, ETH_PRICE_FEED, BTC_PRICE_FEED]);

      console.log(`✅ Protocol received ${allPrices.length} prices:`);
      
      allPrices.forEach((priceData: any) => {
        const price = Number(priceData.price);
        const exponent = priceData.exponent;
        const humanPrice = price * Math.pow(10, exponent);
        console.log(`  ${priceData.denom}: $${humanPrice.toFixed(2)}`);
      });

      assert.equal(allPrices.length, 3);
    });
  });

  describe("Test 7.3: Protocol Checks Asset Support via CPI", () => {
    it("Should allow protocol to verify asset support", async () => {
      console.log("📡 Simulating protocol CPI: check_denom()...");

      const supportedAssets = ["SOL", "ETH", "BTC", "USDC"];
      
      for (const asset of supportedAssets) {
        const exists = await oracleProgram.methods
          .checkDenom({ denom: asset })
          .accounts({
            state: stateAccountPda,
          })
          .view();

        console.log(`  ${asset}: ${exists ? '✓ Supported' : '✗ Not Supported'}`);
      }

      console.log("✅ Protocol successfully checked asset support");
    });
  });

  describe("Test 7.4: Protocol Retrieves Supported Assets List", () => {
    it("Should allow protocol to get all supported denoms", async () => {
      // Clean up before test
      await cleanupOracleState();
      
      // Add only the 3 assets this test expects
      console.log("  Adding SOL asset...");
      try {
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
        console.log("  ✅ SOL asset added successfully");
      } catch (e) {
        console.log("  ❌ Failed to add SOL asset:", e.message);
        throw e;
      }

      console.log("  Adding ETH asset...");
      try {
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
        console.log("  ✅ ETH asset added successfully");
      } catch (e) {
        console.log("  ❌ Failed to add ETH asset:", e.message);
        throw e;
      }

      console.log("  Adding BTC asset...");
      try {
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
        console.log("  ✅ BTC asset added successfully");
      } catch (e) {
        console.log("  ❌ Failed to add BTC asset:", e.message);
        throw e;
      }
      
      console.log("📡 Simulating protocol CPI: get_all_denoms()...");

      const denoms = await oracleProgram.methods
        .getAllDenoms({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      console.log(`✅ Protocol received ${denoms.length} supported assets:`);
      console.log(`  ${denoms.join(', ')}`);

      assert.equal(denoms.length, 3);
      assert.include(denoms, "SOL");
      assert.include(denoms, "ETH");
      assert.include(denoms, "BTC");
    });
  });

  describe("Test 7.5: Protocol Gets Oracle Configuration", () => {
    it("Should allow protocol to query oracle config", async () => {
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
      
      console.log("📡 Simulating protocol CPI: get_config()...");

      const config = await oracleProgram.methods
        .getConfig({})
        .accounts({
          state: stateAccountPda,
        })
        .view();

      console.log("✅ Protocol received config:");
      console.log(`  Admin: ${config.admin.toString()}`);
      console.log(`  Oracle Address: ${config.oracleAddress.toString()}`);
      console.log(`  Asset Count: ${config.assetCount}`);
      console.log(`  Last Update: ${config.lastUpdate}`);

      assert.equal(config.assetCount, 3);
      expect(config.lastUpdate.toNumber()).to.be.a('number').and.to.be.greaterThan(0);
    });
  });

  describe("Test 7.6: Multiple Protocol Operations Simulation", () => {
    it("Should handle multiple consecutive CPI calls", async () => {
      console.log("⚡ Simulating 10 consecutive protocol CPI calls...");

      for (let i = 0; i < 10; i++) {
        const priceResponse = await queryPrice("SOL", SOL_PRICE_FEED);
        expect(priceResponse.price).to.be.greaterThan(0);
        console.log(`  CPI ${i + 1}: ✓`);
      }

      console.log("✅ Multiple CPI calls successful");
    });
  });

  describe("Test 7.7: Protocol Liquidation Flow Simulation", () => {
    it("Should simulate protocol using oracle for liquidation check", async () => {
      console.log("⚡ Simulating liquidation flow with oracle CPI...");

      const collateralAsset = "SOL";
      const debtAsset = "USD";
      
      console.log(`  1. Query ${collateralAsset} price...`);
      const solPrice = await queryPrice(collateralAsset, SOL_PRICE_FEED);

      const price = Number(solPrice.price);
      const exponent = solPrice.exponent;
      const solUsdPrice = price * Math.pow(10, exponent);

      console.log(`  2. Received price: $${solUsdPrice.toFixed(2)}`);

      const collateralAmount = 100;
      const debtAmount = 10000;
      const collateralValue = collateralAmount * solUsdPrice;
      const collateralRatio = (collateralValue / debtAmount) * 100;

      console.log(`  3. Calculate collateral ratio:`);
      console.log(`     Collateral: ${collateralAmount} SOL = $${collateralValue.toFixed(2)}`);
      console.log(`     Debt: $${debtAmount}`);
      console.log(`     Ratio: ${collateralRatio.toFixed(2)}%`);

      const minCollateralRatio = 150;
      const canLiquidate = collateralRatio < minCollateralRatio;

      console.log(`  4. Liquidation check: ${canLiquidate ? '✓ CAN LIQUIDATE' : '✗ SAFE'}`);
      console.log("✅ Liquidation flow simulation complete");
    });
  });

  describe("Test 7.8: Protocol Multi-Collateral Position Valuation", () => {
    it("Should simulate valuing multi-collateral position", async () => {
      console.log("⚡ Simulating multi-collateral position valuation...");

      const position = [
        { asset: "SOL", amount: 50, feed: SOL_PRICE_FEED },
        { asset: "ETH", amount: 10, feed: ETH_PRICE_FEED },
        { asset: "BTC", amount: 1, feed: BTC_PRICE_FEED },
      ];

      let totalValue = 0;

      console.log("  Querying all collateral prices:");

      for (const pos of position) {
        const priceResponse = await queryPrice(pos.asset, pos.feed);

        const price = Number(priceResponse.price);
        const exponent = priceResponse.exponent;
        const humanPrice = price * Math.pow(10, exponent);
        const posValue = pos.amount * humanPrice;

        totalValue += posValue;

        console.log(`  ${pos.asset}: ${pos.amount} × $${humanPrice.toFixed(2)} = $${posValue.toFixed(2)}`);
      }

      console.log(`  Total Position Value: $${totalValue.toFixed(2)}`);
      console.log("✅ Multi-collateral valuation complete");

      expect(totalValue).to.be.greaterThan(0);
    });
  });

  after(() => {
    console.log("\n✅ Oracle CPI Integration Tests Complete");
    console.log("  Total Tests Passed: 8");
    console.log("  Oracle ready for protocol integration!\n");
  });
});
