import React, { useState } from 'react';
import { useStorefront } from '../context/StorefrontContext';
import { Save, User as UserIcon, MapPin, Phone, Mail, ShoppingBag, Truck, Flame, Star, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  pending: 'text-yellow-500',
  confirmed: 'text-blue-400',
  ready: 'text-green-500',
  completed: 'text-gray-400',
  shipped: 'text-purple-400',
  cancelled: 'text-red-400',
};

const StorefrontProfile = () => {
  const { user, updateUserProfile, orders, logout, settings } = useStorefront();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(user ? { ...user } : null);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <p className="text-gray-400 mb-4">Please login to view your profile.</p>
        <Link to="/login" className="bg-bbq-red text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition">Login</Link>
      </div>
    );
  }

  const myOrders = orders.filter(o =>
    o.userId === (user._id || user.id) ||
    o.customer?.email === user.email
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalSpend = myOrders.filter(o => !['cancelled'].includes(o.status)).reduce((s, o) => s + (o.total || 0), 0);
  const stamps = user.stamps || 0;
  const maxStamps = settings.rewards?.maxStamps || 10;

  const handleSave = (e) => {
    e.preventDefault();
    if (formData) { updateUserProfile(formData); setIsEditing(false); }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="animate-fade-in pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* LEFT: Profile Card */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-bbq-charcoal border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-gradient-to-br from-bbq-red/20 to-black p-6 text-center relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-bbq-red to-orange-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-gray-800 mx-auto mb-3 shadow-2xl">
                {(user.name || 'U').charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-display font-bold text-white">{user.name}</h2>
              <p className="text-gray-400 text-sm">{user.email}</p>
            </div>

            {/* Rewards Mini Card */}
            {settings.rewards?.enabled && (
              <div className="mx-4 mt-4 bg-gradient-to-r from-yellow-900/40 to-black border border-bbq-gold/30 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-bbq-gold uppercase tracking-widest flex items-center gap-1"><Star size={12}/> Golden Ticket</span>
                  <span className="text-xs text-gray-400">{stamps}/{maxStamps} stamps</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="bg-gradient-to-r from-bbq-gold to-yellow-500 h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min((stamps / maxStamps) * 100, 100)}%` }}></div>
                </div>
                <Link to="/rewards" className="text-[10px] text-gray-500 hover:text-bbq-gold mt-1 block text-right transition">View Rewards →</Link>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg">
                <ShoppingBag size={16} className="text-bbq-red shrink-0"/>
                <div>
                  <p className="text-xs text-gray-500">Total Orders</p>
                  <p className="font-bold text-white">{myOrders.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg">
                <Flame size={16} className="text-bbq-gold shrink-0"/>
                <div>
                  <p className="text-xs text-gray-500">Total Spent</p>
                  <p className="font-bold text-white">${totalSpend.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Profile */}
          <div className="bg-bbq-charcoal border border-gray-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white flex items-center gap-2"><UserIcon size={16} className="text-bbq-red"/> Details</h3>
              <button onClick={() => setIsEditing(!isEditing)} className="text-sm text-bbq-gold hover:underline">
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-3">
                {[
                  { key: 'name', label: 'Full Name', type: 'text' },
                  { key: 'email', label: 'Email', type: 'email' },
                  { key: 'phone', label: 'Phone', type: 'text' },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-400 mb-1">{label}</label>
                    <input type={type} value={formData?.[key] || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm focus:border-bbq-red outline-none" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Address</label>
                  <textarea value={formData?.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm h-16 resize-none focus:border-bbq-red outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Dietary Preferences</label>
                  <input type="text" value={formData?.dietaryPreferences || ''} onChange={e => setFormData({ ...formData, dietaryPreferences: e.target.value })}
                    placeholder="e.g. No gluten, Extra spicy"
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm focus:border-bbq-red outline-none" />
                </div>
                <button type="submit" className="w-full bg-bbq-red hover:bg-red-700 text-white font-bold py-2 rounded flex items-center justify-center gap-2 text-sm transition">
                  <Save size={14}/> Save Changes
                </button>
              </form>
            ) : (
              <div className="space-y-3 text-sm">
                {[
                  { icon: UserIcon, label: 'Name', val: user.name },
                  { icon: Mail, label: 'Email', val: user.email },
                  { icon: Phone, label: 'Phone', val: user.phone || 'Not set' },
                  { icon: MapPin, label: 'Address', val: user.address || 'Not set' },
                ].map(({ icon: Icon, label, val }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="bg-gray-800 p-1.5 rounded-full mt-0.5"><Icon size={12}/></div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
                      <p className="font-medium text-gray-200">{val}</p>
                    </div>
                  </div>
                ))}
                {user.dietaryPreferences && (
                  <div className="bg-blue-900/20 border border-blue-900 p-2 rounded text-xs text-blue-200">
                    <span className="font-bold">Preferences:</span> {user.dietaryPreferences}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={handleLogout}
            className="w-full bg-gray-900 border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition text-sm">
            <LogOut size={16}/> Sign Out
          </button>
        </div>

        {/* RIGHT: Order History */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <ShoppingBag className="text-bbq-red"/> Order History
          </h2>
          {myOrders.length === 0 ? (
            <div className="bg-bbq-charcoal/50 border border-gray-800 border-dashed rounded-2xl p-12 text-center text-gray-500">
              <ShoppingBag size={40} className="mx-auto mb-4 opacity-30"/>
              <p>You haven't placed any orders yet.</p>
              <Link to="/menu" className="mt-4 inline-block text-bbq-red hover:underline font-bold text-sm">Browse Menu</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map(order => {
                const orderId = order._id || order.id;
                const statusColor = STATUS_COLORS[order.status?.toLowerCase()] || 'text-gray-400';
                return (
                  <div key={orderId} className="bg-bbq-charcoal border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition">
                    <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-3">
                      <div>
                        <span className="font-mono text-gray-500 text-xs">#{order.orderNumber || orderId?.slice(-8)}</span>
                        <p className="text-sm text-gray-300 mt-0.5">{new Date(order.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className={`font-bold text-sm capitalize ${statusColor}`}>{order.status}</span>
                    </div>
                    <div className="space-y-1.5 mb-4">
                      {(order.items || []).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-300">{item.quantity}x {item.name || item.item?.name}</span>
                          <span className="text-gray-500">${((item.unitPrice || item.item?.price || 0) * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center font-bold pt-3 border-t border-gray-700">
                      <div className="text-xs text-gray-500 uppercase font-normal flex items-center gap-2">
                        {order.orderType === 'delivery' ? <Truck size={14}/> : null}
                        {order.pickupDate ? new Date(order.pickupDate).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}
                        {order.pickupTime ? ` at ${order.pickupTime}` : ''}
                      </div>
                      <span className="text-bbq-gold text-lg">${(order.total || 0).toFixed(2)}</span>
                    </div>
                    {order.status === 'shipped' && order.trackingNumber && (
                      <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Shipped via {order.courier || 'Post'}</p>
                          <p className="font-mono text-sm text-white">{order.trackingNumber}</p>
                        </div>
                        <a href={`https://auspost.com.au/mypost/track/#/details/${order.trackingNumber}`}
                          target="_blank" rel="noopener noreferrer"
                          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition">
                          <Truck size={14}/> Track
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorefrontProfile;
