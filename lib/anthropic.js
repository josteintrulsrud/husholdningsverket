// Kall til Claude API. Nøkkelen ligger som secret (ANTHROPIC_API_KEY) og når aldri nettleseren.
// Nyere modeller tenker før de svarer, og tenkingen teller med i maxTokens. Derfor romslig grense,
// og effort ('low' | 'medium' | 'high') styrer hvor mye den tenker.
export async function askClaude(env, { model, content, maxTokens = 16000, effort }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY mangler');
  const body = { model, max_tokens: maxTokens, messages: [{ role: 'user', content }] };
  if (effort) body.output_config = { effort };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Claude svarte ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) throw new Error(`Tomt svar fra Claude (stop_reason: ${data.stop_reason})`);
  return text;
}

export function parseJson(text) {
  const clean = String(text).replace(/```json|```/g, '').trim();
  const start = clean.search(/[[{]/);
  if (start < 0) throw new Error('Fant ikke JSON i svaret');
  const end = clean.lastIndexOf(clean[start] === '[' ? ']' : '}');
  return JSON.parse(clean.slice(start, end + 1));
}

// Liste med små objekter. Er svaret kuttet, beholdes de objektene som kom helt fram.
export function parseList(text) {
  try { const r = parseJson(text); if (Array.isArray(r)) return r; } catch { /* plukker enkeltobjekter under */ }
  const out = [];
  for (const m of String(text).match(/\{[^{}]*\}/g) || []) {
    try { out.push(JSON.parse(m)); } catch { /* hopper over */ }
  }
  return out;
}
