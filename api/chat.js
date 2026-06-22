/* global process */
// Vercel serverless proxy to the Claude API.
// Keeps ANTHROPIC_API_KEY server-side: it is never shipped to the browser.
// Thin passthrough — the client builds system/messages/tools and drives the loop.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurata sul server.' });
    return;
  }

  try {
    const { system, messages, tools } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Campo "messages" mancante o vuoto.' });
      return;
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system,
        messages,
        tools,
        tool_choice: { type: 'auto' },
      }),
    });

    const data = await upstream.json();
    res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
