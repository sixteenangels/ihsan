import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.npm_package_version ||
    new Date().toISOString();

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
    server: {
      host: "::",
      port: 8080,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }

            if (
              id.includes("@supabase/") ||
              id.includes("leaflet") ||
              id.includes("react-leaflet")
            ) {
              return "supabase-maps";
            }

            if (id.includes("recharts")) {
              return "charts";
            }

            if (id.includes("framer-motion")) {
              return "motion";
            }

            if (id.includes("react-router") || id.includes("@remix-run/router")) {
              return "router";
            }

            if (id.includes("@tanstack/react-query")) {
              return "query";
            }

            if (
              id.includes("react-hook-form") ||
              id.includes("@hookform/resolvers") ||
              id.includes("zod") ||
              id.includes("input-otp")
            ) {
              return "forms";
            }

            if (id.includes("next-themes")) {
              return "theme";
            }

            if (id.includes("date-fns")) {
              return "date-utils";
            }

            if (id.includes("react-day-picker")) {
              return "calendar";
            }

            if (id.includes("jspdf") || id.includes("html2canvas")) {
              return "pdf-tools";
            }

            if (id.includes("@radix-ui/")) {
              return "radix";
            }

            if (id.includes("lucide-react")) {
              return "icons";
            }

            if (id.includes("embla-carousel-react") || id.includes("react-resizable-panels")) {
              return "layout-tools";
            }

            if (id.includes("cmdk") || id.includes("vaul") || id.includes("sonner")) {
              return "ui-extensions";
            }

            return "vendor";
          },
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "favicon.png", "favicon-192.png", "favicon-512.png", "favicon.ico", "robots.txt"],
        manifest: {
          name: "AJYN",
          short_name: "AJYN",
          description: "Premium shopping, checkout, and fulfillment with AJYN.",
          theme_color: "#e65c00",
          background_color: "#f5f5f5",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          icons: [
            {
              src: "/favicon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "/favicon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/favicon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          importScripts: ["/sw-push.js"],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
