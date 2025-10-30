import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerProtocol } from "../target/types/aerospacer_protocol";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { AerospacerFees } from "../target/types/aerospacer_fees";
import { PublicKey } from "@solana/web3.js";

async function updateProtocolAddresses() {
  console.log("🔄 Updating protocol addresses on devnet...");
  
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const protocolProgram = anchor.workspace.AerospacerProtocol as Program<AerospacerProtocol>;
  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;
  const feesProgram = anchor.workspace.AerospacerFees as Program<AerospacerFees>;

  const admin = provider.wallet as anchor.Wallet;

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
      } as any)
      .signers([admin.payer])
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
