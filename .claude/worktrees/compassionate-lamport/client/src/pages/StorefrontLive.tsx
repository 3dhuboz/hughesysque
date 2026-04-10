import React, { useState, useEffect } from 'react';
import { Video, Clock, Play, X, Share2 } from 'lucide-react';
import { getRecordings } from '../services/api';

interface Recording {
  uid: string;
  title: string;
  duration: number;
  created: string;
  thumbnail: string;
  previewUrl: string;
}

const StorefrontLive: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  useEffect(() => {
    getRecordings()
      .then((data: any) => {
        if (data?.recordings) setRecordings(data.recordings);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
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

  return (
    <div className="animate-fade-in pb-20">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl mb-8 bg-gradient-to-br from-gray-900 via-bbq-charcoal to-gray-900 border border-gray-800">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-bbq-red rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center text-center py-16 px-6">
          <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center mb-5">
            <Video size={32} className="text-bbq-red" />
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-white mb-3 uppercase tracking-tight">
            Videos & <span className="text-bbq-red">Replays</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md">
            Watch past cooks, comp walkarounds, and behind-the-scenes action from Hughesey.
          </p>
        </div>
      </div>

      {/* Recordings Grid */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Play size={22} className="text-bbq-red" />
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            Past Cooks & Replays
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-gray-600 border-t-bbq-red rounded-full mr-3" />
            Loading replays...
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-800 rounded-2xl">
            <Video size={48} className="mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500 text-lg">No replays available yet.</p>
            <p className="text-gray-600 text-sm mt-1">Past streams and videos will show up here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recordings.map(rec => (
              <div
                key={rec.uid}
                onClick={() => setSelectedRecording(rec)}
                className="bg-bbq-charcoal rounded-2xl overflow-hidden border border-gray-800 group cursor-pointer hover:border-gray-600 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                <div className="aspect-video relative bg-black">
                  {rec.thumbnail ? (
                    <img src={rec.thumbnail} className="w-full h-full object-cover" alt={rec.title} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                      <Video size={40} className="text-gray-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:scale-100 scale-75">
                      <Play size={28} className="text-white ml-1" />
                    </div>
                  </div>
                  {rec.duration > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-lg font-mono flex items-center gap-1">
                      <Clock size={10} /> {formatDuration(rec.duration)}
                    </div>
                  )}
                </div>
                <div className="p-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-sm group-hover:text-bbq-gold transition truncate">
                      {rec.title || 'Untitled Stream'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(rec.created)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleShare(rec); }}
                    className="shrink-0 p-2 rounded-lg bg-gray-800 hover:bg-bbq-gold hover:text-black text-gray-400 transition border border-gray-700"
                    title="Share this video"
                  >
                    <Share2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recording Player Modal */}
      {selectedRecording && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedRecording(null)}
        >
          <div
            className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-4xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div>
                <h3 className="font-bold text-white text-lg">{selectedRecording.title || 'Untitled Stream'}</h3>
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
                  <X size={22} />
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
