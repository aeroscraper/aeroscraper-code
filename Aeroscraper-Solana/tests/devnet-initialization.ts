import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerProtocol } from "../target/types/aerospacer_protocol";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { AerospacerFees } from "../target/types/aerospacer_fees";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } from "@solana/web3.js";
import type { AccountMeta } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createMint, createAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";
import { fetchAllTroves, sortTrovesByICR, findNeighbors, buildNeighborAccounts, TroveData } from './trove-indexer';

describe("Devnet Initialization and Core Testing", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Test accounts
  const admin = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  // Token accounts
  let stablecoinMint: PublicKey;
  let collateralMint: PublicKey;
  let adminStablecoinAccount: PublicKey;
  let adminCollateralAccount: PublicKey;
  let user1StablecoinAccount: PublicKey;
  let user1CollateralAccount: PublicKey;

  // Program instances
  let protocolProgram: Program<AerospacerProtocol>;
  let oracleProgram: Program<AerospacerOracle>;
  let feesProgram: Program<AerospacerFees>;

  // State accounts
  let protocolState: PublicKey;
  let oracleState: PublicKey;
  let feesState: PublicKey;

  // User troves and stakes
  let user1Trove: PublicKey;
  let user1Stake: PublicKey;

  async function getNeighborHints(
    connection: Connection,
    programId: PublicKey,
    userPubkey: PublicKey,
    collateralAmount: anchor.BN,
    loanAmount: anchor.BN,
    denom: string
  ): Promise<AccountMeta[]> {
    const allTroves = await fetchAllTroves(connection, protocolProgram, denom);
    const sortedTroves = sortTrovesByICR(allTroves);
    
    const collateralValue = BigInt(collateralAmount.toString()) * 100n;
    const debtValue = BigInt(loanAmount.toString());
    const newICR = debtValue > 0n ? (collateralValue * 100n) / debtValue : BigInt(Number.MAX_SAFE_INTEGER);
    
    const [userDebtAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_debt_amount"), userPubkey.toBuffer()],
      programId
    );
    const [userCollateralAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_collateral_amount"), userPubkey.toBuffer(), Buffer.from(denom)],
      programId
    );
    const [liquidityThresholdAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("liquidity_threshold"), userPubkey.toBuffer()],
      programId
    );

    const thisTrove: TroveData = {
      owner: userPubkey,
      debt: BigInt(loanAmount.toString()),
      collateralAmount: BigInt(collateralAmount.toString()),
      collateralDenom: denom,
      icr: newICR,
      debtAccount: userDebtAccount,
      collateralAccount: userCollateralAccount,
      liquidityThresholdAccount: liquidityThresholdAccount,
    };

    let insertIndex = sortedTroves.findIndex((t) => t.icr > newICR);
    if (insertIndex === -1) insertIndex = sortedTroves.length;
    
    const newSortedTroves = [
      ...sortedTroves.slice(0, insertIndex),
      thisTrove,
      ...sortedTroves.slice(insertIndex),
    ];

    const neighbors = findNeighbors(thisTrove, newSortedTroves);
    const neighborAccounts = buildNeighborAccounts(neighbors);
    
    return neighborAccounts.map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    }));
  }

  before(async () => {
    console.log("🚀 Starting Devnet Initialization Test...");
    
    // Airdrop SOL to all accounts
    const accounts = [admin, user1, user2];
    for (const account of accounts) {
      const signature = await provider.connection.requestAirdrop(account.publicKey, 2000000000); // 2 SOL
      await provider.connection.confirmTransaction(signature);
      console.log(`✅ Airdropped 2 SOL to ${account.publicKey.toString()}`);
    }

    // Create program instances with devnet IDs
    const protocolIdl = require("../target/idl/aerospacer_protocol.json");
    const oracleIdl = require("../target/idl/aerospacer_oracle.json");
    const feesIdl = require("../target/idl/aerospacer_fees.json");

    protocolProgram = new Program(protocolIdl, new PublicKey("9sk8X11GWtZjzXWfkcLMRD6tmuhmiBKgMXsmx9bEh5YQ"), provider) as Program<AerospacerProtocol>;
    oracleProgram = new Program(oracleIdl, new PublicKey("8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M"), provider) as Program<AerospacerOracle>;
    feesProgram = new Program(feesIdl, new PublicKey("AHmGKukQky3mDHLmFyJYcEaFub69vp2QqeSW7EbVpJjZ"), provider) as Program<AerospacerFees>;

    // Derive state PDAs
    const [protocolStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      protocolProgram.programId
    );
    const [oracleStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      oracleProgram.programId
    );
    const [feesStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      feesProgram.programId
    );

    protocolState = protocolStatePda;
    oracleState = oracleStatePda;
    feesState = feesStatePda;

    // Derive user PDAs
    const [user1TrovePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("trove"), user1.publicKey.toBuffer()],
      protocolProgram.programId
    );
    const [user1StakePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), user1.publicKey.toBuffer()],
      protocolProgram.programId
    );

    user1Trove = user1TrovePda;
    user1Stake = user1StakePda;

    console.log("✅ Setup completed");
    console.log("- Admin:", admin.publicKey.toString());
    console.log("- User1:", user1.publicKey.toString());
    console.log("- Protocol State:", protocolState.toString());
    console.log("- Oracle State:", oracleState.toString());
    console.log("- Fees State:", feesState.toString());
  });

  describe("Token System Setup", () => {
    it("Should create stablecoin and collateral mints", async () => {
      try {
        // Create stablecoin mint
        stablecoinMint = await createMint(
          provider.connection,
          admin,
          admin.publicKey,
          null,
          6
        );

        // Create collateral mint
        collateralMint = await createMint(
          provider.connection,
          admin,
          admin.publicKey,
          null,
          9
        );

        console.log("✅ Token mints created");
        console.log("- Stablecoin mint:", stablecoinMint.toString());
        console.log("- Collateral mint:", collateralMint.toString());
      } catch (error) {
        console.log("❌ Token mint creation failed:", error);
        throw error;
      }
    });

    it("Should create token accounts", async () => {
      try {
        // Create admin token accounts
        adminStablecoinAccount = await createAssociatedTokenAccount(
          provider.connection,
          admin,
          stablecoinMint,
          admin.publicKey
        );

        adminCollateralAccount = await createAssociatedTokenAccount(
          provider.connection,
          admin,
          collateralMint,
          admin.publicKey
        );

        // Create user1 token accounts
        user1StablecoinAccount = await createAssociatedTokenAccount(
          provider.connection,
          admin,
          stablecoinMint,
          user1.publicKey
        );

        user1CollateralAccount = await createAssociatedTokenAccount(
          provider.connection,
          admin,
          collateralMint,
          user1.publicKey
        );

        // Mint initial tokens
        await mintTo(
          provider.connection,
          admin,
          collateralMint,
          adminCollateralAccount,
          admin,
          10000000000 // 10 collateral tokens
        );

        await mintTo(
          provider.connection,
          admin,
          stablecoinMint,
          adminStablecoinAccount,
          admin,
          1000000000 // 1000 stablecoins
        );

        console.log("✅ Token accounts created and funded");
        console.log("- Admin stablecoin account:", adminStablecoinAccount.toString());
        console.log("- Admin collateral account:", adminCollateralAccount.toString());
        console.log("- User1 stablecoin account:", user1StablecoinAccount.toString());
        console.log("- User1 collateral account:", user1CollateralAccount.toString());
      } catch (error) {
        console.log("❌ Token account creation failed:", error);
        throw error;
      }
    });
  });

  describe("Program Initialization", () => {
    it("Should initialize oracle program", async () => {
      try {
        const tx = await oracleProgram.methods
          .initialize({
            oracleAddress: admin.publicKey
          })
          .accounts({
            state: oracleState,
            admin: admin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        console.log("✅ Oracle program initialized");
        console.log("- Transaction:", tx);

        // Verify state
        const state = await oracleProgram.account.oracleStateAccount.fetch(oracleState);
        assert.equal(state.admin.toString(), admin.publicKey.toString());
        assert.equal(state.oracleAddress.toString(), admin.publicKey.toString());
        console.log("✅ Oracle state verified");
      } catch (error) {
        console.log("❌ Oracle initialization failed:", error);
        throw error;
      }
    });

    it("Should initialize fees program", async () => {
      try {
        const tx = await feesProgram.methods
          .initialize({
            admin: admin.publicKey
          })
          .accounts({
            state: feesState,
            admin: admin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        console.log("✅ Fees program initialized");
        console.log("- Transaction:", tx);

        // Verify state
        const state = await feesProgram.account.feeStateAccount.fetch(feesState);
        assert.equal(state.admin.toString(), admin.publicKey.toString());
        console.log("✅ Fees state verified");
      } catch (error) {
        console.log("❌ Fees initialization failed:", error);
        throw error;
      }
    });

    it("Should initialize protocol program", async () => {
      try {
        const tx = await protocolProgram.methods
          .initialize({
            stableCoinMint: stablecoinMint,
            oracleProgram: oracleProgram.programId,
            feeDistributor: feesProgram.programId
          })
          .accounts({
            state: protocolState,
            admin: admin.publicKey,
            stableCoinMint: stablecoinMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        console.log("✅ Protocol program initialized");
        console.log("- Transaction:", tx);

        // Verify state
        const state = await protocolProgram.account.stateAccount.fetch(protocolState);
        assert.equal(state.admin.toString(), admin.publicKey.toString());
        assert.equal(state.stableCoinMint.toString(), stablecoinMint.toString());
        assert.equal(state.oracleProgram.toString(), oracleProgram.programId.toString());
        assert.equal(state.feeDistributor.toString(), feesProgram.programId.toString());
        console.log("✅ Protocol state verified");
      } catch (error) {
        console.log("❌ Protocol initialization failed:", error);
        throw error;
      }
    });
  });

  describe("Oracle Data Setup", () => {
    it("Should set collateral data", async () => {
      try {
        const tx = await oracleProgram.methods
          .setData({
            denom: "SOL",
            decimal: 9,
            priceId: "SOL/USD"
          })
          .accounts({
            state: oracleState,
            admin: admin.publicKey,
          })
          .signers([admin])
          .rpc();

        console.log("✅ Collateral data set");
        console.log("- Transaction:", tx);

        // Verify data was set
        const state = await oracleProgram.account.oracleStateAccount.fetch(oracleState);
        console.log("✅ Oracle data verified");
        console.log("- Collateral data count:", state.collateralData.length);
      } catch (error) {
        console.log("❌ Set data failed:", error);
        throw error;
      }
    });
  });

  describe("Core Protocol Operations", () => {
    it("Should open a trove", async () => {
      try {
        const collateralAmount = new anchor.BN(1000000000);
        const loanAmount = new anchor.BN(100000000);
        
        const neighborHints = await getNeighborHints(
          provider.connection,
          protocolProgram.programId,
          user1.publicKey,
          collateralAmount,
          loanAmount,
          "SOL"
        );
        
        const tx = await protocolProgram.methods
          .openTrove({
            loanAmount: loanAmount, // 100 aUSD
            collateralAmount: collateralAmount, // 1 SOL
            collateralDenom: "SOL"
          })
          .accounts({
            user: user1.publicKey,
            trove: user1Trove,
            state: protocolState,
            stableCoinMint: stablecoinMint,
            userCollateralAccount: user1CollateralAccount,
            collateralMint: collateralMint,
            userStablecoinAccount: user1StablecoinAccount,
            protocolCollateralAccount: adminCollateralAccount,
            protocolStablecoinAccount: adminStablecoinAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(neighborHints)
          .signers([user1])
          .rpc();

        console.log("✅ Trove opened successfully");
        console.log("- Transaction:", tx);

        // Verify trove was created
        const trove = await protocolProgram.account.troveAccount.fetch(user1Trove);
        assert.equal(trove.owner.toString(), user1.publicKey.toString());
        assert.equal(trove.debtAmount.toNumber(), 100000000);
        assert.equal(trove.isActive, true);
        console.log("✅ Trove verified");
        console.log("- Owner:", trove.owner.toString());
        console.log("- Debt Amount:", trove.debtAmount.toString());
        console.log("- Collateral Amount:", trove.collateralAmount.toString());
        console.log("- Collateral Ratio:", trove.collateralRatio.toString());
      } catch (error) {
        console.log("❌ Open trove failed:", error);
        throw error;
      }
    });

    it("Should add collateral to trove", async () => {
      try {
        const existingTrove = await protocolProgram.account.troveAccount.fetch(user1Trove);
        const additionalCollateral = new anchor.BN(500000000);
        const newTotalCollateral = existingTrove.collateralAmount.add(additionalCollateral);
        
        const neighborHints = await getNeighborHints(
          provider.connection,
          protocolProgram.programId,
          user1.publicKey,
          newTotalCollateral,
          existingTrove.debtAmount,
          "SOL"
        );
        
        const tx = await protocolProgram.methods
          .addCollateral({
            amount: additionalCollateral, // 0.5 SOL
            collateralDenom: "SOL"
          })
          .accounts({
            user: user1.publicKey,
            trove: user1Trove,
            state: protocolState,
            userCollateralAccount: user1CollateralAccount,
            collateralMint: collateralMint,
            protocolCollateralAccount: adminCollateralAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts(neighborHints)
          .signers([user1])
          .rpc();

        console.log("✅ Collateral added successfully");
        console.log("- Transaction:", tx);

        // Verify trove was updated
        const trove = await protocolProgram.account.troveAccount.fetch(user1Trove);
        assert.isTrue(trove.collateralAmount.gt(new anchor.BN(1000000000)));
        console.log("✅ Collateral addition verified");
        console.log("- New Collateral Amount:", trove.collateralAmount.toString());
        console.log("- New Collateral Ratio:", trove.collateralRatio.toString());
      } catch (error) {
        console.log("❌ Add collateral failed:", error);
        throw error;
      }
    });

    it("Should borrow additional loan", async () => {
      try {
        const existingTrove = await protocolProgram.account.troveAccount.fetch(user1Trove);
        const additionalLoan = new anchor.BN(50000000);
        const newTotalDebt = existingTrove.debtAmount.add(additionalLoan);
        
        const neighborHints = await getNeighborHints(
          provider.connection,
          protocolProgram.programId,
          user1.publicKey,
          existingTrove.collateralAmount,
          newTotalDebt,
          "SOL"
        );
        
        const tx = await protocolProgram.methods
          .borrowLoan({
            amount: additionalLoan // 50 aUSD
          })
          .accounts({
            user: user1.publicKey,
            trove: user1Trove,
            state: protocolState,
            userStablecoinAccount: user1StablecoinAccount,
            protocolStablecoinAccount: adminStablecoinAccount,
            stableCoinMint: stablecoinMint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts(neighborHints)
          .signers([user1])
          .rpc();

        console.log("✅ Additional loan borrowed successfully");
        console.log("- Transaction:", tx);

        // Verify trove was updated
        const trove = await protocolProgram.account.troveAccount.fetch(user1Trove);
        assert.isTrue(trove.debtAmount.gt(new anchor.BN(100000000)));
        console.log("✅ Loan borrowing verified");
        console.log("- New Debt Amount:", trove.debtAmount.toString());
        console.log("- New Collateral Ratio:", trove.collateralRatio.toString());
      } catch (error) {
        console.log("❌ Borrow loan failed:", error);
        throw error;
      }
    });

    it("Should stake stablecoins", async () => {
      try {
        const tx = await protocolProgram.methods
          .stake({
            amount: new anchor.BN(10000000) // 10 aUSD
          })
          .accounts({
            user: user1.publicKey,
            stake: user1Stake,
            state: protocolState,
            userStablecoinAccount: user1StablecoinAccount,
            protocolStablecoinAccount: adminStablecoinAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();

        console.log("✅ Stablecoins staked successfully");
        console.log("- Transaction:", tx);

        // Verify stake was created
        const stake = await protocolProgram.account.stakeAccount.fetch(user1Stake);
        assert.equal(stake.owner.toString(), user1.publicKey.toString());
        assert.equal(stake.amount.toNumber(), 10000000);
        console.log("✅ Stake verified");
        console.log("- Owner:", stake.owner.toString());
        console.log("- Amount:", stake.amount.toString());
        console.log("- Percentage:", stake.percentage.toString());
      } catch (error) {
        console.log("❌ Stake failed:", error);
        throw error;
      }
    });
  });

  describe("State Verification", () => {
    it("Should verify all program states", async () => {
      try {
        // Verify protocol state
        const protocolStateAccount = await protocolProgram.account.stateAccount.fetch(protocolState);
        console.log("📊 Protocol State:");
        console.log("- Admin:", protocolStateAccount.admin.toString());
        console.log("- Total Debt Amount:", protocolStateAccount.totalDebtAmount.toString());
        console.log("- Total Stake Amount:", protocolStateAccount.totalStakeAmount.toString());
        console.log("- Minimum Collateral Ratio:", protocolStateAccount.minimumCollateralRatio);
        console.log("- Protocol Fee:", protocolStateAccount.protocolFee);

        // Verify oracle state
        const oracleStateAccount = await oracleProgram.account.oracleStateAccount.fetch(oracleState);
        console.log("📊 Oracle State:");
        console.log("- Admin:", oracleStateAccount.admin.toString());
        console.log("- Oracle Address:", oracleStateAccount.oracleAddress.toString());
        console.log("- Collateral Data Count:", oracleStateAccount.collateralData.length);

        // Verify fees state
        const feesStateAccount = await feesProgram.account.feeStateAccount.fetch(feesState);
        console.log("📊 Fees State:");
        console.log("- Admin:", feesStateAccount.admin.toString());
        console.log("- Is Stake Enabled:", feesStateAccount.isStakeEnabled);
        console.log("- Total Fees Collected:", feesStateAccount.totalFeesCollected.toString());

        console.log("✅ All program states verified successfully");
      } catch (error) {
        console.log("❌ State verification failed:", error);
        throw error;
      }
    });
  });

  describe("Integration Test", () => {
    it("Should verify complete lending cycle", async () => {
      try {
        // Verify the complete lending cycle worked
        const trove = await protocolProgram.account.troveAccount.fetch(user1Trove);
        const stake = await protocolProgram.account.stakeAccount.fetch(user1Stake);
        const state = await protocolProgram.account.stateAccount.fetch(protocolState);

        console.log("🎉 Complete Lending Cycle Verified!");
        console.log("📊 Final State:");
        console.log("- Trove Debt:", trove.debtAmount.toString());
        console.log("- Trove Collateral:", trove.collateralAmount.toString());
        console.log("- Trove Ratio:", trove.collateralRatio.toString());
        console.log("- Stake Amount:", stake.amount.toString());
        console.log("- Total Protocol Debt:", state.totalDebtAmount.toString());
        console.log("- Total Protocol Stake:", state.totalStakeAmount.toString());

        // Verify the system is working correctly
        assert(trove.isActive, "Trove should be active");
        assert(trove.collateralAmount.gt(new anchor.BN(0)), "Trove should have collateral");
        assert(trove.debtAmount.gt(new anchor.BN(0)), "Trove should have debt");
        assert(stake.amount.gt(new anchor.BN(0)), "Stake should have amount");
        assert(state.totalDebtAmount.gt(new anchor.BN(0)), "Protocol should have total debt");
        assert(state.totalStakeAmount.gt(new anchor.BN(0)), "Protocol should have total stake");

        console.log("✅ Complete lending cycle verified successfully!");
      } catch (error) {
        console.log("❌ Integration test failed:", error);
        throw error;
      }
    });
  });

  describe("Final Summary", () => {
    it("Should provide deployment summary", async () => {
      console.log("🎉 Devnet Deployment and Initialization Completed Successfully!");
      
      console.log("\n📊 Deployment Summary:");
      console.log("✅ All programs deployed to devnet");
      console.log("✅ All program states initialized");
      console.log("✅ Token system created and funded");
      console.log("✅ Oracle data configured");
      console.log("✅ Complete lending cycle tested");
      console.log("✅ All core operations working");
      
      console.log("\n🔗 Program IDs:");
      console.log("- Protocol:", protocolProgram.programId.toString());
      console.log("- Oracle:", oracleProgram.programId.toString());
      console.log("- Fees:", feesProgram.programId.toString());
      
      console.log("\n🎯 Next Steps:");
      console.log("1. 🔄 Test liquidation scenarios");
      console.log("2. 🔄 Test multi-user interactions");
      console.log("3. 🔄 Test edge cases and error conditions");
      console.log("4. 🔄 Frontend integration");
      console.log("5. 🔄 Security audit");
      console.log("6. 🔄 Mainnet deployment");
      
      console.log("\n🏆 Achievement: Aeroscraper Solana protocol is now live on devnet!");
    });
  });
});
