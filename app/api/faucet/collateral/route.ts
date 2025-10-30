import { NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, getMint, mintTo } from '@solana/spl-token';

// Environment variables (set in your deployment/runtime)
// - SOLANA_RPC: RPC endpoint (defaults to devnet)
// - FAUCET_MINT_AUTHORITY_SECRET: JSON array (Uint8Array) or base58 for mint authority secret key
// - COLLATERAL_MINT: SPL mint address to dispense

const RPC_ENDPOINT = process.env.SOLANA_RPC ?? 'https://api.devnet.solana.com';
const MINT_AUTHORITY_SECRET = process.env.FAUCET_MINT_AUTHORITY_SECRET;
const COLLATERAL_MINT = process.env.COLLATERAL_MINT ?? 'Hygyfy8RBxLvoz5b3ffsg9PAvEkT3BJXXdTpVu6ftZYz';

function decodeSecretKey(secret: string): Keypair {
  try {
    // Try JSON array
    const arr = JSON.parse(secret) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch {
    // Fallback: base58 (lazy import to avoid tree-shaking issues)
    const bs58 = require('bs58');
    const decoded = bs58.decode(secret);
    return Keypair.fromSecretKey(decoded);
  }
}

export async function POST(req: Request) {
  try {
    if (!MINT_AUTHORITY_SECRET || !COLLATERAL_MINT) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing FAUCET_MINT_AUTHORITY_SECRET or COLLATERAL_MINT' },
        { status: 500 }
      );
    }

    const { recipient } = await req.json();
    if (!recipient) {
      return NextResponse.json({ error: 'Missing recipient' }, { status: 400 });
    }

    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const admin = decodeSecretKey(MINT_AUTHORITY_SECRET);
    const mintPk = new PublicKey(COLLATERAL_MINT);
    const recipientPk = new PublicKey(recipient);

    // Devnet SOL airdrop if recipient's balance is low (to cover tx fees)
    try {
      const SOL_MIN_THRESHOLD_LAMPORTS = 100_000_00; // 0.1 SOL
      const SOL_TOPUP_LAMPORTS = 200_000_00; // 0.2 SOL
      const currentLamports = await connection.getBalance(recipientPk, 'confirmed');
      if (currentLamports < SOL_MIN_THRESHOLD_LAMPORTS) {
        // Only works on devnet/testnet RPCs
        const sig = await connection.requestAirdrop(recipientPk, SOL_TOPUP_LAMPORTS);
        await connection.confirmTransaction(sig, 'confirmed');
      }
    } catch (airdropErr) {
      // Non-fatal: proceed with SPL mint even if airdrop fails
      console.warn('SOL airdrop skipped/failed:', (airdropErr as any)?.message || airdropErr);
    }

    // Ensure recipient ATA exists
    const ata = await getOrCreateAssociatedTokenAccount(connection, admin, mintPk, recipientPk);

    // Read mint decimals
    const mintInfo = await getMint(connection, mintPk);
    const decimals = mintInfo.decimals;
    const factor = BigInt(Math.pow(10, decimals));

    // Policy: top-up only if below threshold; cap per request; aim for target
    const TARGET_BALANCE = BigInt(5) * factor;     // target balance after top-up (e.g., 5 tokens)
    const MIN_THRESHOLD = BigInt(1) * factor;      // only top-up if current < 1 token
    const PER_REQUEST_CAP = BigInt(1) * factor;    // do not mint more than 1 token per request

    // Current balance (base units string -> bigint)
    const balanceInfo = await connection.getTokenAccountBalance(ata.address);
    const current = BigInt(balanceInfo.value.amount);

    if (current >= MIN_THRESHOLD) {
      return NextResponse.json({ ok: true, minted: 0, reason: 'Balance above threshold', current: current.toString() });
    }

    const deficit = TARGET_BALANCE > current ? TARGET_BALANCE - current : BigInt(0);
    const toMint = deficit > PER_REQUEST_CAP ? PER_REQUEST_CAP : deficit;

    if (toMint <= BigInt(0)) {
      return NextResponse.json({ ok: true, minted: 0, reason: 'No deficit', current: current.toString() });
    }

    await mintTo(connection, admin, mintPk, ata.address, admin, Number(toMint));

    return NextResponse.json({ ok: true, minted: Number(toMint), currentBefore: current.toString(), target: TARGET_BALANCE.toString(), ata: ata.address.toBase58() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'mint failed' }, { status: 500 });
  }
}


