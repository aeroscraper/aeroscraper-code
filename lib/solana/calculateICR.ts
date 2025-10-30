/**
 * Calculate Individual Collateralization Ratio (ICR)
 * 
 * ICR = (collateral_value / debt) * 100
 * where collateral_value = collateral_amount * collateral_price
 * 
 * @param collateralAmount - Amount of collateral in native token units (lamports for SOL)
 * @param loanAmount - Debt amount in aUSD (with 18 decimals)
 * @param estimatedSolPrice - Estimated price per SOL (default: $100)
 * @returns ICR as bigint (e.g., 150 for 150%)
 */
export function calculateICR(
  collateralAmount: bigint,
  loanAmount: bigint,
  estimatedSolPrice: bigint = BigInt(100) // Default $100/SOL
): bigint {
  if (loanAmount === BigInt(0)) {
    return BigInt(Number.MAX_SAFE_INTEGER); // Infinite ICR (no debt)
  }

  // ICR = (collateral * price / debt) * 100
  const collateralValue = collateralAmount * estimatedSolPrice;
  const icr = (collateralValue * BigInt(100)) / loanAmount;

  return icr;
}

