import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Latch",
    short_name: "Latch",
    description: "Your personal relay for notes, links, and files.",
    start_url: "/",
    display: "standalone",
    background_color: "#141512",
    theme_color: "#141512",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
