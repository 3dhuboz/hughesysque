import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, MenuItem, Order, CookDay, UserRole, CartItem, SocialPost, AppSettings, CalendarEvent, GalleryPost } from '../types';
import { parseLocalDate, isEventPastCutoff, toLocalDateStr } from '../utils/dateUtils';
import { INITIAL_MENU, INITIAL_COOK_DAYS, INITIAL_ADMIN_USER, INITIAL_DEV_USER, INITIAL_SETTINGS, INITIAL_EVENTS } from '../constants';
import { setGeminiApiKey } from '../services/gemini';
import {
  initApi,
  fetchMenu,
  upsertMenuItem as apiUpsertMenuItem,
  deleteMenuItem as apiDeleteMenuItem,
  fetchOrders,
  createOrder as apiCreateOrder,
  updateOrder as apiUpdateOrder,
  fetchEvents,
  upsertEvent,
  deleteEvent,
  fetchUsers,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
  fetchSocialPosts,
  upsertSocialPost,
  deleteSocialPost as apiDeleteSocialPost,
  fetchGalleryPosts,
  submitGalleryPost,
  updateGalleryPost,
  toggleGalleryLike as apiToggleGalleryLike,
  fetchSettings,
  updateSettings as apiUpdateSettings,
  requestCustomerMagicLink,
  verifyCustomerMagicLink,
  fetchCustomerMe,
  updateCustomerMe,
} from '../services/api';

interface AppContextType {
  user: User | null;
  users: User[];
  login: (role: UserRole, email?: string, password?: string, name?: string) => Promise<void>;
  logout: () => void;
  addUser: (newUser: User) => void;
  updateUserProfile: (updatedUser: User) => void;
  adminUpdateUser: (updatedUser: User) => void;
  deleteUser: (userId: string) => void;

  menu: MenuItem[];
  addMenuItem: (item: MenuItem) => Promise<void>;
  updateMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (itemId: string) => Promise<void>;

  cookDays: CookDay[];
  addCookDay: (day: CookDay) => void;

  calendarEvents: CalendarEvent[];
  addCalendarEvent: (event: CalendarEvent) => void;
  updateCalendarEvent: (event: CalendarEvent) => void;
  removeCalendarEvent: (eventId: string) => void;
  checkAvailability: (date: string) => boolean;
  isDatePastCutoff: (dateStr: string, event?: CalendarEvent) => boolean;

  orders: Order[];
  createOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  updateOrder: (order: Order) => void;

  cart: CartItem[];
  addToCart: (item: MenuItem, quantity?: number, specificDate?: string) => void;
  updateCartItemQuantity: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;

  socialPosts: SocialPost[];
  addSocialPost: (post: SocialPost) => void;
  updateSocialPost: (post: SocialPost) => void;
  deleteSocialPost: (postId: string) => void;

  galleryPosts: GalleryPost[];
  addGalleryPost: (post: GalleryPost) => void;
  toggleGalleryLike: (postId: string) => Promise<void>;

  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<true | string>;

  reminders: string[];
  toggleReminder: (eventId: string) => void;

  selectedOrderDate: string | null;
  setSelectedOrderDate: (date: string | null) => void;

  // Customer magic-link sign-in. user.role === 'CUSTOMER' once signed in.
  // loyalty is populated alongside; null when customer isn't signed in.
  loyalty: { thresholdAmount: number; discountPercent: number; eligible: boolean; remainingToThreshold: number } | null;
  requestCustomerSignIn: (email: string) => Promise<void>;
  completeCustomerSignIn: (magicToken: string) => Promise<void>;
  refreshCustomer: () => Promise<void>;
  updateCustomerProfile: (data: { name?: string; phone?: string }) => Promise<void>;

  isLoading: boolean;
  connectionError: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cookDays, setCookDays] = useState<CookDay[]>(INITIAL_COOK_DAYS);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [galleryPosts, setGalleryPosts] = useState<GalleryPost[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [reminders, setReminders] = useState<string[]>([]);

  // Admin HMAC session token — issued by /api/v1/auth/admin-login, sent as Bearer
  // on every subsequent API call so privileged endpoints can authorise without Clerk.
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try { return localStorage.getItem('hq_admin_token'); } catch { return null; }
  });

  // Customer HMAC session token — issued by /api/v1/auth/customer-magic-link-verify
  // after the user clicks their email link. Same Bearer header path as admin
  // tokens; the server distinguishes them by `typ` in the JWT-style header.
  const [customerToken, setCustomerToken] = useState<string | null>(() => {
    try { return localStorage.getItem('hq_customer_token'); } catch { return null; }
  });
  const [loyalty, setLoyalty] = useState<{ thresholdAmount: number; discountPercent: number; eligible: boolean; remainingToThreshold: number } | null>(null);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try { const s = localStorage.getItem('hq_cart'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const [selectedOrderDate, setSelectedOrderDate] = useState<string | null>(() =>
    localStorage.getItem('hq_selected_date')
  );

  useEffect(() => {
    try { localStorage.setItem('hq_cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  useEffect(() => {
    try {
      if (selectedOrderDate) localStorage.setItem('hq_selected_date', selectedOrderDate);
      else localStorage.removeItem('hq_selected_date');
    } catch {}
  }, [selectedOrderDate]);

  useEffect(() => {
    // Two possible auth tokens — admin first (privileged endpoints), then
    // customer (rewards / order history). Each has a distinct `typ` in the
    // header so the server only honours each token on its own endpoints;
    // sending the wrong one to the wrong endpoint just 401s rather than
    // confusing privileges.
    initApi(async () => adminToken || customerToken || null);
  }, [adminToken, customerToken]);

  // Restore admin user state from a persisted session token on mount so
  // a refresh doesn't log Macca out. Token signature + expiry are verified
  // server-side on the next privileged call; if it's stale we'll 401 and
  // the user can log back in.
  useEffect(() => {
    if (adminToken && !user) {
      try {
        const payload = JSON.parse(atob(adminToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload?.exp && Date.now() < payload.exp) {
          setUser(payload.role === 'DEV' ? INITIAL_DEV_USER : INITIAL_ADMIN_USER);
        } else {
          // Expired — wipe it.
          try { localStorage.removeItem('hq_admin_token'); } catch {}
          setAdminToken(null);
        }
      } catch {
        try { localStorage.removeItem('hq_admin_token'); } catch {}
        setAdminToken(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const loaded = new Set<string>();
      const REQUIRED = ['Menu', 'Orders', 'Settings'];
      const markLoaded = (source: string) => {
        loaded.add(source);
        if (REQUIRED.every(s => loaded.has(s))) setIsLoading(false);
      };

      const fallbackTimer = setTimeout(() => setIsLoading(false), 5000);

      try {
        const [menuData, settingsData, ordersData, eventsData, socialData, galleryData] = await Promise.allSettled([
          fetchMenu(),
          fetchSettings(),
          fetchOrders().catch(() => []),
          fetchEvents().catch(() => []),
          fetchSocialPosts().catch(() => []),
          fetchGalleryPosts().catch(() => []),
        ]);

        if (menuData.status === 'fulfilled' && menuData.value.length > 0) setMenu(menuData.value);
        else setMenu(INITIAL_MENU);
        markLoaded('Menu');

        if (settingsData.status === 'fulfilled') {
          const s = settingsData.value;
          const aiKey = (s as any).openrouterApiKey || (s as any).geminiApiKey;
          if (aiKey) setGeminiApiKey(aiKey);
          setSettings(prev => ({ ...prev, ...s } as AppSettings));
          // Update favicon from logo
          const logoUrl = (s as any).logoUrl;
          if (logoUrl) {
            const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (link) link.href = logoUrl;
            const appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
            if (appleLink) appleLink.href = logoUrl;
          }
        }
        markLoaded('Settings');

        if (ordersData.status === 'fulfilled' && ordersData.value.length > 0) setOrders(ordersData.value);
        markLoaded('Orders');

        if (eventsData.status === 'fulfilled' && eventsData.value.length > 0) setCalendarEvents(eventsData.value);
        else setCalendarEvents(INITIAL_EVENTS);

        if (socialData.status === 'fulfilled' && socialData.value.length > 0) setSocialPosts(socialData.value);
        if (galleryData.status === 'fulfilled' && galleryData.value.length > 0) setGalleryPosts(galleryData.value);

        setConnectionError(null);
      } catch (err: any) {
        console.error('[Data Load] Error:', err);
        setConnectionError('Failed to load data. Please check your connection.');
        setIsLoading(false);
      }

      clearTimeout(fallbackTimer);
    };

    loadData();
  }, []);

  // When admin logs in, prefetch the user list for CustomerManager.
  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'DEV') {
      fetchUsers().then(data => setUsers(data)).catch(() => {});
    }
  }, [user?.role]);

  // Hydrate the customer profile + loyalty from a persisted token on mount.
  // If the token is stale/invalid the API 401s and we wipe local state; the
  // customer can request a fresh magic link.
  const refreshCustomer = async () => {
    if (!customerToken) return;
    try {
      const data = await fetchCustomerMe();
      setUser({
        id: data.customer.email,
        name: data.customer.name || data.customer.email.split('@')[0],
        email: data.customer.email,
        phone: data.customer.phone,
        role: UserRole.CUSTOMER,
        isVerified: true,
        hasCateringDiscount: data.loyalty.eligible,
      });
      setLoyalty(data.loyalty);
    } catch {
      // Bad token (expired, revoked, signing-secret rotated) — wipe and bail.
      try { localStorage.removeItem('hq_customer_token'); } catch {}
      setCustomerToken(null);
      setUser(prev => prev?.role === 'CUSTOMER' ? null : prev);
      setLoyalty(null);
    }
  };

  useEffect(() => {
    // Only hydrate if no admin user is already in place — admin takes
    // precedence in the shared `user` slot.
    if (customerToken && (!user || user.role === 'CUSTOMER')) {
      refreshCustomer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerToken]);

  const requestCustomerSignIn = async (email: string) => {
    if (!email || !email.trim()) throw new Error('Email is required');
    await requestCustomerMagicLink(email.trim().toLowerCase());
  };

  const completeCustomerSignIn = async (magicToken: string) => {
    const result = await verifyCustomerMagicLink(magicToken);
    if (!result?.success || !result.token) throw new Error('Sign-in failed');
    try { localStorage.setItem('hq_customer_token', result.token); } catch {}
    setCustomerToken(result.token);
    // Optimistically populate user from the verify response so the UI updates
    // immediately; refreshCustomer will run via the customerToken effect and
    // fill in computed loyalty fields.
    setUser({
      id: result.customer.email,
      name: result.customer.name || result.customer.email.split('@')[0],
      email: result.customer.email,
      phone: result.customer.phone,
      role: UserRole.CUSTOMER,
      isVerified: true,
    });
  };

  const updateCustomerProfile = async (data: { name?: string; phone?: string }) => {
    await updateCustomerMe(data);
    // Reflect locally without a refetch.
    setUser(prev => prev && prev.role === 'CUSTOMER'
      ? { ...prev, name: data.name ?? prev.name, phone: data.phone ?? prev.phone }
      : prev);
  };

  const login = async (role: UserRole | string, email?: string, password?: string) => {
    const normalizedRole = (role as string).toUpperCase();
    if (normalizedRole === UserRole.ADMIN || normalizedRole === UserRole.DEV) {
      try {
        const res = await fetch('/api/v1/auth/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email, password }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || !data.success) {
          throw new Error(data?.error || 'Invalid admin credentials');
        }
        // Persist the HMAC-signed session token so every subsequent admin
        // API call can be authenticated. 30-day TTL on the server side.
        if (data.token) {
          try { localStorage.setItem('hq_admin_token', data.token); } catch {}
          setAdminToken(data.token);
        }
        if (data.mustChangePassword) {
          try { localStorage.setItem('hq_must_change_password', '1'); } catch {}
        }
        setUser(data.role === 'DEV' ? INITIAL_DEV_USER : INITIAL_ADMIN_USER);
        return;
      } catch (err: any) {
        throw new Error(err?.message || 'Invalid admin credentials');
      }
    }
    throw new Error('Please use the sign-in form to log in.');
  };

  const logout = async () => {
    // Single logout for whichever session is active — admin OR customer.
    // We always wipe both so a partial state can't leave a stale token behind.
    try {
      localStorage.removeItem('hq_admin_token');
      localStorage.removeItem('hq_must_change_password');
      localStorage.removeItem('hq_customer_token');
    } catch {}
    setAdminToken(null);
    setCustomerToken(null);
    setUser(null);
    setLoyalty(null);
  };

  const addUser = async (newUser: User) => { await apiUpdateUser(newUser.id, newUser); };

  const updateUserProfile = async (updatedUser: User) => {
    await apiUpdateUser(updatedUser.id, updatedUser);
    if (user?.id === updatedUser.id) setUser(updatedUser);
  };

  const adminUpdateUser = async (updatedUser: User) => {
    await apiUpdateUser(updatedUser.id, updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const deleteUser = async (userId: string) => {
    await apiDeleteUser(userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const addMenuItem = async (item: MenuItem) => {
    await apiUpsertMenuItem(item);
    setMenu(prev => [...prev.filter(m => m.id !== item.id), item]);
  };

  const updateMenuItem = async (item: MenuItem) => {
    await apiUpsertMenuItem(item);
    setMenu(prev => prev.map(m => m.id === item.id ? item : m));
  };

  const deleteMenuItem = async (itemId: string) => {
    await apiDeleteMenuItem(itemId);
    setMenu(prev => prev.filter(m => m.id !== itemId));
  };

  const addCalendarEvent = async (event: CalendarEvent) => {
    await upsertEvent(event);
    setCalendarEvents(prev => [...prev.filter(e => e.id !== event.id), event]);
  };

  const updateCalendarEvent = async (event: CalendarEvent) => {
    await upsertEvent(event);
    setCalendarEvents(prev => prev.map(e => e.id === event.id ? event : e));
  };

  const removeCalendarEvent = async (eventId: string) => {
    await deleteEvent(eventId);
    setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const isDatePastCutoff = (dateStr: string, event?: CalendarEvent): boolean => {
    if (event) return isEventPastCutoff(event);
    // Fallback: orders open until end of cook day
    const cookDate = parseLocalDate(dateStr);
    cookDate.setHours(23, 59, 0, 0);
    return new Date() > cookDate;
  };

  const checkAvailability = (dateStr: string): boolean => {
    if (calendarEvents.find(e => e.date === dateStr && e.type === 'BLOCKED')) return false;
    if (orders.filter(o => o.cookDay === dateStr && o.type === 'CATERING').length >= 2) return false;
    // Catering requires at least 7 days notice
    const selected = parseLocalDate(dateStr);
    const minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    minDate.setDate(minDate.getDate() + 7);
    if (selected < minDate) return false;
    return true;
  };

  const createOrder = async (order: Order) => {
    await apiCreateOrder(order);
    setOrders(prev => [order, ...prev]);
    if (order.discountApplied && user?.hasCateringDiscount) {
      const updated = { ...user, hasCateringDiscount: false };
      setUser(updated);
      await updateUserProfile(updated);
    }

    // Auto-decrement stock for ordered items
    if (order.items?.length > 0) {
      for (const li of order.items) {
        const itemId = li.item?.id || li.item?._id;
        if (!itemId) continue;
        const menuItem = menu.find(m => m.id === itemId);
        if (menuItem && menuItem.stock != null && menuItem.stock > 0) {
          const newStock = Math.max(0, menuItem.stock - (li.quantity || 1));
          await updateMenuItem({ ...menuItem, stock: newStock, available: newStock > 0 } as any);
        }
      }
    }

    // Auto-add Golden Ticket stamp for any purchase meeting minimum
    if (user && settings.rewards?.enabled) {
      const minPurchase = settings.rewards.minPurchase || 0;
      const orderTotal = Number(order.total || 0);
      if (orderTotal >= minPurchase) {
        const stamps = user.stamps || 0;
        const updated = { ...user, stamps: stamps + 1 };
        setUser(updated);
        updateUserProfile(updated);
      }
    }

    clearCart();
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    await apiUpdateOrder(orderId, { status });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (status === 'Confirmed') {
      const order = orders.find(o => o.id === orderId);
      if (order?.type === 'CATERING') {
        const dateStr = order.cookDay.includes('T') ? toLocalDateStr(new Date(order.cookDay)) : order.cookDay;
        const newEvt: CalendarEvent = {
          id: `evt_o_${order.id}`, date: dateStr, type: 'ORDER_PICKUP',
          title: `Pickup: ${order.customerName}`, orderId: order.id,
        };
        await upsertEvent(newEvt);
        setCalendarEvents(prev => [...prev.filter(e => e.id !== newEvt.id), newEvt]);
      }
    }
  };

  const updateOrder = async (updatedOrder: Order) => {
    await apiUpdateOrder(updatedOrder.id, updatedOrder);
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  const addToCart = (item: MenuItem, quantity = 1, specificDate?: string) => {
    if (specificDate && selectedOrderDate && selectedOrderDate !== specificDate) {
      if (!window.confirm(`Your cart is for ${parseLocalDate(selectedOrderDate).toLocaleDateString()}. Clear cart for ${parseLocalDate(specificDate).toLocaleDateString()}?`)) return;
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

  const updateCartItemQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(i => i.id === itemId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const removeFromCart = (itemId: string) => setCart(prev => prev.filter(i => i.id !== itemId));
  const clearCart = () => setCart([]);

  const addSocialPost = async (post: SocialPost) => {
    await upsertSocialPost(post);
    setSocialPosts(prev => [post, ...prev]);
  };

  const updateSocialPost = async (post: SocialPost) => {
    await upsertSocialPost(post);
    setSocialPosts(prev => prev.map(p => p.id === post.id ? post : p));
  };

  const deleteSocialPost = async (postId: string) => {
    await apiDeleteSocialPost(postId);
    setSocialPosts(prev => prev.filter(p => p.id !== postId));
  };

  const addGalleryPost = async (post: GalleryPost) => {
    await submitGalleryPost(post);
    setGalleryPosts(prev => [post, ...prev]);
  };

  const toggleGalleryLike = async (postId: string) => {
    if (!user) return;
    const updated = await apiToggleGalleryLike(postId);
    setGalleryPosts(prev => prev.map(p => p.id === postId ? updated : p));
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    try {
      await apiUpdateSettings(newSettings);
      const aiKey = (newSettings as any).openrouterApiKey || (newSettings as any).geminiApiKey;
      if (aiKey) setGeminiApiKey(aiKey);
      return true;
    } catch (err: any) {
      console.error('[Settings] API write failed:', err.message);
      return err.message || 'Unknown error';
    }
  };

  const addCookDay = (day: CookDay) => setCookDays(prev => [...prev, day]);

  const toggleReminder = (eventId: string) => {
    setReminders(prev =>
      prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]
    );
  };

  return (
    <AppContext.Provider value={{
      user, users, login, logout, addUser, updateUserProfile, adminUpdateUser, deleteUser,
      menu, addMenuItem, updateMenuItem, deleteMenuItem,
      cookDays, addCookDay,
      calendarEvents, addCalendarEvent, updateCalendarEvent, removeCalendarEvent, checkAvailability, isDatePastCutoff,
      orders, createOrder, updateOrderStatus, updateOrder,
      cart, addToCart, updateCartItemQuantity, removeFromCart, clearCart,
      socialPosts, addSocialPost, updateSocialPost, deleteSocialPost,
      galleryPosts, addGalleryPost, toggleGalleryLike,
      settings, updateSettings,
      reminders, toggleReminder,
      selectedOrderDate, setSelectedOrderDate,
      loyalty, requestCustomerSignIn, completeCustomerSignIn, refreshCustomer, updateCustomerProfile,
      isLoading, connectionError,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// Backwards-compat aliases so existing pages work without changes
export const useStorefront = useApp;
export const useAuth = () => {
  const ctx = useApp();
  return { user: ctx.user, login: ctx.login, logout: ctx.logout, loading: ctx.isLoading };
};
export const useClientConfig = () => ({
  brandName: (import.meta as any).env?.VITE_BRAND_NAME || 'Hughesys Que',
  brandTagline: (import.meta as any).env?.VITE_BRAND_TAGLINE || 'Quality Street Food',
  primaryColor: (import.meta as any).env?.VITE_PRIMARY_COLOR || '#f59e0b',
  clientMode: true,
  enabledApps: ['foodtruck'],
  loading: false,
});
