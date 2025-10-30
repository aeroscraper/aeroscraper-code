import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccount, mintTo, transfer } from "@solana/spl-token";

async function main() {
    console.log("\n💰 Funding Collateral Tokens\n");

    // Replace with YOUR wallet public key from frontend error
    const recipientPublicKey = new PublicKey("21AJoYVPj3TZbY2De3GfTVAtecsUHQ9oLUVoQNepssN5");

    // Devnet collateral mint (from protocol-core.ts line 218)
    const collateralMint = new PublicKey("Hygyfy8RBxLvoz5b3ffsg9PAvEkT3BJXXdTpVu6ftZYz");

    const provider = anchor.AnchorProvider.env();
    const admin = provider.wallet as anchor.Wallet;
    const adminKeypair = admin.payer;

    console.log("📝 Mint:", collateralMint.toString());
    console.log("📝 Recipient:", recipientPublicKey.toString());

    // Get recipient's ATA
    const recipientATA = await getAssociatedTokenAddress(collateralMint, recipientPublicKey);
    console.log("📝 Recipient ATA:", recipientATA.toString());

    // Check if recipient token account exists
    const accountInfo = await provider.connection.getAccountInfo(recipientATA);
    if (!accountInfo) {
        console.log("Creating recipient token account...");
        await createAssociatedTokenAccount(
            provider.connection,
            adminKeypair,
            collateralMint,
            recipientPublicKey
        );
    }

    // Mint tokens to admin first
    const adminATA = await getAssociatedTokenAddress(collateralMint, admin.publicKey);
    const adminBalance = await provider.connection.getTokenAccountBalance(adminATA);

    if (!adminBalance.value.amount) {
        console.log("Minting tokens to admin...");
        await mintTo(
            provider.connection,
            adminKeypair,
            collateralMint,
            adminATA,
            adminKeypair,
            10000000000 // 10 tokens with 9 decimals
        );
    }

    // Transfer to recipient
    console.log("Transferring tokens to recipient...");
    await transfer(
        provider.connection,
        adminKeypair,
        adminATA,
        recipientATA,
        adminKeypair,
        5000000000 // 5 tokens with 9 decimals
    );

    console.log("✅ Done! Recipient now has collateral tokens");
}

main().catch(console.error);