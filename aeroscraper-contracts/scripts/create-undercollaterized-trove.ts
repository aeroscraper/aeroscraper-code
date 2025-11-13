// scripts/create-undercollateralized-trove.ts
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccount,
    getAccount,
} from "@solana/spl-token";
import { AerospacerProtocol } from "../target/types/aerospacer_protocol";
import { AerospacerOracle } from "../target/types/aerospacer_oracle";
import { AerospacerFees } from "../target/types/aerospacer_fees";

const COLLATERAL_DENOM = "SOL";
const PYTH_SOL_FEED = new PublicKey(
    "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"
);
const DEFAULT_COLLATERAL = new BN("11000000"); // 0.011 SOL
const DEFAULT_DEBT = new BN("1500000000000000000"); // 1.5 aUSD

const USER_DEBT_DISCRIMINATOR = Buffer.from([
    102, 237, 238, 206, 72, 254, 116, 219,
]);
const USER_COLLATERAL_DISCRIMINATOR = Buffer.from([
    26, 219, 87, 11, 62, 102, 67, 77,
]);
const LIQUIDITY_THRESHOLD_DISCRIMINATOR = Buffer.from([
    130, 0, 84, 160, 128, 62, 185, 75,
]);

const PERCENT_SCALE = BigInt(100_000_000); // 100 * 1e6
const SOL_SCALE = BigInt(1_000_000_000); // lamports
const AUSD_SCALE = BigInt("1000000000000000000"); // 1e18
const USD_MICRO = BigInt(1_000_000); // 1e6
const DEBT_DIVISOR = AUSD_SCALE / USD_MICRO; // 1e12

type TroveData = {
    owner: PublicKey;
    debt: bigint;
    collateralAmount: bigint;
    collateralDenom: string;
    icr: bigint;
    liquidityThresholdAccount: PublicKey;
};

function toUint8Array(data: Buffer | Uint8Array): Uint8Array {
    return data instanceof Buffer ? new Uint8Array(data) : data;
}

function deserializeUserDebt(data: Buffer | Uint8Array) {
    const arr = toUint8Array(data);
    let offset = 8;
    const owner = new PublicKey(arr.slice(offset, offset + 32));
    offset += 32;
    const debt = BigInt(
        new DataView(arr.buffer, arr.byteOffset + offset, 8).getBigUint64(0, true)
    );
    return { owner, debt };
}

function deserializeUserCollateral(data: Buffer | Uint8Array) {
    const arr = toUint8Array(data);
    let offset = 8;
    const owner = new PublicKey(arr.slice(offset, offset + 32));
    offset += 32;
    const denomLen = new DataView(arr.buffer, arr.byteOffset + offset, 4).getUint32(
        0,
        true
    );
    offset += 4;
    const denom = new TextDecoder().decode(arr.slice(offset, offset + denomLen));
    offset += denomLen;
    const amount = BigInt(
        new DataView(arr.buffer, arr.byteOffset + offset, 8).getBigUint64(0, true)
    );
    return { owner, denom, amount };
}

function deserializeLiquidityThreshold(data: Buffer | Uint8Array) {
    const arr = toUint8Array(data);
    const offset = 8 + 32;
    return BigInt(
        new DataView(arr.buffer, arr.byteOffset + offset, 8).getBigUint64(0, true)
    );
}

async function ensureAta(
    connection: Connection,
    mint: PublicKey,
    owner: PublicKey,
    payer: Keypair
) {
    const ata = await getAssociatedTokenAddress(mint, owner);
    const info = await connection.getAccountInfo(ata);
    if (!info) {
        await createAssociatedTokenAccount(connection, payer, mint, owner);
    }
    return ata;
}

async function requestAirdrop(connection: Connection, wallet: PublicKey) {
    const balance = await connection.getBalance(wallet);
    const min = 0.05 * LAMPORTS_PER_SOL;
    if (balance >= min) return;
    console.log("💧 Airdropping 0.1 SOL to wallet...");
    const sig = await connection.requestAirdrop(wallet, 0.1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
}

function calculateICR(
    collateralLamports: bigint,
    loanAmount: bigint,
    priceUsd: number
): bigint {
    if (loanAmount === BigInt(0)) return BigInt(10_000_000_000);
    const priceMicro = BigInt(Math.round(priceUsd * 1_000_000));
    const collateralUsdMicro =
        (collateralLamports * priceMicro) / SOL_SCALE;
    const debtUsdMicro = loanAmount / DEBT_DIVISOR;
    if (debtUsdMicro === BigInt(0)) return BigInt(10_000_000_000);
    return (collateralUsdMicro * PERCENT_SCALE) / debtUsdMicro;
}

async function fetchSolPrice(
    oracleProgram: Program<AerospacerOracle>,
    statePda: PublicKey
): Promise<number> {
    const method = await oracleProgram.methods
        .getPrice({ denom: "SOL" })
        .accounts({
            state: statePda,
            pythPriceAccount: PYTH_SOL_FEED,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        } as any)
        .instruction();

    const provider = oracleProgram.provider as anchor.AnchorProvider;
    const { connection } = provider;
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new anchor.web3.Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = provider.wallet.publicKey;
    tx.add(method);
    const sim = await connection.simulateTransaction(tx);
    if (sim.value.err) {
        throw new Error(
            `Oracle simulation failed: ${JSON.stringify(sim.value.err)}`
        );
    }
    const logs = sim.value.logs || [];
    for (const log of logs) {
        const match = log.match(/Price: (-?\d+) ± (\d+) x 10\^(-?\d+)/);
        if (match) {
            const price = parseInt(match[1], 10);
            const exponent = parseInt(match[3], 10);
            return price * Math.pow(10, exponent);
        }
    }
    throw new Error("Could not parse SOL price from oracle logs");
}

async function fetchAllTroves(
    connection: Connection,
    programId: PublicKey,
    collateralDenom: string
): Promise<TroveData[]> {
    const troves: TroveData[] = [];

    const debtAccounts = await connection.getProgramAccounts(programId, {
        filters: [
            { dataSize: 72 },
            {
                memcmp: {
                    offset: 0,
                    bytes: anchor.utils.bytes.bs58.encode(USER_DEBT_DISCRIMINATOR),
                },
            },
        ],
    });

    const liquidityAccounts = new Map<string, PublicKey>();
    const collateralMap = new Map<string, Array<{ denom: string; amount: bigint }>>();
    const debtMap = new Map<string, bigint>();

    for (const { account } of debtAccounts) {
        const { owner, debt } = deserializeUserDebt(account.data);
        if (debt <= BigInt(0)) continue;
        const ownerStr = owner.toBase58();
        debtMap.set(ownerStr, debt);
        const [ltPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("liquidity_threshold"), owner.toBuffer()],
            programId
        );
        liquidityAccounts.set(ownerStr, ltPda);
    }

    if (debtMap.size === 0) return troves;

    const collateralAccounts = await connection.getProgramAccounts(programId, {
        filters: [
            {
                memcmp: {
                    offset: 0,
                    bytes: anchor.utils.bytes.bs58.encode(
                        USER_COLLATERAL_DISCRIMINATOR
                    ),
                },
            },
        ],
    });

    for (const { account } of collateralAccounts) {
        const { owner, denom, amount } = deserializeUserCollateral(account.data);
        if (amount <= BigInt(0)) continue;
        if (denom !== collateralDenom) continue;
        const ownerStr = owner.toBase58();
        if (!debtMap.has(ownerStr)) continue;
        if (!collateralMap.has(ownerStr)) collateralMap.set(ownerStr, []);
        collateralMap.get(ownerStr)!.push({ denom, amount });
    }

    for (const [ownerStr, debt] of debtMap.entries()) {
        const collateralEntries = collateralMap.get(ownerStr);
        const ltPda = liquidityAccounts.get(ownerStr);
        if (!collateralEntries || !ltPda) continue;

        const owner = new PublicKey(ownerStr);

        const ltInfo = await connection.getAccountInfo(ltPda);
        if (!ltInfo) continue;
        const icr = deserializeLiquidityThreshold(ltInfo.data);

        for (const { denom, amount } of collateralEntries) {
            troves.push({
                owner,
                debt,
                collateralAmount: amount,
                collateralDenom: denom,
                icr,
                liquidityThresholdAccount: ltPda,
            });
        }
    }
    return troves;
}

function sortTrovesByICR(troves: TroveData[]): TroveData[] {
    return [...troves].sort((a, b) => {
        if (a.icr < b.icr) return -1;
        if (a.icr > b.icr) return 1;
        return 0;
    });
}

function findNeighbors(
    trove: TroveData,
    troves: TroveData[]
): { prev: TroveData | null; next: TroveData | null } {
    const index = troves.findIndex((t) => t.owner.equals(trove.owner));
    const prev = index > 0 ? troves[index - 1] : null;
    const next = index < troves.length - 1 ? troves[index + 1] : null;
    return { prev, next };
}

function buildNeighborHints(
    neighbors: { prev: TroveData | null; next: TroveData | null }
): PublicKey[] {
    const hints: PublicKey[] = [];
    if (neighbors.prev?.liquidityThresholdAccount) {
        hints.push(neighbors.prev.liquidityThresholdAccount);
    }
    if (neighbors.next?.liquidityThresholdAccount) {
        hints.push(neighbors.next.liquidityThresholdAccount);
    }
    return hints;
}

async function getNeighborHints(
    connection: Connection,
    programId: PublicKey,
    oracleProgram: Program<AerospacerOracle>,
    oracleState: PublicKey,
    user: PublicKey,
    collateralAmount: BN,
    debt: BN
): Promise<PublicKey[]> {
    const troves = await fetchAllTroves(connection, programId, COLLATERAL_DENOM);
    const sorted = sortTrovesByICR(troves);

    const solPrice = await fetchSolPrice(oracleProgram, oracleState);
    const icr = calculateICR(
        BigInt(collateralAmount.toString()),
        BigInt(debt.toString()),
        solPrice
    );

    const [ltPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), user.toBuffer()],
        programId
    );

    const newTrove: TroveData = {
        owner: user,
        debt: BigInt(debt.toString()),
        collateralAmount: BigInt(collateralAmount.toString()),
        collateralDenom: COLLATERAL_DENOM,
        icr,
        liquidityThresholdAccount: ltPda,
    };

    const insertIndex = sorted.findIndex((t) => t.icr > icr);
    const finalIndex = insertIndex === -1 ? sorted.length : insertIndex;

    const augmented = [
        ...sorted.slice(0, finalIndex),
        newTrove,
        ...sorted.slice(finalIndex),
    ];

    if (finalIndex === 0) return [];
    const neighbors = findNeighbors(newTrove, augmented);
    return buildNeighborHints(neighbors);
}

async function main() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const protocolProgram = anchor.workspace
        .AerospacerProtocol as Program<AerospacerProtocol>;
    const oracleProgram = anchor.workspace
        .AerospacerOracle as Program<AerospacerOracle>;
    const feesProgram = anchor.workspace
        .AerospacerFees as Program<AerospacerFees>;

    const wallet = provider.wallet as anchor.Wallet;
    const payer = wallet.payer;
    const user = wallet.publicKey;

    await requestAirdrop(provider.connection, user);

    const [statePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        protocolProgram.programId
    );
    const state = await protocolProgram.account.stateAccount.fetch(statePda);

    const [oracleStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        oracleProgram.programId
    );

    const [feesStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_state")],
        feesProgram.programId
    );

    const [protocolCollateralVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol_collateral_vault"), Buffer.from(COLLATERAL_DENOM)],
        protocolProgram.programId
    );

    const collateralVault = await getAccount(
        provider.connection,
        protocolCollateralVault
    );
    const collateralMint = collateralVault.mint;

    const [protocolStablecoinVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol_stablecoin_vault")],
        protocolProgram.programId
    );
    const stablecoinMint = state.stableCoinAddr;

    const userCollateralAta = await ensureAta(
        provider.connection,
        collateralMint,
        user,
        payer
    );
    const userStableAta = await ensureAta(
        provider.connection,
        stablecoinMint,
        user,
        payer
    );

    const collateralBalance = await provider.connection.getTokenAccountBalance(
        userCollateralAta
    );
    const collateralAmountLamports = DEFAULT_COLLATERAL.toNumber();
    if (
        !collateralBalance.value.uiAmount ||
        collateralBalance.value.amount === "0"
    ) {
        throw new Error(
            `No collateral tokens found for ${collateralMint.toString()}. Mint/fund collateral before running this script.`
        );
    }
    if (
        BigInt(collateralBalance.value.amount) <
        BigInt(collateralAmountLamports.toString())
    ) {
        throw new Error(
            `Insufficient collateral tokens. Needed ${collateralAmountLamports}, have ${collateralBalance.value.amount}`
        );
    }

    const neighborHints = await getNeighborHints(
        provider.connection,
        protocolProgram.programId,
        oracleProgram,
        oracleStatePda,
        user,
        DEFAULT_COLLATERAL,
        DEFAULT_DEBT
    );

    const [userDebtPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_debt_amount"), user.toBuffer()],
        protocolProgram.programId
    );
    const [userCollateralPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("user_collateral_amount"),
            user.toBuffer(),
            Buffer.from(COLLATERAL_DENOM),
        ],
        protocolProgram.programId
    );
    const [liquidityThresholdPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_threshold"), user.toBuffer()],
        protocolProgram.programId
    );
    const [totalCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("total_collateral_amount"), Buffer.from(COLLATERAL_DENOM)],
        protocolProgram.programId
    );

    const stabilityPoolOwner = new PublicKey(
        "5oMxbgjPWkBYRKbsh3yKrrEC5Ut8y3azHKc787YHY9Ar"
    );
    const feeAddress1 = new PublicKey(
        "8Lv4UrYHTrzvg9jPVVGNmxWyMrMvrZnCQLWucBzfJyyR"
    );
    const feeAddress2 = new PublicKey(
        "GcNwV1nA5bityjNYsWwPLHykpKuuhPzK1AQFBbrPopnX"
    );
    const stabilityPoolTokenAccount = await getAssociatedTokenAddress(
        stablecoinMint,
        stabilityPoolOwner
    );
    const feeAddress1TokenAccount = await getAssociatedTokenAddress(
        stablecoinMint,
        feeAddress1
    );
    const feeAddress2TokenAccount = await getAssociatedTokenAddress(
        stablecoinMint,
        feeAddress2
    );

    console.log("🔨 Opening undercollateralized trove...");
    console.log("  Collateral:", DEFAULT_COLLATERAL.toString(), "(lamports)");
    console.log("  Debt:", DEFAULT_DEBT.toString(), "(1e-18 aUSD)");
    console.log("  Neighbor hints:", neighborHints.map((p) => p.toBase58()));

    await protocolProgram.methods
        .openTrove({
            loanAmount: DEFAULT_DEBT,
            collateralDenom: COLLATERAL_DENOM,
            collateralAmount: DEFAULT_COLLATERAL,
        })
        .accounts({
            user,
            userDebtAmount: userDebtPda,
            liquidityThreshold: liquidityThresholdPda,
            userCollateralAmount: userCollateralPda,
            userCollateralAccount: userCollateralAta,
            collateralMint,
            protocolCollateralAccount: protocolCollateralVault,
            totalCollateralAmount: totalCollateralPda,
            state: statePda,
            userStablecoinAccount: userStableAta,
            protocolStablecoinAccount: protocolStablecoinVault,
            stableCoinMint: stablecoinMint,
            oracleProgram: state.oracleHelperAddr,
            oracleState: state.oracleStateAddr,
            pythPriceAccount: PYTH_SOL_FEED,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
            feesProgram: state.feeDistributorAddr,
            feesState: state.feeStateAddr,
            stabilityPoolTokenAccount,
            feeAddress1TokenAccount,
            feeAddress2TokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts(
            neighborHints.map((pubkey) => ({
                pubkey,
                isSigner: false,
                isWritable: false,
            }))
        )
        .signers([payer])
        .rpc();

    console.log("✅ Undercollateralized trove opened successfully!");
    console.log("  User debt PDA:", userDebtPda.toBase58());
    console.log("  User collateral PDA:", userCollateralPda.toBase58());
    console.log("  Liquidity threshold PDA:", liquidityThresholdPda.toBase58());
}

main()
    .then(() => {
        console.log("🎉 Script complete");
        process.exit(0);
    })
    .catch((err) => {
        console.error("💥 Script failed:", err);
        process.exit(1);
    });
