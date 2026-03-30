/**
 * API client for Cloudflare D1 backend.
 * Replaces firestoreRest.ts — all data goes through /api/v1/* endpoints.
 */
import type { MenuItem, Order, CalendarEvent, User, SocialPost, GalleryPost, AppSettings } from '../types';

let getToken: () => Promise<string | null> = async () => null;
export const initApi = (tokenFn: () => Promise<string | null>) => { getToken = tokenFn; };

async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api/v1${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  // DELETE returns 204 sometimes
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Menu
export const fetchMenu = () => apiFetch<MenuItem[]>('/menu');
export const upsertMenuItem = (item: Partial<MenuItem> & { id: string }) =>
  apiFetch<MenuItem>('/menu', { method: 'POST', body: JSON.stringify(item) });
export const deleteMenuItem = (id: string) =>
  apiFetch(`/menu/${id}`, { method: 'DELETE' });

// Orders
export const fetchOrders = () => apiFetch<Order[]>('/orders');
export const createOrder = (order: Partial<Order>) =>
  apiFetch<Order>('/orders', { method: 'POST', body: JSON.stringify(order) });
export const updateOrder = (id: string, data: Partial<Order>) =>
  apiFetch<Order>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Calendar Events
export const fetchEvents = () => apiFetch<CalendarEvent[]>('/events');
export const upsertEvent = (event: Partial<CalendarEvent> & { id: string }) =>
  apiFetch<CalendarEvent>('/events', { method: 'POST', body: JSON.stringify(event) });
export const deleteEvent = (id: string) =>
  apiFetch(`/events/${id}`, { method: 'DELETE' });

// Users
export const fetchUsers = () => apiFetch<User[]>('/users');
export const fetchCurrentUser = () => apiFetch<User>('/users/me');
export const updateUser = (id: string, data: Partial<User>) =>
  apiFetch<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteUser = (id: string) =>
  apiFetch(`/users/${id}`, { method: 'DELETE' });

// Social Posts
export const fetchSocialPosts = () => apiFetch<SocialPost[]>('/social-posts');
export const upsertSocialPost = (post: Partial<SocialPost> & { id: string }) =>
  apiFetch<SocialPost>('/social-posts', { method: 'POST', body: JSON.stringify(post) });
export const deleteSocialPost = (id: string) =>
  apiFetch(`/social-posts/${id}`, { method: 'DELETE' });

// Gallery
export const fetchGalleryPosts = () => apiFetch<GalleryPost[]>('/gallery');
export const submitGalleryPost = (post: Partial<GalleryPost>) =>
  apiFetch<GalleryPost>('/gallery', { method: 'POST', body: JSON.stringify(post) });
export const updateGalleryPost = (id: string, data: Partial<GalleryPost>) =>
  apiFetch<GalleryPost>(`/gallery/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteGalleryPost = (id: string) =>
  apiFetch(`/gallery/${id}`, { method: 'DELETE' });
export const toggleGalleryLike = (id: string) =>
  apiFetch(`/gallery/${id}/like`, { method: 'POST' });

// Settings
export const fetchSettings = () => apiFetch<AppSettings>('/settings');
export const updateSettings = (data: Partial<AppSettings>) =>
  apiFetch<AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) });

// Seed
export const seedDatabase = () =>
  apiFetch('/seed', { method: 'POST' });

// Stream / Live
export const createLiveInput = () => apiFetch('/stream/live-inputs', { method: 'POST' });
export const getLiveInputs = () => apiFetch('/stream/live-inputs');
export const getStreamStatus = () => apiFetch('/stream/status');
export const getRecordings = () => apiFetch('/stream/recordings');

// Upload recorded video to Cloudflare Stream
export const uploadRecording = async (file: Blob, title: string) => {
  const token = await getToken();
  const formData = new FormData();
  formData.append('file', file, `${title}.webm`);
  formData.append('title', title);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Do NOT set Content-Type — let the browser set it with the multipart boundary
  const res = await fetch('/api/v1/stream/upload', { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
};

// Live Chat
export const getChatMessages = (streamId: string, after?: string) => {
  const params = new URLSearchParams({ streamId });
  if (after) params.set('after', after);
  return apiFetch(`/stream/chat?${params}`);
};
export const sendChatMessage = (streamId: string, userName: string, message: string) =>
  apiFetch('/stream/chat', { method: 'POST', body: JSON.stringify({ streamId, userName, message }) });
export const deleteChatMessage = (id: string) =>
  apiFetch(`/stream/chat?id=${id}`, { method: 'DELETE' });
export const banChatUser = (userName: string, reason?: string) =>
  apiFetch('/stream/chat', { method: 'POST', body: JSON.stringify({ action: 'ban', userName, reason }) });
export const unbanChatUser = (userName: string) =>
  apiFetch('/stream/chat', { method: 'POST', body: JSON.stringify({ action: 'unban', userName }) });
export const getChatBans = (streamId: string) =>
  apiFetch(`/stream/chat?streamId=${streamId}&bans=true`);

// Not applicable (no Firebase in this stack)
export const migrateFromFirestore = async (_apiKey?: string) => {
  return { migrated: 0, message: 'Migration not available — this app uses Cloudflare D1 natively.' };
};
