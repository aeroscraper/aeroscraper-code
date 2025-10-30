import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { TroveData } from './types';
import { PROTOCOL_PROGRAM_ID } from '@/lib/constants/solana';

/**
 * Discriminator for UserDebtAmount account (8 bytes)
 */
const USER_DEBT_AMOUNT_DISCRIMINATOR = Buffer.from([102, 237, 238, 206, 72, 254, 116, 219]);

/**
 * Discriminator for LiquidityThreshold account (8 bytes)
 */
const LIQUIDITY_THRESHOLD_DISCRIMINATOR = Buffer.from([130, 0, 84, 160, 128, 62, 185, 75]);

/**
 * Discriminator for UserCollateralAmount account (8 bytes)
 */
const USER_COLLATERAL_AMOUNT_DISCRIMINATOR = Buffer.from([26, 219, 87, 11, 62, 102, 67, 77]);

// Pre-compute Base58 encoded discriminators for memcmp filters
const USER_DEBT_AMOUNT_DISCRIMINATOR_B58 = bs58.encode(Uint8Array.from(USER_DEBT_AMOUNT_DISCRIMINATOR));
const USER_COLLATERAL_AMOUNT_DISCRIMINATOR_B58 = bs58.encode(Uint8Array.from(USER_COLLATERAL_AMOUNT_DISCRIMINATOR));

/**
 * Convert Buffer to Uint8Array for type compatibility
 */
function toUint8Array(data: Buffer | Uint8Array): Uint8Array {
  return data instanceof Buffer ? new Uint8Array(data) : data;
}

/**
 * Deserialize UserDebtAmount account data
 */
function deserializeUserDebtAmount(data: Buffer | Uint8Array): { owner: PublicKey; debt: bigint } {
  const arr = toUint8Array(data);
  let offset = 8; // Skip discriminator
  const owner = new PublicKey(arr.slice(offset, offset + 32));
  offset += 32;
  const debt = BigInt(new DataView(arr.buffer, arr.byteOffset + offset, 8).getBigUint64(0, true));
  return { owner, debt };
}

/**
 * Deserialize LiquidityThreshold account data
 */
function deserializeLiquidityThreshold(data: Buffer | Uint8Array): bigint {
  const arr = toUint8Array(data);
  const offset = 8 + 32; // Skip discriminator and owner
  return BigInt(new DataView(arr.buffer, arr.byteOffset + offset, 8).getBigUint64(0, true));
}

/**
 * Deserialize UserCollateralAmount account data
 */
function deserializeUserCollateralAmount(data: Buffer | Uint8Array): { owner: PublicKey; denom: string; amount: bigint } {
  const arr = toUint8Array(data);
  let offset = 8; // Skip discriminator
  const owner = new PublicKey(arr.slice(offset, offset + 32));
  offset += 32;

  // Read denom string (4-byte length prefix + bytes)
  const denomLength = new DataView(arr.buffer, arr.byteOffset + offset, 4).getUint32(0, true);
  offset += 4;

  const denomBytes = arr.slice(offset, offset + denomLength);
  const denom = new TextDecoder().decode(denomBytes);
  offset += denomLength;

  // Read amount: u64 (8 bytes)
  const amount = BigInt(new DataView(arr.buffer, arr.byteOffset + offset, 8).getBigUint64(0, true));

  return { owner, denom, amount };
}

/**
 * Fetch all troves from the blockchain
 * 
 * Uses getProgramAccounts to fetch all UserDebtAmount accounts (one per trove)
 * Then fetches corresponding collateral and ICR data in batches
 * 
 * @param connection - Solana connection
 * @param collateralDenom - Optional filter by collateral denomination
 * @returns Array of trove data
 */
export async function fetchAllTroves(
  connection: Connection,
  collateralDenom?: string
): Promise<TroveData[]> {
  try {
    // 1. Fetch all UserDebtAmount accounts
    const programAccounts = await connection.getProgramAccounts(PROTOCOL_PROGRAM_ID, {
      filters: [
        { dataSize: 56 }, // UserDebtAmount: 8 discriminator + 32 owner + 8 amount + 8 padding
        {
          memcmp: {
            offset: 0,
            bytes: USER_DEBT_AMOUNT_DISCRIMINATOR_B58,
          },
        },
      ],
    });

    if (programAccounts.length === 0) {
      return [];
    }

    // 2. Deserialize debt accounts and filter out zero-debt troves
    const debtAccounts = new Map<string, bigint>();
    const owners: PublicKey[] = [];
    const ownerStrings = new Set<string>();

    for (const { account } of programAccounts) {
      try {
        const { owner, debt } = deserializeUserDebtAmount(account.data);
        if (debt > BigInt(0)) {
          const ownerStr = owner.toBase58();
          debtAccounts.set(ownerStr, debt);
          owners.push(owner);
          ownerStrings.add(ownerStr);
        }
      } catch (err) {
        console.error('Failed to deserialize UserDebtAmount:', err);
        continue;
      }
    }

    if (owners.length === 0) {
      return [];
    }

    // 3. Batch fetch all LiquidityThreshold accounts
    const liquidityThresholdPdas = owners.map((owner) =>
      PublicKey.findProgramAddressSync(
        [Buffer.from('liquidity_threshold'), owner.toBuffer()],
        PROTOCOL_PROGRAM_ID
      )[0]
    );

    const liquidityThresholdAccounts = await connection.getMultipleAccountsInfo(liquidityThresholdPdas);
    const icrMap = new Map<string, bigint>();

    for (let i = 0; i < owners.length; i++) {
      const accountInfo = liquidityThresholdAccounts[i];
      if (accountInfo) {
        try {
          const icr = deserializeLiquidityThreshold(accountInfo.data);
          icrMap.set(owners[i].toBase58(), icr);
        } catch (err) {
          console.error('Failed to deserialize LiquidityThreshold:', err);
        }
      }
    }

    // 4. Fetch all UserCollateralAmount accounts once
    const allCollateralAccounts = await connection.getProgramAccounts(PROTOCOL_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: USER_COLLATERAL_AMOUNT_DISCRIMINATOR_B58,
          },
        },
      ],
    });

    // 5. Group collateral accounts by owner in memory
    const collateralMap = new Map<string, Array<{ denom: string; amount: bigint }>>();

    for (const { account } of allCollateralAccounts) {
      try {
        const { owner, denom, amount } = deserializeUserCollateralAmount(account.data);
        const ownerStr = owner.toBase58();

        // Apply collateral filter if specified
        if (collateralDenom && denom !== collateralDenom) {
          continue;
        }

        if (amount > BigInt(0) && ownerStrings.has(ownerStr)) {
          if (!collateralMap.has(ownerStr)) {
            collateralMap.set(ownerStr, []);
          }
          collateralMap.get(ownerStr)!.push({ denom, amount });
        }
      } catch (err) {
        // Skip invalid collateral accounts
        continue;
      }
    }

    // 6. Build troves array
    const troves: TroveData[] = [];

    for (const owner of owners) {
      const ownerStr = owner.toBase58();
      const debt = debtAccounts.get(ownerStr);
      const icr = icrMap.get(ownerStr);
      const collateralAccounts = collateralMap.get(ownerStr);

      if (!debt || !icr || !collateralAccounts || collateralAccounts.length === 0) {
        continue;
      }

      // Get liquidity threshold PDA for this owner
      const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('liquidity_threshold'), owner.toBuffer()],
        PROTOCOL_PROGRAM_ID
      );

      // Create trove entry for each collateral type
      for (const { denom, amount } of collateralAccounts) {
        troves.push({
          owner,
          debt,
          collateralAmount: amount,
          collateralDenom: denom,
          icr,
          liquidityThresholdAccount: liquidityThresholdPda,
        });
      }
    }

    return troves;
  } catch (err) {
    console.error('Error fetching troves:', err);
    throw err;
  }
}
