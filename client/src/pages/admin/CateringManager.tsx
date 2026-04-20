import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/Toast';
import { CateringPackage, CocktailTier, FunctionTier } from '../../types';
import { Plus, Trash2, Edit2, Save, X, Wand2, Loader2, Coffee, UtensilsCrossed, ChefHat, Package as PackageIcon, Info, Sparkles } from 'lucide-react';
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

  const [meats, setMeats] = useState<string>(((settings.cateringSelfServiceMeats?.length ? settings.cateringSelfServiceMeats : defaultMeats) || []).join('\n'));
  const [sides, setSides] = useState<string>(((settings.cateringSelfServiceSides?.length ? settings.cateringSelfServiceSides : defaultSides) || []).join('\n'));
  const [bullets, setBullets] = useState<string>(((settings.feastingTableInfo?.bullets?.length ? settings.feastingTableInfo.bullets : defaultBullets) || []).join('\n'));
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const meatsList = meats.split('\n').map(s => s.trim()).filter(Boolean);
    const sidesList = sides.split('\n').map(s => s.trim()).filter(Boolean);
    const bulletsList = bullets.split('\n').map(s => s.trim()).filter(Boolean);
    const success = await updateSettings({
      cateringSelfServiceMeats: meatsList,
      cateringSelfServiceSides: sidesList,
      feastingTableInfo: { bullets: bulletsList },
    });
    setIsSaving(false);
    if (success) toast('Self service lists saved!'); else toast('Failed to save.', 'error');
  };

  const resetToDefaults = () => {
    if (!window.confirm('Reset all Self Service lists to the Hughesey Que defaults?')) return;
    setMeats(defaultMeats.join('\n'));
    setSides(defaultSides.join('\n'));
    setBullets(defaultBullets.join('\n'));
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-bold text-white">Self Service & Feasting Table</h4>
        <p className="text-xs text-gray-500">Drives the 'Build Your Self Service Order' counters and the 'How We Set Up' bullets on the storefront.</p>
      </div>

      <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-4 flex items-start gap-3 text-sm">
        <Info size={18} className="text-blue-400 shrink-0 mt-0.5"/>
        <div className="text-blue-200/90">
          <p className="font-bold mb-1">One item per line.</p>
          <p className="text-blue-200/70 text-xs">Append <code className="bg-black/30 px-1 rounded">{' *'}</code> to a meat name to flag it as having a <strong>+$4/pp surcharge</strong> (e.g. <code className="bg-black/30 px-1 rounded">Pork Belly *</code>).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-bbq-red uppercase tracking-wider mb-2">Meats (per kg)</label>
          <textarea value={meats} onChange={e => setMeats(e.target.value)} rows={14}
            className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white text-sm font-mono" placeholder="One meat per line..."/>
        </div>
        <div>
          <label className="block text-sm font-bold text-green-400 uppercase tracking-wider mb-2">Sides (per tray)</label>
          <textarea value={sides} onChange={e => setSides(e.target.value)} rows={14}
            className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white text-sm font-mono" placeholder="One side per line..."/>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-bbq-gold uppercase tracking-wider mb-2">Feasting Table — "How We Set Up" bullets</label>
        <textarea value={bullets} onChange={e => setBullets(e.target.value)} rows={6}
          className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white text-sm" placeholder="One bullet per line..."/>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
        <button onClick={resetToDefaults} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Reset to defaults</button>
        <button onClick={handleSave} disabled={isSaving}
          className="px-4 py-2 bg-bbq-red text-white rounded font-bold flex items-center gap-2 disabled:opacity-50">
          {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Self Service
        </button>
      </div>
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

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit.name || edit.price == null) return;
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
          <div key={t.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex items-center gap-4 flex-wrap">
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

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit.name || edit.price == null) return;
    const tier: FunctionTier = {
      id: edit.id || `function_${Date.now()}`,
      name: edit.name!,
      description: edit.description || '',
      price: edit.price!,
      courses: edit.courses || '',
      servingStyle: edit.servingStyle || '',
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
          <div key={t.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex items-center gap-4 flex-wrap">
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
