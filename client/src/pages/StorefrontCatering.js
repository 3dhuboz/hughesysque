import React, { useState, useRef, useEffect } from 'react';
import SmartHeroImg from '../components/SmartHeroImg';
import { useStorefront } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { toLocalDateStr, parseLocalDate } from '../utils/dateUtils';
import {
  ChefHat, Users, Clock, ArrowRight, ArrowLeft, Calendar, CheckCircle,
  AlertCircle, Truck, MapPin, Flame, Snowflake, Package, Plus, Minus,
  Ticket, Check, X, ChevronLeft, ChevronRight, Coffee, UtensilsCrossed
} from 'lucide-react';

const DELIVERY_FEE = 25.00;

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1529193591184-b1d580690dd0?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1544025162-d76690b67f11?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80',
];

/* ── Catering Menu Data (from Hughesey Que Catering Package 2025/26 PDF) ── */

const CATERING_MEATS = [
  'Sliced Brisket', 'Pulled Brisket', 'Pulled Pork', 'Pulled Lamb',
  'Beef Ribs *', 'Pork Ribs *', 'Beef Cheeks', 'Chicken Thighs (Bone-in)',
  'Chicken Lollipops', 'Chicken Wing Nibbles', 'Smoked Sausages / Hot Links',
  'Pork Belly *', 'Lamb Shanks', 'Pork Belly Burnt Ends',
];

const CATERING_SIDES = [
  'Potato Bake', 'Mac N Cheese', 'HQ Slaw', 'BBQ Pit Beans', 'Potato Salad',
  'Corn Elote Pasta Salad', 'Corn Pasta Salad', 'Smoked Corn Elote Salad',
  'Corn on the Cob (Cobettes)', 'Texas Caviar Salad', 'Caesar Salad',
  'Fire Kissed Green Beans & Charred Lime Salad',
  'Texas Style Pit Roasted Pumpkin & Beetroot Salad',
];

const CATERING_DESSERTS = [
  'Smoked Turkish Delight Brownie with Vanilla Bean Ice Cream & Raspberry Coulis',
  'Smoked Apple Crumble with Smoked Caramel Drizzle & Maple Vanilla Custard',
  'Vanilla Bean Panna Cotta with Char Pineapple & Meringue',
];

const DEFAULT_PACKAGES = [
  {
    id: 'pkg_2m2s', name: '2 Meats & 2 Sides', price: 38, minPax: 40, meatLimit: 2, sideLimit: 2,
    description: "A solid spread for casual events. Choose 2 of our signature smoked meats and 2 sides. Includes bread, cutlery, plates and napkins.",
    image: 'https://images.unsplash.com/photo-1529193591184-b1d580690dd0?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'pkg_2m3s', name: '2 Meats & 3 Sides', price: 44, minPax: 40, meatLimit: 2, sideLimit: 3,
    description: 'Extra sides to round out the feast. Choose 2 smoked meats and 3 sides. Includes bread, cutlery, plates and napkins.',
    image: 'https://images.unsplash.com/photo-1544025162-d76690b67f11?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'pkg_3m3s', name: '3 Meats & 3 Sides', price: 56, minPax: 40, meatLimit: 3, sideLimit: 3,
    description: 'Our most popular package. A balanced spread of 3 smoked meats and 3 sides. Includes bread, cutlery, plates and napkins.',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'pkg_4m3s', name: '4 Meats & 3 Sides', price: 68, minPax: 40, meatLimit: 4, sideLimit: 3,
    description: 'The ultimate feast. Choose 4 premium smoked meats with 3 sides. Full set up with bread, cutlery, plates and napkins.',
    image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80',
  },
];

const COCKTAIL_PACKAGES = [
  { id: 'cocktail_teaser', name: 'The Teaser', pieces: 4, price: 40, cold: 2, hot: 2, substantial: 0, duration: '30–60 min', description: 'Pre-dinner nibbles.' },
  { id: 'cocktail_starter', name: 'The Starter', pieces: 5, price: 49, cold: 2, hot: 3, substantial: 0, duration: '60–90 min', description: 'Light cocktail grazing.' },
  { id: 'cocktail_classic', name: 'The Classic', pieces: 6, price: 59, cold: 3, hot: 3, substantial: 0, duration: '1.5–2 hr', description: 'Standard cocktail events.' },
  { id: 'cocktail_crowd', name: 'The Crowd Pleaser', pieces: 7, price: 69, cold: 3, hot: 4, substantial: 0, duration: '2–2.5 hr', description: 'When you want it to feel like enough food.' },
  { id: 'cocktail_feed', name: 'The Proper Feed', pieces: 8, price: 79, cold: 3, hot: 4, substantial: 1, duration: '2.5–3 hr', description: 'When canapes are the main meal.' },
];

/* ── Inline Calendar Picker ── */
const CalendarPicker = ({ value, onChange, minDate }) => {
  const [viewDate, setViewDate] = useState(() => {
    if (value) return parseLocalDate(value);
    if (minDate) return new Date(minDate);
    return new Date();
  });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const changeMonth = (delta) => setViewDate(new Date(year, month + delta, 1));

  const isDisabled = (day) => {
    if (!day) return true;
    const d = new Date(year, month, day);
    d.setHours(0,0,0,0);
    const min = new Date(minDate); min.setHours(0,0,0,0);
    return d < min;
  };

  const selectDay = (day) => {
    const d = new Date(year, month, day);
    const str = toLocalDateStr(d);
    onChange(str);
    setOpen(false);
  };

  const selectedStr = value || '';
  const displayText = value
    ? parseLocalDate(value).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'Select a date...';

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-left text-white focus:border-bbq-red outline-none hover:border-gray-500 transition">
        <Calendar className="absolute left-3 top-3.5 text-bbq-red" size={18} />
        <span className={value ? 'text-white' : 'text-gray-500'}>{displayText}</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ChevronLeft size={18} /></button>
            <span className="text-white font-bold text-sm">{viewDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="text-[10px] text-gray-500 font-bold py-1">{d}</div>)}
            {days.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const disabled = isDisabled(day);
              const dayStr = toLocalDateStr(new Date(year, month, day));
              const isSelected = dayStr === selectedStr;
              const isToday = dayStr === toLocalDateStr(new Date());
              return (
                <button key={day} type="button" disabled={disabled}
                  onClick={() => selectDay(day)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition
                    ${disabled ? 'text-gray-700 cursor-not-allowed' : 'hover:bg-bbq-red/30 text-gray-300 cursor-pointer'}
                    ${isSelected ? 'bg-bbq-red text-white' : ''}
                    ${isToday && !isSelected ? 'ring-1 ring-bbq-red text-white' : ''}`}>
                  {day}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-500 mt-2 text-center">Catering requires at least 7 days notice.</p>
        </div>
      )}
    </div>
  );
};

const StorefrontCatering = () => {
  const { menu, checkAvailability, createOrder, user, settings, isDatePastCutoff } = useStorefront();
  const navigate = useNavigate();

  const CATERING_PACKAGES = settings.cateringPackages?.length > 0 ? settings.cateringPackages : DEFAULT_PACKAGES;

  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [pickupTime, setPickupTime] = useState('12:00 PM');
  const [guestCount, setGuestCount] = useState(40);
  const [fulfillment, setFulfillment] = useState('PICKUP');
  const [temperature, setTemperature] = useState('HOT');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isAvailable, setIsAvailable] = useState(null);
  const [selectionMode, setSelectionMode] = useState('CHOICE');
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [pkgSelections, setPkgSelections] = useState({ meats: [], sides: [] });
  const [isPackageConfigOpen, setIsPackageConfigOpen] = useState(false);
  const [customCart, setCustomCart] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cateringView, setCateringView] = useState('self-service'); // 'self-service' | 'cocktail' | 'function'

  const FUNCTION_PACKAGES = settings.functionMenuTiers?.length > 0 ? settings.functionMenuTiers : [];
  const ALL_PACKAGES = [...CATERING_PACKAGES, ...COCKTAIL_PACKAGES, ...FUNCTION_PACKAGES];
  const activePackage = ALL_PACKAGES.find(p => p.id === selectedPackageId);

  const meatsMenu = menu.filter(m => ['Bulk Meats', 'Meats', 'Trays', 'Burgers', 'Family Packs', 'Platters'].includes(m.category));
  const sidesMenu = menu.filter(m => ['Hot Sides', 'Cold Sides', 'Sides', 'Bakery', 'Salads'].includes(m.category));
  const aLaCarteItems = menu.filter(m => m.availableForCatering || m.isCatering);

  const checkDate = () => {
    if (!selectedDate || !pickupTime) return;
    const available = checkAvailability(selectedDate);
    setIsAvailable(available);
    if (available) setTimeout(() => setStep(2), 300);
  };

  const addPackageItem = (id, type, limit) => {
    const list = pkgSelections[type];
    if (list.length < limit) setPkgSelections({ ...pkgSelections, [type]: [...list, id] });
  };

  const removePackageItem = (id, type) => {
    const list = [...pkgSelections[type]];
    const idx = list.indexOf(id);
    if (idx > -1) { list.splice(idx, 1); setPkgSelections({ ...pkgSelections, [type]: list }); }
  };

  const selectPackage = (pkgId) => {
    setSelectedPackageId(pkgId);
    if (pkgId === 'pkg_custom') {
      setPkgSelections({ meats: [], sides: [] });
      setIsPackageConfigOpen(true);
      return;
    }
    // For fixed curated packages (2M2S, 3M3S, etc) open the meat+side picker
    // before heading to confirm — testers said 4/5 want to pick options pre-payment.
    const pkg = CATERING_PACKAGES.find(p => p.id === pkgId);
    if (pkg && (pkg.meatLimit || pkg.sideLimit)) {
      setPkgSelections({ meats: [], sides: [] });
      setIsPackageConfigOpen(true);
      return;
    }
    // Cocktail / function tiers — no meat/side picker, go straight to confirm
    setStep(3);
  };

  const updateCustomCart = (id, delta, moq = 1) => {
    setCustomCart(prev => {
      const current = prev[id] || 0;
      let next = current + delta;
      if (delta > 0 && current === 0) next = Math.max(moq, 1);
      else if (delta < 0 && next < moq) next = 0;
      const updated = { ...prev };
      if (next <= 0) delete updated[id]; else updated[id] = next;
      return updated;
    });
  };

  const calculateCustomTotal = () =>
    Object.entries(customCart).reduce((total, [id, qty]) => {
      const item = menu.find(m => (m._id || m.id) === id);
      return total + (item ? item.price * qty : 0);
    }, 0);

  const calculateTotal = () => {
    let subtotal = selectedPackageId === 'pkg_custom'
      ? calculateCustomTotal()
      : (activePackage ? activePackage.price * guestCount : 0);
    if (fulfillment === 'DELIVERY') subtotal += DELIVERY_FEE;
    return subtotal;
  };

  const handleSubmitRequest = async () => {
    if (!user) { alert('Please login to submit a catering request.'); navigate('/login'); return; }
    setIsSubmitting(true);
    try {
      const total = calculateTotal();
      const deposit = total * 0.5;
      const orderItems = [];

      if (selectedPackageId === 'pkg_custom') {
        Object.entries(customCart).forEach(([id, qty]) => {
          const item = menu.find(m => (m._id || m.id) === id);
          if (item) orderItems.push({ item, quantity: qty });
        });
      } else if (activePackage) {
        // Preserve the guest's meat/side picks on the order so admin + kitchen see them
        const packSelections = {};
        if (pkgSelections.meats?.length) packSelections.Meats = pkgSelections.meats;
        if (pkgSelections.sides?.length) packSelections.Sides = pkgSelections.sides;
        orderItems.push({
          item: {
            id: activePackage.id,
            name: `${activePackage.name} Package (${guestCount}pax)`,
            price: activePackage.price,
            category: 'Catering Packs',
          },
          quantity: guestCount,
          ...(Object.keys(packSelections).length ? { packSelections } : {}),
        });
      }

      await createOrder({
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone || '',
        items: orderItems,
        total,
        depositAmount: deposit,
        status: 'pending',
        cookDay: selectedDate,
        type: 'CATERING',
        pickupTime,
        temperature,
        fulfillmentMethod: fulfillment,
        deliveryAddress: (fulfillment === 'DELIVERY' || fulfillment === 'SETUP') ? deliveryAddress : '',
        deliveryFee: fulfillment === 'DELIVERY' ? DELIVERY_FEE : 0,
        notes: `Catering request: ${guestCount} guests, ${temperature}, ${fulfillment}${fulfillment === 'SETUP' ? ' (on-site set-up fee to be quoted separately)' : ''}`,
      });

      alert(`Catering Request Sent!\n\n50% Deposit: $${deposit.toFixed(2)}\n\nAdmin has been notified. You'll hear back within 24 hours.`);
      navigate('/storefront-profile');
    } catch (err) {
      alert('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = calculateTotal();
  const deposit = total * 0.5;

  const STEPS = ['Logistics', 'Menu', 'Confirm'];

  return (
    <div className="animate-fade-in pb-20">
      {/* Hero */}
      <div className="relative h-[35vh] min-h-[260px] rounded-2xl overflow-hidden shadow-2xl mb-8">
        <div className="absolute inset-0 bg-black/60 z-10" />
        <SmartHeroImg src={settings.diyHeroImage} fallback="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1950&q=80"
          className="absolute inset-0 w-full h-full object-cover" alt="Catering" />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6">
          <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-2 tracking-tight uppercase">
            Catering <span className="text-bbq-red">Request</span>
          </h1>
          <p className="text-gray-200 max-w-xl font-light text-lg">
            Select a curated package and customize your meats and sides.
          </p>
        </div>
      </div>

      {/* Host Rewards Banner */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-yellow-900/40 via-bbq-charcoal to-yellow-900/40 border border-bbq-gold/30 p-4 rounded-xl flex items-center justify-center gap-4 text-center">
          <Ticket className="text-bbq-gold shrink-0" size={22} />
          <div>
            <h4 className="text-white font-bold uppercase tracking-wider text-sm">Host Rewards Program</h4>
            <p className="text-gray-400 text-xs">Spend over <strong>$1,000</strong> on catering and receive a <strong>10% Discount</strong> on your next order!</p>
          </div>
          <Ticket className="text-bbq-gold shrink-0" size={22} />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex justify-center mb-10">
        <div className="flex items-center gap-0">
          {STEPS.map((label, idx) => {
            const num = idx + 1;
            const active = step >= num;
            const current = step === num;
            return (
              <React.Fragment key={num}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${active ? 'bg-bbq-red text-white shadow-[0_0_15px_rgba(217,56,30,0.4)]' : 'bg-gray-800 text-gray-500'}`}>
                    {active && num < step ? <Check size={16} /> : num}
                  </div>
                  <span className={`text-xs mt-1 font-bold uppercase tracking-wide ${current ? 'text-white' : 'text-gray-600'}`}>{label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-16 h-0.5 mb-5 transition-colors ${step > num ? 'bg-bbq-red' : 'bg-gray-800'}`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">

        {/* STEP 1: LOGISTICS */}
        {step === 1 && (
          <div className="max-w-3xl mx-auto bg-bbq-charcoal p-8 rounded-2xl border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-white text-center">Event Logistics</h2>

            {/* Row 1 — the three inline inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-gray-400 mb-2 text-sm font-bold">Event Date</label>
                <CalendarPicker
                  value={selectedDate}
                  onChange={(val) => { setSelectedDate(val); setIsAvailable(null); }}
                  minDate={(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })()}
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-2 text-sm font-bold">Eat Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3.5 text-bbq-red" size={18} />
                  <select value={pickupTime} onChange={e => setPickupTime(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none appearance-none">
                    {['11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'].map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 mb-2 text-sm font-bold">Number of Guests</label>
                <div className="relative">
                  <Users className="absolute left-3 top-3.5 text-bbq-red" size={18} />
                  <input type="number" min="40" value={guestCount} onChange={e => setGuestCount(parseInt(e.target.value) || 40)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none" />
                  <span className="absolute right-4 top-3.5 text-[10px] text-gray-500">Min 40</span>
                </div>
              </div>
            </div>

            {/* Row 2 — Service Type, full width */}
            <div className="mb-6">
              <label className="block text-gray-400 mb-2 text-sm font-bold uppercase tracking-wider">Service Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { val: 'PICKUP',   Icon: ChefHat, label: 'Pickup',         sub: 'Free',   desc: 'Grab it from our HQ',          ring: 'ring-bbq-gold',   glow: 'shadow-[0_0_24px_rgba(251,191,36,0.35)]', iconBg: 'bg-bbq-gold',  iconColor: 'text-black', accent: 'text-bbq-gold' },
                      { val: 'DELIVERY', Icon: Truck,   label: 'Delivery',       sub: `+$${DELIVERY_FEE}`, desc: 'We drop it at your door',      ring: 'ring-blue-500',   glow: 'shadow-[0_0_24px_rgba(59,130,246,0.35)]', iconBg: 'bg-blue-600',  iconColor: 'text-white', accent: 'text-blue-300' },
                      { val: 'SETUP',    Icon: Users,   label: 'On-Site Set Up', sub: 'Quoted', desc: 'We cook & serve at your venue', ring: 'ring-bbq-red',    glow: 'shadow-[0_0_24px_rgba(239,68,68,0.35)]',  iconBg: 'bg-bbq-red',   iconColor: 'text-white', accent: 'text-red-300' },
                    ].map(({ val, Icon, label, sub, desc, ring, glow, iconBg, iconColor, accent }) => {
                      const active = fulfillment === val;
                      return (
                        <button key={val} type="button" onClick={() => setFulfillment(val)}
                          className={`relative p-3 rounded-xl border text-center transition-all duration-200 overflow-hidden group
                            ${active
                              ? `bg-gradient-to-br from-gray-900 to-black border-transparent ring-2 ${ring} ${glow}`
                              : 'bg-gray-900/60 border-gray-800 hover:border-gray-600 hover:bg-gray-900'}`}>
                          <div className="flex flex-col items-center gap-1.5">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${active ? iconBg : 'bg-gray-800'}`}>
                              <Icon size={18} className={active ? iconColor : 'text-gray-400'} />
                            </div>
                            <div className={`font-bold text-sm leading-tight ${active ? 'text-white' : 'text-gray-200'}`}>{label}</div>
                            <div className={`text-[10px] uppercase tracking-wider font-bold ${active ? accent : 'text-gray-500'}`}>{sub}</div>
                            <p className={`text-[10px] leading-snug ${active ? 'text-gray-300' : 'text-gray-500'}`}>{desc}</p>
                          </div>
                          {active && <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${iconBg}`}/>}
                        </button>
                      );
                    })}
              </div>
            </div>

            {/* Row 3 — Temperature, full width */}
            <div>
              <label className="block text-gray-400 mb-2 text-sm font-bold uppercase tracking-wider">Temperature</label>
              <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: 'HOT',  Icon: Flame,     label: 'Ready to Eat', desc: 'Hot & ready to serve',   ring: 'ring-orange-500', glow: 'shadow-[0_0_24px_rgba(249,115,22,0.35)]', iconBg: 'bg-orange-600', accent: 'text-orange-300' },
                      { val: 'COLD', Icon: Snowflake, label: 'Cold',         desc: 'Reheat at home',          ring: 'ring-blue-500',   glow: 'shadow-[0_0_24px_rgba(59,130,246,0.35)]', iconBg: 'bg-blue-600',   accent: 'text-blue-300' },
                    ].map(({ val, Icon, label, desc, ring, glow, iconBg, accent }) => {
                      const active = temperature === val;
                      return (
                        <button key={val} type="button" onClick={() => setTemperature(val)}
                          className={`relative p-3 rounded-xl border text-center transition-all duration-200 overflow-hidden group
                            ${active
                              ? `bg-gradient-to-br from-gray-900 to-black border-transparent ring-2 ${ring} ${glow}`
                              : 'bg-gray-900/60 border-gray-800 hover:border-gray-600 hover:bg-gray-900'}`}>
                          <div className="flex flex-col items-center gap-1.5">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${active ? iconBg : 'bg-gray-800'}`}>
                              <Icon size={18} className={active ? 'text-white' : 'text-gray-400'} />
                            </div>
                            <div className={`font-bold text-sm leading-tight ${active ? 'text-white' : 'text-gray-200'}`}>{label}</div>
                            <p className={`text-[10px] leading-snug ${active ? accent : 'text-gray-500'}`}>{desc}</p>
                          </div>
                          {active && <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${iconBg}`}/>}
                        </button>
                      );
                    })}
              </div>
            </div>

            {(fulfillment === 'DELIVERY' || fulfillment === 'SETUP') && (
              <div className="mt-6">
                <label className="block text-gray-400 mb-2 text-sm font-bold">
                  {fulfillment === 'SETUP' ? 'Event Address' : 'Delivery Address'}
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 text-bbq-red" size={18} />
                  <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="123 Example St, Suburb..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:border-bbq-red outline-none" />
                </div>
                {fulfillment === 'SETUP' && (
                  <p className="text-xs text-gray-500 mt-2">
                    We arrive ~12 hours before service, cook on-site, set up the feasting table, top up during service, and pack down. Set-up fee is quoted separately based on location, guest count and access.
                  </p>
                )}
              </div>
            )}

            <button onClick={checkDate}
              disabled={!selectedDate || !pickupTime || guestCount < 40 || ((fulfillment === 'DELIVERY' || fulfillment === 'SETUP') && !deliveryAddress)}
              className="w-full bg-white text-black font-bold py-4 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition shadow-lg mt-8 text-lg flex items-center justify-center gap-2">
              Next: Choose Menu <ArrowRight size={20} />
            </button>

            {isAvailable === false && (
              <div className="mt-4 p-4 bg-red-900/30 border border-red-600 text-red-200 rounded-lg flex items-center justify-center gap-2">
                <AlertCircle size={18} /> Sorry, this date is unavailable. We require at least 7 days notice and may be fully booked. Please choose another date.
              </div>
            )}
          </div>
        )}

        {/* STEP 2: SELECTION */}
        {step === 2 && (
          <div>
            {/* Catering view tabs */}
            {!isPackageConfigOpen && (
              <div className="max-w-3xl mx-auto mb-10">
                <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-black/40 border border-gray-800 rounded-xl p-1.5">
                  {[
                    { id: 'self-service', label: 'Self Service & Feasting Table', Icon: ChefHat },
                    { id: 'cocktail',     label: 'Cocktail Menu',                 Icon: Coffee },
                    { id: 'function',     label: 'Function Menu',                 Icon: UtensilsCrossed },
                  ].map(({ id, label, Icon }) => {
                    const active = cateringView === id;
                    return (
                      <button key={id} type="button"
                        onClick={() => { setCateringView(id); setSelectionMode('CHOICE'); setIsPackageConfigOpen(false); setSelectedPackageId(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition ${active ? 'bg-bbq-red text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}>
                        <Icon size={16}/> {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === COCKTAIL MENU VIEW === */}
            {cateringView === 'cocktail' && !isPackageConfigOpen && (
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                  <h2 className="text-3xl md:text-4xl font-display font-bold text-white uppercase tracking-wider">Cocktail Menu</h2>
                  <p className="text-gray-400 text-sm mt-2 max-w-2xl mx-auto">
                    Built for birthdays, engagement parties, corporate functions, weddings and backyard celebrations.
                    Choose the vibe and we'll balance the menu for your crowd.
                  </p>
                </div>
                <div className="space-y-4">
                  {COCKTAIL_PACKAGES.map(pkg => (
                    <div key={pkg.id} className="bg-bbq-charcoal rounded-2xl border border-gray-800 hover:border-purple-700/60 transition p-6 flex flex-col md:flex-row md:items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <h3 className="text-xl font-display font-bold text-white">{pkg.name}</h3>
                          <span className="text-[10px] bg-purple-900/50 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{pkg.pieces} Pieces</span>
                        </div>
                        <p className="text-gray-400 text-sm mb-3">{pkg.description}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                          {pkg.cold > 0 && <span className="bg-blue-900/30 text-blue-300 border border-blue-800 px-2 py-1 rounded-full">{pkg.cold} Cold</span>}
                          {pkg.hot > 0 && <span className="bg-orange-900/30 text-orange-300 border border-orange-800 px-2 py-1 rounded-full">{pkg.hot} Hot</span>}
                          {pkg.substantial > 0 && <span className="bg-amber-900/30 text-amber-300 border border-amber-800 px-2 py-1 rounded-full">{pkg.substantial} Substantial</span>}
                          {pkg.duration && <span className="bg-gray-900/50 text-gray-400 border border-gray-700 px-2 py-1 rounded-full">{pkg.duration}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-purple-400">${pkg.price}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold">Per Person</div>
                        <button onClick={() => selectPackage(pkg.id)}
                          className="mt-3 bg-white text-black font-bold px-5 py-2 rounded-lg hover:bg-purple-400 hover:text-white transition flex items-center gap-2 text-sm">
                          Select <ArrowRight size={14}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 text-center mt-6">Cocktail pricing is per person. 50% deposit required to secure booking.</p>
              </div>
            )}

            {/* === FUNCTION MENU VIEW === */}
            {cateringView === 'function' && !isPackageConfigOpen && (
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                  <h2 className="text-3xl md:text-4xl font-display font-bold text-white uppercase tracking-wider">Function Menu</h2>
                  <p className="text-gray-400 text-sm mt-2 max-w-2xl mx-auto">
                    Plated and alternate-drop options for weddings, awards nights, and formal functions.
                  </p>
                </div>
                {FUNCTION_PACKAGES.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-gray-800 rounded-2xl text-gray-500">
                    <UtensilsCrossed size={40} className="mx-auto mb-3 opacity-40"/>
                    <p className="font-bold text-gray-400">Function Menu coming soon</p>
                    <p className="text-xs mt-1">Please use the Cocktail Menu or Self Service options, or contact us directly for a custom quote.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {FUNCTION_PACKAGES.map(pkg => (
                      <div key={pkg.id} className="bg-bbq-charcoal rounded-2xl border border-gray-800 hover:border-bbq-gold/60 transition p-6 flex flex-col md:flex-row md:items-center gap-6">
                        <div className="flex-1">
                          <h3 className="text-xl font-display font-bold text-white mb-1">{pkg.name}</h3>
                          <p className="text-gray-400 text-sm mb-3">{pkg.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-bbq-gold">${pkg.price}</div>
                          <div className="text-[10px] text-gray-500 uppercase font-bold">Per Person</div>
                          <button onClick={() => selectPackage(pkg.id)}
                            className="mt-3 bg-white text-black font-bold px-5 py-2 rounded-lg hover:bg-bbq-gold transition flex items-center gap-2 text-sm">
                            Select <ArrowRight size={14}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === SELF SERVICE & FEASTING TABLE VIEW === */}
            {cateringView === 'self-service' && selectionMode === 'CHOICE' && (
              <div className="max-w-5xl mx-auto">
                <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider text-center mb-10">How Do You Want To Order?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    {
                      onClick: () => setSelectionMode('PACKAGES'),
                      img: settings.diyCardPackageImage || 'https://images.unsplash.com/photo-1544025162-d76690b67f11?auto=format&fit=crop&w=800&q=80',
                      accentClass: 'group-hover:border-bbq-gold',
                      iconBg: 'bg-bbq-gold',
                      Icon: Package,
                      iconColor: 'text-black',
                      title: 'Curated Packages',
                      titleHover: 'group-hover:text-bbq-gold',
                      desc: 'Per-head pricing with optimal meat & side combinations. Easiest for groups.',
                      btnColor: 'text-bbq-gold',
                      btnLabel: 'View Packages',
                    },
                    {
                      onClick: () => selectPackage('pkg_custom'),
                      img: settings.diyCardCustomImage || 'https://images.unsplash.com/photo-1529193591184-b1d580690dd0?auto=format&fit=crop&w=800&q=80',
                      accentClass: 'group-hover:border-bbq-red',
                      iconBg: 'bg-bbq-red',
                      Icon: ChefHat,
                      iconColor: 'text-white',
                      title: 'Build Your Own',
                      titleHover: 'group-hover:text-bbq-red',
                      desc: 'Total control. Order bulk meats by KG and sides by the tray.',
                      btnColor: 'text-bbq-red',
                      btnLabel: 'Start Building',
                    }
                  ].map(({ onClick, img, accentClass, iconBg, Icon, iconColor, title, titleHover, desc, btnColor, btnLabel }) => (
                    <div key={title} onClick={onClick}
                      className={`bg-bbq-charcoal rounded-2xl border border-gray-800 overflow-hidden flex flex-col group ${accentClass} transition shadow-xl relative h-[380px] cursor-pointer`}>
                      <img src={img} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={title} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                      <div className="relative z-10 flex-1 p-8 flex flex-col justify-end h-full">
                        <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                          <Icon size={22} className={iconColor} />
                        </div>
                        <h3 className={`text-3xl font-display font-bold text-white mb-2 uppercase tracking-wide ${titleHover} transition-colors`}>{title}</h3>
                        <p className="text-gray-300 text-sm mb-6">{desc}</p>
                        <span className={`${btnColor} font-bold flex items-center gap-2 uppercase tracking-wide text-sm group-hover:translate-x-2 transition-transform duration-300`}>
                          {btnLabel} <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="max-w-4xl mx-auto mt-6 space-y-2">
                  <p className="text-xs text-gray-500 text-center">* Ribs and Pork Belly attract a $4/pp surcharge. All prices exclude GST.</p>
                  <p className="text-xs text-gray-500 text-center">Price includes full set up, sliced bread or tortillas, disposable cutlery, plates and napkins. 50% deposit required to secure booking.</p>
                </div>
                <div className="text-center mt-4">
                  <button onClick={() => setStep(1)} className="text-gray-500 hover:text-white underline text-sm transition">Back to Logistics</button>
                </div>
              </div>
            )}

            {cateringView === 'self-service' && selectionMode === 'PACKAGES' && (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <button onClick={() => setSelectionMode('CHOICE')} className="text-gray-400 hover:text-white flex items-center gap-2 font-bold text-sm transition"><ArrowLeft size={16} /> Back</button>
                  <h2 className="text-2xl font-bold text-white">Select a Package</h2>
                  <div className="w-16"></div>
                </div>
                <div className="space-y-6 max-w-4xl mx-auto">
                  {CATERING_PACKAGES.map((pkg, idx) => (
                    <div key={pkg.id} className="bg-bbq-charcoal rounded-2xl border border-gray-800 overflow-hidden flex flex-col md:flex-row group hover:border-gray-600 transition shadow-xl relative">
                      <div className="absolute top-4 left-4 bg-bbq-gold text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider z-10">Best Value</div>
                      <div className="w-full md:w-1/3 h-48 md:h-auto relative">
                        <img src={pkg.image || FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]} onError={e => { e.target.src = FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]; }} className="w-full h-full object-cover" alt={pkg.name} />
                      </div>
                      <div className="flex-1 p-6 flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-2xl font-display font-bold text-white">{pkg.name}</h3>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-bbq-gold">${pkg.price}</div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Per Head</div>
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm mb-4">{pkg.description}</p>
                        <div className="flex flex-wrap gap-3 mb-5">
                          <div className="bg-black/30 px-3 py-1.5 rounded text-xs font-bold text-gray-300 flex items-center gap-2">
                            <CheckCircle size={12} className="text-green-500" /> Min {pkg.minPax} pax
                          </div>
                          <div className="bg-black/30 px-3 py-1.5 rounded text-xs font-bold text-gray-300 flex items-center gap-2">
                            <CheckCircle size={12} className="text-green-500" /> {pkg.meatLimit} Meat choices
                          </div>
                          <div className="bg-black/30 px-3 py-1.5 rounded text-xs font-bold text-gray-300 flex items-center gap-2">
                            <CheckCircle size={12} className="text-green-500" /> {pkg.sideLimit} Side choices
                          </div>
                        </div>
                        <button onClick={() => selectPackage(pkg.id)}
                          className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-bbq-gold transition flex justify-center items-center gap-2 uppercase tracking-wide text-sm">
                          Select Package <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fixed-package Meat + Side picker (for 2M2S / 3M3S / etc) */}
            {isPackageConfigOpen && activePackage && selectedPackageId !== 'pkg_custom' && (
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                  <button onClick={() => { setIsPackageConfigOpen(false); setSelectedPackageId(null); setSelectionMode('CHOICE'); }}
                    className="text-gray-400 hover:text-white flex items-center gap-2 font-bold text-sm"><ArrowLeft size={16} /> Back</button>
                  <h2 className="text-xl md:text-2xl font-bold text-white text-center flex-1">{activePackage.name}</h2>
                  <div className="bg-black/40 px-4 py-2 rounded-lg border border-gray-700 text-right">
                    <span className="text-xs text-gray-500">Per Head</span>
                    <p className="text-bbq-gold font-bold">${activePackage.price}</p>
                  </div>
                </div>

                <p className="text-gray-400 text-sm text-center mb-8 max-w-2xl mx-auto">
                  Pick your meats and sides below. You can still change these before we confirm your booking.
                </p>

                {/* MEATS */}
                {activePackage.meatLimit > 0 && (
                  <div className="mb-8">
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                        Choose {activePackage.meatLimit} Meat{activePackage.meatLimit > 1 ? 's' : ''}
                      </h3>
                      <span className={`text-sm font-bold ${pkgSelections.meats.length === activePackage.meatLimit ? 'text-green-400' : 'text-gray-400'}`}>
                        {pkgSelections.meats.length} / {activePackage.meatLimit} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CATERING_MEATS.map(name => {
                        const selectedCount = pkgSelections.meats.filter(x => x === name).length;
                        const full = pkgSelections.meats.length >= activePackage.meatLimit;
                        return (
                          <div key={name} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition ${selectedCount > 0 ? 'bg-bbq-red/10 border-bbq-red/50' : 'bg-bbq-charcoal border-gray-800'}`}>
                            <span className="text-sm text-gray-200">{name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" disabled={selectedCount === 0}
                                onClick={() => removePackageItem(name, 'meats')}
                                className="w-7 h-7 rounded-full bg-gray-800 text-gray-300 disabled:opacity-30 hover:bg-gray-700 flex items-center justify-center"><Minus size={12}/></button>
                              <span className="w-5 text-center text-white font-bold text-sm">{selectedCount}</span>
                              <button type="button" disabled={full}
                                onClick={() => addPackageItem(name, 'meats', activePackage.meatLimit)}
                                className="w-7 h-7 rounded-full bg-bbq-red text-white disabled:opacity-30 hover:bg-red-600 flex items-center justify-center"><Plus size={12}/></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SIDES */}
                {activePackage.sideLimit > 0 && (
                  <div className="mb-8">
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                        Choose {activePackage.sideLimit} Side{activePackage.sideLimit > 1 ? 's' : ''}
                      </h3>
                      <span className={`text-sm font-bold ${pkgSelections.sides.length === activePackage.sideLimit ? 'text-green-400' : 'text-gray-400'}`}>
                        {pkgSelections.sides.length} / {activePackage.sideLimit} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CATERING_SIDES.map(name => {
                        const selectedCount = pkgSelections.sides.filter(x => x === name).length;
                        const full = pkgSelections.sides.length >= activePackage.sideLimit;
                        return (
                          <div key={name} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition ${selectedCount > 0 ? 'bg-bbq-gold/10 border-bbq-gold/50' : 'bg-bbq-charcoal border-gray-800'}`}>
                            <span className="text-sm text-gray-200">{name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" disabled={selectedCount === 0}
                                onClick={() => removePackageItem(name, 'sides')}
                                className="w-7 h-7 rounded-full bg-gray-800 text-gray-300 disabled:opacity-30 hover:bg-gray-700 flex items-center justify-center"><Minus size={12}/></button>
                              <span className="w-5 text-center text-white font-bold text-sm">{selectedCount}</span>
                              <button type="button" disabled={full}
                                onClick={() => addPackageItem(name, 'sides', activePackage.sideLimit)}
                                className="w-7 h-7 rounded-full bg-bbq-gold text-black disabled:opacity-30 hover:bg-yellow-400 flex items-center justify-center"><Plus size={12}/></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  disabled={(activePackage.meatLimit > 0 && pkgSelections.meats.length < activePackage.meatLimit) ||
                            (activePackage.sideLimit > 0 && pkgSelections.sides.length < activePackage.sideLimit)}
                  onClick={() => { setIsPackageConfigOpen(false); setStep(3); }}
                  className="w-full bg-white text-black font-bold py-4 rounded-lg hover:bg-bbq-gold disabled:opacity-50 disabled:cursor-not-allowed transition text-lg flex items-center justify-center gap-2">
                  Continue to Confirm <ArrowRight size={18}/>
                </button>
                <p className="text-xs text-gray-500 text-center mt-3">
                  You'll see the full quote and 50% deposit on the next step. No payment yet.
                </p>
              </div>
            )}

            {/* Custom A La Carte Builder */}
            {isPackageConfigOpen && selectedPackageId === 'pkg_custom' && (
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => { setIsPackageConfigOpen(false); setSelectionMode('CHOICE'); }} className="text-gray-400 hover:text-white flex items-center gap-2 font-bold text-sm"><ArrowLeft size={16} /> Back</button>
                  <h2 className="text-2xl font-bold text-white">Build Your Order</h2>
                  <div className="bg-black/40 px-4 py-2 rounded-lg border border-gray-700">
                    <span className="text-xs text-gray-500">Custom Total</span>
                    <p className="text-bbq-gold font-bold">${calculateCustomTotal().toFixed(2)}</p>
                  </div>
                </div>
                {aLaCarteItems.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-2xl text-gray-500">
                    <p>No catering items available. Contact us directly.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aLaCarteItems.map(item => {
                      const id = item._id || item.id;
                      const qty = customCart[id] || 0;
                      return (
                        <div key={id} className="bg-bbq-charcoal border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-gray-700 transition">
                          <div className="flex items-center gap-4">
                            {item.image && <img src={item.image} className="w-16 h-16 rounded-lg object-cover border border-gray-700" alt={item.name} />}
                            <div>
                              <h4 className="font-bold text-white">{item.name}</h4>
                              <p className="text-xs text-gray-500">{item.category}</p>
                              <p className="text-bbq-gold font-bold text-sm">${item.price.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <button onClick={() => updateCustomCart(id, -1, item.cateringMinQty || 1)}
                              className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition">
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center font-bold text-white">{qty}</span>
                            <button onClick={() => updateCustomCart(id, 1, item.cateringMinQty || 1)}
                              className="w-8 h-8 rounded-full bg-gray-800 hover:bg-bbq-red flex items-center justify-center transition">
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {Object.keys(customCart).length > 0 && (
                  <button onClick={() => setStep(3)}
                    className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition shadow-lg mt-8 text-lg flex items-center justify-center gap-2">
                    Review Order <ArrowRight size={20} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: CONFIRMATION */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white text-center mb-8">Confirm Your Request</h2>
            <div className="bg-bbq-charcoal border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
              {/* Summary */}
              <div className="p-6 border-b border-gray-800 space-y-3">
                {[
                  ['Event Date', selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'],
                  ['Eat Time', pickupTime],
                  ['Guests', `${guestCount} people`],
                  ['Service',
                    fulfillment === 'PICKUP'   ? 'Pickup (Free)' :
                    fulfillment === 'DELIVERY' ? `Delivery to ${deliveryAddress}` :
                                                 `On-Site Set Up at ${deliveryAddress} (fee quoted separately)`],
                  ['Temperature', temperature === 'HOT' ? 'Ready to Eat (Hot)' : 'Cold (Reheat at home)'],
                  ['Package', activePackage ? `${activePackage.name} @ $${activePackage.price}/head` : 'Custom Build'],
                ].map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-500">{key}</span>
                    <span className="text-white font-medium text-right max-w-[60%]">{val}</span>
                  </div>
                ))}
              </div>

              {/* Pricing */}
              <div className="p-6 border-b border-gray-800 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white">${(total - (fulfillment === 'DELIVERY' ? DELIVERY_FEE : 0)).toFixed(2)}</span>
                </div>
                {fulfillment === 'DELIVERY' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Delivery</span>
                    <span className="text-white">${DELIVERY_FEE.toFixed(2)}</span>
                  </div>
                )}
                {fulfillment === 'SETUP' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Set-Up Fee</span>
                    <span className="text-gray-400 italic">Quoted on approval</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-800">
                  <span className="text-white">Total</span>
                  <span className="text-bbq-gold">${total.toFixed(2)}</span>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-800 p-3 rounded-lg mt-2">
                  <p className="text-xs text-yellow-200 text-center">
                    A <strong>50% deposit of ${deposit.toFixed(2)}</strong> will be required upon approval.
                    Remaining balance due on the day.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 space-y-3">
                <button onClick={handleSubmitRequest} disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-bbq-red to-red-700 text-white font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(217,56,30,0.4)] transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2">
                  {isSubmitting ? 'Sending Request...' : 'Send Catering Request'}
                  {!isSubmitting && <ArrowRight size={20} />}
                </button>
                <button onClick={() => setStep(2)} className="w-full text-gray-500 hover:text-white text-sm underline transition">
                  ← Back to Menu Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorefrontCatering;
