// Progressive Web App support: service worker registration and the browser's install prompt.

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIosSafari() {
  const agent = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(agent) && /safari/i.test(agent) && !/crios|fxios|edgios/i.test(agent);
}

export function canPromptInstall() {
  return Boolean(deferredPrompt);
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable' as const;
  const event = deferredPrompt;
  deferredPrompt = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome;
}

export function setupPwa() {
  // The install prompt can fire before React renders, so capture it at startup.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  // Production only: a service worker in development would cache Vite's dev files and hide code changes.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        // The app works without the service worker; installation and offline start-up are simply unavailable.
        console.warn('Service worker registration failed', error);
      });
    };
    // Register after the page has loaded so it does not compete with the first render.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}
