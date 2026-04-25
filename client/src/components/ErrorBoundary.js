import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);

    // Auto-recover from stale-chunk errors that happen after deploys.
    // Root cause: a previously-cached index.html references chunk hashes
    // that no longer exist on the server. Fix: nuke every cache we control
    // (service worker, Cache API, HTTP cache via reload) and reload fresh.
    const isChunkError = this.isChunkError(error);
    this.setState({ isChunkError });
    if (!isChunkError) return;

    // Counter is per-deploy: reset whenever the live build id differs
    // from the one we last reloaded against. That way each new deploy gets a
    // fresh budget of retries instead of being stuck at "give up" because the
    // user already burned through retries on previous deploys today.
    //
    // Source priority:
    //   1. import.meta.env.VITE_BUILD_ID — injected at build time via vite.config
    //      (GITHUB_SHA in CI, Date.now() locally). Stable, doesn't depend on
    //      Vite's chunk-naming conventions.
    //   2. <script type=module src*="index-"> DOM scrape — only used as a
    //      dev-mode fallback when the constant is undefined (no build step).
    //      Audit flagged this scrape as brittle if Vite changes chunk names.
    const deployKey =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BUILD_ID)
      || document.querySelector('script[type=module][src*="index-"]')?.getAttribute('src')
      || 'unknown';
    const lastDeployKey = sessionStorage.getItem('hq_chunk_deploy_key');
    if (lastDeployKey !== deployKey) {
      sessionStorage.setItem('hq_chunk_deploy_key', deployKey);
      sessionStorage.removeItem('hq_chunk_reload_count');
    }

    const reloadKey = 'hq_chunk_reload_count';
    const count = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
    if (count >= 3) return; // Per-deploy: 3 tries before falling through to manual
    sessionStorage.setItem(reloadKey, String(count + 1));

    this.cleanupAndReload();
  }

  isChunkError(error) {
    const msg = error?.message || '';
    return (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Loading CSS chunk') ||
      msg.includes('Importing a module script failed')
    );
  }

  cleanupAndReload = async () => {
    // Reset the per-deploy retry counter on manual click — user is explicitly
    // asking us to try again, don't penalise them for prior auto-retries.
    sessionStorage.removeItem('hq_chunk_reload_count');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) {
      console.warn('[ErrorBoundary] cleanup failed', e);
    } finally {
      // Hard reload — bypass HTTP cache so we fetch a fresh index.html
      window.location.reload();
    }
  };

  componentDidMount() {
    // Successful mount — clear the reload counter so a future genuine error
    // isn't suppressed because we happened to hit retries earlier.
    sessionStorage.removeItem('hq_chunk_reload_count');
  }

  render() {
    if (this.state.hasError) {
      const chunk = this.state.isChunkError;
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0a1a', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', padding: '2rem'
        }}>
          <div style={{ maxWidth: 600, textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#ef4444' }}>
              {chunk ? 'New version available' : 'Something went wrong'}
            </h1>
            <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
              {chunk
                ? "The site was just updated and your browser still has the old version cached. Click below to clear it out and load the latest."
                : "The page encountered an error. Try refreshing or going back to the home page."}
            </p>
            {!chunk && (
              <div style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '1rem', textAlign: 'left', marginBottom: '1.5rem',
                fontSize: '0.8125rem', color: '#f87171', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                maxHeight: 200, overflow: 'auto'
              }}>
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack && (
                  <div style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.75rem' }}>
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={chunk ? this.cleanupAndReload : () => window.location.reload()}
                style={{
                  background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8,
                  padding: '0.625rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem'
                }}
              >
                {chunk ? 'Load Latest Version' : 'Refresh Page'}
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                style={{
                  background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8, padding: '0.625rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem'
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
