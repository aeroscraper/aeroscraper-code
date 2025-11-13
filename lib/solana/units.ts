const powBigInt = (base: bigint, exponent: number): bigint => {
  let result = BigInt(1);
  for (let i = 0; i < exponent; i += 1) {
    result *= base;
  }
  return result;
};

export const decimalToBigInt = (amount: number, decimals: number): bigint => {
  const scale = powBigInt(BigInt(10), decimals);

  if (!Number.isFinite(amount)) {
    throw new Error(`Cannot convert non-finite number (${amount}) to BigInt`);
  }

  let amountStr = amount.toString();

  // Handle scientific notation by converting to a fixed-point decimal string
  if (/[eE]/.test(amountStr)) {
    amountStr = amount.toFixed(decimals);
  }

  const [integerPartRaw, fractionalRaw = ""] = amountStr.split(".");
  const integerPart = integerPartRaw === "" ? "0" : integerPartRaw;

  let sanitizedFractional = fractionalRaw.replace(/[^0-9]/g, "");
  sanitizedFractional = sanitizedFractional.padEnd(decimals, "0").slice(0, decimals);

  const integerValue = BigInt(integerPart);
  const fractionalValue =
    sanitizedFractional.length > 0 ? BigInt(sanitizedFractional || "0") : BigInt(0);

  return integerValue * scale + fractionalValue;
};

export const bigIntToDecimalString = (
  amount: bigint,
  decimals: number,
  precision = decimals
): string => {
  const isNegative = amount < BigInt(0);
  const absoluteAmount = isNegative ? -amount : amount;

  if (decimals === 0) {
    return `${isNegative ? "-" : ""}${absoluteAmount.toString()}`;
  }

  const digits = absoluteAmount.toString().padStart(decimals + 1, "0");
  const integerPart = digits.slice(0, digits.length - decimals) || "0";
  let fractionalPart = digits.slice(digits.length - decimals);

  if (precision < fractionalPart.length) {
    fractionalPart = fractionalPart.slice(0, precision);
  }

  fractionalPart = fractionalPart.replace(/0+$/, "");

  const sign = isNegative ? "-" : "";

  if (!fractionalPart) {
    return `${sign}${integerPart}`;
  }

  return `${sign}${integerPart}.${fractionalPart}`;
};
