
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { parseLocalDate } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import { Plus, Edit2, Calendar, Wand2, Loader2, Image as ImageIcon, Trash2, Package, CheckSquare, Square, ChevronDown, ChevronUp, HelpCircle, ChefHat, Info, RefreshCw, ExternalLink, X, Link as LinkIcon, Search } from 'lucide-react';
import { MenuItem, PackGroup } from '../../types';
import { generateMarketingImage } from '../../services/gemini';
import { PLACEHOLDER_IMG } from '../../constants';

// Helper to compress base64 images
const compressImage = (base64Str: string, maxWidth = 800, quality = 0.6) => {
    return new Promise<string>((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Resize logic
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => {
            resolve(base64Str);
        };
    });
};

/** Pair of one-way sync buttons between the Hughesys menu and Square's
 *  catalog. 'Sync to Square' pushes the local menu out (Hughesys → Square),
 *  'Import from Square' pulls the Square catalog in (Square → Hughesys).
 *  Both are idempotent — the squareCatalogMap stored in settings keeps
 *  items matched so repeat runs don't duplicate. */
const SquareCatalogSyncButton: React.FC = () => {
  const { settings, refreshData } = useApp() as any;
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | 'push' | 'pull'>(null);

  const squareConfigured = !!(settings?.squareAccessToken && settings?.squareLocationId);
  if (!squareConfigured) return null;

  const fmt = (ms?: number) => ms
    ? new Date(ms).toLocaleString('en-AU', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  const lastSync   = fmt(settings?.squareCatalogLastSync);
  const lastImport = fmt(settings?.squareCatalogLastImport);

  const call = async (path: string, onSuccess: (data: any) => string) => {
    try {
      const token = localStorage.getItem('hq_admin_token');
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');
      toast(onSuccess(data));
      return data;
    } catch (err: any) {
      toast(err.message || 'Request failed', 'error');
      return null;
    }
  };

  const push = async () => {
    setBusy('push');
    await call('/api/v1/payment/square-sync-catalog',
      (d) => `Pushed ${d.upserted} item${d.upserted === 1 ? '' : 's'} to Square (${d.environment}).`);
    setBusy(null);
  };

  const pull = async () => {
    if (!window.confirm("Pull the Square catalog into the Hughesys menu?\n\nItems already mapped will be updated (name, price, description). Items only in Square will be added as new menu items. Nothing in Hughesys will be deleted.")) return;
    setBusy('pull');
    const data = await call('/api/v1/payment/square-import-catalog',
      (d) => `Imported ${d.imported} new, updated ${d.updated} existing (${d.environment}).`);
    if (data?.success && typeof refreshData === 'function') {
      try { await refreshData(); } catch {}
    } else if (data?.success) {
      // Fall back to a full page refresh if the context doesn't expose a refresh.
      setTimeout(() => window.location.reload(), 1500);
    }
    setBusy(null);
  };

  const [isInspectorOpen, setInspectorOpen] = useState(false);

  return (
    <>
      <button onClick={push} disabled={!!busy}
        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50 text-white transition"
        title={lastSync ? `Last pushed: ${lastSync}` : 'Push the Hughesys menu to your Square catalog'}>
        {busy === 'push' ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}
        Sync to Square
        {lastSync && <span className="text-[10px] text-gray-500 font-normal">· {lastSync}</span>}
      </button>
      <button onClick={pull} disabled={!!busy}
        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50 text-white transition"
        title={lastImport ? `Last imported: ${lastImport}` : "Pull Square's catalog into the Hughesys menu"}>
        {busy === 'pull' ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14} className="-scale-x-100"/>}
        Import from Square
        {lastImport && <span className="text-[10px] text-gray-500 font-normal">· {lastImport}</span>}
      </button>
      <button onClick={() => setInspectorOpen(true)}
        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 text-white transition"
        title="See everything currently in your Square catalog">
        <ExternalLink size={14}/> View Square Catalog
      </button>
      {isInspectorOpen && <SquareCatalogInspector onClose={() => setInspectorOpen(false)}/>}
    </>
  );
};

/** Modal showing everything in Square's catalog. Each row tells you whether
 *  it's linked to a Hughesys menu item, and lets you delete straight from
 *  Square (with our local map scrubbed at the same time). */
const SquareCatalogInspector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [environment, setEnvironment] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    setRows(null);
    setLoadError(null);
    try {
      const token = localStorage.getItem('hq_admin_token');
      const res = await fetch('/api/v1/payment/square-catalog', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load Square catalog');
      setRows(data.items || []);
      setEnvironment(data.environment || '');
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load Square catalog');
      setRows([]);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const filtered = React.useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
  }, [rows, query]);

  const deleteFromSquare = async (row: any) => {
    if (!window.confirm(`Delete "${row.name}" from your Square catalog?\n\nThis only removes it from Square — the matching Hughesys menu item (if any) stays. A later 'Sync to Square' would push it back.`)) return;
    setDeletingId(row.squareId);
    try {
      const token = localStorage.getItem('hq_admin_token');
      const res = await fetch(`/api/v1/payment/square-catalog?id=${encodeURIComponent(row.squareId)}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed');
      toast(`Removed "${row.name}" from Square.`);
      setRows(prev => (prev || []).filter(r => r.squareId !== row.squareId));
    } catch (err: any) {
      toast(err.message || 'Delete failed', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="relative w-full max-w-4xl bg-bbq-charcoal border border-gray-800 rounded-2xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black border-b border-gray-800 p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-800 flex items-center justify-center shrink-0">
              <ExternalLink size={18} className="text-white"/>
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-white">Square Catalog</h3>
              <p className="text-xs text-gray-500">
                {environment && <span className="uppercase tracking-wider">{environment} · </span>}
                {rows ? `${rows.length} item${rows.length === 1 ? '' : 's'} in Square` : 'loading…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded" title="Reload"><RefreshCw size={14}/></button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded" title="Close"><X size={18}/></button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-500"/>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Square items by name or description…"
              className="w-full bg-gray-900 border border-gray-800 focus:border-gray-600 rounded-lg p-2 pl-9 text-white text-sm outline-none"/>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loadError && (
            <div className="p-6 text-center text-red-300 bg-red-950/20 border-b border-red-900/40 text-sm">
              {loadError}
            </div>
          )}
          {rows === null ? (
            <div className="p-10 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin"/> Loading Square catalog…
            </div>
          ) : filtered && filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">
              {query ? `No items match "${query}".` : 'Your Square catalog is empty.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {(filtered || []).map(row => (
                <div key={row.squareId} className="p-4 flex items-center gap-4 hover:bg-white/[0.02] transition">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-800 bg-gray-950 shrink-0">
                    {row.image
                      ? <img src={row.image} className="w-full h-full object-cover" alt={row.name}/>
                      : <div className="w-full h-full flex items-center justify-center text-gray-700"><Package size={18}/></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold text-white truncate">{row.name}</span>
                      {row.mappedHqId ? (
                        <span className="text-[10px] bg-green-900/30 text-green-300 border border-green-800 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider">
                          <LinkIcon size={9}/> Linked{row.mappedHqName && row.mappedHqName !== row.name ? `: ${row.mappedHqName}` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Square only
                        </span>
                      )}
                    </div>
                    {row.description && <p className="text-xs text-gray-500 truncate mt-0.5">{row.description}</p>}
                    <p className="text-[10px] text-gray-600 mt-1 font-mono">{row.squareId}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-bbq-gold">
                      {row.priceAud != null ? `$${row.priceAud.toFixed(2)}` : <span className="text-gray-600 text-sm">—</span>}
                    </div>
                  </div>
                  <button
                    disabled={deletingId === row.squareId}
                    onClick={() => deleteFromSquare(row)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition disabled:opacity-50"
                    title={`Delete "${row.name}" from Square`}>
                    {deletingId === row.squareId ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-900/60 border-t border-gray-800 text-[11px] text-gray-500 text-center">
          Deletes here only remove the item from Square. Your Hughesys menu stays intact.
        </div>
      </div>
    </div>
  );
};

const MenuManager: React.FC = () => {
  const { menu, addMenuItem, updateMenuItem, deleteMenuItem, calendarEvents } = useApp();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  
  const [editItem, setEditItem] = useState<Partial<MenuItem>>({
    availabilityType: 'everyday',
    isPack: false,
    packGroups: []
  });

  // State for Item Picker in Packs
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);

  // Filter for valid Order Pickup days from the planner
  const orderDays = calendarEvents
    .filter(evt => (evt.type === 'ORDER_PICKUP' || evt.type === 'PUBLIC_EVENT') && parseLocalDate(evt.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

  // Group items by category for the picker (excluding Rubs & Sauces, Merch)
  const itemsByCategory = menu.reduce((acc, item) => {
      if (['Rubs & Sauces', 'Merch'].includes(item.category)) return acc;
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
  }, {} as Record<string, MenuItem[]>);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editItem.name && editItem.price) {
      const itemToSave = { ...editItem, category: editItem.category || 'Meats' };
      try {
        if (editItem.id) {
          await updateMenuItem(itemToSave as MenuItem);
          toast('Menu item updated!');
        } else {
          await addMenuItem({ ...itemToSave, id: `m${Date.now()}`, available: true } as MenuItem);
          toast('Menu item added!');
        }
        setIsEditing(false);
        setEditItem({ availabilityType: 'everyday', isPack: false, packGroups: [] });
      } catch (err: any) {
        console.error('[MenuManager] Save failed:', err);
        toast(`Save failed: ${err.message || 'Unknown error'}`, 'error');
      }
    }
  };

  // Pack Group Helpers
  const addPackGroup = () => {
      setEditItem(prev => ({
          ...prev,
          packGroups: [...(prev.packGroups || []), { name: '', limit: 1, options: [] }]
      }));
  };

  const updatePackGroup = (index: number, field: keyof PackGroup, value: any) => {
      const newGroups = [...(editItem.packGroups || [])];
      newGroups[index] = { ...newGroups[index], [field]: value };
      setEditItem(prev => ({ ...prev, packGroups: newGroups }));
  };

  const toggleItemInGroup = (groupIndex: number, itemName: string) => {
      const group = editItem.packGroups?.[groupIndex];
      if (!group) return;

      const currentOptions = group.options || [];
      let newOptions;
      if (currentOptions.includes(itemName)) {
          newOptions = currentOptions.filter(o => o !== itemName);
      } else {
          newOptions = [...currentOptions, itemName];
      }
      updatePackGroup(groupIndex, 'options', newOptions);
  };

  const removePackGroup = (index: number) => {
      setEditItem(prev => ({
          ...prev,
          packGroups: prev.packGroups?.filter((_, i) => i !== index)
      }));
  };

  const handleAiImage = async () => {
     if (!editItem.name && !editItem.description) {
         toast('Please enter a name or description first.', 'warning');
         return;
     }
     
     setIsGeneratingImage(true);
     const prompt = `${editItem.name || 'BBQ Food'}. ${editItem.description || ''}. Authentic, delicious, professional food photography.`;
     const base64Image = await generateMarketingImage(prompt);
     
     if (base64Image) {
         // Compress the generated image to save space
         const compressed = await compressImage(base64Image);
         setEditItem(prev => ({ ...prev, image: compressed }));
     } else {
         toast('Could not generate image. Please check API key or try again.', 'error');
     }
     setIsGeneratingImage(false);
  };

  const [showStocktake, setShowStocktake] = useState(false);

  const handleSetStock = (itemId: string, stock: number | null) => {
    const item = menu.find(m => m.id === itemId);
    if (!item) return;
    updateMenuItem({ ...item, stock, available: stock === null || stock > 0 } as MenuItem);
  };

  const handleResetAllStock = () => {
    if (!window.confirm('Reset all stock levels? Items will be marked as available.')) return;
    menu.forEach(item => {
      if (item.stock != null || item.available === false) {
        updateMenuItem({ ...item, stock: null, available: true } as MenuItem);
      }
    });
    toast('All stock reset');
  };

  return (
    <div className="space-y-6">

      {/* STOCKTAKE — Quick stock level management */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        <button onClick={() => setShowStocktake(!showStocktake)}
          className="w-full flex justify-between items-center p-4 hover:bg-gray-800/80 transition">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-bbq-gold" />
            <span className="font-bold text-white">Day's Stocktake</span>
            <span className="text-xs text-gray-500">
              {menu.filter(m => m.stock != null && m.stock > 0).length} items stocked · {menu.filter(m => m.available === false || (m.stock != null && m.stock <= 0)).length} sold out
            </span>
          </div>
          {showStocktake ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showStocktake && (
          <div className="border-t border-gray-700 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">Set stock quantities for today's trade. Items hitting 0 are automatically marked sold out.</p>
              <button onClick={handleResetAllStock} className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition">
                Reset All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {menu.filter(m => !m.isCatering && m.category !== 'Catering' && m.category !== 'Catering Packs' && !(m.availableForCatering && m.cateringCategory)).map(item => (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${item.available === false || (item.stock != null && item.stock <= 0) ? 'bg-red-950/20 border-red-800/30' : 'bg-gray-900/50 border-gray-700'}`}>
                  <img src={item.image || PLACEHOLDER_IMG} alt="" className="w-8 h-8 rounded object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-500">{item.category} · ${item.price}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min={0}
                      value={item.stock ?? ''}
                      onChange={e => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                        handleSetStock(item.id, val);
                      }}
                      placeholder="∞"
                      className="w-16 bg-gray-800 border border-gray-700 rounded p-1.5 text-white text-sm text-center font-mono"
                      title="Stock quantity (blank = unlimited)"
                    />
                    {(item.stock != null && item.stock <= 0) && (
                      <span className="text-[9px] font-black text-red-400 uppercase">Out</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* GUIDE SECTION */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <button 
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex justify-between items-center text-blue-200 font-bold"
          >
              <span className="flex items-center gap-2"><HelpCircle size={18}/> Menu Management Guide</span>
              {showGuide ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </button>
          
          {showGuide && (
              <div className="mt-4 text-sm text-gray-300 space-y-4 animate-in fade-in">
                  <div>
                      <h5 className="font-bold text-white mb-1">1. Adding Basic Items</h5>
                      <p>Click "Add Item". Fill in Name, Price, and Description. Use the AI wand to auto-generate an image.</p>
                  </div>
                  <div>
                      <h5 className="font-bold text-white mb-1">2. Creating Family Packs</h5>
                      <p>Check the <strong>"This is a Pack"</strong> box. A pack acts as a "Parent" item (e.g. "Family Feast $80").</p>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-400">
                          <li>Click <strong>"+ Add Choice Group"</strong> to define a selection area (e.g., "Choose 2 Burgers").</li>
                          <li>Set the <strong>Limit</strong> (e.g. 2).</li>
                          <li>Click <strong>"+ Add Items"</strong> inside the group to open the Picker.</li>
                          <li>Check the boxes of existing menu items (e.g., "OG Burger", "Pulled Pork Burger") to allow them in this group.</li>
                          <li>Repeat for other groups (e.g. "Choose 2 Sides").</li>
                      </ul>
                  </div>
                  <div>
                      <h5 className="font-bold text-white mb-1">3. Availability</h5>
                      <p><strong>Everyday:</strong> Item appears on the general menu and all cook days.</p>
                      <p><strong>Specific Date:</strong> Item only appears when the user selects that specific date in the menu calendar.</p>
                  </div>
              </div>
          )}
      </div>

      <div className="flex justify-between items-center border-b border-gray-700 pb-2 flex-wrap gap-2">
        <h3 className="text-xl font-bold">Menu Items</h3>
        <div className="flex gap-2">
          <SquareCatalogSyncButton />
          <button
            onClick={() => { setIsEditing(true); setEditItem({ availabilityType: 'everyday', isPack: false, packGroups: [] }); }}
            className="bg-bbq-red px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-red-700"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {isEditing && (
        <form onSubmit={handleSave} className="bg-gray-900 p-4 rounded-lg space-y-4 border border-gray-700 animate-in slide-in-from-top-4">
          <h4 className="font-bold text-lg">{editItem.id ? 'Edit Item' : 'New Item'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
                <input 
                  placeholder="Name" 
                  value={editItem.name || ''} 
                  onChange={e => setEditItem({...editItem, name: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" 
                  required
                />
                
                <div className="flex gap-2">
                    <input 
                      type="number"
                      placeholder="Price" 
                      value={editItem.price || ''} 
                      onChange={e => setEditItem({...editItem, price: parseFloat(e.target.value)})}
                      className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1" 
                      required
                    />
                    <select
                       value={editItem.category || 'Meats'}
                       onChange={e => setEditItem({...editItem, category: e.target.value as any})}
                       className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1"
                    >
                      <option value="Meats">Meats</option>
                      <option value="Burgers">Burgers</option>
                      <option value="Sides">Sides</option>
                      <option value="Platters">Platters</option>
                      <option value="Drinks">Drinks</option>
                      <option value="Bulk Meats">Bulk Meats</option>
                      <option value="Family Packs">Family Packs</option>
                      <option value="Hot Sides">Hot Sides</option>
                      <option value="Cold Sides">Cold Sides</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Service">Service</option>
                      <option value="Rubs & Sauces">Rubs & Sauces</option>
                      <option value="Merch">Merch</option>
                    </select>
                </div>

                <div className="flex gap-2">
                    <input 
                      placeholder="Unit (e.g. kg, ea)" 
                      value={editItem.unit || ''} 
                      onChange={e => setEditItem({...editItem, unit: e.target.value})}
                      className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1 text-sm" 
                    />
                    <input 
                      type="number"
                      placeholder="Min Qty (MOQ)" 
                      value={editItem.minQuantity || ''} 
                      onChange={e => setEditItem({...editItem, minQuantity: parseInt(e.target.value)})}
                      className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1 text-sm" 
                    />
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="flex gap-2">
                     <input 
                      placeholder="Image URL (or use AI wand)" 
                      value={editItem.image || ''} 
                      onChange={e => setEditItem({...editItem, image: e.target.value})}
                      className="bg-gray-800 border border-gray-700 rounded p-2 text-white flex-1" 
                    />
                    <button 
                        type="button" 
                        onClick={handleAiImage}
                        disabled={isGeneratingImage}
                        className="bg-bbq-gold text-black p-2 rounded hover:bg-yellow-500 disabled:opacity-50"
                        title="Generate with AI"
                    >
                        {isGeneratingImage ? <Loader2 className="animate-spin" size={20}/> : <Wand2 size={20} />}
                    </button>
                </div>
                {editItem.image && (
                    <div className="w-full h-32 rounded overflow-hidden border border-gray-700">
                        <img src={editItem.image} alt="Preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }} />
                    </div>
                )}
            </div>
          </div>

          <textarea 
            placeholder="Description (Serving Sizes etc.)" 
            value={editItem.description || ''}
            onChange={e => setEditItem({...editItem, description: e.target.value})}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"
            rows={3}
          />
          
          {/* CATERING & BUILD YOUR OWN CONFIGURATION */}
          <div className="bg-black/20 p-4 rounded border border-gray-700">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={editItem.availableForCatering || false}
                    onChange={e => setEditItem({...editItem, availableForCatering: e.target.checked})}
                    className="rounded text-bbq-red focus:ring-bbq-red w-5 h-5"
                  />
                  <span className="font-bold text-white flex items-center gap-2 text-lg"><ChefHat size={20}/> Available for Catering & Build Your Own</span>
              </label>
              
              {editItem.availableForCatering && (
                  <div className="mt-4 pl-4 border-l-2 border-bbq-red space-y-4 animate-in fade-in">
                      <div className="bg-gray-800/50 p-3 rounded">
                          <label className="block text-sm font-bold text-white mb-1">Catering Category (for Package Limits)</label>
                          <p className="text-xs text-gray-400 mb-2">Determines if this item counts towards a "Meat" or "Side" limit in fixed packages. Select 'Extra' if it's only for Build Your Own.</p>
                          <select
                            value={editItem.cateringCategory || 'Meat'}
                            onChange={e => setEditItem({...editItem, cateringCategory: e.target.value as any})}
                            className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm w-full"
                          >
                              <option value="Meat">Meat (Counts towards Meat Limit)</option>
                              <option value="Side">Side (Counts towards Side Limit)</option>
                              <option value="Extra">Extra / Add-on (Not in Packages)</option>
                              <option value="Drink">Drink (Not in Packages)</option>
                              <option value="Dessert">Dessert (Not in Packages)</option>
                          </select>
                      </div>

                      <div className="bg-gray-800/50 p-3 rounded">
                          <label className="block text-sm font-bold text-white mb-1">Minimum Order Quantity (MOQ)</label>
                          <p className="text-xs text-gray-400 mb-2">Required minimum amount for "Build Your Own" orders (e.g. 10 burgers).</p>
                          <div className="flex items-center gap-2">
                              <input 
                                  type="number"
                                  min="1"
                                  placeholder="e.g. 10"
                                  value={editItem.moq || ''}
                                  onChange={e => setEditItem({...editItem, moq: parseInt(e.target.value) || 1})}
                                  className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm w-24 text-center font-bold"
                              />
                              <span className="text-sm text-gray-400">units</span>
                          </div>
                      </div>
                  </div>
              )}
          </div>

          {/* PACK CONFIGURATION */}
          <div className="bg-black/20 p-3 rounded border border-gray-700">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={editItem.isPack || false}
                    onChange={e => setEditItem({...editItem, isPack: e.target.checked})}
                    className="rounded text-bbq-red focus:ring-bbq-red"
                  />
                  <span className="font-bold text-white flex items-center gap-1"><Package size={16}/> This is a "Pack" (Requires Selections)</span>
              </label>
              
              {editItem.isPack && (
                  <div className="space-y-3 mt-2 pl-4 border-l-2 border-bbq-red">
                      <p className="text-xs text-gray-400">Define the choice groups. e.g. "Select 2 Burgers", "Select 1 Side".</p>
                      {editItem.packGroups?.map((group, idx) => (
                          <div key={idx} className="bg-gray-800 p-3 rounded border border-gray-700">
                              <div className="flex gap-2 items-center mb-3">
                                  <input 
                                    placeholder="Group Name (e.g. Burgers)"
                                    value={group.name}
                                    onChange={e => updatePackGroup(idx, 'name', e.target.value)}
                                    className="bg-gray-700 border border-gray-600 rounded p-2 text-white text-xs flex-1 font-bold"
                                  />
                                  <div className="flex items-center gap-2 bg-gray-700 px-2 rounded border border-gray-600">
                                      <span className="text-[10px] text-gray-400 uppercase font-bold">Limit:</span>
                                      <input 
                                        type="number"
                                        value={group.limit}
                                        onChange={e => updatePackGroup(idx, 'limit', parseInt(e.target.value))}
                                        className="bg-transparent w-8 p-1 text-white text-xs text-center outline-none"
                                      />
                                  </div>
                                  <button type="button" onClick={() => removePackGroup(idx)} className="text-red-400 hover:text-red-300 ml-2"><Trash2 size={16}/></button>
                              </div>

                              {/* Selected Options Tags */}
                              <div className="flex flex-wrap gap-2 mb-3">
                                  {group.options.map(opt => (
                                      <span key={opt} className="bg-bbq-red text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                          {opt} <button type="button" onClick={() => toggleItemInGroup(idx, opt)}><Trash2 size={10}/></button>
                                      </span>
                                  ))}
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveGroupIndex(activeGroupIndex === idx ? null : idx)}
                                    className="bg-gray-700 text-gray-300 hover:text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                                  >
                                      <Plus size={10}/> Add Items
                                  </button>
                              </div>

                              {/* Item Picker (Accordion Style) */}
                              {activeGroupIndex === idx && (
                                  <div className="bg-gray-900 border border-gray-600 rounded p-3 mt-2 animate-in fade-in">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="text-xs font-bold text-gray-400 uppercase">Select items allowed in this group:</span>
                                          <button type="button" onClick={() => setActiveGroupIndex(null)} className="text-gray-500 hover:text-white"><ChevronUp size={16}/></button>
                                      </div>
                                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                          {Object.entries(itemsByCategory).map(([catName, items]: [string, MenuItem[]]) => (
                                              <div key={catName}>
                                                  <div className="text-[10px] font-bold text-bbq-gold uppercase bg-black/20 px-2 py-1 mb-1 rounded">{catName}</div>
                                                  <div className="grid grid-cols-2 gap-1">
                                                      {items.map(m => {
                                                          const isSelected = group.options.includes(m.name);
                                                          return (
                                                              <div 
                                                                key={m.id} 
                                                                onClick={() => toggleItemInGroup(idx, m.name)}
                                                                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition ${isSelected ? 'bg-green-900/30 text-green-300' : 'hover:bg-gray-800 text-gray-400'}`}
                                                              >
                                                                  {isSelected ? <CheckSquare size={12}/> : <Square size={12}/>}
                                                                  <span className="truncate">{m.name}</span>
                                                              </div>
                                                          );
                                                      })}
                                                  </div>
                                              </div>
                                          ))}
                                          
                                          {/* Manual Add Fallback */}
                                          <div className="pt-2 mt-2 border-t border-gray-700">
                                              <label className="text-[10px] text-gray-500 block mb-1">Or add custom option manually:</label>
                                              <div className="flex gap-2">
                                                  <input 
                                                    id={`manual-opt-${idx}`}
                                                    placeholder="e.g. Napkins"
                                                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                                  />
                                                  <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const input = document.getElementById(`manual-opt-${idx}`) as HTMLInputElement;
                                                        if (input.value) {
                                                            toggleItemInGroup(idx, input.value);
                                                            input.value = '';
                                                        }
                                                    }}
                                                    className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
                                                  >Add</button>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))}
                      <button type="button" onClick={addPackGroup} className="w-full py-2 border border-dashed border-gray-600 rounded text-xs font-bold text-bbq-gold hover:bg-gray-800 transition">+ Add Choice Group</button>
                  </div>
              )}
          </div>

          {/* Availability Configuration */}
          <div className="bg-black/20 p-3 rounded border border-gray-700">
             <label className="block text-sm font-bold mb-2">Availability</label>
             <div className="flex gap-4">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="radio" 
                   name="availability" 
                   checked={editItem.availabilityType === 'everyday'}
                   onChange={() => setEditItem({...editItem, availabilityType: 'everyday'})}
                   className="text-bbq-red focus:ring-bbq-red"
                 />
                 <span className="text-sm">Everyday Menu</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="radio" 
                   name="availability" 
                   checked={editItem.availabilityType === 'specific_date'}
                   onChange={() => setEditItem({...editItem, availabilityType: 'specific_date'})}
                   className="text-bbq-red focus:ring-bbq-red"
                 />
                 <span className="text-sm">Specific Date Only</span>
               </label>
             </div>
             {editItem.availabilityType === 'specific_date' && (
               <div className="mt-3">
                 <label className="text-xs text-gray-400 font-bold mb-1 block">Select Order Dates (from Planner)</label>
                 <div className="max-h-40 overflow-y-auto border border-gray-700 rounded p-2 bg-gray-800 space-y-1 custom-scrollbar">
                   {orderDays.length === 0 ? (
                       <div className="text-xs text-gray-500 italic">No Order days scheduled in Planner.</div>
                   ) : (
                       orderDays.map(evt => {
                        const currentDates = editItem.specificDates || (editItem.specificDate ? [editItem.specificDate] : []);
                        const isSelected = currentDates.includes(evt.date);
                        
                        return (
                        <label key={evt.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-1 rounded transition">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                                let newDates = [...currentDates];
                                if (e.target.checked) {
                                    newDates.push(evt.date);
                                } else {
                                    newDates = newDates.filter(d => d !== evt.date);
                                }
                                setEditItem({
                                    ...editItem, 
                                    specificDates: newDates,
                                    specificDate: newDates.length > 0 ? newDates[0] : undefined // Legacy support
                                });
                            }}
                            className="rounded text-bbq-red focus:ring-bbq-red bg-gray-900 border-gray-600"
                          />
                          <span className="text-xs text-white">
                             {parseLocalDate(evt.date).toLocaleDateString()} - {evt.location} ({evt.title})
                          </span>
                        </label>
                        );
                       })
                   )}
                 </div>
                 <p className="text-[10px] text-gray-500 mt-1">Select all dates this item should appear on.</p>
               </div>
             )}
             <p className="text-[10px] text-gray-500 mt-2 italic">
                 Note: Items marked "Everyday" will also appear on specific cook dates automatically.
             </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-bbq-red rounded font-bold">Save Item</button>
          </div>
        </form>
      )}

      <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-3 flex items-start gap-2 text-xs text-blue-200/80">
        <Info size={14} className="text-blue-400 shrink-0 mt-0.5"/>
        <span>
          Catering items (meats, sides, desserts flagged for catering) aren't shown here — manage those from the <strong>Catering</strong> tab.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {menu.filter(m =>
          !m.isCatering &&
          m.category !== 'Catering' &&
          m.category !== 'Catering Packs' &&
          !(m.availableForCatering && m.cateringCategory)
        ).map(item => (
          <div key={item.id} className={`flex justify-between items-center p-4 rounded-lg border ${item.available === false ? 'bg-red-950/20 border-red-800/40 opacity-70' : 'bg-gray-800/50 border-gray-700'}`}>
            <div className="flex items-center gap-4">
              <div className="relative">
                <img src={item.image || PLACEHOLDER_IMG} alt={item.name} className="w-12 h-12 rounded object-cover" onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }} />
                {item.available === false && <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center"><span className="text-[8px] font-black text-red-400 uppercase">Sold Out</span></div>}
              </div>
              <div>
                <div className="font-bold flex items-center gap-2">
                    {item.name}
                    {item.isPack && <span className="text-[10px] bg-purple-900 text-purple-200 px-1 rounded border border-purple-500">PACK</span>}
                    {item.available === false && <span className="text-[10px] bg-red-900 text-red-200 px-1.5 py-0.5 rounded border border-red-600">SOLD OUT</span>}
                </div>
                <div className="text-sm text-gray-400">
                    ${item.price} • {item.category}
                    {item.minQuantity && item.minQuantity > 1 && <span className="text-xs text-yellow-500 ml-2">(Min: {item.minQuantity})</span>}
                </div>
                {item.availabilityType === 'specific_date' && (
                  <div className="text-xs text-bbq-gold flex items-center gap-1 mt-1">
                    <Calendar size={12} /> Only: {item.specificDates && item.specificDates.length > 0 
                        ? item.specificDates.map(d => parseLocalDate(d).toLocaleDateString()).join(', ')
                        : (item.specificDate ? parseLocalDate(item.specificDate).toLocaleDateString() : 'N/A')}
                  </div>
                )}
                {item.availabilityType === 'everyday' && (
                    <div className="text-[10px] text-green-400 mt-1">Available Everyday</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateMenuItem({ ...item, available: item.available === false ? true : false })}
                className={`p-2 rounded transition ${item.available === false ? 'text-red-400 hover:text-green-400 bg-red-900/20' : 'text-green-400 hover:text-red-400'}`}
                title={item.available === false ? 'Mark as available' : 'Mark as sold out'}
              >
                {item.available === false ? <Package size={18} /> : <CheckSquare size={18} />}
              </button>
              <button
                onClick={() => { setIsEditing(true); setEditItem(item); }}
                className="p-2 text-gray-400 hover:text-white"
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={() => { if (window.confirm(`Delete "${item.name}"? This cannot be undone.`)) deleteMenuItem(item.id); }}
                className="p-2 text-red-500 hover:text-red-300 hover:bg-red-900/30 rounded"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuManager;
