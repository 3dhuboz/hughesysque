import React, { useState } from 'react';
import { useStorefront } from '../context/StorefrontContext';
import api from '../api';
import {
  CalendarCheck, CalendarDays, Utensils, Settings, Plus, Edit2, Trash2, X, Save,
  ChevronLeft, ChevronRight, ShoppingBag, Truck, Package, Check, AlertTriangle,
  DollarSign, Loader2, Image as ImageIcon, ChevronDown, ChevronUp, HelpCircle,
  CheckSquare, Square, Flame, Cloud, Wifi, Users, Star, Gift
} from 'lucide-react';

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
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm">
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
  const [isEditing, setIsEditing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [editItem, setEditItem] = useState({ availabilityType: 'everyday', isPack: false, packGroups: [], available: true });
  const [activeGroupIndex, setActiveGroupIndex] = useState(null);

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
        <h3 className="text-xl font-bold text-white">Menu Items ({menu.length})</h3>
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
              <input placeholder="Image URL" value={editItem.image || ''} onChange={e => setEditItem({ ...editItem, image: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm mb-2" />
              {editItem.image && <div className="w-full h-24 rounded overflow-hidden border border-gray-700"><img src={editItem.image} alt="Preview" className="w-full h-full object-cover" /></div>}
            </div>
          </div>
          <textarea placeholder="Description" value={editItem.description || ''} onChange={e => setEditItem({ ...editItem, description: e.target.value })}
            rows={2} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm resize-none" />

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

// ─── SETTINGS MANAGER ────────────────────────────────────────────────
const FTSettingsManager = () => {
  const { settings, updateSettings, brandName } = useStorefront();
  const [form, setForm] = useState({ ...settings });
  const [rewardsForm, setRewardsForm] = useState({ ...(settings.rewards || {}) });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState(null);
  const [isPwSaving, setIsPwSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await updateSettings({ ...form, rewards: { ...rewardsForm } });
    setIsSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) { setPwStatus({ ok: false, msg: 'Passwords do not match.' }); return; }
    if (pwForm.newPassword.length < 8) { setPwStatus({ ok: false, msg: 'New password must be at least 8 characters.' }); return; }
    setIsPwSaving(true); setPwStatus(null);
    try {
      await api.put('/auth/password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwStatus({ ok: true, msg: 'Password changed successfully!' });
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwStatus({ ok: false, msg: err.response?.data?.message || 'Failed to change password.' });
    } finally { setIsPwSaving(false); }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <h3 className="text-xl font-bold text-white border-b border-gray-700 pb-2">Store Settings</h3>

      <div className="space-y-4">
        <h4 className="font-bold text-gray-300 uppercase text-xs tracking-widest">Business Info</h4>
        {[
          { key: 'businessName', label: 'Business Name', placeholder: brandName || 'Hughesys Que' },
          { key: 'businessAddress', label: 'Address', placeholder: '123 Main St, Brisbane' },
          { key: 'businessEmail', label: 'Email', placeholder: 'hello@example.com', type: 'email' },
          { key: 'businessPhone', label: 'Phone', placeholder: '0400 000 000' },
        ].map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <label className="block text-xs text-gray-400 font-bold mb-1">{label}</label>
            <input type={type || 'text'} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })}
              placeholder={placeholder} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm" />
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-gray-800 pt-6">
        <h4 className="font-bold text-gray-300 uppercase text-xs tracking-widest flex items-center gap-2"><Star size={14} className="text-bbq-gold" /> Golden Ticket Rewards</h4>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={rewardsForm.enabled || false} onChange={e => setRewardsForm({ ...rewardsForm, enabled: e.target.checked })} className="w-5 h-5 rounded text-bbq-red" />
          <span className="font-bold text-white">Enable Rewards Program</span>
        </label>
        {rewardsForm.enabled && (
          <div className="pl-4 border-l-2 border-bbq-gold space-y-3">
            {[
              { key: 'programName', label: 'Program Name', placeholder: 'The Golden Ticket' },
              { key: 'rewardTitle', label: 'Prize Description', placeholder: 'Free Rack of Ribs!' },
              { key: 'staffPin', label: 'Staff PIN (4 digits)', placeholder: '1234', type: 'password' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 font-bold mb-1">{label}</label>
                <input type={type || 'text'} value={rewardsForm[key] || ''} onChange={e => setRewardsForm({ ...rewardsForm, [key]: e.target.value })}
                  placeholder={placeholder} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm" />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-400 font-bold mb-1">Stamps to fill a ticket</label>
              <input type="number" min="5" max="20" value={rewardsForm.maxStamps || 10} onChange={e => setRewardsForm({ ...rewardsForm, maxStamps: parseInt(e.target.value) })}
                className="w-24 bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm text-center" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-gray-800 pt-6">
        <h4 className="font-bold text-gray-300 uppercase text-xs tracking-widest">Display</h4>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.maintenanceMode || false} onChange={e => setForm({ ...form, maintenanceMode: e.target.checked })} className="w-5 h-5 rounded text-bbq-red" />
          <div>
            <span className="font-bold text-white">Maintenance Mode</span>
            <p className="text-xs text-gray-500">Hide storefront from public when enabled.</p>
          </div>
        </label>
      </div>

      <div className="space-y-4 border-t border-gray-800 pt-6">
        <h4 className="font-bold text-gray-300 uppercase text-xs tracking-widest flex items-center gap-2">
          <AlertTriangle size={14} className="text-yellow-500" /> Admin Password
        </h4>
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-xs text-yellow-200">
          Change from the default password before going live.
        </div>
        <form onSubmit={handleChangePassword} className="space-y-3">
          {[
            { key: 'currentPassword', label: 'Current Password' },
            { key: 'newPassword', label: 'New Password (min 8 chars)' },
            { key: 'confirm', label: 'Confirm New Password' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 font-bold mb-1">{label}</label>
              <input type="password" value={pwForm[key]} onChange={e => setPwForm({ ...pwForm, [key]: e.target.value })}
                required className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm" />
            </div>
          ))}
          {pwStatus && (
            <p className={`text-sm font-bold flex items-center gap-1 ${pwStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
              {pwStatus.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {pwStatus.msg}
            </p>
          )}
          <button type="submit" disabled={isPwSaving}
            className="bg-yellow-700 hover:bg-yellow-600 text-white px-5 py-2 rounded font-bold text-sm disabled:opacity-50 flex items-center gap-2">
            {isPwSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isPwSaving ? 'Saving...' : 'Change Password'}
          </button>
        </form>
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
        <button onClick={handleSave} disabled={isSaving}
          className="bg-bbq-red text-white px-6 py-2 rounded font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-green-400 text-sm font-bold flex items-center gap-1"><Check size={14} /> Saved!</span>}
      </div>
    </div>
  );
};

// ─── MAIN ADMIN DASHBOARD ────────────────────────────────────────────
const FoodTruckAdmin = () => {
  const { connectionError, orders, menu, brandName } = useStorefront();
  const [activeTab, setActiveTab] = useState('orders');

  const TABS = [
    { id: 'orders', icon: CalendarCheck, label: 'Orders', badge: orders.filter(o => o.status === 'pending').length },
    { id: 'planner', icon: CalendarDays, label: 'Planner' },
    { id: 'menu', icon: Utensils, label: 'Menu', badge: menu.length },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-display font-bold text-white">{brandName} Admin</h2>
          <div className="flex items-center gap-2 mt-1">
            {connectionError ? (
              <span className="text-xs bg-red-900/50 text-red-200 px-2 py-1 rounded border border-red-500 flex items-center gap-1"><Wifi size={12} /> Offline</span>
            ) : (
              <span className="text-xs bg-green-900/50 text-green-200 px-2 py-1 rounded border border-green-500 flex items-center gap-1"><Cloud size={12} /> Connected</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 bg-bbq-charcoal p-2 rounded-lg border border-gray-800">
          {TABS.map(({ id, icon: Icon, label, badge }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-md flex items-center gap-2 transition text-sm font-medium whitespace-nowrap relative ${activeTab === id ? 'bg-bbq-red text-white' : 'text-gray-400 hover:text-white'}`}>
              <Icon size={16} /> {label}
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">{badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-bbq-charcoal/50 border border-gray-800 rounded-xl p-6 min-h-[500px]">
        {activeTab === 'orders' && <OrderManager />}
        {activeTab === 'planner' && <FTPlanner />}
        {activeTab === 'menu' && <FTMenuManager />}
        {activeTab === 'settings' && <FTSettingsManager />}
      </div>
    </div>
  );
};

export default FoodTruckAdmin;
