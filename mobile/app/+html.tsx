import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom HTML document for Expo Router web builds.
 * Adds the Smart App Banner meta tag for iOS Safari.
 */
export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

                {/* Smart App Banner for iOS Safari */}
                <meta name="apple-itunes-app" content="app-id=6758143250" />

                {/* SEO */}
                <meta name="description" content="Elementle - A daily historical date guessing game. Test your knowledge of history!" />
                <title>Elementle</title>

                <ScrollViewStyleReset />

                {/* Magic Link & Recovery Link Redirect Script */}
                {/* Detects Supabase auth tokens in URL and redirects to app custom scheme */}
                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function() {
                        try {
                            var search = window.location.search;
                            var hash = window.location.hash;
                            var params = new URLSearchParams(search);
                            var hashParams = hash ? new URLSearchParams(hash.substring(1)) : new URLSearchParams();
                            
                            var tokenHash = params.get('token_hash');
                            var type = params.get('type') || hashParams.get('type');
                            var accessToken = hashParams.get('access_token');
                            var refreshToken = hashParams.get('refresh_token');
                            
                            var appUrl = null;
                            
                            // Magic link: has token_hash + type=magiclink/email
                            if (tokenHash && (type === 'magiclink' || type === 'email')) {
                                appUrl = 'elementle://?token_hash=' + encodeURIComponent(tokenHash) + '&type=' + encodeURIComponent(type);
                            }
                            
                            // Recovery link: has access_token in fragment + type=recovery
                            if (!appUrl && accessToken && type === 'recovery') {
                                appUrl = 'elementle://reset-password#access_token=' + encodeURIComponent(accessToken) 
                                    + '&refresh_token=' + encodeURIComponent(refreshToken || '')
                                    + '&type=recovery';
                            }
                            
                            if (appUrl) {
                                console.log('[DeepLink] Auto-redirecting to app:', appUrl);
                                // Store URL for fallback button
                                window.__elementleAppUrl = appUrl;
                                // Attempt auto-redirect
                                window.location.href = appUrl;
                                
                                // After 1.5s, show the fallback UI in case redirect was blocked
                                setTimeout(function() {
                                    var fb = document.getElementById('elementle-fallback');
                                    if (fb) fb.style.display = 'flex';
                                }, 1500);
                            }
                        } catch(e) {
                            console.error('[DeepLink] Redirect error:', e);
                        }
                    })();
                ` }} />

                <style dangerouslySetInnerHTML={{
                    __html: `
                    #elementle-fallback {
                        display: none;
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        z-index: 99999;
                        background: #ffffff;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    }
                    #elementle-fallback h2 {
                        font-size: 24px;
                        color: #1e293b;
                        margin-bottom: 12px;
                    }
                    #elementle-fallback p {
                        font-size: 16px;
                        color: #64748b;
                        margin-bottom: 32px;
                        text-align: center;
                        max-width: 320px;
                    }
                    #elementle-fallback button {
                        background: #3b82f6;
                        color: #fff;
                        border: none;
                        padding: 16px 40px;
                        border-radius: 14px;
                        font-size: 18px;
                        font-weight: 700;
                        cursor: pointer;
                    }
                    #elementle-fallback button:active {
                        background: #2563eb;
                    }
                ` }} />
            </head>
            <body>
                <div dangerouslySetInnerHTML={{
                    __html: `
                    <div id="elementle-fallback">
                        <h2>Elementle</h2>
                        <p>Tap below to open the app and complete your login.</p>
                        <button onclick="if(window.__elementleAppUrl){window.location.href=window.__elementleAppUrl;}">
                            Open App to Complete Login
                        </button>
                    </div>
                ` }} />
                {children}
            </body>
        </html>
    );
}
