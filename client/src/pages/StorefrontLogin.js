import React, { useState } from 'react';
import { useStorefront } from '../context/AppContext';
import { useClientConfig } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Mail, User, Lock, Shield, ArrowLeft, Loader2, Flame, KeyRound, CheckCircle2, Send } from 'lucide-react';

// Two flows live on /login:
//   1. CUSTOMER (default) — email-only magic-link sign-in. No password ever.
//      Used by anyone wanting to track stamps / get the auto loyalty discount.
//   2. ADMIN — username + password for Macca/staff. Discreet entry point at
//      the bottom of the customer card; not advertised to customers.
//
// Modes:
//   CUSTOMER, CUSTOMER_LINK_SENT,
//   ADMIN, ADMIN_RESET_REQUEST, ADMIN_RESET_CONFIRM
const StorefrontLogin = () => {
  const { login, requestCustomerSignIn } = useStorefront();
  const { brandName } = useClientConfig();
  const navigate = useNavigate();
  const [mode, setMode] = useState('CUSTOMER');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [error, setError] = useState('');

  const requestReset = async (e) => {
    e.preventDefault();
    setIsLoading(true); setError('');
    try {
      const res = await fetch('/api/v1/auth/admin-reset-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      if (!res.ok) throw new Error('Could not send reset email');
      setResetSent(true);
      setMode('ADMIN_RESET_CONFIRM');
    } catch (err) {
      setError(err.message || 'Reset request failed');
    } finally { setIsLoading(false); }
  };

  const confirmReset = async (e) => {
    e.preventDefault();
    setIsLoading(true); setError('');
    try {
      const res = await fetch('/api/v1/auth/admin-reset-confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: resetCode, newPassword: resetNewPass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not reset password');
      setResetComplete(true);
      setTimeout(() => {
        setMode('ADMIN');
        setResetCode(''); setResetNewPass(''); setResetEmail('');
        setResetSent(false); setResetComplete(false);
      }, 2500);
    } catch (err) {
      setError(err.message || 'Reset failed');
    } finally { setIsLoading(false); }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); setError('');
    try {
      await login('admin', adminUser, adminPass);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally { setIsLoading(false); }
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); setError('');
    try {
      await requestCustomerSignIn(customerEmail);
      setMode('CUSTOMER_LINK_SENT');
    } catch (err) {
      setError(err.message || 'Could not send sign-in link');
    } finally { setIsLoading(false); }
  };

  const isAdminFlow = mode.startsWith('ADMIN');

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center overflow-hidden border-2 border-bbq-red shadow-2xl shadow-red-900/30 mx-auto mb-4">
            <Flame className="text-bbq-red" size={32} />
          </div>
          <h1 className="text-4xl font-display font-bold text-white uppercase tracking-tight">{brandName}</h1>
        </div>

        <div className="bg-bbq-charcoal rounded-2xl shadow-2xl border border-gray-800 p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            {isAdminFlow ? <Shield size={100} /> : <User size={100} />}
          </div>

          <div className="text-center space-y-1 relative z-10">
            <h2 className="text-3xl font-display font-bold text-white">
              {mode === 'CUSTOMER' ? 'SIGN IN'
                : mode === 'CUSTOMER_LINK_SENT' ? 'CHECK YOUR INBOX'
                : mode === 'ADMIN_RESET_REQUEST' ? 'RESET PASSWORD'
                : mode === 'ADMIN_RESET_CONFIRM' ? 'ENTER CODE'
                : 'STAFF ACCESS'}
            </h2>
            <p className="text-gray-400 text-sm">
              {mode === 'CUSTOMER' ? 'Sign in to track your stamps and unlock the loyalty discount on your next order.'
                : mode === 'CUSTOMER_LINK_SENT' ? "We just emailed you a sign-in link. Tap it from any device — no password needed."
                : mode === 'ADMIN_RESET_REQUEST' ? "We'll email a 6-digit code to the admin email on file."
                : mode === 'ADMIN_RESET_CONFIRM' ? 'Check the admin email inbox — enter the code and set a new password.'
                : 'Secure area for authorised personnel only.'}
            </p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 p-3 rounded-lg text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {mode === 'CUSTOMER' ? (
            <form onSubmit={handleCustomerSubmit} className="space-y-4 relative z-10">
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-bbq-red" size={18} />
                <input type="email" placeholder="you@email.com" value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)} required autoFocus
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none transition" />
              </div>
              <button type="submit" disabled={isLoading || !customerEmail.trim()}
                className="w-full bg-gradient-to-r from-bbq-red to-red-800 text-white py-3 rounded-lg font-bold hover:shadow-[0_0_20px_rgba(217,56,30,0.4)] transition-all shadow-xl flex justify-center items-center gap-2 disabled:opacity-50">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (<><Send size={16}/> Send sign-in link</>)}
              </button>
              <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                No password needed. We'll email you a one-tap link that expires in 15 minutes.
              </p>
              <div className="pt-4 border-t border-gray-800 text-center">
                <button type="button" onClick={() => { setMode('ADMIN'); setError(''); }}
                  className="text-xs text-gray-600 hover:text-gray-400 font-mono transition">
                  [Staff / Admin Access]
                </button>
              </div>
            </form>
          ) : mode === 'CUSTOMER_LINK_SENT' ? (
            <div className="relative z-10 text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-bbq-red/20 border border-bbq-red flex items-center justify-center mx-auto">
                <Mail className="text-bbq-red" size={32}/>
              </div>
              <div className="space-y-1">
                <p className="text-white font-bold">Sign-in link sent</p>
                <p className="text-sm text-gray-400">If <span className="text-bbq-gold">{customerEmail}</span> matches an account or new sign-up, the link will arrive within a minute.</p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">Check your spam folder if it doesn't arrive — Gmail sometimes hides BBQ emails. The link works on any device, even one you haven't signed in on before.</p>
              <button type="button" onClick={() => { setMode('CUSTOMER'); setCustomerEmail(''); setError(''); }}
                className="w-full text-gray-400 hover:text-white text-xs flex items-center justify-center gap-2 transition">
                <ArrowLeft size={12} /> Use a different email
              </button>
            </div>
          ) : mode === 'ADMIN' ? (
            <form onSubmit={handleAdminSubmit} className="space-y-4 relative z-10">
              <div className="relative">
                <User className="absolute left-3 top-3.5 text-bbq-red" size={18} />
                <input type="text" placeholder="Username" value={adminUser} onChange={e => setAdminUser(e.target.value)} required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none transition" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 text-bbq-red" size={18} />
                <input type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none transition" />
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full bg-bbq-red text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg flex justify-center items-center gap-2">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Access Dashboard'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setMode('CUSTOMER'); setError(''); }}
                  className="text-gray-400 hover:text-white flex items-center gap-1.5 transition">
                  <ArrowLeft size={12} /> Back
                </button>
                <button type="button" onClick={() => { setMode('ADMIN_RESET_REQUEST'); setError(''); }}
                  className="text-bbq-gold hover:text-white flex items-center gap-1.5 transition font-bold">
                  <KeyRound size={12}/> Forgot password?
                </button>
              </div>
            </form>
          ) : mode === 'ADMIN_RESET_REQUEST' ? (
            <form onSubmit={requestReset} className="space-y-4 relative z-10">
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-bbq-gold" size={18} />
                <input type="email" placeholder="Admin email on file" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-gold outline-none transition" />
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full bg-gradient-to-r from-bbq-gold to-yellow-600 text-black py-3 rounded-lg font-bold hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all shadow-xl flex justify-center items-center gap-2">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : (<><KeyRound size={16}/> Send reset code</>)}
              </button>
              <button type="button" onClick={() => { setMode('ADMIN'); setError(''); }}
                className="w-full text-gray-400 hover:text-white text-xs flex items-center justify-center gap-2 transition">
                <ArrowLeft size={12} /> Back to admin login
              </button>
              <p className="text-[11px] text-gray-500 text-center">If the email matches the one on file, you'll get a 6-digit code within a minute.</p>
            </form>
          ) : (
            // ADMIN_RESET_CONFIRM
            resetComplete ? (
              <div className="relative z-10 text-center py-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="text-green-400" size={32}/>
                </div>
                <h3 className="text-xl font-bold text-white">Password updated</h3>
                <p className="text-sm text-gray-400">Taking you back to the login…</p>
              </div>
            ) : (
              <form onSubmit={confirmReset} className="space-y-4 relative z-10">
                {resetSent && (
                  <div className="bg-green-900/20 border border-green-800 text-green-300 text-xs p-3 rounded-lg text-center">
                    ✓ Code sent (if the email matched). Check the inbox.
                  </div>
                )}
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3.5 text-bbq-gold" size={18} />
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                    placeholder="6-digit code" value={resetCode}
                    onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-gold outline-none transition tracking-[0.3em] font-mono" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-bbq-red" size={18} />
                  <input type="password" placeholder="New password (min 8 chars)"
                    value={resetNewPass} onChange={e => setResetNewPass(e.target.value)}
                    required minLength={8}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none transition" />
                </div>
                <button type="submit" disabled={isLoading || resetCode.length !== 6 || resetNewPass.length < 8}
                  className="w-full bg-gradient-to-r from-bbq-red to-red-800 text-white py-3 rounded-lg font-bold hover:shadow-[0_0_20px_rgba(217,56,30,0.4)] transition-all shadow-xl flex justify-center items-center gap-2 disabled:opacity-40">
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Set new password'}
                </button>
                <button type="button" onClick={() => { setMode('ADMIN_RESET_REQUEST'); setError(''); }}
                  className="w-full text-gray-400 hover:text-white text-xs flex items-center justify-center gap-2 transition">
                  <ArrowLeft size={12} /> Didn't get it — resend
                </button>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default StorefrontLogin;
