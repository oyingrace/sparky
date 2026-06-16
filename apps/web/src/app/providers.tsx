"use client";

import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const DAppKitProviderLazy = dynamic(
  () =>
    import("@mysten/dapp-kit-react").then((mod) => {
      const { dAppKit } = require("@/lib/dapp-kit");
      return function Provider({ children }: { children: React.ReactNode }) {
        return (
          <mod.DAppKitProvider dAppKit={dAppKit}>{children}</mod.DAppKitProvider>
        );
      };
    }),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProviderLazy>{children}</DAppKitProviderLazy>
    </QueryClientProvider>
  );
}
