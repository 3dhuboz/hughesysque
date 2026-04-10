import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../components/Toast';
import { Video, Radio, Play, Eye, Clock, RefreshCw, Loader2, X, ExternalLink, Camera, CameraOff, Mic, MicOff, Square, Upload, Share2, Facebook, Instagram, Check, MessageCircle, Trash2, Ban, Shield, Image, Plus, Flame } from 'lucide-react';
import { createLiveInput, getLiveInputs, getStreamStatus, getRecordings, uploadRecording, upsertSocialPost, getChatMessages, deleteChatMessage, banChatUser, unbanChatUser, getChatBans } from '../../services/api';

interface LiveInput {
  uid: string;
  rtmps: { url: string; streamKey: string };
  webRTC: { url: string };
}

interface StreamStatus {
  live: boolean;
  viewerCount: number;
  previewUrl?: string;
  title?: string;
}

interface Recording {
  uid: string;
  title: string;
  duration: number;
  created: string;
  thumbnail: string;
  previewUrl: string;
}

const LiveStreamManager: React.FC = () => {
  const { toast } = useToast();

  const [liveInput, setLiveInput] = useState<LiveInput | null>(null);
  const [status, setStatus] = useState<StreamStatus | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingInputs, setIsLoadingInputs] = useState(true);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);
  const [previewRecording, setPreviewRecording] = useState<Recording | null>(null);

  // Share to socials state
  const [shareRecording, setShareRecording] = useState<Recording | null>(null);
  const [shareCaption, setShareCaption] = useState('');
  const [sharePlatform, setSharePlatform] = useState<'Facebook' | 'Instagram'>('Facebook');
  const [shareHashtags, setShareHashtags] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Chat moderation state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatBans, setChatBans] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showBanList, setShowBanList] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Live streaming state
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Stream metadata + Facebook
  const [streamTitle, setStreamTitle] = useState('Live from Hughesys Que');
  const [fbDescription, setFbDescription] = useState('');
  const [fbSimulcast, setFbSimulcast] = useState(true);
  const [fbConnected, setFbConnected] = useState(false);

  // Sponsor ticker state
  const [sponsors, setSponsors] = useState<{id: string; text: string; logoUrl: string}[]>([]);
  const [scrollSpeed, setScrollSpeed] = useState(1.2);
  const [showSponsorPanel, setShowSponsorPanel] = useState(false);

  // Simulcast state
  const [simulcastOutputs, setSimulcastOutputs] = useState<any[]>([]);
  const [showSimulcast, setShowSimulcast] = useState(false);
  const [fbRtmpUrl, setFbRtmpUrl] = useState('');
  const [fbStreamKey, setFbStreamKey] = useState('');
  const [addingOutput, setAddingOutput] = useState(false);

  // Facebook relay refs
  const relayWsRef = useRef<WebSocket | null>(null);
  const relayRecorderRef = useRef<MediaRecorder | null>(null);

  // Canvas watermark refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const scrollXRef = useRef(0);
  const sponsorImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const logoRef = useRef<HTMLImageElement | null>(null);

  // Record-only state
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const recordingChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load existing live input
  useEffect(() => {
    getLiveInputs()
      .then((data: any) => {
        if (data?.liveInput) setLiveInput(data.liveInput);
      })
      .catch(() => {})
      .finally(() => setIsLoadingInputs(false));
  }, []);

  // Load recordings
  useEffect(() => {
    getRecordings()
      .then((data: any) => {
        if (data?.recordings) setRecordings(data.recordings);
      })
      .catch(() => {})
      .finally(() => setIsLoadingRecordings(false));
  }, []);

  // Poll stream status every 10 seconds
  const fetchStatus = useCallback(() => {
    getStreamStatus()
      .then((data: any) => setStatus(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBroadcast();
      stopRecordingCleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load business logo for watermark — from settings first, fallback to /logo.png
  useEffect(() => {
    const token = localStorage.getItem('pw_token');
    fetch('/api/v1/settings', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json()).then(data => {
        const logoUrl = data?.logoUrl || '/logo.png';
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { logoRef.current = img; };
        img.src = logoUrl;
      }).catch(() => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { logoRef.current = img; };
        img.src = '/logo.png';
      });
  }, []);

  // Load sponsors from settings
  useEffect(() => {
    const token = localStorage.getItem('pw_token');
    fetch('/api/v1/settings', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json()).then(data => {
        if (Array.isArray(data?.sponsors) && data.sponsors.length > 0) {
          setSponsors(data.sponsors);
        }
        if (data?.facebookPageId && data?.facebookPageAccessToken) {
          setFbConnected(true);
        }
      }).catch(() => {});
  }, []);

  // Load sponsor logo images
  const loadSponsorImage = useCallback((id: string, url: string) => {
    if (!url) { delete sponsorImagesRef.current[id]; return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { sponsorImagesRef.current[id] = img; };
    img.onerror = () => { delete sponsorImagesRef.current[id]; };
    img.src = url;
  }, []);

  useEffect(() => {
    sponsors.forEach(s => {
      if (s.logoUrl && (!sponsorImagesRef.current[s.id] || sponsorImagesRef.current[s.id].src !== s.logoUrl)) {
        loadSponsorImage(s.id, s.logoUrl);
      }
    });
  }, [sponsors, loadSponsorImage]);

  // Sponsor management
  const addSponsor = () => setSponsors(prev => [...prev, { id: Date.now().toString(), text: '', logoUrl: '' }]);
  const removeSponsor = (id: string) => { setSponsors(prev => prev.filter(s => s.id !== id)); delete sponsorImagesRef.current[id]; };
  const updateSponsor = (id: string, field: string, value: string) => {
    setSponsors(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    if (field === 'logoUrl') loadSponsorImage(id, value);
  };
  const saveSponsors = async () => {
    try {
      await fetch('/api/v1/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pw_token')}` }, body: JSON.stringify({ sponsors }) });
      toast('Sponsors saved!');
    } catch { toast('Failed to save sponsors', 'error'); }
  };

  // Simulcast functions
  const loadSimulcastOutputs = async () => {
    try {
      const token = localStorage.getItem('pw_token');
      const res = await fetch('/api/v1/stream/simulcast', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setSimulcastOutputs(data.outputs || []);
    } catch {}
  };

  const addSimulcastOutput = async () => {
    if (!fbRtmpUrl.trim() || !fbStreamKey.trim()) { toast('Enter RTMP URL and Stream Key', 'error'); return; }
    setAddingOutput(true);
    try {
      const token = localStorage.getItem('pw_token');
      const res = await fetch('/api/v1/stream/simulcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: fbRtmpUrl.trim(), streamKey: fbStreamKey.trim() }),
      });
      if (res.ok) {
        toast('Simulcast output added!');
        setFbRtmpUrl(''); setFbStreamKey('');
        loadSimulcastOutputs();
      } else {
        const err = await res.json().catch(() => ({}));
        toast((err as any).error || 'Failed to add output', 'error');
      }
    } catch { toast('Failed to add output', 'error'); }
    setAddingOutput(false);
  };

  const removeSimulcastOutput = async (outputId: string) => {
    if (!window.confirm('Remove this simulcast destination?')) return;
    try {
      const token = localStorage.getItem('pw_token');
      await fetch(`/api/v1/stream/simulcast?outputId=${outputId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      toast('Output removed');
      loadSimulcastOutputs();
    } catch { toast('Failed to remove', 'error'); }
  };

  const toggleSimulcastOutput = async (outputId: string, enabled: boolean) => {
    try {
      const token = localStorage.getItem('pw_token');
      await fetch('/api/v1/stream/simulcast', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outputId, enabled }),
      });
      toast(enabled ? 'Simulcast enabled' : 'Simulcast paused');
      loadSimulcastOutputs();
    } catch { toast('Failed to toggle', 'error'); }
  };

  // Delete a recording
  const deleteRecording = async (uid: string) => {
    if (!window.confirm('Permanently delete this recording? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('pw_token');
      const res = await fetch(`/api/v1/stream/recordings?id=${uid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setRecordings(prev => prev.filter(r => r.uid !== uid));
        toast('Recording deleted');
      } else {
        const err = await res.json().catch(() => ({}));
        toast((err as any).error || 'Failed to delete', 'error');
      }
    } catch { toast('Failed to delete recording', 'error'); }
  };

  // Build ticker items for canvas drawing
  const getTickerItems = useCallback(() => {
    return sponsors.filter(s => s.text || (s.logoUrl && sponsorImagesRef.current[s.id])).map(s => ({
      text: s.text || '', img: sponsorImagesRef.current[s.id] || null, id: s.id,
    }));
  }, [sponsors]);

  // Canvas frame drawing — watermark + sponsor ticker
  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) { animFrameRef.current = requestAnimationFrame(drawFrame); return; }
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    // Draw raw video
    ctx.drawImage(video, 0, 0, w, h);
    const fontSize = Math.max(12, w * 0.025);

    // Top-left: Logo + "HUGHESYS QUE" watermark — positioned below the LIVE badge area
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    const logoSize = fontSize * 1.8;
    const logoX = fontSize * 0.5;
    const logoY = fontSize * 3.5; // Below LIVE badge + timer
    let textX = logoX;
    if (logoRef.current) {
      ctx.drawImage(logoRef.current, logoX, logoY, logoSize, logoSize);
      textX = logoX + logoSize + fontSize * 0.4;
    }
    ctx.font = `bold ${fontSize * 1.2}px Inter, sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('HUGHESYS QUE', textX, logoY + (logoSize - fontSize * 1.2) / 2);
    ctx.restore();

    // Bottom: Scrolling sponsor ticker bar
    const tickerItems = getTickerItems();
    if (tickerItems.length > 0) {
      const barHeight = fontSize * 2.2;
      const barY = h - barHeight;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, barY, w, barHeight);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.fillRect(0, barY, w, 2);
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 2;

      const logoH = barHeight * 0.55;
      const gap = fontSize * 0.5;
      const spacing = fontSize * 2.5;
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      const sepWidth = ctx.measureText('  ·  ').width;

      let totalWidth = 0;
      const measured = tickerItems.map(item => {
        let itemWidth = 0;
        let logoW = 0;
        if (item.img) {
          const aspect = item.img.naturalWidth / item.img.naturalHeight;
          logoW = logoH * aspect;
          itemWidth += logoW;
          if (item.text) itemWidth += gap;
        }
        let textW = 0;
        if (item.text) { textW = ctx.measureText(item.text).width; itemWidth += textW; }
        totalWidth += itemWidth;
        return { ...item, itemWidth, logoW, logoH, textW };
      });
      if (measured.length > 1) totalWidth += (measured.length - 1) * (sepWidth + spacing);

      scrollXRef.current -= scrollSpeed;
      if (scrollXRef.current < -totalWidth - spacing) scrollXRef.current = w;
      const centerY = barY + barHeight / 2;

      for (let pass = 0; pass < 2; pass++) {
        let drawX = scrollXRef.current + pass * (totalWidth + w * 0.3 + spacing);
        for (let i = 0; i < measured.length; i++) {
          const item = measured[i];
          if (item.img) { ctx.drawImage(item.img, drawX, centerY - item.logoH / 2, item.logoW, item.logoH); drawX += item.logoW + gap; }
          if (item.text) { ctx.fillStyle = 'white'; ctx.font = `bold ${fontSize}px Inter, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(item.text, drawX, centerY); drawX += item.textW; }
          if (i < measured.length - 1) { drawX += spacing * 0.5; ctx.fillStyle = 'rgba(251, 191, 36, 0.7)'; ctx.fillText('·', drawX, centerY); drawX += sepWidth * 0.3 + spacing * 0.5; }
        }
      }
      ctx.restore();
    }

    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [getTickerItems, scrollSpeed]);

  // Re-bind drawFrame when sponsors change
  useEffect(() => {
    if ((isBroadcasting || isRecording) && animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(drawFrame);
    }
  }, [drawFrame, isBroadcasting, isRecording]);

  const handleCreateInput = async () => {
    setIsCreating(true);
    try {
      const data = await createLiveInput();
      if ((data as any)?.liveInput) {
        setLiveInput((data as any).liveInput);
        toast('Live input created! You can now go live.');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to create live input', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const goLive = async () => {
    if (!liveInput?.webRTC?.url) {
      toast('No WebRTC URL available. Create a live input first.', 'error');
      return;
    }

    setIsGoingLive(true);

    try {
      // Create Facebook Live video + start RTMP relay if enabled
      let fbRelayReady = false;
      if (fbSimulcast && fbConnected) {
        try {
          toast('Setting up Facebook Live...', 'info');
          const token = localStorage.getItem('pw_token');
          const fbRes = await fetch('/api/v1/stream/facebook-live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ title: streamTitle, description: fbDescription || `${streamTitle} - Live from Hughesys Que 🔥🍖` }),
          });
          const fbData: any = await fbRes.json();
          if (fbRes.ok && fbData.success && fbData.streamUrl) {
            // Start RTMP relay session
            const relayUrl = 'https://hughesysque-rtmp-relay.fly.dev';
            const relayRes = await fetch(`${relayUrl}/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rtmpUrl: fbData.rtmpUrl, streamKey: fbData.streamKey }),
            });
            const relayData: any = await relayRes.json();
            if (relayData.sessionId) {
              // Connect WebSocket to relay
              const wsUrl = `${relayUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/${relayData.sessionId}`;
              const ws = new WebSocket(wsUrl);
              ws.binaryType = 'arraybuffer';
              ws.onopen = () => { toast('Facebook Live relay connected!'); };
              ws.onmessage = (e) => {
                try {
                  const msg = JSON.parse(e.data as string);
                  if (msg.type === 'connected') toast('Streaming to Facebook!');
                  if (msg.type === 'error') toast(`FB relay: ${msg.error}`, 'warning');
                } catch {}
              };
              ws.onerror = () => { toast('Facebook relay connection lost', 'warning'); };
              relayWsRef.current = ws;
              fbRelayReady = true;
            }
          } else {
            toast(`Facebook Live failed: ${fbData.error || 'Unknown error'}. Continuing without FB.`, 'warning');
          }
        } catch (e: any) {
          toast(`Facebook setup error: ${e.message}. Continuing without FB.`, 'warning');
        }
      }
      // Get camera + mic
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });

      streamRef.current = mediaStream;

      // Show local preview in hidden video, draw watermarked frames to canvas
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        // Wait for video to have actual frames before starting canvas
        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          const onReady = () => {
            v.removeEventListener('loadeddata', onReady);
            resolve();
          };
          if (v.readyState >= 2) { resolve(); return; }
          v.addEventListener('loadeddata', onReady);
          // Timeout fallback
          setTimeout(resolve, 3000);
        });

        try { await videoRef.current.play(); } catch {}
      }

      // Small delay to ensure video frames are flowing
      await new Promise(r => setTimeout(r, 500));

      // Start canvas drawing loop for watermark + sponsor ticker
      animFrameRef.current = requestAnimationFrame(drawFrame);

      // Capture canvas stream (watermarked video) + raw audio
      if (canvasRef.current) {
        canvasStreamRef.current = canvasRef.current.captureStream(30);
      }

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
        bundlePolicy: 'max-bundle',
      });
      pcRef.current = pc;

      // Add watermarked video from canvas + audio from raw stream
      const canvasVideoTrack = canvasStreamRef.current?.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (canvasVideoTrack) pc.addTransceiver(canvasVideoTrack, { direction: 'sendonly' });
      if (audioTrack) pc.addTransceiver(audioTrack, { direction: 'sendonly' });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete (or timeout)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
        // Timeout after 5 seconds
        setTimeout(() => {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }, 5000);
      });

      // Send offer to Cloudflare WHIP endpoint
      const whipUrl = liveInput.webRTC.url;
      const res = await fetch(whipUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription!.sdp,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`WHIP failed (${res.status}): ${errText.slice(0, 200)}`);
      }

      // Set remote answer
      const answerSdp = await res.text();
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));

      // We're live!
      setIsBroadcasting(true);
      setStreamDuration(0);
      startTimeRef.current = Date.now();
      durationRef.current = setInterval(() => {
        setStreamDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      toast('You are LIVE!');

      // Start sending video to Facebook relay if connected
      if (fbRelayReady && relayWsRef.current && streamRef.current) {
        try {
          // Use raw stream for relay — includes both video + audio
          const relayStream = streamRef.current.clone();

          // Detect best format — Safari uses MP4, Chrome/Android use WebM
          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')
            ? 'video/webm;codecs=h264,opus'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : '';

          if (!mimeType) { console.warn('[FB Relay] No supported recording format'); }

          // Tell relay what format we're sending
          relayWsRef.current?.send(JSON.stringify({ type: 'format', mimeType }));

          const recorder = new MediaRecorder(relayStream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 2500000 });
          relayRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && relayWsRef.current?.readyState === WebSocket.OPEN) {
              e.data.arrayBuffer().then(buf => {
                relayWsRef.current?.send(buf);
              });
            }
          };

          recorder.start(1000); // Send chunks every 1 second
          console.log('[FB Relay] MediaRecorder started, sending to relay');
        } catch (e: any) {
          console.warn('[FB Relay] MediaRecorder error:', e.message);
        }
      }

      // Refresh status after a short delay
      setTimeout(fetchStatus, 3000);
    } catch (err: any) {
      console.error('Go live error:', err);
      toast(err.message || 'Failed to go live', 'error');
      // Cleanup on failure
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
    } finally {
      setIsGoingLive(false);
    }
  };

  const stopBroadcast = () => {
    // Stop Facebook relay
    if (relayRecorderRef.current) {
      try { relayRecorderRef.current.stop(); } catch {}
      relayRecorderRef.current = null;
    }
    if (relayWsRef.current) {
      try { relayWsRef.current.send(JSON.stringify({ type: 'end' })); } catch {}
      try { relayWsRef.current.close(); } catch {}
      relayWsRef.current = null;
    }

    // Stop media tracks
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    canvasStreamRef.current = null;

    // Stop canvas animation
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }

    // Close peer connection
    pcRef.current?.close();
    pcRef.current = null;

    // Clear duration timer
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsBroadcasting(false);
    setStreamDuration(0);

    // Refresh status
    setTimeout(fetchStatus, 2000);
  };

  const toggleCamera = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  const switchCamera = async () => {
    if (!streamRef.current || !pcRef.current) return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
      // Replace old video track in stream
      const oldVideoTrack = streamRef.current.getVideoTracks()[0];
      streamRef.current.removeTrack(oldVideoTrack);
      oldVideoTrack.stop();
      streamRef.current.addTrack(newVideoTrack);
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        try { await videoRef.current.play(); } catch {}
      }
      setFacingMode(newFacing);
    } catch {
      toast('Could not switch camera', 'error');
    }
  };

  // --- Record-only functions ---

  const startRecording = async () => {
    setIsStartingRecording(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        await new Promise<void>((resolve) => {
          const v = videoRef.current!;
          if (v.readyState >= 2) { resolve(); return; }
          v.addEventListener('loadeddata', () => resolve(), { once: true });
          setTimeout(resolve, 3000);
        });

        try { await videoRef.current.play(); } catch {}
      }

      await new Promise(r => setTimeout(r, 500));

      // Start canvas drawing for watermark
      animFrameRef.current = requestAnimationFrame(drawFrame);

      // Record from canvas (watermarked) + raw audio
      let recordStream: MediaStream;
      if (canvasRef.current) {
        const canvasStream = canvasRef.current.captureStream(30);
        const audioTrack = mediaStream.getAudioTracks()[0];
        if (audioTrack) canvasStream.addTrack(audioTrack);
        recordStream = canvasStream;
      } else {
        recordStream = mediaStream;
      }

      // Pick best supported mime type
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(recordStream, { mimeType });
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      recorder.start(1000); // collect data every second

      setIsRecording(true);
      setStreamDuration(0);
      startTimeRef.current = Date.now();
      durationRef.current = setInterval(() => {
        setStreamDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      toast('Recording started!');
    } catch (err: any) {
      console.error('Start recording error:', err);
      toast(err.message || 'Failed to start recording', 'error');
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    } finally {
      setIsStartingRecording(false);
    }
  };

  const stopRecordingCleanup = () => {
    // Stop media tracks
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    // Stop canvas animation
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsRecording(false);
    setStreamDuration(0);
  };

  const stopAndSaveRecording = async () => {
    if (!mediaRecorderRef.current) return;

    // Stop the recorder and wait for final data
    await new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    // Stop media tracks & timer
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsRecording(false);

    // Build blob and upload
    const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
    recordingChunksRef.current = [];

    if (blob.size === 0) {
      toast('Recording was empty — nothing to save.', 'error');
      setStreamDuration(0);
      return;
    }

    const title = `Recording ${new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress since we can't track actual XHR progress with fetch
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      await uploadRecording(blob, title);

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast('Video saved!');

      // Refresh recordings list
      getRecordings()
        .then((data: any) => {
          if (data?.recordings) setRecordings(data.recordings);
        })
        .catch(() => {});
    } catch (err: any) {
      console.error('Upload error:', err);
      toast(err.message || 'Failed to upload recording', 'error');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setStreamDuration(0);
      }, 1500);
    }
  };

  const toggleRecordingCamera = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  };

  const toggleRecordingMic = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  const switchRecordingCamera = async () => {
    if (!streamRef.current || !mediaRecorderRef.current) return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      // Replace old video track in the stream
      const oldVideoTrack = streamRef.current.getVideoTracks()[0];
      streamRef.current.removeTrack(oldVideoTrack);
      oldVideoTrack.stop();
      streamRef.current.addTrack(newVideoTrack);
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        try { await videoRef.current.play(); } catch {}
      }
      setFacingMode(newFacing);
    } catch {
      toast('Could not switch camera', 'error');
    }
  };

  // Chat moderation — polling
  useEffect(() => {
    if (!showChat) return;
    const fetchChat = () => {
      const lastMsg = chatMessages[chatMessages.length - 1];
      getChatMessages('live-main', lastMsg?.createdAt)
        .then((data: any) => {
          if (data?.messages?.length > 0) {
            setChatMessages((prev: any[]) => {
              const ids = new Set(prev.map((m: any) => m.id));
              const fresh = data.messages.filter((m: any) => !ids.has(m.id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        })
        .catch(() => {});
    };
    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [showChat, chatMessages]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleDeleteMessage = async (id: string) => {
    try {
      await deleteChatMessage(id);
      setChatMessages(prev => prev.filter(m => m.id !== id));
      toast('Message deleted');
    } catch { toast('Failed to delete', 'error'); }
  };

  const handleBanUser = async (userName: string) => {
    try {
      await banChatUser(userName, 'Banned by admin');
      setChatMessages(prev => prev.filter(m => m.userName !== userName));
      toast(`${userName} banned`);
    } catch { toast('Failed to ban', 'error'); }
  };

  const handleUnbanUser = async (userName: string) => {
    try {
      await unbanChatUser(userName);
      setChatBans(prev => prev.filter(b => b.userName !== userName));
      toast(`${userName} unbanned`);
    } catch { toast('Failed to unban', 'error'); }
  };

  const loadBans = async () => {
    try {
      const data = await getChatBans('live-main');
      setChatBans(data?.bans || []);
      setShowBanList(true);
    } catch { toast('Failed to load bans', 'error'); }
  };

  const openShareModal = (rec: Recording) => {
    setShareRecording(rec);
    setShareCaption(`Check out this video from Hughesys Que! 🔥🍖\n\n${rec.title || 'Live Cook'}\n\nWatch: ${rec.previewUrl}`);
    setShareHashtags('#HughesysQue #BBQ #LowAndSlow #Smoking #QueLife');
    setShareSuccess(false);
  };

  const handleShareToSocials = async () => {
    if (!shareRecording || !shareCaption.trim()) return;
    setIsSharing(true);
    try {
      const id = crypto.randomUUID();
      const hashtagArr = shareHashtags.split(/\s+/).filter(h => h.startsWith('#'));
      await upsertSocialPost({
        id,
        platform: sharePlatform,
        content: shareCaption,
        image: shareRecording.thumbnail || null,
        scheduledFor: new Date().toISOString(),
        status: 'Draft',
        hashtags: hashtagArr,
      } as any);
      setShareSuccess(true);
      toast(`Draft post created for ${sharePlatform}!`);
      setTimeout(() => {
        setShareRecording(null);
        setShareSuccess(false);
      }, 1500);
    } catch (err: any) {
      toast(err.message || 'Failed to create post', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-700 pb-2">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Video size={22} className="text-bbq-red" />
          Live Stream
        </h3>
        {isRecording && (
          <div className="flex items-center gap-2 bg-blue-900/40 border border-blue-600 px-3 py-1.5 rounded-full">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
            <span className="text-blue-300 text-xs font-bold uppercase tracking-wider">Recording</span>
          </div>
        )}
        {!isRecording && (isBroadcasting || status?.live) && (
          <div className="flex items-center gap-2 bg-red-900/40 border border-red-600 px-3 py-1.5 rounded-full">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-red-300 text-xs font-bold uppercase tracking-wider">Live Now</span>
          </div>
        )}
      </div>

      {/* Broadcast Controls */}
      {isLoadingInputs ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading...
        </div>
      ) : !liveInput ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-xl">
          <Video size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">Set up your live stream channel</p>
          <p className="text-gray-600 text-sm mb-6">One-time setup — creates your streaming endpoint on Cloudflare.</p>
          <button
            onClick={handleCreateInput}
            disabled={isCreating}
            className="bg-bbq-red px-8 py-3 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-red-700 text-white mx-auto disabled:opacity-50"
          >
            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
            {isCreating ? 'Setting up...' : 'Set Up Live Stream'}
          </button>
        </div>
      ) : isRecording ? (
        /* RECORDING — show preview + controls */
        <div className="space-y-4">
          {/* Video preview — canvas with watermark */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-blue-600/60 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
            <canvas ref={canvasRef} className="w-full bg-black" style={{ maxHeight: '70vh', objectFit: 'contain' }} />

            {/* Overlay: REC badge + duration */}
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <div className="flex items-center gap-2 bg-blue-600 px-3 py-1.5 rounded-full shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <span className="text-white text-xs font-black uppercase">Rec</span>
              </div>
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-mono font-bold flex items-center gap-1.5">
                <Clock size={12} /> {formatDuration(streamDuration)}
              </div>
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={toggleRecordingCamera}
              className={`p-3 rounded-full transition ${cameraOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-900 text-red-300'}`}
              title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {cameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>

            <button
              onClick={toggleRecordingMic}
              className={`p-3 rounded-full transition ${micOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-900 text-red-300'}`}
              title={micOn ? 'Mute mic' : 'Unmute mic'}
            >
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button
              onClick={switchRecordingCamera}
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition"
              title="Switch camera"
            >
              <RefreshCw size={20} />
            </button>

            {/* STOP & SAVE button */}
            <button
              onClick={stopAndSaveRecording}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full flex items-center gap-2 shadow-lg transition ml-4"
            >
              <Square size={16} fill="currentColor" /> Stop & Save
            </button>
          </div>
        </div>
      ) : isUploading ? (
        /* UPLOADING state */
        <div className="text-center py-12">
          <Upload size={48} className="mx-auto text-blue-400 mb-4 animate-bounce" />
          <p className="text-white font-bold text-lg mb-2">Uploading recording...</p>
          <div className="w-64 mx-auto bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-gray-400 text-sm mt-2">{uploadProgress}%</p>
        </div>
      ) : !isBroadcasting ? (
        /* GO LIVE + RECORD buttons */
        <div className="py-8 space-y-6">
          {/* Stream settings */}
          <div className="max-w-lg mx-auto space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Stream Title</label>
              <input value={streamTitle} onChange={e => setStreamTitle(e.target.value)}
                placeholder="Live from Hughesys Que"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm" />
            </div>
            {fbConnected && (
              <>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Facebook Description</label>
                  <textarea value={fbDescription} onChange={e => setFbDescription(e.target.value)}
                    placeholder="We're live! Join us for a cook session 🔥🍖"
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm resize-none" />
                </div>
                <div className="flex items-center justify-between bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Facebook size={16} className="text-blue-400" />
                    <span className="text-sm text-white font-bold">Simulcast to Facebook</span>
                  </div>
                  <button onClick={() => setFbSimulcast(!fbSimulcast)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${fbSimulcast ? 'bg-blue-600' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${fbSimulcast ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </>
            )}
            {!fbConnected && (
              <p className="text-xs text-gray-600 text-center">Connect Facebook in Settings to simulcast live streams to your Page.</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={goLive}
              disabled={isGoingLive || isStartingRecording}
              className="relative bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black uppercase tracking-widest text-lg px-12 py-5 rounded-full flex items-center gap-3 shadow-[0_0_40px_rgba(220,38,38,0.4)] hover:shadow-[0_0_60px_rgba(220,38,38,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGoingLive ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Radio size={24} />
                  Go Live
                </>
              )}
            </button>

            <button
              onClick={startRecording}
              disabled={isGoingLive || isStartingRecording}
              className="relative bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-black uppercase tracking-widest text-lg px-12 py-5 rounded-full flex items-center gap-3 shadow-[0_0_40px_rgba(37,99,235,0.3)] hover:shadow-[0_0_60px_rgba(37,99,235,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStartingRecording ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Video size={24} />
                  Record Video
                </>
              )}
            </button>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            <strong>Go Live</strong> broadcasts to viewers in real-time. <strong>Record Video</strong> saves locally and uploads when done.
          </p>

          {/* Stream status when not broadcasting */}
          {status && (
            <div className="mt-6 inline-flex items-center gap-3 bg-gray-900 border border-gray-700 px-4 py-2 rounded-full text-sm">
              <Radio size={14} className={status.live ? 'text-red-400' : 'text-gray-500'} />
              <span className={status.live ? 'text-red-400 font-bold' : 'text-gray-400'}>
                {status.live ? 'LIVE' : 'Offline'}
              </span>
              {status.live && (
                <span className="text-gray-400 flex items-center gap-1">
                  <Eye size={12} /> {status.viewerCount}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        /* BROADCASTING — show preview + controls */
        <div className="space-y-4">
          {/* Video preview — show canvas (watermarked) over hidden raw video */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-red-600/60 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
              style={{ display: 'none' }}
            />
            <canvas ref={canvasRef} className="w-full bg-black" style={{ maxHeight: '70vh', objectFit: 'contain' }} />

            {/* Overlay: duration + viewers */}
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <div className="flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-full shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <span className="text-white text-xs font-black uppercase">Live</span>
              </div>
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-mono font-bold flex items-center gap-1.5">
                <Clock size={12} /> {formatDuration(streamDuration)}
              </div>
            </div>

            <div className="absolute top-4 right-4">
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-bold flex items-center gap-1.5">
                <Eye size={12} className="text-bbq-gold" /> {status?.viewerCount ?? 0}
              </div>
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-full transition ${cameraOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-900 text-red-300'}`}
              title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {cameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>

            <button
              onClick={toggleMic}
              className={`p-3 rounded-full transition ${micOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-900 text-red-300'}`}
              title={micOn ? 'Mute mic' : 'Unmute mic'}
            >
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button
              onClick={switchCamera}
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition"
              title="Switch camera"
            >
              <RefreshCw size={20} />
            </button>

            {/* STOP button */}
            <button
              onClick={() => { stopBroadcast(); toast('Stream ended.'); }}
              className="bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full flex items-center gap-2 shadow-lg transition ml-4"
            >
              <Square size={16} fill="currentColor" /> End Stream
            </button>
          </div>
        </div>
      )}

      {/* Live preview from CF (when live but not broadcasting from this device) */}
      {status?.live && !isBroadcasting && status.previewUrl && (
        <div className="bg-gray-900 p-4 rounded-lg border border-red-700/50">
          <p className="text-xs text-gray-500 uppercase font-bold mb-2">Live Preview</p>
          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-gray-700">
            <iframe
              src={status.previewUrl}
              className="w-full h-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title="Live Stream Preview"
            />
          </div>
        </div>
      )}

      {/* Sponsor Ticker Management — at top for live preview */}
      <div>
        <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-4">
          <h4 className="font-bold text-lg text-white flex items-center gap-2">
            <Image size={18} className="text-bbq-gold" />
            Sponsor Ticker
          </h4>
          <div className="flex items-center gap-2">
            <button onClick={addSponsor} className="text-xs bg-bbq-gold hover:bg-yellow-400 text-black px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition">
              <Plus size={12} /> Add Sponsor
            </button>
            <button onClick={() => setShowSponsorPanel(!showSponsorPanel)}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${showSponsorPanel ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
              {showSponsorPanel ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {showSponsorPanel && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Logos and text scroll across the bottom of the stream. Add multiple sponsors — they rotate in a ticker.</p>
            {sponsors.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-800 rounded-lg text-gray-500">
                <Image size={32} className="mx-auto mb-2 opacity-40" />
                <p>No sponsors added. Click "Add Sponsor" to include branding in the stream.</p>
              </div>
            ) : (
              sponsors.map((sponsor, idx) => (
                <div key={sponsor.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sponsor {idx + 1}</span>
                    <button onClick={() => removeSponsor(sponsor.id)} className="text-red-400 hover:text-red-300 p-1 transition"><Trash2 size={14} /></button>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Name / Text</label>
                    <input value={sponsor.text} onChange={e => updateSponsor(sponsor.id, 'text', e.target.value)}
                      placeholder="e.g. Gladstone Meat Co" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Logo</label>
                    <div className="flex gap-2">
                      <input value={sponsor.logoUrl} onChange={e => updateSponsor(sponsor.id, 'logoUrl', e.target.value)}
                        placeholder="URL or upload →" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm font-mono" />
                      <label className="cursor-pointer p-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition shrink-0" title="Upload logo">
                        <Upload size={14} className="text-gray-300" />
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          if (file.size > 500000) { toast('Logo must be under 500KB', 'error'); return; }
                          const reader = new FileReader();
                          reader.onload = () => { updateSponsor(sponsor.id, 'logoUrl', reader.result as string); };
                          reader.readAsDataURL(file); e.target.value = '';
                        }} />
                      </label>
                    </div>
                    {sponsor.logoUrl && (
                      <div className="mt-2 p-2 bg-white rounded-lg inline-flex items-center gap-2">
                        <img src={sponsor.logoUrl} alt="" style={{ height: 32, maxWidth: 120, objectFit: 'contain' }} onError={(e: any) => { e.target.style.display = 'none'; }} />
                        <button onClick={() => updateSponsor(sponsor.id, 'logoUrl', '')} className="text-gray-400 hover:text-red-400 transition p-0.5" title="Remove"><X size={12} /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-400">Scroll Speed</label>
                <span className="text-xs text-gray-500 font-bold">{scrollSpeed < 0.8 ? 'Slow' : scrollSpeed < 1.5 ? 'Normal' : scrollSpeed < 2.5 ? 'Fast' : 'Very Fast'}</span>
              </div>
              <input type="range" min={0.3} max={3.5} step={0.1} value={scrollSpeed} onChange={e => setScrollSpeed(parseFloat(e.target.value))} className="w-full" style={{ accentColor: '#fbbf24' }} />
            </div>
            <button onClick={saveSponsors} className="w-full bg-bbq-gold hover:bg-yellow-400 text-black font-bold py-2.5 rounded-lg transition text-sm">Save Sponsors</button>
          </div>
        )}
      </div>

      {/* Past Recordings */}
      <div>
        <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-4">
          <h4 className="font-bold text-lg text-white flex items-center gap-2">
            <Play size={18} className="text-bbq-gold" />
            Recordings
          </h4>
          <span className="text-xs text-gray-500">{recordings.length} recording{recordings.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoadingRecordings ? (
          <div className="flex items-center justify-center py-4 text-gray-500">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading...
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-800 rounded-lg text-gray-500">
            <Play size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No recordings yet. Past streams will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recordings.map(rec => (
              <div key={rec.uid} className="flex items-center gap-3 bg-gray-800/50 rounded-lg border border-gray-700 p-2 hover:border-gray-500 transition group">
                {/* Thumbnail */}
                <div className="w-24 h-14 rounded-lg overflow-hidden bg-black shrink-0 relative cursor-pointer" onClick={() => setPreviewRecording(rec)}>
                  {rec.thumbnail ? (
                    <img src={rec.thumbnail} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Video size={16} className="text-gray-700" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition flex items-center justify-center">
                    <Play size={14} className="text-white opacity-0 group-hover:opacity-100 transition" />
                  </div>
                  {rec.duration > 0 && (
                    <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] px-1 py-0.5 rounded font-mono">{formatDuration(rec.duration)}</div>
                  )}
                </div>
                {/* Title + Date */}
                <div className="flex-1 min-w-0">
                  <input
                    value={rec.title || ''}
                    onChange={e => setRecordings(prev => prev.map(r => r.uid === rec.uid ? { ...r, title: e.target.value } : r))}
                    className="bg-transparent text-white text-sm font-bold w-full border-0 p-0 focus:outline-none focus:ring-0 placeholder:text-gray-600 truncate"
                    placeholder="Untitled Stream"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(rec.created)}</p>
                </div>
                {/* Actions */}
                <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openShareModal(rec)} className="p-1.5 rounded bg-gray-700 hover:bg-bbq-gold hover:text-black text-gray-400 transition" title="Share"><Share2 size={12} /></button>
                  <button onClick={() => deleteRecording(rec.uid)} className="p-1.5 rounded bg-gray-700 hover:bg-red-900 text-gray-400 hover:text-red-400 transition" title="Delete"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Moderation */}
      <div>
        <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-4">
          <h4 className="font-bold text-lg text-white flex items-center gap-2">
            <MessageCircle size={18} className="text-bbq-gold" />
            Live Chat Moderation
          </h4>
          <div className="flex items-center gap-2">
            <button
              onClick={loadBans}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
            >
              <Shield size={12} /> Ban List
            </button>
            <button
              onClick={() => { setShowChat(!showChat); if (!showChat) setChatMessages([]); }}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${showChat ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
            >
              <MessageCircle size={12} /> {showChat ? 'Hide Chat' : 'Show Chat'}
            </button>
          </div>
        </div>

        {showChat && (
          <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            <div className="h-[300px] overflow-y-auto p-3 space-y-1">
              {chatMessages.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No messages yet. Chat will appear here when viewers start talking.</p>
              ) : (
                chatMessages.map((msg: any) => (
                  <div key={msg.id} className="flex items-start gap-2 group hover:bg-white/5 px-2 py-1 rounded">
                    <div className="flex-1 min-w-0">
                      <span className={`font-bold text-xs ${msg.isAdmin ? 'text-bbq-gold' : 'text-blue-400'}`}>
                        {msg.isAdmin && '\u2605 '}{msg.userName}
                      </span>
                      <span className="text-gray-300 text-xs ml-2">{msg.message}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition"
                        title="Delete message"
                      >
                        <Trash2 size={12} />
                      </button>
                      {!msg.isAdmin && (
                        <button
                          onClick={() => handleBanUser(msg.userName)}
                          className="p-1 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition"
                          title={`Ban ${msg.userName}`}
                        >
                          <Ban size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* Ban list modal */}
        {showBanList && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowBanList(false)}>
            <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Shield size={18} className="text-red-400" /> Banned Users
                </h4>
                <button onClick={() => setShowBanList(false)} className="text-gray-400 hover:text-white transition">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                {chatBans.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">No banned users.</p>
                ) : (
                  <div className="space-y-2">
                    {chatBans.map((ban: any) => (
                      <div key={ban.id} className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded-lg">
                        <div>
                          <p className="text-white text-sm font-bold">{ban.userName}</p>
                          <p className="text-gray-500 text-xs">{ban.reason || 'No reason'}</p>
                        </div>
                        <button
                          onClick={() => handleUnbanUser(ban.userName)}
                          className="text-xs bg-green-800 hover:bg-green-700 text-green-300 px-3 py-1 rounded-lg transition"
                        >
                          Unban
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Facebook simulcast is now automatic — handled by the Go Live button */}

      {/* Recording Preview Modal */}
      {previewRecording && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewRecording(null)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h4 className="font-bold text-white">{previewRecording.title || 'Untitled Stream'}</h4>
              <button onClick={() => setPreviewRecording(null)} className="text-gray-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                src={previewRecording.previewUrl}
                className="w-full h-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={previewRecording.title}
              />
            </div>
            <div className="p-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">{formatDate(previewRecording.created)}</span>
              <div className="flex items-center gap-3 text-gray-400">
                {previewRecording.duration > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> {formatDuration(previewRecording.duration)}
                  </span>
                )}
                <button
                  onClick={() => { setPreviewRecording(null); openShareModal(previewRecording); }}
                  className="flex items-center gap-1 hover:text-bbq-gold transition"
                >
                  <Share2 size={14} /> Share
                </button>
                <a
                  href={previewRecording.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-white transition"
                >
                  <ExternalLink size={14} /> Open
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Share to Socials Modal */}
      {shareRecording && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShareRecording(null)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Share2 size={18} className="text-bbq-gold" /> Share to Socials
              </h4>
              <button onClick={() => setShareRecording(null)} className="text-gray-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            {shareSuccess ? (
              <div className="py-12 text-center">
                <Check size={48} className="mx-auto text-green-400 mb-3" />
                <p className="text-white font-bold text-lg">Draft Created!</p>
                <p className="text-gray-400 text-sm mt-1">Head to Social AI to review & post it.</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Video preview */}
                <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                  <div className="w-24 h-16 rounded-lg overflow-hidden bg-black shrink-0">
                    {shareRecording.thumbnail ? (
                      <img src={shareRecording.thumbnail} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Video size={20} className="text-gray-600" /></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-bold truncate">{shareRecording.title || 'Untitled'}</p>
                    <p className="text-gray-500 text-xs">{formatDate(shareRecording.created)}</p>
                  </div>
                </div>

                {/* Platform toggle */}
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1.5 block">Platform</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSharePlatform('Facebook')}
                      className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${sharePlatform === 'Facebook' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      <Facebook size={16} /> Facebook
                    </button>
                    <button
                      onClick={() => setSharePlatform('Instagram')}
                      className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${sharePlatform === 'Instagram' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      <Instagram size={16} /> Instagram
                    </button>
                  </div>
                </div>

                {/* Caption */}
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1.5 block">Caption</label>
                  <textarea
                    value={shareCaption}
                    onChange={(e) => setShareCaption(e.target.value)}
                    rows={5}
                    className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 focus:border-bbq-gold focus:outline-none resize-none"
                    placeholder="Write your caption..."
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1.5 block">Hashtags</label>
                  <input
                    type="text"
                    value={shareHashtags}
                    onChange={(e) => setShareHashtags(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 focus:border-bbq-gold focus:outline-none"
                    placeholder="#BBQ #HughesysQue #LowAndSlow"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShareRecording(null)}
                    className="flex-1 py-2.5 rounded-lg bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleShareToSocials}
                    disabled={isSharing || !shareCaption.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-bbq-gold text-black font-bold text-sm hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                    {isSharing ? 'Creating...' : 'Create Draft Post'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveStreamManager;
