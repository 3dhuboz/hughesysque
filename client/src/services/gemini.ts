// Module-level key that AppContext sets from D1 settings — works in incognito/new devices
let _runtimeKey = '';
export const setGeminiApiKey = (key: string) => { _runtimeKey = key; };

const getApiKey = () => {
  if (_runtimeKey) return _runtimeKey;
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_API_KEY) || '';
};

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const SITE_URL = 'https://hugheseysque.au';
const SITE_NAME = 'Hughesys Que';

export async function chat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  model = 'google/gemini-2.5-flash'
): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_NAME,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export function extractJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  return JSON.parse(match[0]);
}

export const generateSocialPost = async (topic: string, platform: 'Facebook' | 'Instagram') => {
  try {
    const key = getApiKey();
    if (!key) return { content: 'API Key missing. Please configure in Admin > Settings.', hashtags: [] };

    const text = await chat([{
      role: 'user',
      content: `You are an expert social media manager for "Hughesys Que", a mobile BBQ catering business.
Write a catchy, engaging ${platform} post about: "${topic}".
Include emojis appropriate for BBQ.
Return ONLY a JSON object with "content" (the post text) and "hashtags" (array of strings).`,
    }]);

    return extractJson(text);
  } catch (error: any) {
    console.error('Social post error:', error);
    const msg = error?.message || String(error);
    if (msg.includes('401') || msg.includes('invalid_api_key')) {
      return { content: 'Invalid API Key. Please check your OpenRouter key in Admin > Settings.', hashtags: [] };
    }
    return { content: `AI Error: ${msg.substring(0, 120)}`, hashtags: [] };
  }
};

export const generateMarketingImage = async (prompt: string): Promise<string | null> => {
  const key = getApiKey();
  if (!key) return null;

  const fullPrompt = `Generate a professional food photography image: ${prompt}. Style: high quality, appetizing, cinematic lighting, no text or watermarks, BBQ themed.`;

  try {
    const res = await fetch(`${OPENROUTER_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SITE_URL,
        'X-Title': SITE_NAME,
      },
      body: JSON.stringify({
        model: 'openai/dall-e-3',
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024',
      }),
    });

    if (!res.ok) {
      console.error('OpenRouter image error:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = await res.json();
    // OpenRouter images/generations returns { data: [{ url: "..." }] }
    if (data.data?.[0]?.url) {
      return data.data[0].url;
    }
    // Fallback: check b64_json format
    if (data.data?.[0]?.b64_json) {
      return `data:image/png;base64,${data.data[0].b64_json}`;
    }
    return null;
  } catch (error: any) {
    console.error('Image generation error:', error?.message || error);
    return null;
  }
};

export const analyzePostTimes = async () => {
  try {
    const key = getApiKey();
    if (!key) return 'API Key missing.';
    return await chat([{
      role: 'user',
      content: 'What are the best times to post on Instagram and Facebook for a food business in Australia? Give a concise bulleted list of 3 best slots for the upcoming week.',
    }]);
  } catch {
    return 'Could not analyze times.';
  }
};

export const generateEventPromotion = async (title: string, location: string, time: string) => {
  try {
    const key = getApiKey();
    if (!key) return { description: 'API Key missing.', tags: [] };

    const text = await chat([{
      role: 'user',
      content: `Write a short, exciting promotional description for a BBQ pop-up event.
Event: ${title}
Location: ${location}
Time: ${time}

Return ONLY a JSON object with:
- description: (max 2 sentences, engaging)
- tags: (array of 5 trending hashtags for food/events)`,
    }]);

    return extractJson(text);
  } catch (error) {
    console.error('Event promotion error:', error);
    return { description: 'Error generating content.', tags: [] };
  }
};

export const generateSocialRecommendations = async (stats: any) => {
  try {
    const key = getApiKey();
    if (!key) return 'API Key missing.';

    return await chat([{
      role: 'user',
      content: `You are a social media strategist for "Hughesys Que".
Analyze these monthly performance stats:
- Total Followers: ${stats.followers}
- Monthly Reach: ${stats.reach}
- Engagement Rate: ${stats.engagement}%
- Posts Count: ${stats.postsLast30Days}

Provide 3 specific, high-impact recommendations to improve brand awareness and food truck sales.
Focus on content types, timing, or community interaction.
Format as a concise bulleted list.`,
    }]);
  } catch (error) {
    console.error('Social recommendations error:', error);
    return 'Unable to analyze stats at this time.';
  }
};

export const generateCateringDescription = async (pkgName: string, items: { meats: number; sides: number }) => {
  try {
    const key = getApiKey();
    if (!key) return 'API Key missing.';

    return await chat([{
      role: 'user',
      content: `Write a mouth-watering, professional description for a BBQ catering package named "${pkgName}".
It includes ${items.meats} meat choices and ${items.sides} side dishes.
Target audience: Corporate events, weddings, and large parties.
Tone: Premium, abundant, delicious.
Max length: 2 sentences.`,
    }]);
  } catch (error) {
    console.error('Catering description error:', error);
    return '';
  }
};

export interface SmartScheduledPost {
  platform: 'Instagram' | 'Facebook';
  scheduledFor: string;
  topic: string;
  content: string;
  hashtags: string[];
  imagePrompt: string;
  reasoning: string;
  pillar: string;
}

export const generateSmartSchedule = async (context: {
  stats: { followers: number; engagement: number; reach: number; postsLast30Days: number };
  cookDays: { date: string; location: string; title: string }[];
  menuItems: { name: string; category: string; price: number }[];
  postsToGenerate?: number;
  existingPosts?: { platform: string; scheduledFor: string; status: string }[];
  startDate?: string;
  intent?: 'fresh' | 'saturate' | 'fill_gaps';
}): Promise<{ posts: SmartScheduledPost[]; strategy: string }> => {
  const start = context.startDate ? new Date(context.startDate + 'T00:00:00') : new Date();
  const windowEnd = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

  try {
    const res = await fetch('/api/v1/ai/smart-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...context,
        now: start.toISOString(),
        windowEnd: windowEnd.toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) return { posts: [], strategy: `Error: ${data.error || res.statusText}` };
    return { posts: data.posts || [], strategy: data.strategy || '' };
  } catch (error: any) {
    const msg = error?.message || 'Network error — is the dev server running?';
    console.error('Smart Schedule Error:', msg);
    return { posts: [], strategy: `Error: ${msg}` };
  }
};

export const askPitmasterAI = async (history: { role: 'user' | 'model'; text: string }[], newMessage: string) => {
  try {
    const key = getApiKey();
    if (!key) return 'System Offline: API Key Missing.';

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      {
        role: 'system',
        content: `You are 'Pitmaster Macca', the head pitmaster and owner of "Hughesys Que", a mobile BBQ catering business.
Your expertise is Low & Slow American BBQ smoked over Australian Ironbark wood.

Persona Guidelines:
1. You are Macca. Speak in the first person ("I", "me", "my smoker").
2. Be friendly, knowledgeable, and passionate. Use a bit of Aussie slang occasionally (e.g., "G'day", "Mate", "Ripper").
3. You prefer temperatures in Fahrenheit (as per BBQ tradition) but convert if asked.
4. Key Temps: Brisket pulls at ~203F. Pork at ~205F. Chicken at 165F.
5. Wood: You SWEAR by seasoned Ironbark for the best heat and flavor.
6. If asked something unrelated to BBQ, meat, or Hughesys Que, politely steer the conversation back to food.
7. Keep answers concise and practical.`,
      },
      ...history.map(h => ({
        role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: h.text,
      })),
      { role: 'user' as const, content: newMessage },
    ];

    return await chat(messages);
  } catch (error) {
    console.error('Pitmaster AI Error:', error);
    return 'The smoker is choked up (Error connecting to AI).';
  }
};
