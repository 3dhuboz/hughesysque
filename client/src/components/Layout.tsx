
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Link, useLocation } from 'react-router-dom';
import { Flame, UtensilsCrossed, CalendarDays, User as UserIcon, LogOut, LayoutDashboard, Facebook, Instagram, Mail, MapPin, Phone, Image as ImageIcon, Gift, AlertTriangle, Radio, Music2, ExternalLink } from 'lucide-react';
import InstallPwa from './InstallPwa';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, cart, settings, connectionError } = useApp();
  const location = useLocation();
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
      setLogoError(false);
  }, [settings.logoUrl]);

  const isActive = (path: string) => location.pathname === path ? 'text-bbq-ember' : 'text-gray-400 hover:text-white';

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <Link to={to} className={`flex flex-col items-center justify-center space-y-1 ${isActive(to)} transition-colors duration-300`}>
      <Icon size={22} strokeWidth={1.5} />
      <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0 relative overflow-x-hidden bg-[#0a0a0a]">

      {/* Subtle ambient glow — very faint */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_800px_400px_at_50%_100%,_rgba(180,40,10,0.06)_0%,_transparent_70%)]" />
      </div>

      {/* CONNECTION ERROR BANNER */}
      {connectionError && (
          <div className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white text-xs font-bold p-2 text-center flex items-center justify-center gap-2 animate-in slide-in-from-top">
              <AlertTriangle size={14}/>
              <span>System Alert: {connectionError}</span>
              {user?.role === 'ADMIN' && (
                  <Link to="/admin" className="underline ml-2 bg-white text-red-600 px-2 rounded">Go to Diagnostics</Link>
              )}
          </div>
      )}

      {/* Desktop Header */}
      <header className={`hidden md:flex items-center justify-between px-8 py-4 fixed top-0 left-0 right-0 z-50 glass transition-all duration-300 ${connectionError ? 'mt-8' : ''}`} style={{ zIndex: 50 }}>
        <Link to="/" className="flex items-center gap-3 group">
          {settings?.logoUrl && !logoError ? (
             <div className="w-14 h-14 flex items-center justify-center overflow-visible transition-transform duration-500 hover:scale-105">
                <img
                    src={settings.logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain drop-shadow-md"
                    onError={() => setLogoError(true)}
                />
             </div>
          ) : (
             <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center overflow-hidden border-2 border-bbq-red group-hover:border-bbq-gold transition-colors duration-500 shadow-lg shadow-red-900/20">
                <Flame className="text-bbq-red" size={24} />
             </div>
          )}
          <div className="flex flex-col">
            <h1 className="text-2xl font-display font-bold text-white tracking-wider uppercase leading-none group-hover:text-bbq-red transition-colors">
              {settings?.businessName || 'Hughesys Que'}
            </h1>
            <span className="text-xs text-bbq-gold font-bold tracking-[0.2em] uppercase">
              {settings?.tagline || 'Low & Slow BBQ'}
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-8 bg-black/40 px-8 py-3 rounded-full border border-white/5 backdrop-blur-md">
          <Link to="/" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/')}`}>Home</Link>
          <Link to="/menu" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/menu')}`}>Menu</Link>
          <Link to="/catering" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/catering')}`}>Catering</Link>
          <Link to="/gallery" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/gallery')}`}>Gallery</Link>
          <Link to="/live" className={`font-bold text-sm tracking-widest uppercase transition flex items-center gap-1 ${isActive('/live')}`}>
            <Radio size={14} className={location.pathname === '/live' ? 'text-bbq-ember' : 'text-red-500'} /> Live
          </Link>
          <Link to="/rewards" className={`font-bold text-sm tracking-widest uppercase transition flex items-center gap-1 ${isActive('/rewards')}`}>
             <Gift size={14} className={location.pathname === '/rewards' ? 'text-bbq-ember' : 'text-bbq-gold'} /> Rewards
          </Link>
          <Link to="/contact" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/contact')}`}>Contact</Link>
          {(user?.role === 'ADMIN' || user?.role === 'DEV') ? (
             <Link to="/admin" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/admin')}`}>Dashboard</Link>
          ) : (
             <Link to="/order" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/order')}`}>Order</Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <InstallPwa />
          {user ? (
            <div className="flex items-center gap-4">
              <Link to="/profile" className="flex items-center gap-2 hover:bg-white/5 p-2 rounded-lg transition">
                  <div className="text-right hidden lg:block">
                      <p className="text-xs text-gray-400">Welcome,</p>
                      <p className="text-sm font-bold text-bbq-gold leading-none">{user.name.split(' ')[0]}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                      <UserIcon size={16} />
                  </div>
              </Link>
              <button onClick={logout} className="p-2 hover:text-red-500 transition" title="Logout"><LogOut size={20}/></button>
            </div>
          ) : (
            <Link to="/login" className="px-6 py-2 bg-gradient-to-r from-red-700 to-bbq-red text-white text-sm font-bold uppercase tracking-wider rounded-full hover:shadow-lg hover:shadow-red-900/40 transition-all duration-300 transform hover:-translate-y-0.5">
                Login
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Header */}
      <header className={`md:hidden flex items-center justify-between p-4 fixed top-0 w-full z-50 glass ${connectionError ? 'mt-8' : ''}`}>
         <Link to="/" className="flex items-center gap-2">
            {settings?.logoUrl && !logoError ? (
               <div className="w-10 h-10 flex items-center justify-center overflow-visible">
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain"
                    onError={() => setLogoError(true)}
                  />
               </div>
            ) : (
               <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center overflow-hidden border border-bbq-red">
                  <Flame className="text-bbq-red" size={20} />
               </div>
            )}
            <h1 className="text-lg font-display font-bold text-white uppercase tracking-tight">
              {settings?.businessName || 'Hughesys Que'}
            </h1>
        </Link>
        <div className="flex items-center gap-3">
             <InstallPwa />
             {cart.length > 0 && (
                <Link to="/order" className="bg-bbq-red text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                    {cart.length} <UtensilsCrossed size={12}/>
                </Link>
             )}
             {user && (
                 <button onClick={logout} className="text-gray-400 hover:text-white"><LogOut size={20}/></button>
             )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 w-full relative z-10 ${location.pathname === '/' ? 'pt-0' : 'max-w-7xl mx-auto p-4 md:p-8 pt-24 md:pt-32'} ${connectionError ? 'mt-8' : ''}`}>
        {children}
      </main>

      {/* Footer — Smoldering Coal Bed */}
      <footer className="relative overflow-hidden">
        {/* Ember particles rising from footer */}
        <div className="absolute inset-0 pointer-events-none z-20">
          <div className="ember ember-1" />
          <div className="ember ember-2" />
          <div className="ember ember-3" />
          <div className="ember ember-4" />
          <div className="ember ember-5" />
          <div className="ember ember-6" />
          <div className="ember ember-7" />
          <div className="ember ember-8" />
        </div>

        {/* Coal bed glow layers */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a0500] via-[#0d0200] to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-[radial-gradient(ellipse_120%_80px_at_50%_100%,_rgba(200,50,10,0.25)_0%,_transparent_70%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-[radial-gradient(ellipse_80%_60px_at_30%_100%,_rgba(255,80,10,0.15)_0%,_transparent_60%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-[radial-gradient(ellipse_60%_40px_at_70%_100%,_rgba(255,120,20,0.12)_0%,_transparent_50%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-[radial-gradient(ellipse_40%_30px_at_50%_100%,_rgba(255,160,40,0.1)_0%,_transparent_40%)] animate-pulse" />
          {/* Shimmer heat haze */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent" />
        </div>

        {/* Border glow line at top of footer */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-800/40 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-red-900/10 to-transparent pointer-events-none" />

        <div className="relative z-10 pt-16 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="space-y-4">
               <div className="w-16 h-16 flex items-center justify-center overflow-visible">
                   {settings?.logoUrl && !logoError ? (
                      <img
                          src={settings.logoUrl}
                          alt={settings?.businessName || 'Hughesys Que'}
                          className="w-full h-full object-contain drop-shadow-2xl"
                          onError={() => setLogoError(true)}
                      />
                   ) : (
                      <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center overflow-hidden border-2 border-bbq-red shadow-2xl">
                         <Flame className="text-bbq-red" size={32} />
                      </div>
                   )}
               </div>
               <h3 className="font-display font-bold text-2xl tracking-wide uppercase text-white">
                 {settings?.businessName || 'Hughesys Que'}
               </h3>
               <p className="text-gray-500 text-sm leading-relaxed">
                 {settings?.tagline || 'Low & Slow BBQ — Authentic smoked meats for every occasion.'}
               </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-bold text-bbq-gold uppercase tracking-widest text-xs mb-6">Explore</h4>
              <ul className="space-y-3 text-gray-400 text-sm font-medium">
                <li><Link to="/" className="hover:text-white hover:translate-x-1 transition-all inline-block">Home</Link></li>
                <li><Link to="/menu" className="hover:text-white hover:translate-x-1 transition-all inline-block">Full Menu</Link></li>
                <li><Link to="/rewards" className="hover:text-white hover:translate-x-1 transition-all inline-block">Rewards Club</Link></li>
                <li><Link to="/gallery" className="hover:text-white hover:translate-x-1 transition-all inline-block">Gallery</Link></li>
                <li><Link to="/live" className="hover:text-white hover:translate-x-1 transition-all inline-block">Live Stream</Link></li>
                <li><Link to="/contact" className="hover:text-white hover:translate-x-1 transition-all inline-block">Contact</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-bbq-gold uppercase tracking-widest text-xs mb-6">Contact</h4>
              <ul className="space-y-4 text-gray-400 text-sm">
                <li className="flex items-start gap-3 group">
                  <MapPin size={18} className="text-bbq-red shrink-0 group-hover:animate-bounce" />
                  <span>{settings?.location || 'Yeppoon, QLD'}<br/><span className="text-xs text-gray-600">(Check socials for truck location)</span></span>
                </li>
                {settings?.phone && (
                  <li className="flex items-center gap-3">
                    <Phone size={18} className="text-bbq-red shrink-0" />
                    <a href={`tel:${settings.phone}`} className="hover:text-white transition">{settings.phone}</a>
                  </li>
                )}
                <li className="flex items-center gap-3">
                  <Mail size={18} className="text-bbq-red shrink-0" />
                  <a href={`mailto:${settings?.contactEmail || settings?.adminEmail || 'hugheseysbbq2021@gmail.com'}`} className="hover:text-white transition">
                    {settings?.contactEmail || settings?.adminEmail || 'hugheseysbbq2021@gmail.com'}
                  </a>
                </li>
              </ul>
            </div>

            {/* Socials */}
            <div>
              <h4 className="font-bold text-bbq-gold uppercase tracking-widest text-xs mb-6">Community</h4>
              <div className="flex gap-4">
                {settings?.facebookUrl && (
                  <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer" className="bg-white/5 p-3 rounded-xl hover:bg-[#1877F2] transition text-white border border-white/10">
                    <Facebook size={20} />
                  </a>
                )}
                {settings?.instagramUrl && (
                  <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="bg-white/5 p-3 rounded-xl hover:bg-gradient-to-tr hover:from-yellow-500 hover:to-purple-600 transition text-white border border-white/10">
                    <Instagram size={20} />
                  </a>
                )}
                {settings?.tiktokUrl && (
                  <a href={settings.tiktokUrl} target="_blank" rel="noopener noreferrer" className="bg-white/5 p-3 rounded-xl hover:bg-black transition text-white border border-white/10">
                    <Music2 size={20} />
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-8 font-mono">
                © {new Date().getFullYear()} {settings?.businessName || 'Hughesys Que'}.<br/>All rights reserved.
              </p>
              <a
                href="https://pennywiseit.au"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-bbq-gold transition mt-3 font-sans"
              >
                Powered by PennyWise I.T <ExternalLink size={8} />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full glass border-t border-white/10 flex justify-around py-4 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <NavItem to="/" icon={Flame} label="Home" />
        <NavItem to="/menu" icon={UtensilsCrossed} label="Menu" />
        <NavItem to="/gallery" icon={ImageIcon} label="Pics" />
        {(user?.role === 'ADMIN' || user?.role === 'DEV') ? (
          <NavItem to="/admin" icon={LayoutDashboard} label="Admin" />
        ) : (
          <NavItem to="/order" icon={CalendarDays} label="Order" />
        )}
        {user ? (
             <NavItem to="/profile" icon={UserIcon} label="Profile" />
        ) : (
             <NavItem to="/login" icon={UserIcon} label="Login" />
        )}
      </nav>
    </div>
  );
};

export default Layout;
