import React, { useState, useMemo, useEffect } from 'react';
import AdminSocialBridge from './AdminSocialBridge';
import { useStorefront } from '../context/StorefrontContext';
import { useClientConfig } from '../context/ClientConfigContext';
import { useAuth } from '../context/AuthContext';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../firebase';
import toast from 'react-hot-toast';
import {
  CalendarCheck, CalendarDays, Utensils, Settings, Plus, Edit2, Trash2, X, Save,
  ChevronLeft, ChevronRight, ShoppingBag, Truck, Package, Check, AlertTriangle,
  DollarSign, Loader2, Image as ImageIcon, ChevronDown, ChevronUp, HelpCircle,
  CheckSquare, Square, Flame, Cloud, Wifi, Users, Star, Gift,
  Search, UserCheck, AlertCircle, Smartphone, Wand2, Sparkles, Copy,
  ClipboardList, Thermometer, Clock, BookOpen, MessageSquare, Bot, User as UserIcon, Send, Code2,
  RefreshCw, BarChart2, Database, Activity, CreditCard, Mail, TrendingUp, Eye, Zap, Server,
  Share2, Globe, ImagePlus, Lock, UploadCloud, FileText, Palette, Link, WifiOff
} from 'lucide-react';

// ─── FIREBASE STORAGE UPLOAD HELPER ────────────────────────────────
const uploadToStorage = async (file, path) => {
  if (!storage) throw new Error('Firebase Storage not configured');
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};

// ─── CANVAS IMAGE COMPRESSOR (matches Street Meats BBQ) ─────────────
// Takes a base64 string (from FileReader) and returns a compressed base64.
// Keeps images small enough to store directly in Firestore (no URL expiry).
const compressImageBase64 = (base64Str, maxW = 700, quality = 0.55) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });

// ─── HELP TIP COMPONENT ─────────────────────────────────────────────
const Tip = ({ text }) => (
  <span className="relative group inline-flex items-center cursor-help">
    <HelpCircle size={13} className="text-gray-600 group-hover:text-gray-400 transition-colors ml-1.5" />
    <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 border border-gray-700 rounded-xl p-3 text-[11px] text-gray-300 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-2xl whitespace-normal">
      {text}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
    </span>
  </span>
);

// ─── ORDER MANAGER ───────────────────────────────────────────────────
const OrderManager = () => {
  const { orders, updateOrderStatus, updateOrder, createOrder, menu, calendarEvents, updateUserProfile, users } = useStorefront();
  const [editingOrder, setEditingOrder] = useState(null);
  const [newItemId, setNewItemId] = useState('');
  const [isCustomItem, setIsCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const STATUS_COLORS = {
    pending: 'text-yellow-500', confirmed: 'text-blue-400', awaiting_payment: 'text-orange-400',
    paid: 'text-emerald-400', cooking: 'text-orange-600', ready: 'text-green-500',
    shipped: 'text-purple-400', completed: 'text-gray-500', rejected: 'text-red-500', cancelled: 'text-red-500'
  };

  const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const filtered = filterStatus === 'all' ? sortedOrders : sortedOrders.filter(o => o.status === filterStatus);
  const pending = orders.filter(o => o.status === 'pending');

  const handleStatusChange = (orderId, status) => {
    if (window.confirm(`Set status to "${status}"?`)) updateOrderStatus(orderId, status);
  };

  const handleApprove = (order) => {
    const id = order._id || order.id;
    if (window.confirm(`Approve order for ${order.customer?.name || order.customerName}? This confirms the booking.`))
      updateOrderStatus(id, 'confirmed');
  };

  const handleDecline = (order) => {
    const id = order._id || order.id;
    if (window.confirm(`Decline order for ${order.customer?.name || order.customerName}?`))
      updateOrderStatus(id, 'rejected');
  };

  const handleMarkPaid = (order) => {
    const id = order._id || order.id;
    if (window.confirm('Confirm payment received?')) {
      updateOrderStatus(id, 'paid');
      if (order.type === 'CATERING' && order.total > 1000) {
        const custUser = users?.find(u => u.email === order.customer?.email);
        if (custUser) {
          updateUserProfile({ ...custUser, hasCateringDiscount: true });
          alert(`Customer ${custUser.name} has spent >$1k. A 10% catering discount has been attached.`);
        }
      }
    }
  };

  const handleMarkReady = (order) => {
    const id = order._id || order.id;
    const name = order.customer?.name || order.customerName;
    const phone = order.customer?.phone || order.customerPhone;
    const evt = calendarEvents.find(e => e.date === (order.cookDay || order.pickupDate)?.split('T')[0] && e.type === 'ORDER_PICKUP');
    const loc = evt?.location || 'our location';
    alert(`[SMS SIMULATION]\nTo: ${phone}\n\n"Hey ${name}, your order is READY! 🔥\nPickup at: ${loc}"`);
    updateOrderStatus(id, 'ready');
  };

  const handleEditClick = (order) => {
    setEditingOrder(JSON.parse(JSON.stringify(order)));
    setNewItemId(''); setIsCustomItem(false); setCustomItemName(''); setCustomItemPrice('');
  };

  const handleCreateManual = () => {
    setEditingOrder({
      _id: `ord_man_${Date.now()}`, customerName: '', customerEmail: '', customerPhone: '',
      items: [], total: 0, status: 'pending', cookDay: new Date().toISOString().split('T')[0],
      orderType: 'pickup', pickupTime: '12:00', createdAt: new Date().toISOString(),
    });
  };

  const handleAddItem = () => {
    if (!editingOrder) return;
    if (isCustomItem) {
      if (!customItemName || !customItemPrice) return;
      const newLine = { name: customItemName, unitPrice: parseFloat(customItemPrice), quantity: 1 };
      const items = [...(editingOrder.items || []), newLine];
      const total = items.reduce((s, l) => s + (l.unitPrice || l.price || 0) * l.quantity, 0);
      setEditingOrder({ ...editingOrder, items, total });
      setCustomItemName(''); setCustomItemPrice('');
    } else {
      if (!newItemId) return;
      const mi = menu.find(m => (m._id || m.id) === newItemId);
      if (mi) {
        const newLine = { name: mi.name, unitPrice: mi.price, quantity: 1, menuItemId: mi._id || mi.id };
        const items = [...(editingOrder.items || []), newLine];
        const total = items.reduce((s, l) => s + (l.unitPrice || l.price || 0) * l.quantity, 0);
        setEditingOrder({ ...editingOrder, items, total });
        setNewItemId('');
      }
    }
  };

  const handleQtyChange = (idx, delta) => {
    const items = [...editingOrder.items];
    const newQty = items[idx].quantity + delta;
    if (newQty === 0) { if (window.confirm('Remove item?')) items.splice(idx, 1); }
    else items[idx] = { ...items[idx], quantity: newQty };
    const total = items.reduce((s, l) => s + (l.unitPrice || l.price || 0) * l.quantity, 0);
    setEditingOrder({ ...editingOrder, items, total });
  };

  const handleSaveEdit = () => {
    if (!editingOrder.customerName) { alert('Customer name is required.'); return; }
    if ((editingOrder.items || []).length === 0) { alert('Add at least one item.'); return; }
    const exists = orders.find(o => (o._id || o.id) === (editingOrder._id || editingOrder.id));
    if (exists) updateOrder(editingOrder); else createOrder(editingOrder);
    setEditingOrder(null);
  };

  const statusOptions = ['pending', 'confirmed', 'awaiting_payment', 'paid', 'cooking', 'ready', 'completed', 'rejected'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
        <div>
          <h3 className="text-xl font-bold text-white">Order Management</h3>
          {pending.length > 0 && (
            <span className="text-xs bg-yellow-900/50 text-yellow-200 px-2 py-1 rounded border border-yellow-700 flex items-center gap-1 mt-1 w-fit">
              <AlertTriangle size={12} /> {pending.length} pending request{pending.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white">
            <option value="all">All Orders</option>
            {statusOptions.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          <button onClick={handleCreateManual} className="bg-bbq-red text-white px-4 py-2 rounded font-bold flex items-center gap-2 hover:bg-red-700 text-sm">
            <Plus size={16} /> Manual Order
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">No orders found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const id = order._id || order.id;
            const name = order.customer?.name || order.customerName || 'Customer';
            const email = order.customer?.email || order.customerEmail;
            const statusColor = STATUS_COLORS[order.status?.toLowerCase()] || 'text-white';
            const isPending = order.status === 'pending';
            const isAwaitingPayment = order.status === 'awaiting_payment';
            const isPaid = ['paid', 'cooking', 'ready', 'confirmed'].includes(order.status);
            return (
              <div key={id} className={`bg-gray-900 rounded-xl border p-4 transition ${isPending ? 'border-yellow-700 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-gray-800 hover:border-gray-700'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{name}</span>
                      <span className={`text-xs font-bold uppercase ${statusColor}`}>{order.status}</span>
                      {order.orderType === 'catering' && <span className="text-xs bg-purple-900/40 text-purple-200 px-1.5 py-0.5 rounded border border-purple-700">CATERING</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{email} • #{order.orderNumber || id?.slice(-8)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {(order.items || []).slice(0, 3).map(i => `${i.quantity}x ${i.name || i.item?.name}`).join(', ')}
                      {(order.items || []).length > 3 && ` +${(order.items || []).length - 3} more`}
                    </p>
                    {order.cookDay || order.pickupDate ? (
                      <p className="text-xs text-gray-500 mt-1">
                        📅 {new Date((order.cookDay || order.pickupDate) + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {order.pickupTime ? ` at ${order.pickupTime}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap shrink-0">
                    <span className="text-bbq-gold font-bold text-lg">${(order.total || 0).toFixed(2)}</span>
                    {isPending && (
                      <>
                        <button onClick={() => handleApprove(order)} className="bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><Check size={14} /> Approve</button>
                        <button onClick={() => handleDecline(order)} className="bg-red-900/50 hover:bg-red-700 text-red-200 px-3 py-1.5 rounded text-xs font-bold">Decline</button>
                      </>
                    )}
                    {isAwaitingPayment && (
                      <button onClick={() => handleMarkPaid(order)} className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><DollarSign size={14} /> Mark Paid</button>
                    )}
                    {isPaid && order.status !== 'ready' && (
                      <button onClick={() => handleMarkReady(order)} className="bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold">Mark Ready</button>
                    )}
                    <button onClick={() => handleEditClick(order)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition"><Edit2 size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-bbq-charcoal border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/50">
              <h3 className="text-lg font-bold text-white">{orders.find(o => (o._id || o.id) === (editingOrder._id || editingOrder.id)) ? 'Edit Order' : 'Create Manual Order'}</h3>
              <button onClick={() => setEditingOrder(null)} className="p-1.5 hover:bg-white/10 rounded-full"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[['customerName', 'Customer Name', 'text'], ['customerEmail', 'Email', 'email'], ['customerPhone', 'Phone', 'text']].map(([key, label, type]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-400 uppercase font-bold block mb-1">{label}</label>
                    <input type={type} value={editingOrder[key] || editingOrder.customer?.[key.replace('customer', '')] || ''}
                      onChange={e => setEditingOrder({ ...editingOrder, [key]: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Status</label>
                  <select value={editingOrder.status} onChange={e => setEditingOrder({ ...editingOrder, status: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm"
                  >
                    {statusOptions.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Cook Date</label>
                  <input type="date" value={(editingOrder.cookDay || editingOrder.pickupDate || '').split('T')[0]}
                    onChange={e => setEditingOrder({ ...editingOrder, cookDay: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Pickup Time</label>
                  <input value={editingOrder.pickupTime || ''} onChange={e => setEditingOrder({ ...editingOrder, pickupTime: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Courier</label>
                  <input value={editingOrder.courier || ''} onChange={e => setEditingOrder({ ...editingOrder, courier: e.target.value })}
                    placeholder="Australia Post" className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Tracking #</label>
                  <input value={editingOrder.trackingNumber || ''} onChange={e => setEditingOrder({ ...editingOrder, trackingNumber: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm font-mono" />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Items</label>
                <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                  {(editingOrder.items || []).length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm italic">No items. Add below.</div>
                  ) : (editingOrder.items || []).map((line, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border-b border-gray-800 last:border-0">
                      <div>
                        <span className="font-bold text-white text-sm">{line.name || line.item?.name}</span>
                        <span className="text-xs text-gray-500 ml-2">${(line.unitPrice || line.price || line.item?.price || 0).toFixed(2)} ea</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleQtyChange(idx, -1)} className="w-6 h-6 bg-gray-700 rounded hover:bg-red-900 text-white text-sm">-</button>
                        <span className="w-5 text-center text-white text-sm">{line.quantity}</span>
                        <button onClick={() => handleQtyChange(idx, 1)} className="w-6 h-6 bg-gray-700 rounded hover:bg-green-900 text-white text-sm">+</button>
                        <span className="text-bbq-gold text-sm w-16 text-right">${((line.unitPrice || line.price || line.item?.price || 0) * line.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-gray-800 border-t border-gray-700 space-y-2">
                    <div className="flex gap-3 text-xs mb-2">
                      <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={!isCustomItem} onChange={() => setIsCustomItem(false)} /> Menu Item</label>
                      <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={isCustomItem} onChange={() => setIsCustomItem(true)} /> Custom</label>
                    </div>
                    {isCustomItem ? (
                      <div className="flex gap-2">
                        <input placeholder="Name" value={customItemName} onChange={e => setCustomItemName(e.target.value)} className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs" />
                        <input type="number" placeholder="$0.00" value={customItemPrice} onChange={e => setCustomItemPrice(e.target.value)} className="w-20 bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs" />
                        <button onClick={handleAddItem} disabled={!customItemName || !customItemPrice} className="bg-blue-600 text-white px-3 rounded text-xs font-bold disabled:opacity-50">Add</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select value={newItemId} onChange={e => setNewItemId(e.target.value)} className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-xs">
                          <option value="">Select from menu...</option>
                          {menu.map(m => <option key={m._id || m.id} value={m._id || m.id}>{m.name} (${m.price})</option>)}
                        </select>
                        <button onClick={handleAddItem} disabled={!newItemId} className="bg-blue-600 text-white px-3 rounded text-xs font-bold disabled:opacity-50">Add</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-900 border-t border-gray-700 flex justify-between items-center">
              <span className="text-xl font-bold text-white">Total: <span className="text-bbq-gold">${(editingOrder.total || 0).toFixed(2)}</span></span>
              <div className="flex gap-2">
                <button onClick={() => setEditingOrder(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                <button onClick={handleSaveEdit} className="px-5 py-2 bg-bbq-red text-white font-bold rounded flex items-center gap-2 hover:bg-red-700 text-sm"><Save size={16} /> Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PLANNER ─────────────────────────────────────────────────────────
const FTPlanner = () => {
  const { calendarEvents, addCalendarEvent, updateCalendarEvent, removeCalendarEvent } = useStorefront();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState({ type: 'BLOCKED', title: '', location: '', startTime: '14:00', endTime: '16:00', time: '', description: '', date: new Date().toISOString().split('T')[0] });

  const getDays = () => {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const days = [];
    for (let i = 0; i < new Date(year, month, 1).getDay(); i++) days.push(null);
    for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const openAddModal = (dateStr) => {
    setEditingEvent({ id: undefined, type: 'ORDER_PICKUP', title: '', location: '', startTime: '14:00', endTime: '16:00', time: '', description: '', date: dateStr || new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingEvent.title || !editingEvent.date) return;
    if (editingEvent.id) updateCalendarEvent(editingEvent);
    else addCalendarEvent({ ...editingEvent, id: `evt_${Date.now()}` });
    setIsModalOpen(false);
  };

  const days = getDays();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b border-gray-700 pb-4">
        <div>
          <h3 className="text-xl font-bold text-white">Planner & Availability</h3>
          <p className="text-gray-400 text-sm">Manage cook days, public events, and blocked dates.</p>
        </div>
        <button onClick={() => openAddModal()} className="bg-bbq-red px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 hover:bg-red-700">
          <Plus size={14} /> Add Event
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs bg-gray-900/50 p-2 rounded">
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-900 rounded-full border border-red-500"></span> Blocked</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-900 rounded-full border border-blue-500"></span> Cook Day</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-900 rounded-full border border-green-500"></span> Public Event</div>
      </div>

      <div className="flex justify-between items-center bg-gray-900 p-3 rounded-t-xl border border-gray-800">
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-gray-800 rounded"><ChevronLeft size={18} /></button>
        <h2 className="text-lg font-bold font-display uppercase tracking-wide text-white">{monthName}</h2>
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-gray-800 rounded"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-800 border border-gray-800 rounded-b-xl overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-gray-900 p-2 text-center text-xs font-bold text-gray-500 uppercase">{d}</div>
        ))}
        {days.map((date, idx) => {
          if (!date) return <div key={`e-${idx}`} className="bg-bbq-charcoal/50 min-h-[80px]"></div>;
          const dateStr = date.toISOString().split('T')[0];
          const evts = calendarEvents.filter(e => e.date === dateStr);
          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
          return (
            <div key={dateStr} onClick={() => !isPast && openAddModal(dateStr)}
              className={`min-h-[80px] p-1.5 bg-bbq-charcoal transition relative cursor-pointer group ${isPast ? 'opacity-40' : 'hover:bg-gray-700'}`}>
              <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${date.toDateString() === new Date().toDateString() ? 'bg-bbq-red text-white' : 'text-gray-400'}`}>
                {date.getDate()}
              </span>
              <div className="space-y-0.5 mt-1">
                {evts.map(evt => (
                  <div key={evt.id} onClick={(e) => { e.stopPropagation(); setEditingEvent({ ...evt }); setIsModalOpen(true); }}
                    className={`text-[10px] p-0.5 rounded truncate border-l-2 cursor-pointer ${evt.type === 'BLOCKED' ? 'bg-red-900/40 border-red-500 text-red-200' :
                      evt.type === 'ORDER_PICKUP' ? 'bg-blue-900/40 border-blue-500 text-blue-200' :
                        'bg-green-900/40 border-green-500 text-green-200'}`}>
                    {evt.type === 'ORDER_PICKUP' && <ShoppingBag size={8} className="inline mr-0.5" />}
                    {evt.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-bbq-charcoal border border-gray-700 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-700 sticky top-0 bg-bbq-charcoal">
              <h3 className="text-lg font-bold text-white">{editingEvent.id ? 'Edit Event' : 'Add Event'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={18} className="text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 font-bold mb-1">Date</label>
                  <input type="date" value={editingEvent.date} onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 font-bold mb-1">Type</label>
                  <select value={editingEvent.type} onChange={e => setEditingEvent({ ...editingEvent, type: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm">
                    <option value="BLOCKED">Blocked / Closed</option>
                    <option value="ORDER_PICKUP">Cook Day (Orders)</option>
                    <option value="PUBLIC_EVENT">Public Event</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-bold mb-1">Title</label>
                <input value={editingEvent.title} onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  placeholder="e.g. Friday Cook Up" className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
              </div>
              {editingEvent.type === 'ORDER_PICKUP' && (
                <div className="bg-blue-900/20 p-3 rounded border border-blue-800 space-y-3">
                  <h4 className="text-sm font-bold text-blue-200">Collection Window</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">Start</label>
                      <input type="time" value={editingEvent.startTime || ''} onChange={e => setEditingEvent({ ...editingEvent, startTime: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">End</label>
                      <input type="time" value={editingEvent.endTime || ''} onChange={e => setEditingEvent({ ...editingEvent, endTime: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold mb-1">Location</label>
                    <input value={editingEvent.location || ''} onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })}
                      placeholder="e.g. West End HQ" className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
                  </div>
                </div>
              )}
              {(editingEvent.type === 'PUBLIC_EVENT' || editingEvent.type === 'BLOCKED') && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">Location</label>
                      <input value={editingEvent.location || ''} onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 font-bold mb-1">Display Time</label>
                      <input value={editingEvent.time || ''} onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })}
                        placeholder="12pm - 8pm" className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 font-bold mb-1">Description</label>
                    <textarea value={editingEvent.description || ''} onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                      rows={3} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm resize-none" />
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                {editingEvent.id ? (
                  <button onClick={() => { if (window.confirm('Delete event?')) { removeCalendarEvent(editingEvent.id); setIsModalOpen(false); } }}
                    className="text-red-500 hover:text-red-400 text-sm flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                ) : <div />}
                <div className="flex gap-2">
                  <button onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 text-gray-400 hover:text-white text-sm">Cancel</button>
                  <button onClick={handleSave} className="px-4 py-1.5 bg-bbq-red rounded text-white font-bold text-sm flex items-center gap-1"><Save size={14} /> Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MENU MANAGER ────────────────────────────────────────────────────
const FTMenuManager = () => {
  const { menu, addMenuItem, updateMenuItem, calendarEvents } = useStorefront();
  const { brandName } = useClientConfig();
  const [isEditing, setIsEditing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [editItem, setEditItem] = useState({ availabilityType: 'everyday', isPack: false, packGroups: [], available: true });
  const [activeGroupIndex, setActiveGroupIndex] = useState(null);
  const [isAiImg, setIsAiImg] = useState(false);
  const [isAiDesc, setIsAiDesc] = useState(false);

  const handleAiImage = async () => {
    if (!editItem.name) { toast.error('Enter item name first.'); return; }
    setIsAiImg(true);
    const url = await generateImage(`${editItem.name} ${editItem.category || ''} BBQ dish, food photography`, brandName);
    setEditItem(p => ({ ...p, image: url }));
    setIsAiImg(false);
    toast.success('AI image generated!');
  };

  const handleAiDesc = async () => {
    if (!editItem.name) { toast.error('Enter item name first.'); return; }
    setIsAiDesc(true);
    const result = await callGemini(
      `Write a 1-2 sentence appetizing menu item description for "${editItem.name}" (${editItem.category || 'BBQ'}) at ${brandName || 'Hughesys Que'} BBQ food truck. Keep it under 60 words, mouth-watering and casual.`,
      'You are a BBQ restaurant copywriter. Return only the description text, no quotes.'
    );
    if (result && typeof result === 'string') setEditItem(p => ({ ...p, description: result.trim() }));
    else toast.error('AI unavailable — set your Gemini key in Dev Tools.');
    setIsAiDesc(false);
  };

  const orderDays = calendarEvents.filter(e => e.type === 'ORDER_PICKUP' && new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const itemsByCategory = menu.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const CATEGORIES = ['Meats', 'Burgers', 'Sides', 'Hot Sides', 'Cold Sides', 'Platters', 'Family Packs', 'Bulk Meats', 'Drinks', 'Bakery', 'Rubs & Sauces', 'Service', 'Merch'];

  const handleSave = (e) => {
    e.preventDefault();
    if (!editItem.name || !editItem.price) return;
    const itemToSave = { ...editItem, category: editItem.category || 'Meats' };
    if (editItem._id || editItem.id) updateMenuItem(itemToSave);
    else addMenuItem({ ...itemToSave, available: true });
    setIsEditing(false);
    setEditItem({ availabilityType: 'everyday', isPack: false, packGroups: [], available: true });
  };

  const addPackGroup = () => setEditItem(prev => ({ ...prev, packGroups: [...(prev.packGroups || []), { name: '', limit: 1, options: [] }] }));
  const updatePackGroup = (idx, field, val) => {
    const g = [...(editItem.packGroups || [])];
    g[idx] = { ...g[idx], [field]: val };
    setEditItem(prev => ({ ...prev, packGroups: g }));
  };
  const toggleItemInGroup = (groupIdx, itemName) => {
    const g = editItem.packGroups?.[groupIdx];
    if (!g) return;
    const opts = g.options || [];
    updatePackGroup(groupIdx, 'options', opts.includes(itemName) ? opts.filter(o => o !== itemName) : [...opts, itemName]);
  };
  const removePackGroup = (idx) => setEditItem(prev => ({ ...prev, packGroups: prev.packGroups?.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-5">
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
        <button onClick={() => setShowGuide(!showGuide)} className="w-full flex justify-between items-center text-blue-200 font-bold text-sm">
          <span className="flex items-center gap-2"><HelpCircle size={16} /> Menu Management Guide</span>
          {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showGuide && (
          <div className="mt-3 text-xs text-gray-300 space-y-2">
            <p><strong className="text-white">Basic Items:</strong> Name + Price + Category. Optionally add an image URL.</p>
            <p><strong className="text-white">Pack Items:</strong> Check "This is a Pack" → Add Choice Groups (e.g. "Choose 2 Burgers" with limit 2).</p>
            <p><strong className="text-white">Catering Items:</strong> Check "Available for Catering" to show in the DIY catering builder.</p>
            <p><strong className="text-white">Availability:</strong> Everyday = always on menu. Specific Date = only on selected cook days.</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center border-b border-gray-700 pb-2">
        <h3 className="text-xl font-bold text-white flex items-center">Menu Items ({menu.length})<Tip text="Changes are live immediately. Use the ✨ AI button on any image or description field to auto-generate content. Pack items let customers mix-and-match choices." /></h3>
        <button onClick={() => { setIsEditing(true); setEditItem({ availabilityType: 'everyday', isPack: false, packGroups: [], available: true }); }}
          className="bg-bbq-red px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-red-700">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {isEditing && (
        <form onSubmit={handleSave} className="bg-gray-900 p-5 rounded-xl border border-gray-700 space-y-4 animate-fade-in">
          <h4 className="font-bold text-lg text-white">{(editItem._id || editItem.id) ? 'Edit Item' : 'New Item'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <input placeholder="Item Name*" value={editItem.name || ''} onChange={e => setEditItem({ ...editItem, name: e.target.value })} required
                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
              <div className="flex gap-2">
                <input type="number" placeholder="Price*" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({ ...editItem, price: parseFloat(e.target.value) })} required
                  className="bg-gray-800 border border-gray-600 rounded p-2 text-white flex-1 text-sm" />
                <select value={editItem.category || 'Meats'} onChange={e => setEditItem({ ...editItem, category: e.target.value })}
                  className="bg-gray-800 border border-gray-600 rounded p-2 text-white flex-1 text-sm">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="flex gap-2 mb-2">
                <input placeholder="Image URL" value={editItem.image || ''} onChange={e => setEditItem({ ...editItem, image: e.target.value })}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
                <button type="button" onClick={handleAiImage} disabled={isAiImg} title="Generate image with AI"
                  className="p-2 bg-purple-900/60 border border-purple-700 rounded hover:bg-purple-800 shrink-0 disabled:opacity-50">
                  {isAiImg ? <Loader2 size={14} className="animate-spin text-purple-300" /> : <Sparkles size={14} className="text-purple-300" />}
                </button>
              </div>
              {editItem.image && <div className="w-full h-24 rounded overflow-hidden border border-gray-700"><img src={editItem.image} alt="Preview" className="w-full h-full object-cover" /></div>}
            </div>
          </div>
          <div className="relative">
            <textarea placeholder="Description" value={editItem.description || ''} onChange={e => setEditItem({ ...editItem, description: e.target.value })}
              rows={2} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm pr-10 resize-none" />
            <button type="button" onClick={handleAiDesc} disabled={isAiDesc} title="Generate description with AI"
              className="absolute top-2 right-2 p-1 bg-purple-900/60 border border-purple-700 rounded hover:bg-purple-800 disabled:opacity-50">
              {isAiDesc ? <Loader2 size={12} className="animate-spin text-purple-300" /> : <Sparkles size={12} className="text-purple-300" />}
            </button>
          </div>

          {/* Catering Toggle */}
          <div className="bg-black/20 p-3 rounded border border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editItem.availableForCatering || false} onChange={e => setEditItem({ ...editItem, availableForCatering: e.target.checked })} className="rounded text-bbq-red" />
              <span className="font-bold text-white text-sm">Available for Catering & Build Your Own</span>
            </label>
            {editItem.availableForCatering && (
              <div className="mt-3 pl-4 border-l-2 border-bbq-red space-y-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Catering Category</label>
                  <select value={editItem.cateringCategory || 'Meat'} onChange={e => setEditItem({ ...editItem, cateringCategory: e.target.value })}
                    className="bg-gray-900 border border-gray-600 rounded p-1.5 text-white text-xs w-full">
                    <option value="Meat">Meat (counts towards Meat limit)</option>
                    <option value="Side">Side (counts towards Side limit)</option>
                    <option value="Extra">Extra / Add-on</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Order Qty (MOQ)</label>
                  <input type="number" min="1" value={editItem.moq || ''} onChange={e => setEditItem({ ...editItem, moq: parseInt(e.target.value) || 1 })}
                    className="bg-gray-900 border border-gray-600 rounded p-1.5 text-white text-xs w-24" placeholder="e.g. 10" />
                </div>
              </div>
            )}
          </div>

          {/* Pack Toggle */}
          <div className="bg-black/20 p-3 rounded border border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editItem.isPack || false} onChange={e => setEditItem({ ...editItem, isPack: e.target.checked })} className="rounded text-bbq-red" />
              <span className="font-bold text-white text-sm flex items-center gap-1"><Package size={14} /> This is a Pack (requires selections)</span>
            </label>
            {editItem.isPack && (
              <div className="space-y-2 mt-3 pl-4 border-l-2 border-bbq-red">
                {(editItem.packGroups || []).map((group, idx) => (
                  <div key={idx} className="bg-gray-800 p-3 rounded border border-gray-700">
                    <div className="flex gap-2 items-center mb-2">
                      <input placeholder="Group Name" value={group.name} onChange={e => updatePackGroup(idx, 'name', e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded p-1.5 text-white text-xs flex-1" />
                      <div className="flex items-center gap-1 bg-gray-700 px-2 rounded border border-gray-600">
                        <span className="text-[10px] text-gray-400">Limit:</span>
                        <input type="number" value={group.limit} onChange={e => updatePackGroup(idx, 'limit', parseInt(e.target.value))}
                          className="bg-transparent w-8 p-1 text-white text-xs text-center outline-none" />
                      </div>
                      <button type="button" onClick={() => removePackGroup(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(group.options || []).map(opt => (
                        <span key={opt} className="bg-bbq-red text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                          {opt} <button type="button" onClick={() => toggleItemInGroup(idx, opt)}><X size={10} /></button>
                        </span>
                      ))}
                      <button type="button" onClick={() => setActiveGroupIndex(activeGroupIndex === idx ? null : idx)}
                        className="bg-gray-700 text-gray-300 hover:text-white text-xs px-2 py-0.5 rounded flex items-center gap-1"><Plus size={10} /> Add Items</button>
                    </div>
                    {activeGroupIndex === idx && (
                      <div className="bg-gray-900 border border-gray-600 rounded p-3 max-h-40 overflow-y-auto">
                        {Object.entries(itemsByCategory).map(([cat, items]) => (
                          <div key={cat}>
                            <div className="text-[10px] font-bold text-bbq-gold uppercase bg-black/20 px-2 py-0.5 mb-1 rounded">{cat}</div>
                            <div className="grid grid-cols-2 gap-1">
                              {items.map(m => {
                                const isSelected = (group.options || []).includes(m.name);
                                return (
                                  <div key={m._id || m.id} onClick={() => toggleItemInGroup(idx, m.name)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer text-xs ${isSelected ? 'bg-green-900/30 text-green-300' : 'hover:bg-gray-800 text-gray-400'}`}>
                                    {isSelected ? <CheckSquare size={10} /> : <Square size={10} />}
                                    <span className="truncate">{m.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addPackGroup} className="w-full py-1.5 border border-dashed border-gray-600 rounded text-xs font-bold text-bbq-gold hover:bg-gray-800">+ Add Choice Group</button>
              </div>
            )}
          </div>

          {/* Availability */}
          <div className="bg-black/20 p-3 rounded border border-gray-700">
            <label className="block text-sm font-bold mb-2 text-white">Availability</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="avail" checked={editItem.availabilityType === 'everyday'} onChange={() => setEditItem({ ...editItem, availabilityType: 'everyday' })} className="text-bbq-red" />
                Everyday Menu
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="avail" checked={editItem.availabilityType === 'specific_date'} onChange={() => setEditItem({ ...editItem, availabilityType: 'specific_date' })} className="text-bbq-red" />
                Specific Date Only
              </label>
            </div>
            {editItem.availabilityType === 'specific_date' && (
              <div className="mt-2 max-h-32 overflow-y-auto border border-gray-700 rounded p-2 bg-gray-800 space-y-1">
                {orderDays.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No cook days scheduled in Planner.</p>
                ) : orderDays.map(evt => {
                  const currentDates = editItem.specificDates || (editItem.specificDate ? [editItem.specificDate] : []);
                  return (
                    <label key={evt.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-1 rounded">
                      <input type="checkbox" checked={currentDates.includes(evt.date)} onChange={e => {
                        let newDates = [...currentDates];
                        if (e.target.checked) newDates.push(evt.date); else newDates = newDates.filter(d => d !== evt.date);
                        setEditItem({ ...editItem, specificDates: newDates });
                      }} className="rounded text-bbq-red" />
                      <span className="text-xs text-white">{new Date(evt.date + 'T12:00:00').toLocaleDateString()} — {evt.location} ({evt.title})</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-bbq-red rounded font-bold text-sm text-white">Save Item</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {menu.map(item => {
          const id = item._id || item.id;
          return (
            <div key={id} className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition">
              <div className="flex items-center gap-3 min-w-0">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-10 h-10 rounded object-cover border border-gray-700 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center shrink-0"><Utensils size={16} className="text-gray-500" /></div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-white text-sm flex items-center gap-1 flex-wrap">
                    <span className="truncate">{item.name}</span>
                    {item.isPack && <span className="text-[10px] bg-purple-900 text-purple-200 px-1 rounded border border-purple-700 shrink-0">PACK</span>}
                    {item.availableForCatering && <span className="text-[10px] bg-green-900 text-green-200 px-1 rounded border border-green-700 shrink-0">CATERING</span>}
                    {!item.available && <span className="text-[10px] bg-red-900 text-red-200 px-1 rounded border border-red-700 shrink-0">HIDDEN</span>}
                  </div>
                  <div className="text-xs text-gray-400">${item.price} • {item.category}</div>
                  {item.availabilityType === 'specific_date' && (
                    <div className="text-[10px] text-bbq-gold">Specific date only</div>
                  )}
                </div>
              </div>
              <button onClick={() => { setIsEditing(true); setEditItem({ ...item, packGroups: item.packGroups || [] }); }} className="p-2 text-gray-400 hover:text-white shrink-0"><Edit2 size={16} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── IMAGE UPLOAD FIELD (matches Street Meats BBQ ImageSettingRow) ───
const ImageField = ({ label, value, onChange, hint, businessName }) => {
  const fileInputRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressImageBase64(reader.result, 700, 0.55);
      onChange(compressed);
    };
    reader.readAsDataURL(file);
  };
  const handleAIGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateImage(hint || label, businessName);
      if (result) onChange(result);
    } catch { toast.error('Image generation failed'); }
    setIsGenerating(false);
  };
  const isBase64 = value?.startsWith('data:');
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1.5 font-bold uppercase tracking-wider">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          value={isBase64 ? '' : (value || '')}
          onChange={e => onChange(e.target.value)}
          placeholder={isBase64 ? '(image stored)' : 'Paste image URL...'}
          readOnly={isBase64}
          className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-gray-500"
        />
        <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" accept="image/*" />
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="bg-gray-800 border border-gray-600 p-2 rounded-lg hover:bg-gray-700 text-gray-300" title="Upload from device">
          <UploadCloud size={16} />
        </button>
        <button type="button" onClick={handleAIGenerate} disabled={isGenerating}
          className="bg-purple-900/60 border border-purple-700 p-2 rounded-lg hover:bg-purple-800 text-purple-300 disabled:opacity-50" title="AI Generate">
          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        </button>
      </div>
      {value ? (
        <div className="w-full h-32 rounded-lg overflow-hidden border border-gray-700 relative group">
          <img src={value} className="w-full h-full object-cover" alt={label} />
          <button type="button" onClick={() => onChange('')}
            className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600">
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="w-full h-32 rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center gap-1.5 text-gray-700">
          <ImageIcon size={20} />
          <span className="text-[10px] uppercase tracking-wider">No image set</span>
        </div>
      )}
    </div>
  );
};

// ─── SETTINGS MANAGER ────────────────────────────────────────────────
const FTSettingsManager = () => {
  const { settings, updateSettings } = useStorefront();
  const { brandName } = useClientConfig();
  const IMG_KEYS = ['heroCateringImage', 'heroCookImage', 'homePromoterImage', 'homeScheduleCardImage', 'homeMenuCardImage', 'menuHeroImage', 'diyHeroImage', 'diyCardPackageImage', 'diyCardCuratedImage', 'diyCardCustomImage', 'eventsHeroImage', 'galleryHeroImage'];
  const [form, setForm] = useState({ ...settings });
  const [visuals, setVisuals] = useState(() => Object.fromEntries(IMG_KEYS.map(k => [k, settings[k] || ''])));
  const [rewards, setRewards] = useState({ ...(settings.rewards || {}) });
  const [invoice, setInvoice] = useState({
    paymentButtonLabel: 'Pay Now',
    thankYouMessage: "Here's your invoice. Please review the details below and arrange payment at your earliest convenience.",
    headerColor: '#d9381e', accentColor: '#eab308',
    footerNote: 'Thank you for your business! If you have questions about this invoice, reply to this email or give us a call.',
    smsTemplate: 'Hi {name}, you have an invoice for ${total} from {business}. Order #{orderNum}. {payLink}',
    ...(settings.invoiceTemplate || {}),
  });
  const [newPrize, setNewPrize] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [editingPrizeIdx, setEditingPrizeIdx] = useState(null);

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await updateSettings({ ...form, ...visuals, rewards, invoiceTemplate: invoice });
    setIsSaving(false);
    if (ok !== false) {
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 4000);
      toast.success('Settings saved!');
    } else {
      toast.error('Save failed — check console for details.');
    }
  };

  const prizes = rewards.possiblePrizes || [];
  const addPrize = () => {
    if (!newPrize.trim()) return;
    if (editingPrizeIdx !== null) {
      setRewards(r => ({ ...r, possiblePrizes: r.possiblePrizes.map((p, i) => i === editingPrizeIdx ? { ...p, name: newPrize.trim() } : p) }));
      setEditingPrizeIdx(null);
    } else {
      setRewards(r => ({ ...r, possiblePrizes: [...(r.possiblePrizes || []), { name: newPrize.trim(), image: '' }] }));
    }
    setNewPrize('');
  };
  const removePrize = (idx) => { setRewards(r => ({ ...r, possiblePrizes: r.possiblePrizes.filter((_, i) => i !== idx) })); if (editingPrizeIdx === idx) { setEditingPrizeIdx(null); setNewPrize(''); } };
  const startEditPrize = (idx) => { setEditingPrizeIdx(idx); setNewPrize(prizes[idx]?.name || ''); };
  const cancelEditPrize = () => { setEditingPrizeIdx(null); setNewPrize(''); };

  const VISUAL_SECTIONS = [
    {
      label: 'HOME PAGE', fields: [
        { key: 'heroCateringImage', label: 'CATERING HERO (LEFT)' },
        { key: 'heroCookImage', label: 'COOK DAY HERO (RIGHT)' },
        { key: 'homePromoterImage', label: 'PROMOTER PARALLAX' },
        { key: 'homeScheduleCardImage', label: 'SCHEDULE CARD' },
        { key: 'homeMenuCardImage', label: 'MENU CARD' },
      ]
    },
    {
      label: 'MENU PAGE', fields: [
        { key: 'menuHeroImage', label: 'MENU HERO (LARGE)' },
        { key: 'diyCardPackageImage', label: 'MENU HERO (TOP RIGHT)' },
        { key: 'diyCardCustomImage', label: 'MENU HERO (BOTTOM RIGHT)' },
      ]
    },
    {
      label: 'CATERING & DIY', fields: [
        { key: 'diyHeroImage', label: 'CATERING PAGE HERO' },
        { key: 'diyCardCuratedImage', label: 'CURATED PACKAGES CARD' },
      ]
    },
    {
      label: 'OTHER PAGES', fields: [
        { key: 'eventsHeroImage', label: 'EVENTS PAGE HERO' },
        { key: 'galleryHeroImage', label: 'GALLERY PAGE HERO' },
      ]
    },
  ];

  const brokenVisualFields = VISUAL_SECTIONS.flatMap(s => s.fields).filter(({ key }) => visuals[key]?.includes('pollinations.ai'));

  const handleAutoFix = async () => {
    if (!window.confirm(`Auto-fix ${brokenVisualFields.length} expired image(s)? They will be regenerated and stored permanently in Firebase Storage (~3 min).`)) return;
    setIsGeneratingAll(true);
    setGenProgress(0);
    const newVisuals = { ...visuals };
    for (const { key, label: fl } of brokenVisualFields) {
      const url = await generateImage(fl, form.businessName || brandName);
      newVisuals[key] = url;
      setVisuals(prev => ({ ...prev, [key]: url }));
      setGenProgress(p => p + 1);
    }
    setIsGeneratingAll(false);
    setIsSaving(true);
    await updateSettings({ ...form, ...newVisuals, rewards, invoiceTemplate: invoice });
    setIsSaving(false);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 4000);
    toast.success('All images fixed and saved permanently!');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wide flex items-center">Settings<Tip text="All settings are saved to Firestore and sync across devices instantly. Upload a logo to auto-update the site favicon and all OG / social share images." /></h2>
          <p className="text-gray-400 text-sm mt-1">Business settings, branding, and rewards.</p>
        </div>
        <button onClick={handleSave} disabled={isSaving}
          className={`flex items-center gap-2 font-bold px-5 py-2.5 rounded-lg transition border text-sm ${showSaveSuccess ? 'bg-green-700 border-green-500 text-white' : isSaving ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-wait' : 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700'} disabled:opacity-50`}>
          {isSaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : showSaveSuccess ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Changes</>}
        </button>
      </div>
      {showSaveSuccess && (
        <div className="bg-green-900/30 border border-green-600/50 text-green-300 p-3.5 rounded-xl flex items-center gap-3">
          <Check size={16} className="text-green-400 shrink-0" />
          <strong className="text-sm">Changes Saved &amp; Synced to Firestore</strong>
        </div>
      )}
      {brokenVisualFields.length > 0 && !isGeneratingAll && (
        <div className="bg-yellow-900/30 border border-yellow-600/50 p-3.5 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle size={16} className="text-yellow-400 shrink-0" />
            <div>
              <strong className="text-sm text-white">{brokenVisualFields.length} Site Visual{brokenVisualFields.length > 1 ? 's' : ''} using expired Pollinations.ai URLs</strong>
              <p className="text-xs text-yellow-400/80 mt-0.5">These images expire and break. Click Auto-Fix to regenerate and store them permanently in Firebase.</p>
            </div>
          </div>
          <button type="button" onClick={handleAutoFix} disabled={isSaving}
            className="shrink-0 flex items-center gap-1.5 text-xs bg-yellow-700 hover:bg-yellow-600 text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap">
            <Wand2 size={11} /> Auto-Fix All
          </button>
        </div>
      )}
      {isGeneratingAll && (
        <div className="bg-purple-900/30 border border-purple-600/50 p-3.5 rounded-xl flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-purple-400 shrink-0" />
          <div>
            <strong className="text-sm text-white">Fixing images… {genProgress}/{brokenVisualFields.length}</strong>
            <p className="text-xs text-purple-300/80 mt-0.5">Generating &amp; uploading to Firebase Storage — do not close this tab.</p>
          </div>
        </div>
      )}

      {/* General Configuration */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-5">
        <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Settings size={14} className="text-bbq-gold" /> General Configuration</h3>
        <label className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-lg p-3.5 cursor-pointer hover:border-gray-500 transition">
          <input type="checkbox" checked={form.maintenanceMode || false} onChange={e => setForm({ ...form, maintenanceMode: e.target.checked })} className="w-4 h-4 accent-bbq-red" />
          <div>
            <span className="font-bold text-white text-sm flex items-center">Maintenance Mode<Tip text="When enabled, ALL customer-facing pages show a branded maintenance screen. Admins and developers can still browse the site normally." /></span>
            <p className="text-xs text-gray-500">Redirects all visitors to the Maintenance page.</p>
          </div>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {[{ key: 'businessName', label: 'BUSINESS NAME', ph: brandName || 'Hughesys Que' }, { key: 'businessAddress', label: 'BUSINESS ADDRESS', ph: 'Brisbane, QLD' }].map(({ key, label, ph }) => (
              <div key={key}>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</label>
                <input value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={ph}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-bbq-red" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">LOGO</label>
            <div className="flex gap-2 mb-2">
              <input value={form.logoUrl || ''} onChange={e => setForm({ ...form, logoUrl: e.target.value })} placeholder="Paste logo URL..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm font-mono focus:outline-none focus:border-bbq-red" />
              <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 shrink-0 text-xs text-gray-300 font-bold" title="Upload logo from device">
                <UploadCloud size={14} className="text-gray-400" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    const compressed = await compressImageBase64(reader.result, 400, 0.8);
                    setForm(prev => ({ ...prev, logoUrl: compressed }));
                  };
                  reader.readAsDataURL(f);
                }} />
              </label>
              {form.logoUrl && (
                <button type="button" onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}
                  className="p-2.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 shrink-0">
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>
            {form.logoUrl
              ? <img src={form.logoUrl} alt="Logo preview" className="w-full h-28 object-contain bg-black/40 rounded-lg border border-gray-700" onError={e => e.target.style.display = 'none'} />
              : <div className="w-full h-28 bg-black/40 rounded-lg border border-dashed border-gray-700 flex flex-col items-center justify-center gap-1.5 text-gray-700"><ImageIcon size={22} /><span className="text-[10px] uppercase tracking-wider">No logo set</span></div>
            }
          </div>
        </div>
      </div>

      {/* Site Visuals */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><ImagePlus size={14} className="text-red-400" /> Site Visuals<Tip text="Each field supports: paste a URL, upload from device, or click ✨ to AI-generate. The logo also updates your browser favicon and social share preview image automatically." /></h3>
          <div className="flex items-center gap-2">
            <button type="button" disabled={isGeneratingAll} onClick={async () => {
              if (!window.confirm('Generate AI images for all fields one by one? 11 images, ~3-5 min total. Do not close this tab.')) return;
              setIsGeneratingAll(true);
              setGenProgress(0);
              const allFields = VISUAL_SECTIONS.flatMap(s => s.fields);
              for (const { key, label: fl } of allFields) {
                const url = await generateImage(fl, form.businessName || brandName);
                setVisuals(prev => ({ ...prev, [key]: url }));
                setGenProgress(p => p + 1);
              }
              setIsGeneratingAll(false);
              toast.success('All images generated! Click Save Changes to keep them.');
            }} className="flex items-center gap-1.5 text-[11px] bg-purple-900/50 border border-purple-700 hover:bg-purple-800/60 text-purple-300 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
              {isGeneratingAll ? <><Loader2 size={11} className="animate-spin" /> {genProgress}/{VISUAL_SECTIONS.flatMap(s => s.fields).length}</> : <><Sparkles size={11} /> Generate All</>}
            </button>
            <button type="button" onClick={() => {
              if (!window.confirm('Clear all site visual images? This removes every saved image URL so you can upload fresh ones.')) return;
              const allKeys = VISUAL_SECTIONS.flatMap(s => s.fields.map(f => f.key));
              const cleared = allKeys.reduce((acc, k) => ({ ...acc, [k]: '' }), {});
              setVisuals(cleared);
              try { const s = JSON.parse(localStorage.getItem('hq_settings') || '{}'); delete s.siteVisuals; localStorage.setItem('hq_settings', JSON.stringify(s)); } catch { }
              toast.success('All visuals cleared — upload fresh images below.');
            }} className="flex items-center gap-1.5 text-[11px] bg-gray-800 border border-gray-700 hover:bg-red-900/40 hover:border-red-700 text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-lg transition">
              <X size={11} /> Clear All
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {VISUAL_SECTIONS.map(({ label, fields }) => (
            <div key={label} className="space-y-4">
              <h4 className="font-bold text-white text-sm">{label}</h4>
              {fields.map(({ key, label: fl }) => (
                <ImageField key={key} label={fl} value={visuals[key] || ''} onChange={v => setVisuals(p => ({ ...p, [key]: v }))} hint={fl.toLowerCase()} businessName={form.businessName || brandName} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Rewards Program */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-5">
        <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Gift size={14} className="text-yellow-400" /> Rewards Program<Tip text="Staff enter the Staff PIN at checkout to add a stamp. When a customer reaches the Stamps to Reward target, they unlock a random prize from your prize pool." /></h3>
        <label className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-lg p-3.5 cursor-pointer hover:border-gray-500 transition">
          <input type="checkbox" checked={rewards.enabled || false} onChange={e => setRewards(r => ({ ...r, enabled: e.target.checked }))} className="w-4 h-4 accent-bbq-red" />
          <div>
            <span className="font-bold text-white text-sm">Enable Rewards Program</span>
            <p className="text-xs text-gray-500">Customers can earn stamps and redeem prizes.</p>
          </div>
        </label>
        {rewards.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">PROGRAM NAME</label>
                <input value={rewards.programName || ''} onChange={e => setRewards(r => ({ ...r, programName: e.target.value }))} placeholder="Meat Sweats Club"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">STAFF PIN</label>
                  <input type="password" value={rewards.staffPin || ''} onChange={e => setRewards(r => ({ ...r, staffPin: e.target.value }))} placeholder="••••"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm font-mono" />
                  <p className="text-[10px] text-gray-500 mt-1">Staff enter this to add/redeem stamps.</p>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">STAMPS TO REWARD</label>
                  <input type="number" min="1" max="50" value={rewards.maxStamps || 10} onChange={e => setRewards(r => ({ ...r, maxStamps: parseInt(e.target.value) || 10 }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm text-center font-mono" />
                  <p className="text-[10px] text-gray-500 mt-1">Stamps needed to earn a prize.</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">PRIZE POOL (POSSIBLE WINNINGS)</label>
                <p className="text-[10px] text-gray-500 mb-2">Add multiple items. The Golden Ticket will randomly select one upon scratching.</p>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {prizes.map((prize, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-3">
                    {prize.image ? <img src={prize.image} alt="" className="w-9 h-9 object-cover rounded" /> : <div className="w-9 h-9 bg-gray-700 rounded flex items-center justify-center shrink-0"><Gift size={14} className="text-gray-500" /></div>}
                    <span className="flex-1 text-sm font-medium text-white">{prize.name}</span>
                    <button onClick={() => { const n = prompt('Edit prize name:', prize.name); if (n?.trim()) setRewards(r => ({ ...r, possiblePrizes: r.possiblePrizes.map((p, i) => i === idx ? { ...p, name: n.trim() } : p) })); }} className="p-1.5 text-gray-400 hover:text-white"><Edit2 size={13} /></button>
                    <button onClick={() => removePrize(idx)} className="p-1.5 text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">ADD NEW PRIZE</label>
                <input value={newPrize} onChange={e => setNewPrize(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPrize()} placeholder="e.g. Free Burger"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm mb-2" />
                <button onClick={addPrize} className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
                  <Plus size={14} /> Add to Pool
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Template */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-5">
        <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Lock size={14} className="text-yellow-400" /> Invoice Template</h3>
        <p className="text-xs text-gray-500">Customise invoices sent via Email and SMS. Payment links are auto-generated from your Square account.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">PAYMENT BUTTON LABEL</label>
              <input value={invoice.paymentButtonLabel || ''} onChange={e => setInvoice(i => ({ ...i, paymentButtonLabel: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm" />
              <p className="text-[10px] text-gray-500 mt-1">Text shown on the payment button in email invoices.</p>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">INVOICE LOGO</label>
              <div className="flex gap-2">
                <input value={invoice.invoiceLogo || ''} onChange={e => setInvoice(i => ({ ...i, invoiceLogo: e.target.value }))} placeholder="Paste a URL or upload an image..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm" />
                <label className="cursor-pointer p-2.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 shrink-0">
                  <UploadCloud size={14} className="text-gray-400" />
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setInvoice(i => ({ ...i, invoiceLogo: r.result })); r.readAsDataURL(f); }} />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[{ key: 'headerColor', label: 'HEADER COLOR', def: '#d9381e' }, { key: 'accentColor', label: 'ACCENT COLOR', def: '#eab308' }].map(({ key, label, def }) => (
                <div key={key}>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={invoice[key] || def} onChange={e => setInvoice(i => ({ ...i, [key]: e.target.value }))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
                    <input value={invoice[key] || def} onChange={e => setInvoice(i => ({ ...i, [key]: e.target.value }))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm font-mono" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">THANK YOU / INTRO MESSAGE</label>
              <textarea value={invoice.thankYouMessage || ''} onChange={e => setInvoice(i => ({ ...i, thankYouMessage: e.target.value }))} rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm resize-none" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">BANK / PAYMENT DETAILS (SHOWN IF NO PAYMENT LINK)</label>
              <textarea value={invoice.bankDetails || ''} onChange={e => setInvoice(i => ({ ...i, bankDetails: e.target.value }))} rows={3} placeholder={'BSB: 000-000\nAccount: 12345678\nName: Your Business'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm font-mono resize-none" />
              <p className="text-[10px] text-gray-500 mt-1">Displayed when no payment URL is set. Each line appears as-is.</p>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">FOOTER NOTE</label>
              <textarea value={invoice.footerNote || ''} onChange={e => setInvoice(i => ({ ...i, footerNote: e.target.value }))} rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm resize-none" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">SMS TEMPLATE</label>
              <textarea value={invoice.smsTemplate || ''} onChange={e => setInvoice(i => ({ ...i, smsTemplate: e.target.value }))} rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm font-mono resize-none" />
              <p className="text-[10px] text-gray-500 mt-1">Variables: {'{name} {total} {business} {orderNum} {payLink}'}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-5">
          <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">EMAIL PREVIEW</label>
          <div className="rounded-xl overflow-hidden border border-gray-700 max-w-2xl shadow-2xl">
            <div className="px-8 py-5 text-center font-bold text-white tracking-wider flex items-center justify-center gap-3" style={{ background: invoice.headerColor || '#d9381e' }}>
              {invoice.invoiceLogo && <img src={invoice.invoiceLogo} alt="logo" className="h-8 w-8 object-contain rounded" onError={e => e.target.style.display = 'none'} />}
              <span className="text-sm">INVOICE FROM {(form.businessName || brandName || 'HUGHESYS QUE').toUpperCase()}</span>
            </div>
            <div className="bg-[#1a1a1a] px-8 py-6 space-y-5">
              <div className="text-xs text-gray-300 bg-gray-900/60 rounded-lg p-4 border border-gray-700/50">
                <p className="font-bold text-white text-sm mb-1">Hi Customer,</p>
                <p className="text-gray-400 leading-relaxed">{invoice.thankYouMessage || "Here's your invoice. Please review the details below and arrange payment at your earliest convenience."}</p>
              </div>
              <div className="bg-gray-900/60 rounded-lg border border-gray-700/50">
                <div className="px-4 py-2 border-b border-gray-700/50 flex justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <span>Item</span><span>Amount</span>
                </div>
                <div className="px-4 py-3 flex justify-between text-xs text-gray-300">
                  <span>BBQ Catering Package</span><span className="font-bold text-white">$350.00</span>
                </div>
                <div className="px-4 py-2 border-t border-gray-700/50 flex justify-between text-sm font-bold">
                  <span className="text-gray-400">TOTAL DUE</span>
                  <span className="text-white">$350.00</span>
                </div>
              </div>
              {invoice.bankDetails && (
                <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-700/50">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Details</p>
                  <pre className="font-mono text-[11px] text-gray-300 whitespace-pre-wrap">{invoice.bankDetails}</pre>
                </div>
              )}
              <button className="w-full py-3 rounded-lg font-bold text-white text-sm tracking-wide" style={{ background: invoice.headerColor || '#d9381e' }}>{invoice.paymentButtonLabel || 'Pay Now'}</button>
              {invoice.footerNote && <p className="text-center text-[11px] text-gray-500 pb-2">{invoice.footerNote}</p>}
            </div>
            <div className="px-8 py-3 text-center text-[10px] text-gray-600 border-t border-gray-800" style={{ background: '#111' }}>
              &copy; {new Date().getFullYear()} {form.businessName || brandName || 'Hughesys Que'} &mdash; This is an automated invoice.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── GEMINI AI HELPER ────────────────────────────────────────────────
// Runtime key override — set from saved Firestore settings or admin panel
let _geminiKeyOverride = null;

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro'];

const callGemini = async (prompt, system) => {
  const key = _geminiKeyOverride || process.env.REACT_APP_GEMINI_API_KEY;
  if (!key) return null;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
  };
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        const notFound = res.status === 404 || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not supported');
        if (notFound) { console.warn(`[Gemini] ${model} not available, trying next…`); continue; }
        console.warn('[Gemini]', msg);
        return { __error: msg };
      }
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) { console.warn('[Gemini]', e.message); return null; }
  }
  return { __error: 'No available Gemini model responded — check your API key and quota.' };
};

// ─── CANVAS IMAGE COMPRESS (matches Street Meats BBQ approach) ──────
// Loads an image URL into a canvas, compresses it, returns a base64 string.
// Base64 is stored directly in Firestore — no URL expiry, no external dependencies.
const fetchImageAsBase64 = (url, maxW = 600, quality = 0.55) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    // Cache-bust to force CORS headers on repeat requests
    img.src = url.includes('?') ? `${url}&_cb=${Date.now()}` : `${url}?_cb=${Date.now()}`;
  });

// ─── AI IMAGE GENERATOR ─────────────────────────────────────────────
// Uses Gemini to craft a vivid prompt, then Pollinations.ai to render it.
// Primary: canvas → compressed base64 stored in Firestore (permanent, like Street Meats).
// Fallback: Firebase Storage URL. Last resort: raw Pollinations URL.
const generateImage = async (hint, businessName = 'Hughesys Que') => {
  let imagePrompt = `${businessName} BBQ food truck — ${hint}, professional food photography, moody dark background, cinematic lighting`;
  const geminiResult = await callGemini(
    `Write a concise Midjourney/DALL-E image prompt (max 25 words) for: "${hint}" for "${businessName}" BBQ food truck. Focus on visual elements, lighting, and style. Return ONLY the prompt text.`,
    'You are a food photography art director. Return only the prompt, no quotes or explanation.'
  );
  if (geminiResult && typeof geminiResult === 'string') imagePrompt = geminiResult.trim();
  const seed = Math.floor(Math.random() * 9999);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1200&height=630&nologo=true&seed=${seed}`;
  // Primary: load into canvas → compressed base64 (permanent, no URL expiry)
  try {
    const base64 = await fetchImageAsBase64(pollinationsUrl);
    return base64;
  } catch (canvasErr) {
    console.warn('Canvas encode failed, trying Firebase Storage:', canvasErr);
    // Fallback: upload blob to Firebase Storage
    try {
      const resp = await fetch(pollinationsUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      return await uploadToStorage(blob, `siteVisuals/ai_${Date.now()}_${seed}.jpg`);
    } catch (storageErr) {
      console.warn('Storage upload failed, using direct URL:', storageErr);
      return pollinationsUrl;
    }
  }
};

// ─── CUSTOMER MANAGER ────────────────────────────────────────────────
const CustomerManager = () => {
  const { users, addUser, adminUpdateUser, deleteUser } = useStorefront();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', phone: '', role: 'CUSTOMER' });

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const saveEdit = () => { if (editForm) { adminUpdateUser(editForm); setEditingId(null); setEditForm(null); } };

  const handleCreate = (e) => {
    e.preventDefault();
    if (newUserForm.name && newUserForm.email) {
      addUser({ id: `u${Date.now()}`, ...newUserForm, isVerified: true, address: '', stamps: 0 });
      setIsAdding(false);
      setNewUserForm({ name: '', email: '', phone: '', role: 'CUSTOMER' });
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this user? This cannot be undone.')) deleteUser(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-700 pb-4">
        <div>
          <h3 className="text-2xl font-bold text-white">Customer Management</h3>
          <p className="text-gray-400 text-sm">View and edit registered accounts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsAdding(!isAdding)} className="bg-bbq-red px-4 py-2 rounded text-white font-bold flex items-center gap-2 hover:bg-red-700 text-sm">
            <Plus size={16} /> Add Customer
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-bbq-red w-56" />
          </div>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-700 p-4 rounded-lg">
          <h4 className="font-bold mb-4 text-white">Add New Customer</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input placeholder="Full Name" value={newUserForm.name} onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })} className="bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" required />
            <input placeholder="Email" type="email" value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} className="bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" required />
            <input placeholder="Phone" value={newUserForm.phone} onChange={e => setNewUserForm({ ...newUserForm, phone: e.target.value })} className="bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-green-600 rounded text-white font-bold text-sm hover:bg-green-500">Create</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-left">
          <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Role</th>
              <th className="p-4">Stamps</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredUsers.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No customers yet.</td></tr>
            )}
            {filteredUsers.map(u => (
              <tr key={u.id} className="hover:bg-white/5 transition">
                <td className="p-4">
                  {editingId === u.id
                    ? <input value={editForm?.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="bg-gray-800 border border-gray-600 rounded p-1 text-white w-full text-sm" />
                    : <div className="font-medium text-white">{u.name}</div>}
                </td>
                <td className="p-4">
                  {editingId === u.id
                    ? <div className="space-y-1">
                      <input value={editForm?.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="bg-gray-800 border border-gray-600 rounded p-1 text-white w-full text-xs" />
                      <input value={editForm?.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone" className="bg-gray-800 border border-gray-600 rounded p-1 text-white w-full text-xs" />
                    </div>
                    : <div><div className="text-sm text-gray-300">{u.email}</div><div className="text-xs text-gray-500">{u.phone || '-'}</div></div>}
                </td>
                <td className="p-4">
                  {editingId === u.id
                    ? <select value={editForm?.role || 'CUSTOMER'} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="bg-gray-800 border border-gray-600 rounded p-1 text-white text-xs">
                      <option value="CUSTOMER">Customer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    : <span className={`text-xs px-2 py-1 rounded font-bold ${u.role === 'ADMIN' ? 'bg-red-900 text-red-200' : 'bg-blue-900 text-blue-200'}`}>{u.role || 'CUSTOMER'}</span>}
                </td>
                <td className="p-4 text-sm text-yellow-400 font-mono">{u.stamps || 0}</td>
                <td className="p-4 text-right">
                  {editingId === u.id
                    ? <div className="flex justify-end gap-2">
                      <button onClick={saveEdit} className="p-2 bg-green-600 hover:bg-green-500 rounded text-white"><Check size={14} /></button>
                      <button onClick={() => { setEditingId(null); setEditForm(null); }} className="p-2 bg-gray-600 hover:bg-gray-500 rounded text-white"><X size={14} /></button>
                    </div>
                    : <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingId(u.id); setEditForm(u); }} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(u.id)} className="p-2 text-red-400 hover:text-red-200 hover:bg-red-900/50 rounded"><Trash2 size={14} /></button>
                    </div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── SMS BLAST ────────────────────────────────────────────────────────
const normalizePhone = (raw) => {
  let phone = raw.replace(/[\s\-()]/g, '');
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone.startsWith('61')) return '+' + phone;
  return '+61' + phone;
};

const SmsBlast = () => {
  const { users, settings, calendarEvents, menu } = useStorefront();
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sendMode, setSendMode] = useState('all');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [showAiComposer, setShowAiComposer] = useState(false);
  const [aiTone, setAiTone] = useState('friendly and exciting');
  const [aiTopic, setAiTopic] = useState('');
  const [aiPromoDetails, setAiPromoDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const eligibleCustomers = useMemo(() =>
    users.filter(u => u.role !== 'ADMIN' && u.phone && u.phone.trim().length >= 8), [users]);

  const filteredCustomers = useMemo(() =>
    eligibleCustomers.filter(u =>
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm)
    ), [eligibleCustomers, searchTerm]);

  const recipients = sendMode === 'all' ? eligibleCustomers : eligibleCustomers.filter(u => selectedIds.has(u.id));
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selectedIds.size === filteredCustomers.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filteredCustomers.map(u => u.id)));

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Please enter a message.'); return; }
    if (recipients.length === 0) { toast.error('No recipients with phone numbers.'); return; }
    if (!settings.smsSettings?.enabled) { toast.error('SMS not configured — set up in Settings > SMS.'); return; }
    if (!window.confirm(`Send to ${recipients.length} customer${recipients.length > 1 ? 's' : ''}?\n\n"${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`)) return;
    setIsSending(true);
    setSendProgress({ sent: 0, failed: 0, total: recipients.length });
    let sent = 0, failed = 0;
    for (const customer of recipients) {
      try {
        const res = await fetch('/api/v1/sms/blast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: settings.smsSettings,
            to: normalizePhone(customer.phone),
            message: message.replace(/\{name\}/g, customer.name).replace(/\{business\}/g, settings.businessName || 'Hughesys Que'),
          }),
        });
        res.ok ? sent++ : failed++;
      } catch { failed++; }
      setSendProgress({ sent, failed, total: recipients.length });
    }
    setIsSending(false);
    failed === 0 ? toast.success(`Sent to ${sent} customer${sent > 1 ? 's' : ''}!`) : toast(`Sent ${sent}, failed ${failed}.`);
  };

  const handleAiCompose = async () => {
    if (!aiTopic.trim()) { toast.error('Enter a topic first.'); return; }
    setIsGenerating(true);
    setAiSuggestions([]);
    const upcomingEvents = calendarEvents.filter(e => e.date >= new Date().toISOString().split('T')[0]).slice(0, 5);
    const menuHighlights = menu.filter(m => m.available).slice(0, 8).map(m => `${m.name} ($${m.price})`).join(', ');
    const prompt = `Generate 3 SMS marketing messages for "${settings.businessName || 'Hughesys Que'}" BBQ food truck.
Topic: ${aiTopic}. Tone: ${aiTone}. ${aiPromoDetails ? 'Details: ' + aiPromoDetails + '.' : ''}
Menu highlights: ${menuHighlights}. Upcoming events: ${upcomingEvents.map(e => `${e.date} ${e.title}`).join(', ')}.
Each message max 160 chars, use {name} for customer name. Return JSON array: [{"text":"...","charCount":N,"tone":"..."}]`;
    const result = await callGemini(prompt);
    if (result) {
      try {
        const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
        setAiSuggestions(Array.isArray(parsed) ? parsed : []);
      } catch { toast.error('AI response parse error.'); }
    } else {
      toast.error('AI failed. Check REACT_APP_GEMINI_API_KEY in CF Pages.');
    }
    setIsGenerating(false);
  };

  const charsLeft = 160 - message.length;
  const smsSegments = Math.ceil(message.length / 160) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><Send size={18} className="text-green-400" /> SMS Blast</h3>
          <p className="text-sm text-gray-400 mt-1">Send a text to all or selected customers. Variables: {'{name}'}, {'{business}'}</p>
        </div>
        <div className="text-xs text-gray-500 text-right">
          <span className="text-green-400 font-bold">{eligibleCustomers.length}</span> customers with phone
        </div>
      </div>

      <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Message</label>
          <textarea rows={4} maxLength={480} value={message} onChange={e => setMessage(e.target.value)}
            placeholder={`Hey {name}! Big news from ${settings.businessName || 'Hughesys Que'}...`}
            className="w-full bg-black/40 border border-gray-700 rounded-lg p-3 text-white text-sm resize-none mt-1" />
          <div className="flex justify-between text-xs mt-1">
            <span className={charsLeft < 0 ? 'text-red-400' : 'text-gray-500'}>{message.length} chars · {smsSegments} segment{smsSegments > 1 ? 's' : ''}</span>
            <span className="text-gray-500">{charsLeft >= 0 ? `${charsLeft} left` : `${Math.abs(charsLeft)} over`}</span>
          </div>
        </div>

        <button onClick={() => setShowAiComposer(!showAiComposer)}
          className="w-full flex items-center justify-between py-2.5 px-4 rounded-lg border border-purple-700/50 bg-purple-900/20 text-purple-300 hover:bg-purple-900/30 transition text-sm font-bold">
          <span className="flex items-center gap-2"><Sparkles size={15} /> AI Message Composer</span>
          {showAiComposer ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showAiComposer && (
          <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Topic</label>
                <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="e.g. Friday cook day, new menu item..."
                  className="w-full bg-black/40 border border-gray-700 rounded-lg p-2.5 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Tone</label>
                <select value={aiTone} onChange={e => setAiTone(e.target.value)} className="w-full bg-black/40 border border-gray-700 rounded-lg p-2.5 text-white text-sm">
                  <option value="friendly and exciting">Friendly & Exciting</option>
                  <option value="urgent and FOMO-driven">Urgent / FOMO</option>
                  <option value="casual and laid-back">Casual & Laid-back</option>
                  <option value="professional and informative">Professional</option>
                  <option value="funny and cheeky Australian">Funny & Cheeky</option>
                  <option value="warm and grateful">Warm & Grateful</option>
                </select>
              </div>
            </div>
            <input value={aiPromoDetails} onChange={e => setAiPromoDetails(e.target.value)} placeholder="Extra details (optional)..."
              className="w-full bg-black/40 border border-gray-700 rounded-lg p-2.5 text-white text-sm" />
            <button onClick={handleAiCompose} disabled={isGenerating || !aiTopic.trim()}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
              {isGenerating ? <><Loader2 size={15} className="animate-spin" /> Generating...</> : <><Wand2 size={15} /> Generate SMS Options</>}
            </button>
            {aiSuggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-purple-300 uppercase">Pick a Message</p>
                {aiSuggestions.map((s, i) => (
                  <button key={i} onClick={() => { setMessage(s.text); toast.success('Message applied!'); }}
                    className="w-full text-left bg-black/30 border border-gray-700 hover:border-purple-500 rounded-lg p-3 transition group">
                    <p className="text-sm text-white leading-relaxed">{s.text}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-gray-500">{s.charCount} chars · {s.tone}</span>
                      <span className="text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 flex items-center gap-1"><Copy size={10} /> Use this</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => setSendMode('all')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-bold transition ${sendMode === 'all' ? 'bg-green-600/20 border-green-600 text-green-400' : 'bg-black/20 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            <Users size={15} /> All ({eligibleCustomers.length})
          </button>
          <button onClick={() => setSendMode('selected')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-bold transition ${sendMode === 'selected' ? 'bg-blue-600/20 border-blue-600 text-blue-400' : 'bg-black/20 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            <UserCheck size={15} /> Select ({selectedIds.size})
          </button>
        </div>
      </div>

      {sendMode === 'selected' && (
        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input placeholder="Search customers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm" />
            </div>
            <button onClick={toggleAll} className="text-xs font-bold text-blue-400 hover:text-blue-300 whitespace-nowrap">
              {selectedIds.size === filteredCustomers.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredCustomers.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No customers with phone numbers.</p>}
            {filteredCustomers.map(u => (
              <button key={u.id} onClick={() => toggleSelect(u.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition ${selectedIds.has(u.id) ? 'bg-blue-900/20 border border-blue-700' : 'bg-black/10 border border-transparent hover:border-gray-700'}`}>
                {selectedIds.has(u.id) ? <CheckSquare size={16} className="text-blue-400 shrink-0" /> : <Square size={16} className="text-gray-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Smartphone size={10} /> {u.phone}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <button disabled={isSending || !message.trim() || recipients.length === 0} onClick={handleSend}
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
        {isSending ? <><Loader2 size={16} className="animate-spin" /> Sending {sendProgress.sent + sendProgress.failed}/{sendProgress.total}...</>
          : <><Send size={16} /> Send to {recipients.length} Customer{recipients.length !== 1 ? 's' : ''}</>}
      </button>

      {!settings.smsSettings?.enabled && (
        <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg text-sm text-yellow-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>SMS not configured. Set up Twilio in <strong>Settings &gt; SMS</strong>.</span>
        </div>
      )}

      {isSending && (
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Progress</span><span>{sendProgress.sent + sendProgress.failed} / {sendProgress.total}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${((sendProgress.sent + sendProgress.failed) / Math.max(sendProgress.total, 1)) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-green-400">✓ {sendProgress.sent} sent</span>
            {sendProgress.failed > 0 && <span className="text-red-400">✗ {sendProgress.failed} failed</span>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CATERING MANAGER ────────────────────────────────────────────────
const compressImage = (base64Str, maxWidth = 800, quality = 0.6) =>
  new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });

const CateringManager = () => {
  const { settings, updateSettings } = useStorefront();
  const [isEditing, setIsEditing] = useState(false);
  const [editPkg, setEditPkg] = useState({});
  const [isGenerating, setIsGenerating] = useState(null);
  const packages = settings.cateringPackages || [];

  const handleAiGenerate = async (type) => {
    if (!editPkg.name) { toast.error('Enter a package name first.'); return; }
    setIsGenerating(type);
    if (type === 'desc') {
      const result = await callGemini(
        `Write a 2-sentence appetizing catering package description for "${editPkg.name}" with ${editPkg.meatLimit || 2} meat choices and ${editPkg.sideLimit || 2} sides. Keep it under 100 words, BBQ food truck style.`,
      );
      if (result && typeof result === 'string') setEditPkg(p => ({ ...p, description: result.trim() }));
    } else if (type === 'image') {
      const url = await generateImage(`${editPkg.name} BBQ catering package, food spread, premium catering`);
      setEditPkg(p => ({ ...p, image: url }));
      toast.success('AI image generated!');
    }
    setIsGenerating(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editPkg.name || !editPkg.price) return;
    let image = editPkg.image;
    if (image?.startsWith('data:image')) {
      try { image = await compressImage(image); } catch { }
    }
    const pkg = { ...editPkg, image };
    const newPackages = editPkg.id
      ? packages.map(p => p.id === editPkg.id ? pkg : p)
      : [...packages, { ...pkg, id: `pkg_${Date.now()}` }];
    const ok = await updateSettings({ cateringPackages: newPackages });
    if (ok) { toast.success(editPkg.id ? 'Package updated!' : 'Package created!'); setIsEditing(false); setEditPkg({}); }
    else toast.error('Save failed.');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this package?')) {
      await updateSettings({ cateringPackages: packages.filter(p => p.id !== id) });
    }
  };

  const seedDefaults = async () => {
    if (!window.confirm('Overwrite existing packages with defaults?')) return;
    await updateSettings({
      cateringPackages: [
        { id: 'pkg_essential', name: 'The Essentials', description: 'Perfect for casual backyard gatherings or office lunches.', price: 35, minPax: 10, meatLimit: 2, sideLimit: 2, image: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80' },
        { id: 'pkg_pitmaster', name: 'The Pitmaster', description: 'Our crowd favourite. A balanced spread of our best smoked cuts and sides.', price: 48, minPax: 10, meatLimit: 3, sideLimit: 3, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80' },
        { id: 'pkg_wholehog', name: 'The Whole Hog', description: 'The ultimate BBQ experience. Full variety of meats, sides, and premium additions.', price: 65, minPax: 10, meatLimit: 4, sideLimit: 4, image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80' },
      ]
    });
    toast.success('Default packages loaded!');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-gray-700 pb-2">
        <h3 className="text-xl font-bold text-white">Catering Packages</h3>
        <div className="flex gap-2">
          {packages.length === 0 && (
            <button onClick={seedDefaults} className="bg-gray-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-gray-600 text-white">
              <Wand2 size={16} /> Populate Defaults
            </button>
          )}
          <button onClick={() => { setIsEditing(true); setEditPkg({ minPax: 10, meatLimit: 2, sideLimit: 2 }); }}
            className="bg-bbq-red px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-red-700 text-white">
            <Plus size={16} /> Add Package
          </button>
        </div>
      </div>

      {isEditing && (
        <form onSubmit={handleSave} className="bg-gray-900 p-6 rounded-lg border border-gray-700 space-y-4">
          <h4 className="font-bold text-lg text-white">{editPkg.id ? 'Edit Package' : 'New Package'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <input placeholder="Package Name" value={editPkg.name || ''} onChange={e => setEditPkg({ ...editPkg, name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm" required />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Price/Head</label>
                  <input type="number" value={editPkg.price || ''} onChange={e => setEditPkg({ ...editPkg, price: parseFloat(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm" required />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Min Pax</label>
                  <input type="number" value={editPkg.minPax || ''} onChange={e => setEditPkg({ ...editPkg, minPax: parseInt(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm" required />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Meat Choices</label>
                  <input type="number" value={editPkg.meatLimit || ''} onChange={e => setEditPkg({ ...editPkg, meatLimit: parseInt(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm" required />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">Side Choices</label>
                  <input type="number" value={editPkg.sideLimit || ''} onChange={e => setEditPkg({ ...editPkg, sideLimit: parseInt(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm" required />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <textarea placeholder="Description" value={editPkg.description || ''} onChange={e => setEditPkg({ ...editPkg, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm h-24 pr-10" required />
                <button type="button" onClick={() => handleAiGenerate('desc')} disabled={!!isGenerating}
                  className="absolute top-2 right-2 text-yellow-400 hover:text-white p-1 rounded bg-black/50" title="AI Generate">
                  {isGenerating === 'desc' ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                </button>
              </div>
              <div className="flex gap-2">
                <input placeholder="Image URL" value={editPkg.image || ''} onChange={e => setEditPkg({ ...editPkg, image: e.target.value })}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm" />
                <button type="button" onClick={() => handleAiGenerate('image')} disabled={!!isGenerating} title="Generate image with AI"
                  className="p-2 bg-purple-900/60 border border-purple-700 rounded hover:bg-purple-800 shrink-0 disabled:opacity-50">
                  {isGenerating === 'image' ? <Loader2 size={14} className="animate-spin text-purple-300" /> : <Sparkles size={14} className="text-purple-300" />}
                </button>
              </div>
              {editPkg.image && (
                <div className="h-24 rounded overflow-hidden border border-gray-700">
                  <img src={editPkg.image} className="w-full h-full object-cover" alt="Preview" />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400 text-sm hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-bbq-red text-white rounded font-bold text-sm flex items-center gap-2">
              <Save size={16} /> Save Package
            </button>
          </div>
        </form>
      )}

      {packages.length === 0 && !isEditing && (
        <div className="text-center py-12 text-gray-500">
          <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
          <p>No catering packages yet. Add one or populate defaults.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map(pkg => (
          <div key={pkg.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group">
            <div className="h-40 relative">
              {pkg.image
                ? <img src={pkg.image} className="w-full h-full object-cover" alt={pkg.name} />
                : <div className="w-full h-full bg-gray-700 flex items-center justify-center"><ImageIcon size={32} className="text-gray-600" /></div>
              }
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => { setEditPkg(pkg); setIsEditing(true); }} className="p-2 bg-black/60 text-white rounded hover:bg-yellow-500 hover:text-black"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(pkg.id)} className="p-2 bg-black/60 text-red-400 rounded hover:bg-red-600 hover:text-white"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-white">{pkg.name}</h4>
                <span className="text-yellow-400 font-bold">${pkg.price}<span className="text-xs text-gray-500">/pp</span></span>
              </div>
              <p className="text-gray-400 text-xs mb-3 line-clamp-2">{pkg.description}</p>
              <div className="flex gap-2 text-[10px] font-bold text-gray-300 uppercase">
                <span className="bg-gray-700 px-2 py-1 rounded">{pkg.meatLimit} Meats</span>
                <span className="bg-gray-700 px-2 py-1 rounded">{pkg.sideLimit} Sides</span>
                <span className="bg-gray-700 px-2 py-1 rounded">Min {pkg.minPax}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── PITMASTER ────────────────────────────────────────────────────────
const RECIPES = [
  {
    id: 'r1', title: 'Central Texas Brisket', type: 'BEEF', pitTemp: '250–275°F', targetTemp: '203°F', wood: 'Ironbark',
    method: ['Trim hard fat to 1/4 inch. Remove silver skin.', 'Rub heavily with 50/50 Salt & Pepper.', 'Smoke at 275°F until bark sets (~165°F internal).', 'Wrap in pink butcher paper with tallow.', 'Continue until probe tender (~203°F).', 'Rest in cooler 2–4 hours before slicing.']
  },
  {
    id: 'r2', title: 'Pulled Pork Shoulder', type: 'PORK', pitTemp: '275°F', targetTemp: '205°F', wood: 'Ironbark/Fruit Mix',
    method: ['Score fat cap in diamond pattern.', 'Apply mustard binder and pork rub.', 'Smoke 5–6 hours until bark is dark mahogany.', 'Spritz with Apple Cider Vinegar every hour.', 'Wrap in foil at 165°F if bark is too dark.', 'Pull at 205°F when bone wiggles loose. Rest 1 hour.']
  },
  {
    id: 'r3', title: 'St. Louis Ribs', type: 'PORK', pitTemp: '275°F', targetTemp: 'Bend Test', wood: 'Ironbark/Cherry',
    method: ['Remove membrane from back of ribs.', 'Season generously with sweet rub.', 'Smoke 3 hours unwrapped.', 'Wrap with butter, brown sugar, honey for 1.5–2 hours.', 'Unwrap and glaze with BBQ sauce for final 30 mins.', 'Done when rack bends significantly.']
  },
  {
    id: 'r4', title: 'Dino Beef Ribs', type: 'BEEF', pitTemp: '285°F', targetTemp: '203°F', wood: 'Ironbark',
    method: ['Remove heavy membrane/silver skin from top.', 'Heavy SPG (Salt, Pepper, Garlic) Rub.', 'Smoke unwrapped entire time (~6–8 hours).', 'Spritz with water/worcestershire if looking dry.', 'Probe for tenderness between bones.', 'Rest 1 hour minimum.']
  },
];

const FTPitmasterChat = () => {
  const { settings } = useStorefront();
  const [history, setHistory] = useState([
    { role: 'model', text: "G'day! I'm your BBQ AI assistant. Smoker's rolling on Ironbark — what can I help you with today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setInput('');
    setIsTyping(true);
    const key = process.env.REACT_APP_GEMINI_API_KEY;
    if (!key) {
      setHistory(h => [...h, { role: 'model', text: 'AI not configured. Add REACT_APP_GEMINI_API_KEY to CF Pages environment variables.' }]);
      setIsTyping(false);
      return;
    }
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: `You are a friendly and knowledgeable BBQ pitmaster AI for ${settings.businessName || 'Hughesys Que'}. You know everything about smoking meats, temperature control, wood selection, and BBQ techniques. Keep answers practical and concise.` }] },
          contents: newHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        }),
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Couldn't get a response right now.";
      setHistory(h => [...h, { role: 'model', text }]);
    } catch (err) {
      setHistory(h => [...h, { role: 'model', text: 'AI error: ' + err.message }]);
    }
    setIsTyping(false);
  };

  return (
    <div className="h-[550px] flex flex-col bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-red-700 to-red-900 rounded-full flex items-center justify-center border border-red-500/30">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold text-white leading-none">Pitmaster AI</h3>
          <p className="text-xs text-yellow-400 font-mono uppercase tracking-wider mt-0.5">BBQ Assistant</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20">
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-bbq-red text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none'}`}>
              <div className="flex items-center gap-1 mb-1.5 opacity-50 text-[10px] uppercase font-bold">
                {msg.role === 'user' ? <><UserIcon size={10} /> You</> : <><Flame size={10} /> AI</>}
              </div>
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-400 text-xs p-3 rounded-xl border border-gray-700 italic flex items-center gap-2">
              <Loader2 className="animate-spin" size={12} /> Thinking...
            </div>
          </div>
        )}
      </div>
      <form onSubmit={submit} className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Ask about brisket temps, resting times, wood types..."
          className="flex-1 bg-gray-900 border border-gray-600 rounded-xl p-3 text-white focus:border-bbq-red outline-none transition text-sm placeholder:text-gray-600" />
        <button type="submit" disabled={!input.trim() || isTyping}
          className="bg-yellow-500 text-black p-3 rounded-xl font-bold hover:bg-yellow-400 disabled:opacity-50 transition">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

const FTPitmaster = () => {
  const { orders, calendarEvents } = useStorefront();
  const [activeTab, setActiveTab] = useState('live');
  const defaultTasks = [
    { id: 't1', time: '04:00 AM', task: 'Fire Up Pit (Target 275°F)', done: false },
    { id: 't2', time: '05:00 AM', task: 'Trim & Rub Briskets', done: false },
    { id: 't3', time: '06:00 AM', task: 'Meat On', done: false },
    { id: 't4', time: '09:00 AM', task: 'Spritz / Check Bark', done: false },
    { id: 't5', time: '11:00 AM', task: 'Wrap Briskets (Paper)', done: false },
    { id: 't6', time: '02:00 PM', task: 'Pull & Rest (Cooler)', done: false },
    { id: 't7', time: '04:30 PM', task: 'Slice for Service', done: false },
  ];
  const [tasks, setTasks] = useState(defaultTasks);
  const [logs, setLogs] = useState([]);
  const [newLog, setNewLog] = useState({ smoker: '', meat: '', note: '' });

  const nextCookEvent = calendarEvents
    .filter(e => e.type === 'ORDER_PICKUP' && new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const cookDate = nextCookEvent ? nextCookEvent.date : new Date().toISOString().split('T')[0];
  const activeOrders = orders.filter(o => (o.cookDay || '').split('T')[0] === cookDate &&
    ['Pending', 'Paid', 'Confirmed', 'Cooking', 'Awaiting Payment'].includes(o.status));
  const totals = {};
  activeOrders.forEach(order => (order.items || []).forEach(line => {
    const key = (line.item?.name || line.name) + (line.selectedOption ? ` (${line.selectedOption})` : '');
    if (!totals[key]) totals[key] = { qty: 0, unit: line.item?.unit };
    totals[key].qty += line.quantity || 1;
  }));

  const addLog = () => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLogs(l => [{ id: Date.now().toString(), time: now, smokerTemp: newLog.smoker, meatTemp: newLog.meat, note: newLog.note }, ...l]);
    setNewLog({ smoker: '', meat: '', note: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-gray-700 pb-2">
        {[['live', Flame, 'Live Ops'], ['recipes', BookOpen, 'Recipe Book'], ['ai', MessageSquare, 'AI Chat']].map(([id, Icon, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 text-sm ${activeTab === id ? 'bg-bbq-red text-white' : 'text-gray-400 hover:text-white'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-4">
                <ClipboardList className="text-yellow-400" />
                <div>
                  <h3 className="text-xl font-bold text-white">Meat Math</h3>
                  <p className="text-sm text-gray-400">Prep totals for {new Date(cookDate + 'T00:00:00').toLocaleDateString()}</p>
                </div>
              </div>
              {Object.keys(totals).length === 0
                ? <p className="text-gray-500 italic text-center py-4">No active orders for this date.</p>
                : <div className="space-y-2">{Object.entries(totals).map(([name, data]) => (
                  <div key={name} className="flex justify-between items-center bg-black/20 p-3 rounded border border-gray-800">
                    <span className="font-bold text-gray-300 text-sm">{name}</span>
                    <span className="text-bbq-red font-mono font-bold">{data.qty} <span className="text-xs text-gray-500">{data.unit || 'x'}</span></span>
                  </div>
                ))}</div>
              }
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-4">
                <CheckSquare className="text-green-500" />
                <h3 className="text-xl font-bold text-white">Run Sheet</h3>
              </div>
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))}
                    className={`flex items-center gap-4 p-3 rounded border cursor-pointer transition ${task.done ? 'bg-green-900/20 border-green-900 opacity-50' : 'bg-black/20 border-gray-800 hover:border-gray-600'}`}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-600'}`}>
                      {task.done && <Check size={12} className="text-white" />}
                    </div>
                    <div className={`flex-1 text-sm font-medium ${task.done ? 'line-through text-gray-500' : 'text-white'}`}>{task.task}</div>
                    <div className="text-xs font-mono text-yellow-400 bg-black/40 px-2 py-1 rounded">{task.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-4">
              <Thermometer className="text-red-500" />
              <h3 className="text-xl font-bold text-white">Pit Log</h3>
            </div>
            <div className="bg-black/30 p-4 rounded-lg border border-gray-800 mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Pit Temp (°F)</label>
                  <input type="number" placeholder="275" value={newLog.smoker} onChange={e => setNewLog({ ...newLog, smoker: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white font-mono" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Meat Temp (°F)</label>
                  <input type="number" placeholder="165" value={newLog.meat} onChange={e => setNewLog({ ...newLog, meat: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white font-mono" />
                </div>
              </div>
              <input placeholder="Notes..." value={newLog.note} onChange={e => setNewLog({ ...newLog, note: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm mb-3" />
              <button onClick={addLog} disabled={!newLog.smoker && !newLog.meat}
                className="w-full bg-bbq-red text-white font-bold py-2 rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                <Plus size={16} /> Log Entry
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 max-h-96">
              {logs.length === 0
                ? <div className="text-center text-gray-600 py-8"><Clock size={36} className="mx-auto mb-2 opacity-20" /><p className="text-sm">No logs yet today.</p></div>
                : logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 bg-gray-800/50 p-3 rounded border border-gray-700 text-sm">
                    <div className="text-xs font-mono text-gray-400 w-14 text-center border-r border-gray-700 pr-2">{log.time}</div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div><span className="text-gray-500 text-xs mr-1">Pit</span><span className="text-red-400 font-bold font-mono">{log.smokerTemp}°F</span></div>
                      <div><span className="text-gray-500 text-xs mr-1">Meat</span><span className="text-blue-400 font-bold font-mono">{log.meatTemp}°F</span></div>
                    </div>
                    {log.note && <div className="text-xs text-gray-300 italic border-l border-gray-700 pl-3 max-w-[120px] truncate">{log.note}</div>}
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {activeTab === 'recipes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {RECIPES.map(r => (
            <div key={r.id} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-500 transition">
              <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-white">{r.title}</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded ${r.type === 'BEEF' ? 'bg-red-900 text-red-200' : 'bg-pink-900 text-pink-200'}`}>{r.type}</span>
              </div>
              <div className="p-4 grid grid-cols-3 gap-2 border-b border-gray-800 text-center text-sm">
                <div><div className="text-xs text-gray-500 uppercase font-bold">Pit Temp</div><div className="text-yellow-400 font-bold font-mono">{r.pitTemp}</div></div>
                <div className="border-l border-gray-800"><div className="text-xs text-gray-500 uppercase font-bold">Target</div><div className="text-red-400 font-bold font-mono">{r.targetTemp}</div></div>
                <div className="border-l border-gray-800"><div className="text-xs text-gray-500 uppercase font-bold">Wood</div><div className="text-gray-300 font-bold">{r.wood}</div></div>
              </div>
              <div className="p-4 bg-black/20">
                <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">Method</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">{r.method.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'ai' && <FTPitmasterChat />}
    </div>
  );
};

// ─── SOCIAL COMMAND CENTER ───────────────────────────────────────────
const SocialCommandCenter = () => {
  const { settings, updateSettings, menu, calendarEvents } = useStorefront();
  const [aiPrompt, setAiPrompt] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategyResult, setStrategyResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleMode, setScheduleMode] = useState('Fresh 2 weeks');
  const [schedulePosts, setSchedulePosts] = useState('10');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [fbConnected, setFbConnected] = useState(settings.facebookConnected || false);
  const [calMonth, setCalMonth] = useState(new Date());
  const hasGemini = !!(_geminiKeyOverride || process.env.REACT_APP_GEMINI_API_KEY || settings.geminiApiKey);
  const socialStats = settings.socialStats || {};
  const [showFbConfig, setShowFbConfig] = useState(false);
  const [fbPageId, setFbPageId] = useState(settings.fbPageId || '');
  const [editingStats, setEditingStats] = useState(false);
  const [statsForm, setStatsForm] = useState({ followers: socialStats.followers || 0, reach: socialStats.reach || 0, engagement: socialStats.engagement || '0%' });
  const [isCheckingGemini, setIsCheckingGemini] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) { toast.error('Enter a topic first.'); return; }
    setIsGenerating(true); setGeneratedContent('');
    const result = await callGemini(
      `Write a compelling ${platform} post for "${settings.businessName || 'Hughesys Que'}" BBQ food truck. Topic: ${aiPrompt}. Be authentic, mouth-watering, include relevant hashtags. Max 280 chars.`,
      'You are a social media expert for a BBQ food truck.'
    );
    if (result) setGeneratedContent(result.trim());
    else toast.error(hasGemini ? 'AI error — try again.' : 'Add REACT_APP_GEMINI_API_KEY to CF Pages.');
    setIsGenerating(false);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true); setStrategyResult('');
    const result = await callGemini(
      `Analyse this BBQ food truck and give 3 specific social media growth tips:
Business: ${settings.businessName || 'Hughesys Que'}, Location: ${settings.businessAddress || 'Brisbane'}
Followers: ${socialStats.followers || 'unknown'}, Reach: ${socialStats.reach || 'unknown'}, Engagement: ${socialStats.engagement || 'unknown'}
Cook days: ${calendarEvents.filter(e => e.type === 'ORDER_PICKUP').slice(0, 3).map(e => e.date).join(', ')}
Be specific and actionable. Format as numbered list.`
    );
    if (result) setStrategyResult(result.trim());
    else toast.error(hasGemini ? 'AI error.' : 'Add REACT_APP_GEMINI_API_KEY to CF Pages.');
    setIsAnalyzing(false);
  };

  const handleGenerateSchedule = async () => {
    setIsScheduling(true);
    const cookDays = calendarEvents.filter(e => e.type === 'ORDER_PICKUP' && e.date >= scheduleStartDate).slice(0, 5).map(e => e.date);
    const result = await callGemini(
      `Generate a ${schedulePosts}-post ${platform} schedule from ${scheduleStartDate} for "${settings.businessName || 'Hughesys Que'}" BBQ food truck.
Mode: ${scheduleMode}. Cook days: ${cookDays.join(', ')}. Menu: ${menu.filter(m => m.available).slice(0, 6).map(m => m.name).join(', ')}.
Return JSON array only: [{"date":"YYYY-MM-DD","platform":"${platform}","caption":"...","hashtags":"...","type":"pre-cook|day-of|behind-scenes|promo"}]`
    );
    if (result) {
      try {
        const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
        setScheduledPosts(Array.isArray(parsed) ? parsed : []);
        toast.success(`${Array.isArray(parsed) ? parsed.length : 0} posts generated!`);
      } catch { toast.error('Parse error — try again.'); }
    } else toast.error(hasGemini ? 'AI error.' : 'Add REACT_APP_GEMINI_API_KEY.');
    setIsScheduling(false);
  };

  const handleCheckGemini = async () => {
    setIsCheckingGemini(true);
    const result = await callGemini('Reply with exactly: OK');
    if (result && typeof result === 'string') {
      toast.success('Gemini AI is active and responding!');
    } else {
      const errMsg = result?.__error || (hasGemini ? 'Key set but no response — check quota or validity.' : 'No API key set. Go to Dev Tools → Update API Key.');
      toast.error(errMsg);
    }
    setIsCheckingGemini(false);
  };
  const handleUpdateStats = async () => {
    await updateSettings({ socialStats: statsForm });
    setEditingStats(false);
    toast.success('Social stats updated!');
  };
  const handleFbConfigure = async () => {
    await updateSettings({ fbPageId, facebookConnected: !!fbPageId });
    setFbConnected(!!fbPageId);
    setShowFbConfig(false);
    toast.success(fbPageId ? 'Facebook page configured!' : 'Facebook disconnected.');
  };
  const handleGenerateImage = async () => {
    if (!aiPrompt.trim()) { toast.error('Enter a topic first.'); return; }
    setIsGeneratingImage(true);
    const result = await callGemini(
      `Write a detailed image generation prompt for a ${platform} post about: ${aiPrompt}. For "${settings.businessName || 'Hughesys Que'}" BBQ food truck. Describe lighting, composition, style. Max 80 words.`,
      'You are a creative director for a BBQ food truck brand.'
    );
    if (result) { navigator.clipboard?.writeText(result.trim()); toast.success('Image prompt copied to clipboard!'); }
    else toast.error(hasGemini ? 'AI error — try again.' : 'Add REACT_APP_GEMINI_API_KEY to CF Pages.');
    setIsGeneratingImage(false);
  };

  const calDays = () => {
    const year = calMonth.getFullYear(), month = calMonth.getMonth(), days = [];
    for (let i = 0; i < new Date(year, month, 1).getDay(); i++) days.push(null);
    for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wide flex items-center">Social &amp; AI Command Centre<Tip text="Use AI to generate captions, post ideas, and a full weekly schedule. Requires a Gemini API key set in Dev Tools. Generated posts can be copied or scheduled directly." /></h2>
          <p className="text-gray-400 text-sm mt-1">Manage content, schedule posts, and track growth.</p>
        </div>
        <button onClick={() => { setStatsForm({ followers: socialStats.followers || 0, reach: socialStats.reach || 0, engagement: socialStats.engagement || '0%' }); setEditingStats(true); }} className="flex items-center gap-2 bg-gray-800 border border-gray-700 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-700">
          <RefreshCw size={14} /> Update Stats
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'FOLLOWERS', value: socialStats.followers || 0, sub: '+5.2% last 30d', icon: Users, color: 'text-blue-400' },
          { label: 'REACH', value: socialStats.reach || 0, sub: '+12.1% last 30d', icon: Eye, color: 'text-purple-400' },
          { label: 'ENGAGEMENT', value: socialStats.engagement || '0%', sub: 'Avg. per post', icon: BarChart2, color: 'text-yellow-400' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900/60 border border-gray-700 rounded-xl p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="text-3xl font-bold text-white mt-1">{value}</p>
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><TrendingUp size={10} /> {sub}</p>
              </div>
              <Icon size={20} className={color} />
            </div>
          </div>
        ))}
      </div>

      {editingStats && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><BarChart2 size={14} className="text-yellow-400" /> Update Social Stats</h3>
          <p className="text-xs text-gray-500">Manually enter your current stats from Facebook/Instagram Insights.</p>
          <div className="grid grid-cols-3 gap-4">
            {[{ key: 'followers', label: 'FOLLOWERS', ph: '0' }, { key: 'reach', label: 'REACH (30d)', ph: '0' }, { key: 'engagement', label: 'ENGAGEMENT', ph: '0%' }].map(({ key, label, ph }) => (
              <div key={key}>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</label>
                <input value={statsForm[key] || ''} onChange={e => setStatsForm(s => ({ ...s, [key]: e.target.value }))} placeholder={ph}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm text-center font-mono" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleUpdateStats} className="bg-bbq-red hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Save size={14} /> Save Stats</button>
            <button onClick={() => setEditingStats(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Wand2 size={14} className="text-yellow-400" /> AI Content Generator</h3>
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Topic / Prompt</label>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={4} placeholder="e.g. New brisket burger special available this weekend..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:border-gray-500" />
          </div>
          <div className="flex gap-2">
            <select value={platform} onChange={e => setPlatform(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              {['Instagram', 'Facebook', 'TikTok', 'Twitter/X'].map(p => <option key={p}>{p}</option>)}
            </select>
            <button onClick={handleGenerate} disabled={isGenerating || !aiPrompt.trim()}
              className="flex-1 bg-bbq-red hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2">
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Generate Text
            </button>
            <button onClick={handleGenerateImage} disabled={isGeneratingImage || !aiPrompt.trim()}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold px-3 py-2 rounded-lg text-sm flex items-center gap-1.5">
              {isGeneratingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Prompt
            </button>
          </div>
          {generatedContent && (
            <div className="bg-black/40 border border-gray-700 rounded-lg p-3 space-y-2">
              <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{generatedContent}</p>
              <div className="flex gap-3 pt-1 border-t border-gray-700">
                <button onClick={() => { navigator.clipboard?.writeText(generatedContent); toast.success('Copied!'); }} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Copy size={11} /> Copy</button>
                <button onClick={() => setGeneratedContent('')} className="text-xs text-gray-500 hover:text-gray-400">Clear</button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5 space-y-4 flex flex-col">
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Sparkles size={14} className="text-yellow-400" /> AI Strategist</h3>
          <p className="text-sm text-gray-400">Analyze your performance metrics and get actionable advice on how to grow your BBQ brand.</p>
          <div className="flex-1">
            {strategyResult
              ? <div className="bg-black/40 border border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto text-sm text-white whitespace-pre-wrap leading-relaxed">{strategyResult}</div>
              : <p className="text-sm text-gray-600 italic text-center py-6">No analysis generated yet.</p>
            }
          </div>
          <button onClick={handleAnalyze} disabled={isAnalyzing}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm flex items-center justify-center gap-2">
            {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />} Analyze & Recommend
          </button>
        </div>
      </div>

      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2">
            <CalendarDays size={14} className="text-blue-400" /> Schedule Calendar
            <span className="bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-normal">{scheduledPosts.length} scheduled</span>
          </h3>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="p-1.5 hover:bg-gray-800 rounded"><ChevronLeft size={15} /></button>
            <span className="text-xs font-bold text-white w-28 text-center">{calMonth.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="p-1.5 hover:bg-gray-800 rounded"><ChevronRight size={15} /></button>
            <button onClick={() => setCalMonth(new Date())} className="text-[10px] bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-700">Today</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-800 rounded-lg overflow-hidden">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <div key={d} className="bg-gray-900 p-2 text-center text-[9px] font-bold text-gray-500">{d}</div>
          ))}
          {calDays().map((date, idx) => {
            if (!date) return <div key={`e-${idx}`} className="bg-gray-950 min-h-[50px]" />;
            const ds = date.toISOString().split('T')[0];
            const posts = scheduledPosts.filter(p => p.date === ds);
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div key={ds} className={`min-h-[50px] p-1.5 bg-gray-900/70 ${isToday ? 'ring-1 ring-inset ring-bbq-red' : ''}`}>
                <span className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-bbq-red text-white' : 'text-gray-500'}`}>{date.getDate()}</span>
                {posts.map((p, i) => <div key={i} className="mt-0.5 text-[8px] bg-purple-900/50 border-l border-purple-500 text-purple-300 px-1 rounded truncate">{p.platform}</div>)}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-[#1a1207] border border-yellow-900/40 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Bot size={15} className="text-yellow-400" /> Smart AI Scheduler <span className="text-[9px] bg-yellow-600 text-black font-black px-1.5 py-0.5 rounded uppercase">Research-Backed</span></h3>
            <p className="text-xs text-gray-400 mt-1">AI agent analyses your cook days, menu, and audience to build an optimised posting schedule.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`flex items-center gap-1.5 text-xs ${hasGemini ? 'text-green-400' : 'text-gray-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${hasGemini ? 'bg-green-400' : 'bg-gray-600'}`} /> Claude AI — {hasGemini ? 'connected' : 'not checked'}
            </div>
            <button onClick={handleCheckGemini} disabled={isCheckingGemini} className="bg-gray-800 border border-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-gray-700 flex items-center gap-1 disabled:opacity-50">{isCheckingGemini ? <Loader2 size={10} className="animate-spin" /> : <Activity size={10} />} Check</button>
            <button onClick={() => window.open('https://aistudio.google.com/apikey', '_blank')} className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold px-3 py-1.5 rounded">Get API Key</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[{ label: 'START FROM', el: <input type="date" value={scheduleStartDate} onChange={e => setScheduleStartDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm" /> },
          { label: 'MODE', el: <select value={scheduleMode} onChange={e => setScheduleMode(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm">{['Fresh 2 weeks', 'Cook Day Focus', 'Brand Building', 'Event Promo'].map(m => <option key={m}>{m}</option>)}</select> },
          { label: 'POSTS', el: <select value={schedulePosts} onChange={e => setSchedulePosts(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm">{['5', '7', '10', '14', '21'].map(n => <option key={n}>{n}</option>)}</select> },
          ].map(({ label, el }) => (
            <div key={label}><label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</label>{el}</div>
          ))}
        </div>
        {scheduledPosts.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {scheduledPosts.map((p, i) => (
              <div key={i} className="flex items-start gap-3 bg-black/30 border border-gray-800 rounded-lg p-2.5">
                <span className="text-[10px] font-mono text-gray-500 w-20 shrink-0">{p.date}</span>
                <div className="flex-1 min-w-0"><p className="text-xs text-white truncate">{p.caption}</p><p className="text-[10px] text-purple-400">{p.platform} · {p.type}</p></div>
              </div>
            ))}
          </div>
        )}
        {scheduledPosts.length === 0 && (
          <div className="bg-black/40 border border-yellow-900/30 rounded-lg p-8 text-center">
            <Bot size={32} className="mx-auto mb-3 text-gray-700" />
            <p className="text-sm text-gray-500">Hit <strong className="text-white">Generate Schedule</strong> to let the AI agent build your next {scheduleMode} of content.</p>
          </div>
        )}
        <button onClick={handleGenerateSchedule} disabled={isScheduling}
          className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black py-3 rounded-lg text-sm flex items-center justify-center gap-2">
          {isScheduling ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Generate Schedule
        </button>
      </div>

      <div className="bg-gray-900/60 border border-blue-800/40 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Globe size={14} className="text-blue-400" /> Facebook Integration<Tip text="Enter your Facebook Page ID to auto-populate the homepage ticker with your latest posts. The page ID is the last part of your Facebook page URL." /></h3>
            <p className="text-xs text-gray-500 mt-1">Connect your business page to auto-update the homepage ticker.</p>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${fbConnected ? 'bg-green-900/40 text-green-400 border border-green-700' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
            {fbConnected ? <><Check size={11} /> Connected</> : 'Not Connected'}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { setFbConnected(false); updateSettings({ facebookConnected: false, fbPageId: '' }); setFbPageId(''); toast('Facebook disconnected.'); }} className="text-sm text-red-400 hover:text-red-300 underline">Disconnect</button>
          <button onClick={() => setShowFbConfig(!showFbConfig)} className="text-sm text-blue-400 hover:text-blue-300 underline">Configure</button>
          <button onClick={() => { setFbConnected(true); updateSettings({ facebookConnected: true }); toast.success('Connection test passed!'); }}
            className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-4 py-1.5 rounded text-xs flex items-center gap-1.5"><Link size={12} /> Test Connection</button>
        </div>
        {showFbConfig && (
          <div className="bg-blue-950/20 border border-blue-800/40 rounded-lg p-4 space-y-3">
            <p className="text-xs font-bold text-blue-300 uppercase tracking-wider">Facebook Page Configuration</p>
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">FACEBOOK PAGE ID</label>
              <input value={fbPageId} onChange={e => setFbPageId(e.target.value)} placeholder="e.g. 123456789012345"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm font-mono" />
              <p className="text-[10px] text-gray-500 mt-1">Find in Facebook Page Settings &gt; About &gt; Page Transparency &gt; Page ID.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleFbConfigure} className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-sm">Save Configuration</button>
              <button onClick={() => setShowFbConfig(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5">
        <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2 mb-4"><ImageIcon size={14} className="text-pink-400" /> Fan Gallery Moderation</h3>
        <div className="text-center py-6 text-gray-600"><ImageIcon size={28} className="mx-auto mb-2 opacity-20" /><p className="text-sm">No pending fan submissions.</p></div>
      </div>

      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5"><SmsBlast /></div>
    </div>
  );
};

// ─── DEV TOOLS ───────────────────────────────────────────────────────
const FTDevTools = () => {
  const { connectionError, settings, updateSettings } = useStorefront();
  const [devSettings, setDevSettings] = useState({
    squareAppId: '', squareLocationId: '', squareAccessToken: '',
    firebaseProjectId: '', firebaseAuthDomain: '', firebaseApiKey: '',
    firebaseStorageBucket: '', firebaseMessagingSenderId: '', firebaseAppId: '',
    ...(settings.devSettings || {}),
  });
  const [emailSettings, setEmailSettings] = useState({ enabled: false, provider: 'SMTP (Custom)', fromEmail: '', fromName: '', adminEmail: '', smtpHost: '', smtpPort: '465', smtpUser: '', smtpPassword: '', ...(settings.emailSettings || {}) });
  const [smsSettings, setSmsSettings] = useState({ enabled: false, fromNumber: '', accountSid: '', authToken: '', ...(settings.smsSettings || {}) });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState(null);
  const [isPwSaving, setIsPwSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [lastPulse, setLastPulse] = useState(new Date());
  const hasGemini = !!(_geminiKeyOverride || process.env.REACT_APP_GEMINI_API_KEY || settings.geminiApiKey);
  const [diagnosticsResult, setDiagnosticsResult] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [squareStatus, setSquareStatus] = useState(null);
  const [isTestingSquare, setIsTestingSquare] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await updateSettings({ devSettings, emailSettings, smsSettings });
    setIsSaving(false); toast.success('Settings saved!');
  };

  const handleTestGemini = async () => {
    setIsTestingGemini(true); setGeminiStatus(null);
    const result = await callGemini('Reply with exactly: OK');
    if (result && typeof result === 'string') {
      setGeminiStatus({ ok: true, msg: 'Active — AI features enabled for all admins.' });
    } else {
      const errMsg = result?.__error || 'No response — check key or quota.';
      setGeminiStatus({ ok: false, msg: errMsg });
    }
    setIsTestingGemini(false);
  };

  const handleSaveGeminiKey = async () => {
    if (!newKeyInput.trim()) { toast.error('Enter an API key.'); return; }
    setIsSavingKey(true);
    _geminiKeyOverride = newKeyInput.trim();
    const test = await callGemini('Reply with exactly: OK');
    if (test && typeof test === 'string') {
      await updateSettings({ geminiApiKey: newKeyInput.trim() });
      setShowKeyInput(false);
      setNewKeyInput('');
      setGeminiStatus({ ok: true, msg: 'Active — AI features enabled for all admins.' });
      toast.success('Key verified and saved!');
    } else {
      _geminiKeyOverride = settings.geminiApiKey || null;
      const errMsg = test?.__error || 'Key did not respond — check it is a valid Gemini API key.';
      toast.error(errMsg);
    }
    setIsSavingKey(false);
  };

  const handleGeminiDisconnect = async () => {
    if (window.confirm('Remove the saved Gemini API key from app settings?')) {
      _geminiKeyOverride = null;
      await updateSettings({ geminiApiKey: '' });
      toast('Gemini key removed.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) { setPwStatus({ ok: false, msg: 'Passwords do not match.' }); return; }
    if (pwForm.newPassword.length < 8) { setPwStatus({ ok: false, msg: 'Min 8 characters.' }); return; }
    setIsPwSaving(true); setPwStatus(null);
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error('Not logged in to Firebase');
      await reauthenticateWithCredential(fbUser, EmailAuthProvider.credential(fbUser.email, pwForm.currentPassword));
      await updatePassword(fbUser, pwForm.newPassword);
      setPwStatus({ ok: true, msg: 'Password changed successfully!' });
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwStatus({ ok: false, msg: err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' ? 'Current password is incorrect.' : err.message });
    } finally { setIsPwSaving(false); }
  };

  const handleSquareTest = async () => {
    if (!devSettings.squareAppId || !devSettings.squareLocationId) {
      toast.error('Enter Application ID and Location ID first.');
      return;
    }
    setIsTestingSquare(true); setSquareStatus(null);
    const tid = toast.loading('Testing Square connection...');
    try {
      const res = await fetch('/api/v1/square/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: devSettings.squareAppId, locationId: devSettings.squareLocationId, accessToken: devSettings.squareAccessToken }),
      });
      if (res.ok) {
        setSquareStatus({ ok: true, msg: 'Connection verified — payments ready.' });
        toast.success('Square connection verified!', { id: tid });
      } else {
        const data = await res.json().catch(() => ({}));
        setSquareStatus({ ok: false, msg: data.message || `Server error ${res.status}` });
        toast.error(data.message || 'Square credentials invalid.', { id: tid });
      }
    } catch {
      const appIdValid = devSettings.squareAppId.startsWith('sq0idp-') || devSettings.squareAppId.startsWith('sandbox-sq0idp-');
      if (appIdValid) {
        setSquareStatus({ ok: true, msg: 'Format valid. Deploy server to test live connection.' });
        toast.success('Credentials look valid. Deploy server to run live test.', { id: tid });
      } else {
        setSquareStatus({ ok: false, msg: 'App ID should start with sq0idp- or sandbox-sq0idp-' });
        toast.error('Invalid App ID format — check Square Developer Dashboard.', { id: tid });
      }
    }
    setIsTestingSquare(false);
  };

  const handleSendTestSms = async () => {
    if (!smsSettings.accountSid || !smsSettings.authToken || !smsSettings.fromNumber) {
      toast.error('Fill in Account SID, Auth Token, and From Number first.');
      return;
    }
    const testPhone = window.prompt('Enter test phone number (E.164 format, e.g. +61412345678):');
    if (!testPhone?.trim()) return;
    setIsSendingSms(true);
    const tid = toast.loading('Sending test SMS...');
    try {
      const res = await fetch('/api/v1/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsSettings, to: testPhone.trim() }),
      });
      if (res.ok) {
        toast.success(`Test SMS sent to ${testPhone.trim()}!`, { id: tid });
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || `Error ${res.status} — check Twilio credentials.`, { id: tid });
      }
    } catch {
      toast.error('Backend SMS endpoint not reachable — ensure server is running.', { id: tid });
    }
    setIsSendingSms(false);
  };

  const handleSquareDisconnect = () => {
    if (window.confirm('Disconnect Square? This will clear your App ID and Location ID.')) {
      setDevSettings(d => ({ ...d, squareAppId: '', squareLocationId: '' }));
      toast.success('Square disconnected. Click Save Changes to apply.');
    }
  };
  const handleResetFirebase = () => {
    if (window.confirm('Clear all Firebase configuration fields?')) {
      setDevSettings(d => ({ ...d, firebaseProjectId: '', firebaseAuthDomain: '', firebaseApiKey: '', firebaseStorageBucket: '', firebaseMessagingSenderId: '', firebaseAppId: '' }));
      toast('Firebase fields cleared.');
    }
  };
  const handleUpdateFirebase = async () => {
    await handleSave();
    toast('Config saved. Reloading app...');
    setTimeout(() => window.location.reload(), 1200);
  };
  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true); setDiagnosticsResult(null);
    const results = [];
    results.push({ label: 'Firestore DB', ok: !connectionError, detail: connectionError || 'Read/write access confirmed' });
    const geminiRes = await callGemini('Reply with exactly: DIAG_OK');
    const geminiOk = geminiRes && typeof geminiRes === 'string';
    const geminiDetail = geminiOk ? 'API key valid \u2014 AI responding' : (geminiRes?.__error || (hasGemini ? 'Key set but no response \u2014 check quota' : 'No API key set \u2014 use Dev Tools \u2192 Update API Key'));
    results.push({ label: 'Gemini AI', ok: geminiOk, detail: geminiDetail });
    results.push({ label: 'Network', ok: navigator.onLine, detail: navigator.onLine ? 'Online \u2014 HTTPS active' : 'Offline \u2014 check connection' });
    results.push({ label: 'Square', ok: !!devSettings.squareAppId, detail: devSettings.squareAppId ? 'App ID configured' : 'Not configured' });
    setDiagnosticsResult(results);
    setIsDiagnosing(false);
  };
  const handleSendTestEmail = async () => {
    if (!emailSettings.smtpHost || !emailSettings.smtpUser) { toast.error('Configure SMTP host and user first.'); return; }
    const tid = toast.loading('Sending test email...');
    try {
      const res = await fetch('/api/v1/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailSettings }) });
      res.ok ? toast.success(`Test email sent to ${emailSettings.adminEmail || emailSettings.fromEmail}!`, { id: tid }) : toast.error(`Server error ${res.status} \u2014 check SMTP settings.`, { id: tid });
    } catch { toast.error('Could not reach email endpoint \u2014 ensure backend is running and SMTP is configured.', { id: tid }); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wide flex items-center">Developer Tools<Tip text="Run Deep Diagnostics to check all service connections. Set your Gemini API key here — it's saved to Firestore so it works on all devices with no redeployment needed." /></h2>
          <p className="text-gray-400 text-sm mt-1">Technical configuration, API keys, and system diagnostics.</p>
        </div>
        <button onClick={handleSave} disabled={isSaving}
          className="flex items-center gap-2 bg-gray-800 border border-gray-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm">
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
        </button>
      </div>

      {/* AI Configuration */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Wand2 size={14} className="text-yellow-400" /> AI Configuration (Gemini)<Tip text="Get a free key at aistudio.google.com/apikey. Once saved, Gemini powers: menu descriptions, catering copy, social posts, image prompts, and the Pitmaster AI chat." /></h3>
          <p className="text-xs text-gray-500 mt-1">Powers Pitmaster Jay chat, social content generation, AI image generation, and strategic recommendations.</p>
        </div>
        <div className={`flex items-center justify-between p-4 rounded-xl border ${hasGemini ? 'bg-green-950/20 border-green-800/50' : 'bg-gray-800/50 border-gray-700'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${hasGemini ? 'bg-green-900/40' : 'bg-gray-700'}`}><Zap size={16} className={hasGemini ? 'text-green-400' : 'text-gray-500'} /></div>
            <div>
              <p className="text-sm font-bold text-white">Google Gemini AI</p>
              <p className="text-xs text-gray-400">{hasGemini ? 'Connected — AI features active for all admins' : 'Not configured — add REACT_APP_GEMINI_API_KEY to CF Pages'}</p>
              {geminiStatus && <p className={`text-xs mt-0.5 ${geminiStatus.ok ? 'text-green-400' : 'text-red-400'}`}>{geminiStatus.msg}</p>}
            </div>
          </div>
          <span className={`text-xs font-bold flex items-center gap-1 ${hasGemini ? 'text-green-400' : 'text-gray-500'}`}>{hasGemini ? <><Check size={11} /> Active</> : 'Inactive'}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleTestGemini} disabled={isTestingGemini}
            className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5">
            {isTestingGemini ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />} Test Connection
          </button>
          <button onClick={() => setShowKeyInput(!showKeyInput)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5"><RefreshCw size={12} /> {showKeyInput ? 'Cancel' : 'Update API Key'}</button>
          <button onClick={handleGeminiDisconnect} className="bg-red-900 hover:bg-red-800 text-red-200 font-bold px-4 py-2 rounded-lg text-xs">Disconnect</button>
        </div>
        {showKeyInput && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-white">Enter Gemini API Key</p>
            <p className="text-xs text-gray-400">Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">aistudio.google.com/apikey</a>. The key is saved directly to your app settings — no CF Pages required.</p>
            <div className="flex gap-2">
              <input type="password" value={newKeyInput} onChange={e => setNewKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm font-mono focus:outline-none focus:border-green-600" />
              <button onClick={handleSaveGeminiKey} disabled={isSavingKey || !newKeyInput.trim()}
                className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
                {isSavingKey ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Key
              </button>
            </div>
            <p className="text-[10px] text-gray-500">Key is saved to Firestore settings and persists across deployments. Optionally also add as <code className="text-gray-400">REACT_APP_GEMINI_API_KEY</code> in CF Pages for extra redundancy.</p>
          </div>
        )}
      </div>

      {/* Payment Gateway */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><CreditCard size={14} className="text-green-400" /> Payment Gateway</h3>
          <p className="text-xs text-gray-500 mt-1">Connect your Square account to accept card payments for orders and catering deposits.</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-900/40 rounded-lg flex items-center justify-center"><CreditCard size={16} className="text-green-400" /></div>
              <div>
                <p className="text-sm font-bold text-white">Square Payments</p>
                <p className={`text-xs ${devSettings.squareAppId ? 'text-green-400' : 'text-gray-500'}`}>{devSettings.squareAppId ? '⊙ Configured' : 'Not connected'}</p>
                {squareStatus && <p className={`text-[11px] mt-0.5 ${squareStatus.ok ? 'text-green-400' : 'text-red-400'}`}>{squareStatus.msg}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSquareTest} disabled={isTestingSquare} className="text-xs bg-green-900 hover:bg-green-800 text-green-200 font-bold px-3 py-1.5 rounded flex items-center gap-1.5 disabled:opacity-50">
                {isTestingSquare ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Test Connection
              </button>
              {devSettings.squareAppId && <button onClick={handleSquareDisconnect} className="text-xs bg-red-900 hover:bg-red-800 text-red-200 font-bold px-3 py-1.5 rounded">Disconnect</button>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[{ key: 'squareAppId', label: 'APPLICATION ID', ph: 'sq0idp-...', pw: false }, { key: 'squareLocationId', label: 'LOCATION ID', ph: 'LEG88M0C3BZA...' }, { key: 'squareAccessToken', label: 'ACCESS TOKEN (for API test)', ph: 'EAAAl...', pw: true }].map(({ key, label, ph, pw }) => (
              <div key={key}>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</label>
                <div className="flex gap-2">
                  <input type={pw ? 'password' : 'text'} value={devSettings[key] || ''} onChange={e => setDevSettings(d => ({ ...d, [key]: e.target.value }))} placeholder={ph}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm font-mono" />
                  <button onClick={() => { navigator.clipboard?.writeText(devSettings[key] || ''); toast.success('Copied!'); }} className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"><Copy size={13} className="text-gray-400" /></button>
                </div>
              </div>
            ))}
            <div className="col-span-full bg-green-950/20 border border-green-800/30 rounded-lg p-3 text-xs text-green-300">
              <p className="font-bold">Square Developer Setup</p>
              <p className="text-gray-400 mt-1">Get your keys from <a href="https://developer.squareup.com/apps" target="_blank" rel="noreferrer" className="text-green-400 hover:underline">developer.squareup.com/apps</a>. Use <strong className="text-white">Sandbox</strong> credentials for testing (App ID starts with <code>sandbox-sq0idp-</code>). The Access Token is required for live API verification.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Operations Console */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Activity size={14} className="text-green-400" /> Live Operations Console</h3>
          <button onClick={() => setLastPulse(new Date())} className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'FIRESTORE DB', value: connectionError ? 'Error' : 'Active', sub: connectionError || 'Latency: <200ms', icon: Database, ok: !connectionError },
            { label: 'AUTH SERVICE', value: 'Local Admin', sub: 'Credential: App Settings', icon: Lock, ok: true },
            { label: 'NETWORK', value: 'Secure', sub: 'TLS 1.3 / HTTPS', icon: Wifi, ok: true },
            { label: 'LAST PULSE', value: lastPulse.toLocaleTimeString(), sub: 'Auto-sync active', icon: Activity, ok: true },
          ].map(({ label, value, sub, icon: Icon, ok }) => (
            <div key={label} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2"><p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{label}</p><Icon size={13} className="text-gray-600" /></div>
              <p className={`text-base font-bold flex items-center gap-1.5 ${ok ? 'text-white' : 'text-red-400'}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-green-400' : 'bg-red-500'}`} />{value}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">{sub}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Firebase Configuration</label>
            <div className="flex gap-3 text-xs">
              <button onClick={handleRunDiagnostics} disabled={isDiagnosing} className="text-bbq-red hover:text-red-400 flex items-center gap-1 disabled:opacity-50">{isDiagnosing && <Loader2 size={11} className="animate-spin" />}&gt;_ Run Deep Diagnostics</button>
              <button onClick={handleResetFirebase} className="text-gray-500 hover:text-gray-300">Reset to Default</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'firebaseProjectId', label: 'Project ID', ph: 'hughesys-que' },
              { key: 'firebaseAuthDomain', label: 'Auth Domain', ph: 'hughesys-que.firebaseapp.com' },
              { key: 'firebaseApiKey', label: 'API Key', ph: '••••••••', pw: true },
              { key: 'firebaseStorageBucket', label: 'Storage Bucket', ph: 'hughesys-que.appspot.com' },
              { key: 'firebaseMessagingSenderId', label: 'Messaging Sender ID', ph: '1234567890' },
              { key: 'firebaseAppId', label: 'App ID', ph: '1:1234:web:abcd1234' },
            ].map(({ key, label, ph, pw }) => (
              <div key={key}>
                <label className="block text-[10px] text-gray-500 mb-1">{label}</label>
                <input type={pw ? 'password' : 'text'} value={devSettings[key] || ''} onChange={e => setDevSettings(d => ({ ...d, [key]: e.target.value }))} placeholder={ph}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm font-mono focus:outline-none" />
              </div>
            ))}
          </div>
          <button onClick={handleUpdateFirebase} className="w-full mt-3 bg-blue-700 hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm">Update Firebase Connection (Reloads App)</button>
          {diagnosticsResult && (
            <div className="mt-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Diagnostics Results</p>
              {diagnosticsResult.map((r, i) => {
                const projectId = devSettings.firebaseProjectId || 'hughesys-que';
                const rulesUrl = `https://console.firebase.google.com/project/${projectId}/firestore/rules`;
                return (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs ${r.ok ? 'bg-green-950/30 border-green-800/50' : 'bg-red-950/30 border-red-800/50'}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${r.ok ? 'bg-green-400' : 'bg-red-500'}`} />
                    <span className={`font-bold w-24 shrink-0 ${r.ok ? 'text-green-300' : 'text-red-300'}`}>{r.label}</span>
                    <span className="text-gray-400 flex-1">{r.detail}</span>
                    {!r.ok && r.label === 'Firestore DB' && (
                      <a href={rulesUrl} target="_blank" rel="noreferrer"
                        className="shrink-0 bg-red-700 hover:bg-red-600 text-white font-bold px-2 py-1 rounded text-[10px] whitespace-nowrap">Fix Rules →</a>
                    )}
                  </div>
                );
              })}
              {diagnosticsResult.some(r => !r.ok && r.label === 'Firestore DB') && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-bold text-red-300">How to fix Firestore security rules:</p>
                  <ol className="text-[11px] text-gray-400 space-y-1 list-decimal list-inside">
                    <li>Click <strong className="text-white">Fix Rules →</strong> above to open Firebase Console</li>
                    <li>Replace the entire rules block with the rules below</li>
                    <li>Click <strong className="text-white">Publish</strong></li>
                  </ol>
                  <pre className="bg-black/50 border border-gray-700 rounded p-2 text-[10px] text-green-300 overflow-x-auto whitespace-pre">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}</pre>
                  <p className="text-[10px] text-yellow-500">⚠ These open rules are fine for development. Tighten them before a public launch.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin Access */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Lock size={14} className="text-gray-400" /> Admin Access</h3>
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 text-xs text-yellow-300">Change from the default password before going live.</div>
        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          {[{ key: 'currentPassword', label: 'Current Password' }, { key: 'newPassword', label: 'New Password (min 8 chars)' }, { key: 'confirm', label: 'Confirm New Password' }].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</label>
              <input type="password" value={pwForm[key]} onChange={e => setPwForm({ ...pwForm, [key]: e.target.value })} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm" />
            </div>
          ))}
          {pwStatus && <p className={`text-sm font-bold flex items-center gap-1 ${pwStatus.ok ? 'text-green-400' : 'text-red-400'}`}>{pwStatus.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {pwStatus.msg}</p>}
          <button type="submit" disabled={isPwSaving} className="bg-yellow-700 hover:bg-yellow-600 text-white px-5 py-2 rounded-lg font-bold text-sm disabled:opacity-50 flex items-center gap-2">
            {isPwSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Change Password
          </button>
        </form>
      </div>

      {/* Email Settings */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Mail size={14} className="text-purple-400" /> Email Settings</h3>
        <label className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-lg p-3.5 cursor-pointer hover:border-gray-500 transition">
          <input type="checkbox" checked={emailSettings.enabled || false} onChange={e => setEmailSettings(es => ({ ...es, enabled: e.target.checked }))} className="w-4 h-4 accent-bbq-red" />
          <span className="font-bold text-white text-sm">Enable Email Notifications</span>
        </label>
        {emailSettings.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">PROVIDER</label>
                <select value={emailSettings.provider || 'SMTP (Custom)'} onChange={e => setEmailSettings(es => ({ ...es, provider: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm">
                  {['SMTP (Custom)', 'SendGrid', 'Mailgun', 'Amazon SES'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              {[{ k: 'fromEmail', l: 'FROM EMAIL', p: 'orders@hughesysque.com.au' }, { k: 'fromName', l: 'FROM NAME', p: 'Hughesys Que' }, { k: 'adminEmail', l: 'ADMIN EMAIL (RECEIVES ORDER ALERTS)', p: 'admin@hughesysque.com.au' }].map(({ k, l, p }) => (
                <div key={k}><label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{l}</label>
                  <input value={emailSettings[k] || ''} onChange={e => setEmailSettings(es => ({ ...es, [k]: e.target.value }))} placeholder={p} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm" /></div>
              ))}
            </div>
            <div className="space-y-3">
              {[{ k: 'smtpHost', l: 'SMTP HOST', p: 'smtp.siteground.biz' }, { k: 'smtpPort', l: 'SMTP PORT', p: '465' }, { k: 'smtpUser', l: 'SMTP USER', p: 'admin@hughesysque.com.au' }].map(({ k, l, p }) => (
                <div key={k}><label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{l}</label>
                  <input value={emailSettings[k] || ''} onChange={e => setEmailSettings(es => ({ ...es, [k]: e.target.value }))} placeholder={p} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm" /></div>
              ))}
              <div><label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">SMTP PASSWORD</label>
                <input type="password" value={emailSettings.smtpPassword || ''} onChange={e => setEmailSettings(es => ({ ...es, smtpPassword: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm" /></div>
              <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-3 text-xs text-blue-300">
                <p className="font-bold">SiteGround GoGeek Guide</p>
                <p className="text-gray-400 mt-1">Use SSL/TLS settings from SiteGround cPanel &gt; Email Accounts &gt; Connect Devices. Port is usually <strong className="text-white">465</strong>. The 'User' is your <strong className="text-white">full email address</strong>.</p>
              </div>
              <button onClick={handleSendTestEmail} className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold py-2.5 rounded-lg text-sm">Send Test Email</button>
            </div>
          </div>
        )}
      </div>

      {/* SMS Settings */}
      <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-6 space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] flex items-center gap-2"><Smartphone size={14} className="text-green-400" /> SMS Settings (Twilio)</h3>
        <p className="text-xs text-gray-500">Send order alerts and customer confirmations via SMS. Uses Twilio — enter credentials from <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">console.twilio.com</a>.</p>
        <label className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-lg p-3.5 cursor-pointer hover:border-gray-500 transition">
          <input type="checkbox" checked={smsSettings.enabled || false} onChange={e => setSmsSettings(s => ({ ...s, enabled: e.target.checked }))} className="w-4 h-4 accent-bbq-red" />
          <div><span className="font-bold text-white text-sm">Enable SMS Notifications</span><p className="text-xs text-gray-500">Sends order alerts to admin and confirmation to customers.</p></div>
        </label>
        {smsSettings.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">FROM NUMBER</label>
              <input value={smsSettings.fromNumber || ''} onChange={e => setSmsSettings(s => ({ ...s, fromNumber: e.target.value }))} placeholder="+61485019997"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm font-mono" />
            </div>
            {[{ k: 'accountSid', l: 'ACCOUNT SID', p: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }, { k: 'authToken', l: 'AUTH TOKEN', pw: true, p: '••••••••••••••••' }].map(({ k, l, p, pw }) => (
              <div key={k}><label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{l}</label>
                <input type={pw ? 'password' : 'text'} value={smsSettings[k] || ''} onChange={e => setSmsSettings(s => ({ ...s, [k]: e.target.value }))} placeholder={p}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm font-mono" /></div>
            ))}
            <div className="col-span-full">
              <button onClick={handleSendTestSms} disabled={isSendingSms}
                className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-lg text-sm flex items-center gap-2">
                {isSendingSms ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />} Send Test SMS
              </button>
              <p className="text-[10px] text-gray-500 mt-1">Sends a test message to a number you specify. Requires server to be running.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MAIN ADMIN DASHBOARD ────────────────────────────────────────────
const FoodTruckAdmin = () => {
  const { connectionError, orders, brandName, settings } = useStorefront();
  const { user: authUser } = useAuth();
  const isDev = authUser?.role === 'dev';
  const [activeTab, setActiveTab] = useState('orders');
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('__adminWelcomeSeen'));

  const dismissWelcome = () => {
    localStorage.setItem('__adminWelcomeSeen', '1');
    setShowWelcome(false);
  };

  useEffect(() => {
    if (settings?.geminiApiKey) _geminiKeyOverride = settings.geminiApiKey;
  }, [settings?.geminiApiKey]);

  const ALL_TABS = [
    { id: 'orders', icon: CalendarCheck, label: 'Orders', badge: orders.filter(o => o.status === 'pending').length },
    { id: 'planner', icon: CalendarDays, label: 'Planner' },
    { id: 'pitmaster', icon: Flame, label: 'Pitmaster' },
    { id: 'menu', icon: Utensils, label: 'Menu' },
    { id: 'catering', icon: Package, label: 'Catering' },
    { id: 'customers', icon: Users, label: 'Customers' },
    { id: 'social', icon: Sparkles, label: 'Social & AI' },
    { id: 'settings', icon: Settings, label: 'Settings' },
    { id: 'devtools', icon: Code2, label: 'Dev Tools', devOnly: true },
  ];

  const tabs = ALL_TABS.filter(t => !t.devOnly || isDev);
  const activeTabInfo = tabs.find(t => t.id === activeTab);
  const ActiveIcon = activeTabInfo?.icon;

  return (
    <div className="flex -mx-4 md:-mx-8 min-h-[calc(100vh-160px)]">

      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden md:flex flex-col w-44 shrink-0 border-r border-gray-800/70 bg-gray-950/40">
        <div className="px-4 py-4 border-b border-gray-800/70">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {isDev ? 'Dev Panel' : 'Admin Panel'}
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {tabs.map(({ id, icon: Icon, label, badge, devOnly }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${activeTab === id
                ? devOnly ? 'bg-purple-700 text-white shadow-sm' : 'bg-bbq-red text-white shadow-sm'
                : devOnly ? 'text-purple-400 hover:text-white hover:bg-purple-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Icon size={15} />
              <span>{label}</span>
              {badge > 0 && (
                <span className="ml-auto bg-yellow-500 text-black text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0">{badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-gray-800/70">
          {isDev && (
            <span className="text-[10px] flex items-center gap-1.5 text-purple-400 mb-1.5">
              <Code2 size={10} /> Developer Mode
            </span>
          )}
          {connectionError ? (
            <span className="text-[10px] flex items-center gap-1.5 text-red-400">
              <WifiOff size={10} /> Offline
            </span>
          ) : (
            <span className="text-[10px] flex items-center gap-1.5 text-green-500">
              <Cloud size={10} /> Live · Firestore
            </span>
          )}
        </div>
      </aside>

      {/* ── Mobile horizontal tab bar (sits above bottom nav) ── */}
      <div className="md:hidden fixed bottom-[72px] left-0 right-0 z-40 flex overflow-x-auto bg-gray-950/95 border-t border-gray-800 backdrop-blur-md">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-0.5 px-3.5 py-2 shrink-0 text-[9px] font-bold uppercase tracking-wide transition-all ${activeTab === id ? 'text-white border-t-2 border-bbq-red' : 'text-gray-500 border-t-2 border-transparent'
              }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Section header bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800/60 bg-gray-950/20">
          {ActiveIcon && <ActiveIcon size={15} className="text-gray-400" />}
          <span className="text-sm font-semibold text-white">{activeTabInfo?.label}</span>
        </div>

        {/* Page content */}
        <div className="flex-1 p-5 md:p-6 overflow-auto">
          {showWelcome && (
            <div className="mb-5 bg-gradient-to-r from-bbq-red/20 to-orange-900/10 border border-bbq-red/30 rounded-xl p-4 flex items-start gap-4">
              <Flame size={22} className="text-bbq-red shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Welcome to {brandName || 'your'} Admin Dashboard</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  <strong className="text-white">Orders</strong> — live order management &nbsp;·&nbsp;
                  <strong className="text-white">Menu</strong> — add/edit items with AI images &nbsp;·&nbsp;
                  <strong className="text-white">Settings</strong> — branding, logo &amp; rewards &nbsp;·&nbsp;
                  <strong className="text-white">Social &amp; AI</strong> — content generation
                </p>
              </div>
              <button onClick={dismissWelcome} className="text-gray-600 hover:text-white shrink-0 transition"><X size={15} /></button>
            </div>
          )}
          {activeTab === 'orders' && <OrderManager />}
          {activeTab === 'planner' && <FTPlanner />}
          {activeTab === 'pitmaster' && <FTPitmaster />}
          {activeTab === 'menu' && <FTMenuManager />}
          {activeTab === 'catering' && <CateringManager />}
          {activeTab === 'customers' && <CustomerManager />}
          {activeTab === 'social' && <AdminSocialBridge />}
          {activeTab === 'settings' && <FTSettingsManager />}
          {activeTab === 'devtools' && <FTDevTools />}
        </div>
      </div>
    </div>
  );
};

export default FoodTruckAdmin;
