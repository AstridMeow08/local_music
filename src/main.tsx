// Fallback shim for browsers with stale cached index.html requesting /src/main.tsx
import './main.jsx';

// Clean up any stale service workers from previous builds or Vite default templates
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    let hadStaleWorkers = false;
    for (const registration of registrations) {
      registration.unregister();
      hadStaleWorkers = true;
    }
    if (hadStaleWorkers && 'caches' in window) {
      caches.keys().then((cacheNames) => {
        Promise.all(cacheNames.map((name) => caches.delete(name))).then(() => {
          // Force clean reload once to fetch fresh index.html
          window.location.reload();
        });
      });
    }
  });
}
