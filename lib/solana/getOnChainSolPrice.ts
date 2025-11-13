import {
    Connection,
    PublicKey,
    SYSVAR_CLOCK_PUBKEY,
    Transaction,
    TransactionInstruction,
    Signer,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import {
    ANCHOR_PROVIDER_URL,
    ORACLE_PROGRAM_ID,
    SOL_PYTH_PRICE_FEED,
} from '@/lib/constants/solana';
import { decodeSecretKey } from '@/lib/solana/secretKeys';

const GET_PRICE_DISCRIMINATOR = new Uint8Array([
    238, 38, 193, 106, 228, 32, 210, 33,
]);
const textEncoder = new TextEncoder();

const CACHE_TTL_MS = 15_000;
let cachedPrice: { value: number; expiresAt: number } | null = null;
let cachedPayer: Signer | null = null;

/**
 * Fetch the SOL/USD price from the on-chain oracle by simulating the `get_price` instruction.
 * Falls back to throwing if the simulation or decoding fails.
 */
export async function getOnChainSolPrice(): Promise<number> {
    const now = Date.now();
    if (cachedPrice && cachedPrice.expiresAt > now) {
        return cachedPrice.value;
    }

    const connection = new Connection(ANCHOR_PROVIDER_URL, 'confirmed');
    const [statePda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode('state')],
        ORACLE_PROGRAM_ID,
    );

    const paramsBuffer = encodeGetPriceParams('SOL');

    const instructionDataBytes = concatUint8Arrays(
        GET_PRICE_DISCRIMINATOR,
        paramsBuffer,
    );
    const instructionData = Buffer.from(instructionDataBytes);

    const instruction = new TransactionInstruction({
        programId: ORACLE_PROGRAM_ID,
        keys: [
            { pubkey: statePda, isSigner: false, isWritable: false },
            { pubkey: SOL_PYTH_PRICE_FEED, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: instructionData,
    });

    const payer = getFaucetAuthority();
    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

    const transaction = new Transaction({
        feePayer: payer.publicKey,
        blockhash,
        lastValidBlockHeight,
    }).add(instruction);

    transaction.sign(payer);

    const simulation = await connection.simulateTransaction(transaction, [payer]);

    if (simulation.value.err) {
        throw new Error(
            `Oracle price simulation failed: ${JSON.stringify(simulation.value.err)}`,
        );
    }

    const returnData = simulation.value.returnData;
    if (!returnData) {
        throw new Error('Oracle price simulation returned no data');
    }

    const [base64Data] = returnData.data;
    const decodeBuffer = Buffer.from(base64Data, 'base64');
    const dataBuffer = new Uint8Array(
        decodeBuffer.buffer,
        decodeBuffer.byteOffset,
        decodeBuffer.byteLength,
    );
    const price = decodePriceResponse(dataBuffer);

    cachedPrice = {
        value: price,
        expiresAt: now + CACHE_TTL_MS,
    };

    return price;
}

function decodePriceResponse(buffer: Uint8Array): number {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let offset = 0;

    const denomLength = view.getUint32(offset, true);
    offset += 4;
    offset += denomLength;

    const priceRaw = Number(view.getBigInt64(offset, true));
    offset += 8;

    const decimal = view.getUint8(offset);
    offset += 1;

    offset += 8; // timestamp (i64)
    offset += 8; // confidence (u64)

    const exponent = view.getInt32(offset, true);

    const usdPrice = priceRaw * Math.pow(10, exponent);

    if (!Number.isFinite(usdPrice)) {
        throw new Error(
            `Decoded oracle price is not finite (price=${priceRaw}, decimal=${decimal}, exponent=${exponent})`,
        );
    }

    return usdPrice;
}

function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(a.length + b.length);
    result.set(a, 0);
    result.set(b, a.length);
    return result;
}

function encodeGetPriceParams(denom: string): Uint8Array {
    const denomBytes = textEncoder.encode(denom);
    const buffer = new Uint8Array(4 + denomBytes.length);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, denomBytes.length, true);
    buffer.set(denomBytes, 4);
    return buffer;
}

function getFaucetAuthority(): Signer {
    if (cachedPayer) {
        return cachedPayer;
    }

    const secret =
        process.env.NEXT_PUBLIC_FAUCET_MINT_AUTHORITY_SECRET ??
        process.env.FAUCET_MINT_AUTHORITY_SECRET ??
        '';

    if (!secret) {
        throw new Error(
            'Oracle price fetch requires NEXT_PUBLIC_FAUCET_MINT_AUTHORITY_SECRET (or FAUCET_MINT_AUTHORITY_SECRET) to be set',
        );
    }

    cachedPayer = decodeSecretKey(secret);
    return cachedPayer;
}

