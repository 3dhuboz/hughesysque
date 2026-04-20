import React, { useState } from 'react';
import { useStorefront } from '../context/AppContext';
import { parseLocalDate, isEventPastCutoff } from '../utils/dateUtils';
import SmartHeroImg from '../components/SmartHeroImg';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Package, Users, Calendar, X, Plus, Minus, Check, Truck, Info, Clock, Utensils, AlertCircle } from 'lucide-react';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80';

// --- ITEM DETAILS MODAL ---
const ItemDetailsModal = ({ item, onClose, onAddToCart }) => {
  const [qty, setQty] = useState(item.minQuantity || 1);
  const [selectedOption, setSelectedOption] = useState(
    item.preparationOptions?.length > 0 ? item.preparationOptions[0] : ''
  );
  const [packSelections, setPackSelections] = useState(() => {
    const init = {};
    if (item.isPack && item.packGroups) {
      item.packGroups.forEach(g => init[g.name] = []);
    }
    return init;
  });

  const handleIncrement = () => setQty(q => q + 1);
  const handleDecrement = () => setQty(q => Math.max(item.minQuantity || 1, q - 1));

  const addPackOption = (groupName, option, limit) => {
    setPackSelections(prev => {
      const current = prev[groupName] || [];
      if (current.length >= limit) return prev;
      return { ...prev, [groupName]: [...current, option] };
    });
  };

  const removePackOption = (groupName, option) => {
    setPackSelections(prev => {
      const current = prev[groupName] || [];
      const idx = current.indexOf(option);
      if (idx === -1) return prev;
      const newArr = [...current];
      newArr.splice(idx, 1);
      return { ...prev, [groupName]: newArr };
    });
  };

  const isPackComplete = !item.isPack || (item.packGroups?.every(g => (packSelections[g.name]?.length || 0) === g.limit));

  const handleAdd = () => {
    onAddToCart(qty, item.isPack ? packSelections : undefined, selectedOption);
    onClose();
  };

  const handleImageError = (e) => { e.target.src = PLACEHOLDER_IMG; };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-bbq-charcoal w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden relative shadow-2xl flex flex-col border border-gray-700" style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-black/50 p-2 rounded-full text-white hover:bg-white hover:text-black transition">
          <X size={20} />
        </button>
        <div className="h-64 shrink-0 relative">
          <img src={item.image || PLACEHOLDER_IMG} alt={item.name} className="w-full h-full object-cover" onError={handleImageError} />
          <div className="absolute inset-0 bg-gradient-to-t from-bbq-charcoal to-transparent"></div>
          <div className="absolute bottom-4 left-6 right-6">
            <h2 className="text-3xl font-display font-bold text-white leading-none drop-shadow-md">{item.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-bold text-bbq-gold">${item.price}</span>
              {item.unit && <span className="text-gray-400 text-sm">/ {item.unit}</span>}
            </div>
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <p className="text-gray-300 leading-relaxed text-lg">{item.description}</p>
          {!item.isPack && item.preparationOptions?.length > 0 && (
            <div>
              <h4 className="font-bold text-white mb-2 uppercase text-sm tracking-wider">Select Option</h4>
              <div className="flex flex-wrap gap-2">
                {item.preparationOptions.map(opt => (
                  <button key={opt} onClick={() => setSelectedOption(opt)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${selectedOption === opt ? 'bg-white text-black border-white' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {item.isPack && item.packGroups && (
            <div className="space-y-6 bg-black/20 p-4 rounded-xl border border-white/5">
              {item.packGroups.map(group => {
                const current = packSelections[group.name] || [];
                const remaining = group.limit - current.length;
                return (
                  <div key={group.name}>
                    <div className="flex justify-between items-end mb-3 border-b border-white/10 pb-1">
                      <h4 className="font-bold text-bbq-gold uppercase text-sm tracking-wider">{group.name}</h4>
                      <span className={`text-xs font-bold ${remaining === 0 ? 'text-green-500' : 'text-gray-400'}`}>
                        {remaining === 0 ? <span className="flex items-center gap-1"><Check size={12} /> Complete</span> : `Choose ${remaining} more`}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {group.options.map(opt => {
                        const count = current.filter(c => c === opt).length;
                        return (
                          <div key={opt} className="bg-gray-800 p-2 rounded flex justify-between items-center border border-gray-700">
                            <span className="text-sm text-gray-200">{opt}</span>
                            <div className="flex items-center gap-2 bg-black/40 rounded p-1">
                              <button onClick={() => removePackOption(group.name, opt)} disabled={count === 0}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 border border-gray-600 rounded">-</button>
                              <span className="text-sm font-bold w-4 text-center">{count}</span>
                              <button onClick={() => addPackOption(group.name, opt, group.limit)} disabled={remaining === 0}
                                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 border border-gray-600 rounded">+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-6 bg-black/40 border-t border-white/10">
          <div className="flex gap-4">
            <div className="flex items-center bg-gray-800 rounded-xl p-1 border border-gray-600">
              <button onClick={handleDecrement} className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"><Minus size={18} /></button>
              <div className="w-12 text-center font-bold text-white text-lg">{qty}</div>
              <button onClick={handleIncrement} className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"><Plus size={18} /></button>
            </div>
            <button onClick={handleAdd} disabled={!isPackComplete}
              className="flex-1 bg-bbq-red text-white font-bold text-lg rounded-xl hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2">
              Add to Order <span className="bg-black/20 px-2 py-0.5 rounded text-sm">${(item.price * qty).toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StorefrontMenu = () => {
  const { menu, addToCart, user, cart, calendarEvents, selectedOrderDate, setSelectedOrderDate, settings, isDatePastCutoff } = useStorefront();

  const orderEvents = calendarEvents
    .filter(evt => {
      if (evt.type !== 'ORDER_PICKUP' && evt.type !== 'PUBLIC_EVENT') return false;
      if (parseLocalDate(evt.date) < new Date(new Date().setHours(0, 0, 0, 0))) return false;
      if (isEventPastCutoff(evt)) return false;
      return true;
    })
    .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));

  const selectedEvent = orderEvents.find(e => e.date === selectedOrderDate);
  const [selectedItem, setSelectedItem] = useState(null);
  const [recentlyAdded, setRecentlyAdded] = useState(null);

  const availableMenu = menu.filter(m => {
    // Catering-only items belong on the /catering page, not the normal menu.
    // These items are flagged one of three ways historically — so catch them all:
    //   1. isCatering: true  (new type flag)
    //   2. category === 'Catering' | 'Catering Packs'  (actual live-DB categories)
    //   3. availableForCatering + a cateringCategory (Meat/Side/Extra/Drink/Dessert)
    //      — these are catering-only line items sold per kg / per tray
    if (m.isCatering) return false;
    if (m.category === 'Catering' || m.category === 'Catering Packs') return false;
    if (m.availableForCatering && m.cateringCategory) return false;
    if (['Rubs & Sauces', 'Merch'].includes(m.category)) return true;
    if (!selectedOrderDate) return true;
    if (m.availabilityType === 'everyday' || !m.availabilityType) return true;
    if (m.availabilityType === 'specific_date' && m.specificDate === selectedOrderDate) return true;
    return false;
  });

  const categories = Array.from(new Set(availableMenu.map(m => m.category))).filter(Boolean);
  const sortedCategories = categories.sort((a, b) => {
    if (a === 'Family Packs') return -1;
    if (b === 'Family Packs') return 1;
    const isMerchA = ['Rubs & Sauces', 'Merch'].includes(a);
    const isMerchB = ['Rubs & Sauces', 'Merch'].includes(b);
    if (isMerchA && !isMerchB) return 1;
    if (!isMerchA && isMerchB) return -1;
    return 0;
  });

  const handleImageError = (e) => { e.target.src = PLACEHOLDER_IMG; };

  const handleItemClick = (item) => {
    const isShippable = ['Rubs & Sauces', 'Merch'].includes(item.category);
    if (!selectedOrderDate && !isShippable && user?.role !== 'ADMIN') {
      const el = document.getElementById('date-selector-bar');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      alert("Please select a pickup date above to order fresh food.");
      return;
    }
    setSelectedItem(item);
  };

  const triggerAddedFeedback = (itemId) => {
    setRecentlyAdded(itemId);
    setTimeout(() => setRecentlyAdded(null), 2000);
  };

  const handleAddToCartFromModal = (qty, packSelections, option) => {
    if (selectedItem) {
      const itemToAdd = { ...selectedItem, packSelections, selectedOption: option };
      addToCart(itemToAdd, qty, selectedOrderDate || undefined);
      triggerAddedFeedback(selectedItem._id || selectedItem.id);
    }
  };

  const handleDateSelect = (date) => {
    if (selectedOrderDate === date) setSelectedOrderDate(null);
    else setSelectedOrderDate(date);
  };

  const getCatId = (cat) => `cat-${(cat || 'unknown').replace(/\s+/g, '-')}`;

  const packImages = [
    settings.menuHeroImage || "https://images.unsplash.com/photo-1544025162-d76690b67f11?auto=format&fit=crop&w=800&q=80",
    settings.diyCardPackageImage || "https://images.unsplash.com/photo-1529193591184-b1d580690dd0?auto=format&fit=crop&w=800&q=80",
    settings.diyCardCustomImage || "https://images.unsplash.com/photo-1593030668930-813f11244a1c?auto=format&fit=crop&w=800&q=80",
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-24 relative animate-fade-in">
      <div className="lg:col-span-3 space-y-8">

        {/* --- HERO COLLAGE --- */}
        <div className="rounded-3xl overflow-hidden relative border border-white/10 shadow-2xl group min-h-[450px] flex flex-col md:flex-row">
          <div className="relative z-20 p-8 md:p-12 flex flex-col justify-center items-start w-full md:w-1/2 bg-gradient-to-r from-purple-900/95 to-black/80">
            <div className="bg-yellow-500 text-black font-black uppercase tracking-widest text-xs px-3 py-1 rounded mb-4 shadow-[0_0_20px_rgba(234,179,8,0.5)] animate-pulse">
              Best Value
            </div>
            <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-4 leading-none drop-shadow-xl">
              FEED THE <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">WHOLE MOB</span>
            </h2>
            <p className="text-gray-200 text-lg md:text-xl font-medium max-w-lg mb-8 leading-relaxed">
              Save time and money with our curated packs. Meats, sides, and drinks bundled for the ultimate feast.
            </p>
            <button onClick={() => { const el = document.getElementById(getCatId('Family Packs')); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
              className="bg-white text-black font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center gap-3 hover:bg-gray-200 transition-all shadow-xl">
              <Package size={20} /> View Packs
            </button>
          </div>
          <div className="relative w-full md:w-1/2 min-h-[300px] md:min-h-full">
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-2 bg-black">
              <div className="row-span-2 relative overflow-hidden rounded-xl">
                <SmartHeroImg src={settings.menuHeroImage} fallback={packImages[0]} className="w-full h-full object-cover hover:scale-105 transition duration-700" alt="BBQ Platter" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              </div>
              <div className="relative overflow-hidden rounded-xl">
                <SmartHeroImg src={settings.diyCardPackageImage} fallback={packImages[1]} className="w-full h-full object-cover hover:scale-105 transition duration-700" alt="Brisket" />
              </div>
              <div className="relative overflow-hidden rounded-xl">
                <SmartHeroImg src={settings.diyCardCustomImage} fallback={packImages[2]} className="w-full h-full object-cover hover:scale-105 transition duration-700" alt="Ribs" />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/95 via-transparent to-transparent md:block hidden pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-purple-900/95 via-transparent to-transparent md:hidden block pointer-events-none"></div>
          </div>
        </div>

        {/* --- DATE SELECTOR BAR --- */}
        <div id="date-selector-bar" className="sticky top-20 md:top-24 z-30 bg-bbq-charcoal/95 border-y border-gray-700 p-4 -mx-4 md:mx-0 md:rounded-xl shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 transition-all" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className={`p-2 rounded-lg text-white transition-colors ${selectedOrderDate ? 'bg-bbq-red' : 'bg-gray-700'}`}>
              <Calendar size={24} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                {selectedOrderDate ? 'Ordering For' : 'Menu Mode'}
              </div>
              <div className="text-white font-bold text-lg leading-none flex items-center gap-2">
                {selectedEvent ? (
                  <>
                    {parseLocalDate(selectedEvent.date).toLocaleDateString('en-AU', { weekday: 'long', month: 'short', day: 'numeric' })}
                    <button onClick={() => setSelectedOrderDate(null)} className="bg-gray-800 rounded-full p-0.5 hover:bg-gray-600 transition" title="Clear Date">
                      <X size={12} />
                    </button>
                  </>
                ) : 'Viewing Full Menu'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto max-w-full w-full md:w-auto pb-2 md:pb-0">
            {orderEvents.map(evt => (
              <button key={evt.id} onClick={() => handleDateSelect(evt.date)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-sm transition border ${selectedOrderDate === evt.date ? 'bg-white text-black border-white shadow-lg transform scale-105' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white'}`}>
                {parseLocalDate(evt.date).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                <span className="text-[10px] ml-1 opacity-70 block">{evt.type === 'PUBLIC_EVENT' ? `📍 ${evt.location || 'Pop-up'}` : evt.location}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CUTOFF WARNING - only show when cook days exist */}
        {orderEvents.some(e => e.type === 'ORDER_PICKUP') && (
          <div className="bg-red-900/30 border border-red-800 p-3 rounded-lg flex items-center gap-3 mx-auto max-w-2xl">
            <AlertCircle className="text-red-500 shrink-0" size={20} />
            <p className="text-red-200 text-xs font-bold leading-relaxed">
              IMPORTANT: Pre-orders close 24 hours before cook days. Pop-up events accept walk-ups until 1 hour before close. Don't miss out!
            </p>
          </div>
        )}

        {!selectedOrderDate && (
          <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-full text-blue-400 shrink-0"><ShoppingBag size={20} /></div>
              <div>
                <p className="text-white font-bold text-sm">Browsing Full Menu</p>
                <p className="text-xs text-blue-300">Select a date above to order food. Pantry items can be ordered anytime.</p>
              </div>
            </div>
          </div>
        )}

        {/* --- MENU GRID --- */}
        {availableMenu.length === 0 ? (
          <div className="text-center py-20 bg-bbq-charcoal/50 rounded-xl border border-gray-800 border-dashed">
            <p className="text-gray-500 text-lg">Menu items loading or not available for this selection.</p>
          </div>
        ) : (
          sortedCategories.map(cat => (
            <div key={cat} id={getCatId(cat)} className="space-y-6 pt-8 scroll-mt-32">
              <div className="flex items-center gap-4">
                <h3 className="text-3xl font-display font-bold text-white uppercase tracking-wide flex items-center gap-3">
                  {cat === 'Family Packs' && <Package className="text-purple-400" />}
                  {['Rubs & Sauces', 'Merch'].includes(cat) && <Truck className="text-bbq-gold" />}
                  {cat}
                </h3>
                <div className="h-px bg-gray-800 flex-1"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {availableMenu.filter(m => m.category === cat).map(item => {
                  const itemId = item._id || item.id;
                  return (
                    <div key={itemId} onClick={() => handleItemClick(item)}
                      className={`group relative bg-[#1a1a1a] rounded-2xl overflow-hidden border transition-all duration-300 shadow-xl flex flex-col h-full cursor-pointer transform hover:-translate-y-1 ${item.isPack ? 'border-purple-500/30 hover:border-purple-500' : 'border-white/5 hover:border-bbq-red/50 hover:shadow-red-900/20'}`}>
                      <div className="w-full h-48 relative overflow-hidden shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10" />
                        <img src={item.image || PLACEHOLDER_IMG} alt={item.name} onError={handleImageError}
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-700" />
                        {item.isPack && (
                          <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-20">FAMILY PACK</div>
                        )}
                        {['Rubs & Sauces', 'Merch'].includes(item.category) && (
                          <div className="absolute top-2 left-2 bg-bbq-gold text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg z-20 flex items-center gap-1">
                            <Truck size={10} /> SHIPPABLE
                          </div>
                        )}
                        {item.availabilityType === 'specific_date' && (
                          <div className="absolute bottom-2 left-2 bg-black/80 text-bbq-gold text-[10px] font-bold px-2 py-1 rounded border border-bbq-gold z-20" style={{ backdropFilter: 'blur(8px)' }}>
                            {item.specificDate ? parseLocalDate(item.specificDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }) : 'Special'} ONLY
                          </div>
                        )}
                      </div>
                      <div className="flex-1 p-5 flex flex-col justify-between relative">
                        <div>
                          <div className="flex justify-between items-start mb-2 relative z-10">
                            <h4 className="text-xl font-display font-bold text-white leading-tight pr-4 group-hover:text-bbq-gold transition-colors">{item.name}</h4>
                            <span className="text-white font-display font-bold text-xl">${item.price}</span>
                          </div>
                          <p className="text-sm text-gray-400 leading-relaxed line-clamp-3 mb-4">{item.description}</p>
                        </div>
                        {user?.role !== 'ADMIN' && (
                          <div className="mt-auto flex justify-between items-center border-t border-white/5 pt-4">
                            {item.isPack ? (
                              <span className="text-xs text-purple-400 font-bold flex items-center gap-1"><Users size={12} /> Great for groups</span>
                            ) : <span></span>}
                            <button className={`ml-auto px-5 py-2 rounded-lg transition-all duration-300 flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${recentlyAdded === itemId
                              ? 'bg-green-600 text-white border border-green-500 scale-105'
                              : item.isPack ? 'bg-purple-900/50 text-white border border-purple-500' : 'bg-white text-black hover:bg-gray-200'
                              }`}>
                              {recentlyAdded === itemId ? <><Check size={16} /> Added!</> : <><Plus size={16} /> Select</>}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* RIGHT: STICKY CART (Desktop) */}
      <div className="hidden lg:block lg:col-span-1">
        <div className="sticky top-24 space-y-4">
          <div className="bg-gradient-to-br from-gray-900 to-black p-5 rounded-xl border border-gray-700 shadow-xl">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Clock size={14} className="text-bbq-gold" /> Next Collection
            </h4>
            {selectedEvent ? (() => {
              const pickupDate = parseLocalDate(selectedEvent.date);
              pickupDate.setDate(pickupDate.getDate() + 1);
              return (
                <div>
                  <p className="text-white font-display text-2xl font-bold">{pickupDate.toLocaleDateString('en-AU', { weekday: 'long' })}</p>
                  <p className="text-bbq-gold font-bold">{pickupDate.toLocaleDateString('en-AU', { month: 'long', day: 'numeric' })}</p>
                  <p className="text-xs text-gray-500 mt-1">{selectedEvent.location}</p>
                </div>
              );
            })() : orderEvents.length > 0 ? (() => {
              const nextEvt = orderEvents[0];
              const pickupDate = parseLocalDate(nextEvt.date);
              pickupDate.setDate(pickupDate.getDate() + 1);
              return (
                <div>
                  <p className="text-white font-display text-2xl font-bold">{pickupDate.toLocaleDateString('en-AU', { weekday: 'long' })}</p>
                  <p className="text-bbq-gold font-bold">{pickupDate.toLocaleDateString('en-AU', { month: 'long', day: 'numeric' })}</p>
                  <p className="text-xs text-gray-500 mt-1">{nextEvt.location}</p>
                  <button onClick={() => handleDateSelect(nextEvt.date)}
                    className="mt-3 text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 w-full">
                    Select This Date
                  </button>
                </div>
              );
            })() : <p className="text-gray-500 text-sm">No upcoming cook dates scheduled.</p>}
          </div>

          <div className="bg-bbq-charcoal rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
            <div className="p-4 bg-black/40 border-b border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ShoppingBag size={18} className="text-bbq-red" /> Your Tray
              </h3>
              <span className="bg-white text-black text-xs font-bold px-2 py-0.5 rounded-full">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
            </div>
            <div className="p-4 max-h-[40vh] overflow-y-auto space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Tray is empty.</p>
                  <p className="text-xs mt-1">Select items to begin.</p>
                </div>
              ) : cart.map((item, idx) => (
                <div key={`${item._id || item.id}-${idx}`} className="flex justify-between items-start text-sm">
                  <div className="flex-1">
                    <div className="text-white font-bold flex gap-2">
                      <span className="text-bbq-gold">{item.quantity}x</span> {item.name}
                    </div>
                  </div>
                  <div className="text-gray-400 font-mono">${(item.price * item.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-400 text-sm">Subtotal</span>
                  <span className="text-white font-bold text-lg">${cart.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}</span>
                </div>
                <Link to="/order" className="block w-full bg-bbq-red text-white text-center py-3 rounded-lg font-bold hover:bg-red-700 transition uppercase text-sm tracking-wider">
                  Checkout
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedItem && (
        <ItemDetailsModal item={selectedItem} onClose={() => setSelectedItem(null)} onAddToCart={handleAddToCartFromModal} />
      )}

      {/* Mobile Cart Button */}
      {user?.role !== 'ADMIN' && (
        <div className="fixed bottom-6 left-0 right-0 px-4 flex flex-col gap-2 z-40 lg:hidden pointer-events-none">
          {!selectedOrderDate && orderEvents.length > 0 && cart.length === 0 && (
            <div className="bg-black/80 border border-gray-700 p-3 rounded-xl shadow-xl flex items-center justify-between pointer-events-auto" style={{ backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center gap-3">
                <Calendar size={20} className="text-bbq-gold" />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold">Next Cook</p>
                  <p className="text-white font-bold text-sm">{parseLocalDate(orderEvents[0].date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
              <button onClick={() => handleDateSelect(orderEvents[0].date)} className="text-xs bg-white text-black px-3 py-1.5 rounded font-bold">Order Now</button>
            </div>
          )}
          {cart.length > 0 && (
            <Link to="/order" className="pointer-events-auto bg-gradient-to-r from-bbq-red to-red-800 text-white shadow-2xl shadow-black rounded-full px-6 py-4 font-bold flex items-center justify-between animate-pulse border border-white/20" style={{ backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center gap-3">
                <div className="bg-white text-black w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold">{cart.length}</div>
                <span className="uppercase tracking-wider text-sm">Checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white/80">${cart.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}</span>
                <ArrowRight size={18} />
              </div>
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default StorefrontMenu;
