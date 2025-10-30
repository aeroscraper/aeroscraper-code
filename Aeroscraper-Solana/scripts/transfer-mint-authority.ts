// scripts/transfer-mint-authority.ts
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, setAuthority, AuthorityType } from "@solana/spl-token";

async function transferMintAuthority() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const protocolProgram = anchor.workspace.AerospacerProtocol;

    // Derive the PDA
    const [protocolStablecoinVaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol_stablecoin_vault")],
        protocolProgram.programId
    );

    // Get the stablecoin mint from state
    const [protocolStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        protocolProgram.programId
    );

    console.log("🚀 Transferring mint authority to PDA...");
    console.log("Protocol State:", protocolStatePDA.toString());
    console.log("Protocol Stablecoin Vault PDA:", protocolStablecoinVaultPDA.toString());

    const stateAccount = await protocolProgram.account.stateAccount.fetch(protocolStatePDA);
    const stablecoinMint = stateAccount.stableCoinAddr;

    console.log("Stablecoin Mint:", stablecoinMint.toString());

    // Transfer mint authority to PDA
    await setAuthority(
        provider.connection,
        provider.wallet.payer, // Current authority (admin)
        stablecoinMint,
        provider.wallet.payer, // Payer
        AuthorityType.MintTokens,
        protocolStablecoinVaultPDA // New authority (PDA)
    );

    console.log("✅ Mint authority transferred successfully!");
}

// Run the function
transferMintAuthority().catch(console.error);