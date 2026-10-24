/// <reference lib="webworker" />
// Service worker (Serwist). Regras:
// - arquivos do app (/_next/static) ficam no aparelho (precache);
// - a tela /offline (execução sem sinal) fica em cache: abre mesmo sem conexão;
// - as demais páginas são só rede: dados de fornecedor não ficam guardados no
//   navegador; sem sinal, qualquer página abre a tela /offline.
import { CacheFirst, NetworkFirst, NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/offline";
const SHELL_CACHE = "sqm-offline-shell";

const offlineShell = async () =>
  (await caches.open(SHELL_CACHE).then((c) => c.match(OFFLINE_URL, { ignoreSearch: true }))) ?? Response.error();

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" && url.pathname === OFFLINE_URL,
      handler: new NetworkFirst({
        cacheName: SHELL_CACHE,
        networkTimeoutSeconds: 5,
        plugins: [{ cacheKeyWillBeUsed: async () => new URL(OFFLINE_URL, self.location.origin).href }],
      }),
    },
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
      handler: new NetworkOnly({ plugins: [{ handlerDidError: offlineShell }] }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({ cacheName: "next-static" }),
    },
  ],
});

serwist.addEventListeners();
