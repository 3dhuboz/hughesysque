import React, { useState } from 'react';
import SmartHeroImg from '../components/SmartHeroImg';
import { useStorefront } from '../context/StorefrontContext';
import { useClientConfig } from '../context/ClientConfigContext';
import { Camera, Upload, X, Heart, Share2, Instagram, Facebook, Image as ImageIcon } from 'lucide-react';

const compressImage = (base64Str, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

const FeedPost = ({ post }) => {
  const { user } = useStorefront();
  const isLiked = user ? post.likedBy?.includes(user.id) : false;
  const [localLiked, setLocalLiked] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [likeAnim, setLikeAnim] = useState(false);

  const handleLike = () => {
    if (!user) { alert('Please login to like photos!'); return; }
    setLocalLiked(l => !l);
    setLikeCount(c => localLiked ? c - 1 : c + 1);
    if (!localLiked) { setLikeAnim(true); setTimeout(() => setLikeAnim(false), 800); }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'Fan Gallery', text: `Check out this shot by @${post.userName}!`, url: window.location.href }).catch(() => { });
    } else { alert('Link copied!'); }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8 max-w-md mx-auto shadow-2xl">
      <div className="flex items-center gap-3 p-4">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-bbq-red to-orange-500 flex items-center justify-center font-bold text-white text-xs border border-white/10">
          {(post.userName || 'A').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">{post.userName}</p>
          <p className="text-[10px] text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="relative w-full aspect-square bg-black cursor-pointer" onDoubleClick={handleLike}>
        <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
        {likeAnim && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart size={100} className="text-white fill-white drop-shadow-2xl opacity-80" style={{ animation: 'fadeIn 0.3s ease, fadeOut 0.5s ease 0.3s forwards' }} />
          </div>
        )}
      </div>
      <div className="p-4 pb-2">
        <div className="flex gap-4 mb-3">
          <button onClick={handleLike} className="hover:scale-110 transition active:scale-95">
            <Heart size={28} className={localLiked ? 'text-red-500 fill-red-500' : 'text-white'} />
          </button>
          <button onClick={handleShare} className="hover:scale-110 transition active:scale-95 text-white">
            <Share2 size={28} />
          </button>
        </div>
        <div className="text-sm font-bold text-white mb-2">{likeCount} likes</div>
        <div>
          <span className="font-bold text-white mr-2 text-sm">{post.userName}</span>
          <span className="text-gray-300 text-sm">{post.caption}</span>
        </div>
      </div>
    </div>
  );
};

const StorefrontGallery = () => {
  const { galleryPosts, addGalleryPost, settings, user } = useStorefront();
  const { brandName } = useClientConfig();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const visiblePosts = galleryPosts.filter(p => p.approved || (user && p.userId === user.id));

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result);
        setSelectedImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (!selectedImage || !user) return;
    if (!agreed) { alert('Please accept the terms to upload.'); return; }
    setIsUploading(true);
    setTimeout(() => {
      addGalleryPost({
        id: `gal_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        imageUrl: selectedImage,
        caption,
        createdAt: new Date().toISOString(),
        approved: true,
        likes: 0,
        likedBy: []
      });
      setIsUploading(false);
      setShowUploadModal(false);
      setSelectedImage(null);
      setCaption('');
      setAgreed(false);
      alert('Uploaded! Thanks for flexing your food.');
    }, 1500);
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="relative h-[40vh] min-h-[300px] rounded-2xl overflow-hidden shadow-2xl mb-8">
        <div className="absolute inset-0 bg-black/60 z-10" />
        <SmartHeroImg src={settings.galleryHeroImage} fallback="https://images.unsplash.com/photo-1516054575922-f0b8eeadec1a?auto=format&fit=crop&w=1950&q=80"
          className="absolute inset-0 w-full h-full object-cover" alt="BBQ Gallery" />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6">
          <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4 tracking-tight uppercase drop-shadow-xl">
            FAN <span className="text-bbq-red">GALLERY</span>
          </h1>
          <p className="text-gray-200 max-w-xl font-light text-lg mb-6 leading-relaxed">
            Show us your {brandName} spread! Upload your best shot for a chance to be featured on our
            official <span className="text-white font-bold inline-flex items-center gap-1 mx-1"><Instagram size={14} /> Instagram</span> &amp;
            <span className="text-white font-bold inline-flex items-center gap-1 mx-1"><Facebook size={14} /> Facebook</span>.
          </p>
          <button onClick={() => user ? setShowUploadModal(true) : alert('Please login to upload photos.')}
            className="bg-white text-black font-bold uppercase tracking-widest px-8 py-3 rounded-full hover:bg-gray-200 transition shadow-xl transform hover:-translate-y-1 flex items-center gap-2">
            <Camera size={18} /> Upload Your Flex
          </button>
        </div>
      </div>

      <div className="text-center py-4 bg-bbq-charcoal/80 border-y border-gray-800 sticky top-16 z-30 mb-8" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Live Community Feed
        </h2>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {visiblePosts.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
            <ImageIcon className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-500">No photos yet. Be the first to flex!</p>
            <button onClick={() => user ? setShowUploadModal(true) : alert('Please login to upload photos.')}
              className="mt-4 text-bbq-gold hover:underline font-bold text-sm">Upload Now</button>
          </div>
        ) : (
          <div className="space-y-6">
            {visiblePosts.map(post => <FeedPost key={post.id} post={post} />)}
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-bbq-charcoal w-full max-w-md rounded-xl border border-gray-700 shadow-2xl overflow-hidden" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
              <h3 className="font-bold text-white flex items-center gap-2"><Upload size={18} /> Upload Photo</h3>
              <button onClick={() => setShowUploadModal(false)}><X className="text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-6 space-y-6">
              {!selectedImage ? (
                <div className="border-2 border-dashed border-gray-600 rounded-xl h-64 flex flex-col items-center justify-center bg-black/20 hover:bg-black/40 transition relative">
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <Camera className="text-gray-500 mb-4" size={48} />
                  <p className="text-gray-400 text-sm font-bold">Tap to Select Photo</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden h-64 bg-black group">
                  <img src={selectedImage} className="w-full h-full object-contain" alt="Preview" />
                  <button onClick={() => setSelectedImage(null)} className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white hover:bg-red-600 transition">
                    <X size={16} />
                  </button>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Caption</label>
                <input value={caption} onChange={e => setCaption(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white focus:border-bbq-red outline-none"
                  placeholder="Write a caption..." />
              </div>
              <div className="bg-blue-900/20 p-3 rounded border border-blue-800 text-xs text-blue-200">
                <label className="flex gap-3 cursor-pointer items-start">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 rounded bg-blue-900 border-blue-700" />
                  <span>I grant <strong>{brandName}</strong> permission to use this photo on their social media channels and website.</span>
                </label>
              </div>
              <button onClick={handleUpload} disabled={!selectedImage || !agreed || isUploading}
                className="w-full bg-bbq-red text-white font-bold py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {isUploading ? 'Uploading...' : 'Post to Feed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorefrontGallery;
