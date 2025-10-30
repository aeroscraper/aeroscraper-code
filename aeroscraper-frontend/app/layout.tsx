import "./globals.css";
import { Exo } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
// import "@burnt-labs/abstraxion/styles.css";
// import "@burnt-labs/ui/styles.css";

import ClientAppKitProvider from "@/lib/ClientAppKitProvider";

const exo = Exo({ subsets: ["latin"] });

export const metadata = {
  title: "Aeroscraper",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${exo.className} relative min-h-screen flex flex-col xion`}
      >
        {/* ✅ Wrap app in AppKitProvider with client */}
        <ClientAppKitProvider>{children}</ClientAppKitProvider>

        <NextTopLoader
          color="#E4462D"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={true}
          easing="ease"
          speed={200}
          shadow="0 0 10px #E4462D,0 0 5px #E4462D"
        />
      </body>
    </html>
  );
}
