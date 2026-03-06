import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Settings, Calendar, BarChart3, Wand2, Image as ImageIcon,
  Loader2, Trash2, Clock, CheckCircle, Zap, Save, Brain, Instagram, Facebook,
  Palette, Crown, ArrowRight, Star, Shield, ExternalLink, X, RefreshCw,
  HelpCircle, Users, Eye, ThumbsUp, MessageCircle, Share2, Link2,
  ChevronRight, AlertCircle, Info, BookOpen, Key, Globe, Monitor, Video
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import './SocialAI.css';

const PLAN_DETAILS = {
  starter: { name: 'Starter', price: 49, color: '#3b82f6', icon: Star, features: ['AI Content Generation', 'Content Calendar & Scheduling', 'AI-Powered Insights', 'Best Practices Knowledge Hub', '1 Brand Profile'] },
  professional: { name: 'Professional', price: 99, color: '#f59e0b', icon: Crown, popular: true, features: ['Everything in Starter', 'Research-Driven Smart Scheduler', 'AI Analyses Your Post Performance', 'Schedule Directly from Insights', 'AI Image Generation', 'AI Promotional Video Creation', 'White-Label Branding', '3 Brand Profiles'] },
  enterprise: { name: 'Enterprise', price: 199, color: '#a855f7', icon: Shield, features: ['Everything in Professional', 'Custom Domain', 'Priority Support', 'API Access', 'Unlimited Brand Profiles', 'Dedicated Account Manager'] }
};

// Ensure a value is always a string — prevents React error #31 when API returns error objects
const safeStr = (v) => (typeof v === 'string' ? v : (v?.message || (v && typeof v === 'object' ? JSON.stringify(v) : String(v || ''))));

// Shuffle helper for evolving content
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Large tip pools — users see different advice each visit
const QUICK_STATS_POOL = [
  { stat: '3–5x', label: 'More engagement with video content vs static images', color: '#f59e0b' },
  { stat: '10am–1pm', label: 'Peak engagement window for Facebook in Australia', color: '#1877f2' },
  { stat: '11am & 7pm', label: 'Best posting times for Instagram engagement', color: '#e1306c' },
  { stat: '3–7', label: 'Hashtags per Instagram post for optimal reach', color: '#a855f7' },
  { stat: '38%', label: 'More likes on posts featuring faces vs no faces', color: '#10b981' },
  { stat: '25.4%', label: 'More engagement on posts using emojis', color: '#f59e0b' },
  { stat: '6x', label: 'More interactions from Facebook Live vs regular video', color: '#1877f2' },
  { stat: '83%', label: 'More Story views when using polls, questions & stickers', color: '#e1306c' },
  { stat: '4.5x', label: 'Higher conversion from user-generated content vs brand content', color: '#34d399' },
  { stat: '23%', label: 'Follower growth boost from posting 4–7 Reels per week', color: '#a855f7' },
  { stat: '40–80', label: 'Ideal Facebook post character length for max engagement', color: '#1877f2' },
  { stat: '12%', label: 'Engagement increase from replying to comments within 60 min', color: '#10b981' }
];

const IG_TIPS_POOL = [
  { tip: 'Reels get 2x more reach than static posts — use them for tips and behind-the-scenes content', icon: '🎥' },
  { tip: 'Use 3–7 targeted hashtags instead of 30 generic ones — quality beats quantity since the 2024 algorithm update', icon: '#️⃣' },
  { tip: 'Post consistently 3–5 times per week. Instagram rewards accounts that show up regularly', icon: '📅' },
  { tip: 'Write captions that start with a hook — the first line decides if people read more or scroll past', icon: '🪝' },
  { tip: 'Carousel posts get 3x more engagement than single images — tell a story across slides', icon: '📸' },
  { tip: 'Reply to every comment within 1 hour to boost your post in the algorithm', icon: '⚡' },
  { tip: 'Use Stories daily with polls, questions, and quizzes to keep your audience engaged between posts', icon: '📊' },
  { tip: 'Collaborate with micro-influencers in your niche — they have 60% higher engagement than mega-influencers', icon: '🤝' },
  { tip: 'Save your best content as Highlights so new followers can browse your value immediately', icon: '⭐' },
  { tip: 'Post Reels at peak hours (7–8AM, 12–1PM, 7–9PM AEST) for maximum initial velocity', icon: '🕐' },
  { tip: 'Use trending audio in your Reels — the algorithm pushes content using popular sounds', icon: '🎵' },
  { tip: 'Geotag your posts to appear in local searches and increase discoverability', icon: '📍' },
  { tip: 'Alt text on images helps accessibility AND helps Instagram understand your content for search', icon: '♿' },
  { tip: 'Create "save-worthy" content (tips, how-tos, checklists) — saves signal value to the algorithm', icon: '🔖' },
  { tip: 'Engage with accounts in your niche 15 min before and after posting — this boosts your reach', icon: '💬' }
];

const FB_TIPS_POOL = [
  { tip: 'Video posts get 6x more engagement than text or link posts — even short clips outperform images', icon: '🎬' },
  { tip: 'Post 1–2 times per day max. Over-posting causes unfollows and algorithm penalties', icon: '⏰' },
  { tip: 'Ask questions in your posts — Facebook prioritises content that sparks conversations', icon: '❓' },
  { tip: 'Go Live at least once a month — Facebook Live gets 6x more interactions than regular video', icon: '🔴' },
  { tip: 'Share user-generated content and tag customers — social proof drives 4x more conversions', icon: '🏷️' },
  { tip: 'Use Facebook Groups to build community — group posts get 5x more organic reach than page posts', icon: '👥' },
  { tip: 'Pin your best-performing or most important post to the top of your page for new visitors', icon: '📌' },
  { tip: 'Native videos (uploaded directly) get 10x more reach than shared YouTube links', icon: '📹' },
  { tip: 'Posts with images get 2.3x more engagement than text-only posts', icon: '🖼️' },
  { tip: 'Schedule posts for Wed-Fri 9–10AM and 1–2PM AEST for peak Australian engagement', icon: '📅' },
  { tip: 'Use Facebook Events for promotions — they get free organic distribution in News Feed', icon: '🎉' },
  { tip: 'Reply to every comment to boost the post in the algorithm and build trust', icon: '💬' },
  { tip: 'Cross-post your best Instagram Reels to Facebook Reels — Meta rewards multi-platform creators', icon: '🔄' },
  { tip: 'Add a clear CTA in every post — "Comment below", "Share with a friend", "Tag someone who needs this"', icon: '📢' },
  { tip: 'Create a content series (e.g., "Tip Tuesday") to build anticipation and habitual engagement', icon: '🗓️' }
];

const STRATEGY_FACTS_POOL = [
  { fact: 'Posts with emojis get 25.4% more engagement than those without', source: 'Hootsuite 2024' },
  { fact: 'The ideal Facebook post length is 40–80 characters for maximum engagement', source: 'Buffer Research' },
  { fact: 'Content with faces gets 38% more likes and 32% more comments on Instagram', source: 'Georgia Tech Study' },
  { fact: 'Posting at consistent times trains your audience to expect and look for your content', source: 'Sprout Social' },
  { fact: 'User-generated content has a 4.5% higher conversion rate than brand-created content', source: 'Nosto Research' },
  { fact: 'Responding to comments within 60 minutes increases engagement by 12% on average', source: 'Socialinsider 2024' },
  { fact: 'Stories with stickers (polls, questions) get up to 83% more views than plain stories', source: 'Instagram Insights' },
  { fact: 'Brands that post 4–7 Reels per week see an average 23% increase in follower growth', source: 'Later 2024' },
  { fact: 'Videos under 60 seconds have the highest completion rate and engagement on both platforms', source: 'Wistia 2024' },
  { fact: 'Posts published on Wednesday see the highest overall engagement across platforms', source: 'Sprout Social 2024' },
  { fact: 'Brands that use storytelling in posts see 22x more memorability than facts alone', source: 'Stanford Research' },
  { fact: '90% of consumers say authenticity is important when deciding which brands to support', source: 'Stackla Report' },
  { fact: 'Posts asking a question receive 100% more comments than statements on Facebook', source: 'Buzzsumo Study' },
  { fact: 'Carousel posts on Instagram have the highest engagement rate of any format at 1.92%', source: 'Social Insider 2024' },
  { fact: 'Accounts that engage with others for 15 min before posting see 40% more reach', source: 'Later Research' },
  { fact: 'Branded hashtags generate 12.6% more engagement than generic industry hashtags', source: 'TrackMaven' }
];

// Premium AI Loading Overlay — shows animated research steps while AI works
const AI_STEPS = {
  schedule: [
    'Researching your past posts & engagement...',
    'Analyzing top-performing content patterns...',
    'Identifying your best days & times...',
    'Checking existing schedule for gaps...',
    'Crafting your data-driven content strategy...',
    'Generating optimized posts...',
    'Finalizing your content calendar...'
  ],
  insights: [
    'Pulling your latest post performance data...',
    'Analyzing engagement patterns & trends...',
    'Comparing against industry benchmarks...',
    'Identifying growth opportunities...',
    'Building your strategic recommendations...'
  ],
  generate: [
    'Studying your top-performing content style...',
    'Crafting platform-optimized copy...',
    'Engineering scroll-stopping hooks...',
    'Finalizing your post...'
  ]
};

const AILoadingOverlay = ({ type = 'schedule', title }) => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const steps = AI_STEPS[type] || AI_STEPS.schedule;

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, type === 'generate' ? 2500 : 3500);
    return () => clearInterval(interval);
  }, [steps.length, type]);

  const progress = Math.min(((currentStep + 1) / steps.length) * 90, 90);

  return (
    <div className="ai-loading-overlay">
      <div className="ai-loading-icon">
        <Brain size={28} color="white" />
      </div>
      <div className="ai-loading-status">
        <div className="ai-loading-title">{title || 'AI is Working'}</div>
        <div className="ai-loading-step" key={currentStep}>{steps[currentStep]}</div>
      </div>
      <div className="ai-loading-progress">
        <div className="ai-loading-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="ai-loading-steps-list">
        {steps.map((step, i) => (
          <div key={i} className={`ai-step-item ${i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending'}`}>
            <span className="ai-step-check">
              {i < currentStep ? <CheckCircle size={14} /> : i === currentStep ? <Loader2 size={14} className="spin" /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'block' }} />}
            </span>
            {step}
          </div>
        ))}
      </div>
      <div className="ai-loading-hint">This usually takes 10–20 seconds</div>
    </div>
  );
};

const SocialAI = ({ embedded = false }) => {
  const [activeTab, setActiveTab] = useState('command');
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // Evolving tips — randomly selected on each mount so users see different advice
  const [randomTips] = useState(() => ({
    quickStats: shuffle(QUICK_STATS_POOL).slice(0, 4),
    igTips: shuffle(IG_TIPS_POOL).slice(0, 7),
    fbTips: shuffle(FB_TIPS_POOL).slice(0, 7),
    facts: shuffle(STRATEGY_FACTS_POOL).slice(0, 8)
  }));

  // Content generator state
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedHashtags, setGeneratedHashtags] = useState([]);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  // Smart schedule state
  const [smartPosts, setSmartPosts] = useState([]);
  const [smartStrategy, setSmartStrategy] = useState('');
  const [isSmartGenerating, setIsSmartGenerating] = useState(false);
  const [smartCount, setSmartCount] = useState(7);

  // Insights state
  const [recommendations, setRecommendations] = useState('');
  const [bestTimes, setBestTimes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // White-label state
  const [branding, setBranding] = useState({});
  const [savingBranding, setSavingBranding] = useState(false);

  // Marketplace subscription state (generic system)
  const [mpSub, setMpSub] = useState(null);

  // Facebook / Instagram integration state
  const [fbStats, setFbStats] = useState(null);
  const [fbPosts, setFbPosts] = useState([]);
  const [igPosts, setIgPosts] = useState([]);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [connectingFb, setConnectingFb] = useState(false);
  const [fbPageIdInput, setFbPageIdInput] = useState('');
  const [fbTokenInput, setFbTokenInput] = useState('');

  // Help system state
  const [showHelpTip, setShowHelpTip] = useState(null);

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [calPopover, setCalPopover] = useState(null); // { date, posts, x, y }

  // AI admin-key awareness
  const [aiAdminManaged, setAiAdminManaged] = useState(false);

  // AI Video generation state
  const [videoTaskId, setVideoTaskId] = useState(null);
  const [videoStatus, setVideoStatus] = useState(null); // null | 'starting' | 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoPostIndex, setVideoPostIndex] = useState(null);
  const [videoAvailable, setVideoAvailable] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, postsRes, mpRes] = await Promise.all([
        api.get('/social/profile').catch(() => ({ data: null })),
        api.get('/social/posts').catch(() => ({ data: [] })),
        api.get('/marketplace/my-apps/social-ai-studio').catch(() => ({ data: null }))
      ]);
      setProfile(profileRes.data);
      // Sanitize posts to prevent React error #31 from object fields
      const rawPosts = Array.isArray(postsRes.data) ? postsRes.data : [];
      setPosts(rawPosts.map(p => ({
        ...p,
        content: typeof p.content === 'string' ? p.content : safeStr(p.content),
        platform: typeof p.platform === 'string' ? p.platform : 'Instagram',
        pillar: typeof p.pillar === 'string' ? p.pillar : '',
        status: typeof p.status === 'string' ? p.status : 'Draft',
        hashtags: Array.isArray(p.hashtags) ? p.hashtags.filter(h => typeof h === 'string') : []
      })));
      if (mpRes.data && mpRes.data.planKey) setMpSub(mpRes.data);
      // Use marketplace white-label if available, else fall back to legacy
      if (mpRes.data?.whiteLabel?.brandName) {
        setBranding(mpRes.data.whiteLabel);
      } else if (profileRes.data?.whiteLabel) {
        setBranding(profileRes.data.whiteLabel);
      }
      // Check AI availability (admin-managed key) and video status
      api.get('/social/ai/status').then(r => setAiAdminManaged(!!r.data?.adminManaged)).catch(() => {});
      api.get('/social/ai/video/status').then(r => setVideoAvailable(r.data?.available)).catch(() => {});
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const hasApiKey = !!profile?.geminiApiKey || aiAdminManaged;
  // Subscribed via legacy SocialProfile OR marketplace AppSubscription
  const legacySubscribed = profile?.isSubscribed;
  const mpSubscribed = mpSub?.isActive;
  const isSubscribed = legacySubscribed || mpSubscribed;
  // Determine plan from marketplace first, then legacy
  const currentPlan = (mpSubscribed ? mpSub.planKey : profile?.subscription?.plan) || 'none';
  const canWhiteLabel = isSubscribed && (currentPlan === 'professional' || currentPlan === 'enterprise');
  const canSmartSchedule = currentPlan === 'professional' || currentPlan === 'enterprise';

  // White-label derived styles (use branding state which is sourced from marketplace or legacy)
  const brandColor = branding.primaryColor || '#f59e0b';
  const headerBg = branding.headerBg || '#0f172a';
  const displayName = branding.brandName || 'SocialAI Studio';
  const displayTagline = branding.tagline || '';
  // Keep wl for byline check
  const wl = branding;

  // ── Purchase Plan ──
  const handlePurchase = async (plan) => {
    setPurchasing(true);
    try {
      // Try marketplace first, fall back to legacy
      const mpRes = await api.post('/marketplace/subscribe', { appSlug: 'social-ai-studio', planKey: plan }).catch(() => null);
      if (mpRes?.data) {
        setMpSub(mpRes.data.subscription);
        toast.success(safeStr(mpRes.data.message));
      } else {
        const res = await api.post('/social/subscribe', { plan });
        setProfile(res.data.profile);
        toast.success(safeStr(res.data.message));
      }
      loadData();
    } catch (err) {
      toast.error(safeStr(err.response?.data?.message) || 'Purchase failed');
    }
    setPurchasing(false);
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Cancel your subscription? You\'ll keep access until the end of your billing period.')) return;
    try {
      if (mpSubscribed) {
        await api.post('/marketplace/cancel', { appSlug: 'social-ai-studio' });
      } else {
        await api.post('/social/cancel-subscription');
      }
      toast.success('Subscription cancelled. Access remains until end of billing period.');
      loadData();
    } catch (err) {
      toast.error('Cancellation failed');
    }
  };

  // ── Save White-Label ──
  const saveBranding = async () => {
    setSavingBranding(true);
    try {
      // Try marketplace white-label first, fall back to legacy
      const mpRes = await api.put('/marketplace/white-label/social-ai-studio', branding).catch(() => null);
      if (mpRes?.data) {
        setBranding(mpRes.data);
        toast.success('Branding saved!');
      } else {
        const res = await api.put('/social/white-label', branding);
        setBranding(res.data);
        toast.success('Branding saved!');
      }
      loadData();
    } catch (err) {
      toast.error(safeStr(err.response?.data?.message) || 'Failed to save branding');
    }
    setSavingBranding(false);
  };

  // ── Content Generation ──
  const handleGenerate = async () => {
    if (!topic.trim()) return toast.error('Enter a topic first.');
    if (!hasApiKey) return toast.error('Set your Gemini API key in Settings.');
    setIsGenerating(true);
    try {
      const res = await api.post('/social/ai/generate', { topic, platform });
      setGeneratedContent(safeStr(res.data.content));
      setGeneratedHashtags(Array.isArray(res.data.hashtags) ? res.data.hashtags.filter(h => typeof h === 'string') : []);
    } catch (err) {
      toast.error(safeStr(err.response?.data?.message) || 'Generation failed');
    }
    setIsGenerating(false);
  };

  const handleGenerateImage = async () => {
    if (!topic.trim()) return toast.error('Enter a topic first.');
    if (!hasApiKey) return toast.error('Set your Gemini API key in Settings.');
    setIsGeneratingImage(true);
    try {
      const res = await api.post('/social/ai/image', { prompt: topic });
      setGeneratedImage(res.data.image);
    } catch (err) {
      toast.error('Image generation failed. Try again.');
    }
    setIsGeneratingImage(false);
  };

  const handleSavePost = async () => {
    if (!generatedContent) return toast.error('Generate content first.');
    try {
      const postData = {
        platform,
        content: generatedContent,
        hashtags: generatedHashtags,
        scheduledFor: scheduleDate || new Date().toISOString(),
        status: scheduleDate ? 'Scheduled' : 'Draft',
        image: generatedImage || undefined,
        topic
      };
      await api.post('/social/posts', postData);
      toast.success(`Post ${scheduleDate ? 'scheduled' : 'saved as draft'}!`);
      setGeneratedContent('');
      setGeneratedHashtags([]);
      setGeneratedImage(null);
      setTopic('');
      setScheduleDate('');
      loadData();
    } catch (err) {
      toast.error('Failed to save post');
    }
  };

  // ── Smart Schedule ──
  const handleSmartSchedule = async () => {
    if (!hasApiKey) return toast.error('Set your Gemini API key in Settings.');
    setIsSmartGenerating(true);
    try {
      const res = await api.post('/social/ai/smart-schedule', { count: smartCount });
      // Sanitize every post field to prevent React error #31 (objects as JSX children)
      console.log('[Smart Schedule] Response:', { postsCount: (res.data.posts || []).length, strategyLength: (res.data.strategy || '').length });
      const safePosts = (res.data.posts || []).map(p => ({
        ...p,
        platform: safeStr(p.platform) || 'Instagram',
        content: safeStr(p.content),
        topic: safeStr(p.topic),
        reasoning: safeStr(p.reasoning),
        pillar: safeStr(p.pillar),
        imagePrompt: safeStr(p.imagePrompt),
        mediaType: safeStr(p.mediaType) || 'image',
        hashtags: Array.isArray(p.hashtags) ? p.hashtags.filter(h => typeof h === 'string') : [],
        scheduledFor: typeof p.scheduledFor === 'string' ? p.scheduledFor : new Date().toISOString(),
        generatedImage: null,
        imageLoading: false
      }));
      setSmartPosts(safePosts);
      const strat = safeStr(res.data.strategy);
      setSmartStrategy(strat);
      if (strat.startsWith('Error:')) {
        toast.error(strat);
      } else if (safePosts.length === 0 && strat) {
        toast.error('AI generated strategy but no posts. Trying again may help.');
      }
      // Auto-generate images for each post in parallel (non-blocking)
      if (safePosts.length > 0) {
        safePosts.forEach((post, idx) => {
          if (post.imagePrompt) {
            setSmartPosts(prev => prev.map((sp, i) => i === idx ? { ...sp, imageLoading: true } : sp));
            api.post('/social/ai/image', { prompt: post.imagePrompt })
              .then(imgRes => {
                if (imgRes.data?.image) {
                  setSmartPosts(prev => prev.map((sp, i) => i === idx ? { ...sp, generatedImage: imgRes.data.image, imageLoading: false } : sp));
                } else {
                  setSmartPosts(prev => prev.map((sp, i) => i === idx ? { ...sp, imageLoading: false } : sp));
                }
              })
              .catch(() => {
                setSmartPosts(prev => prev.map((sp, i) => i === idx ? { ...sp, imageLoading: false } : sp));
              });
          }
        });
      }
    } catch (err) {
      toast.error(safeStr(err.response?.data?.error || err.response?.data?.message) || 'Smart schedule failed');
    }
    setIsSmartGenerating(false);
  };

  // ── AI Video Generation ──
  const handleGenerateVideo = async (postIndex, imageUrl, prompt) => {
    if (!imageUrl) return toast.error('Generate an AI image first, then create a video from it.');
    setVideoPostIndex(postIndex);
    setVideoStatus('starting');
    setVideoUrl(null);
    setVideoProgress(0);
    try {
      const res = await api.post('/social/ai/video/generate', {
        imageUrl,
        prompt: prompt || 'Smooth professional promotional video with subtle cinematic motion',
        duration: 5,
        ratio: '16:9'
      });
      setVideoTaskId(res.data.taskId);
      toast.success('Video generation started — this takes 30-90 seconds.');
      // Start polling
      pollVideoTask(res.data.taskId);
    } catch (err) {
      setVideoStatus('FAILED');
      toast.error(safeStr(err.response?.data?.message) || 'Video generation failed');
    }
  };

  const pollVideoTask = (taskId) => {
    const poll = async () => {
      try {
        const res = await api.get(`/social/ai/video/task/${taskId}`);
        setVideoStatus(res.data.status);
        setVideoProgress(res.data.progress || 0);
        if (res.data.status === 'SUCCEEDED' && res.data.videoUrl) {
          setVideoUrl(res.data.videoUrl);
          toast.success('AI video generated successfully!');
          return; // Stop polling
        }
        if (res.data.status === 'FAILED') {
          toast.error('Video generation failed. Try again.');
          return;
        }
        // Continue polling (PENDING or RUNNING)
        setTimeout(poll, 3000);
      } catch {
        setVideoStatus('FAILED');
      }
    };
    setTimeout(poll, 3000); // First poll after 3s
  };

  const cancelVideo = async () => {
    if (videoTaskId) {
      await api.post(`/social/ai/video/cancel/${videoTaskId}`).catch(() => {});
    }
    setVideoTaskId(null);
    setVideoStatus(null);
    setVideoProgress(0);
    setVideoUrl(null);
    setVideoPostIndex(null);
  };

  const handleAcceptSmartPosts = async () => {
    try {
      const postsData = smartPosts.map(sp => ({
        platform: sp.platform,
        content: sp.content,
        hashtags: sp.hashtags,
        scheduledFor: sp.scheduledFor,
        status: 'Scheduled',
        imagePrompt: sp.imagePrompt,
        image: sp.generatedImage || null,
        mediaType: sp.mediaType || 'image',
        reasoning: sp.reasoning,
        pillar: sp.pillar,
        topic: sp.topic
      }));
      await api.post('/social/posts/bulk', { posts: postsData });
      toast.success(`${postsData.length} posts added to calendar!`);
      setSmartPosts([]);
      setSmartStrategy('');
      loadData();
    } catch (err) {
      toast.error('Failed to save posts');
    }
  };

  // ── Insights ──
  const handleAnalyze = async () => {
    if (!hasApiKey) return toast.error('Set your Gemini API key in Settings.');
    setIsAnalyzing(true);
    try {
      const res = await api.post('/social/ai/recommendations');
      setRecommendations(safeStr(res.data.recommendations));
      setBestTimes(safeStr(res.data.bestTimes));
    } catch (err) {
      toast.error(safeStr(err.response?.data?.error || err.response?.data?.message) || 'Analysis failed');
    }
    setIsAnalyzing(false);
  };

  // ── Delete Post ──
  const deletePost = async (id) => {
    try {
      await api.delete(`/social/posts/${id}`);
      setPosts(prev => prev.filter(p => p._id !== id));
      toast.success('Post deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  // ── Profile Save ──
  const saveProfile = async () => {
    try {
      const res = await api.put('/social/profile', profile);
      setProfile(res.data);
      toast.success('Profile saved!');
    } catch (err) {
      toast.error('Failed to save profile');
    }
  };

  // ── Stats update ──
  const updateStat = (key, value) => {
    setProfile(prev => ({ ...prev, stats: { ...prev.stats, [key]: Number(value) } }));
  };

  // ── Facebook Integration ──
  const handleConnectFacebook = async () => {
    if (!fbPageIdInput.trim() || !fbTokenInput.trim()) return toast.error('Enter both Page ID and Page Access Token.');
    setConnectingFb(true);
    try {
      const res = await api.post('/social/facebook/connect', { pageId: fbPageIdInput.trim(), pageAccessToken: fbTokenInput.trim() });
      toast.success(safeStr(res.data.message));
      setFbPageIdInput('');
      setFbTokenInput('');
      loadData();
      handleRefreshStats();
    } catch (err) {
      toast.error(safeStr(err.response?.data?.message) || 'Failed to connect Facebook page');
    }
    setConnectingFb(false);
  };

  const handleDisconnectFacebook = async () => {
    if (!window.confirm('Disconnect your Facebook page? Stats will revert to manual entry.')) return;
    try {
      await api.post('/social/facebook/disconnect');
      setFbStats(null);
      setFbPosts([]);
      setIgPosts([]);
      toast.success('Facebook disconnected');
      loadData();
    } catch (err) {
      toast.error('Disconnect failed');
    }
  };

  const handleRefreshStats = async () => {
    setRefreshingStats(true);
    try {
      const [statsRes, fbPostsRes, igPostsRes] = await Promise.all([
        api.get('/social/facebook/stats').catch(() => ({ data: null })),
        api.get('/social/facebook/posts?limit=5').catch(() => ({ data: [] })),
        api.get('/social/instagram/posts?limit=5').catch(() => ({ data: [] }))
      ]);
      if (statsRes.data) setFbStats(statsRes.data);
      if (Array.isArray(fbPostsRes.data)) setFbPosts(fbPostsRes.data);
      if (Array.isArray(igPostsRes.data)) setIgPosts(igPostsRes.data);
      toast.success('Stats refreshed from Facebook');
      loadData();
    } catch (err) {
      toast.error('Could not fetch live stats');
    }
    setRefreshingStats(false);
  };

  // Auto-load FB stats on mount if connected
  const fbConnected = profile?.facebookConnected;
  useEffect(() => {
    if (fbConnected) {
      handleRefreshStats();
    }
  }, [fbConnected]); // eslint-disable-line

  // Help tooltip component
  const HelpTip = ({ id, title, children }) => (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setShowHelpTip(showHelpTip === id ? null : id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2, display: 'flex' }}
        title={title}
      >
        <HelpCircle size={14} />
      </button>
      {showHelpTip === id && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          background: '#1e1b4b', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, padding: '0.75rem 1rem',
          width: 280, zIndex: 100, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', fontSize: '0.75rem', color: '#d1d5db', lineHeight: 1.5
        }}>
          <div style={{ fontWeight: 700, color: '#fcd34d', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Info size={12} /> {title}
          </div>
          {children}
          <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 10, height: 10, background: '#1e1b4b', borderRight: '1px solid rgba(139,92,246,0.3)', borderBottom: '1px solid rgba(139,92,246,0.3)' }} />
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'command', label: 'Command Center', icon: Monitor },
    { id: 'create', label: 'Create', icon: Wand2 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'smart', label: 'Smart AI', icon: Brain, requirePlan: ['professional', 'enterprise'] },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
    { id: 'branding', label: 'Branding', icon: Palette, requirePlan: ['professional', 'enterprise'] },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help', icon: BookOpen }
  ];

  if (loading) return <div className="page-loading">Loading Social AI...</div>;

  const PlatformIcon = ({ p, size = 14 }) =>
    p === 'Instagram' ? <Instagram size={size} style={{ color: '#e1306c' }} /> : <Facebook size={size} style={{ color: '#1877f2' }} />;

  // ── Purchase Gate ── (skip when embedded inside another app)
  if (!isSubscribed && !embedded) {
    return (
      <div className="social-ai-page">
        <div className="sai-header">
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Sparkles size={28} style={{ color: '#f59e0b' }} />
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>SocialAI Studio</h1>
            </div>
          </div>
        </div>

        <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '1000px' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <Crown size={48} style={{ color: '#f59e0b', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>Choose Your Plan</h2>
            <p style={{ color: '#9ca3af', fontSize: '1.0625rem', maxWidth: '500px', margin: '0 auto' }}>
              Get your own branded AI social media manager. Each plan gives you a personalised login and full white-label control.
            </p>
          </div>

          <div className="sai-plans-grid">
            {Object.entries(PLAN_DETAILS).map(([key, plan]) => {
              const Icon = plan.icon;
              return (
                <div key={key} className={`sai-plan-card${plan.popular ? ' sai-plan-popular' : ''}`}>
                  {plan.popular && <div className="sai-plan-badge">MOST POPULAR</div>}
                  <Icon size={28} style={{ color: plan.color, marginBottom: '0.75rem' }} />
                  <h3>{plan.name}</h3>
                  <div className="sai-plan-price">
                    <span className="sai-plan-amount">${plan.price}</span>
                    <span className="sai-plan-period">/month AUD</span>
                  </div>
                  <ul className="sai-plan-features">
                    {plan.features.map((f, i) => (
                      <li key={i}><CheckCircle size={14} style={{ color: plan.color }} /> {f}</li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handlePurchase(key)}
                    disabled={purchasing}
                    className="btn btn-primary"
                    style={{ width: '100%', background: plan.color, borderColor: plan.color }}
                  >
                    {purchasing ? <Loader2 size={16} className="spin" /> : <><Zap size={16} /> Get {plan.name}</>}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/social-ai" className="service-link" style={{ color: '#9ca3af' }}>
              Learn more about SocialAI Studio <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Subscribed: Full App ──
  const innerContent = (
    <>

      {/* Tab Nav */}
      <div className="sai-tabs">
        <div className="container" style={{ display: 'flex', gap: '0.25rem', padding: '0 1.5rem', overflowX: 'auto' }}>
          {tabs.map(tab => {
            const locked = tab.requirePlan && !tab.requirePlan.includes(currentPlan);
            return (
              <button
                key={tab.id}
                onClick={() => !locked && setActiveTab(tab.id)}
                className={`sai-tab ${activeTab === tab.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                title={locked ? `Requires ${tab.requirePlan.join(' or ')} plan` : ''}
                style={activeTab === tab.id ? { borderBottomColor: brandColor, color: brandColor } : {}}
              >
                <tab.icon size={16} />
                {tab.label}
                {locked && <Crown size={10} style={{ opacity: 0.5 }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: (activeTab === 'command' || activeTab === 'help') ? '1100px' : '900px' }}>

        {/* ═══ COMMAND CENTER TAB ═══ */}
        {activeTab === 'command' && (
          <div className="sai-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 className="sai-title" style={{ marginBottom: '0.25rem' }}>
                  <Monitor size={22} style={{ color: '#f59e0b' }} /> Social Command Center
                </h2>
                <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>
                  Manage content, schedule posts, and track growth.
                  {!profile?.facebookConnected && (
                    <button onClick={() => setActiveTab('settings')} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.8125rem', marginLeft: 4 }}>
                      Connect Facebook to see live data →
                    </button>
                  )}
                </p>
              </div>
              {profile?.facebookConnected && (
                <button onClick={handleRefreshStats} disabled={refreshingStats} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <RefreshCw size={14} className={refreshingStats ? 'spin' : ''} /> Refresh Stats
                </button>
              )}
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="sai-card" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '0.5rem' }}>Followers</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>
                      {(fbStats?.page?.followers || profile?.stats?.followers || 0).toLocaleString()}
                    </div>
                    {fbStats?.instagram && (
                      <div style={{ fontSize: '0.6875rem', color: '#e1306c', marginTop: '0.25rem' }}>
                        <Instagram size={10} style={{ display: 'inline', marginRight: 3 }} />
                        +{fbStats.instagram.followers?.toLocaleString()} on IG
                      </div>
                    )}
                  </div>
                  <Users size={20} style={{ color: '#8b5cf6' }} />
                </div>
                {profile?.facebookConnected && (
                  <div style={{ fontSize: '0.6875rem', color: '#34d399', marginTop: '0.375rem' }}>
                    <CheckCircle size={10} style={{ display: 'inline', marginRight: 3 }} /> Live from Facebook
                  </div>
                )}
              </div>

              <div className="sai-card" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '0.5rem' }}>Reach</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>
                      {(fbStats?.page?.reach || profile?.stats?.reach || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#34d399', marginTop: '0.25rem' }}>
                      {fbStats?.page?.reach ? `${((fbStats.page.reach / Math.max(fbStats.page.followers || 1, 1)) * 100).toFixed(0)}% of followers` : 'Last 30 days'}
                    </div>
                  </div>
                  <Eye size={20} style={{ color: '#10b981' }} />
                </div>
              </div>

              <div className="sai-card" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '0.5rem' }}>Engagement</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>
                      {fbStats?.page?.engagementRate || profile?.stats?.engagement || 0}%
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#f59e0b', marginTop: '0.25rem' }}>Avg. per post</div>
                  </div>
                  <BarChart3 size={20} style={{ color: '#f59e0b' }} />
                </div>
              </div>
            </div>

            {/* AI Content Generator + AI Strategist Side by Side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* AI Content Generator */}
              <div className="sai-card" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
                <h3 style={{ fontWeight: 700, color: '#fcd34d', fontSize: '0.9375rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Wand2 size={16} /> AI Content Generator
                  <HelpTip id="ai-gen" title="AI Content Generator">
                    <p>Type a topic or prompt and our AI will create a ready-to-post caption with hashtags. Works for Instagram and Facebook.</p>
                    <p style={{ marginTop: '0.375rem' }}>Requires a <strong style={{ color: '#fcd34d' }}>Gemini API key</strong> — set it up in Settings.</p>
                  </HelpTip>
                </h3>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.6875rem' }}>Topic / Prompt</label>
                  <textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder={`e.g. New ${profile?.businessType || 'product'} special available this weekend...`}
                    rows={3}
                    style={{ fontSize: '0.8125rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <select value={platform} onChange={e => setPlatform(e.target.value)} className="sai-select" style={{ fontSize: '0.8125rem' }}>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                  <button onClick={handleGenerate} disabled={isGenerating} className="btn btn-primary btn-sm">
                    {isGenerating ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
                    Generate Text
                  </button>
                  <button onClick={handleGenerateImage} disabled={isGeneratingImage} className="btn sai-btn-image btn-sm">
                    {isGeneratingImage ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />}
                    Image
                  </button>
                </div>

                {generatedContent && (
                  <div style={{ marginTop: '0.875rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                      <PlatformIcon p={platform} size={14} />
                      <strong style={{ color: 'white', fontSize: '0.8125rem' }}>Generated Post</strong>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#d1d5db', marginBottom: '0.5rem', lineHeight: 1.6 }}>{generatedContent}</div>
                    {generatedHashtags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                        {generatedHashtags.map((tag, i) => <span key={i} className="sai-hashtag">{tag.startsWith('#') ? tag : `#${tag}`}</span>)}
                      </div>
                    )}
                    {generatedImage && <img src={generatedImage} alt="Generated" style={{ maxWidth: '100%', borderRadius: 6, marginBottom: '0.5rem' }} />}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
                        <label style={{ fontSize: '0.625rem' }}>Schedule (optional)</label>
                        <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ fontSize: '0.75rem' }} />
                      </div>
                      <button onClick={handleSavePost} className="btn sai-btn-save btn-sm">
                        <Save size={14} /> {scheduleDate ? 'Schedule' : 'Save Draft'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Strategist */}
              <div className="sai-card" style={{ borderColor: 'rgba(168,85,247,0.15)' }}>
                <h3 style={{ fontWeight: 700, color: '#c4b5fd', fontSize: '0.9375rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Brain size={16} /> AI Strategist
                  <HelpTip id="ai-strat" title="AI Strategist">
                    <p>Analyses your performance metrics and gives actionable advice on how to grow your <strong style={{ color: '#fcd34d' }}>{profile?.businessType || 'business'}</strong> brand.</p>
                    <p style={{ marginTop: '0.375rem' }}>For best results, connect your Facebook page so stats are real.</p>
                  </HelpTip>
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Analyze your performance metrics and get actionable advice on how to grow your {profile?.businessType || 'business'} brand.
                </p>

                {isAnalyzing ? (
                  <AILoadingOverlay type="insights" title="Analyzing Your Performance" />
                ) : recommendations ? (
                  <div style={{ fontSize: '0.8125rem', color: '#d1d5db', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 250, overflowY: 'auto', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    {recommendations}
                  </div>
                ) : (
                  <p style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '0.8125rem', marginBottom: '1rem' }}>No analysis generated yet.</p>
                )}

                {!isAnalyzing && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button onClick={handleAnalyze} disabled={isAnalyzing} className="btn btn-primary" style={{ flex: 1, background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
                    <BarChart3 size={16} />
                    {recommendations ? 'Re-Analyze' : 'Analyze & Recommend'}
                  </button>
                  {recommendations && canSmartSchedule && (
                    <button
                      onClick={() => { setActiveTab('smart'); setTimeout(() => handleSmartSchedule(), 100); }}
                      disabled={isSmartGenerating}
                      className="btn sai-btn-smart"
                      style={{ flex: 1 }}
                    >
                      <Zap size={16} />
                      Schedule from Analysis
                    </button>
                  )}
                  {recommendations && !canSmartSchedule && (
                    <button
                      onClick={() => toast.error('Smart Scheduling requires Professional or Enterprise plan.')}
                      className="btn btn-secondary"
                      style={{ flex: 1, opacity: 0.7 }}
                    >
                      <Crown size={16} />
                      Upgrade to Schedule
                    </button>
                  )}
                </div>
                )}
              </div>
            </div>

            {/* Recent Posts Feed — from Facebook */}
            {(fbPosts.length > 0 || igPosts.length > 0) && (
              <div>
                <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Globe size={16} /> Recent Posts from Your Pages
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Facebook Posts */}
                  {fbPosts.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
                        <Facebook size={14} style={{ color: '#1877f2' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1877f2' }}>Facebook</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {fbPosts.map((p, i) => (
                          <a key={i} href={p.permalink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                            <div className="sai-card" style={{ padding: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                              <p style={{ fontSize: '0.75rem', color: '#d1d5db', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                                {p.message || '(No text)'}
                              </p>
                              {p.image && <img src={p.image} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6, marginBottom: '0.5rem' }} />}
                              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.6875rem', color: '#9ca3af' }}>
                                <span><ThumbsUp size={10} style={{ display: 'inline', marginRight: 2 }} />{p.likes}</span>
                                <span><MessageCircle size={10} style={{ display: 'inline', marginRight: 2 }} />{p.comments}</span>
                                <span><Share2 size={10} style={{ display: 'inline', marginRight: 2 }} />{p.shares}</span>
                                <span style={{ marginLeft: 'auto' }}>{new Date(p.createdTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Instagram Posts */}
                  {igPosts.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem' }}>
                        <Instagram size={14} style={{ color: '#e1306c' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e1306c' }}>Instagram{fbStats?.instagram?.username ? ` @${fbStats.instagram.username}` : ''}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {igPosts.map((p, i) => (
                          <a key={i} href={p.permalink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                            <div className="sai-card" style={{ padding: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                              {p.mediaUrl && <img src={p.mediaUrl} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6, marginBottom: '0.5rem' }} />}
                              <p style={{ fontSize: '0.75rem', color: '#d1d5db', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                                {p.caption || '(No caption)'}
                              </p>
                              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.6875rem', color: '#9ca3af' }}>
                                <span><ThumbsUp size={10} style={{ display: 'inline', marginRight: 2 }} />{p.likes}</span>
                                <span><MessageCircle size={10} style={{ display: 'inline', marginRight: 2 }} />{p.comments}</span>
                                <span style={{ marginLeft: 'auto' }}>{new Date(p.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Schedule Calendar Preview */}
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Calendar size={16} /> Schedule Calendar
                  <span style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', fontSize: '0.6875rem', fontWeight: 700, padding: '0.125rem 0.5rem', borderRadius: 9999 }}>
                    {posts.filter(p => p.status === 'Scheduled').length} scheduled
                  </span>
                </h3>
                <button onClick={() => setActiveTab('calendar')} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  View Full Calendar <ChevronRight size={14} />
                </button>
              </div>
              {posts.filter(p => p.status === 'Scheduled').length === 0 ? (
                <div className="sai-card" style={{ textAlign: 'center', padding: '2rem' }}>
                  <Calendar size={32} style={{ color: '#4b5563', marginBottom: '0.75rem' }} />
                  <p style={{ color: '#6b7280', fontSize: '0.8125rem' }}>No scheduled posts yet.</p>
                  <p style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: '0.25rem' }}>Use the AI Content Generator above or <button onClick={() => setActiveTab('smart')} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}>Smart AI Scheduler</button> to create posts.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {posts.filter(p => p.status === 'Scheduled').slice(0, 5).map(post => (
                    <div key={post._id} className="sai-card" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <PlatformIcon p={post.platform} size={16} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.8125rem', color: '#d1d5db', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.content}</p>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {new Date(post.scheduledFor).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      {post.pillar && <span className="sai-pillar">{post.pillar}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Not connected? Show setup prompt */}
            {!profile?.facebookConnected && !hasApiKey && !aiAdminManaged && (
              <div className="sai-card" style={{ marginTop: '1.5rem', background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.08))', borderColor: 'rgba(245,158,11,0.2)', textAlign: 'center', padding: '2rem' }}>
                <AlertCircle size={32} style={{ color: '#fbbf24', marginBottom: '0.75rem' }} />
                <h3 style={{ fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>Get Started</h3>
                <p style={{ color: '#9ca3af', fontSize: '0.8125rem', maxWidth: 400, margin: '0 auto 1rem' }}>
                  Set up your Gemini API key and connect your Facebook Business Page to unlock the full power of Social AI.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => setActiveTab('settings')} className="btn btn-primary btn-sm"><Key size={14} /> Set Up API Key</button>
                  <button onClick={() => setActiveTab('help')} className="btn btn-secondary btn-sm"><BookOpen size={14} /> Read the Guide</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ CREATE TAB ═══ */}
        {activeTab === 'create' && (
          <div className="sai-section">
            <h2 className="sai-title"><Wand2 size={22} style={{ color: '#f59e0b' }} /> AI Content Generator</h2>

            <div className="sai-card">
              <div className="form-group">
                <label>Topic / Prompt</label>
                <textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g., Weekend sale, new product launch, behind the scenes..."
                  rows={3}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <select value={platform} onChange={e => setPlatform(e.target.value)} className="sai-select">
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                </select>
                <button onClick={handleGenerate} disabled={isGenerating} className="btn btn-primary">
                  {isGenerating ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
                  Generate Text
                </button>
                <button onClick={handleGenerateImage} disabled={isGeneratingImage} className="btn sai-btn-image">
                  {isGeneratingImage ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
                  Image
                </button>
                {videoAvailable && (
                  <button
                    onClick={() => generatedImage ? handleGenerateVideo(-1, generatedImage, topic || 'Professional promotional video') : toast.error('Generate an image first, then convert it to video.')}
                    disabled={videoStatus && videoStatus !== 'SUCCEEDED' && videoStatus !== 'FAILED'}
                    className="btn"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', fontWeight: 700 }}
                  >
                    {videoPostIndex === -1 && videoStatus && videoStatus !== 'SUCCEEDED' && videoStatus !== 'FAILED' ? <Loader2 size={16} className="spin" /> : <Video size={16} />}
                    Video
                  </button>
                )}
              </div>
            </div>

            {isGenerating && (
              <div style={{ marginTop: '1.5rem' }}>
                <AILoadingOverlay type="generate" title="Crafting Your Post" />
              </div>
            )}

            {!isGenerating && generatedContent && (
              <div className="sai-card" style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <PlatformIcon p={platform} size={18} />
                  <strong style={{ color: 'white' }}>Generated Post</strong>
                </div>
                <div className="sai-output">{generatedContent}</div>
                {generatedHashtags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', margin: '0.75rem 0' }}>
                    {generatedHashtags.map((tag, i) => (
                      <span key={i} className="sai-hashtag">{tag.startsWith('#') ? tag : `#${tag}`}</span>
                    ))}
                  </div>
                )}
                {generatedImage && (
                  <img src={generatedImage} alt="Generated" style={{ maxWidth: '300px', borderRadius: '8px', margin: '0.75rem 0' }} />
                )}
                {/* Video generation progress/preview in Create tab */}
                {videoPostIndex === -1 && videoStatus && (
                  <div style={{ margin: '0.75rem 0', padding: '0.75rem', background: 'rgba(139,92,246,0.06)', borderRadius: 8, border: '1px solid rgba(139,92,246,0.15)' }}>
                    {videoStatus === 'SUCCEEDED' && videoUrl ? (
                      <div>
                        <video src={videoUrl} controls style={{ width: '100%', maxWidth: 400, borderRadius: 8 }} />
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <a href={videoUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary" style={{ fontSize: '0.6875rem' }}>
                            <ExternalLink size={12} /> Download Video
                          </a>
                          <button onClick={cancelVideo} className="btn btn-sm btn-secondary" style={{ fontSize: '0.6875rem' }}>
                            <X size={12} /> Close
                          </button>
                        </div>
                      </div>
                    ) : videoStatus === 'FAILED' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={14} style={{ color: '#ef4444' }} />
                        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Video generation failed</span>
                        <button onClick={cancelVideo} className="btn btn-sm btn-secondary" style={{ fontSize: '0.6875rem', marginLeft: 'auto' }}>Dismiss</button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                          <Loader2 size={14} className="spin" style={{ color: '#a855f7' }} />
                          <span style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                            {videoStatus === 'starting' ? 'Starting video generation...' : `Generating video... ${Math.round(videoProgress * 100)}%`}
                          </span>
                          <button onClick={cancelVideo} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.6875rem' }}>Cancel</button>
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(videoProgress * 100, 5)}%`, background: 'linear-gradient(90deg, #a855f7, #6366f1)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginTop: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Schedule (optional)</label>
                    <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
                  </div>
                  <button onClick={handleSavePost} className="btn sai-btn-save">
                    <Save size={16} /> {scheduleDate ? 'Schedule' : 'Save Draft'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ CALENDAR TAB — Google-style month grid ═══ */}
        {activeTab === 'calendar' && (() => {
          const year = calMonth.getFullYear();
          const month = calMonth.getMonth();
          const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const prevMonthDays = new Date(year, month, 0).getDate();
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

          // Group posts by date key
          const postsByDate = {};
          posts.forEach(p => {
            const d = new Date(p.scheduledFor);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!postsByDate[key]) postsByDate[key] = [];
            postsByDate[key].push(p);
          });

          // Build calendar cells
          const cells = [];
          // Previous month fill
          for (let i = firstDay - 1; i >= 0; i--) {
            cells.push({ day: prevMonthDays - i, outside: true, key: `prev-${i}` });
          }
          // Current month
          for (let d = 1; d <= daysInMonth; d++) {
            const key = `${year}-${month}-${d}`;
            cells.push({ day: d, outside: false, key, dateKey: key, isToday: key === todayStr, posts: postsByDate[key] || [] });
          }
          // Next month fill
          const remaining = 7 - (cells.length % 7);
          if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
              cells.push({ day: i, outside: true, key: `next-${i}` });
            }
          }

          const prevMonth = () => setCalMonth(new Date(year, month - 1, 1));
          const nextMonth = () => setCalMonth(new Date(year, month + 1, 1));
          const goToday = () => setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1));

          const handleTileClick = (e, dayPosts, day) => {
            if (dayPosts.length === 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            setCalPopover({
              date: new Date(year, month, day),
              posts: dayPosts,
              x: Math.min(rect.left, window.innerWidth - 340),
              y: Math.min(rect.bottom + 4, window.innerHeight - 420)
            });
          };

          return (
            <div className="sai-section" onClick={() => calPopover && setCalPopover(null)}>
              <h2 className="sai-title"><Calendar size={22} style={{ color: '#f59e0b' }} /> Content Calendar</h2>

              {/* Month navigation */}
              <div className="sai-cal-header">
                <div className="sai-cal-nav">
                  <button onClick={prevMonth}><ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /></button>
                  <span className="sai-cal-month">{calMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={nextMonth}><ChevronRight size={14} /></button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div className="sai-cal-nav"><button onClick={goToday}>Today</button></div>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{posts.length} posts total</span>
                </div>
              </div>

              {/* Day headers */}
              <div className="sai-cal-grid">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="sai-cal-day-header">{d}</div>
                ))}

                {/* Calendar cells */}
                {cells.map(cell => (
                  <div
                    key={cell.key}
                    className={`sai-cal-cell${cell.outside ? ' outside' : ''}${cell.isToday ? ' today' : ''}`}
                    onClick={(e) => !cell.outside && handleTileClick(e, cell.posts || [], cell.day)}
                  >
                    <div className="sai-cal-date">{cell.day}</div>
                    {(cell.posts || []).slice(0, 3).map((p, pi) => (
                      <div key={pi} className={`sai-cal-tile ${(p.platform || '').toLowerCase()}`} title={p.content?.substring(0, 80)}>
                        {p.image && <img src={p.image} alt="" className="sai-cal-tile-img" />}
                        {p.mediaType === 'video' && <Video size={9} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {new Date(p.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {p.topic || p.content?.substring(0, 20)}
                        </span>
                      </div>
                    ))}
                    {(cell.posts || []).length > 3 && (
                      <div className="sai-cal-more">+{cell.posts.length - 3} more</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Day detail popover */}
              {calPopover && (
                <div className="sai-cal-popover" style={{ left: calPopover.x, top: calPopover.y }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <strong style={{ color: 'white', fontSize: '0.875rem' }}>
                      {calPopover.date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </strong>
                    <button onClick={() => setCalPopover(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                  {calPopover.posts.map((p, i) => (
                    <div key={i} className="sai-cal-popover-post">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <PlatformIcon p={p.platform} size={14} />
                        <span className={`sai-status ${(p.status || 'draft').toLowerCase()}`}>{p.status}</span>
                        <span style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                          {new Date(p.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {p.pillar && <span className="sai-pillar">{p.pillar}</span>}
                        {p.mediaType === 'video' && <span style={{ fontSize: '0.5625rem', background: 'rgba(168,85,247,0.2)', color: '#c4b5fd', padding: '0.0625rem 0.375rem', borderRadius: 4 }}>Video</span>}
                        <button onClick={() => deletePost(p._id)} className="sai-delete-btn" style={{ marginLeft: 'auto', padding: '0.25rem' }} title="Delete"><Trash2 size={12} /></button>
                      </div>
                      {p.image && <img src={p.image} alt="" style={{ width: '100%', borderRadius: 6, marginBottom: '0.375rem', maxHeight: 120, objectFit: 'cover' }} />}
                      <p style={{ fontSize: '0.75rem', color: '#d1d5db', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ SMART AI TAB ═══ */}
        {activeTab === 'smart' && (
          <div className="sai-section">
            <h2 className="sai-title"><Brain size={22} style={{ color: '#f59e0b' }} /> Smart AI Scheduler</h2>
            <p style={{ color: '#9ca3af', marginBottom: '1.5rem', lineHeight: 1.7 }}>
              Let AI plan your entire content calendar for the next 2 weeks — optimised for engagement, timing, and variety. Our AI uses industry research to pick the best platforms, times, and content pillars for your business.
            </p>

            {/* Generator Card */}
            <div className="sai-card" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(168,85,247,0.08))', borderColor: 'rgba(245,158,11,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={18} style={{ color: '#000' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>Generate Your Content Plan</h3>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>AI analyses your profile, industry, and audience to create the perfect schedule</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                  <label style={{ fontSize: '0.75rem' }}>Posts to Generate</label>
                  <select value={smartCount} onChange={e => setSmartCount(Number(e.target.value))} className="sai-select">
                    <option value={5}>5 posts (1 week light)</option>
                    <option value={7}>7 posts (1 week)</option>
                    <option value={10}>10 posts (mixed)</option>
                    <option value={14}>14 posts (2 weeks)</option>
                  </select>
                </div>
                <button onClick={handleSmartSchedule} disabled={isSmartGenerating} className="btn sai-btn-smart" style={{ padding: '0.75rem 1.5rem' }}>
                  {isSmartGenerating ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                  {isSmartGenerating ? 'AI is Thinking...' : 'Generate Schedule'}
                </button>
              </div>

              {isSmartGenerating && (
                <div style={{ marginTop: '1.25rem' }}>
                  <AILoadingOverlay type="schedule" title="Building Your Content Strategy" />
                </div>
              )}

              {!isSmartGenerating && smartStrategy && (
                <div className="sai-strategy" style={{ marginTop: '1.25rem' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><Brain size={14} /> AI Strategy</h4>
                  <p>{smartStrategy}</p>
                </div>
              )}
            </div>

            {/* Best Practices Knowledge Hub */}
            {smartPosts.length === 0 && !isSmartGenerating && (
              <div style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <Star size={18} style={{ color: '#fcd34d' }} />
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'white' }}>Social Media Best Practices</h3>
                </div>

                {/* Quick Stats Banner */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {randomTips.quickStats.map((item, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.375rem', fontWeight: 800, color: item.color, marginBottom: '0.25rem' }}>{item.stat}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', lineHeight: 1.4 }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Content Pillars */}
                <div className="sai-card" style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontWeight: 700, color: '#fcd34d', fontSize: '0.9375rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Zap size={15} /> The 5 Content Pillars Every Business Needs
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                    {[
                      { name: 'Educate', emoji: '📚', desc: 'Tips, how-tos, and industry insights that position you as an expert', color: '#3b82f6' },
                      { name: 'Entertain', emoji: '🎬', desc: 'Behind-the-scenes, fun facts, memes, and relatable moments', color: '#f59e0b' },
                      { name: 'Engage', emoji: '💬', desc: 'Questions, polls, and conversation starters that drive comments', color: '#10b981' },
                      { name: 'Inspire', emoji: '✨', desc: 'Success stories, testimonials, and motivational content', color: '#a855f7' },
                      { name: 'Promote', emoji: '🎯', desc: 'Products, services, offers, and clear calls-to-action', color: '#ef4444' }
                    ].map((pillar, i) => (
                      <div key={i} style={{ background: `${pillar.color}10`, border: `1px solid ${pillar.color}25`, borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>{pillar.emoji}</div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: pillar.color, marginBottom: '0.25rem' }}>{pillar.name}</div>
                        <div style={{ fontSize: '0.625rem', color: '#9ca3af', lineHeight: 1.4 }}>{pillar.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: 'rgba(245,158,11,0.08)', borderRadius: 8, fontSize: '0.75rem', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Brain size={13} /> <strong>Pro tip:</strong> Follow the 80/20 rule — 80% value-driven content, 20% promotional. Our AI automatically balances this for you.
                  </div>
                </div>

                {/* Platform-Specific Tips */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="sai-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                      <Instagram size={20} style={{ color: '#e1306c' }} />
                      <h4 style={{ fontWeight: 700, color: '#e1306c', fontSize: '0.9375rem' }}>Instagram Best Practices</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {randomTips.igTips.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: '#d1d5db', lineHeight: 1.5 }}>
                          <span style={{ flexShrink: 0 }}>{item.icon}</span>
                          <span>{item.tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="sai-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                      <Facebook size={20} style={{ color: '#1877f2' }} />
                      <h4 style={{ fontWeight: 700, color: '#1877f2', fontSize: '0.9375rem' }}>Facebook Best Practices</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {randomTips.fbTips.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: '#d1d5db', lineHeight: 1.5 }}>
                          <span style={{ flexShrink: 0 }}>{item.icon}</span>
                          <span>{item.tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* General Strategy Tips */}
                <div className="sai-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.06))', borderColor: 'rgba(16,185,129,0.15)' }}>
                  <h4 style={{ fontWeight: 700, color: '#34d399', fontSize: '0.9375rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <BarChart3 size={16} /> Engagement Strategy Facts
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {randomTips.facts.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', lineHeight: 1.5 }}>
                        <CheckCircle size={13} style={{ color: '#34d399', flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <span style={{ color: '#d1d5db' }}>{item.fact}</span>
                          <span style={{ display: 'block', fontSize: '0.625rem', color: '#6b7280', marginTop: 1 }}>— {item.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Posting Frequency Guide */}
                <div className="sai-card" style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontWeight: 700, color: '#c4b5fd', fontSize: '0.9375rem', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Calendar size={16} /> Recommended Posting Frequency
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                    {[
                      { platform: 'Instagram Feed', freq: '3–5 posts/week', note: 'Consistency matters more than volume' },
                      { platform: 'Instagram Stories', freq: '1–3 per day', note: 'Keep your account active between posts' },
                      { platform: 'Instagram Reels', freq: '4–7 per week', note: 'Highest organic reach format in 2024' },
                      { platform: 'Facebook Page', freq: '1–2 posts/day', note: 'Quality over quantity; avoid over-posting' },
                      { platform: 'Facebook Stories', freq: '1–2 per day', note: 'Underused — less competition for attention' },
                      { platform: 'Facebook Live', freq: '1–2 per month', note: 'Highest engagement format on Facebook' }
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e5e7eb' }}>{item.platform}</div>
                          <div style={{ fontSize: '0.625rem', color: '#6b7280' }}>{item.note}</div>
                        </div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fcd34d', whiteSpace: 'nowrap' }}>{item.freq}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Generated Posts */}
            {smartPosts.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <strong style={{ color: 'white', fontSize: '1.0625rem' }}>{smartPosts.length} Posts Generated</strong>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Review your AI-crafted content plan below</p>
                  </div>
                  <button onClick={handleAcceptSmartPosts} className="btn sai-btn-save" style={{ padding: '0.625rem 1.25rem' }}>
                    <CheckCircle size={16} /> Accept All & Add to Calendar
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {smartPosts.map((sp, i) => (
                    <div key={i} className="sai-card" style={{ padding: '1.25rem', borderLeft: `3px solid ${sp.platform === 'Instagram' ? '#e1306c' : '#1877f2'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                        <PlatformIcon p={sp.platform} size={16} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'white' }}>{sp.platform}</span>
                        {sp.mediaType === 'video' && (
                          <span style={{ fontSize: '0.5625rem', background: 'rgba(168,85,247,0.2)', color: '#c4b5fd', padding: '0.125rem 0.5rem', borderRadius: 9999, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Video size={10} /> Video
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>
                          <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                          {new Date(sp.scheduledFor).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} at {new Date(sp.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {sp.pillar && <span className="sai-pillar">{sp.pillar}</span>}
                      </div>

                      {/* Generated Image / Loading */}
                      {sp.imageLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(99,102,241,0.06)', borderRadius: 8, marginBottom: '0.625rem' }}>
                          <Loader2 size={16} className="spin" style={{ color: '#a855f7' }} />
                          <span style={{ fontSize: '0.75rem', color: '#c4b5fd' }}>Generating AI {sp.mediaType === 'video' ? 'image for video' : 'image'}...</span>
                        </div>
                      )}
                      {sp.generatedImage && !sp.imageLoading && (
                        <div style={{ marginBottom: '0.75rem', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                          <img src={sp.generatedImage} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 8 }} />
                          {sp.mediaType === 'video' && (
                            <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.625rem', color: '#c4b5fd', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Video size={10} /> AI will convert to video
                            </div>
                          )}
                        </div>
                      )}

                      <p style={{ fontSize: '0.875rem', color: '#e5e7eb', marginBottom: '0.625rem', lineHeight: 1.6 }}>{sp.content}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {sp.hashtags.map((t, j) => <span key={j} className="sai-hashtag">{t.startsWith('#') ? t : `#${t}`}</span>)}
                      </div>
                      {sp.reasoning && (
                        <div style={{ marginTop: '0.625rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.06)', borderRadius: 6, fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', display: 'flex', gap: '0.375rem' }}>
                          <Brain size={12} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                          {sp.reasoning}
                        </div>
                      )}
                      {/* AI Video Generation — shown for video-type posts or all posts if video is available */}
                      {videoAvailable && sp.generatedImage && (sp.mediaType === 'video' || canSmartSchedule) && (
                        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                          {videoPostIndex === i && videoStatus ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              {videoStatus === 'SUCCEEDED' && videoUrl ? (
                                <div style={{ width: '100%' }}>
                                  <video src={videoUrl} controls style={{ width: '100%', borderRadius: 8, maxHeight: 240 }} />
                                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <a href={videoUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary" style={{ fontSize: '0.6875rem' }}>
                                      <ExternalLink size={12} /> Download
                                    </a>
                                    <button onClick={cancelVideo} className="btn btn-sm btn-secondary" style={{ fontSize: '0.6875rem' }}>
                                      <X size={12} /> Close
                                    </button>
                                  </div>
                                </div>
                              ) : videoStatus === 'FAILED' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                                  <AlertCircle size={14} style={{ color: '#ef4444' }} />
                                  <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Video generation failed</span>
                                  <button onClick={cancelVideo} className="btn btn-sm btn-secondary" style={{ fontSize: '0.6875rem', marginLeft: 'auto' }}>Dismiss</button>
                                </div>
                              ) : (
                                <div style={{ width: '100%' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                                    <Loader2 size={14} className="spin" style={{ color: '#a855f7' }} />
                                    <span style={{ fontSize: '0.75rem', color: '#d1d5db' }}>
                                      {videoStatus === 'starting' ? 'Starting video generation...' : `Generating video... ${Math.round(videoProgress * 100)}%`}
                                    </span>
                                    <button onClick={cancelVideo} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.6875rem' }}>Cancel</button>
                                  </div>
                                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.max(videoProgress * 100, 5)}%`, background: 'linear-gradient(90deg, #a855f7, #6366f1)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleGenerateVideo(i, sp.generatedImage, sp.imagePrompt || sp.content?.substring(0, 100))}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)' }}
                              disabled={videoStatus && videoStatus !== 'SUCCEEDED' && videoStatus !== 'FAILED'}
                            >
                              <Video size={13} /> {sp.mediaType === 'video' ? 'Generate AI Video (Recommended)' : 'Generate AI Video'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ INSIGHTS TAB ═══ */}
        {activeTab === 'insights' && (
          <div className="sai-section">
            <h2 className="sai-title"><BarChart3 size={22} style={{ color: '#f59e0b' }} /> AI Insights</h2>

            <div className="sai-card">
              <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Your Stats</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Followers', key: 'followers' },
                  { label: 'Monthly Reach', key: 'reach' },
                  { label: 'Engagement %', key: 'engagement' },
                  { label: 'Posts (30d)', key: 'postsLast30Days' }
                ].map(s => (
                  <div key={s.key} className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>{s.label}</label>
                    <input
                      type="number"
                      value={profile?.stats?.[s.key] || 0}
                      onChange={e => updateStat(s.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={handleAnalyze} disabled={isAnalyzing} className="btn btn-primary">
                  {isAnalyzing ? <Loader2 size={16} className="spin" /> : <BarChart3 size={16} />}
                  {recommendations ? 'Re-Analyze' : 'Analyze & Recommend'}
                </button>
                <button onClick={saveProfile} className="btn btn-secondary"><Save size={16} /> Save Stats</button>
              </div>
            </div>

            {isAnalyzing && (
              <div style={{ marginTop: '1.5rem' }}>
                <AILoadingOverlay type="insights" title="Analyzing Your Performance" />
              </div>
            )}

            {!isAnalyzing && recommendations && (
              <div className="sai-card" style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontWeight: 600, color: '#fcd34d', marginBottom: '0.75rem' }}>Recommendations</h3>
                <div style={{ fontSize: '0.875rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>{recommendations}</div>
              </div>
            )}

            {!isAnalyzing && bestTimes && (
              <div className="sai-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ fontWeight: 600, color: '#fcd34d', marginBottom: '0.75rem' }}>Best Posting Times</h3>
                <div style={{ fontSize: '0.875rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>{bestTimes}</div>
              </div>
            )}

            {!isAnalyzing && recommendations && (
              <div className="sai-card" style={{ marginTop: '1.5rem', background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(99,102,241,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Zap size={18} style={{ color: '#a855f7' }} />
                  <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>Ready to Act on This?</h3>
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '1rem' }}>
                  Let AI build a full content schedule based on the insights above — optimized for your best days, times, and content style.
                </p>
                {canSmartSchedule ? (
                  isSmartGenerating ? (
                    <AILoadingOverlay type="schedule" title="Building Schedule from Your Insights" />
                  ) : smartPosts.length > 0 ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong style={{ color: '#34d399' }}><CheckCircle size={14} style={{ display: 'inline', marginRight: 4 }} />{smartPosts.length} posts generated!</strong>
                        <button onClick={() => setActiveTab('smart')} className="btn btn-primary btn-sm">
                          <Calendar size={14} /> View & Schedule
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <select value={smartCount} onChange={e => setSmartCount(Number(e.target.value))} className="sai-select" style={{ width: 'auto' }}>
                        <option value={5}>5 posts</option>
                        <option value={7}>7 posts (1 week)</option>
                        <option value={10}>10 posts</option>
                        <option value={14}>14 posts (2 weeks)</option>
                      </select>
                      <button onClick={handleSmartSchedule} className="btn sai-btn-smart" style={{ flex: 1, padding: '0.75rem 1.5rem' }}>
                        <Zap size={16} /> Generate Schedule from Insights
                      </button>
                    </div>
                  )
                ) : (
                  <div style={{ textAlign: 'center', padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                      <Crown size={14} style={{ display: 'inline', marginRight: 4, color: '#f59e0b' }} />
                      Smart Scheduling is available on Professional and Enterprise plans.
                    </p>
                    <button onClick={() => handlePurchase('professional')} className="btn btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}>
                      <Zap size={14} /> Upgrade to Professional
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ BRANDING TAB ═══ */}
        {activeTab === 'branding' && canWhiteLabel && (
          <div className="sai-section">
            <h2 className="sai-title"><Palette size={22} style={{ color: brandColor }} /> White-Label Branding</h2>
            <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>Customise the look and feel of your AI manager. Your customers will see your brand, not ours.</p>

            {/* Live Preview */}
            <div className="sai-card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Live Preview</h3>
              <div style={{ background: branding.headerBg || '#0f172a', borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt="" style={{ height: 32, width: 32, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <Sparkles size={28} style={{ color: branding.primaryColor || '#f59e0b' }} />
                )}
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'white' }}>{branding.brandName || 'Your Brand Name'}</div>
                  {branding.tagline && <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{branding.tagline}</div>}
                </div>
              </div>
            </div>

            {/* Identity */}
            <div className="sai-card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Brand Identity</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Brand Name</label>
                  <input value={branding.brandName || ''} onChange={e => setBranding(prev => ({ ...prev, brandName: e.target.value }))} placeholder="Your Company Name" />
                </div>
                <div className="form-group">
                  <label>Tagline</label>
                  <input value={branding.tagline || ''} onChange={e => setBranding(prev => ({ ...prev, tagline: e.target.value }))} placeholder="Your smart social manager" />
                </div>
                <div className="form-group">
                  <label>Logo URL</label>
                  <input value={branding.logoUrl || ''} onChange={e => setBranding(prev => ({ ...prev, logoUrl: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="form-group">
                  <label>Favicon URL</label>
                  <input value={branding.faviconUrl || ''} onChange={e => setBranding(prev => ({ ...prev, faviconUrl: e.target.value }))} placeholder="https://..." />
                </div>
              </div>
            </div>

            {/* Colours */}
            <div className="sai-card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Colours</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                {[
                  { key: 'primaryColor', label: 'Primary / Accent' },
                  { key: 'accentColor', label: 'Background Accent' },
                  { key: 'headerBg', label: 'Header Background' },
                  { key: 'buttonColor', label: 'Button Colour' }
                ].map(c => (
                  <div key={c.key} className="form-group">
                    <label style={{ fontSize: '0.7rem' }}>{c.label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="color"
                        value={branding[c.key] || '#f59e0b'}
                        onChange={e => setBranding(prev => ({ ...prev, [c.key]: e.target.value }))}
                        style={{ width: 36, height: 36, padding: 2, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={branding[c.key] || ''}
                        onChange={e => setBranding(prev => ({ ...prev, [c.key]: e.target.value }))}
                        style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}
                        placeholder="#hex"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Advanced */}
            <div className="sai-card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Advanced</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Custom Font Family</label>
                  <input value={branding.fontFamily || ''} onChange={e => setBranding(prev => ({ ...prev, fontFamily: e.target.value }))} placeholder="e.g., Inter, Poppins" />
                </div>
                {currentPlan === 'enterprise' && (
                  <div className="form-group">
                    <label>Custom Domain</label>
                    <input value={branding.customDomain || ''} onChange={e => setBranding(prev => ({ ...prev, customDomain: e.target.value }))} placeholder="social.yourdomain.com" />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <input
                  type="checkbox"
                  id="hideByline"
                  checked={branding.hideByline || false}
                  onChange={e => setBranding(prev => ({ ...prev, hideByline: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="hideByline" style={{ fontSize: '0.8125rem', color: '#d1d5db', cursor: 'pointer' }}>
                  Hide "Powered by Penny Wise I.T" byline
                </label>
              </div>
            </div>

            <button onClick={saveBranding} disabled={savingBranding} className="btn btn-primary" style={{ background: brandColor, borderColor: brandColor }}>
              {savingBranding ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              Save Branding
            </button>
          </div>
        )}

        {/* ═══ SETTINGS TAB ═══ */}
        {activeTab === 'settings' && (
          <div className="sai-section">
            <h2 className="sai-title"><Settings size={22} style={{ color: brandColor }} /> Settings</h2>

            {/* Subscription Status */}
            <div className="sai-card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Crown size={18} style={{ color: brandColor }} /> Subscription
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plan</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: brandColor, textTransform: 'capitalize' }}>{currentPlan}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399', textTransform: 'capitalize' }}>{profile?.subscription?.status}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Renews</div>
                  <div style={{ fontSize: '0.875rem', color: '#d1d5db' }}>
                    {profile?.subscription?.endDate ? new Date(profile.subscription.endDate).toLocaleDateString() : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#d1d5db' }}>${profile?.subscription?.amount || 0}/mo</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {currentPlan !== 'enterprise' && (
                  <button onClick={() => handlePurchase(currentPlan === 'starter' ? 'professional' : 'enterprise')} className="btn btn-primary btn-sm" style={{ background: brandColor, borderColor: brandColor }}>
                    <Zap size={14} /> Upgrade Plan
                  </button>
                )}
                <button onClick={handleCancelSubscription} className="btn btn-danger btn-sm">
                  Cancel Subscription
                </button>
              </div>
            </div>

            {/* API Key */}
            <div className="sai-card">
              <h3 style={{ fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Sparkles size={18} style={{ color: brandColor }} /> Gemini API Key
              </h3>
              {aiAdminManaged ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, marginBottom: '1rem' }}>
                  <CheckCircle size={14} style={{ color: '#34d399' }} />
                  <span style={{ fontSize: '0.8125rem', color: '#34d399', fontWeight: 600 }}>AI is managed by your admin — no key needed</span>
                </div>
              ) : (
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem' }}>
                  Powers all AI features. Get a free key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: brandColor }}>Google AI Studio</a>.
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '500px' }}>
                <input
                  type="password"
                  value={profile?.geminiApiKey || ''}
                  onChange={e => setProfile(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                  placeholder="Paste your API key..."
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8125rem' }}
                />
                <button onClick={saveProfile} className="btn btn-primary btn-sm" style={{ background: brandColor, borderColor: brandColor }}>Save</button>
              </div>
              {hasApiKey && (
                <p style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
                  <CheckCircle size={12} /> Key configured
                </p>
              )}
            </div>

            {/* Facebook / Instagram Connection */}
            <div className="sai-card" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Facebook size={18} style={{ color: '#1877f2' }} /> Facebook & Instagram
                <HelpTip id="fb-connect" title="Connect Facebook Page">
                  <p>Linking your Facebook Business Page lets us pull live stats, recent posts, and detect your linked Instagram account.</p>
                  <p style={{ marginTop: '0.375rem' }}>You need a <strong style={{ color: '#fcd34d' }}>Page Access Token</strong> from Meta's developer tools. See the Help tab for a step-by-step guide.</p>
                </HelpTip>
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem' }}>
                Connect your Facebook Business Page to pull live stats and recent posts. Instagram will auto-link if connected to your FB page.
              </p>

              {profile?.facebookConnected ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', marginBottom: '0.75rem' }}>
                    <Facebook size={20} style={{ color: '#1877f2' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#34d399' }}>
                        <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                        Facebook Page Connected
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Page ID: {profile.facebookPageId}</div>
                    </div>
                    <button onClick={handleDisconnectFacebook} className="btn btn-danger btn-sm" style={{ fontSize: '0.75rem' }}>
                      <X size={12} /> Disconnect
                    </button>
                  </div>

                  {profile?.instagramBusinessAccountId ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(225,48,108,0.08)', borderRadius: 8, border: '1px solid rgba(225,48,108,0.2)' }}>
                      <Instagram size={20} style={{ color: '#e1306c' }} />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e1306c' }}>
                          <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                          Instagram Business Linked
                          {fbStats?.instagram?.username && <span style={{ fontWeight: 400, color: '#9ca3af' }}> — @{fbStats.instagram.username}</span>}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Automatically detected via Facebook Page</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem', background: 'rgba(245,158,11,0.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)' }}>
                      <AlertCircle size={14} style={{ color: '#fbbf24' }} />
                      <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                        No Instagram Business Account linked to this Facebook page. <a href="https://help.instagram.com/502981923235522" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b', textDecoration: 'underline' }}>Learn how to link</a>
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.6875rem' }}>Facebook Page ID</label>
                      <input
                        value={fbPageIdInput}
                        onChange={e => setFbPageIdInput(e.target.value)}
                        placeholder="e.g. 123456789012345"
                        style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.6875rem' }}>Page Access Token</label>
                      <input
                        type="password"
                        value={fbTokenInput}
                        onChange={e => setFbTokenInput(e.target.value)}
                        placeholder="Paste token from Meta developer tools..."
                        style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={handleConnectFacebook} disabled={connectingFb} className="btn btn-primary btn-sm" style={{ background: '#1877f2', borderColor: '#1877f2' }}>
                      {connectingFb ? <Loader2 size={14} className="spin" /> : <Facebook size={14} />}
                      Connect Facebook Page
                    </button>
                    <button onClick={() => setActiveTab('help')} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <BookOpen size={12} /> How to get these?
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Business Profile */}
            <div className="sai-card" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>Business Profile</h3>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem' }}>AI uses this to tailor content to your brand.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Business Name</label>
                  <input value={profile?.businessName || ''} onChange={e => setProfile(prev => ({ ...prev, businessName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Business Type</label>
                  <input value={profile?.businessType || ''} onChange={e => setProfile(prev => ({ ...prev, businessType: e.target.value }))} placeholder="e.g., cafe, gym, retail" />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input value={profile?.location || ''} onChange={e => setProfile(prev => ({ ...prev, location: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Tone / Voice</label>
                  <input value={profile?.tone || ''} onChange={e => setProfile(prev => ({ ...prev, tone: e.target.value }))} placeholder="e.g., Casual and fun" />
                </div>
              </div>
              <div className="form-group">
                <label>Business Description</label>
                <textarea value={profile?.description || ''} onChange={e => setProfile(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description of your business..." rows={2} />
              </div>
              <button onClick={saveProfile} className="btn btn-primary" style={{ background: brandColor, borderColor: brandColor }}><Save size={16} /> Save Profile</button>
            </div>

            {/* Data */}
            <div className="sai-card" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontWeight: 600, color: 'white', marginBottom: '0.75rem' }}>Data</h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    const data = JSON.stringify({ posts, profile }, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `socialai-export-${new Date().toISOString().split('T')[0]}.json`;
                    a.click(); URL.revokeObjectURL(url);
                    toast.success('Data exported!');
                  }}
                  className="btn btn-secondary btn-sm"
                >Export All Data</button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Delete all posts? This cannot be undone.')) return;
                    try {
                      await api.delete('/social/posts');
                      setPosts([]);
                      toast.success('All posts cleared');
                    } catch (err) {
                      toast.error('Failed to clear posts');
                    }
                  }}
                  className="btn btn-danger btn-sm"
                >Clear All Posts</button>
              </div>
            </div>

            {/* Powered By */}
            {!wl.hideByline && (
              <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: '#4b5563' }}>
                Powered by <strong>Penny Wise I.T</strong>
              </div>
            )}
          </div>
        )}

        {/* ═══ HELP TAB ═══ */}
        {activeTab === 'help' && (
          <div className="sai-section">
            <h2 className="sai-title"><BookOpen size={22} style={{ color: '#f59e0b' }} /> Getting Started Guide</h2>
            <p style={{ color: '#9ca3af', marginBottom: '1.5rem', lineHeight: 1.7 }}>
              Welcome to SocialAI Studio! This guide will walk you through setting everything up so you can manage your social media like a pro.
            </p>

            {/* Quick Status */}
            <div className="sai-card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(245,158,11,0.06))' }}>
              <h3 style={{ fontWeight: 700, color: 'white', marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Your Setup Status</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {hasApiKey ? <CheckCircle size={16} style={{ color: '#34d399' }} /> : <AlertCircle size={16} style={{ color: '#fbbf24' }} />}
                  <span style={{ fontSize: '0.8125rem', color: hasApiKey ? '#34d399' : '#fbbf24' }}>
                    Gemini API Key — {hasApiKey ? 'Configured ✓' : 'Not set up yet'}
                  </span>
                  {!hasApiKey && <button onClick={() => setActiveTab('settings')} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem' }}>Set up →</button>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {profile?.facebookConnected ? <CheckCircle size={16} style={{ color: '#34d399' }} /> : <AlertCircle size={16} style={{ color: '#fbbf24' }} />}
                  <span style={{ fontSize: '0.8125rem', color: profile?.facebookConnected ? '#34d399' : '#fbbf24' }}>
                    Facebook Page — {profile?.facebookConnected ? 'Connected ✓' : 'Not connected'}
                  </span>
                  {!profile?.facebookConnected && <button onClick={() => setActiveTab('settings')} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem' }}>Connect →</button>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {profile?.instagramBusinessAccountId ? <CheckCircle size={16} style={{ color: '#34d399' }} /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #4b5563' }} />}
                  <span style={{ fontSize: '0.8125rem', color: profile?.instagramBusinessAccountId ? '#34d399' : '#6b7280' }}>
                    Instagram — {profile?.instagramBusinessAccountId ? 'Linked via Facebook ✓' : 'Links automatically when FB is connected'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 1: Gemini API Key */}
            <div className="sai-card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 800, color: '#000', flexShrink: 0 }}>1</div>
                <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>Get Your Gemini API Key (Free)</h3>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                The Gemini API key powers all AI features — content generation, image creation, smart scheduling, and strategic recommendations. Google offers a generous free tier.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.6 }}>
                  <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b', fontWeight: 600 }}>Google AI Studio — API Keys <ExternalLink size={10} style={{ display: 'inline' }} /></a></li>
                  <li>Sign in with your Google account (any Gmail works)</li>
                  <li>Click <strong style={{ color: 'white' }}>"Create API key"</strong></li>
                  <li>Select any Google Cloud project (or create one — it's free)</li>
                  <li>Copy the generated key (starts with <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.125rem 0.375rem', borderRadius: 4, fontSize: '0.75rem' }}>AIza...</code>)</li>
                  <li>Paste it into <button onClick={() => setActiveTab('settings')} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontWeight: 600 }}>Settings → Gemini API Key</button></li>
                </ol>
              </div>
              <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', background: 'rgba(16,185,129,0.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
                <p style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span><strong>Free tier:</strong> Gemini offers 60 requests/minute for free, which is more than enough for most small businesses. No credit card needed.</span>
                </p>
              </div>
            </div>

            {/* Step 2: Connect Facebook */}
            <div className="sai-card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #1877f2, #0a5dc2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>2</div>
                <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>Connect Your Facebook Business Page</h3>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                Connecting your Facebook page lets SocialAI pull live follower counts, reach, engagement stats, and your recent posts directly into the Command Center.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fcd34d', marginBottom: '0.5rem' }}>How to get your Page ID:</h4>
                <ol style={{ margin: '0 0 1rem 0', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.6 }}>
                  <li>Open your Facebook Business Page</li>
                  <li>Go to <strong style={{ color: 'white' }}>Settings → Page transparency</strong> or check the page's URL</li>
                  <li>The Page ID is the number in the URL (e.g. <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.125rem 0.375rem', borderRadius: 4, fontSize: '0.75rem' }}>facebook.com/123456789</code>)</li>
                  <li>Or use the <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: '#1877f2', fontWeight: 600 }}>Graph API Explorer <ExternalLink size={10} style={{ display: 'inline' }} /></a> — query <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.125rem 0.375rem', borderRadius: 4, fontSize: '0.75rem' }}>me/accounts</code> to list your pages with their IDs</li>
                </ol>

                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fcd34d', marginBottom: '0.5rem' }}>How to get your Page Access Token:</h4>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.6 }}>
                  <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" style={{ color: '#1877f2', fontWeight: 600 }}>Meta for Developers <ExternalLink size={10} style={{ display: 'inline' }} /></a> and create a developer account (free)</li>
                  <li>Create a new app (type: <strong style={{ color: 'white' }}>Business</strong>)</li>
                  <li>Add the <strong style={{ color: 'white' }}>Facebook Login</strong> product to your app</li>
                  <li>Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: '#1877f2', fontWeight: 600 }}>Graph API Explorer <ExternalLink size={10} style={{ display: 'inline' }} /></a></li>
                  <li>Select your app, then click <strong style={{ color: 'white' }}>"Get User Access Token"</strong></li>
                  <li>Enable permissions: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.125rem 0.375rem', borderRadius: 4, fontSize: '0.75rem' }}>pages_show_list</code>, <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.125rem 0.375rem', borderRadius: 4, fontSize: '0.75rem' }}>pages_read_engagement</code>, <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.125rem 0.375rem', borderRadius: 4, fontSize: '0.75rem' }}>pages_read_user_content</code>, <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.125rem 0.375rem', borderRadius: 4, fontSize: '0.75rem' }}>read_insights</code></li>
                  <li>Generate the token, then query <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.125rem 0.375rem', borderRadius: 4, fontSize: '0.75rem' }}>me/accounts</code></li>
                  <li>Copy the <strong style={{ color: 'white' }}>Page Access Token</strong> (not the User token) from the response</li>
                </ol>
              </div>
              <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', background: 'rgba(245,158,11,0.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)' }}>
                <p style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span><strong>Tip:</strong> For a long-lived token (60 days+), use the <a href="https://developers.facebook.com/tools/accesstoken/" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>Access Token Debugger</a> to extend your token. Short-lived tokens expire in ~1 hour.</span>
                </p>
              </div>
            </div>

            {/* Step 3: Instagram */}
            <div className="sai-card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #e1306c, #833ab4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>3</div>
                <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>Instagram (Auto-Linked)</h3>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                Instagram Business/Creator accounts that are linked to a Facebook Page are <strong style={{ color: 'white' }}>automatically detected</strong> when you connect Facebook. No extra setup needed!
              </p>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fcd34d', marginBottom: '0.5rem' }}>If Instagram isn't linking:</h4>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.6 }}>
                  <li>Make sure you have an <strong style={{ color: 'white' }}>Instagram Business</strong> or <strong style={{ color: 'white' }}>Creator</strong> account (not Personal)</li>
                  <li>Go to Instagram → Settings → Account → <strong style={{ color: 'white' }}>Linked Accounts</strong> → Facebook</li>
                  <li>Link your Instagram account to your Facebook Page</li>
                  <li>Come back here and re-connect your Facebook Page — Instagram will be detected automatically</li>
                </ol>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <a href="https://help.instagram.com/502981923235522" target="_blank" rel="noopener noreferrer" style={{ color: '#e1306c', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Instagram Business Account setup guide <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Step 4: Using the App */}
            <div className="sai-card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #34d399, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 800, color: '#000', flexShrink: 0 }}>4</div>
                <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>How to Use SocialAI Studio</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { icon: Monitor, title: 'Command Center', desc: 'Your dashboard — see live stats, generate content, get AI strategy recommendations, and view recent posts from your pages.', color: '#f59e0b' },
                  { icon: Wand2, title: 'Create', desc: 'Generate AI-powered social media posts. Pick a platform, enter a topic, and let AI write captions with hashtags.', color: '#fcd34d' },
                  { icon: Calendar, title: 'Calendar', desc: 'View and manage all your scheduled posts. Delete or edit posts before they go live.', color: '#8b5cf6' },
                  { icon: Brain, title: 'Smart AI', desc: 'Auto-generate a full content plan for the next 2 weeks. AI picks the best platforms, times, and topics.', color: '#a855f7' },
                  { icon: BarChart3, title: 'Insights', desc: 'Get AI-powered recommendations on how to improve your social media strategy based on your current metrics.', color: '#10b981' },
                  { icon: Palette, title: 'Branding', desc: 'White-label your SocialAI dashboard with your own brand name, logo, colours, and tagline.', color: '#ec4899' }
                ].map((item, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <item.icon size={14} style={{ color: item.color }} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'white' }}>{item.title}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Video Generation Guide */}
            <div className="sai-card" style={{ marginBottom: '1rem', borderLeft: '3px solid #a855f7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>5</div>
                <h3 style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>AI Video Generation (Pro & Enterprise)</h3>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                Professional and Enterprise plans include AI-powered promotional video creation. The AI can transform any post's image into a short, cinematic video clip — perfect for Reels, Stories, and video posts that get 3-5x more engagement.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#c084fc', marginBottom: '0.5rem' }}>How AI Video Works:</h4>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.6 }}>
                  <li>Generate a content schedule using <strong style={{ color: 'white' }}>Smart AI</strong></li>
                  <li>Each post has a <strong style={{ color: '#c084fc' }}>"Generate AI Video"</strong> button</li>
                  <li>Click it — the AI creates a 5-second promotional video from the post's image prompt</li>
                  <li>Video generates in 30-90 seconds with a live progress bar</li>
                  <li>Preview the video inline, then download it for posting</li>
                </ol>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#c084fc', marginBottom: '0.5rem' }}>Powered by Runway ML (Gen-3 Alpha Turbo):</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.6 }}>
                  <li><strong style={{ color: 'white' }}>Image-to-Video</strong> — transforms AI-generated images into smooth, cinematic motion clips</li>
                  <li><strong style={{ color: 'white' }}>5 or 10 second</strong> durations — perfect for Reels, Stories, and short-form video</li>
                  <li><strong style={{ color: 'white' }}>Multiple ratios</strong> — 16:9 (landscape), 9:16 (Stories/Reels), 1:1 (square)</li>
                  <li><strong style={{ color: 'white' }}>Professional quality</strong> — used by major brands and agencies worldwide</li>
                </ul>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(168,85,247,0.06)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.15)' }}>
                  <p style={{ fontSize: '0.75rem', color: '#c084fc', display: 'flex', alignItems: 'flex-start', gap: '0.375rem', margin: 0 }}>
                    <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                    <span><strong>For Admins:</strong> Add your Runway ML API key as <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.125rem 0.375rem', borderRadius: 4, fontSize: '0.6875rem' }}>RUNWAY_API_KEY</code> in your environment variables. Get one at <a href="https://app.runwayml.com/settings/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7' }}>runwayml.com</a></span>
                  </p>
                </div>
                <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
                  <p style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'flex-start', gap: '0.375rem', margin: 0 }}>
                    <CheckCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                    <span><strong>For Users:</strong> No setup needed! Video generation is included with Professional and Enterprise plans. Just click the video button on any generated post.</span>
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="sai-card">
              <h3 style={{ fontWeight: 700, color: 'white', marginBottom: '0.75rem', fontSize: '0.9375rem' }}>Frequently Asked Questions</h3>
              {[
                { q: 'Is the Gemini API key really free?', a: 'Yes! Google provides a generous free tier for Gemini. For most small businesses, you\'ll never need to pay. You get 60 requests per minute and 1,500 requests per day for free.' },
                { q: 'Will SocialAI post directly to Facebook/Instagram?', a: 'Currently SocialAI helps you create, schedule, and plan content. Direct posting via the Facebook API requires app review by Meta. For now, you can copy and paste generated content to your pages.' },
                { q: 'Why do I need a Facebook Developer account?', a: 'The Page Access Token is needed to read your page\'s stats and posts. It\'s free to create a developer account and app on Meta for Developers.' },
                { q: 'What if I don\'t connect Facebook?', a: 'You can still use all AI features! The Command Center will show manual stats instead. You can enter follower/reach numbers manually in the Insights tab.' },
                { q: 'How do I upgrade my plan?', a: 'Go to Settings → Subscription and click "Upgrade Plan". The Professional plan unlocks Smart AI and Branding. Enterprise adds custom domains and priority support.' }
              ].map((faq, i) => (
                <div key={i} style={{ padding: '0.75rem 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fcd34d', marginBottom: '0.25rem' }}>{faq.q}</h4>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>{faq.a}</p>
                </div>
              ))}
            </div>

            {/* Support link */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Still need help?</p>
              <Link to="/tickets" style={{ color: '#f59e0b', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                Open a Support Ticket <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // When embedded inside another app (e.g. Food Truck), skip the page wrapper & header
  if (embedded) {
    return <div style={{ margin: '-1.5rem' }}>{innerContent}</div>;
  }

  // Standalone mode: full page with branded header
  return (
    <div className="social-ai-page">
      {/* Header — branded */}
      <div className="sai-header" style={{ background: headerBg }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {wl.logoUrl ? (
              <img src={wl.logoUrl} alt="" style={{ height: 32, width: 32, borderRadius: 8, objectFit: 'cover' }} />
            ) : (
              <Sparkles size={28} style={{ color: brandColor }} />
            )}
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{displayName}</h1>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {displayTagline || profile?.businessName || 'Configure in Settings'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
            <span style={{ color: brandColor, display: 'flex', alignItems: 'center', gap: '0.25rem', textTransform: 'capitalize' }}>
              <Crown size={14} /> {currentPlan}
            </span>
            {hasApiKey ? (
              <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={14} /> AI Active</span>
            ) : (
              <span style={{ color: '#fbbf24' }}>No API Key</span>
            )}
          </div>
        </div>
      </div>
      {innerContent}
    </div>
  );
};

export default SocialAI;
