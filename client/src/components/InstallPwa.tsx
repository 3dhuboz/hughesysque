import React, { useEffect, useState } from 'react';
import { Download, Share, Check } from 'lucide-react';

/** Detect iOS/iPadOS — covers iPhones, iPads (including desktop-mode iPads) */
function detectIOS(): boolean {
  const ua = navigator.userAgent;
  // Classic iOS devices
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Macintosh but has touch
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** Check if already running as installed PWA */
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

const InstallPwa: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Already installed as PWA — hide the button
    if (isStandalone()) { setInstalled(true); return; }

    setIsIOS(detectIOS());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Register service worker for PWA install eligibility
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setInstalled(true);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }
    } else if (isIOS) {
      setShowIOSPrompt(prev => !prev);
      if (!showIOSPrompt) {
        setTimeout(() => setShowIOSPrompt(false), 10000);
      }
    }
  };

  // Hide if already installed or not installable
  if (installed || (!deferredPrompt && !isIOS)) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white transition"
      >
        <Download size={14} /> App
      </button>

      {/* iOS Instruction Overlay */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pb-24" onClick={() => setShowIOSPrompt(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-72 bg-bbq-charcoal border border-white/20 p-5 rounded-2xl shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <p className="text-white text-base mb-3 font-bold">Install Hughesys Que</p>
            <div className="space-y-3 text-gray-300 text-sm">
              <div className="flex items-center gap-3 bg-black/30 p-3 rounded-lg">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p>Tap the <Share size={14} className="inline mx-1 text-blue-400" /> Share button in your browser</p>
              </div>
              <div className="flex items-center gap-3 bg-black/30 p-3 rounded-lg">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p>Scroll down and tap <span className="text-white font-bold">"Add to Home Screen"</span></p>
              </div>
              <div className="flex items-center gap-3 bg-black/30 p-3 rounded-lg">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <p>Tap <span className="text-white font-bold">"Add"</span> to install</p>
              </div>
            </div>
            <button onClick={() => setShowIOSPrompt(false)} className="mt-4 text-gray-500 text-xs hover:text-white transition">Got it</button>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-2">
          <Check size={16} /> App installed! Check your home screen.
        </div>
      )}
    </>
  );
};

export default InstallPwa;