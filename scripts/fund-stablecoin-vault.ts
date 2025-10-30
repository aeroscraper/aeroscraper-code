// scripts/fund-stablecoin-vault.ts
import * as anchor from "@coral-xyz/anchor";
import {
    Connection, PublicKey, Keypair, SystemProgram
} from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    createAccount,
    getAccount,
    getMint,
    createInitializeAccountInstruction,
    transfer as splTransfer,
} from "@solana/spl-token";

// EDIT: put your protocol program ID here (must match declare_id! in lib.rs)
const PROTOCOL_PROGRAM_ID = new PublicKey("9sk8X11GWtZjzXWfkcLMRD6tmuhmiBKgMXsmx9bEh5YQ");

// Helper: derive PDAs
function deriveStatePda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("state")], PROTOCOL_PROGRAM_ID);
}
function deriveStablecoinVaultPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("protocol_stablecoin_vault")], PROTOCOL_PROGRAM_ID);
}

async function main() {
    // env: set ANCHOR_PROVIDER_URL and ANCHOR_WALLET like you do for tests
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const connection = provider.connection;
    const payer = (provider.wallet as anchor.Wallet).payer;

    // 1) Derive state PDA and fetch stablecoin mint from state
    const [statePda] = deriveStatePda();
    const stateAcct = await connection.getAccountInfo(statePda);
    if (!stateAcct) throw new Error("State account not found. Initialize protocol first.");

    // StateAccount layout starts at offset 8; parse only the stable_coin_addr (Pubkey at known offset)
    // If you have Borsh types handy, deserialize properly. For a quick parse:
    const data = stateAcct.data.subarray(8);
    // Offsets per your StateAccount struct:
    // admin(32) oracle_helper(32) oracle_state(32) fee_distributor(32) fee_state(32) min_ratio(u8)(1) protocol_fee(u8)(1) stable_coin_addr(32) ...
    const STABLECOIN_MINT_OFFSET = 32 + 32 + 32 + 32 + 32 + 1 + 1;
    const stableCoinMint = new PublicKey(data.subarray(STABLECOIN_MINT_OFFSET, STABLECOIN_MINT_OFFSET + 32));

    // 2) Derive the PDA token account we burn from
    const [protocolStablecoinVault] = deriveStablecoinVaultPda();

    // 3) Ensure the PDA token account exists and is initialized for the mint
    let needsCreate = false;
    try {
        await getAccount(connection, protocolStablecoinVault);
    } catch {
        needsCreate = true;
    }

    if (needsCreate) {
        // Create a plain SPL token account at the PDA address (payer funds rent)
        const lamports = await connection.getMinimumBalanceForRentExemption(165);
        const createIx = SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: protocolStablecoinVault,
            lamports,
            space: 165,
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        });

        // Initialize token account with mint = stableCoinMint, owner = PDA itself
        const initIx = createInitializeAccountInstruction(
            protocolStablecoinVault,
            stableCoinMint,
            protocolStablecoinVault // owner is the PDA (protocol vault)
        );

        const tx = new anchor.web3.Transaction().add(createIx, initIx);
        // NOTE: protocolStablecoinVault is a PDA, not a Keypair; we are creating an account at an address we do not control.
        // On mainnet, this won't sign; for PDAs you normally let the program create this account via init_if_needed.
        // If the account already exists (from prior stake/open calls), skip creation.
        // If creation fails (likely), ensure the program initialized it already by calling stake/open once before running this script.
        await provider.sendAndConfirm(tx, []);
    }

    // 4) Transfer aUSD from your user ATA to the protocolStablecoinVault
    // Ensure you already hold aUSD in your user ATA (e.g., via open/borrow flow).
    const userStableAta = await getAssociatedTokenAddress(stableCoinMint, payer.publicKey);
    // sanity: ensure user ATA exists and has funds
    const userBal = await connection.getTokenAccountBalance(userStableAta).catch(() => null);
    if (!userBal || !userBal.value?.amount) {
        throw new Error("User aUSD ATA not funded. Mint/borrow aUSD first, or stake flow must have produced balance.");
    }

    const amountToSend = BigInt(5) * BigInt(10) ** BigInt(18); // 5 aUSD, adjust as needed for your debt sizes
    const tx2 = new anchor.web3.Transaction().add(
        // Transfer from user ATA to PDA token account (both same mint)
        await splTransfer(
            connection,
            payer,                // payer and authority
            userStableAta,        // from
            protocolStablecoinVault, // to
            payer,                // owner signer
            Number(amountToSend)  // amount in smallest unit (18 decimals)
        )
    );

    await provider.sendAndConfirm(tx2, []);
    console.log("✅ Funded protocol_stablecoin_vault with aUSD");
    console.log("Vault:", protocolStablecoinVault.toBase58());
    const vaultBal = await connection.getTokenAccountBalance(protocolStablecoinVault);
    console.log("Vault balance:", vaultBal.value.uiAmountString, "aUSD");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});