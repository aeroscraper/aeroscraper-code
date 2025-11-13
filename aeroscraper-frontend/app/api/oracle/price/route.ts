import { NextResponse } from 'next/server';
import { getOnChainSolPrice } from '@/lib/solana/getOnChainSolPrice';

type PriceSource = 'oracle' | 'coingecko';

interface PriceCacheEntry {
    price: number;
    source: PriceSource;
    fetchedAt: number;
}

const COINGECKO_URL =
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';
const ORACLE_CACHE_TTL_MS = 5 * 60 * 1000;
const COINGECKO_CACHE_TTL_MS = 5 * 60 * 1000;

let oracleCache: PriceCacheEntry | null = null;
let coinGeckoCache: PriceCacheEntry | null = null;

function isFresh(entry: PriceCacheEntry | null, ttl: number): entry is PriceCacheEntry {
    return Boolean(entry && Date.now() - entry.fetchedAt <= ttl);
}

async function fetchCoinGeckoPrice(): Promise<number> {
    const response = await fetch(COINGECKO_URL, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`CoinGecko request failed: ${response.status}`);
    }
    const data = await response.json();
    const price = Number(data?.solana?.usd ?? 0);
    if (!Number.isFinite(price) || price <= 0) {
        throw new Error('CoinGecko returned invalid SOL price');
    }
    return price;
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const denom = (url.searchParams.get('denom') ?? 'SOL').toUpperCase();

    if (denom !== 'SOL') {
        return NextResponse.json(
            { error: `Unsupported denom: ${denom}` },
            { status: 400 },
        );
    }

    try {
        if (isFresh(oracleCache, ORACLE_CACHE_TTL_MS)) {
            return NextResponse.json({
                price: oracleCache.price,
                source: oracleCache.source,
                fallback: false,
                cache: {
                    fromCache: true,
                    ageMs: Date.now() - oracleCache.fetchedAt,
                    ttlMs: ORACLE_CACHE_TTL_MS,
                },
            });
        }

        const price = await getOnChainSolPrice();
        oracleCache = {
            price,
            source: 'oracle',
            fetchedAt: Date.now(),
        };
        return NextResponse.json({
            price,
            source: 'oracle',
            fallback: false,
            cache: {
                fromCache: false,
                ageMs: 0,
                ttlMs: ORACLE_CACHE_TTL_MS,
            },
        });
    } catch (oracleError) {
        console.error('Oracle SOL price fetch failed:', oracleError);

        if (isFresh(coinGeckoCache, COINGECKO_CACHE_TTL_MS)) {
            return NextResponse.json({
                price: coinGeckoCache.price,
                source: coinGeckoCache.source,
                fallback: true,
                oracleError: (oracleError as Error)?.message ?? 'unknown',
                cache: {
                    fromCache: true,
                    ageMs: Date.now() - coinGeckoCache.fetchedAt,
                    ttlMs: COINGECKO_CACHE_TTL_MS,
                },
            });
        }

        try {
            const price = await fetchCoinGeckoPrice();
            coinGeckoCache = {
                price,
                source: 'coingecko',
                fetchedAt: Date.now(),
            };
            return NextResponse.json({
                price,
                source: 'coingecko',
                fallback: true,
                oracleError: (oracleError as Error)?.message ?? 'unknown',
                cache: {
                    fromCache: false,
                    ageMs: 0,
                    ttlMs: COINGECKO_CACHE_TTL_MS,
                },
            });
        } catch (fallbackError) {
            console.error('CoinGecko SOL price fetch failed:', fallbackError);

            const staleEntry = oracleCache ?? coinGeckoCache;
            if (staleEntry) {
                const ttl =
                    staleEntry.source === 'oracle'
                        ? ORACLE_CACHE_TTL_MS
                        : COINGECKO_CACHE_TTL_MS;
                return NextResponse.json({
                    price: staleEntry.price,
                    source: staleEntry.source,
                    fallback: true,
                    stale: true,
                    oracleError: (oracleError as Error)?.message ?? 'unknown',
                    fallbackError: (fallbackError as Error)?.message ?? 'unknown',
                    cache: {
                        fromCache: true,
                        ageMs: Date.now() - staleEntry.fetchedAt,
                        ttlMs: ttl,
                    },
                });
            }

            return NextResponse.json(
                {
                    error: 'Failed to fetch SOL price from oracle and CoinGecko',
                    oracleError: (oracleError as Error)?.message ?? 'unknown',
                    fallbackError: (fallbackError as Error)?.message ?? 'unknown',
                },
                { status: 502 },
            );
        }
    }
}

