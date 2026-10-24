"use client";

import { SerwistProvider } from "@serwist/turbopack/react";

// Registra o service worker (só no build de produção; no `next dev` fica desligado).
export function PwaProvider({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"} cacheOnNavigation={false} reloadOnOnline={false}>
      {children}
    </SerwistProvider>
  );
}
