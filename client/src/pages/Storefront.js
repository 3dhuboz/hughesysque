import React, { useState, useEffect, useCallback } from 'react';
import {
  Utensils, ShoppingBag, MapPin, Clock, Calendar, Mail,
  Plus, X, Flame, ChefHat, ArrowRight, Truck
} from 'lucide-react';
import api from '../api';
import { useClientConfig } from '../context/ClientConfigContext';
import './Storefront.css';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80';
const HERO_CATERING = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80';
const HERO_COOK = 'https://images.unsplash.com/photo-1529193591184-b1d580690dd0?auto=format&fit=crop&w=1200&q=80';

/* ──────────────────────────────────────────────
   ITEM DETAIL MODAL
   ────────────────────────────────────────────── */
const ItemModal = ({ item, onClose, onAdd, accent }) => {
  const [qty, setQty] = useState(1);
  return (
    <div className="sf-modal-overlay">
      <div className="sf-modal-backdrop" onClick={onClose} />
      <div className="sf-modal">
        <button className="sf-modal-close" onClick={onClose}><X size={20} /></button>
        <div className="sf-modal-img">
          <img src={item.image || PLACEHOLDER_IMG} alt={item.name} onError={e => { e.target.src = PLACEHOLDER_IMG; }} />
          <div className="sf-modal-img-overlay" />
          <div style={{ position: 'absolute', bottom: '1rem', left: '1.5rem', right: '1.5rem', zIndex: 10 }}>
            <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '1.875rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: accent }}>${item.price?.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="sf-modal-body">
          <p style={{ color: '#d1d5db', lineHeight: 1.6, fontSize: '1.125rem' }}>{item.description}</p>
          {item.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: '0.375rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {item.tags.map(t => (
                <span key={t} style={{ fontSize: '0.6875rem', padding: '0.25rem 0.625rem', borderRadius: 4, background: `${accent}20`, color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="sf-modal-footer">
          <div className="sf-qty-controls">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
            <div className="sf-qty-value">{qty}</div>
            <button onClick={() => setQty(q => q + 1)}>+</button>
          </div>
          <button className="sf-modal-add-btn" style={{ background: accent, color: '#fff' }} onClick={() => { onAdd(item, qty); onClose(); }}>
            Add to Order <span style={{ background: 'rgba(0,0,0,0.2)', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.875rem' }}>${(item.price * qty).toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────
   MAIN STOREFRONT
   ────────────────────────────────────────────── */
const Storefront = () => {
  const { brandName, brandTagline, primaryColor } = useClientConfig();
  const [menuItems, setMenuItems] = useState([]);
  const [cookDays, setCookDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [recentlyAdded, setRecentlyAdded] = useState(null);

  const [siteSettings, setSiteSettings] = useState({});
  const accent = primaryColor || siteSettings.brandPrimaryColor || '#D9381E';
  const gold = '#fbbf24';
  const name = brandName || siteSettings.brandName || 'Food Truck';
  const tagline = brandTagline || siteSettings.brandTagline || 'Low & Slow BBQ';

  useEffect(() => {
    Promise.all([
      api.get('/foodtruck/public/menu').catch(() => ({ data: [] })),
      api.get('/foodtruck/public/cookdays').catch(() => ({ data: [] })),
      api.get('/settings').catch(() => ({ data: {} })),
    ]).then(([menuRes, cookRes, settingsRes]) => {
      setMenuItems(menuRes.data);
      setCookDays(cookRes.data);
      setSiteSettings(settingsRes.data || {});
      setLoading(false);
    });
  }, []);

  const addToCart = useCallback((item, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(c => c._id === item._id);
      if (existing) return prev.map(c => c._id === item._id ? { ...c, qty: c.qty + qty } : c);
      return [...prev, { ...item, qty }];
    });
    setRecentlyAdded(item._id);
    setTimeout(() => setRecentlyAdded(null), 2000);
  }, []);

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => c._id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);
  const categories = [...new Set(menuItems.map(i => i.category).filter(Boolean))];
  const regularItems = menuItems.filter(i => !i.isCatering && i.category !== 'Catering');
  const cateringItems = menuItems.filter(i => i.isCatering || i.category === 'Catering');

  const nextCookDay = cookDays.filter(d => new Date(d.date) >= new Date(new Date().setHours(0,0,0,0)))[0];

  const navigate = (p) => { setPage(p); window.scrollTo(0, 0); };

  if (loading) {
    return (
      <div className="sf-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Flame size={48} style={{ color: accent, marginBottom: '1rem' }} />
          <p style={{ color: '#9ca3af', fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em' }}>Firing up the smoker...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { key: 'home', label: 'Home', icon: Flame },
    { key: 'menu', label: 'Menu', icon: Utensils },
    { key: 'catering', label: 'Catering', icon: ChefHat },
    { key: 'schedule', label: 'Order', icon: Calendar },
  ];

  return (
    <div className="sf-root" style={{ '--sf-accent': accent, '--sf-gold': gold }}>

      {/* ═══ DESKTOP HEADER ═══ */}
      <header className="sf-header-desktop sf-glass">
        <div className="sf-header-brand" onClick={() => navigate('home')}>
          <div className="sf-header-brand-icon" style={{ border: `2px solid ${accent}`, background: '#000' }}>
            <Flame style={{ color: accent }} size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', letterSpacing: '0.05em', lineHeight: 1 }}>{name}</h1>
            <span style={{ fontSize: '0.6875rem', color: gold, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: "'Inter',sans-serif" }}>{tagline}</span>
          </div>
        </div>
        <nav className="sf-header-nav">
          {navItems.map(n => (
            <button key={n.key} className={page === n.key ? 'active' : ''} onClick={() => navigate(n.key)}>{n.label}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {cartCount > 0 && (
            <button onClick={() => setShowCart(true)} style={{ background: accent, color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 9999, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontFamily: "'Inter',sans-serif" }}>
              <ShoppingBag size={16} /> {cartCount} items
            </button>
          )}
        </div>
      </header>

      {/* ═══ MOBILE HEADER ═══ */}
      <header className="sf-header-mobile sf-glass">
        <div className="sf-header-brand" onClick={() => navigate('home')}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: '#000', border: `1px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flame style={{ color: accent }} size={20} />
          </div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff', letterSpacing: '0.03em' }}>{name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {cartCount > 0 && (
            <button onClick={() => setShowCart(true)} style={{ background: accent, color: '#fff', border: 'none', padding: '0.25rem 0.75rem', borderRadius: 9999, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', animation: 'sf-fade-in 0.3s', fontFamily: "'Inter',sans-serif" }}>
              {cartCount} <ShoppingBag size={12} />
            </button>
          )}
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="sf-main sf-animate-in">

        {/* ──────── HOME ──────── */}
        {page === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>

            {/* HERO HEADING */}
            {(siteSettings.heroHeading || siteSettings.heroSubtitle) && (
              <section style={{ textAlign: 'center', maxWidth: '56rem', margin: '0 auto', padding: '0 1.5rem' }}>
                {siteSettings.heroHeading && (
                  <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '2.25rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', marginBottom: '0.75rem', lineHeight: 1.1 }}>
                    {siteSettings.heroHeading}
                  </h2>
                )}
                {siteSettings.heroSubtitle && (
                  <p style={{ color: '#d1d5db', fontSize: '1.125rem', lineHeight: 1.6, maxWidth: '40rem', margin: '0 auto' }}>
                    {siteSettings.heroSubtitle}
                  </p>
                )}
              </section>
            )}

            {/* HERO SPLIT */}
            <section className="sf-hero">
              {/* Left: Catering */}
              <div className="sf-hero-card" onClick={() => navigate('catering')}>
                <img src={HERO_CATERING} alt="Catering" onError={e => { e.target.src = PLACEHOLDER_IMG; }} />
                <div className="sf-hero-overlay" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.2), rgba(0,0,0,0.8))' }} />
                <div className="sf-hero-content">
                  <div className="sf-hero-badge" style={{ background: gold, color: '#000', boxShadow: `0 0 20px ${gold}66` }}>
                    Private & Corporate Events
                  </div>
                  <h2 className="sf-hero-title">
                    FEAST<br/>LIKE A <span style={{ color: 'transparent', WebkitBackgroundClip: 'text', backgroundClip: 'text', backgroundImage: `linear-gradient(to right, ${gold}, #fde68a)` }}>KING</span>
                  </h2>
                  <p style={{ color: '#e5e5e5', fontSize: '1.125rem', maxWidth: 400, marginBottom: '2rem', lineHeight: 1.6 }}>
                    From backyard birthdays to corporate blowouts. We bring the smoker, the meat, and the vibe to you.
                  </p>
                  <div className="sf-hero-cta" style={{ background: '#fff', color: '#000' }}>
                    <ChefHat size={20} /> Build Your Menu <ArrowRight size={18} />
                  </div>
                </div>
              </div>

              {/* Right: Next Cook */}
              <div className="sf-hero-card" onClick={() => navigate('menu')}>
                <img src={HERO_COOK} alt="Smoker" onError={e => { e.target.src = PLACEHOLDER_IMG; }} style={{ filter: 'contrast(1.25)' }} />
                <div className="sf-hero-overlay" style={{ background: `linear-gradient(to top, ${accent}44, transparent), linear-gradient(to bottom, rgba(0,0,0,0.5), transparent, rgba(0,0,0,0.9))` }} />
                <div className="sf-hero-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <div className="sf-hero-badge" style={{ background: accent, color: '#fff', boxShadow: `0 0 20px ${accent}88`, marginBottom: 0 }}>
                      Next Pit Fire
                    </div>
                    <Flame style={{ color: accent }} fill="currentColor" size={20} />
                  </div>
                  <h2 className="sf-hero-title">
                    TASTE<br/>THE <span style={{ color: 'transparent', WebkitBackgroundClip: 'text', backgroundClip: 'text', backgroundImage: `linear-gradient(to right, ${accent}, #f97316)` }}>SMOKE</span>
                  </h2>

                  {/* Next Cook Info */}
                  <div style={{ width: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
                    {nextCookDay ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <span style={{ fontSize: '0.625rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.15em' }}>Next Pickup</span>
                          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: '1.75rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>
                            {new Date(nextCookDay.date).toLocaleDateString('en-AU', { weekday: 'long' })}
                          </div>
                          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: gold }}>
                            {new Date(nextCookDay.date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        {nextCookDay.location?.name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: accent, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                            <MapPin size={14} /> {nextCookDay.location.name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                        <Calendar style={{ color: '#6b7280' }} size={24} />
                        <span style={{ color: '#d1d5db', fontWeight: 700 }}>Pit dates announcing soon. Stay tuned!</span>
                      </div>
                    )}
                  </div>

                  <div className="sf-hero-cta" style={{ background: `linear-gradient(to right, ${accent}, #991b1b)`, color: '#fff', width: '100%', justifyContent: 'center' }}>
                    <ShoppingBag size={20} /> Order Now
                  </div>
                </div>
              </div>
            </section>

            {/* PHILOSOPHY */}
            <section style={{ maxWidth: '56rem', margin: '0 auto', padding: '0 1.5rem', textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, opacity: 0.08, pointerEvents: 'none', transform: 'translate(-3rem, -3rem)' }}>
                <Flame size={200} />
              </div>
              {siteSettings.philosophyHeading ? (
                <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '2.5rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', marginBottom: '2rem', lineHeight: 1.1 }}>
                  {siteSettings.philosophyHeading}
                </h2>
              ) : (
                <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '2.5rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', marginBottom: '2rem', lineHeight: 1.1 }}>
                  WE DON'T DO <span style={{ color: accent, fontStyle: 'italic' }}>FAST</span> FOOD.<br/>
                  WE DO <span style={{ color: gold, fontStyle: 'italic' }}>GOOD</span> FOOD.
                </h2>
              )}
              <p style={{ color: '#9ca3af', fontSize: '1.125rem', lineHeight: 1.7, maxWidth: '48rem', margin: '0 auto' }}>
                {siteSettings.philosophyBody || "We're obsessed with the ritual of fire and meat. Every brisket is treated with respect, smoked for 12+ hours over seasoned hardwood until it falls apart at the sight of a fork. This isn't just lunch — it's a religious experience."}
              </p>
              <div className="sf-stats">
                <div>
                  <div className="sf-stat-value" style={{ fontFamily: "'Oswald',sans-serif", color: accent }}>12+</div>
                  <div className="sf-stat-label">Hours Smoked</div>
                </div>
                <div>
                  <div className="sf-stat-value" style={{ fontFamily: "'Oswald',sans-serif", color: accent }}>100%</div>
                  <div className="sf-stat-label">Hardwood Fire</div>
                </div>
                <div>
                  <div className="sf-stat-value" style={{ fontFamily: "'Oswald',sans-serif", color: accent }}>4.9</div>
                  <div className="sf-stat-label">Star Rating</div>
                </div>
              </div>
            </section>

            {/* CARD LINKS */}
            <section className="sf-cards-grid">
              <div className="sf-card-link" onClick={() => navigate('schedule')}>
                <img src="https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=800&q=80" alt="Events" onError={e => { e.target.src = PLACEHOLDER_IMG; }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.3), transparent)', zIndex: 10 }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '2rem', zIndex: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <Truck size={24} style={{ color: gold }} />
                    <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>Food Truck Schedule</h3>
                  </div>
                  <p style={{ color: '#d1d5db', fontSize: '0.875rem', marginBottom: '1rem' }}>Find out where we're popping up next.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: gold, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    View Calendar <ArrowRight size={14} />
                  </div>
                </div>
              </div>

              <div className="sf-card-link" onClick={() => navigate('menu')}>
                <img src="https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80" alt="Menu" onError={e => { e.target.src = PLACEHOLDER_IMG; }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.3), transparent)', zIndex: 10 }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '2rem', zIndex: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <Utensils size={24} style={{ color: gold }} />
                    <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>Full Menu</h3>
                  </div>
                  <p style={{ color: '#d1d5db', fontSize: '0.875rem', marginBottom: '1rem' }}>Browse our complete selection of meats.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: gold, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    View Items <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ──────── MENU ──────── */}
        {page === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {categories.filter(c => c !== 'Catering').map(cat => {
              const items = regularItems.filter(i => i.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="sf-cat-header">
                    <h3>{cat}</h3>
                    <div className="sf-cat-line" />
                  </div>
                  <div className="sf-menu-grid">
                    {items.map(item => {
                      const isSoldOut = item.available === false || (item.stock != null && item.stock <= 0);
                      return (
                      <div key={item._id} className="sf-menu-card" style={isSoldOut ? { opacity: 0.5, pointerEvents: 'none' } : {}} onClick={() => !isSoldOut && setSelectedItem(item)}>
                        <div className="sf-menu-card-img">
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)', zIndex: 10 }} />
                          <img src={item.image || PLACEHOLDER_IMG} alt={item.name} onError={e => { e.target.src = PLACEHOLDER_IMG; }} />
                          {isSoldOut && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', color: '#ef4444', fontSize: '0.875rem', fontWeight: 800, padding: '0.5rem 1.25rem', borderRadius: 6, zIndex: 30, textTransform: 'uppercase', letterSpacing: '0.1em', border: '1px solid rgba(239,68,68,0.4)' }}>Sold Out</div>
                          )}
                          {!isSoldOut && item.tags?.includes('popular') && (
                            <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', background: gold, color: '#000', fontSize: '0.625rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: 4, zIndex: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Popular</div>
                          )}
                          {!isSoldOut && item.tags?.includes('signature') && (
                            <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', background: accent, color: '#fff', fontSize: '0.625rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: 4, zIndex: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signature</div>
                          )}
                        </div>
                        <div className="sf-menu-card-body">
                          <div className="sf-menu-card-head">
                            <h4 className="sf-menu-card-name" style={{ fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase', letterSpacing: '0.03em' }}>{item.name}</h4>
                            <span className="sf-menu-card-price" style={{ color: '#fff' }}>${item.price?.toFixed(2)}</span>
                          </div>
                          <p className="sf-menu-card-desc">{item.description}</p>
                          <div className="sf-menu-card-footer">
                            {isSoldOut ? (
                              <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Sold Out</span>
                            ) : (
                              <button
                                className={`sf-add-btn ${recentlyAdded === item._id ? 'added' : ''}`}
                                onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                              >
                                {recentlyAdded === item._id ? (<>✓ Added!</>) : (<><Plus size={16} /> Select</>)}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {regularItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#6b7280' }}>
                <Utensils size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p style={{ fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase' }}>Menu items loading...</p>
              </div>
            )}
          </div>
        )}

        {/* ──────── CATERING ──────── */}
        {page === 'catering' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '2.5rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', marginBottom: '1rem' }}>
                CATERING <span style={{ color: accent }}>PACKAGES</span>
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '1.125rem', maxWidth: '40rem', margin: '0 auto', lineHeight: 1.6 }}>
                Perfect for events, parties, and corporate functions. Choose your package and we'll handle the rest.
              </p>
            </div>
            <div className="sf-menu-grid">
              {cateringItems.map(item => (
                <div key={item._id} className="sf-menu-card" onClick={() => setSelectedItem(item)}>
                  <div className="sf-menu-card-img">
                    <img src={item.image || PLACEHOLDER_IMG} alt={item.name} onError={e => { e.target.src = PLACEHOLDER_IMG; }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', zIndex: 10 }} />
                  </div>
                  <div className="sf-menu-card-body">
                    <div className="sf-menu-card-head">
                      <h4 className="sf-menu-card-name" style={{ fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase' }}>{item.name}</h4>
                      <span className="sf-menu-card-price">
                        ${item.price?.toFixed(2)}
                        {item.cateringPricePerHead && <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>/head</span>}
                      </span>
                    </div>
                    <p className="sf-menu-card-desc">{item.description}</p>
                    {item.cateringMinQty && (
                      <p style={{ fontSize: '0.75rem', color: gold, fontWeight: 600, marginBottom: '0.75rem' }}>Minimum {item.cateringMinQty} guests</p>
                    )}
                    <div className="sf-menu-card-footer">
                      <button className="sf-add-btn" style={{ background: accent, color: '#fff' }} onClick={(e) => { e.stopPropagation(); addToCart(item); }}>
                        <ShoppingBag size={16} /> Enquire
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cateringItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '5rem', color: '#6b7280', background: '#1a1a1a', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <ChefHat size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p style={{ fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase', fontSize: '1.25rem' }}>Catering packages coming soon!</p>
                <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Contact us for custom quotes.</p>
              </div>
            )}
          </div>
        )}

        {/* ──────── SCHEDULE ──────── */}
        {page === 'schedule' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '2.5rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', marginBottom: '1rem' }}>
                UPCOMING <span style={{ color: accent }}>COOK DAYS</span>
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '1.125rem', maxWidth: '40rem', margin: '0 auto', lineHeight: 1.6 }}>
                Find us at these locations. Pre-order to guarantee your meal!
              </p>
            </div>
            {cookDays.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem', background: '#1a1a1a', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Calendar size={48} style={{ margin: '0 auto 1rem', color: '#374151' }} />
                <p style={{ fontFamily: "'Oswald',sans-serif", textTransform: 'uppercase', fontSize: '1.25rem', color: '#9ca3af' }}>Pit dates announcing soon!</p>
                <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Follow our socials for updates.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cookDays.map(d => (
                  <div key={d._id} className="sf-glass-card" style={{
                    borderRadius: '1rem', padding: '1.5rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
                  }}>
                    <div>
                      <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>
                        {new Date(d.date).toLocaleDateString('en-AU', { weekday: 'long' })}
                      </h3>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: gold }}>
                        {new Date(d.date).toLocaleDateString('en-AU', { month: 'long', day: 'numeric' })}
                      </div>
                      {d.title && <p style={{ fontSize: '0.875rem', color: '#d1d5db', marginTop: '0.25rem' }}>{d.title}</p>}
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                        {d.timeStart && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={14} /> {d.timeStart} – {d.timeEnd}</span>}
                        {d.location?.name && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={14} /> {d.location.name}</span>}
                      </div>
                    </div>
                    <button onClick={() => navigate('menu')} style={{
                      padding: '0.875rem 2rem', borderRadius: 9999, border: 'none', cursor: 'pointer',
                      background: `linear-gradient(to right, ${accent}, #991b1b)`, color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                      textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Inter',sans-serif",
                      display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                      <ShoppingBag size={16} /> Pre-Order
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="sf-footer">
        <div className="sf-footer-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: '#000', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame style={{ color: accent }} size={24} />
              </div>
            </div>
            <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: '1.5rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>{name}</h3>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.6 }}>{tagline}</p>
          </div>
          <div>
            <h4 style={{ color: gold }}>Explore</h4>
            <button onClick={() => navigate('home')} style={{ all: 'unset', display: 'block', color: '#9ca3af', cursor: 'pointer', marginBottom: '0.75rem', fontSize: '0.875rem' }}>Home</button>
            <button onClick={() => navigate('menu')} style={{ all: 'unset', display: 'block', color: '#9ca3af', cursor: 'pointer', marginBottom: '0.75rem', fontSize: '0.875rem' }}>Full Menu</button>
            <button onClick={() => navigate('catering')} style={{ all: 'unset', display: 'block', color: '#9ca3af', cursor: 'pointer', marginBottom: '0.75rem', fontSize: '0.875rem' }}>Catering</button>
            <button onClick={() => navigate('schedule')} style={{ all: 'unset', display: 'block', color: '#9ca3af', cursor: 'pointer', marginBottom: '0.75rem', fontSize: '0.875rem' }}>Cook Days</button>
          </div>
          <div>
            <h4 style={{ color: gold }}>Contact</h4>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.75rem' }}><Mail size={16} style={{ color: accent }} /> Get in touch</span>
            <p style={{ color: '#4b5563', fontSize: '0.6875rem', marginTop: '2rem', fontFamily: 'monospace' }}>
              © {new Date().getFullYear()} {name}.<br/>Powered by <a href="https://pennywiseit.com.au" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280' }}>Penny Wise I.T</a>
            </p>
          </div>
        </div>
      </footer>

      {/* ═══ MOBILE BOTTOM NAV ═══ */}
      <nav className="sf-bottom-nav sf-glass">
        {navItems.map(n => {
          const Icon = n.icon;
          return (
            <button key={n.key} className={page === n.key ? 'active' : ''} onClick={() => navigate(n.key)}>
              <Icon size={22} strokeWidth={1.5} />
              <span>{n.label}</span>
            </button>
          );
        })}
        <button onClick={() => setShowCart(true)} className={showCart ? 'active' : ''}>
          <div style={{ position: 'relative' }}>
            <ShoppingBag size={22} strokeWidth={1.5} />
            {cartCount > 0 && (
              <div style={{ position: 'absolute', top: -6, right: -8, background: accent, color: '#fff', fontSize: '0.5625rem', fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</div>
            )}
          </div>
          <span>Tray</span>
        </button>
      </nav>

      {/* ═══ FLOATING CART FAB (desktop only when items in cart) ═══ */}
      {cartCount > 0 && (
        <button className="sf-cart-fab" style={{ background: accent, boxShadow: `0 8px 32px ${accent}44`, display: 'none' }} onClick={() => setShowCart(true)}>
          <ShoppingBag size={20} />
          <span>{cartCount} items</span>
          <span style={{ background: 'rgba(0,0,0,0.2)', padding: '0.25rem 0.75rem', borderRadius: 8 }}>${cartTotal.toFixed(2)}</span>
        </button>
      )}

      {/* ═══ CART DRAWER ═══ */}
      {showCart && <div className="sf-cart-overlay" onClick={() => setShowCart(false)} />}
      {showCart && (
        <div className="sf-cart-drawer">
          <div className="sf-cart-header">
            <h3 style={{ margin: 0, fontFamily: "'Oswald',sans-serif", fontSize: '1.25rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}>
              <ShoppingBag size={20} style={{ color: accent }} /> Your Tray
            </h3>
            <span style={{ background: '#fff', color: '#000', fontSize: '0.6875rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: 9999 }}>{cartCount}</span>
            <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', marginLeft: 'auto' }}><X size={20} /></button>
          </div>
          <div className="sf-cart-items">
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#6b7280' }}>
                <p style={{ fontSize: '0.875rem' }}>Tray is empty.</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Select items to begin.</p>
              </div>
            ) : cart.map(item => (
              <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', gap: '0.375rem' }}>
                    <span style={{ color: gold }}>{item.qty}x</span> {item.name}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => updateQty(item._id, -1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #4b5563', background: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center', fontSize: '0.875rem' }}>{item.qty}</span>
                  <button onClick={() => updateQty(item._id, 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #4b5563', background: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  <span style={{ fontWeight: 700, color: '#9ca3af', fontFamily: 'monospace', minWidth: 60, textAlign: 'right', fontSize: '0.875rem' }}>
                    ${(item.price * item.qty).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="sf-cart-footer">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Oswald',sans-serif", fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase' }}>
                <span style={{ color: '#fff' }}>Total</span>
                <span style={{ color: gold }}>${cartTotal.toFixed(2)}</span>
              </div>
              <button style={{
                width: '100%', padding: '1rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
                background: accent, color: '#fff', fontSize: '1rem', fontWeight: 700,
                fontFamily: "'Inter',sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em'
              }}>
                Checkout
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ ITEM MODAL ═══ */}
      {selectedItem && <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} onAdd={addToCart} accent={accent} />}
    </div>
  );
};

export default Storefront;
