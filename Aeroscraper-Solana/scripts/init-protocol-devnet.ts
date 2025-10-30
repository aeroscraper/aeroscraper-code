import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { AerospacerProtocol } from "../target/types/aerospacer_protocol";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { AerospacerFees } from "../target/types/aerospacer_fees";

async function main() {
  console.log("🚀 Initializing protocol state on devnet...");

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const protocolProgram = anchor.workspace.AerospacerProtocol as Program<AerospacerProtocol>;
  const oracleProgram = anchor.workspace.AerospacerOracle as Program<AerospacerOracle>;
  const feesProgram = anchor.workspace.AerospacerFees as Program<AerospacerFees>;

  const admin = provider.wallet as anchor.Wallet;
  const adminKeypair = admin.payer;

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

  console.log("Protocol State:", protocolStatePDA.toString());
  console.log("Oracle State:", oracleStatePDA.toString());
  console.log("Fees State:", feesStatePDA.toString());

  // Create a devnet stablecoin mint for the protocol (18 decimals)
  const stablecoinMint = await createMint(
    provider.connection,
    adminKeypair,
    admin.publicKey,
    null,
    18
  );

  console.log("Stablecoin Mint:", stablecoinMint.toString());

  try {
    const tx = await protocolProgram.methods
      .initialize({
        stableCoinCodeId: new anchor.BN(1),
        oracleHelperAddr: oracleProgram.programId,
        oracleStateAddr: oracleStatePDA,
        feeDistributorAddr: feesProgram.programId,
        feeStateAddr: feesStatePDA,
      })
      .accounts({
        state: protocolStatePDA,
        admin: admin.publicKey,
        stableCoinMint: stablecoinMint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([adminKeypair])
      .rpc();

    console.log("✅ Protocol initialized. Tx:", tx);
  } catch (e: any) {
    console.error("❌ Protocol initialization failed:", e);
    throw e;
  }

  const state = await protocolProgram.account.stateAccount.fetch(protocolStatePDA);
  console.log("\n📊 Protocol State Initialized:");
  console.log("- admin:", state.admin.toString());
  console.log("- stable_coin_addr:", state.stableCoinAddr.toString());
  console.log("- oracle_helper_addr:", state.oracleHelperAddr.toString());
  console.log("- oracle_state_addr:", state.oracleStateAddr.toString());
  console.log("- fee_distributor_addr:", state.feeDistributorAddr.toString());
  console.log("- fee_state_addr:", state.feeStateAddr.toString());
}

main()
  .then(() => {
    console.log("\n🎉 Protocol state initialization complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("💥 Initialization script failed:", err);
    process.exit(1);
  });


