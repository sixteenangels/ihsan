import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const BUILD_ID_STORAGE_KEY = "ihsan-app-build-id";
const STALE_CACHE_PREFIXES = ["supabase-cache", "workbox", "vite-plugin-pwa"];

async function cleanupLegacyPushWorkers() {
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
    return false;
  }

  await Promise.all(legacyRegistrations.map((registration) => registration.unregister()));
  console.log("[Push SW] Removed legacy standalone push worker registrations");
  return true;
}

async function cleanupCachesForNewBuild() {
  if (!("caches" in window)) {
    return false;
  }

  const previousBuildId = localStorage.getItem(BUILD_ID_STORAGE_KEY);
  localStorage.setItem(BUILD_ID_STORAGE_KEY, __APP_BUILD_ID__);

  if (!previousBuildId || previousBuildId === __APP_BUILD_ID__) {
    return false;
  }

  const cacheKeys = await caches.keys();
  const staleKeys = cacheKeys.filter((key) =>
    STALE_CACHE_PREFIXES.some((prefix) => key.includes(prefix)),
  );

  if (staleKeys.length === 0) {
    return false;
  }

  await Promise.all(staleKeys.map((key) => caches.delete(key)));
  console.log("[PWA] Cleared stale caches after build change", {
    previousBuildId,
    currentBuildId: __APP_BUILD_ID__,
    cacheCount: staleKeys.length,
  });

  return true;
}

// Clean up the legacy standalone push worker. The PWA worker now imports the
// push handlers so we avoid two workers competing for the same "/" scope.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const legacyRemoved = await cleanupLegacyPushWorkers();
      const staleCachesCleared = await cleanupCachesForNewBuild();
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));

      if (legacyRemoved || staleCachesCleared) {
        window.location.reload();
      }
    } catch (error) {
      console.error("[PWA] Service worker cleanup failed:", error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
