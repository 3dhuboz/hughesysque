import React, { useEffect, useRef, useState } from 'react';
import { useStorefront } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Magic-link landing page. The sign-in email points at /auth/callback?token=...;
 * we read the token from the URL, exchange it for a customer session via
 * /auth/customer-magic-link-verify, store the session, and bounce to /rewards.
 *
 * (Pre-2026-04-26 emails used the HashRouter format /#/auth/callback?token=...;
 * the bootstrap shim in client/index.html catches those and redirects to the
 * new path before React boots. The token-from-hash fallback below is a
 * belt-and-braces second line of defence.)
 *
 * Status states: VERIFYING → SUCCESS (auto-redirect) | ERROR (manual retry).
 *
 * IMPORTANT: the verify call must run EXACTLY ONCE per mount. Magic links
 * are one-shot — the second call sees consumed_at != null and 400s. Two
 * gotchas can re-trigger it:
 *   1. React StrictMode double-invokes effects in dev.
 *   2. AppContext re-renders churn the `completeCustomerSignIn` reference,
 *      so any deps array including it would re-fire the effect.
 * The didRun ref guards against both — a second invocation no-ops.
 */
const AuthCallback = () => {
  const { completeCustomerSignIn } = useStorefront();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('VERIFYING');
  const [errorMsg, setErrorMsg] = useState('');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    // HashRouter puts the query string after the #/path?, so location.search
    // is what we want. But guard against the rare case where it's part of
    // the hash fragment instead.
    const params = new URLSearchParams(location.search || (window.location.hash.split('?')[1] || ''));
    const token = params.get('token');
    if (!token) {
      setStatus('ERROR');
      setErrorMsg('Sign-in link is missing its token. Request a fresh link.');
      return;
    }

    (async () => {
      try {
        await completeCustomerSignIn(token);
        setStatus('SUCCESS');
        // Brief pause so the user sees the success state, then redirect.
        setTimeout(() => navigate('/rewards', { replace: true }), 1200);
      } catch (err) {
        setStatus('ERROR');
        setErrorMsg(err?.message || 'Sign-in failed. The link may have expired or been used already.');
      }
    })();
    // Empty deps + didRun ref = strictly one execution per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="bg-bbq-charcoal border border-gray-800 rounded-2xl shadow-2xl p-8 text-center max-w-md w-full">
        {status === 'VERIFYING' && (
          <>
            <Loader2 className="animate-spin text-bbq-red mx-auto mb-4" size={48}/>
            <h2 className="text-2xl font-display font-bold text-white mb-1">Signing you in…</h2>
            <p className="text-gray-400 text-sm">Just a sec while we verify your link.</p>
          </>
        )}
        {status === 'SUCCESS' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="text-green-400" size={32}/>
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-1">You're in</h2>
            <p className="text-gray-400 text-sm">Taking you to your rewards…</p>
          </>
        )}
        {status === 'ERROR' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-400" size={32}/>
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Sign-in failed</h2>
            <p className="text-gray-400 text-sm mb-6">{errorMsg}</p>
            <button onClick={() => navigate('/login', { replace: true })}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-bbq-red to-red-800 text-white font-bold px-5 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(217,56,30,0.4)] transition uppercase tracking-widest text-sm">
              Request a new link <ArrowRight size={16}/>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
