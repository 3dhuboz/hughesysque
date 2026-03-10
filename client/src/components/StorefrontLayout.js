import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Flame, UtensilsCrossed, CalendarDays, User as UserIcon, LogOut, LayoutDashboard, Facebook, Instagram, Mail, MapPin, Menu as MenuIcon, X, Image as ImageIcon, ShoppingBag } from 'lucide-react';
import { useClientConfig } from '../context/ClientConfigContext';
import { useAuth } from '../context/AuthContext';
import { useStorefront } from '../context/StorefrontContext';

const StorefrontLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { brandName, brandTagline, primaryColor } = useClientConfig();
  const { cart, settings } = useStorefront();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const name = settings.businessName || brandName || 'Hughesys Que';
  const tagline = brandTagline || 'Quality Street Food';
  const logoUrl = settings.logoUrl;

  // Maintenance mode — block all non-admin visitors (but allow /login so admins can sign in)
  if (settings?.maintenanceMode && user?.role !== 'admin' && user?.role !== 'dev' && location.pathname !== '/login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: '#0f0f0f', color: '#e5e5e5' }}>
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-900/30 border-2 border-bbq-red flex items-center justify-center overflow-hidden">
            {logoUrl ? <img src={logoUrl} alt={name} className="w-full h-full object-contain" /> : <Flame size={40} className="text-bbq-red" />}
          </div>
          <h1 className="text-3xl font-display font-bold text-white uppercase tracking-wider">{name}</h1>
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-3">
            <p className="text-bbq-gold font-bold text-lg">We're Firing Up the Pits</p>
            <p className="text-gray-400 text-sm leading-relaxed">We're currently offline for maintenance. Check back soon — the smoke is still rising.</p>
          </div>
          <p className="text-xs text-gray-600">Hungry? Follow us on socials for updates.</p>
          <Link to="/login" className="text-xs text-gray-700 hover:text-gray-500 transition-colors mt-4 inline-block">Admin Login</Link>
        </div>
      </div>
    );
  }

  const isActive = (path) => location.pathname === path ? 'text-bbq-ember' : 'text-gray-400 hover:text-white';

  const NavItem = ({ to, icon: Icon, label }) => (
    <Link to={to} onClick={() => setMobileMenuOpen(false)} className={`flex flex-col items-center justify-center space-y-1 ${isActive(to)} transition-colors duration-300`}>
      <Icon size={22} strokeWidth={1.5} />
      <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0 relative overflow-x-hidden font-sans"
      style={{ backgroundColor: '#0f0f0f', color: '#e5e5e5', backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E\")" }}>

      {/* Desktop Header - Glassmorphism */}
      <header className="hidden md:flex items-center justify-between px-8 py-4 fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{ background: 'rgba(31,31,31,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center overflow-hidden border-2 border-bbq-red group-hover:border-bbq-gold transition-colors duration-500 shadow-lg shadow-red-900/20">
            {logoUrl ? <img src={logoUrl} alt={name} className="w-full h-full object-contain p-1" /> : <Flame className="text-bbq-red" size={24} />}
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-display font-bold text-white tracking-wider uppercase leading-none group-hover:text-bbq-red transition-colors">{name}</h1>
            <span className="text-xs text-bbq-gold font-bold tracking-[0.2em] uppercase">{tagline}</span>
          </div>
        </Link>

        <nav className="flex items-center gap-6 bg-black/40 px-8 py-3 rounded-full border border-white/5 backdrop-blur-md">
          <Link to="/" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/')}`}>Home</Link>
          <Link to="/menu" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/menu')}`}>Menu</Link>
          <Link to="/events" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/events')}`}>Events</Link>
          <Link to="/gallery" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/gallery')}`}>Gallery</Link>
          <Link to="/contact" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/contact')}`}>Contact</Link>
          {(user?.role === 'admin' || user?.role === 'dev') && (
            <Link to="/admin/foodtruck" className={`font-bold text-sm tracking-widest uppercase transition ${isActive('/admin/foodtruck')}`}>Dashboard</Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/storefront-profile" className="flex items-center gap-2 hover:bg-white/5 p-2 rounded-lg transition">
                <div className="text-right hidden lg:block">
                  <p className="text-xs text-gray-400">Welcome,</p>
                  <p className="text-sm font-bold text-bbq-gold leading-none">{user.name?.split(' ')[0]}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-bbq-red to-orange-500 flex items-center justify-center text-white text-sm font-bold border border-gray-700">
                  {(user.name || 'U').charAt(0).toUpperCase()}
                </div>
              </Link>
              {cart.length > 0 && (
                <Link to="/order" className="bg-bbq-red text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-red-700 transition">
                  <ShoppingBag size={14} /> {cart.length}
                </Link>
              )}
              <button onClick={logout} className="p-2 hover:text-red-500 transition" title="Logout"><LogOut size={20} /></button>
            </div>
          ) : (
            <Link to="/login" className="px-6 py-2 bg-gradient-to-r from-red-700 to-bbq-red text-white text-sm font-bold uppercase tracking-wider rounded-full hover:shadow-lg hover:shadow-red-900/40 transition-all duration-300 transform hover:-translate-y-0.5">
              Login
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 fixed top-0 w-full z-50"
        style={{ background: 'rgba(31,31,31,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center overflow-hidden border border-bbq-red">
            {logoUrl ? <img src={logoUrl} alt={name} className="w-full h-full object-contain p-0.5" /> : <Flame className="text-bbq-red" size={20} />}
          </div>
          <h1 className="text-lg font-display font-bold text-white uppercase tracking-tight">{name}</h1>
        </Link>
        <div className="flex items-center gap-3">
          {cart.length > 0 && (
            <Link to="/order" className="bg-bbq-red text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
              {cart.length} <UtensilsCrossed size={12} />
            </Link>
          )}
          {user && (
            <button onClick={logout} className="text-gray-400 hover:text-white"><LogOut size={20} /></button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 pt-24 md:pt-32">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative bg-bbq-charcoal border-t border-white/5 pt-16 pb-24 md:pb-8 mt-12 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-bbq-red/5 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-8 relative z-10 grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center overflow-hidden border-2 border-bbq-red shadow-2xl">
              {logoUrl ? <img src={logoUrl} alt={name} className="w-full h-full object-contain p-1" /> : <Flame className="text-bbq-red" size={32} />}
            </div>
            <h3 className="font-display font-bold text-2xl tracking-wide uppercase text-white">{name}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              {tagline}. Authentic wood-smoked BBQ cooked low and slow.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-bbq-gold uppercase tracking-widest text-xs mb-6">Explore</h4>
            <ul className="space-y-3 text-gray-400 text-sm font-medium">
              <li><Link to="/" className="hover:text-white hover:translate-x-1 transition-all inline-block">Home</Link></li>
              <li><Link to="/menu" className="hover:text-white hover:translate-x-1 transition-all inline-block">Menu</Link></li>
              <li><Link to="/events" className="hover:text-white hover:translate-x-1 transition-all inline-block">Events</Link></li>
              <li><Link to="/gallery" className="hover:text-white hover:translate-x-1 transition-all inline-block">Gallery</Link></li>
              <li><Link to="/rewards" className="hover:text-white hover:translate-x-1 transition-all inline-block">Rewards</Link></li>
              <li><Link to="/contact" className="hover:text-white hover:translate-x-1 transition-all inline-block">Contact</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-bbq-gold uppercase tracking-widest text-xs mb-6">Contact</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li className="flex items-start gap-3 group">
                <MapPin size={18} className="text-bbq-red shrink-0 group-hover:animate-bounce" />
                <span>Queensland, AU<br /><span className="text-xs text-gray-600">(Check socials for truck location)</span></span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-bbq-red shrink-0" />
                <a href="mailto:hugheseysbbq2021@gmail.com" className="hover:text-white transition">hugheseysbbq2021@gmail.com</a>
              </li>
            </ul>
          </div>

          {/* Socials */}
          <div>
            <h4 className="font-bold text-bbq-gold uppercase tracking-widest text-xs mb-6">Community</h4>
            <div className="flex gap-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="bg-white/5 p-3 rounded-xl hover:bg-[#1877F2] transition text-white border border-white/10">
                <Facebook size={20} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="bg-white/5 p-3 rounded-xl hover:bg-gradient-to-tr hover:from-yellow-500 hover:to-purple-600 transition text-white border border-white/10">
                <Instagram size={20} />
              </a>
            </div>
            <p className="text-xs text-gray-600 mt-8 font-mono">
              &copy; {new Date().getFullYear()} {name}.<br />All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Nav - Glassmorphism */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around py-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
        style={{ background: 'rgba(31,31,31,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <NavItem to="/" icon={Flame} label="Home" />
        <NavItem to="/menu" icon={UtensilsCrossed} label="Menu" />
        <NavItem to="/events" icon={CalendarDays} label="Events" />
        <NavItem to="/order" icon={ShoppingBag} label="Order" />
        {user ? (
          <NavItem to="/storefront-profile" icon={UserIcon} label="Profile" />
        ) : (
          <NavItem to="/login" icon={UserIcon} label="Login" />
        )}
      </nav>
    </div>
  );
};

export default StorefrontLayout;
