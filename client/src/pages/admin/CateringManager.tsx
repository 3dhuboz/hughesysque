import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { CateringPackage, CocktailTier, FunctionTier } from '../../types';
import { Plus, Trash2, Edit2, Save, X, Wand2, Loader2, Coffee, UtensilsCrossed, ChefHat, Package as PackageIcon, Info, Sparkles, ChevronUp, ChevronDown, Drumstick, Salad, Zap, GripVertical } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ── Shared list editor components used across Self Service lists ── */

type Accent = 'red' | 'green' | 'gold' | 'blue';
const accentMap: Record<Accent, { text: string; dot: string; border: string; gradient: string; ring: string }> = {
  red:   { text: 'text-bbq-red',     dot: 'bg-bbq-red',     border: 'hover:border-bbq-red/50',     gradient: 'from-red-950/40 to-transparent',     ring: 'focus-within:ring-bbq-red/30' },
  green: { text: 'text-green-400',   dot: 'bg-green-500',   border: 'hover:border-green-700/50',   gradient: 'from-green-950/40 to-transparent',   ring: 'focus-within:ring-green-500/30' },
  gold:  { text: 'text-bbq-gold',    dot: 'bg-bbq-gold',    border: 'hover:border-bbq-gold/50',    gradient: 'from-amber-950/40 to-transparent',   ring: 'focus-within:ring-bbq-gold/30' },
  blue:  { text: 'text-blue-400',    dot: 'bg-blue-500',    border: 'hover:border-blue-700/50',    gradient: 'from-blue-950/40 to-transparent',    ring: 'focus-within:ring-blue-500/30' },
};

/* Items in a sortable list must have a stable string id. For our plain
   string[] and {name,surcharge}[] lists we generate synthetic ids
   based on list-index + content and keep them alongside the data. */
type Keyed = { __key: string; value: any };
const useKeyed = (items: any[]) => {
  // Re-key whenever length changes — a simpler, acceptable heuristic
  // for lists this small. Stable identity isn't required across renders
  // because we commit the reorder immediately on drop.
  return React.useMemo(
    () => items.map((value, i) => ({ __key: `row-${i}-${typeof value === 'string' ? value : (value?.name ?? '')}`, value } as Keyed)),
    [items]
  );
};

const ListEditor: React.FC<{
  accent: Accent;
  title: string;
  unit: string;
  count: number;
  addLabel: string;
  items: any[];
  onAdd: () => void;
  onReorder: (from: number, to: number) => void;
  renderItem: (item: any, index: number) => React.ReactNode;
}> = ({ accent, title, unit, count, addLabel, items, onAdd, onReorder, renderItem }) => {
  const a = accentMap[accent];
  const keyed = useKeyed(items);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor,{ coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = keyed.findIndex(k => k.__key === active.id);
    const to   = keyed.findIndex(k => k.__key === over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-gray-900/60 to-gray-950/60 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-8 rounded-full ${a.dot}`}/>
          <div>
            <h5 className={`text-lg font-display font-bold ${a.text} uppercase tracking-wider leading-none`}>{title}</h5>
            <p className="text-[11px] text-gray-500 mt-1">{unit} · drag to reorder</p>
          </div>
        </div>
        <span className="text-xs text-gray-500 font-bold bg-gray-900 border border-gray-800 rounded-full px-3 py-1">{count}</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={keyed.map(k => k.__key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {keyed.map((k, i) => (
              <SortableRow key={k.__key} id={k.__key}>
                {renderItem(k.value, i)}
              </SortableRow>
            ))}
            {items.length === 0 && (
              <div className="text-center py-8 text-gray-600 text-sm italic">No items yet — hit the button below to add one.</div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <button type="button" onClick={onAdd}
        className={`mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-800 ${a.border} ${a.text} text-gray-500 hover:${a.text} rounded-xl text-sm font-bold transition group`}>
        <Plus size={14} className="group-hover:rotate-90 transition-transform"/> {addLabel}
      </button>
    </div>
  );
};

/* Wraps a row with @dnd-kit sortable hooks + exposes drag-handle props
   to its child through React context so the handle sits inside the card
   rather than overlaying it. */
const DragHandleContext = React.createContext<{
  listeners: any;
  attributes: any;
  isDragging: boolean;
} | null>(null);

const SortableRow: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'shadow-[0_12px_40px_-10px_rgba(0,0,0,0.8)]' : ''}>
      <DragHandleContext.Provider value={{ listeners, attributes, isDragging }}>
        {children}
      </DragHandleContext.Provider>
    </div>
  );
};

const DragHandle: React.FC<{ accent: Accent }> = ({ accent }) => {
  const ctx = React.useContext(DragHandleContext);
  const a = accentMap[accent];
  return (
    <button type="button"
      aria-label="Drag to reorder"
      {...(ctx?.attributes ?? {})}
      {...(ctx?.listeners ?? {})}
      className={`shrink-0 p-1.5 -ml-1 rounded text-gray-600 hover:${a.text} hover:bg-white/5 cursor-grab active:cursor-grabbing touch-none transition`}>
      <GripVertical size={14}/>
    </button>
  );
};

/* Upload / paste URL / AI-generate image field used by Cocktail + Function tier editors. */
const ImageField: React.FC<{
  label: string;
  value?: string;
  onChange: (v: string) => void;
  isGenerating?: boolean;
  onGenerate?: () => void;
}> = ({ label, value, onChange, isGenerating, onGenerate }) => {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const onFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(f);
  };
  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-400 block">{label}</label>
      <div className="flex items-stretch gap-2 flex-wrap">
        <div className="w-24 h-24 rounded-lg border border-gray-700 bg-gray-950 overflow-hidden shrink-0 flex items-center justify-center relative group">
          {value ? (
            <>
              <img src={value} className="w-full h-full object-cover" alt="preview"/>
              <button type="button" onClick={() => onChange('')}
                className="absolute inset-0 bg-black/70 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition font-bold text-xs">
                <Trash2 size={14} className="mr-1"/> Remove
              </button>
            </>
          ) : (
            <span className="text-[10px] text-gray-600 text-center px-2">No image</span>
          )}
        </div>
        <div className="flex-1 min-w-[200px] space-y-2">
          <input placeholder="Paste image URL…" value={value && !value.startsWith('data:') ? value : ''}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm"/>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex-1 bg-gray-800 border border-gray-700 hover:border-gray-500 text-white rounded p-2 text-xs font-bold flex items-center justify-center gap-1.5"><Plus size={14}/> Upload</button>
            {onGenerate && (
              <button type="button" onClick={onGenerate} disabled={isGenerating}
                className="flex-1 bg-purple-900/60 border border-purple-700 hover:bg-purple-800 text-purple-100 rounded p-2 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                {isGenerating ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} AI Generate
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files?.[0] ?? null)}/>
        </div>
      </div>
    </div>
  );
};

const ItemCard: React.FC<{
  accent: Accent;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onDelete: () => void;
  extra?: React.ReactNode;
}> = ({ accent, value, placeholder, onChange, onDelete, extra }) => {
  const a = accentMap[accent];
  return (
    <div className={`group relative flex items-center gap-2 bg-gray-900/70 border border-gray-800 ${a.border} rounded-xl p-2 pr-2 transition-all ${a.ring} focus-within:ring-2`}>
      <DragHandle accent={accent}/>
      <div className={`shrink-0 w-1 h-8 rounded-full ${a.dot} opacity-50 group-hover:opacity-100 transition`}/>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-white text-sm px-1 py-1.5 focus:outline-none placeholder:text-gray-600"
      />
      {extra}
      <button type="button" onClick={onDelete}
        className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition opacity-0 group-hover:opacity-100" title="Delete"><Trash2 size={13}/></button>
    </div>
  );
};
import { generateMarketingImage, generateCateringDescription } from '../../services/gemini';

// Helper to compress base64 images
const compressImage = (base64Str: string, maxWidth = 800, quality = 0.6) => {
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

type AdminTab = 'packages' | 'self-service' | 'cocktail' | 'function';

const CateringManager: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('packages');

  const tabs: { id: AdminTab; label: string; Icon: any }[] = [
    { id: 'packages',     label: 'Feasting Packages', Icon: PackageIcon },
    { id: 'self-service', label: 'Self Service',      Icon: ChefHat },
    { id: 'cocktail',     label: 'Cocktail Menu',     Icon: Coffee },
    { id: 'function',     label: 'Function Menu',     Icon: UtensilsCrossed },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-700 pb-2">
        <h3 className="text-xl font-bold text-white mb-3">Catering Manager</h3>
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-bold text-sm transition ${activeTab === id ? 'bg-bbq-red text-white' : 'text-gray-400 hover:text-white bg-gray-800/50'}`}>
              <Icon size={14}/> {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'packages'     && <PackagesEditor settings={settings} updateSettings={updateSettings} toast={toast}/>}
      {activeTab === 'self-service' && <SelfServiceEditor settings={settings} updateSettings={updateSettings} toast={toast}/>}
      {activeTab === 'cocktail'     && <CocktailTiersEditor settings={settings} updateSettings={updateSettings} toast={toast}/>}
      {activeTab === 'function'     && <FunctionTiersEditor settings={settings} updateSettings={updateSettings} toast={toast}/>}
    </div>
  );
};

/* ─────────────────────────── FEASTING PACKAGES ─────────────────────────── */

const PackagesEditor: React.FC<{ settings: any; updateSettings: any; toast: any }> = ({ settings, updateSettings, toast }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editPkg, setEditPkg] = useState<Partial<CateringPackage>>({});
  const [isGenerating, setIsGenerating] = useState<'image' | 'desc' | null>(null);

  const packages = settings.cateringPackages || [];

  const handleAiGenerate = async (type: 'image' | 'desc') => {
    if (!editPkg.name) { toast('Please enter a package name first.', 'warning'); return; }
    setIsGenerating(type);
    if (type === 'image') {
      const prompt = `${editPkg.name} BBQ catering spread. ${editPkg.description || ''}. Buffet style, professional food photography, delicious, abundant.`;
      const img = await generateMarketingImage(prompt);
      if (img) { const compressed = await compressImage(img); setEditPkg(prev => ({ ...prev, image: compressed })); }
    } else {
      const desc = await generateCateringDescription(editPkg.name, { meats: editPkg.meatLimit || 2, sides: editPkg.sideLimit || 2 });
      if (desc) setEditPkg(prev => ({ ...prev, description: desc }));
    }
    setIsGenerating(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPkg.name || !editPkg.price) return;
    let imageToSave = editPkg.image;
    if (imageToSave && imageToSave.startsWith('data:image')) {
      try { imageToSave = await compressImage(imageToSave); } catch (err) { console.error('Compression failed', err); }
    }
    const pkgToSave = { ...editPkg, image: imageToSave };
    let newPackages = [...packages];
    if (editPkg.id) newPackages = newPackages.map((p: CateringPackage) => p.id === editPkg.id ? pkgToSave as CateringPackage : p);
    else newPackages.push({ ...pkgToSave, id: `pkg_${Date.now()}` } as CateringPackage);
    const success = await updateSettings({ cateringPackages: newPackages });
    if (success) { toast(editPkg.id ? 'Package updated!' : 'Package created!'); setIsEditing(false); setEditPkg({}); }
    else toast('Failed to save package.', 'error');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this package?')) return;
    await updateSettings({ cateringPackages: packages.filter((p: CateringPackage) => p.id !== id) });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-lg font-bold text-white">Feasting Packages</h4>
          <p className="text-xs text-gray-500">Per-head packages shown under the 'Feasting Table' section on the storefront.</p>
        </div>
        <button onClick={() => { setIsEditing(true); setEditPkg({ minPax: 10, meatLimit: 2, sideLimit: 2 }); }}
          className="bg-bbq-red px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-red-700 text-white">
          <Plus size={16}/> Add Package
        </button>
      </div>

      {isEditing && (
        <form onSubmit={handleSave} className="bg-gray-900 p-6 rounded-lg border border-gray-700 space-y-4">
          <h4 className="font-bold text-lg text-white">{editPkg.id ? 'Edit Package' : 'New Package'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <input placeholder="Package Name" value={editPkg.name || ''} onChange={e => setEditPkg({...editPkg, name: e.target.value})}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" required/>
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs text-gray-400 block mb-1">Price Per Head</label>
                  <input type="number" value={editPkg.price || ''} onChange={e => setEditPkg({...editPkg, price: parseFloat(e.target.value)})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" required/></div>
                <div className="flex-1"><label className="text-xs text-gray-400 block mb-1">Min Pax</label>
                  <input type="number" value={editPkg.minPax || ''} onChange={e => setEditPkg({...editPkg, minPax: parseInt(e.target.value)})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" required/></div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-xs text-gray-400 block mb-1">Meat Choices</label>
                  <input type="number" value={editPkg.meatLimit || ''} onChange={e => setEditPkg({...editPkg, meatLimit: parseInt(e.target.value)})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" required/></div>
                <div className="flex-1"><label className="text-xs text-gray-400 block mb-1">Side Choices</label>
                  <input type="number" value={editPkg.sideLimit || ''} onChange={e => setEditPkg({...editPkg, sideLimit: parseInt(e.target.value)})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" required/></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <textarea placeholder="Description" value={editPkg.description || ''} onChange={e => setEditPkg({...editPkg, description: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white h-24 pr-10" required/>
                <button type="button" onClick={() => handleAiGenerate('desc')} disabled={!!isGenerating} title="AI Generate"
                  className="absolute top-2 right-2 text-bbq-gold hover:text-white p-1 rounded bg-black/50">
                  {isGenerating === 'desc' ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>}
                </button>
              </div>
              <div className="flex gap-2">
                <input placeholder="Image URL" value={editPkg.image || ''} onChange={e => setEditPkg({...editPkg, image: e.target.value})}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-white"/>
                <button type="button" onClick={() => handleAiGenerate('image')} disabled={!!isGenerating} title="Generate Image"
                  className="bg-bbq-gold text-black p-2 rounded hover:bg-yellow-500 disabled:opacity-50">
                  {isGenerating === 'image' ? <Loader2 size={20} className="animate-spin"/> : <Sparkles size={20}/>}
                </button>
              </div>
              {editPkg.image && <div className="h-24 rounded overflow-hidden border border-gray-700"><img src={editPkg.image} className="w-full h-full object-cover" alt="Preview"/></div>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
            <button type="button" onClick={() => { setIsEditing(false); setEditPkg({}); }} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-bbq-red text-white rounded font-bold flex items-center gap-2"><Save size={16}/> Save Package</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg: CateringPackage) => (
          <div key={pkg.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group">
            <div className="h-40 relative">
              <img src={pkg.image} className="w-full h-full object-cover" alt={pkg.name}/>
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition"/>
              <div className="absolute top-2 right-2 flex gap-2">
                <button onClick={() => { setEditPkg(pkg); setIsEditing(true); }} className="p-2 bg-black/50 text-white rounded hover:bg-bbq-gold hover:text-black transition"><Edit2 size={16}/></button>
                <button onClick={() => handleDelete(pkg.id)} className="p-2 bg-black/50 text-red-400 rounded hover:bg-red-600 hover:text-white transition"><Trash2 size={16}/></button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-white text-lg">{pkg.name}</h4>
                <span className="text-bbq-gold font-bold">${pkg.price}<span className="text-xs text-gray-500">/pp</span></span>
              </div>
              <p className="text-gray-400 text-xs mb-4 line-clamp-2">{pkg.description}</p>
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

/* ─────────────────────────── SELF SERVICE LISTS ─────────────────────────── */

const SelfServiceEditor: React.FC<{ settings: any; updateSettings: any; toast: any }> = ({ settings, updateSettings, toast }) => {
  const defaultMeats = ['Sliced Brisket','Pulled Brisket','Pulled Pork','Pulled Lamb','Beef Ribs *','Pork Ribs *','Beef Cheeks','Chicken Thighs (Bone-in)','Chicken Lollipops','Chicken Wing Nibbles','Smoked Sausages / Hot Links','Pork Belly *','Lamb Shanks','Pork Belly Burnt Ends'];
  const defaultSides = ['Potato Bake','Mac N Cheese','HQ Slaw','BBQ Pit Beans','Potato Salad','Corn Elote Pasta Salad','Corn Pasta Salad','Smoked Corn Elote Salad','Corn on the Cob (Cobettes)','Texas Caviar Salad','Caesar Salad','Fire Kissed Green Beans & Charred Lime Salad','Texas Style Pit Roasted Pumpkin & Beetroot Salad'];
  const defaultBullets = [
    'We set your event up as a shared feasting table so guests can dig in and help themselves.',
    'Meats are presented in heated bain-maries, sides in serving bowls alongside.',
    'We arrive ~12 hours before service to begin cooking. Full set up, top-ups, and pack-down included.',
    'Plates, cutlery, napkins, sliced bread or tortillas all provided.',
  ];

  // Split name + surcharge flag on load so we can present a checkbox instead of forcing Macca to type ' *'
  const parseMeat = (s: string) => ({ name: s.replace(/\s*\*\s*$/, '').trim(), surcharge: /\*\s*$/.test(s) });
  const toMeatString = (m: { name: string; surcharge: boolean }) => m.surcharge ? `${m.name} *` : m.name;

  const [meats, setMeats] = useState<Array<{ name: string; surcharge: boolean }>>(
    (settings.cateringSelfServiceMeats?.length ? settings.cateringSelfServiceMeats : defaultMeats).map(parseMeat)
  );
  const [sides, setSides] = useState<string[]>(
    settings.cateringSelfServiceSides?.length ? settings.cateringSelfServiceSides : defaultSides
  );
  const [bullets, setBullets] = useState<string[]>(
    settings.feastingTableInfo?.bullets?.length ? settings.feastingTableInfo.bullets : defaultBullets
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateSettings({
      cateringSelfServiceMeats: meats.filter(m => m.name.trim()).map(toMeatString),
      cateringSelfServiceSides: sides.filter(s => s.trim()),
      feastingTableInfo: { bullets: bullets.filter(b => b.trim()) },
    });
    setIsSaving(false);
    if (success) { toast('Self service lists saved!'); setIsDirty(false); } else toast('Failed to save.', 'error');
  };

  const resetToDefaults = () => {
    if (!window.confirm('Reset all Self Service lists to the Hughesey Que defaults?')) return;
    setMeats(defaultMeats.map(parseMeat));
    setSides([...defaultSides]);
    setBullets([...defaultBullets]);
    markDirty();
  };

  const moveItem = (arr: any[], setter: any, from: number, to: number) => {
    if (to < 0 || to >= arr.length) return;
    const next = [...arr];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setter(next);
    markDirty();
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER CARD ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-950 to-black border border-gray-800 p-6 md:p-7">
        <div aria-hidden className="absolute -top-10 -right-10 w-48 h-48 bg-bbq-red/20 rounded-full blur-3xl pointer-events-none"/>
        <div aria-hidden className="absolute -bottom-10 -left-10 w-48 h-48 bg-bbq-gold/15 rounded-full blur-3xl pointer-events-none"/>
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-bbq-red to-red-900 flex items-center justify-center shadow-lg shrink-0">
              <ChefHat size={22} className="text-white"/>
            </div>
            <div>
              <h4 className="text-xl font-display font-bold text-white">Self Service & Feasting Table</h4>
              <p className="text-sm text-gray-400 mt-0.5 max-w-xl">Drives the 'Build Your Self Service Order' counters and the 'How We Set Up' bullets on the public catering page.</p>
              <div className="flex gap-4 mt-3 text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-bbq-red"><span className="w-1.5 h-1.5 rounded-full bg-bbq-red"/> {meats.length} meat{meats.length === 1 ? '' : 's'}</span>
                <span className="flex items-center gap-1.5 text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400"/> {sides.length} side{sides.length === 1 ? '' : 's'}</span>
                <span className="flex items-center gap-1.5 text-bbq-gold"><span className="w-1.5 h-1.5 rounded-full bg-bbq-gold"/> {bullets.length} bullet{bullets.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetToDefaults} className="px-3 py-2 text-gray-400 hover:text-white text-xs hover:bg-white/5 rounded-lg transition">Reset to defaults</button>
            <button onClick={handleSave} disabled={isSaving || !isDirty}
              className={`group relative px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all overflow-hidden ${
                !isDirty ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-bbq-red via-red-600 to-orange-500 text-white hover:shadow-[0_0_24px_rgba(239,68,68,0.5)] hover:scale-[1.02]'
              }`}>
              {isDirty && <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>}
              <span className="relative flex items-center gap-2">
                {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                {isDirty ? 'Save Changes' : 'Saved'}
                {isDirty && <span className="w-2 h-2 rounded-full bg-white animate-pulse"/>}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MEATS + SIDES side-by-side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* MEATS */}
        <ListEditor
          accent="red"
          title="Meats"
          unit="per kg"
          count={meats.length}
          addLabel="Add a meat"
          items={meats}
          onAdd={() => { setMeats([...meats, { name: '', surcharge: false }]); markDirty(); }}
          onReorder={(from, to) => moveItem(meats, setMeats, from, to)}
          renderItem={(m, i) => (
            <ItemCard
              accent="red"
              value={m.name}
              placeholder="e.g. Sliced Brisket"
              onChange={v => { setMeats(meats.map((x, xi) => xi === i ? { ...x, name: v } : x)); markDirty(); }}
              onDelete={() => { setMeats(meats.filter((_, xi) => xi !== i)); markDirty(); }}
              extra={
                <button type="button" onClick={() => { setMeats(meats.map((x, xi) => xi === i ? { ...x, surcharge: !x.surcharge } : x)); markDirty(); }}
                  title="Toggle +$4/pp surcharge"
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition ${m.surcharge ? 'bg-bbq-gold text-black border-bbq-gold shadow-[0_0_12px_rgba(251,191,36,0.3)]' : 'bg-transparent text-gray-500 border-gray-700 hover:border-bbq-gold/60 hover:text-bbq-gold/60'}`}>
                  +$4/pp
                </button>
              }
            />
          )}
        />

        {/* SIDES */}
        <ListEditor
          accent="green"
          title="Sides"
          unit="per tray"
          count={sides.length}
          addLabel="Add a side"
          items={sides}
          onAdd={() => { setSides([...sides, '']); markDirty(); }}
          onReorder={(from, to) => moveItem(sides, setSides, from, to)}
          renderItem={(s, i) => (
            <ItemCard
              accent="green"
              value={s}
              placeholder="e.g. Potato Bake"
              onChange={v => { setSides(sides.map((x, xi) => xi === i ? v : x)); markDirty(); }}
              onDelete={() => { setSides(sides.filter((_, xi) => xi !== i)); markDirty(); }}
            />
          )}
        />
      </div>

      {/* ── BULLETS ── */}
      <ListEditor
        accent="gold"
        title='"How We Set Up" Bullets'
        unit="shown under the Feasting Table heading"
        count={bullets.length}
        addLabel="Add a bullet"
        items={bullets}
        onAdd={() => { setBullets([...bullets, '']); markDirty(); }}
        onReorder={(from, to) => moveItem(bullets, setBullets, from, to)}
        renderItem={(b, i) => (
          <div className="group relative flex items-start gap-2 bg-gray-900/70 border border-gray-800 hover:border-bbq-gold/50 rounded-xl p-3 transition-all">
            <DragHandle accent="gold"/>
            <div className="shrink-0 w-8 h-8 rounded-lg bg-bbq-gold/10 border border-bbq-gold/30 flex items-center justify-center text-bbq-gold font-bold text-sm">{i + 1}</div>
            <textarea value={b} onChange={e => { setBullets(bullets.map((x, xi) => xi === i ? e.target.value : x)); markDirty(); }}
              placeholder="Describe one part of how you set up / serve..."
              rows={2}
              className="flex-1 bg-transparent text-white text-sm p-1.5 focus:outline-none focus:bg-gray-950 rounded resize-none"/>
            <button type="button" onClick={() => { setBullets(bullets.filter((_, xi) => xi !== i)); markDirty(); }}
              className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
          </div>
        )}
      />

      {/* ── Sticky floating save bar (only on dirty) ── */}
      {isDirty && (
        <div className="sticky bottom-4 z-20">
          <div className="relative overflow-hidden rounded-2xl border border-bbq-red/40 bg-gradient-to-r from-red-950/90 via-gray-950/90 to-orange-950/80 backdrop-blur-xl p-4 shadow-[0_20px_60px_-10px_rgba(239,68,68,0.5)] flex items-center justify-between gap-3 flex-wrap">
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-bbq-red/10 via-transparent to-bbq-gold/10 pointer-events-none animate-pulse"/>
            <div className="relative flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-bbq-red animate-pulse"/>
              <div>
                <div className="text-sm text-white font-bold">You have unsaved changes</div>
                <div className="text-[11px] text-gray-400">Click save to push them live on the storefront.</div>
              </div>
            </div>
            <button onClick={handleSave} disabled={isSaving}
              className="relative group px-5 py-2.5 bg-gradient-to-r from-bbq-red via-red-600 to-orange-500 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 hover:shadow-[0_0_24px_rgba(239,68,68,0.6)] hover:scale-[1.02] transition-all">
              {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── COCKTAIL TIERS ─────────────────────────── */

const CocktailTiersEditor: React.FC<{ settings: any; updateSettings: any; toast: any }> = ({ settings, updateSettings, toast }) => {
  const defaultTiers: CocktailTier[] = [
    { id: 'cocktail_teaser',  name: 'The Teaser',         description: 'Perfect for 30–60 minute functions, pre-dinner nibbles.', price: 40, pieces: 4, cold: 2, hot: 2, substantial: 0, duration: '30–60 min' },
    { id: 'cocktail_starter', name: 'The Starter',        description: 'Perfect for 60–90 minutes of light cocktail grazing.',    price: 49, pieces: 5, cold: 2, hot: 3, substantial: 0, duration: '60–90 min' },
    { id: 'cocktail_classic', name: 'The Classic',        description: 'Perfect for 1.5–2 hour cocktail events.',                 price: 59, pieces: 6, cold: 3, hot: 3, substantial: 0, duration: '1.5–2 hr' },
    { id: 'cocktail_crowd',   name: 'The Crowd Pleaser',  description: 'When you want it to feel like enough food.',              price: 69, pieces: 7, cold: 3, hot: 4, substantial: 0, duration: '2–2.5 hr' },
    { id: 'cocktail_feed',    name: 'The Proper Feed',    description: 'When canapes are the main meal.',                         price: 79, pieces: 8, cold: 3, hot: 4, substantial: 1, duration: '2.5–3 hr' },
  ];

  const tiers: CocktailTier[] = settings.cocktailMenuTiers?.length ? settings.cocktailMenuTiers : [];
  const [isEditing, setIsEditing] = useState(false);
  const [edit, setEdit] = useState<Partial<CocktailTier>>({});

  const saveAll = async (list: CocktailTier[]) => {
    const success = await updateSettings({ cocktailMenuTiers: list });
    if (success) toast('Cocktail tiers saved!'); else toast('Failed to save.', 'error');
  };

  const [isGenImg, setIsGenImg] = useState(false);

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit.name || edit.price == null) return;
    let image = edit.image;
    if (image && image.startsWith('data:image')) {
      try { image = await compressImage(image); } catch (err) { console.error(err); }
    }
    const tier: CocktailTier = {
      id: edit.id || `cocktail_${Date.now()}`,
      name: edit.name!,
      description: edit.description || '',
      price: edit.price!,
      pieces: edit.pieces || 0,
      cold: edit.cold || 0,
      hot: edit.hot || 0,
      substantial: edit.substantial || 0,
      duration: edit.duration || '',
      image,
    };
    const next = edit.id ? tiers.map(t => t.id === edit.id ? tier : t) : [...tiers, tier];
    await saveAll(next);
    setIsEditing(false); setEdit({});
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this cocktail tier?')) return;
    await saveAll(tiers.filter(t => t.id !== id));
  };

  const seedDefaults = async () => {
    if (!window.confirm('Populate with the default 5 cocktail tiers? This will replace any existing tiers.')) return;
    await saveAll(defaultTiers);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h4 className="text-lg font-bold text-white">Cocktail Menu Tiers</h4>
          <p className="text-xs text-gray-500">Per-person cocktail tiers shown under the 'Cocktail Menu' tab on the storefront.</p>
        </div>
        <div className="flex gap-2">
          {tiers.length === 0 && (
            <button onClick={seedDefaults} className="bg-gray-700 px-3 py-2 rounded text-xs font-bold flex items-center gap-2 hover:bg-gray-600 text-white"><Wand2 size={14}/> Populate Defaults</button>
          )}
          <button onClick={() => { setIsEditing(true); setEdit({ pieces: 5, cold: 2, hot: 3, substantial: 0 }); }}
            className="bg-bbq-red px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-red-700 text-white"><Plus size={16}/> Add Tier</button>
        </div>
      </div>

      {isEditing && (
        <form onSubmit={handleSaveTier} className="bg-gray-900 p-6 rounded-lg border border-gray-700 space-y-4">
          <h4 className="font-bold text-lg text-white">{edit.id ? 'Edit Tier' : 'New Tier'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Tier Name (e.g. The Teaser)" value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded p-2 text-white md:col-span-2" required/>
            <textarea placeholder="Description" value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded p-2 text-white md:col-span-2 h-20"/>
            <div><label className="text-xs text-gray-400 block mb-1">Price Per Person ($)</label>
              <input type="number" step="1" value={edit.price ?? ''} onChange={e => setEdit({ ...edit, price: parseFloat(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" required/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Pieces Per Head</label>
              <input type="number" value={edit.pieces ?? ''} onChange={e => setEdit({ ...edit, pieces: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Cold Pieces</label>
              <input type="number" value={edit.cold ?? ''} onChange={e => setEdit({ ...edit, cold: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Hot Pieces</label>
              <input type="number" value={edit.hot ?? ''} onChange={e => setEdit({ ...edit, hot: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Substantial Pieces</label>
              <input type="number" value={edit.substantial ?? ''} onChange={e => setEdit({ ...edit, substantial: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Duration Label (e.g. 1.5–2 hr)</label>
              <input value={edit.duration || ''} onChange={e => setEdit({ ...edit, duration: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"/></div>
          </div>
          <ImageField
            label="Tier Image"
            value={edit.image}
            onChange={(v) => setEdit({ ...edit, image: v })}
            isGenerating={isGenImg}
            onGenerate={async () => {
              if (!edit.name) { toast('Enter a tier name first.', 'warning'); return; }
              setIsGenImg(true);
              const img = await generateMarketingImage(`${edit.name} cocktail canape spread. ${edit.description || ''}. Elegant, cocktail party, professional food photography.`);
              if (img) {
                const compressed = await compressImage(img);
                setEdit(prev => ({ ...prev, image: compressed }));
              }
              setIsGenImg(false);
            }}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
            <button type="button" onClick={() => { setIsEditing(false); setEdit({}); }} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-bbq-red text-white rounded font-bold flex items-center gap-2"><Save size={16}/> Save Tier</button>
          </div>
        </form>
      )}

      {tiers.length === 0 && !isEditing && (
        <div className="text-center py-10 border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
          <Coffee size={32} className="mx-auto mb-2 opacity-50"/>
          <p>No cocktail tiers yet — the storefront will use the built-in defaults until you add or populate them.</p>
        </div>
      )}

      <div className="space-y-3">
        {tiers.map(t => (
          <div key={t.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3 flex items-center gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-800 bg-gray-950 shrink-0">
              {t.image
                ? <img src={t.image} className="w-full h-full object-cover" alt={t.name}/>
                : <div className="w-full h-full flex items-center justify-center text-gray-700"><Coffee size={20}/></div>}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h5 className="font-bold text-white">{t.name}</h5>
                {t.pieces > 0 && <span className="text-[10px] bg-purple-900/40 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full font-bold">{t.pieces} pcs</span>}
                {t.duration && <span className="text-[10px] text-gray-500">{t.duration}</span>}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>
              <div className="flex gap-2 mt-2 text-[10px] font-bold">
                {t.cold > 0 && <span className="bg-blue-900/30 text-blue-300 border border-blue-800 px-1.5 py-0.5 rounded">{t.cold} cold</span>}
                {t.hot > 0 && <span className="bg-orange-900/30 text-orange-300 border border-orange-800 px-1.5 py-0.5 rounded">{t.hot} hot</span>}
                {t.substantial > 0 && <span className="bg-amber-900/30 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded">{t.substantial} substantial</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-purple-400">${t.price}</div>
              <div className="text-[10px] text-gray-500 uppercase font-bold">Per Person</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEdit(t); setIsEditing(true); }} className="p-2 bg-gray-800 text-white rounded hover:bg-bbq-gold hover:text-black transition"><Edit2 size={14}/></button>
              <button onClick={() => handleDelete(t.id)} className="p-2 bg-gray-800 text-red-400 rounded hover:bg-red-600 hover:text-white transition"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────── FUNCTION TIERS ─────────────────────────── */

const FunctionTiersEditor: React.FC<{ settings: any; updateSettings: any; toast: any }> = ({ settings, updateSettings, toast }) => {
  const tiers: FunctionTier[] = settings.functionMenuTiers?.length ? settings.functionMenuTiers : [];
  const [isEditing, setIsEditing] = useState(false);
  const [edit, setEdit] = useState<Partial<FunctionTier>>({});

  const saveAll = async (list: FunctionTier[]) => {
    const success = await updateSettings({ functionMenuTiers: list });
    if (success) toast('Function tiers saved!'); else toast('Failed to save.', 'error');
  };

  const [isGenImg, setIsGenImg] = useState(false);

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit.name || edit.price == null) return;
    let image = edit.image;
    if (image && image.startsWith('data:image')) {
      try { image = await compressImage(image); } catch (err) { console.error(err); }
    }
    const tier: FunctionTier = {
      id: edit.id || `function_${Date.now()}`,
      name: edit.name!,
      description: edit.description || '',
      price: edit.price!,
      courses: edit.courses || '',
      servingStyle: edit.servingStyle || '',
      image,
    };
    const next = edit.id ? tiers.map(t => t.id === edit.id ? tier : t) : [...tiers, tier];
    await saveAll(next);
    setIsEditing(false); setEdit({});
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this function tier?')) return;
    await saveAll(tiers.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-lg font-bold text-white">Function Menu Tiers</h4>
          <p className="text-xs text-gray-500">Plated / alternate-drop options shown under the 'Function Menu' tab. Tab shows a 'coming soon' state until you add at least one tier.</p>
        </div>
        <button onClick={() => { setIsEditing(true); setEdit({}); }}
          className="bg-bbq-red px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-red-700 text-white"><Plus size={16}/> Add Tier</button>
      </div>

      {isEditing && (
        <form onSubmit={handleSaveTier} className="bg-gray-900 p-6 rounded-lg border border-gray-700 space-y-4">
          <h4 className="font-bold text-lg text-white">{edit.id ? 'Edit Tier' : 'New Tier'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Tier Name (e.g. Wedding Feast)" value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded p-2 text-white md:col-span-2" required/>
            <textarea placeholder="Description" value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded p-2 text-white md:col-span-2 h-20"/>
            <div><label className="text-xs text-gray-400 block mb-1">Price Per Person ($)</label>
              <input type="number" step="1" value={edit.price ?? ''} onChange={e => setEdit({ ...edit, price: parseFloat(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white" required/></div>
            <div><label className="text-xs text-gray-400 block mb-1">Courses (optional)</label>
              <input placeholder="e.g. 2 courses" value={edit.courses || ''} onChange={e => setEdit({ ...edit, courses: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"/></div>
            <div className="md:col-span-2"><label className="text-xs text-gray-400 block mb-1">Serving Style (optional)</label>
              <input placeholder="e.g. Alternate drop, Plated, Buffet" value={edit.servingStyle || ''} onChange={e => setEdit({ ...edit, servingStyle: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white"/></div>
          </div>
          <ImageField
            label="Tier Image"
            value={edit.image}
            onChange={(v) => setEdit({ ...edit, image: v })}
            isGenerating={isGenImg}
            onGenerate={async () => {
              if (!edit.name) { toast('Enter a tier name first.', 'warning'); return; }
              setIsGenImg(true);
              const img = await generateMarketingImage(`${edit.name} plated function menu. ${edit.description || ''}. Elegant formal dining, alternate drop, professional food photography.`);
              if (img) {
                const compressed = await compressImage(img);
                setEdit(prev => ({ ...prev, image: compressed }));
              }
              setIsGenImg(false);
            }}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-800">
            <button type="button" onClick={() => { setIsEditing(false); setEdit({}); }} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-bbq-red text-white rounded font-bold flex items-center gap-2"><Save size={16}/> Save Tier</button>
          </div>
        </form>
      )}

      {tiers.length === 0 && !isEditing && (
        <div className="text-center py-10 border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
          <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-50"/>
          <p>No function tiers yet. Add at least one to activate the Function Menu tab on the storefront.</p>
        </div>
      )}

      <div className="space-y-3">
        {tiers.map(t => (
          <div key={t.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3 flex items-center gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-800 bg-gray-950 shrink-0">
              {t.image
                ? <img src={t.image} className="w-full h-full object-cover" alt={t.name}/>
                : <div className="w-full h-full flex items-center justify-center text-gray-700"><UtensilsCrossed size={20}/></div>}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h5 className="font-bold text-white">{t.name}</h5>
                {t.courses && <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-700 px-2 py-0.5 rounded-full font-bold">{t.courses}</span>}
                {t.servingStyle && <span className="text-[10px] text-gray-500">{t.servingStyle}</span>}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-bbq-gold">${t.price}</div>
              <div className="text-[10px] text-gray-500 uppercase font-bold">Per Person</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEdit(t); setIsEditing(true); }} className="p-2 bg-gray-800 text-white rounded hover:bg-bbq-gold hover:text-black transition"><Edit2 size={14}/></button>
              <button onClick={() => handleDelete(t.id)} className="p-2 bg-gray-800 text-red-400 rounded hover:bg-red-600 hover:text-white transition"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CateringManager;
