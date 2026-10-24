import { createSerwistRoute } from "@serwist/turbopack";

// Gera e serve o service worker (/serwist/sw.js) com a lista de arquivos do build.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
