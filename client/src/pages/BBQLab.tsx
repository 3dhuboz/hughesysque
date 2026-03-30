import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { chat, extractJson } from '../services/gemini';
import {
  Flame,
  FlaskConical,
  ThermometerSun,
  Timer,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';

/* ────────────────────── Types ────────────────────── */

interface FormState {
  meat: string;
  weightKg: number;
  smokerType: string;
  smokerTempC: number;
  method: 'low_and_slow' | 'hot_and_fast';
  wrap: string;
  wood: string;
}

interface SimResult {
  tenderness: number;
  moisture: number;
  barkQuality: number;
  flavourDepth: number;
  estimatedCookTime: string;
  risks: string[];
  pitmasterTip: string;
}

/* ────────────────────── Constants ────────────────────── */

const MEATS = [
  'Brisket',
  'Pork Shoulder/Butt',
  'Beef Ribs',
  'Pork Ribs',
  'Lamb Shoulder',
  'Whole Chicken',
];

const SMOKER_TYPES = ['Offset', 'Pellet', 'Charcoal/Kamado', 'Kettle', 'Electric'];

const WRAPS = [
  'No Wrap',
  'Butcher Paper at 75\u00B0C',
  'Foil at 75\u00B0C',
  'Foil at 65\u00B0C',
];

const WOODS = ['Hickory', 'Mesquite', 'Oak', 'Cherry', 'Apple', 'Pecan', 'Ironbark'];

const LOADING_MESSAGES = [
  'Firing up the simulator...',
  'Stoking the coals...',
  'Checking the smoke ring...',
  'Consulting the pitmaster spirits...',
];

/* ────────────────────── Helpers ────────────────────── */

function barColor(score: number): string {
  if (score >= 8) return 'bg-green-500';
  if (score >= 6) return 'bg-bbq-gold';
  if (score >= 4) return 'bg-orange-500';
  return 'bg-red-500';
}

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  const pct = Math.min(Math.max(score, 0), 10) * 10;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          {icon} {label}
        </span>
        <span className="text-sm font-bold text-white">{score}/10</span>
      </div>
      <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ────────────────────── Component ────────────────────── */

const BBQLab: React.FC = () => {
  const [form, setForm] = useState<FormState>({
    meat: MEATS[0],
    weightKg: 4,
    smokerType: SMOKER_TYPES[0],
    smokerTempC: 120,
    method: 'low_and_slow',
    wrap: WRAPS[0],
    wood: WOODS[0],
  });

  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  /* ── Run simulation ── */
  const simulate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);

    const systemPrompt = `You are a BBQ simulation engine. Given cooking parameters, predict realistic outcomes.
Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "tenderness": <1-10>,
  "moisture": <1-10>,
  "barkQuality": <1-10>,
  "flavourDepth": <1-10>,
  "estimatedCookTime": "<e.g. 8-10 hours>",
  "risks": ["<risk 1>", "<risk 2>"],
  "pitmasterTip": "<one actionable tip>"
}

Rules:
- Scores are realistic integers 1-10 based on the parameters.
- Consider the interaction between meat type, weight, temperature, method, wrap, wood, and smoker type.
- Provide 1-3 genuine risks (empty array only if truly no risk).
- The pitmaster tip should be specific to this exact setup, not generic.
- Cook time should account for weight, temperature, and method.
- Be scientifically accurate about BBQ chemistry (Maillard reaction, collagen breakdown, stall, etc).`;

    const userPrompt = `Simulate this cook:
- Meat: ${form.meat}
- Weight: ${form.weightKg} kg
- Smoker: ${form.smokerType}
- Temperature: ${form.smokerTempC}\u00B0C
- Method: ${form.method === 'low_and_slow' ? 'Low & Slow' : 'Hot & Fast'}
- Wrap: ${form.wrap}
- Wood: ${form.wood}`;

    try {
      const raw = await chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const parsed = extractJson(raw) as SimResult;

      // Clamp scores
      parsed.tenderness = Math.min(10, Math.max(1, Math.round(parsed.tenderness)));
      parsed.moisture = Math.min(10, Math.max(1, Math.round(parsed.moisture)));
      parsed.barkQuality = Math.min(10, Math.max(1, Math.round(parsed.barkQuality)));
      parsed.flavourDepth = Math.min(10, Math.max(1, Math.round(parsed.flavourDepth)));

      setResult(parsed);
    } catch (err: any) {
      console.error('BBQ Lab simulation error:', err);
      setError(err?.message || 'Simulation failed. The smoker choked out.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  /* ── Select styling helper ── */
  const selectCls =
    'w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-bbq-red/60 focus:border-bbq-red transition appearance-none';
  const labelCls = 'block text-sm font-semibold text-gray-400 mb-1.5 uppercase tracking-wider';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-10 md:py-16 animate-in fade-in slide-in-from-bottom-4">
        {/* ── Back link ── */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm font-bold mb-6 transition"
        >
          <ChevronRight size={16} className="rotate-180" /> Back Home
        </Link>

        {/* ── Header ── */}
        <header className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-3 mb-4">
            <FlaskConical className="text-bbq-red" size={36} />
            <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight">
              BBQ <span className="text-bbq-red">LAB</span>
            </h1>
            <Flame className="text-bbq-gold" size={36} />
          </div>
          <p className="text-gray-400 text-lg md:text-xl max-w-xl mx-auto">
            Test it before you smoke it
          </p>
          <div className="mt-4 h-px w-32 mx-auto bg-gradient-to-r from-transparent via-bbq-red to-transparent" />
        </header>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* ───── LEFT: Form ───── */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
              <ThermometerSun size={20} className="text-bbq-gold" />
              Cook Parameters
            </h2>

            <div className="space-y-5">
              {/* Meat */}
              <div>
                <label className={labelCls}>Meat Type</label>
                <select
                  className={selectCls}
                  value={form.meat}
                  onChange={e => updateField('meat', e.target.value)}
                >
                  {MEATS.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weight */}
              <div>
                <label className={labelCls}>Weight (kg)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0.5}
                    max={20}
                    step={0.5}
                    className={selectCls + ' pr-12'}
                    value={form.weightKg}
                    onChange={e => updateField('weightKg', parseFloat(e.target.value) || 1)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">
                    kg
                  </span>
                </div>
              </div>

              {/* Smoker Type */}
              <div>
                <label className={labelCls}>Smoker Type</label>
                <select
                  className={selectCls}
                  value={form.smokerType}
                  onChange={e => updateField('smokerType', e.target.value)}
                >
                  {SMOKER_TYPES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Smoker Temp */}
              <div>
                <label className={labelCls}>
                  Smoker Temperature: <span className="text-bbq-gold">{form.smokerTempC}&deg;C</span>
                </label>
                <input
                  type="range"
                  min={90}
                  max={180}
                  step={5}
                  value={form.smokerTempC}
                  onChange={e => updateField('smokerTempC', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-bbq-red"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>90&deg;C</span>
                  <span>135&deg;C</span>
                  <span>180&deg;C</span>
                </div>
              </div>

              {/* Method */}
              <div>
                <label className={labelCls}>Method</label>
                <div className="flex gap-3">
                  {[
                    { value: 'low_and_slow' as const, label: 'Low & Slow' },
                    { value: 'hot_and_fast' as const, label: 'Hot & Fast' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`flex-1 text-center py-3 px-4 rounded-lg border cursor-pointer transition font-semibold text-sm ${
                        form.method === opt.value
                          ? 'bg-bbq-red/20 border-bbq-red text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="method"
                        value={opt.value}
                        checked={form.method === opt.value}
                        onChange={() => updateField('method', opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Wrap */}
              <div>
                <label className={labelCls}>Wrap</label>
                <select
                  className={selectCls}
                  value={form.wrap}
                  onChange={e => updateField('wrap', e.target.value)}
                >
                  {WRAPS.map(w => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              {/* Wood */}
              <div>
                <label className={labelCls}>Wood Type</label>
                <select
                  className={selectCls}
                  value={form.wood}
                  onChange={e => updateField('wood', e.target.value)}
                >
                  {WOODS.map(w => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Simulate Button */}
            <button
              onClick={simulate}
              disabled={loading}
              className="mt-8 w-full bg-bbq-red hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-full uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-bbq-red/20"
            >
              {loading ? (
                <>
                  <Flame size={18} className="animate-pulse" />
                  {loadingMsg}
                </>
              ) : (
                <>
                  <Flame size={18} />
                  Simulate Cook
                </>
              )}
            </button>
          </div>

          {/* ───── RIGHT: Results ───── */}
          <div className="lg:sticky lg:top-8">
            {/* Empty state */}
            {!result && !loading && !error && (
              <div className="bg-gray-950 border border-gray-800 border-dashed rounded-2xl p-10 md:p-16 text-center">
                <FlaskConical size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-display">
                  Set your parameters and hit Simulate
                </p>
                <p className="text-gray-700 text-sm mt-2">
                  AI-predicted tenderness, moisture, bark, and flavour scores will appear here.
                </p>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="bg-gray-950 border border-gray-800 rounded-2xl p-10 md:p-16 text-center animate-pulse">
                <Flame size={48} className="text-bbq-red mx-auto mb-4 animate-bounce" />
                <p className="text-bbq-gold text-lg font-display font-bold">{loadingMsg}</p>
                <p className="text-gray-600 text-sm mt-2">
                  The AI pitmaster is analysing your setup...
                </p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-gray-950 border border-red-900/50 rounded-2xl p-8 text-center">
                <AlertTriangle size={36} className="text-red-500 mx-auto mb-3" />
                <p className="text-red-400 font-bold mb-2">Simulation Failed</p>
                <p className="text-gray-500 text-sm mb-6">{error}</p>
                <button
                  onClick={reset}
                  className="text-bbq-red hover:text-white text-sm font-bold underline underline-offset-4 transition"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Results */}
            {result && !loading && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                {/* Scores */}
                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl">
                  <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
                    <Flame size={20} className="text-bbq-red" />
                    Predicted Outcomes
                  </h2>

                  <ScoreBar
                    label="Tenderness"
                    score={result.tenderness}
                    icon={<span className="text-base">🥩</span>}
                  />
                  <ScoreBar
                    label="Moisture"
                    score={result.moisture}
                    icon={<span className="text-base">💧</span>}
                  />
                  <ScoreBar
                    label="Bark Quality"
                    score={result.barkQuality}
                    icon={<span className="text-base">🔥</span>}
                  />
                  <ScoreBar
                    label="Flavour Depth"
                    score={result.flavourDepth}
                    icon={<span className="text-base">✨</span>}
                  />
                </div>

                {/* Cook time */}
                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
                  <div className="p-3 bg-bbq-gold/10 rounded-xl">
                    <Timer size={24} className="text-bbq-gold" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                      Estimated Cook Time
                    </p>
                    <p className="text-xl font-display font-bold text-white">
                      {result.estimatedCookTime}
                    </p>
                  </div>
                </div>

                {/* Risks */}
                {result.risks.length > 0 && (
                  <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <AlertTriangle size={16} /> Risks to Watch
                    </h3>
                    <ul className="space-y-2">
                      {result.risks.map((risk, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-amber-200/80"
                        >
                          <ChevronRight size={14} className="mt-0.5 text-amber-500 shrink-0" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pitmaster tip */}
                <div className="bg-bbq-red/10 border border-bbq-red/30 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-bbq-red uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Lightbulb size={16} className="text-bbq-gold" /> Pitmaster Tip
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{result.pitmasterTip}</p>
                </div>

                {/* Try Again */}
                <button
                  onClick={reset}
                  className="w-full border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white font-bold py-3 px-8 rounded-full uppercase tracking-widest text-sm transition-all duration-200"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer disclaimer ── */}
        <div className="mt-16 p-6 bg-gray-950 border border-gray-800 rounded-xl text-center max-w-2xl mx-auto">
          <p className="text-xs text-gray-600 leading-relaxed">
            BBQ Lab predictions are AI-generated estimates based on common BBQ science. Real results
            depend on your specific equipment, ambient conditions, and meat quality. Always use a
            meat thermometer and trust your instincts.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BBQLab;
