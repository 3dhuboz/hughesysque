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
    const isChunkError = error?.message?.includes('Failed to fetch dynamically imported module') ||
                         error?.message?.includes('Loading chunk') ||
                         error?.message?.includes('Loading CSS chunk') ||
                         error?.message?.includes('Importing a module script failed');
    if (!isChunkError) return;

    const reloadKey = 'hq_chunk_reload_count';
    const count = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
    if (count >= 2) return; // Give up after 2 tries so we don't loop forever
    sessionStorage.setItem(reloadKey, String(count + 1));

    const cleanup = async () => {
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
    cleanup();
  }

  componentDidMount() {
    // Successful mount — clear the reload counter so a future genuine error
    // isn't suppressed because we happened to hit 2 reloads earlier.
    sessionStorage.removeItem('hq_chunk_reload_count');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0a1a', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', padding: '2rem'
        }}>
          <div style={{ maxWidth: 600, textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#ef4444' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
              The page encountered an error. Try refreshing or going back to the home page.
            </p>
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
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8,
                  padding: '0.625rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem'
                }}
              >
                Refresh Page
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
