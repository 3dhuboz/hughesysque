import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Flame, ChefHat, Utensils, MapPin, Calendar, Star, Truck, Bot, MessageSquare, Ticket, Gift } from 'lucide-react';
import { useClientConfig } from '../context/ClientConfigContext';
import { useStorefront } from '../context/StorefrontContext';
import SmartHeroImg from '../components/SmartHeroImg';

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

  const name = settings.businessName || brandName || 'Hughesys Que';
  const tagline = settings.businessTagline || brandTagline || 'Quality Street Food';

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
    <div className="space-y-16 animate-fade-in relative">

      {/* --- HERO SECTION --- */}
      <section className="h-[88vh] min-h-[700px] flex flex-col lg:flex-row gap-4 pb-2 px-2">

        {/* LEFT: CATERING HERO */}
        <Link to="/order" className="relative flex-1 group overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80 z-10" />
            <SmartHeroImg
              src={settings.heroCateringImage}
              fallback={HERO_CATERING}
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              alt="Catering Feast"
            />
          </div>
          <div className="absolute inset-0 z-20 flex flex-col justify-end p-8 md:p-12 items-start">
            <div className="bg-bbq-gold text-black font-black uppercase tracking-widest text-xs px-4 py-2 rounded-full mb-6 shadow-[0_0_20px_rgba(251,191,36,0.5)]">
              Private & Corporate Events
            </div>
            <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-4 leading-[0.9] drop-shadow-2xl">
              FEAST <br /> LIKE A <span className="text-transparent bg-clip-text bg-gradient-to-r from-bbq-gold to-yellow-200">KING</span>
            </h2>
            <p className="text-gray-200 text-lg md:text-xl font-medium max-w-md mb-8 leading-relaxed">
              From backyard birthdays to corporate blowouts. We bring the smoker, the meat, and the vibe to you.
            </p>
            <div className="bg-white text-black font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 hover:bg-bbq-gold transition-all shadow-xl group-hover:translate-x-2">
              <ChefHat size={20} /> View Our Menu <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* RIGHT: NEXT COOK HERO */}
        <Link to="/order" className="relative flex-1 group overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-t from-bbq-red/40 to-transparent mix-blend-overlay z-10" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90 z-20" />
            <SmartHeroImg
              src={settings.heroCookImage}
              fallback={HERO_COOK}
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 contrast-125"
              alt="Smoker and BBQ"
            />
          </div>
          <div className="absolute inset-0 z-30 flex flex-col justify-end p-8 md:p-12 items-start">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-red-600 text-white font-black uppercase tracking-widest text-xs px-4 py-2 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-pulse">
                Next Cook Day
              </div>
              <Flame className="text-red-500 animate-bounce" fill="currentColor" />
            </div>
            <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-[0.9] drop-shadow-2xl">
              TASTE <br /> THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">SMOKE</span>
            </h2>
            <div className="w-full bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 mb-8 transform group-hover:-translate-y-2 transition-transform duration-500"
              style={{ WebkitBackdropFilter: 'blur(12px)' }}>
              {nextCookDay ? (
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs text-gray-400 uppercase font-bold tracking-widest">Next Cook Day</span>
                    <div className="text-3xl font-display font-bold text-white">
                      {new Date(nextCookDay.date).toLocaleDateString(undefined, { weekday: 'long' })}
                    </div>
                    <div className="text-lg text-bbq-gold font-bold">
                      {new Date(nextCookDay.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right">
                    {nextCookDay.location && (
                      <div className="flex items-center justify-end gap-2 text-red-400 mb-1">
                        <MapPin size={16} /> <span className="text-xs font-bold uppercase">{nextCookDay.location}</span>
                      </div>
                    )}
                    <div className="inline-block bg-white/10 rounded px-2 py-1 text-xs text-gray-300">
                      Limited Capacity
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  <Calendar className="text-gray-500" size={24} />
                  <span className="text-gray-300 font-bold">Cook dates announcing soon. Stay tuned!</span>
                </div>
              )}
            </div>
            <div className="bg-gradient-to-r from-red-700 to-red-900 text-white font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all group-hover:scale-105 w-full md:w-auto justify-center">
              <ShoppingBag size={20} /> Order Now
            </div>
          </div>
        </Link>
      </section>

      {/* --- AI PITMASTER JAY --- */}
      <section className="mx-4">
        <div className="relative rounded-3xl overflow-hidden border border-white/10 group shadow-2xl">
          <div className="absolute inset-0 bg-neutral-900"></div>
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay transition duration-1000 group-hover:scale-105"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-transparent"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-stretch min-h-[400px]">
            <div className="flex-1 p-8 md:p-12 flex flex-col justify-center space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-bbq-red rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)] border-2 border-white/20">
                    <Bot size={32} className="text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-black animate-pulse"></div>
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl uppercase tracking-wider">Pitmaster Jay <span className="text-bbq-gold text-xs bg-white/10 px-2 py-0.5 rounded ml-2 align-middle">AI Beta</span></h3>
                  <p className="text-gray-400 text-sm">Online &amp; Ready to Roast</p>
                </div>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white leading-tight">
                GOT A <span className="text-bbq-red">BRISKET</span> EMERGENCY?
              </h2>
              <p className="text-gray-300 text-lg max-w-md leading-relaxed">
                Don't ruin the roast. Ask Jay about temperatures, wood pairings, resting times, or how to save a dry piece of meat.
              </p>
              <div className="pt-4">
                <a href="/contact" className="bg-white text-black font-black uppercase tracking-widest px-8 py-4 rounded-full inline-flex items-center gap-3 hover:bg-bbq-gold transition-all shadow-[0_0_25px_rgba(255,255,255,0.2)]">
                  <MessageSquare size={20} className="fill-current" /> Ask a Question
                </a>
              </div>
            </div>
            <div className="flex-1 bg-white/5 backdrop-blur-sm border-l border-white/5 p-8 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              </div>
              <div className="space-y-4 max-w-sm mx-auto w-full">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-bbq-red shrink-0 flex items-center justify-center"><Bot size={16} className="text-white" /></div>
                  <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none border border-gray-700 text-sm text-gray-200 shadow-lg">
                    <p>What's cooking today? Need help with that stall?</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="bg-white text-black p-3 rounded-2xl rounded-tr-none text-sm font-medium shadow-lg">
                    <p>How long should I rest a 4kg pork shoulder?</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-bbq-red shrink-0 flex items-center justify-center"><Bot size={16} className="text-white" /></div>
                  <div className="bg-gray-800 p-3 rounded-2xl rounded-tl-none border border-gray-700 text-gray-400 text-xs flex items-center gap-2 w-fit">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
            </div>
          </div>
        </div>
      </section>

      {/* PHILOSOPHY / INTRO */}
      <section className="relative max-w-5xl mx-auto px-6 py-12 text-center">
        <div className="absolute top-0 left-0 text-gray-800 opacity-20 -z-10 transform -translate-x-12 -translate-y-12">
          <Flame size={200} />
        </div>
        <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-8">
          WE DON'T DO <span className="text-bbq-red italic">FAST</span> FOOD. <br />
          WE DO <span className="text-bbq-gold italic">GOOD</span> FOOD.
        </h2>
        <p className="text-gray-400 text-lg md:text-xl leading-relaxed font-light max-w-3xl mx-auto">
          {name} is a family owned operation obsessed with the ritual of fire and meat. We treat every cut with respect, smoking it low and slow over seasoned hardwood until it falls apart at the sight of a fork. This isn't just lunch—it's a religious experience.
        </p>
        <div className="grid grid-cols-3 gap-8 mt-12 border-t border-gray-800 pt-12">
          <div>
            <h4 className="text-4xl font-display font-bold text-bbq-red">12+</h4>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Hours Smoked</p>
          </div>
          <div>
            <h4 className="text-4xl font-display font-bold text-bbq-red">100%</h4>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Quality Hardwood</p>
          </div>
          <div>
            <h4 className="text-4xl font-display font-bold text-bbq-red">5.0</h4>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Star Rating</p>
          </div>
        </div>
      </section>

      {/* CARDS SECTION */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 max-w-7xl mx-auto">
        <Link to="/order" className="relative h-64 rounded-2xl overflow-hidden group border border-white/10 hover:border-bbq-red/50 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
          <SmartHeroImg
            src={settings.homeScheduleCardImage}
            fallback={CARD_SCHEDULE}
            alt="Events"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700"
          />
          <div className="absolute bottom-0 left-0 w-full p-8 z-20">
            <div className="flex items-center gap-3 mb-2">
              <Truck size={24} className="text-bbq-gold" />
              <h3 className="text-2xl font-display font-bold uppercase text-white">Cook Day Schedule</h3>
            </div>
            <p className="text-gray-300 text-sm mb-4">Find out when we're firing up the smoker next.</p>
            <div className="flex items-center gap-2 text-bbq-gold text-xs font-bold uppercase tracking-widest">
              View Schedule <ArrowRight size={14} />
            </div>
          </div>
        </Link>

        <Link to="/order" className="relative h-64 rounded-2xl overflow-hidden group border border-white/10 hover:border-bbq-red/50 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
          <SmartHeroImg
            src={settings.homeMenuCardImage}
            fallback={CARD_MENU}
            alt="Menu"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700"
          />
          <div className="absolute bottom-0 left-0 w-full p-8 z-20">
            <div className="flex items-center gap-3 mb-2">
              <Utensils size={24} className="text-bbq-gold" />
              <h3 className="text-2xl font-display font-bold uppercase text-white">Full Menu</h3>
            </div>
            <p className="text-gray-300 text-sm mb-4">Browse our complete selection of smoked meats & sides.</p>
            <div className="flex items-center gap-2 text-bbq-gold text-xs font-bold uppercase tracking-widest">
              View Items <ArrowRight size={14} />
            </div>
          </div>
        </Link>
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
