/**
 * Calculate Individual Collateralization Ratio (ICR) in micro-percent (1e-6 per 1%).
 * 
 * This mirrors the on-chain calculation while staying purely integer-based:
 * 1. Convert lamport collateral to USD (scaled by 1e6) using the live SOL price.
 * 2. Convert aUSD-denominated debt (1e18) to USD scaled by 1e6.
 * 3. Return (collateral_usd / debt_usd) * 100%, scaled by 1e6.
 * 
 * @param collateralAmountLamports Amount of collateral in lamports (1e9 lamports = 1 SOL).
 * @param loanAmountSmallest Debt amount in aUSD smallest unit (1e18).
 * @param solPriceUsd Current SOL price in USD (floating number from oracle/API).
 */
export function calculateICR(
  collateralAmountLamports: bigint,
  loanAmountSmallest: bigint,
  solPriceUsd: number
): bigint {
  const MAX_MICRO_PERCENT =
    BigInt('9007199254740991') * BigInt(1_000_000); // ~Number.MAX_SAFE_INTEGER * 1e6

  if (loanAmountSmallest === BigInt(0)) {
    return MAX_MICRO_PERCENT; // Approximate "infinite" ICR
  }

  if (!Number.isFinite(solPriceUsd) || solPriceUsd <= 0) {
    return BigInt(0);
  }

  const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
  const AUSD_DECIMAL_DIVISOR = BigInt(1_000_000_000_000); // 1e18 / 1e6 to keep USD scaled by 1e6
  const PRICE_SCALE = 1_000_000; // retain 6 decimals of price precision (number)
  const MICRO_PERCENT_SCALE = BigInt(1_000_000); // micro-percent (1e-6 per 1%)
  const HUNDRED = BigInt(100);

  const priceScaled = BigInt(Math.round(solPriceUsd * PRICE_SCALE));
  const collateralUsdScaled =
    (collateralAmountLamports * priceScaled) / LAMPORTS_PER_SOL; // USD scaled by 1e6

  if (collateralUsdScaled === BigInt(0)) {
    return BigInt(0);
  }

  const debtUsdScaled = loanAmountSmallest / AUSD_DECIMAL_DIVISOR; // USD scaled by 1e6

  if (debtUsdScaled === BigInt(0)) {
    return MAX_MICRO_PERCENT;
  }

  const numerator = collateralUsdScaled * HUNDRED * MICRO_PERCENT_SCALE;
  return numerator / debtUsdScaled;
}
