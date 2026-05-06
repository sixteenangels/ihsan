import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register push notification service worker
if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/'
      });
      console.log('[Push SW] Service worker registered:', registration.scope);
    } catch (error) {
      console.error('[Push SW] Service worker registration failed:', error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
