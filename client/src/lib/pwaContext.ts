const PWA_INSTALLED_KEY = 'elementle_pwa_installed';
const MAGIC_LINK_COOKIE_NAME = 'elementle_magic_link_token';

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

export function storeMagicLinkTokenInCookie(tokenHash: string, type: string): void {
  const data = JSON.stringify({ tokenHash, type, timestamp: Date.now() });
  const expiryMinutes = 10;
  const expires = new Date(Date.now() + expiryMinutes * 60 * 1000).toUTCString();
  document.cookie = `${MAGIC_LINK_COOKIE_NAME}=${encodeURIComponent(data)}; expires=${expires}; path=/; SameSite=Lax`;
  console.log('[pwaContext] Stored magic link token in cookie');
}

export function getMagicLinkTokenFromCookie(): { tokenHash: string; type: string } | null {
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === MAGIC_LINK_COOKIE_NAME && value) {
        const data = JSON.parse(decodeURIComponent(value));
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        if (data.timestamp && data.timestamp > tenMinutesAgo) {
          return { tokenHash: data.tokenHash, type: data.type };
        }
      }
    }
  } catch (e) {
    console.warn('[pwaContext] Could not read magic link cookie:', e);
  }
  return null;
}

export function clearMagicLinkCookie(): void {
  document.cookie = `${MAGIC_LINK_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  console.log('[pwaContext] Cleared magic link cookie');
}

export function shouldShowMagicLinkHandoff(): boolean {
  if (typeof window === 'undefined') return false;
  
  const params = new URLSearchParams(window.location.search);
  const hasToken = params.has('token_hash') && params.get('type') === 'magiclink';
  
  if (!hasToken) return false;
  if (isPwaContext()) return false;
  if (!isIOSSafari()) return false;
  
  return true;
}
