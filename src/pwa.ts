/** Registers the offline service worker on the web only (not inside the Android/iOS/desktop apps). */
export function registerServiceWorker() {
  const w = window as unknown as { Capacitor?: unknown; __TAURI_INTERNALS__?: unknown }
  const isNative = Boolean(w.Capacitor || w.__TAURI_INTERNALS__)
  if (isNative || !('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return
  if (import.meta.env.DEV) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline mode unavailable; the app still works online */
    })
  })
}
