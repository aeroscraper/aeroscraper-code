"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AbstraxionProvider } from "@/components/xion/Abstraxion";

const queryClient = new QueryClient();

export function XionProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AbstraxionProvider>
        {children}
      </AbstraxionProvider>
    </QueryClientProvider>
  );
}
