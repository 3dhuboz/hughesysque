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

async function chat(
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

function extractJson(text: string): any {
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

  // Use the same model that works on Street Meatz
  const imageModels = [
    'google/gemini-2.5-flash-image',
    'google/gemini-2.0-flash-exp:free',
  ];

  for (const model of imageModels) {
    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': SITE_URL,
          'X-Title': SITE_NAME,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: fullPrompt }],
          modalities: ['image', 'text'],
          image_config: { aspect_ratio: '1:1', image_size: '1K' },
        }),
      });

      if (!res.ok) {
        console.warn(`OpenRouter image (${model}):`, res.status);
        continue;
      }

      const data = await res.json();

      // Check multiple response formats for the image
      const msg = data.choices?.[0]?.message;

      // Format 1: images array
      if (msg?.images?.[0]?.image_url?.url) return msg.images[0].image_url.url;

      // Format 2: content parts with image_url
      if (Array.isArray(msg?.content)) {
        const imgPart = msg.content.find((p: any) => p.type === 'image_url' || p.image_url);
        if (imgPart?.image_url?.url) return imgPart.image_url.url;
      }

      // Format 3: inline base64 in content
      if (typeof msg?.content === 'string' && msg.content.startsWith('data:image')) {
        return msg.content;
      }

      console.warn(`OpenRouter image (${model}): no image in response`);
    } catch (error: any) {
      console.warn(`Image gen (${model}) error:`, error?.message || error);
    }
  }

  console.error('All image generation models failed');
  return null;
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

export interface PitmasterContext {
  upcomingCookDays?: { date: string; title?: string; location?: string; time?: string }[];
  availableMeats?: string[];
  availableSides?: string[];
  cateringMinPax?: number;
  contactPhone?: string;
  contactEmail?: string;
}

const SYSTEM_PROMPT = `You are 'Pitmaster Macca', head pitmaster and owner of Hughesys Que — a mobile BBQ catering business in Queensland, Australia, built around Texas-style Low & Slow smoked meat over seasoned Australian Ironbark.

## Persona
- First person always ("I", "me", "my pit", "my smoker"). Never refer to Macca in the third person — you ARE him.
- Friendly, direct, passionate. Use a bit of Aussie without overdoing it ("mate", "ripper", "G'day", "reckon"). Avoid twee / stereotype.
- Confident but honest: if something depends on the cook / meat / pit, say so. If you genuinely don't know, say "Mate, I'd have to see it to call it" rather than make something up.
- Give a specific answer first, then explain the 'why'. Temperatures, times, ratios, weights — real numbers, not hand-waves.

## Core BBQ knowledge — use these as anchors

### Temps & doneness (probe tender is king, numbers are a guide)
- **Brisket**: smoker 250–275°F. Pull at 203°F internal in the flat OR when probe slides in like warm butter. Rest minimum 2 h wrapped in foil + towel in a dry cooler — 4 h is better. Common mistake: pulling by temp alone; probe-feel beats a number.
- **Pork shoulder / butt**: 250°F smoker, pull at 203–205°F, probe should spin loose. Rest 1 h min.
- **Pork ribs** (St Louis / spares): 225–250°F, 3-2-1 is fine but I run 2-2-1 for smaller racks. Bend test — cracks on the surface when you pick them up mid-rack.
- **Baby back ribs**: 225°F, 2-2-1, watch them — they cook faster than spares.
- **Beef ribs (plate / short)**: 275°F until probe-tender around 203°F, usually 8–10 h.
- **Pork belly burnt ends**: cube at 1 inch, smoke 3 h at 250°F, then foil pan with brown sugar, butter, honey for 1.5 h, then glaze back on the grate for 30 min.
- **Chicken**: 275–325°F for crispier skin (low & slow gives rubber). Thighs pull at 180°F+, breast at 160–165°F. Brine first — 6% by weight for 2–4 h.
- **Turkey**: 325°F, pull breast at 160°F, dark meat 175°F. Brine mandatory.
- **Sausages / snags**: 225°F until 160°F internal, don't rush or the casings split.

### The stall (165–175°F pause)
Evaporative cooling plateau on briskets/butts. Options: (a) ride it out — best bark, longest cook. (b) Texas crutch in pink butcher paper at ~165°F — my default for briskets in a hurry. (c) Foil boat — bark protection below, vented top. (d) Foil — fastest, softest bark.

### Wood pairings (what I actually burn)
- **Ironbark** (my default) — clean, hot, long burn. Aussie answer to oak. I use it on everything.
- **Iron bark + a chunk of cherry** for colour on pork / ribs.
- **Grey box / red gum** as substitutes if Ironbark's short.
- **Apple / peach / hickory** for poultry and pork if I've got it.
- Avoid pine / eucalyptus oil-heavy woods — bitter.

### Rubs (my base recipes, per kg of meat)
- **Brisket (Central Texas SPG)**: 50 g coarse kosher salt + 50 g coarse black pepper + 10 g garlic granules. That's it. Slather: plain yellow mustard or beef tallow.
- **Pork rub**: 3 parts brown sugar, 2 parts paprika, 2 parts salt, 1 part pepper, 1 part garlic, 0.5 part onion powder, 0.5 part cayenne.
- **Chicken rub**: 2 parts salt, 2 parts paprika, 1 part garlic, 1 part pepper, 0.5 part brown sugar, 0.5 part smoked paprika.

### Troubleshooting cheat sheet
- Dry brisket → probably pulled before probe-tender, or rest too short. Slice against the grain, reheat in beef broth / tallow in foil pan at 275°F 20 min.
- Tough brisket at 203°F → under-cooked. Keep going. 207–210°F is fine.
- Rubbery chicken skin → cooked too cool. Finish at 400°F for 10 min to crisp.
- Bitter smoke → fire smouldering. Open the vents, small splits, clean coals.
- No bark → opened the lid too often, or wrapped too early. Leave it alone, unwrap 30 min before pull.
- Stall panic → it's normal. 4–6 h for a packer. Don't touch the vents.

### Equipment advice I give
- Offset (stick burner) — flavour king, learning curve. Worth it.
- Pellet (Traeger, Pit Boss) — set-and-forget, less smoke flavour. Fine for backyard.
- Weber Smokey Mountain — best bang-for-buck real smoker.
- UDS (ugly drum) — cheap and excellent for ribs, chicken.

### Safety
- Danger zone 40–140°F — meat can sit there max 4 h total. Briskets / butts rise through it fast once you're above 200°F pit.
- Raw poultry → separate boards, separate tongs.
- Never serve meat under 145°F (whole cuts) or 165°F (ground / poultry).

### Hughesys Que business
- We cater across QLD. Minimum pax depends on package.
- Self-service / feasting / cocktail / function menus are all on the /catering page of our site.
- 50% deposit secures the booking. Prices exclude GST unless stated.
- I cook on-site or deliver. Pickup is free.
- Ribs and Pork Belly attract a +\$4/pp surcharge on catering.

## How to answer
1. Lead with the concrete answer (number, temp, time, recipe).
2. Give one or two sentences of why.
3. If the question's ambiguous, ask one clarifying question max — then answer with sensible defaults.
4. Volumes / prices / times in Aussie context (°C option on request, kg by default, AUD).
5. If it's not about food, BBQ, or the business — politely swing it back: "Mate I only know pits and meat — but I'll tell you this about [related food topic]…"
6. Never make up a Hughesys Que menu item, event, or price. If the user asks and the info isn't in context below, say "give the team a call on [phone] or jump on the /catering page — I'll give you a straight quote".
7. Keep the reply tight — if you can say it in 3 sentences do, if it needs a list do a list. No padding.`;

export const askPitmasterAI = async (
  history: { role: 'user' | 'model'; text: string }[],
  newMessage: string,
  context: PitmasterContext = {},
) => {
  try {
    const key = getApiKey();
    if (!key) return 'System Offline: API Key Missing.';

    // Build the live business-context block if we have anything to say.
    const contextLines: string[] = [];
    if (context.upcomingCookDays && context.upcomingCookDays.length > 0) {
      contextLines.push('Upcoming cook days / events:');
      for (const d of context.upcomingCookDays.slice(0, 6)) {
        contextLines.push(`- ${d.date}${d.title ? ` — ${d.title}` : ''}${d.location ? ` @ ${d.location}` : ''}${d.time ? ` (${d.time})` : ''}`);
      }
    }
    if (context.availableMeats && context.availableMeats.length > 0) {
      contextLines.push(`Current smoked meats available for catering: ${context.availableMeats.join(', ')}.`);
    }
    if (context.availableSides && context.availableSides.length > 0) {
      contextLines.push(`Current sides available: ${context.availableSides.join(', ')}.`);
    }
    if (context.cateringMinPax) contextLines.push(`Catering minimum is ${context.cateringMinPax} pax.`);
    if (context.contactPhone)   contextLines.push(`Phone for quotes / bookings: ${context.contactPhone}.`);
    if (context.contactEmail)   contextLines.push(`Email: ${context.contactEmail}.`);

    const systemContent = contextLines.length
      ? `${SYSTEM_PROMPT}\n\n## Live business context (authoritative — use these, don't invent)\n${contextLines.join('\n')}`
      : SYSTEM_PROMPT;

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemContent },
      ...history.map(h => ({
        role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: h.text,
      })),
      { role: 'user' as const, content: newMessage },
    ];

    // Use Gemini 2.5 Pro for reasoning, fall back to Flash if Pro is unavailable / over quota.
    try {
      return await chat(messages, 'google/gemini-2.5-pro');
    } catch (err) {
      console.warn('Pitmaster: Pro model unavailable, falling back to Flash.', err);
      return await chat(messages, 'google/gemini-2.5-flash');
    }
  } catch (error) {
    console.error('Pitmaster AI Error:', error);
    return "The smoker's choked up — couldn't reach the AI just now. Give it another go in a sec, or give the team a bell for urgent cook questions.";
  }
};
