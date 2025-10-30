const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");

async function updateProtocolAddresses() {
  console.log("🔄 Updating protocol addresses on devnet...");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Use fresh program IDs (ensure these match Anchor.toml and deployed programs)
  const PROTOCOL_PROGRAM_ID = new PublicKey("9sk8X11GWtZjzXWfkcLMRD6tmuhmiBKgMXsmx9bEh5YQ");
  const ORACLE_PROGRAM_ID = new PublicKey("8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M");
  const FEES_PROGRAM_ID = new PublicKey("AHmGKukQky3mDHLmFyJYcEaFub69vp2QqeSW7EbVpJjZ");

  // Load IDLs (prefer fetching from chain; fallback to local target/idl)
  const path = require("path");
  const fs = require("fs");
  const protocolIdl = (await anchor.Program.fetchIdl(PROTOCOL_PROGRAM_ID, provider))
    || (fs.existsSync(path.join(__dirname, "../target/idl/aerospacer_protocol.json"))
      ? require("../target/idl/aerospacer_protocol.json")
      : (anchor.workspace.AerospacerProtocol && anchor.workspace.AerospacerProtocol.idl));
  const oracleIdl = (await anchor.Program.fetchIdl(ORACLE_PROGRAM_ID, provider))
    || (fs.existsSync(path.join(__dirname, "../target/idl/aerospacer_oracle.json"))
      ? require("../target/idl/aerospacer_oracle.json")
      : (anchor.workspace.AerospacerOracle && anchor.workspace.AerospacerOracle.idl));
  const feesIdl = (await anchor.Program.fetchIdl(FEES_PROGRAM_ID, provider))
    || (fs.existsSync(path.join(__dirname, "../target/idl/aerospacer_fees.json"))
      ? require("../target/idl/aerospacer_fees.json")
      : (anchor.workspace.AerospacerFees && anchor.workspace.AerospacerFees.idl));

  if (!protocolIdl || !oracleIdl || !feesIdl) {
    throw new Error("Failed to load required IDLs for one or more programs.");
  }

  const protocolProgram = new anchor.Program(protocolIdl, PROTOCOL_PROGRAM_ID, provider);
  const oracleProgram = new anchor.Program(oracleIdl, ORACLE_PROGRAM_ID, provider);
  const feesProgram = new anchor.Program(feesIdl, FEES_PROGRAM_ID, provider);

  const admin = provider.wallet;

  // Derive PDAs
  const [protocolStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    protocolProgram.programId
  );

  const [oracleStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    oracleProgram.programId
  );

  const [feesStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_state")],
    feesProgram.programId
  );

  console.log("Protocol State PDA:", protocolStatePDA.toString());
  console.log("Oracle State PDA:", oracleStatePDA.toString());
  console.log("Fees State PDA:", feesStatePDA.toString());
  console.log("Protocol Program ID:", protocolProgram.programId.toString());
  console.log("Oracle Program ID:", oracleProgram.programId.toString());
  console.log("Fees Program ID:", feesProgram.programId.toString());

  try {
    // Update protocol addresses
    const tx = await protocolProgram.methods
      .updateProtocolAddresses({
        oracleHelperAddr: oracleProgram.programId,
        oracleStateAddr: oracleStatePDA,
        feeDistributorAddr: feesProgram.programId,
        feeStateAddr: feesStatePDA,
      })
      .accounts({
        admin: admin.publicKey,
        state: protocolStatePDA,
      })
      .rpc();

    console.log("✅ Protocol addresses updated successfully!");
    console.log("Transaction signature:", tx);

    // Verify the update
    const updatedState = await protocolProgram.account.stateAccount.fetch(protocolStatePDA);
    console.log("\n📊 Updated Protocol State:");
    console.log("- Oracle Helper:", updatedState.oracleHelperAddr.toString());
    console.log("- Oracle State:", updatedState.oracleStateAddr.toString());
    console.log("- Fee Distributor:", updatedState.feeDistributorAddr.toString());
    console.log("- Fee State:", updatedState.feeStateAddr.toString());

  } catch (error) {
    console.error("❌ Error updating protocol addresses:", error);
    throw error;
  }
}

// Run the update
updateProtocolAddresses()
  .then(() => {
    console.log("\n🎉 Protocol address update completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Failed to update protocol addresses:", error);
    process.exit(1);
  });
