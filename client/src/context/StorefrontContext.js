import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, where, arrayUnion, arrayRemove, increment, getDoc,
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useClientConfig } from './ClientConfigContext';
import { db, isFirebaseConfigured } from '../firebase';

const StorefrontContext = createContext(undefined);

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  businessName: '',
  businessAddress: '',
  logoUrl: '',
  stripeConnected: false,
  squareConnected: false,
  smartPayConnected: false,
  smsConnected: false,
  facebookConnected: false,
  manualTickerImages: [],
  cateringPackageImages: { essential: '', pitmaster: '', wholehog: '' },
  rewards: {
    enabled: false,
    programName: 'Loyalty Rewards',
    staffPin: '1234',
    maxStamps: 10,
    rewardTitle: 'Free Item',
    rewardImage: '',
    possiblePrizes: [],
  },
};

export const StorefrontProvider = ({ children }) => {
  const { user: authUser, logout: authLogout, login: authLogin, register: authRegister } = useAuth();
  const { brandName, brandTagline, primaryColor } = useClientConfig();

  // ── Data State ──
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [menu, setMenu] = useState(() => {
    try { const s = localStorage.getItem('hq_menu'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [galleryPosts, setGalleryPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(() => {
    try { const s = localStorage.getItem('hq_settings'); return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; }
  });
  const [socialPosts, setSocialPosts] = useState([]);
  const [reminders, setReminders] = useState(() => {
    try { const s = localStorage.getItem('hq_reminders'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // ── Local State ──
  const [cart, setCart] = useState(() => {
    try { const s = localStorage.getItem('hq_cart'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [selectedOrderDate, setSelectedOrderDate] = useState(() => localStorage.getItem('hq_selected_date'));

  // ── Map authUser to Street Meatz user shape ──
  const user = authUser ? {
    id: authUser._id || authUser.id,
    name: authUser.name || 'User',
    email: authUser.email || '',
    role: authUser.role === 'admin' ? 'ADMIN' : 'CUSTOMER',
    isVerified: true,
    phone: authUser.phone || '',
    address: authUser.address || '',
    stamps: authUser.stamps || 0,
    hasCateringDiscount: authUser.hasCateringDiscount || false,
  } : null;

  // ── Persist local state ──
  useEffect(() => { try { localStorage.setItem('hq_cart', JSON.stringify(cart)); } catch { } }, [cart]);
  useEffect(() => {
    try {
      if (selectedOrderDate) localStorage.setItem('hq_selected_date', selectedOrderDate);
      else localStorage.removeItem('hq_selected_date');
    } catch { }
  }, [selectedOrderDate]);

  // ── Fetch all data on mount ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes, cookRes] = await Promise.all([
          api.get('/foodtruck/public/menu').catch(() => ({ data: [] })),
          api.get('/foodtruck/public/cookdays').catch(() => ({ data: [] })),
        ]);

        const menuData = menuRes.data || [];
        setMenu(menuData);
        try { localStorage.setItem('hq_menu', JSON.stringify(menuData.map(i => ({ ...i, image: '' })))); } catch { }

        // Map cook days to CalendarEvent format for public display
        const cookEvents = (cookRes.data || []).map(d => ({
          id: d._id || d.id,
          date: d.date,
          type: 'ORDER_PICKUP',
          title: d.title || 'Cook Day',
          location: d.location?.name || d.location || '',
          time: d.timeStart && d.timeEnd ? `${d.timeStart} - ${d.timeEnd}` : '',
          startTime: d.timeStart,
          endTime: d.timeEnd,
        }));

        // Also load public events (blocked, pop-ups)
        try {
          const pubEvtsRes = await api.get('/foodtruck/public/events');
          const pubEvts = (pubEvtsRes.data || []).map(e => ({ ...e, id: e._id || e.id }));
          // Merge: prefer full CalendarEvent over cook day entry for same date
          const merged = [...pubEvts];
          cookEvents.forEach(ce => {
            if (!merged.find(e => e.date === ce.date && e.type === 'ORDER_PICKUP')) merged.push(ce);
          });
          setCalendarEvents(merged);
        } catch {
          setCalendarEvents(cookEvents);
        }

        // Fetch public settings
        try {
          const settingsRes = await api.get('/foodtruck/public/settings');
          if (settingsRes.data) {
            setSettings(prev => {
              const merged = { ...prev, ...settingsRes.data };
              try { localStorage.setItem('hq_settings', JSON.stringify(merged)); } catch { }
              return merged;
            });
          }
        } catch { }

        // Fetch gallery
        try {
          const galRes = await api.get('/foodtruck/public/gallery');
          setGalleryPosts(galRes.data || []);
        } catch { }

        setConnectionError(null);
      } catch (err) {
        console.error('StorefrontContext fetch error:', err);
        setConnectionError('Unable to connect to server. Some features may be limited.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch orders + full calendar events when user is logged in
  useEffect(() => {
    if (!authUser) { setOrders([]); return; }
    const fetchOrders = async () => {
      try {
        const res = await api.get('/foodtruck/orders');
        setOrders(res.data?.orders || res.data || []);
      } catch { }
    };
    fetchOrders();

    // Load full calendar events (including BLOCKED/PUBLIC_EVENT) for admin Planner
    if (authUser.role === 'admin') {
      const fetchEvents = async () => {
        try {
          const res = await api.get('/foodtruck/events');
          const evts = (res.data || []).map(e => ({ ...e, id: e._id || e.id }));
          if (evts.length > 0) setCalendarEvents(evts);
        } catch { }
      };
      fetchEvents();
    }
  }, [authUser]);

  // ── Auth Actions ──
  const login = async (role, email, password, name) => {
    if (role === 'signup') {
      return await authRegister({ name, email, password });
    }
    return await authLogin(email, password);
  };

  const logout = () => { authLogout(); };

  const addUser = async (newUser) => { /* handled by auth routes */ };
  const updateUserProfile = async (updatedUser) => {
    try { await api.put('/auth/profile', updatedUser); } catch (err) { console.error(err); }
  };
  const adminUpdateUser = async (updatedUser) => { await updateUserProfile(updatedUser); };
  const deleteUser = async (userId) => {
    try { await api.delete(`/auth/users/${userId}`); } catch (err) { console.error(err); }
  };

  // ── Menu Actions ──
  const addMenuItem = async (item) => {
    try {
      const res = await api.post('/foodtruck/menu', item);
      setMenu(prev => [...prev, res.data]);
    } catch (err) { console.error(err); }
  };

  const updateMenuItem = async (item) => {
    try {
      const res = await api.put(`/foodtruck/menu/${item._id || item.id}`, item);
      setMenu(prev => prev.map(i => (i._id || i.id) === (item._id || item.id) ? res.data : i));
    } catch (err) { console.error(err); }
  };

  // ── Calendar/Event Actions ──
  const addCalendarEvent = async (event) => {
    try {
      const res = await api.post('/foodtruck/events', event);
      setCalendarEvents(prev => [...prev, res.data]);
    } catch (err) { console.error(err); }
  };

  const updateCalendarEvent = async (event) => {
    try {
      const res = await api.put(`/foodtruck/events/${event.id}`, event);
      setCalendarEvents(prev => prev.map(e => e.id === event.id ? res.data : e));
    } catch (err) { console.error(err); }
  };

  const removeCalendarEvent = async (eventId) => {
    try {
      await api.delete(`/foodtruck/events/${eventId}`);
      setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (err) { console.error(err); }
  };

  const isDatePastCutoff = (dateStr) => {
    const cookDate = new Date(dateStr);
    const cutoffDate = new Date(cookDate);
    cutoffDate.setDate(cookDate.getDate() - 1);
    cutoffDate.setHours(9, 0, 0, 0);
    return new Date() > cutoffDate;
  };

  const checkAvailability = (dateStr) => {
    if (isDatePastCutoff(dateStr)) return false;
    const blocked = calendarEvents.find(e => e.date === dateStr && e.type === 'BLOCKED');
    if (blocked) return false;
    const ordersOnDay = orders.filter(o => o.cookDay === dateStr && o.type === 'CATERING');
    if (ordersOnDay.length >= 2) return false;
    return true;
  };

  // ── Order Actions ──
  const createOrder = async (order) => {
    try {
      const res = await api.post('/foodtruck/public/orders', order);
      setOrders(prev => [res.data, ...prev]);
      clearCart();
      return res.data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.put(`/foodtruck/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o => (o._id || o.id) === orderId ? { ...o, status } : o));
    } catch (err) { console.error(err); }
  };

  const updateOrder = async (updatedOrder) => {
    try {
      await api.put(`/foodtruck/orders/${updatedOrder._id || updatedOrder.id}`, updatedOrder);
      setOrders(prev => prev.map(o => (o._id || o.id) === (updatedOrder._id || updatedOrder.id) ? updatedOrder : o));
    } catch (err) { console.error(err); }
  };

  // ── Cart Actions ──
  const addToCart = (item, quantity = 1, specificDate) => {
    if (specificDate && selectedOrderDate && selectedOrderDate !== specificDate) {
      if (!window.confirm(`Your cart contains items for ${new Date(selectedOrderDate).toLocaleDateString()}. Clear cart and switch dates?`)) return;
      setCart([]);
      setSelectedOrderDate(specificDate);
    }
    if (!selectedOrderDate && specificDate) setSelectedOrderDate(specificDate);

    setCart(prev => {
      const existing = prev.find(i => (i._id || i.id) === (item._id || item.id));
      if (existing) {
        return prev.map(i => (i._id || i.id) === (item._id || item.id) ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const updateCartItemQuantity = (itemId, delta) => {
    setCart(prev =>
      prev.map(item => {
        if ((item._id || item.id) === itemId) return { ...item, quantity: Math.max(0, item.quantity + delta) };
        return item;
      }).filter(i => i.quantity > 0)
    );
  };

  const removeFromCart = (itemId) => setCart(prev => prev.filter(i => (i._id || i.id) !== itemId));
  const clearCart = () => setCart([]);

  // ── Social/Gallery Actions ──
  const addSocialPost = (post) => setSocialPosts(prev => [post, ...prev]);

  const addGalleryPost = async (post) => {
    try {
      const res = await api.post('/foodtruck/gallery', post);
      setGalleryPosts(prev => [res.data, ...prev]);
    } catch (err) { console.error(err); }
  };

  const toggleGalleryLike = async (postId) => {
    if (!user) return;
    try {
      const res = await api.post(`/foodtruck/gallery/${postId}/like`);
      setGalleryPosts(prev => prev.map(p => (p._id || p.id) === postId ? res.data : p));
    } catch (err) { console.error(err); }
  };

  // ── Settings Actions ──
  const updateSettings = async (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    try {
      await api.put('/foodtruck/settings', newSettings);
      try { localStorage.setItem('hq_settings', JSON.stringify(merged)); } catch { }
      return true;
    } catch (err) {
      console.error('Save settings error:', err);
      return false;
    }
  };

  // ── Cook Days (legacy) ──
  const cookDays = calendarEvents.filter(e => e.type === 'ORDER_PICKUP');
  const addCookDay = (day) => {
    setCalendarEvents(prev => [...prev, { ...day, type: 'ORDER_PICKUP' }]);
  };

  // ── Reminders ──
  const toggleReminder = (eventId) => {
    const newReminders = reminders.includes(eventId)
      ? reminders.filter(id => id !== eventId)
      : [...reminders, eventId];
    setReminders(newReminders);
    localStorage.setItem('hq_reminders', JSON.stringify(newReminders));
  };

  // ── Rewards ──
  const verifyStaffPin = (pin, action) => {
    if (pin !== settings.rewards?.staffPin) return false;
    if (user) {
      const currentStamps = user.stamps || 0;
      let newStamps = currentStamps;
      if (action === 'ADD') newStamps = currentStamps + 1;
      else if (action === 'REDEEM') newStamps = Math.max(0, currentStamps - (settings.rewards?.maxStamps || 10));
      updateUserProfile({ ...user, stamps: newStamps });
    }
    return true;
  };

  return (
    <StorefrontContext.Provider value={{
      user, users, login, logout, addUser, updateUserProfile, adminUpdateUser, deleteUser,
      menu, addMenuItem, updateMenuItem,
      cookDays, addCookDay,
      calendarEvents, addCalendarEvent, updateCalendarEvent, removeCalendarEvent, checkAvailability, isDatePastCutoff,
      orders, createOrder, updateOrderStatus, updateOrder,
      cart, addToCart, updateCartItemQuantity, removeFromCart, clearCart,
      socialPosts, addSocialPost,
      galleryPosts, addGalleryPost, toggleGalleryLike,
      settings, updateSettings,
      reminders, toggleReminder,
      verifyStaffPin,
      selectedOrderDate, setSelectedOrderDate,
      isLoading, connectionError,
      // Extras for convenience
      brandName: brandName || settings.businessName || 'Hughesys Que',
      brandTagline: brandTagline || 'Quality Street Food',
      primaryColor: primaryColor || '#f59e0b',
    }}>
      {children}
    </StorefrontContext.Provider>
  );
};

export const useStorefront = () => {
  const context = useContext(StorefrontContext);
  if (!context) throw new Error('useStorefront must be used within StorefrontProvider');
  return context;
};

// Alias for easy porting from Street Meatz (useApp → useStorefront)
export const useApp = useStorefront;

export default StorefrontContext;
