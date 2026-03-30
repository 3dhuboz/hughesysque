import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Flame, ChefHat, Utensils, MapPin, Calendar, Star, Truck, Bot, MessageSquare, Ticket, Gift, Eye, Radio, Send, MessageCircle, Share2 } from 'lucide-react';
import { useClientConfig } from '../context/AppContext';
import { useStorefront } from '../context/AppContext';
import SmartHeroImg from '../components/SmartHeroImg';
import { getStreamStatus, getChatMessages, sendChatMessage } from '../services/api';

const CHAT_STREAM_ID = 'live-main';

// Scroll-reveal: elements with data-reveal get animated when scrolled into view
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80';
const HERO_CATERING = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80';
const HERO_COOK = 'https://images.unsplash.com/photo-1529193591184-b1d580690dd0?auto=format&fit=crop&w=1200&q=80';
const PROMOTER_IMG = 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?auto=format&fit=crop&w=1950&q=80';
const CARD_SCHEDULE = 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=800&q=80';
const CARD_MENU = 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80';

const fallbackImages = [
  "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&h=600&q=80",
  "https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?auto=format&fit=crop&w=600&h=600&q=80",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&h=600&q=80",
  "https://images.unsplash.com/photo-1544025162-d76690b67f11?auto=format&fit=crop&w=600&h=600&q=80",
  "https://images.unsplash.com/photo-1606131731446-5568d87113aa?auto=format&fit=crop&w=600&h=600&q=80",
  "https://images.unsplash.com/photo-1630384060421-a431e4fb9a11?auto=format&fit=crop&w=600&h=600&q=80",
  "https://images.unsplash.com/photo-1598103442097-8b7402dc694c?auto=format&fit=crop&w=600&h=600&q=80",
  "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=600&h=600&q=80",
];

const StorefrontHome = () => {
  const { brandName, brandTagline } = useClientConfig();
  const { settings, calendarEvents } = useStorefront();
  useScrollReveal();

  const [liveStatus, setLiveStatus] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('live-chat-name') || '');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef(null);

  const isLive = liveStatus?.live === true && liveStatus?.previewUrl;

  const fetchLiveStatus = useCallback(() => {
    getStreamStatus()
      .then((data) => setLiveStatus(data))
      .catch(() => setLiveStatus(null));
  }, []);

  useEffect(() => {
    fetchLiveStatus();
    // Poll faster when live to catch stream end quickly
    const interval = setInterval(fetchLiveStatus, isLive ? 8000 : 15000);
    return () => clearInterval(interval);
  }, [fetchLiveStatus, isLive]);

  // Chat polling when live
  useEffect(() => {
    if (!isLive) return;
    const fetchChat = () => {
      const lastMsg = chatMessages[chatMessages.length - 1];
      getChatMessages(CHAT_STREAM_ID, lastMsg?.createdAt)
        .then((data) => {
          if (data?.messages?.length > 0) {
            setChatMessages(prev => {
              const ids = new Set(prev.map(m => m.id));
              const fresh = data.messages.filter(m => !ids.has(m.id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        })
        .catch(() => {});
    };
    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [isLive, chatMessages]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    if (!displayName) { setShowNamePrompt(true); return; }
    setIsSending(true);
    try {
      await sendChatMessage(CHAT_STREAM_ID, displayName, chatInput.trim());
      setChatInput('');
    } catch {} finally { setIsSending(false); }
  };

  const handleSetName = () => {
    if (!nameInput.trim()) return;
    const n = nameInput.trim();
    setDisplayName(n);
    localStorage.setItem('live-chat-name', n);
    setShowNamePrompt(false);
    if (chatInput.trim()) {
      setIsSending(true);
      sendChatMessage(CHAT_STREAM_ID, n, chatInput.trim())
        .then(() => setChatInput(''))
        .catch(() => {})
        .finally(() => setIsSending(false));
    }
  };

  const formatRelativeTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  const handleShareLive = async () => {
    const shareData = {
      title: `${settings.businessName || 'Hughesys Que'} is LIVE!`,
      text: `Check out the live cook stream from ${settings.businessName || 'Hughesys Que'}! 🔥🍖`,
      url: window.location.origin + '/#/',
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      navigator.clipboard.writeText(shareData.url);
    }
  };

  const name = settings.businessName || brandName || 'Hughesys Que';
  const tagline = settings.tagline || brandTagline || 'Quality Street Food';

  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const nextCookDay = calendarEvents
    .filter(e => e.type === 'ORDER_PICKUP' && new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  const handleImageError = (e) => { e.target.src = PLACEHOLDER_IMG; };

  const sourceImages = (settings.manualTickerImages && settings.manualTickerImages.length > 0)
    ? settings.manualTickerImages
    : fallbackImages;
  let tickerItems = [...sourceImages];
  while (tickerItems.length < 10) { tickerItems = [...tickerItems, ...sourceImages]; }

  return (
    <div className="relative overflow-hidden">

      {/* --- LIVE STREAM (shown above hero when live) --- */}
      {isLive && (
        <section className="relative w-full">
          {/* Outer glow border */}
          <div className="relative rounded-3xl overflow-hidden border-2 border-red-600/50 shadow-[0_0_100px_rgba(220,38,38,0.2),0_0_40px_rgba(251,191,36,0.1)]">

            {/* Flames background decoration */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-20 left-1/4 w-40 h-60 bg-gradient-to-t from-orange-600/20 via-red-600/10 to-transparent rounded-full blur-3xl animate-pulse" />
              <div className="absolute -top-10 right-1/3 w-32 h-48 bg-gradient-to-t from-yellow-600/15 via-orange-500/10 to-transparent rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
              <div className="absolute -bottom-10 left-1/5 w-36 h-40 bg-gradient-to-t from-red-800/20 via-orange-700/10 to-transparent rounded-full blur-3xl animate-pulse [animation-delay:0.5s]" />
              <div className="absolute -bottom-10 right-1/4 w-44 h-44 bg-gradient-to-t from-orange-700/15 via-red-600/10 to-transparent rounded-full blur-3xl animate-pulse [animation-delay:1.5s]" />
            </div>

            {/* Top bar — logo + LIVE badge + viewer count */}
            <div className="relative z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-b border-red-900/40">
              <div className="flex items-center gap-3">
                {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain drop-shadow-lg" />
                )}
                <div>
                  <h2 className="text-white font-display font-bold text-sm md:text-base uppercase tracking-wide">{name}</h2>
                  <p className="text-gray-500 text-xs">{liveStatus.title || 'Live Cook Stream'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShareLive}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition border border-white/10"
                  title="Share this stream"
                >
                  <Share2 size={14} />
                </button>
                <div className="flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.6)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span className="text-white text-xs font-black uppercase tracking-widest">Live</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                  <Eye size={12} className="text-bbq-gold" />
                  <span className="text-white font-bold text-xs">{liveStatus.viewerCount ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Main content — video + chat side by side on desktop, stacked on mobile */}
            <div className="relative z-10 flex flex-col lg:flex-row bg-gray-950">
              {/* Video panel */}
              <div className="relative flex-[7] min-w-0">
                {/* Logo watermark on video */}
                {settings.logoUrl && (
                  <div className="absolute bottom-4 right-4 z-20 opacity-30 pointer-events-none">
                    <img src={settings.logoUrl} alt="" className="w-14 h-14 md:w-16 md:h-16 drop-shadow-lg rounded-lg" />
                  </div>
                )}
                <iframe
                  src={liveStatus.previewUrl}
                  className="w-full aspect-video bg-black"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  title="Live Stream"
                  style={{ border: 'none', display: 'block' }}
                />
              </div>

              {/* Chat panel */}
              <div className="flex-[3] min-w-0 lg:min-w-[300px] lg:max-w-[380px] bg-gray-900/95 flex flex-col h-[350px] lg:h-auto border-t lg:border-t-0 lg:border-l border-red-900/30">
                {/* Chat header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0 bg-gray-900">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-bbq-gold" />
                    <span className="text-white font-bold text-xs uppercase tracking-wider">Live Chat</span>
                  </div>
                  <span className="text-gray-600 text-xs">{chatMessages.length} msgs</span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-6">
                      <Flame size={28} className="text-gray-700 mb-2" />
                      <p className="text-gray-500 text-sm">Chat's warming up...</p>
                      <p className="text-gray-600 text-xs mt-1">Be the first to say g'day!</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="flex gap-2 px-3 py-1 hover:bg-white/5">
                          <span className={`font-bold text-xs shrink-0 ${msg.isAdmin ? 'text-bbq-gold' : 'text-blue-400'}`}>
                            {msg.isAdmin && '\u2605 '}{msg.userName}
                          </span>
                          <span className="text-gray-300 text-xs break-words">{msg.message}</span>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>

                {/* Name prompt */}
                {showNamePrompt && (
                  <div className="px-3 py-2 bg-gray-800 border-t border-gray-700 shrink-0">
                    <p className="text-gray-300 text-xs mb-1.5">Enter your name:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
                        placeholder="Your name..."
                        className="flex-1 bg-gray-700 text-white text-xs px-2.5 py-1.5 rounded-lg border border-gray-600 focus:border-bbq-gold focus:outline-none"
                        maxLength={30}
                        autoFocus
                      />
                      <button onClick={handleSetName} className="bg-bbq-gold text-black font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-yellow-400 transition">
                        Go
                      </button>
                    </div>
                  </div>
                )}

                {/* Chat input */}
                <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-800 bg-gray-900 shrink-0">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder={displayName ? `Chat as ${displayName}...` : 'Send a message...'}
                    className="flex-1 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg border border-gray-700 focus:border-gray-500 focus:outline-none placeholder-gray-500"
                    maxLength={500}
                    disabled={isSending}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !chatInput.trim()}
                    className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom bar — coal/ember decoration + CTA */}
            <div className="relative z-20 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-t border-red-900/30 px-4 py-3">
              {/* Ember dots */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-orange-500 animate-pulse" fill="currentColor" />
                  <p className="text-gray-400 text-xs">Live from the pit — order before we sell out!</p>
                </div>
                <Link to="/order" className="bg-gradient-to-r from-red-700 to-red-900 text-white font-bold uppercase tracking-widest text-xs px-6 py-2.5 rounded-full flex items-center gap-2 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all shrink-0">
                  <ShoppingBag size={14} /> Order Now
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* --- FULL-BLEED HERO --- */}
      <section className="relative w-full overflow-hidden" style={{ minHeight: isLive ? '50vh' : '100vh' }}>
        {/* Background image */}
        <div className="absolute inset-0">
          <SmartHeroImg
            src={settings.heroCateringImage}
            fallback={HERO_CATERING}
            className="w-full h-full object-cover scale-105"
            alt="BBQ Spread"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black" />
        </div>

        {/* Subtle smoke texture overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_50%,_rgba(0,0,0,0.8)_100%)]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-32 md:py-40 min-h-[inherit]">
          {/* Logo */}
          {settings.logoUrl && (
            <img src={settings.logoUrl} alt="" className="w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-2xl mb-8 hero-text" />
          )}

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-bold text-white uppercase leading-[0.85] tracking-tight drop-shadow-2xl hero-text delay-200">
            {name || 'Hughesys Que'}
          </h1>

          <div className="flex items-center gap-4 mt-6 mb-8 hero-text delay-400">
            <div className="h-px w-12 bg-bbq-gold/60" />
            <p className="text-bbq-gold font-bold uppercase tracking-[0.3em] text-sm md:text-base">
              {tagline || 'Low & Slow BBQ'}
            </p>
            <div className="h-px w-12 bg-bbq-gold/60" />
          </div>

          <p className="text-gray-300 text-lg md:text-xl max-w-xl leading-relaxed mb-10 hero-text delay-500">
            Real fire. Real smoke. Real flavour. From backyard birthdays to corporate blowouts — we bring the pit to you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 hero-text delay-600">
            <Link to="/order" className="bg-bbq-red hover:bg-red-700 text-white font-bold uppercase tracking-widest px-10 py-4 rounded-full flex items-center gap-3 shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:shadow-[0_0_60px_rgba(220,38,38,0.5)] transition-all text-sm hover:scale-105">
              <ShoppingBag size={18} /> Order Now
            </Link>
            <Link to="/menu" className="border-2 border-white/30 hover:border-white text-white font-bold uppercase tracking-widest px-10 py-4 rounded-full flex items-center gap-3 transition-all text-sm backdrop-blur-sm hover:scale-105">
              <ChefHat size={18} /> View Menu
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-50 hero-text delay-800">
            <span className="text-gray-400 text-[10px] uppercase tracking-[0.2em]">Scroll</span>
            <ArrowRight size={14} className="text-gray-400 rotate-90" />
          </div>
        </div>
      </section>

      {/* --- NEXT COOK DAY STRIP --- */}
      <section data-reveal="scale" className="relative bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-y border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-bbq-red/20 border border-bbq-red/40 flex items-center justify-center shrink-0">
              <Flame size={22} className="text-bbq-red" fill="currentColor" />
            </div>
            {nextCookDay ? (
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em]">Next Cook Day</span>
                <div className="text-white font-display font-bold text-xl md:text-2xl flex items-baseline gap-3">
                  {new Date(nextCookDay.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  {nextCookDay.location && (
                    <span className="text-bbq-gold text-xs font-bold flex items-center gap-1"><MapPin size={12} />{nextCookDay.location}</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em]">Next Cook Day</span>
                <div className="text-gray-300 font-bold text-lg">Dates announcing soon</div>
              </div>
            )}
          </div>
          <Link to="/order" className="bg-bbq-red hover:bg-red-700 text-white font-bold uppercase tracking-widest text-xs px-8 py-3 rounded-full flex items-center gap-2 transition-all shrink-0">
            <ShoppingBag size={14} /> Order Now
          </Link>
        </div>
      </section>

      {/* --- STATS BAR --- */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          <div data-reveal="count">
            <h4 className="text-5xl md:text-6xl font-display font-bold text-white">12<span className="text-bbq-red">+</span></h4>
            <p className="text-xs text-gray-500 uppercase tracking-[0.2em] mt-2 font-bold">Hours Smoked</p>
          </div>
          <div data-reveal="count" data-reveal-delay="1">
            <h4 className="text-5xl md:text-6xl font-display font-bold text-white">100<span className="text-bbq-gold">%</span></h4>
            <p className="text-xs text-gray-500 uppercase tracking-[0.2em] mt-2 font-bold">Hardwood Only</p>
          </div>
          <div data-reveal="count" data-reveal-delay="2" className="flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <h4 className="text-5xl md:text-6xl font-display font-bold text-white">5.0</h4>
              <Star size={20} className="text-bbq-gold fill-bbq-gold -mt-2" />
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-[0.2em] mt-2 font-bold">Star Rating</p>
          </div>
        </div>
      </section>

      {/* --- TWO-UP FEATURE CARDS --- */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-1 max-w-[1400px] mx-auto px-4 lg:px-1">
        {/* Catering Card */}
        <Link data-reveal="left" to="/catering" className="relative h-[420px] group overflow-hidden rounded-lg lg:rounded-none">
          <SmartHeroImg
            src={settings.heroCateringImage}
            fallback={HERO_CATERING}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            alt="Catering"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <div className="absolute inset-0 z-10 flex flex-col justify-end p-8 md:p-10">
            <span className="text-bbq-gold text-[10px] font-bold uppercase tracking-[0.3em] mb-2">Private & Corporate</span>
            <h3 className="text-3xl md:text-4xl font-display font-bold text-white uppercase leading-tight mb-3">
              Catering <br />& Events
            </h3>
            <p className="text-gray-300 text-sm max-w-sm mb-5 leading-relaxed">
              We bring the smoker, the meat, and the vibe. Let us make your next event unforgettable.
            </p>
            <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-widest group-hover:gap-4 transition-all">
              Enquire Now <ArrowRight size={14} />
            </div>
          </div>
        </Link>

        {/* Menu Card */}
        <Link data-reveal="right" to="/menu" className="relative h-[420px] group overflow-hidden rounded-lg lg:rounded-none">
          <SmartHeroImg
            src={settings.heroCookImage}
            fallback={HERO_COOK}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            alt="The Menu"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
          <div className="absolute inset-0 z-10 flex flex-col justify-end p-8 md:p-10">
            <span className="text-bbq-gold text-[10px] font-bold uppercase tracking-[0.3em] mb-2">Smoked Low & Slow</span>
            <h3 className="text-3xl md:text-4xl font-display font-bold text-white uppercase leading-tight mb-3">
              The Full <br />Menu
            </h3>
            <p className="text-gray-300 text-sm max-w-sm mb-5 leading-relaxed">
              Brisket, ribs, pulled pork, sides and more. Browse everything we've got on the smoker.
            </p>
            <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-widest group-hover:gap-4 transition-all">
              View Menu <ArrowRight size={14} />
            </div>
          </div>
        </Link>
      </section>

      {/* --- PHILOSOPHY --- */}
      <section className="py-20 px-6">
        <div data-reveal className="max-w-3xl mx-auto text-center">
          <Flame size={40} className="text-bbq-red/30 mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6 leading-tight">
            WE DON'T DO <span className="text-bbq-red italic">FAST</span> FOOD.<br />
            WE DO <span className="text-bbq-gold italic">GOOD</span> FOOD.
          </h2>
          <div className="h-px w-20 bg-bbq-gold/40 mx-auto my-8" />
          <p className="text-gray-400 text-lg leading-relaxed">
            {name} is a family owned operation obsessed with the ritual of fire and meat. We treat every cut with respect, smoking it low and slow over seasoned hardwood until it falls apart at the sight of a fork.
          </p>
        </div>
      </section>

      {/* --- AI PITMASTER JAY --- */}
      <section data-reveal="scale" className="mx-4">
        <div className="relative rounded-2xl overflow-hidden border border-white/5 group shadow-2xl">
          <div className="absolute inset-0 bg-gray-950"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-bbq-red/5"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-stretch min-h-[380px]">
            <div className="flex-1 p-8 md:p-12 flex flex-col justify-center space-y-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 bg-bbq-red rounded-2xl flex items-center justify-center shadow-lg">
                    <Bot size={28} className="text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 w-3 h-3 rounded-full border-2 border-gray-950"></div>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg uppercase tracking-wider">Pitmaster Jay <span className="text-bbq-gold text-[10px] bg-white/5 px-2 py-0.5 rounded ml-2">AI</span></h3>
                  <p className="text-gray-500 text-xs">Online &amp; Ready to Help</p>
                </div>
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white leading-tight">
                GOT A <span className="text-bbq-red">BRISKET</span><br />EMERGENCY?
              </h2>
              <p className="text-gray-400 text-base max-w-md leading-relaxed">
                Ask Jay about temps, wood pairings, resting times, or how to rescue that dry brisket.
              </p>
              <div className="pt-2">
                <a href="/contact" className="inline-flex items-center gap-2 bg-white text-black font-bold uppercase tracking-widest text-xs px-6 py-3 rounded-full hover:bg-bbq-gold transition-all">
                  <MessageSquare size={16} /> Ask a Question
                </a>
              </div>
            </div>
            <div className="flex-1 bg-white/[0.02] border-l border-white/5 p-8 flex flex-col justify-center relative overflow-hidden">
              <div className="space-y-4 max-w-sm mx-auto w-full">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-bbq-red shrink-0 flex items-center justify-center"><Bot size={14} className="text-white" /></div>
                  <div className="bg-white/5 p-3 rounded-2xl rounded-tl-sm text-sm text-gray-300">
                    <p>What's cooking today? Need help with that stall?</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="bg-bbq-red/20 text-white p-3 rounded-2xl rounded-tr-sm text-sm">
                    <p>How long should I rest a 4kg pork shoulder?</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-bbq-red shrink-0 flex items-center justify-center"><Bot size={14} className="text-white" /></div>
                  <div className="bg-white/5 p-3 rounded-2xl rounded-tl-sm text-gray-500 text-xs flex items-center gap-1.5 w-fit">
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- GOLDEN TICKET REWARDS BANNER --- */}
      <section className="mx-2 md:mx-4">
        <Link to="/rewards" className="relative rounded-3xl overflow-hidden block group h-48 md:h-64 border-2 border-bbq-gold/50 hover:border-bbq-gold transition-all duration-500 shadow-[0_0_40px_rgba(251,191,36,0.15)]">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-900 via-black to-yellow-900"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
          <div className="relative z-10 h-full flex flex-col md:flex-row items-center justify-between px-8 md:px-16 text-center md:text-left gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <Ticket className="text-bbq-gold rotate-12" size={32} />
                <h3 className="text-3xl md:text-5xl font-display font-bold text-white uppercase tracking-tight">The Golden Ticket</h3>
              </div>
              <p className="text-bbq-gold/80 font-bold uppercase tracking-widest text-sm md:text-base">Eat BBQ. Collect Stamps. Get Rewarded.</p>
            </div>
            <div className="flex-shrink-0">
              <div className="bg-white text-black font-black uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-2 group-hover:scale-105 transition-transform shadow-xl">
                <Gift size={20} className="text-bbq-gold fill-bbq-gold" /> Join The Club
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* PROMOTER / EVENTS PARALLAX SECTION */}
      <section className="relative w-full h-[500px] overflow-hidden flex items-center justify-center my-12 group">
        <div
          className="absolute inset-0 bg-fixed bg-cover bg-center"
          style={{ backgroundImage: `url('${settings.homePromoterImage?.trim() ? settings.homePromoterImage : PROMOTER_IMG}')` }}
        ></div>
        <div className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition duration-700"></div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 drop-shadow-xl">
            BRINGING THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500">SMOKE</span> TO EVENTS
          </h2>
          <p className="text-gray-200 text-lg md:text-xl font-medium max-w-3xl mx-auto mb-8 leading-relaxed drop-shadow-md">
            We fire up the grill and serve up mouth-watering BBQ at festivals, markets, and private events. Wherever the crowd is, {name} brings the flavour, the fun, and the smoke!
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            <Link to="/order" className="bg-white text-black font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              <Star size={20} className="text-bbq-gold fill-current" /> Order Now
            </Link>
            <Link to="/contact" className="text-white border-2 border-white/30 hover:border-white font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 transition-all">
              Catering Enquiries <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* IMAGE TICKER */}
      <section className="py-12 border-t border-gray-900 bg-black/20 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 mb-8 flex items-center justify-between relative z-10">
          <div>
            <h2 className="text-2xl font-display font-bold text-white leading-none">FROM THE GRILL</h2>
            <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">@{name.replace(/\s/g, '')}</p>
          </div>
        </div>
        <div className="relative w-full overflow-hidden group py-4">
          <div className="flex w-fit animate-marquee-scroll hover:[animation-play-state:paused]">
            <div className="flex gap-4 px-2">
              {tickerItems.map((img, i) => (
                <div key={`t1-${i}`} className="relative w-64 h-64 shrink-0 rounded-xl overflow-hidden border border-white/10 group-hover:grayscale transition duration-500 hover:!grayscale-0 cursor-pointer">
                  <img src={img} alt="Food" className="w-full h-full object-cover" onError={handleImageError} />
                </div>
              ))}
            </div>
            <div className="flex gap-4 px-2">
              {tickerItems.map((img, i) => (
                <div key={`t2-${i}`} className="relative w-64 h-64 shrink-0 rounded-xl overflow-hidden border border-white/10 group-hover:grayscale transition duration-500 hover:!grayscale-0 cursor-pointer">
                  <img src={img} alt="Food" className="w-full h-full object-cover" onError={handleImageError} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StorefrontHome;
