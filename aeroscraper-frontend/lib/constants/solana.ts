import { PublicKey } from '@solana/web3.js';

// Smart Contract Addresses / Program IDs
export const PROTOCOL_PROGRAM_ID = new PublicKey("HQbV7SKnWuWPHEci5eejsnJG7qwYuQkGzJHJ6nhLZhxk");
export const ORACLE_PROGRAM_ID = new PublicKey("8Fu4YnUkfmrGQ3PTVoPfsAGjQ6NistGsiKpBEkPhzA2K");
export const FEES_PROGRAM_ID = new PublicKey("FyBGDrxVAdTnwKeXFrhQR1UyyJhqbfQmZrXWqZuhYkAj");

// Wrapped SOL (native SOL used as collateral)
export const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

// Network
export const NETWORK = "devnet";
export const RPC_ENDPOINT = "https://api.devnet.solana.com";
export const ANCHOR_PROVIDER_URL = "https://devnet.helius-rpc.com/?api-key=e153d2eb-e16c-4b9d-a369-c418cfff8e13"
export const ANCHOR_WALLET = '~/.config/solana/id.json'
export const ADMIN_ADDRESS = '5oMxbgjPWkBYRKbsh3yKrrEC5Ut8y3azHKc787YHY9Ar'

// Constants from contract
export const MIN_LOAN_AMOUNT = "1100000000000000"; // 0.0011 aUSD (accounting for 5% fee)
export const MIN_COLLATERAL_AMOUNT = 1000000; // 0.001 SOL
export const COLLATERAL_DENOM = "SOL";

// Fee addresses (from contract)
export const FEE_ADDRESS_1 = new PublicKey("8Lv4UrYHTrzvg9jPVVGNmxWyMrMvrZnCQLWucBzfJyyR");
export const FEE_ADDRESS_2 = new PublicKey("GcNwV1nA5bityjNYsWwPLHykpKuuhPzK1AQFBbrPopnX");

// Stability pool owner (TBD - fetch from protocol state)
// For now using a placeholder, should be fetched from protocol state account on init
export const STABILITY_POOL_OWNER = new PublicKey("5oMxbgjPWkBYRKbsh3yKrrEC5Ut8y3azHKc787YHY9Ar");

// Pyth Oracle
export const PYTH_ORACLE_ADDRESS = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");
// Pyth Price Feed for SOL/USD on devnet
export const SOL_PYTH_PRICE_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");

// Decimals
export const SOL_DECIMALS = 9;
export const AUSD_DECIMALS = 18;

