export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return json({ connected: false, error: 'OPENROUTER_API_KEY not configured on server.' });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const err = await response.text();
      return json({ connected: false, error: `OpenRouter ${response.status}: ${err.slice(0, 100)}` });
    }

    const data = await response.json();
    return json({ connected: true, models: data.data?.length ?? 0 });
  } catch (error: any) {
    return json({ connected: false, error: error?.message || 'Unknown error' });
  }
};
