import React, { useState, useEffect } from 'react';
import { Video, Clock, Play, X, Share2, Flame, Radio, ExternalLink } from 'lucide-react';
import { getRecordings, getStreamStatus } from '../services/api';
import { useStorefront } from '../context/AppContext';

interface Recording {
  uid: string;
  title: string;
  duration: number;
  created: string;
  thumbnail: string;
  previewUrl: string;
}

interface StreamStatus {
  live: boolean;
  viewerCount: number;
  previewUrl: string | null;
  title: string | null;
}

const StorefrontLive: React.FC = () => {
  const { settings } = useStorefront();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);

  useEffect(() => {
    getStreamStatus()
      .then((data: any) => setStreamStatus(data))
      .catch(() => {});

    getRecordings()
      .then((data: any) => {
        if (data?.recordings) setRecordings(data.recordings);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Poll stream status every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      getStreamStatus()
        .then((data: any) => setStreamStatus(data))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleShare = async (rec: Recording) => {
    const shareData = {
      title: rec.title || 'Hughesys Que Video',
      text: `Check out this video from Hughesys Que! 🔥🍖 ${rec.title || ''}`,
      url: rec.previewUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(rec.previewUrl);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isLive = streamStatus?.live;
  const name = settings?.businessName || 'Hughesys Que';

  return (
    <div className="animate-fade-in pb-20">

      {/* ---- HERO WITH EMBERS ---- */}
      <div className="relative overflow-hidden rounded-2xl mb-10">
        {/* Ember / fire background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0800] via-[#0d0200] to-black" />
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_center,_rgba(217,56,30,0.25)_0%,_transparent_70%)]" />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[200px] bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.15)_0%,_transparent_70%)]" />
          <div className="absolute bottom-0 right-1/3 w-[300px] h-[200px] bg-[radial-gradient(ellipse_at_center,_rgba(217,56,30,0.2)_0%,_transparent_70%)]" />
        </div>
        {/* Ember particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-pulse"
              style={{
                width: `${2 + Math.random() * 2}px`,
                height: `${2 + Math.random() * 2}px`,
                background: i % 3 === 0 ? '#f59e0b' : '#D9381E',
                opacity: 0.3 + Math.random() * 0.4,
                left: `${10 + Math.random() * 80}%`,
                bottom: `${Math.random() * 60}%`,
                animation: `emberFloat ${8 + Math.random() * 6}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 py-12 px-6 flex flex-col items-center text-center">
          {/* Logo / branding */}
          {settings?.logoUrl && (
            <img src={settings.logoUrl} alt={name} className="h-20 w-20 rounded-xl object-cover mb-4 border border-white/10 shadow-lg" />
          )}
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white uppercase tracking-tight mb-2">
            {name} <span className="text-bbq-red">Live</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-md mb-8">
            Watch live cooks, replays, and behind-the-scenes action straight from the pit.
          </p>

          {/* ---- LIVE STREAM PLAYER ---- */}
          <div className="w-full max-w-3xl">
            {isLive && streamStatus?.previewUrl ? (
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-bbq-red via-orange-500 to-bbq-red rounded-2xl opacity-60 blur-sm animate-pulse" />
                <div className="relative rounded-xl overflow-hidden border-2 border-bbq-red/50 shadow-2xl shadow-bbq-red/20">
                  <div className="aspect-video bg-black">
                    <iframe
                      src={streamStatus.previewUrl}
                      className="w-full h-full"
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      title="Live Stream"
                    />
                  </div>
                  <div className="bg-gray-950 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-full text-white text-xs font-bold uppercase">
                        <Radio size={12} className="animate-pulse" /> Live
                      </div>
                      {streamStatus.viewerCount > 0 && (
                        <span className="text-gray-400 text-xs">{streamStatus.viewerCount} watching</span>
                      )}
                    </div>
                    {streamStatus.title && (
                      <span className="text-gray-300 text-sm font-medium truncate ml-3">{streamStatus.title}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-gray-800 bg-gray-950/80 backdrop-blur">
                <div className="aspect-video flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-gray-800/80 border border-gray-700 flex items-center justify-center mb-4">
                    <Flame size={28} className="text-gray-600" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">We're Not Live Right Now</h3>
                  <p className="text-gray-500 text-sm max-w-xs">
                    Check back when we're firing up the smoker. Past streams are below.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Powered by */}
          <div className="mt-6 flex items-center gap-1.5 text-gray-600 text-xs">
            <span>Powered by</span>
            <a
              href="https://pennywiseit.au"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-bbq-gold transition font-semibold flex items-center gap-1"
            >
              PennyWise I.T <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>

      {/* ---- RECORDINGS GRID ---- */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <Play size={20} className="text-bbq-red" />
          <h2 className="text-xl font-display font-bold text-white uppercase tracking-wide">
            Past Cooks & Replays
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-bbq-red rounded-full mr-3" />
            Loading replays...
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-800 rounded-2xl">
            <Video size={40} className="mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500">No replays available yet.</p>
            <p className="text-gray-600 text-sm mt-1">Past streams will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recordings.map(rec => (
              <div
                key={rec.uid}
                onClick={() => setSelectedRecording(rec)}
                className="bg-gray-900/60 rounded-xl overflow-hidden border border-gray-800 group cursor-pointer hover:border-gray-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <div className="aspect-video relative bg-black">
                  {rec.thumbnail ? (
                    <img src={rec.thumbnail} className="w-full h-full object-cover" alt={rec.title} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                      <Video size={32} className="text-gray-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:scale-100 scale-75">
                      <Play size={22} className="text-white ml-0.5" />
                    </div>
                  </div>
                  {rec.duration > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded font-mono flex items-center gap-1">
                      <Clock size={9} /> {formatDuration(rec.duration)}
                    </div>
                  )}
                </div>
                <div className="p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-sm group-hover:text-bbq-gold transition truncate">
                      {rec.title || 'Untitled Stream'}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">{formatDate(rec.created)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleShare(rec); }}
                    className="shrink-0 p-1.5 rounded-lg bg-gray-800 hover:bg-bbq-gold hover:text-black text-gray-500 transition border border-gray-700"
                    title="Share"
                  >
                    <Share2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- RECORDING PLAYER MODAL ---- */}
      {selectedRecording && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedRecording(null)}
        >
          <div
            className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-3xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div>
                <h3 className="font-bold text-white">{selectedRecording.title || 'Untitled Stream'}</h3>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                  <span>{formatDate(selectedRecording.created)}</span>
                  {selectedRecording.duration > 0 && (
                    <>
                      <span className="text-gray-700">|</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {formatDuration(selectedRecording.duration)}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleShare(selectedRecording)}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-bbq-gold hover:text-black text-gray-400 transition"
                  title="Share"
                >
                  <Share2 size={16} />
                </button>
                <button
                  onClick={() => setSelectedRecording(null)}
                  className="text-gray-400 hover:text-white transition p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                src={selectedRecording.previewUrl}
                className="w-full h-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={selectedRecording.title}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorefrontLive;
