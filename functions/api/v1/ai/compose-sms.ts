const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const SITE_URL = 'https://hugheseysque.au';
const SITE_NAME = 'Hughesys Que';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return json({ error: 'OPENROUTER_API_KEY not configured on server.' }, 500);

  try {
    const { businessName, tone, topic, promoDetails, maxChars, menuHighlights, upcomingEvents } = await request.json();
    const name = businessName || 'Hughesys Que';
    const limit = maxChars || 160;

    const eventsContext = upcomingEvents?.length > 0
      ? upcomingEvents.map((e: any) => `${e.date} — ${e.title}${e.location ? ' at ' + e.location : ''}`).join('\n')
      : 'No upcoming events.';

    const menuContext = menuHighlights?.length > 0
      ? menuHighlights.map((m: any) => `${m.name} ($${m.price})`).join(', ')
      : '';

    const prompt = `You are an SMS marketing copywriter for "${name}", a mobile BBQ food truck business in Australia.

TASK: Write a short, punchy SMS message for a customer blast.

BUSINESS: ${name}
TONE: ${tone || 'friendly and exciting'}
TOPIC/PURPOSE: ${topic || 'general promotion'}
${promoDetails ? `PROMO DETAILS: ${promoDetails}` : ''}
${menuContext ? `MENU HIGHLIGHTS: ${menuContext}` : ''}
UPCOMING EVENTS:
${eventsContext}

RULES:
1. Max ${limit} characters (CRITICAL — do NOT exceed)
2. Use emojis sparingly but effectively (1-3 max)
3. Include a clear call-to-action
4. Use {name} as placeholder for customer's first name
5. Use {business} as placeholder for business name
6. Make it feel personal, not spammy
7. Create urgency where appropriate
8. Australian English spelling

Return ONLY valid JSON with exactly this structure:
{
  "messages": [
    { "text": "the SMS message text", "charCount": 123, "tone": "description" },
    { "text": "alternative version", "charCount": 123, "tone": "description" },
    { "text": "third option", "charCount": 123, "tone": "description" }
  ]
}`;

    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SITE_URL,
        'X-Title': SITE_NAME,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return json({ error: `OpenRouter error ${response.status}: ${errText.slice(0, 200)}` }, 500);
    }

    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim();
    if (!raw) return json({ error: 'No text in response.' }, 500);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return json({ error: 'Could not parse response.' }, 500);

    const parsed = JSON.parse(jsonMatch[0]);
    return json({ messages: parsed.messages || [] });
  } catch (error: any) {
    console.error('AI SMS compose error:', error);
    return json({ error: error.message || 'Unknown error' }, 500);
  }
};
