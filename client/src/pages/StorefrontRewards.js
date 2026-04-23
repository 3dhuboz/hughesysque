import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStorefront } from '../context/AppContext';
import { Gift, Mail, Phone, User as UserIcon, LogOut, Sparkles, Flame, ArrowRight, Check, Loader2 } from 'lucide-react';

/**
 * Customer-facing rewards page. Shows loyalty progress, current discount
 * status, and lets the customer edit their name/phone for prefill at
 * checkout. Signed-out visitors get a sign-in CTA instead of a redirect —
 * less jarring than a Navigate.
 */
const StorefrontRewards = () => {
  const { user, loyalty, logout, updateCustomerProfile, refreshCustomer } = useStorefront();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  // Pull fresh loyalty state on mount — spend may have changed since the
  // last hydration if the customer just placed an order.
  useEffect(() => {
    if (user?.role === 'CUSTOMER') refreshCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
  }, [user?.email, user?.name, user?.phone]);

  if (!user || user.role !== 'CUSTOMER') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
        <div className="bg-bbq-charcoal border border-gray-800 rounded-2xl shadow-2xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-bbq-gold/10 border border-bbq-gold/40 flex items-center justify-center mx-auto mb-4">
            <Gift size={32} className="text-bbq-gold"/>
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2 uppercase">Loyalty Rewards</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Sign in to track your catering spend and unlock the loyalty discount on your next order.
            No password — we'll just email you a sign-in link.
          </p>
          <Link to="/login"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-bbq-red to-red-800 text-white font-bold px-6 py-3 rounded-lg hover:shadow-[0_0_20px_rgba(217,56,30,0.4)] transition uppercase tracking-widest text-sm">
            Sign in <ArrowRight size={16}/>
          </Link>
        </div>
      </div>
    );
  }

  const threshold = loyalty?.thresholdAmount ?? 1000;
  const percent = loyalty?.discountPercent ?? 10;
  const eligible = loyalty?.eligible ?? false;
  // remainingToThreshold from server is authoritative; spend is implied (threshold - remaining).
  const remaining = loyalty?.remainingToThreshold ?? threshold;
  const spend = Math.max(0, threshold - remaining);
  const progressPct = Math.min(100, (spend / threshold) * 100);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateCustomerProfile({ name: name.trim(), phone: phone.trim() });
      setSavedAt(Date.now());
    } finally { setIsSaving(false); }
  };

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-8 animate-fade-in">
      {/* HEADER */}
      <div className="text-center pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bbq-gold/10 border border-bbq-gold/30 text-bbq-gold text-xs font-bold uppercase tracking-widest mb-3">
          <Gift size={12}/> My Rewards
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-white uppercase tracking-tight">
          Hey {(user.name || user.email.split('@')[0]).split(' ')[0]}
        </h1>
        <p className="text-gray-400 text-sm mt-2">Signed in as <span className="text-bbq-gold">{user.email}</span></p>
      </div>

      {/* LOYALTY PROGRESS CARD */}
      <div className={`relative overflow-hidden rounded-2xl p-6 md:p-8 border ${eligible ? 'border-bbq-gold/60 bg-gradient-to-br from-yellow-900/40 via-bbq-charcoal to-yellow-900/30 shadow-[0_0_40px_rgba(251,191,36,0.2)]' : 'border-gray-800 bg-bbq-charcoal'}`}>
        <div aria-hidden className={`absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl pointer-events-none ${eligible ? 'bg-bbq-gold/20' : 'bg-bbq-red/10'}`}/>
        <div className="relative">
          {eligible ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="text-bbq-gold" size={18}/>
                <span className="text-xs font-bold text-bbq-gold uppercase tracking-widest">Loyalty unlocked</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white leading-tight">
                {percent}% OFF your next order
              </h2>
              <p className="text-gray-300 mt-3 leading-relaxed">
                Discount applies automatically at checkout. Lifetime catering spend: <strong className="text-bbq-gold">${spend.toFixed(2)}</strong>.
              </p>
              <Link to="/order"
                className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-bbq-gold to-yellow-600 text-black font-bold px-5 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition uppercase tracking-widest text-sm">
                Order now <ArrowRight size={16}/>
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="text-bbq-red" size={18}/>
                <span className="text-xs font-bold text-bbq-red uppercase tracking-widest">Rewards Progress</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white leading-tight">
                ${remaining.toFixed(2)} more on catering = <span className="text-bbq-gold">{percent}% off</span>
              </h2>
              <p className="text-gray-400 text-sm mt-2">Lifetime catering spend: <strong className="text-white">${spend.toFixed(2)}</strong> of ${threshold.toFixed(2)}</p>
              <div className="mt-5 h-3 rounded-full bg-gray-900 overflow-hidden border border-gray-800">
                <div className="h-full bg-gradient-to-r from-bbq-red via-orange-500 to-bbq-gold transition-all duration-700"
                  style={{ width: `${progressPct}%` }}/>
              </div>
              <Link to="/catering"
                className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-bbq-red to-red-800 text-white font-bold px-5 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(217,56,30,0.4)] transition uppercase tracking-widest text-sm">
                Browse catering <ArrowRight size={16}/>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* PROFILE EDITOR */}
      <form onSubmit={handleSave} className="bg-bbq-charcoal border border-gray-800 rounded-2xl p-6 md:p-7 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-bbq-gold flex items-center gap-2">
            <UserIcon size={14}/> Your Details
          </h3>
          <span className="text-[11px] text-gray-500">Used to prefill your next order.</span>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Name</label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-3 text-gray-500" size={16}/>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:border-bbq-gold focus:outline-none transition"/>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Phone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 text-gray-500" size={16}/>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="04xx xxx xxx"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:border-bbq-gold focus:outline-none transition"/>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email <span className="text-gray-600 font-normal normal-case">(can't be changed here)</span></label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-500" size={16}/>
            <input type="email" value={user.email} disabled
              className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-2.5 text-gray-500 text-sm cursor-not-allowed"/>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button type="submit" disabled={isSaving}
            className="bg-gradient-to-r from-bbq-red to-red-800 text-white font-bold px-5 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(217,56,30,0.4)] transition uppercase tracking-widest text-xs flex items-center gap-2 disabled:opacity-50">
            {isSaving ? <Loader2 className="animate-spin" size={14}/> : <Check size={14}/>}
            Save details
          </button>
          {Date.now() - savedAt < 3000 && savedAt > 0 && (
            <span className="text-xs text-green-400 flex items-center gap-1 animate-fade-in"><Check size={12}/> Saved</span>
          )}
        </div>
      </form>

      {/* SIGN OUT */}
      <div className="text-center">
        <button onClick={logout}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest transition">
          <LogOut size={14}/> Sign out
        </button>
      </div>
    </div>
  );
};

export default StorefrontRewards;
