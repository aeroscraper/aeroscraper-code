// Fetch the current USD price for a given denomination (e.g., "SOL")
export async function getPrice(denom: string): Promise<number> {
  const token = denom.trim().toUpperCase();

  if (token === "SOL") {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        { cache: "no-store" }
      );

      const data = await response.json();
      const price = Number(data?.solana?.usd ?? 0);

      if (Number.isFinite(price) && price > 0) {
        return price;
      }
    } catch (error) {
      console.error("Failed to fetch SOL price:", error);
    }
  }

  return 0;
}
