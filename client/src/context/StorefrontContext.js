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
  const { user: authUser, logout: authLogout, login: authLogin, register: authRegister, updateProfile: authUpdateProfile } = useAuth();
  const { brandName, brandTagline, primaryColor } = useClientConfig();

  // ── Data State ──
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [menu, setMenu] = useState(() => {
    try { const s = localStorage.getItem('hq_menu'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [calendarEvents, setCalendarEvents] = useState(() => {
    try { const s = localStorage.getItem('hq_events'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
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

  // ── Map Firebase user to Street Meatz user shape ──
  const user = authUser ? {
    id: authUser.uid || authUser.id,
    uid: authUser.uid,
    name: authUser.name || authUser.displayName || 'User',
    email: authUser.email || '',
    role: (authUser.role === 'admin' || authUser.role === 'dev') ? 'ADMIN' : 'CUSTOMER',
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

  // ── Firestore real-time listeners ──
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setConnectionError('Firebase not configured. Set REACT_APP_FIREBASE_* env vars.');
      setIsLoading(false);
      return;
    }

    const handleError = (source) => (err) => {
      if (err.code === 'permission-denied') {
        setConnectionError('Database access denied. Check Firestore security rules.');
      } else {
        console.error(`Firestore error (${source}):`, err);
      }
    };

    // Menu
    const unsubMenu = onSnapshot(collection(db, 'menu'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      setMenu(data);
      try { localStorage.setItem('hq_menu', JSON.stringify(data.map(i => ({ ...i, image: '' })))); } catch { }
      setConnectionError(null);
    }, handleError('menu'));

    // Orders
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
      (snap) => {
        setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        setConnectionError(null);
      }, handleError('orders')
    );

    // Events
    const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      setCalendarEvents(data);
      try { localStorage.setItem('hq_events', JSON.stringify(data)); } catch { }
      setConnectionError(null);
    }, handleError('events'));

    // Gallery
    const unsubGallery = onSnapshot(
      query(collection(db, 'gallery_posts'), orderBy('createdAt', 'desc')),
      (snap) => setGalleryPosts(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      handleError('gallery')
    );

    // Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data(), id: d.id, uid: d.id })));
      setConnectionError(null);
    }, handleError('users'));

    // Settings — merge multiple sub-docs into one settings object
    const mergeSettings = (data) => {
      if (!data) return;
      setSettings(prev => {
        const merged = { ...prev, ...data };
        try { localStorage.setItem('hq_settings', JSON.stringify(merged)); } catch { }
        return merged;
      });
    };
    const unsubGeneral = onSnapshot(doc(db, 'settings', 'general'), snap => mergeSettings(snap.data()), handleError('settings/general'));
    const unsubRewards = onSnapshot(doc(db, 'settings', 'rewards'), snap => mergeSettings(snap.data()), handleError('settings/rewards'));

    setIsLoading(false);

    return () => {
      unsubMenu(); unsubOrders(); unsubEvents(); unsubGallery(); unsubUsers();
      unsubGeneral(); unsubRewards();
    };
  }, []);

  // ── Auth Actions ──
  const login = async (role, email, password, name) => {
    if (role === 'signup') return await authRegister({ name, email, password });
    return await authLogin(email, password);
  };

  const logout = () => authLogout();

  const addUser = async (newUser) => {
    if (!newUser.id && !newUser.uid) return;
    const uid = newUser.id || newUser.uid;
    await setDoc(doc(db, 'users', uid), newUser, { merge: true });
  };

  const updateUserProfile = async (updatedUser) => {
    const uid = updatedUser.uid || updatedUser.id;
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid), updatedUser);
    if (authUser && uid === authUser.uid) {
      await authUpdateProfile(updatedUser);
    }
  };

  const adminUpdateUser = updateUserProfile;

  const deleteUser = async (userId) => {
    await deleteDoc(doc(db, 'users', userId));
  };

  // ── Menu Actions ──
  const addMenuItem = async (item) => {
    const id = item.id || doc(collection(db, 'menu')).id;
    await setDoc(doc(db, 'menu', id), { ...item, id });
  };

  const updateMenuItem = async (item) => {
    const id = item.id || item._id;
    await updateDoc(doc(db, 'menu', id), { ...item });
  };

  // ── Calendar/Event Actions ──
  const addCalendarEvent = async (event) => {
    const id = event.id || doc(collection(db, 'events')).id;
    await setDoc(doc(db, 'events', id), { ...event, id });
  };

  const updateCalendarEvent = async (event) => {
    await updateDoc(doc(db, 'events', event.id), { ...event });
  };

  const removeCalendarEvent = async (eventId) => {
    await deleteDoc(doc(db, 'events', eventId));
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
    if (calendarEvents.find(e => e.date === dateStr && e.type === 'BLOCKED')) return false;
    if (orders.filter(o => o.cookDay === dateStr && o.type === 'CATERING').length >= 2) return false;
    return true;
  };

  // ── Order Actions ──
  const createOrder = async (order) => {
    const id = order.id || doc(collection(db, 'orders')).id;
    const orderData = { ...order, id, createdAt: order.createdAt || new Date().toISOString() };
    await setDoc(doc(db, 'orders', id), orderData);
    if (order.discountApplied && user?.hasCateringDiscount) {
      await updateUserProfile({ ...authUser, hasCateringDiscount: false });
    }
    clearCart();
    return orderData;
  };

  const updateOrderStatus = async (orderId, status) => {
    await updateDoc(doc(db, 'orders', orderId), { status });
    if (status === 'Confirmed') {
      const order = orders.find(o => o.id === orderId);
      if (order?.type === 'CATERING') {
        const dateStr = new Date(order.cookDay).toISOString().split('T')[0];
        const evtId = `evt_o_${orderId}`;
        await setDoc(doc(db, 'events', evtId), {
          id: evtId, date: dateStr, type: 'ORDER_PICKUP',
          title: `Pickup: ${order.customerName}`, orderId,
        });
      }
    }
  };

  const updateOrder = async (updatedOrder) => {
    const id = updatedOrder.id || updatedOrder._id;
    await setDoc(doc(db, 'orders', id), { ...updatedOrder, id });
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
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { ...item, quantity }];
    });
  };

  const updateCartItemQuantity = (itemId, delta) => {
    setCart(prev =>
      prev.map(i => i.id === itemId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
        .filter(i => i.quantity > 0)
    );
  };

  const removeFromCart = (itemId) => setCart(prev => prev.filter(i => i.id !== itemId));
  const clearCart = () => setCart([]);

  // ── Social/Gallery Actions ──
  const addSocialPost = (post) => setSocialPosts(prev => [post, ...prev]);

  const addGalleryPost = async (post) => {
    const id = post.id || doc(collection(db, 'gallery_posts')).id;
    await setDoc(doc(db, 'gallery_posts', id), {
      ...post, id,
      createdAt: post.createdAt || new Date().toISOString(),
      likes: post.likes || 0,
      likedBy: post.likedBy || [],
    });
  };

  const toggleGalleryLike = async (postId) => {
    if (!user) return;
    const post = galleryPosts.find(p => p.id === postId);
    if (!post) return;
    const isLiked = post.likedBy?.includes(user.id);
    const ref = doc(db, 'gallery_posts', postId);
    if (isLiked) {
      await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(user.id) });
    } else {
      await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(user.id) });
    }
  };

  // ── Settings Actions ──
  const updateSettings = async (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    try {
      const { rewards, ...general } = newSettings;
      const promises = [];
      if (Object.keys(general).length > 0) {
        promises.push(setDoc(doc(db, 'settings', 'general'), general, { merge: true }));
      }
      if (rewards !== undefined) {
        promises.push(setDoc(doc(db, 'settings', 'rewards'), { rewards }, { merge: true }));
      }
      await Promise.all(promises);
      try { localStorage.setItem('hq_settings', JSON.stringify(merged)); } catch { }
      return true;
    } catch (err) {
      console.error('Save settings error:', err);
      return false;
    }
  };

  // ── Favicon + SEO meta injection ──
  useEffect(() => {
    const setMeta = (attr, key, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    const bizName = settings.businessName || brandName;
    if (!bizName) return;
    const address = settings.businessAddress || 'Queensland, AU';
    const desc = `${bizName} — Authentic wood-smoked BBQ food truck in ${address}. Order online, browse our menu, and book catering.`;
    const keywords = `${bizName}, BBQ food truck, smoked meat, catering, wood smoked BBQ, ${address}, order online`;
    document.title = bizName;
    if (settings.logoUrl) {
      ['icon', 'shortcut icon', 'apple-touch-icon'].forEach(rel => {
        let link = document.querySelector(`link[rel="${rel}"]`);
        if (!link) { link = document.createElement('link'); link.rel = rel; document.head.appendChild(link); }
        link.href = settings.logoUrl;
      });
    }
    setMeta('name', 'description', desc);
    setMeta('name', 'keywords', keywords);
    setMeta('name', 'author', bizName);
    setMeta('property', 'og:title', bizName);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', 'restaurant');
    setMeta('property', 'og:site_name', bizName);
    if (settings.logoUrl) setMeta('property', 'og:image', settings.logoUrl);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', bizName);
    setMeta('name', 'twitter:description', desc);
    if (settings.logoUrl) setMeta('name', 'twitter:image', settings.logoUrl);
  }, [settings.businessName, settings.businessAddress, settings.logoUrl, brandName]);

  // ── Cook Days (derived from events) ──
  const cookDays = calendarEvents.filter(e => e.type === 'ORDER_PICKUP');
  const addCookDay = async (day) => {
    await addCalendarEvent({ ...day, type: 'ORDER_PICKUP' });
  };

  // ── Reminders ──
  const toggleReminder = (eventId) => {
    const newReminders = reminders.includes(eventId)
      ? reminders.filter(id => id !== eventId)
      : [...reminders, eventId];
    setReminders(newReminders);
    try { localStorage.setItem('hq_reminders', JSON.stringify(newReminders)); } catch { }
  };

  // ── Rewards ──
  const verifyStaffPin = (pin, action) => {
    if (pin !== settings.rewards?.staffPin) return false;
    if (user) {
      const stamps = user.stamps || 0;
      const newStamps = action === 'ADD'
        ? stamps + 1
        : Math.max(0, stamps - (settings.rewards?.maxStamps || 10));
      updateUserProfile({ ...authUser, stamps: newStamps });
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
      brandName: brandName || settings.businessName || process.env.REACT_APP_BRAND_NAME || 'Food Truck',
      brandTagline: brandTagline || process.env.REACT_APP_BRAND_TAGLINE || 'Quality Street Food',
      primaryColor: primaryColor || process.env.REACT_APP_PRIMARY_COLOR || '#f59e0b',
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
