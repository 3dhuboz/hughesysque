import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Clock, Play, X, Share2, Radio, Send, Trash2, Pin, Eye, MessageCircle, Users } from 'lucide-react';
import { getRecordings, getStreamStatus, getChatMessages, deleteChatMessage } from '../services/api';

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
  previewUrl?: string;
  webRTCPlaybackUrl?: string;
  title?: string;
}

interface ChatMsg {
  id: string;
  streamId: string;
  userName: string;
  message: string;
  createdAt: string;
  isAdmin: boolean;
  isPinned: boolean;
}

const formatTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
};

const StorefrontLive: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [status, setStatus] = useState<StreamStatus | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatName, setChatName] = useState(() => localStorage.getItem('hq_chat_name') || '');
  const [showNameInput, setShowNameInput] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isLive = status?.live;
  const isAdmin = !!localStorage.getItem('pw_token');

  // Facebook recordings state
  const [fbRecordings, setFbRecordings] = useState<any[]>([]);
  const [selectedFbVideo, setSelectedFbVideo] = useState<any>(null);

  // Load recordings — try Facebook first, fall back to Cloudflare
  useEffect(() => {
    // Fetch Facebook past live videos
    fetch('/api/v1/stream/fb-recordings')
      .then(r => r.json())
      .then((data: any) => {
        if (data?.recordings?.length > 0) setFbRecordings(data.recordings);
      })
      .catch(() => {});

    // Also try Cloudflare recordings as fallback
    getRecordings()
      .then((data: any) => { if (data?.recordings) setRecordings(data.recordings); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Poll stream status — refresh recordings when stream ends
  const wasLiveRef = useRef(false);
  useEffect(() => {
    const fetchStatus = () => {
      getStreamStatus()
        .then((data: any) => {
          const nowLive = data?.live;
          // Stream just ended — refresh recordings to show new replay
          if (wasLiveRef.current && !nowLive) {
            getRecordings()
              .then((d: any) => { if (d?.recordings) setRecordings(d.recordings); })
              .catch(() => {});
          }
          wasLiveRef.current = !!nowLive;
          setStatus(data);
        })
        .catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Poll chat messages when live
  useEffect(() => {
    if (!isLive) return;
    const fetchChat = () => {
      const lastMsg = messages[messages.length - 1];
      getChatMessages('live-main', lastMsg?.createdAt)
        .then((data: any) => {
          if (data?.messages?.length > 0) {
            setMessages((prev: ChatMsg[]) => {
              const ids = new Set(prev.map(m => m.id));
              const fresh = data.messages.filter((m: ChatMsg) => !ids.has(m.id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        })
        .catch(() => {});
    };
    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [isLive, messages]);

  // Auto-scroll chat
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      const el = chatContainerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Send chat message
  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !chatName.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/v1/stream/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ streamId: 'live-main', message: text, userName: chatName.trim(), userId: chatName.trim() }),
      });
      setChatInput('');
    } catch {}
    setSending(false);
  };

  // Mod actions
  const handleDeleteMsg = async (id: string) => {
    try { await deleteChatMessage(id); setMessages(prev => prev.filter(m => m.id !== id)); } catch {}
  };

  const handlePinMsg = async (id: string) => {
    try {
      await fetch('/api/v1/stream/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ action: 'pin', messageId: id }),
      });
      setMessages(prev => prev.map(m => ({ ...m, isPinned: m.id === id })));
    } catch {}
  };

  const handleShare = async (rec: Recording) => {
    const shareData = { title: rec.title || 'Hughesys Que Video', text: `Check out this video from Hughesys Que! \u{1F525}\u{1F356}`, url: rec.previewUrl };
    if (navigator.share) { try { await navigator.share(shareData); } catch {} }
    else { await navigator.clipboard.writeText(rec.previewUrl); }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  const pinnedMessage = messages.find(m => m.isPinned);

  // ═══════════════════════════════════════════════════════
  // LIVE VIEW — video + chat side-by-side
  // ═══════════════════════════════════════════════════════
  if (isLive && status?.previewUrl) {
    return (
      <div className="animate-fade-in pb-20">
        {/* Live banner */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-red-900/40 border border-red-600 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-red-300 text-xs font-bold uppercase tracking-wider">Live Now</span>
            </div>
            {status.title && <h2 className="text-white font-bold text-lg">{status.title}</h2>}
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 text-sm">
            <Eye size={14} /> {status.viewerCount ?? 0} watching
          </div>
        </div>

        {/* Main layout: video + chat */}
        <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: '60vh' }}>
          {/* Video */}
          <div className="flex-1 min-w-0">
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
              <iframe
                src={`${status.previewUrl}?autoplay=true&muted=true&preload=auto&controls=true`}
                className="w-full h-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title="Live Stream"
              />
            </div>
          </div>

          {/* Chat sidebar */}
          <div className="w-full lg:w-[360px] flex flex-col bg-bbq-charcoal rounded-2xl border border-gray-800 overflow-hidden shadow-xl" style={{ height: 'min(70vh, 560px)' }}>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageCircle size={16} className="text-bbq-gold" />
                <span className="text-white font-bold text-sm">Live Chat</span>
              </div>
              <span className="text-xs text-gray-500">{messages.length} messages</span>
            </div>

            {/* Pinned message */}
            {pinnedMessage && (
              <div className="px-4 py-2 bg-bbq-gold/10 border-b border-bbq-gold/20 flex items-start gap-2 shrink-0">
                <Pin size={12} className="text-bbq-gold shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-bbq-gold text-[10px] font-bold uppercase">Pinned</span>
                  <p className="text-white text-xs">{pinnedMessage.message}</p>
                </div>
              </div>
            )}

            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">No messages yet. Be the first to say something!</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="group flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <span className={`font-bold text-xs ${msg.isAdmin ? 'text-bbq-gold' : 'text-blue-400'}`}>
                        {msg.isAdmin && '\u2605 '}{msg.userName}
                      </span>
                      <span className="text-xs text-gray-500 ml-1.5">{formatTime(msg.createdAt)}</span>
                      <p className="text-gray-200 text-sm leading-relaxed">{msg.message}</p>
                    </div>
                    {isAdmin && (
                      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => handlePinMsg(msg.id)} className="p-1 rounded hover:bg-bbq-gold/20 text-gray-600 hover:text-bbq-gold transition" title="Pin">
                          <Pin size={11} />
                        </button>
                        <button onClick={() => handleDeleteMsg(msg.id)} className="p-1 rounded hover:bg-red-900/50 text-gray-600 hover:text-red-400 transition" title="Delete">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="px-3 py-3 border-t border-gray-800 shrink-0 space-y-2">
              {!chatName.trim() || showNameInput ? (
                <div className="flex gap-2">
                  <input
                    value={chatName}
                    onChange={e => setChatName(e.target.value)}
                    placeholder="Your name..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-bbq-gold focus:outline-none"
                    onKeyDown={e => { if (e.key === 'Enter' && chatName.trim()) { localStorage.setItem('hq_chat_name', chatName.trim()); setShowNameInput(false); } }}
                  />
                  <button
                    onClick={() => { if (chatName.trim()) { localStorage.setItem('hq_chat_name', chatName.trim()); setShowNameInput(false); } }}
                    className="bg-bbq-gold text-black px-3 py-2 rounded-lg font-bold text-sm"
                  >
                    Set
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1 flex gap-2">
                    <button onClick={() => setShowNameInput(true)} className="text-[10px] text-gray-500 hover:text-white px-2 py-2 bg-gray-800 rounded-lg shrink-0 border border-gray-700" title="Change name">
                      {chatName}
                    </button>
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Say something..."
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-bbq-gold focus:outline-none"
                      onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                      disabled={sending}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={sending || !chatInput.trim()}
                    className="bg-bbq-gold text-black p-2 rounded-lg font-bold disabled:opacity-40 transition"
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Past recordings below */}
        {recordings.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-6">
              <Play size={22} className="text-bbq-red" />
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Past Cooks & Replays</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recordings.map(rec => (
                <RecordingCard key={rec.uid} rec={rec} onSelect={setSelectedRecording} onShare={handleShare} formatDuration={formatDuration} formatDate={formatDate} />
              ))}
            </div>
          </div>
        )}

        {selectedRecording && <RecordingModal rec={selectedRecording} onClose={() => setSelectedRecording(null)} onShare={handleShare} formatDuration={formatDuration} formatDate={formatDate} />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // OFFLINE VIEW — hero + recordings grid
  // ═══════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in pb-20">
      {/* Hero — compact on mobile */}
      <div className="relative rounded-xl overflow-hidden shadow-xl mb-6 bg-gradient-to-br from-gray-900 via-bbq-charcoal to-gray-900 border border-gray-800">
        <div className="relative z-10 flex flex-col items-center justify-center text-center py-8 md:py-12 px-4">
          <Video size={28} className="text-bbq-red mb-3" />
          <h1 className="text-2xl md:text-4xl font-display font-bold text-white mb-2 uppercase tracking-tight">
            Videos & <span className="text-bbq-red">Replays</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-md">
            Past cooks, walkarounds, and behind-the-scenes from Hughesey.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full text-xs">
            <Radio size={12} className="text-gray-500" />
            <span className="text-gray-400">Not live right now</span>
          </div>
        </div>
      </div>

      {/* Facebook Past Streams */}
      {fbRecordings.length > 0 && (
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Play size={22} className="text-bbq-red" />
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Past Cooks & Replays</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fbRecordings.map((vid: any) => (
              <div key={vid.id} className="bg-bbq-charcoal rounded-2xl overflow-hidden border border-gray-800 shadow-xl hover:border-gray-600 transition-all group">
                {/* Thumbnail — click to play */}
                <div className="aspect-video bg-black relative cursor-pointer overflow-hidden" onClick={() => setSelectedFbVideo(vid)}>
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                    <div className="w-14 h-14 rounded-full bg-bbq-red/20 border-2 border-bbq-red/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={24} className="text-bbq-red ml-0.5" />
                    </div>
                  </div>
                </div>
                {/* Info — compact */}
                <div className="p-3">
                  <h3 className="font-bold text-white text-sm mb-0.5 truncate">{vid.title}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">{formatDate(vid.createdAt)}</span>
                    {vid.fbVideoUrl && (
                      <a href={vid.fbVideoUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-blue-400" onClick={e => e.stopPropagation()}>
                        Facebook
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: Cloudflare recordings */}
      {fbRecordings.length === 0 && (
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Play size={22} className="text-bbq-red" />
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Past Cooks & Replays</h2>
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
                <RecordingCard key={rec.uid} rec={rec} onSelect={setSelectedRecording} onShare={handleShare} formatDuration={formatDuration} formatDate={formatDate} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Facebook Video Player Modal — mobile friendly */}
      {selectedFbVideo && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={() => setSelectedFbVideo(null)}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white text-sm truncate">{selectedFbVideo.title}</h3>
              <p className="text-[10px] text-gray-500">{formatDate(selectedFbVideo.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              {selectedFbVideo.fbVideoUrl && (
                <a href={selectedFbVideo.fbVideoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] bg-blue-600 text-white px-2.5 py-1 rounded-lg">
                  Facebook
                </a>
              )}
              <button onClick={() => setSelectedFbVideo(null)} className="text-gray-400 hover:text-white p-1"><X size={20} /></button>
            </div>
          </div>
          {/* Video — fills remaining space */}
          <div className="flex-1 flex items-center justify-center px-2 pb-4" onClick={e => e.stopPropagation()}>
            {selectedFbVideo.embedUrl ? (
              <iframe src={selectedFbVideo.embedUrl} className="w-full max-w-4xl rounded-lg" style={{ height: '100%', maxHeight: '80vh', border: 'none' }} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen title={selectedFbVideo.title} />
            ) : (
              <a href={selectedFbVideo.fbVideoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-lg">Open on Facebook</a>
            )}
          </div>
        </div>
      )}

      {selectedRecording && <RecordingModal rec={selectedRecording} onClose={() => setSelectedRecording(null)} onShare={handleShare} formatDuration={formatDuration} formatDate={formatDate} />}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const RecordingCard: React.FC<{
  rec: Recording;
  onSelect: (r: Recording) => void;
  onShare: (r: Recording) => void;
  formatDuration: (s: number) => string;
  formatDate: (d: string) => string;
}> = ({ rec, onSelect, onShare, formatDuration, formatDate }) => (
  <div onClick={() => onSelect(rec)}
    className="bg-bbq-charcoal rounded-2xl overflow-hidden border border-gray-800 group cursor-pointer hover:border-gray-600 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5">
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
        <h3 className="font-bold text-white text-sm group-hover:text-bbq-gold transition truncate">{rec.title || 'Untitled Stream'}</h3>
        <p className="text-xs text-gray-500 mt-1">{formatDate(rec.created)}</p>
      </div>
      <button onClick={e => { e.stopPropagation(); onShare(rec); }}
        className="shrink-0 p-2 rounded-lg bg-gray-800 hover:bg-bbq-gold hover:text-black text-gray-400 transition border border-gray-700" title="Share">
        <Share2 size={14} />
      </button>
    </div>
  </div>
);

const RecordingModal: React.FC<{
  rec: Recording;
  onClose: () => void;
  onShare: (r: Recording) => void;
  formatDuration: (s: number) => string;
  formatDate: (d: string) => string;
}> = ({ rec, onClose, onShare, formatDuration, formatDate }) => (
  <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-4xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h3 className="font-bold text-white text-lg">{rec.title || 'Untitled Stream'}</h3>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
            <span>{formatDate(rec.created)}</span>
            {rec.duration > 0 && <><span className="text-gray-700">|</span><span className="flex items-center gap-1"><Clock size={10} /> {formatDuration(rec.duration)}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onShare(rec)} className="p-2 rounded-lg bg-gray-800 hover:bg-bbq-gold hover:text-black text-gray-400 transition" title="Share">
            <Share2 size={16} />
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition p-1"><X size={22} /></button>
        </div>
      </div>
      <div className="aspect-video bg-black">
        <iframe src={rec.previewUrl} className="w-full h-full" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen title={rec.title} />
      </div>
    </div>
  </div>
);

export default StorefrontLive;
