"use client"; // ✅ must be client

import { AppKitProvider as BaseAppKitProvider } from "@reown/appkit/react";
import { reownClient } from "@/lib/reownClient";

const AppKitProvider: any = BaseAppKitProvider; // ✅ TypeScript hack

export default function ClientAppKitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppKitProvider client={reownClient}>{children}</AppKitProvider>;
}
