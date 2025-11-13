import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export function decodeSecretKey(secret: string): Keypair {
  if (!secret) {
    throw new Error('Secret key is required');
  }

  try {
    const parsed = JSON.parse(secret) as number[];
    if (Array.isArray(parsed)) {
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    }
  } catch {
    // fall through to base58 decoding
  }

  const decoded = bs58.decode(secret);
  return Keypair.fromSecretKey(decoded);
}

