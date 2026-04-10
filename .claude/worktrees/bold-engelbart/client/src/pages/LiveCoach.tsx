import React, { useState, useEffect, useCallback, useRef } from 'react';
import { chat } from '../services/gemini';
import {
  Camera,
  Thermometer,
  Wind,
  Droplets,
  Sun,
  Flame,
  ChevronRight,
  AlertTriangle,
  Target,
  Upload,
  MapPin,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
}

interface CoachingResult {
  instruction: string;
  warning: string | null;
  milestone: string;
}

type TempTrend = 'rising' | 'stable' | 'falling';
type MeatType = 'Brisket' | 'Pork Shoulder' | 'Beef Ribs' | 'Pork Ribs' | 'Lamb' | 'Chicken';
type CookStage = 'Just Started' | 'Pre-Stall' | 'In The Stall' | 'Post-Stall' | 'Resting';
type SmokerType = 'Offset' | 'Pellet' | 'Charcoal/Kamado' | 'Kettle';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const LiveCoach: React.FC = () => {
  // Photo
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Temperature
  const [internalTemp, setInternalTemp] = useState<string>('');
  const [smokerTemp, setSmokerTemp] = useState<string>('');
  const [tempTrend, setTempTrend] = useState<TempTrend>('stable');
  const [lidOpens, setLidOpens] = useState<string>('0');

  // Cook details
  const [meatType, setMeatType] = useState<MeatType>('Brisket');
  const [weight, setWeight] = useState<string>('');
  const [cookStage, setCookStage] = useState<CookStage>('Just Started');
  const [smokerType, setSmokerType] = useState<SmokerType>('Offset');

  // Weather
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(false);
  const [manualTemp, setManualTemp] = useState<string>('');
  const [manualHumidity, setManualHumidity] = useState<string>('');
  const [manualWind, setManualWind] = useState<string>('');

  // AI
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    { role: 'system' | 'user' | 'assistant'; content: string }[]
  >([]);

  /* ------ Weather auto-detect ------ */
  useEffect(() => {
    if (!navigator.geolocation) {
      setWeatherError(true);
      return;
    }
    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`,
          );
          const data = await res.json();
          if (data.current) {
            setWeather({
              temperature: data.current.temperature_2m,
              humidity: data.current.relative_humidity_2m,
              windSpeed: data.current.wind_speed_10m,
            });
          } else {
            setWeatherError(true);
          }
        } catch {
          setWeatherError(true);
        } finally {
          setWeatherLoading(false);
        }
      },
      () => {
        setWeatherError(true);
        setWeatherLoading(false);
      },
    );
  }, []);

  /* ------ Image handling ------ */
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  /* ------ Build prompt ------ */
  const buildPrompt = (): string => {
    const ambientTemp = weather?.temperature ?? (manualTemp ? parseFloat(manualTemp) : null);
    const ambientHumidity = weather?.humidity ?? (manualHumidity ? parseFloat(manualHumidity) : null);
    const ambientWind = weather?.windSpeed ?? (manualWind ? parseFloat(manualWind) : null);

    return `You are an elite pitmaster with 25+ years of competition and professional BBQ experience. You give short, confident, actionable coaching. No fluff. Speak like you are standing next to the cooker with me.

COOK SNAPSHOT:
- Meat: ${meatType}, ${weight ? weight + ' kg' : 'weight not specified'}
- Cook stage: ${cookStage}
- Smoker type: ${smokerType}
- Internal meat temp: ${internalTemp ? internalTemp + ' C' : 'not provided'}
- Smoker/chamber temp: ${smokerTemp ? smokerTemp + ' C' : 'not provided'}
- Temperature trend: ${tempTrend}
- Lid opens in last 30 min: ${lidOpens}
${ambientTemp !== null ? `- Ambient air temp: ${ambientTemp} C` : ''}
${ambientHumidity !== null ? `- Humidity: ${ambientHumidity}%` : ''}
${ambientWind !== null ? `- Wind speed: ${ambientWind} km/h` : ''}
${imageDataUrl ? '\nA photo of the current cook is attached. Analyze the color, bark, smoke ring visibility, fat rendering, and any visual cues.' : ''}

Respond in this exact JSON format and nothing else:
{
  "instruction": "Your single most important instruction right now (2-3 sentences max, direct and actionable)",
  "warning": "Any urgent concern, or null if none",
  "milestone": "What should happen next and roughly when (e.g. 'Expect the stall to break in ~45 min at this rate')"
}`;
  };

  /* ------ Get Coaching ------ */
  const getCoaching = async () => {
    setLoading(true);
    setResult(null);
    setShowFollowUp(false);

    try {
      const systemPrompt = buildPrompt();

      let userContent: any;
      if (imageDataUrl) {
        userContent = [
          { type: 'text', text: 'Analyze my cook and give me coaching based on the photo and data provided.' },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ];
      } else {
        userContent = 'Analyze my cook and give me coaching based on the data provided.';
      }

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];

      const raw = await chat(messages as any, 'google/gemini-2.5-flash');

      // Extract JSON from the response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse coaching response');

      const parsed = JSON.parse(jsonMatch[0]) as CoachingResult;
      setResult(parsed);
      setConversationHistory([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: typeof userContent === 'string' ? userContent : 'Analyze my cook (with photo).' },
        { role: 'assistant', content: raw },
      ]);
    } catch (err: any) {
      console.error('Coaching error:', err);
      setResult({
        instruction: 'Could not connect to the AI coach. Check your connection and try again.',
        warning: err?.message || 'Unknown error',
        milestone: '',
      });
    } finally {
      setLoading(false);
    }
  };

  /* ------ Follow-up ------ */
  const sendFollowUp = async () => {
    if (!followUp.trim()) return;
    setFollowUpLoading(true);

    try {
      const messages = [
        ...conversationHistory,
        { role: 'user' as const, content: followUp },
      ];

      const raw = await chat(messages as any, 'google/gemini-2.5-flash');

      setConversationHistory([...messages, { role: 'assistant', content: raw }]);

      // Try to parse as JSON; if it fails, use as plain text instruction
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as CoachingResult;
          setResult(parsed);
        } else {
          setResult({ instruction: raw, warning: null, milestone: '' });
        }
      } catch {
        setResult({ instruction: raw, warning: null, milestone: '' });
      }

      setFollowUp('');
    } catch (err: any) {
      console.error('Follow-up error:', err);
    } finally {
      setFollowUpLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render helpers                                                     */
  /* ------------------------------------------------------------------ */

  const cardClass =
    'bg-gray-900/80 border border-gray-800 rounded-2xl p-5 sm:p-6 backdrop-blur-sm';
  const labelClass = 'block text-xs uppercase tracking-wider text-gray-400 mb-1.5 font-medium';
  const inputClass =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D9381E]/60 focus:border-[#D9381E] transition text-sm';
  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#D9381E]/10 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 pt-10 pb-8 sm:pt-14 sm:pb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D9381E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#D9381E]" />
            </span>
            <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">
              Live Session
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight">
            LIVE COACH
          </h1>
          <p className="text-gray-400 mt-2 text-lg">Your pitmaster, on demand</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-16 space-y-6">
        {/* ---- Input Grid ---- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* A: Photo Analysis */}
          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-4 h-4 text-[#D9381E]" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider">
                Photo Analysis
              </h2>
            </div>

            <div
              className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer min-h-[180px] flex items-center justify-center ${
                dragOver
                  ? 'border-[#D9381E] bg-[#D9381E]/10'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Cook preview"
                  className="w-full h-full object-cover rounded-xl max-h-[220px]"
                />
              ) : (
                <div className="text-center p-4">
                  <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    Drop a photo or <span className="text-[#D9381E]">browse</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">JPG, PNG up to 10MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {imagePreview && (
              <button
                className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition"
                onClick={() => {
                  setImagePreview(null);
                  setImageDataUrl(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Remove photo
              </button>
            )}
          </div>

          {/* B: Temperature Input */}
          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-4">
              <Thermometer className="w-4 h-4 text-[#D9381E]" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider">
                Temperature
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelClass}>Internal Temp (°C)</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="e.g. 72"
                  value={internalTemp}
                  onChange={(e) => setInternalTemp(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Smoker Temp (°C)</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="e.g. 120"
                  value={smokerTemp}
                  onChange={(e) => setSmokerTemp(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Temp Trend</label>
                <div className="flex gap-2">
                  {(['rising', 'stable', 'falling'] as TempTrend[]).map((t) => (
                    <button
                      key={t}
                      className={`flex-1 text-xs py-2 rounded-lg border transition font-medium capitalize ${
                        tempTrend === t
                          ? 'bg-[#D9381E]/20 border-[#D9381E] text-[#D9381E]'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                      onClick={() => setTempTrend(t)}
                    >
                      {t === 'rising' ? '↑' : t === 'falling' ? '↓' : '→'} {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Lid Opens (last 30 min)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className={inputClass}
                  value={lidOpens}
                  onChange={(e) => setLidOpens(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* C: Cook Details */}
          <div className={cardClass}>
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-[#D9381E]" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider">
                Cook Details
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelClass}>Meat Type</label>
                <select
                  className={selectClass}
                  value={meatType}
                  onChange={(e) => setMeatType(e.target.value as MeatType)}
                >
                  {(['Brisket', 'Pork Shoulder', 'Beef Ribs', 'Pork Ribs', 'Lamb', 'Chicken'] as MeatType[]).map(
                    (m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label className={labelClass}>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className={inputClass}
                  placeholder="e.g. 5.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Cook Stage</label>
                <select
                  className={selectClass}
                  value={cookStage}
                  onChange={(e) => setCookStage(e.target.value as CookStage)}
                >
                  {(
                    ['Just Started', 'Pre-Stall', 'In The Stall', 'Post-Stall', 'Resting'] as CookStage[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Smoker Type</label>
                <select
                  className={selectClass}
                  value={smokerType}
                  onChange={(e) => setSmokerType(e.target.value as SmokerType)}
                >
                  {(['Offset', 'Pellet', 'Charcoal/Kamado', 'Kettle'] as SmokerType[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Weather ---- */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-4">
            <Sun className="w-4 h-4 text-[#f59e0b]" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider">
              Weather Conditions
            </h2>
            {weather && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                <MapPin className="w-3 h-3" /> Auto-detected
              </span>
            )}
          </div>

          {weatherLoading && (
            <p className="text-sm text-gray-500 animate-pulse">Detecting location...</p>
          )}

          {weather && !weatherError ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-[#f59e0b]" />
                <div>
                  <p className="text-xs text-gray-500">Ambient</p>
                  <p className="text-sm font-semibold">{weather.temperature}°C</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="text-xs text-gray-500">Humidity</p>
                  <p className="text-sm font-semibold">{weather.humidity}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-300" />
                <div>
                  <p className="text-xs text-gray-500">Wind</p>
                  <p className="text-sm font-semibold">{weather.windSpeed} km/h</p>
                </div>
              </div>
            </div>
          ) : (
            !weatherLoading && (
              <div>
                <p className="text-xs text-gray-500 mb-3">
                  Could not detect location. Enter conditions manually:
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Temp (°C)</label>
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="28"
                      value={manualTemp}
                      onChange={(e) => setManualTemp(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Humidity (%)</label>
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="65"
                      value={manualHumidity}
                      onChange={(e) => setManualHumidity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Wind (km/h)</label>
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="12"
                      value={manualWind}
                      onChange={(e) => setManualWind(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* ---- Get Coaching Button ---- */}
        <div className="flex justify-center">
          <button
            onClick={getCoaching}
            disabled={loading}
            className="bg-[#D9381E] hover:bg-[#b82d17] disabled:opacity-50 disabled:cursor-not-allowed text-white font-display font-bold uppercase text-sm tracking-widest px-10 py-4 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-[#D9381E]/20 hover:shadow-[#D9381E]/40"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Macca is analyzing your cook...
              </>
            ) : (
              <>
                <Flame className="w-4 h-4" />
                Get Coaching
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* ---- Coaching Response ---- */}
        {result && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* Main instruction */}
            <div className={`${cardClass} border-[#D9381E]/30`}>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-[#D9381E]" />
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-[#D9381E]">
                  Do This Now
                </h3>
              </div>
              <p className="text-lg sm:text-xl font-bold leading-relaxed">{result.instruction}</p>
            </div>

            {/* Warning */}
            {result.warning && (
              <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-widest text-[#f59e0b]">
                    Warning
                  </h3>
                </div>
                <p className="text-sm text-[#f59e0b]/90">{result.warning}</p>
              </div>
            )}

            {/* Next milestone */}
            {result.milestone && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-gray-400" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-widest text-gray-400">
                    Next Milestone
                  </h3>
                </div>
                <p className="text-sm text-gray-300">{result.milestone}</p>
              </div>
            )}

            {/* Follow-up */}
            {!showFollowUp ? (
              <button
                onClick={() => setShowFollowUp(true)}
                className="text-sm text-gray-400 hover:text-white transition flex items-center gap-1"
              >
                <ChevronRight className="w-3 h-3" /> Ask a follow-up
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  className={`${inputClass} flex-1`}
                  placeholder="Ask Macca anything about this cook..."
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendFollowUp()}
                />
                <button
                  onClick={sendFollowUp}
                  disabled={followUpLoading || !followUp.trim()}
                  className="bg-[#D9381E] hover:bg-[#b82d17] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition"
                >
                  {followUpLoading ? '...' : 'Ask'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCoach;
