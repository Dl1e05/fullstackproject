import { useEffect, useReducer } from 'react';

// Событие beforeinstallprompt может прийти до монтирования компонентов,
// поэтому ловим его на уровне модуля (модуль импортируется в main.jsx).
let deferredPrompt = null;
let installed = false;
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

function detectIOS() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function detectStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function useInstallPrompt() {
  const [, rerender] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    listeners.add(rerender);
    return () => listeners.delete(rerender);
  }, []);

  const isStandalone = installed || detectStandalone();
  const isIOS = detectIOS();

  async function promptInstall() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
    return outcome === 'accepted';
  }

  return {
    canInstall: !!deferredPrompt && !isStandalone,
    isIOS: isIOS && !isStandalone,
    isStandalone,
    promptInstall,
  };
}
