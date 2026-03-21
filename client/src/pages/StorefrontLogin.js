import React, { useState, useEffect } from 'react';
import { useStorefront } from '../context/AppContext';
import { useClientConfig } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, User, Lock, Shield, ArrowLeft, Loader2, Flame } from 'lucide-react';

const StorefrontLogin = () => {
  const { login } = useStorefront();
  const { brandName } = useClientConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('LOGIN'); // LOGIN | SIGNUP | ADMIN

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'admin') setMode('ADMIN');
  }, [location.search]);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (mode === 'ADMIN') {
        await login('admin', adminUser, adminPass);
        navigate('/admin');
      } else if (mode === 'LOGIN') {
        await login('customer', email, password);
        navigate('/');
      } else {
        await login('signup', email, password, name);
        navigate('/profile');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
            {mode === 'ADMIN' ? <Shield size={100} /> : <User size={100} />}
          </div>

          <div className="text-center space-y-1 relative z-10">
            <h2 className="text-3xl font-display font-bold text-white">
              {mode === 'LOGIN' ? 'WELCOME BACK' : mode === 'SIGNUP' ? 'JOIN THE FAMILY' : 'STAFF ACCESS'}
            </h2>
            <p className="text-gray-400 text-sm">
              {mode === 'LOGIN' ? 'Login to view your orders and rewards.' :
                mode === 'SIGNUP' ? 'Create an account to order and earn stamps.' :
                  'Secure area for authorised personnel only.'}
            </p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 p-3 rounded-lg text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {mode === 'ADMIN' ? (
            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
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
              <button type="button" onClick={() => setMode('LOGIN')}
                className="w-full text-gray-400 hover:text-white text-sm flex items-center justify-center gap-2 transition">
                <ArrowLeft size={14} /> Back to Customer Login
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                {mode === 'SIGNUP' && (
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 text-gray-500" size={18} />
                    <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none transition" />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-gray-500" size={18} />
                  <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none transition" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-gray-500" size={18} />
                  <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none transition" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-400">
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                      className="rounded bg-gray-800 border-gray-700" />
                    Remember me
                  </label>
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full bg-gradient-to-r from-bbq-red to-red-800 text-white py-4 rounded-lg font-bold hover:shadow-[0_0_20px_rgba(217,56,30,0.4)] transition-all shadow-xl flex justify-center items-center gap-2">
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'LOGIN' ? 'Login' : 'Create Account')}
                </button>
              </form>

              <div className="text-center text-sm text-gray-400 relative z-10">
                {mode === 'LOGIN' ? (
                  <>Don't have an account? <button onClick={() => { setMode('SIGNUP'); setError(''); }} className="text-white font-bold hover:underline">Sign up</button></>
                ) : (
                  <>Already have an account? <button onClick={() => { setMode('LOGIN'); setError(''); }} className="text-white font-bold hover:underline">Log in</button></>
                )}
              </div>

              <div className="pt-4 border-t border-gray-800 text-center relative z-10">
                <button onClick={() => { setMode('ADMIN'); setError(''); }} className="text-xs text-gray-600 hover:text-gray-400 font-mono transition">
                  [Staff / Admin Access]
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorefrontLogin;
