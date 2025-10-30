// /lib/reownClient.ts
"use client";
import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import { solana, solanaDevnet } from "@reown/appkit/networks";

const projectId = "9f62e1a3ac37017cbb7f03a657c84455";
const solanaAdapter = new SolanaAdapter();

export const reownClient = createAppKit({
  projectId,
  adapters: [solanaAdapter],
  networks: [solanaDevnet],
  metadata: {
    name: "Aeroscraper",
    description: "Solana dApp powered by Reown",
    url: "https://aeroscraper.io",
    icons: ["/images/token-images/solana.svg"],
  },
});
