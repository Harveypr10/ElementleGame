const PWA_INSTALLED_KEY = 'elementle_pwa_installed';
const SKIP_HANDOFF_KEY = 'elementle_skip_handoff';

export function isPwaContext(): boolean {
  if (typeof window === 'undefined') return false;
  
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isAndroidTWA = document.referrer.includes('android-app://');
  
  return isStandalone || isIOSStandalone || isAndroidTWA;
}

export function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  
  return isIOS && isSafari && !isPwaContext();
}

export function markPwaInstalled(): void {
  try {
    localStorage.setItem(PWA_INSTALLED_KEY, 'true');
  } catch (e) {
    console.warn('[pwaContext] Could not mark PWA as installed:', e);
  }
}

export function hasPwaInstalledFlag(): boolean {
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function markSkipHandoff(): void {
  try {
    sessionStorage.setItem(SKIP_HANDOFF_KEY, 'true');
  } catch (e) {
    console.warn('[pwaContext] Could not mark skip handoff:', e);
  }
}

export function shouldSkipHandoff(): boolean {
  try {
    return sessionStorage.getItem(SKIP_HANDOFF_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function clearSkipHandoff(): void {
  try {
    sessionStorage.removeItem(SKIP_HANDOFF_KEY);
  } catch (e) {
    console.warn('[pwaContext] Could not clear skip handoff:', e);
  }
}

export function shouldShowMagicLinkHandoff(): boolean {
  if (typeof window === 'undefined') return false;
  
  const params = new URLSearchParams(window.location.search);
  const hasToken = params.has('token_hash') && params.get('type') === 'magiclink';
  
  if (!hasToken) return false;
  if (isPwaContext()) return false;
  if (!isIOSSafari()) return false;
  if (shouldSkipHandoff()) return false;
  
  return true;
}
