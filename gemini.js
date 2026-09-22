// /api/gemini.js
// Vercel serverless function. Keeps the Gemini API key on the server —
// the browser never sees it. Add GEMINI_API_KEY in Vercel's
// Project Settings -> Environment Variables (do NOT commit the key itself).
//
// Model: change GEMINI_MODEL below if your account has access to a
// different Gemini model than the default.

const GEMINI_MODEL = 'gemini-2.5-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { system, prompt, json } = body || {};

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing "prompt" string in request body.' });
    return;
  }

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };
  if (system) {
    payload.systemInstruction = { parts: [{ text: system }] };
  }
  if (json) {
    payload.generationConfig = { responseMimeType: 'application/json' };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok) {
      res.status(r.status).json({ error: data?.error?.message || 'Gemini API error' });
      return;
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!text) {
      res.status(502).json({ error: 'Gemini returned no text (it may have been blocked by safety filters).' });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
  }
}
