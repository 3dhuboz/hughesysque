import React, { useState } from 'react';
import { ShieldAlert, Lock, Save, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Fullscreen intercept shown after login when the server flags
 * mustChangePassword=true (i.e. Macca just authenticated with the
 * legacy default '123'). No dismissing, no shortcuts — the only way
 * past this screen is to set a real password.
 */
const ForcedPasswordChange: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const meetsRules = newPassword.length >= 8;
  const matches = newPassword === confirmPassword && newPassword.length > 0;
  const differentFromOld = newPassword !== currentPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!meetsRules) return setError('Password must be at least 8 characters.');
    if (!matches) return setError("Passwords don't match.");
    if (!differentFromOld) return setError('New password must be different from the current one.');

    setIsSaving(true);
    try {
      const res = await fetch('/api/v1/auth/admin-change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('hq_admin_token') ? { Authorization: `Bearer ${localStorage.getItem('hq_admin_token')}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Change failed');
      setDone(true);
      setTimeout(onComplete, 1500);
    } catch (err: any) {
      setError(err.message || 'Change failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 animate-in fade-in">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="text-green-400" size={40}/>
          </div>
          <h2 className="text-2xl font-display font-bold text-white">Password updated</h2>
          <p className="text-gray-400">Taking you to the dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-md w-full bg-bbq-charcoal border border-red-800/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-gradient-to-br from-red-950/70 to-orange-950/40 p-6 border-b border-red-800/30 flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-900/40 border border-red-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="text-red-400" size={24}/>
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-white">Set a new password</h2>
            <p className="text-sm text-gray-400 mt-1">
              You're still on the default admin password. Before you can use the dashboard, please pick a new one — at least 8 characters.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Current password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-500" size={14}/>
              <input type="password" autoComplete="current-password"
                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                className="w-full bg-black/60 border border-gray-700 focus:border-bbq-red rounded-lg p-2.5 pl-9 text-white transition"/>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">New password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-bbq-gold" size={14}/>
              <input type="password" autoComplete="new-password" minLength={8}
                value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                className="w-full bg-black/60 border border-gray-700 focus:border-bbq-gold rounded-lg p-2.5 pl-9 text-white transition"/>
            </div>
            <p className={`text-[11px] mt-1 ${meetsRules ? 'text-green-400' : 'text-gray-500'}`}>
              {meetsRules ? '✓ Meets the 8-character minimum' : '• At least 8 characters'}
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Confirm new password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-bbq-red" size={14}/>
              <input type="password" autoComplete="new-password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                className={`w-full bg-black/60 border rounded-lg p-2.5 pl-9 text-white transition ${
                  confirmPassword.length === 0 ? 'border-gray-700 focus:border-bbq-red'
                    : matches ? 'border-green-700' : 'border-red-700'}`}/>
            </div>
            {confirmPassword.length > 0 && !matches && <p className="text-[11px] mt-1 text-red-400">Passwords don't match</p>}
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-200 text-sm p-2.5 rounded-lg">{error}</div>
          )}

          <button type="submit" disabled={isSaving || !meetsRules || !matches || !differentFromOld || !currentPassword}
            className="w-full py-3 bg-gradient-to-r from-bbq-red via-red-600 to-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_24px_rgba(239,68,68,0.5)] transition-all">
            {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
            Save & continue
          </button>

          <p className="text-[10px] text-gray-600 text-center">This screen won't appear again once you set a strong password.</p>
        </form>
      </div>
    </div>
  );
};

export default ForcedPasswordChange;
