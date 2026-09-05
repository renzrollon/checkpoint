import type { MetadataRoute } from "next";

/**
 * Manifest-only PWA (design D19): name, icons, standalone display and a
 * theme colour. No service worker, because offline is a non-goal.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Checkpoint",
    short_name: "Checkpoint",
    description: "Read one change, answer the one decision, approve or send back.",
    start_url: "/",
    display: "standalone",
    background_color: "#161826",
    theme_color: "#161826",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
