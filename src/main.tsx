import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clean up the legacy standalone push worker. The PWA worker now imports the
// push handlers so we avoid two workers competing for the same "/" scope.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const legacyRegistrations = registrations.filter((registration) => {
        const scriptUrl =
          registration.active?.scriptURL ||
          registration.waiting?.scriptURL ||
          registration.installing?.scriptURL ||
          "";
        return scriptUrl.includes("/sw-push.js");
      });

      if (legacyRegistrations.length === 0) {
        return;
      }

      await Promise.all(legacyRegistrations.map((registration) => registration.unregister()));
      console.log("[Push SW] Removed legacy standalone push worker registrations");

      // Clear old app-shell caches so the browser refetches the latest chunks.
      if ("caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys
            .filter((key) =>
              key.includes("workbox") ||
              key.includes("vite-plugin-pwa") ||
              key.includes("supabase-cache"),
            )
            .map((key) => caches.delete(key)),
        );
      }

      window.location.reload();
    } catch (error) {
      console.error("[Push SW] Legacy cleanup failed:", error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
