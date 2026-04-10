import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home, Calendar, Trophy, Newspaper, Users, LogIn, LogOut,
  Menu, X, ChevronDown, User, Shield, Heart, Zap, Mail
} from 'lucide-react';
import './yjrl.css';

const NAV_ITEMS = [
  { to: '/yjrl', label: 'Home', icon: Home },
  { to: '/yjrl/fixtures', label: 'Fixtures', icon: Calendar },
  { to: '/yjrl/teams', label: 'Teams', icon: Users },
  { to: '/yjrl/news', label: 'News', icon: Newspaper },
  { to: '/yjrl/events', label: 'Events', icon: Heart },
];

const PORTAL_ITEMS = [
  { to: '/yjrl/portal/player', label: 'Player Portal', icon: Zap, roles: ['all'] },
  { to: '/yjrl/portal/parent', label: 'Parent Portal', icon: Heart, roles: ['all'] },
  { to: '/yjrl/portal/coach', label: 'Coach Portal', icon: Shield, roles: ['all'] },
  { to: '/yjrl/portal/admin', label: 'Club Admin', icon: Trophy, roles: ['admin', 'dev'] },
];

const YJRLLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = async () => {
    await logout();
    navigate('/yjrl');
  };

  const isAdmin = user && (user.role === 'admin' || user.role === 'dev');

  return (
    <div className="yjrl-page">
      {/* ── Navbar ── */}
      <nav className="yjrl-nav">
        <div className="yjrl-nav-inner">
          {/* Logo */}
          <Link to="/yjrl" className="yjrl-logo">
            <div className="yjrl-logo-badge">
              <span style={{ fontSize: '1.2rem' }}>🏉</span>
            </div>
            <div className="yjrl-logo-text">
              <strong>Yeppoon JRL</strong>
              <span>Junior Rugby League</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <ul className="yjrl-nav-links">
            {NAV_ITEMS.map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={isActive(item.to) && item.to !== '/yjrl' ? 'active' : (location.pathname === '/yjrl' && item.to === '/yjrl' ? 'active' : '')}
                >
                  {item.label}
                </Link>
              </li>
            ))}

            {/* Portals dropdown */}
            <li style={{ position: 'relative' }}>
              <button
                onClick={() => setPortalOpen(!portalOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                Portals <ChevronDown size={14} />
              </button>
              {portalOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  background: '#0c1d35',
                  border: '1px solid rgba(240,165,0,0.2)',
                  borderRadius: '10px',
                  padding: '0.5rem',
                  minWidth: '180px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 999
                }}>
                  {PORTAL_ITEMS.filter(p => p.roles.includes('all') || (isAdmin && p.roles.includes('admin'))).map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setPortalOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '7px',
                        color: isActive(item.to) ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        background: isActive(item.to) ? 'rgba(240,165,0,0.1)' : 'transparent',
                        transition: 'all 0.15s'
                      }}
                    >
                      <item.icon size={15} />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </li>

            {/* Auth */}
            {user ? (
              <>
                <li>
                  <Link to="/yjrl/portal/player" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <User size={14} /> {user.firstName || 'My Portal'}
                  </Link>
                </li>
                <li>
                  <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <LogOut size={14} /> Sign Out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link to="/login">
                    <LogIn size={14} style={{ marginRight: 4 }} />Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/yjrl/register" className="yjrl-nav-cta">Join the Club</Link>
                </li>
              </>
            )}
          </ul>

          {/* Mobile toggle */}
          <button className="yjrl-mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{
            borderTop: '1px solid var(--yjrl-border)',
            padding: '1rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}>
            {NAV_ITEMS.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '8px',
                  color: isActive(item.to) ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '0.9rem'
                }}
              >
                <item.icon size={16} /> {item.label}
              </Link>
            ))}
            <hr style={{ border: 'none', borderTop: '1px solid var(--yjrl-border)', margin: '0.5rem 0' }} />
            {PORTAL_ITEMS.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '8px',
                  color: 'var(--yjrl-muted)',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '0.9rem'
                }}
              >
                <item.icon size={16} /> {item.label}
              </Link>
            ))}
            <hr style={{ border: 'none', borderTop: '1px solid var(--yjrl-border)', margin: '0.5rem 0' }} />
            {user ? (
              <button
                onClick={() => { handleLogout(); setMobileOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.65rem 0.75rem', borderRadius: '8px',
                  color: 'var(--yjrl-muted)', background: 'none', border: 'none',
                  fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer'
                }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            ) : (
              <Link
                to="/yjrl/register"
                onClick={() => setMobileOpen(false)}
                className="yjrl-btn yjrl-btn-primary"
                style={{ marginTop: '0.5rem', justifyContent: 'center' }}
              >
                Join the Club
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Page content */}
      <div onClick={() => { setPortalOpen(false); }}>
        {children}
      </div>

      {/* ── Footer ── */}
      <footer className="yjrl-footer">
        <div className="yjrl-footer-inner">
          <div className="yjrl-footer-grid">
            <div className="yjrl-footer-brand">
              <Link to="/yjrl" className="yjrl-logo">
                <div className="yjrl-logo-badge">🏉</div>
                <div className="yjrl-logo-text">
                  <strong>Yeppoon JRL</strong>
                  <span>Junior Rugby League</span>
                </div>
              </Link>
              <p style={{ marginTop: '1rem' }}>
                Building champions on and off the field. Proudly serving the Capricorn Coast community since 1965.
                Home of the mighty Yeppoon Bulls.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                {['facebook', 'instagram', 'youtube'].map(s => (
                  <div key={s} style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--yjrl-gold)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700
                  }}>
                    {s[0].toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            <div className="yjrl-footer-col">
              <h4>Club</h4>
              <ul>
                {['About Us', 'History', 'Teams', 'Coaches', 'Sponsors'].map(l => (
                  <li key={l}><a href="#">{l}</a></li>
                ))}
              </ul>
            </div>

            <div className="yjrl-footer-col">
              <h4>Competition</h4>
              <ul>
                {['Fixtures', 'Results', 'Ladder', 'Stats', 'Awards'].map(l => (
                  <li key={l}><Link to={`/yjrl/fixtures`}>{l}</Link></li>
                ))}
              </ul>
            </div>

            <div className="yjrl-footer-col">
              <h4>Community</h4>
              <ul>
                <li><Link to="/yjrl/register">Join the Club</Link></li>
                <li><Link to="/yjrl/events">Events</Link></li>
                <li><a href="#">Volunteer</a></li>
                <li><a href="#">Sponsors</a></li>
                <li><a href="mailto:info@yepponjrl.com.au">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="yjrl-footer-bottom">
            <span>© {new Date().getFullYear()} Yeppoon Junior Rugby League. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Use</a>
              <a href="#">Child Safety</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default YJRLLayout;
