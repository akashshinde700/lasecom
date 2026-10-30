import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lastrivon Kart India",
    short_name: "Lastrivon Kart",
    description:
      "Shop electronics, fashion, home & more from trusted sellers. New & refurbished products, B2B bulk quotes, Razorpay payments.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ea580c",
    lang: "en-IN",
    dir: "ltr",
    categories: ["shopping", "business", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Today's Deals",
        short_name: "Deals",
        url: "/#/listing?badge=DEAL",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Renewed & Refurbished",
        short_name: "Refurbished",
        url: "/#/listing?condition=REFURBISHED",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "My Cart",
        short_name: "Cart",
        url: "/#/cart",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
