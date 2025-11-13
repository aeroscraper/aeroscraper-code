// Fetch the current USD price for a given denomination (e.g., "SOL")
export async function getPrice(denom: string): Promise<number> {
  const token = denom.trim().toUpperCase();

  if (token === "SOL") {
    try {
      const response = await fetch(`/api/oracle/price?denom=${token}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const price = Number(data?.price ?? 0);
      if (Number.isFinite(price) && price > 0) {
        return price;
      }
    } catch (error) {
      console.error("Failed to fetch SOL price:", error);
    }
  }

  return 0;
}
