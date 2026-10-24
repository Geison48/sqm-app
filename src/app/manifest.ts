import type { MetadataRoute } from "next";

// PWA instalável (Android/iOS/desktop). O nome é a marca do app, igual em PT e EN.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SQM App",
    short_name: "SQM",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
