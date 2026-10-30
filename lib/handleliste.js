// Tolker det som skrives i handlelisten: flere varer på én gang, antall foran og notat i parentes.
// «melk (laktosefri), 2 brød, 3 pk gjær» -> [{ text: 'Melk', note: 'laktosefri' }, { text: 'Brød', qty: '2' }, { text: 'Gjær', qty: '3 pk' }]

const UNITS = 'stk|pk|pakke|pakker|kg|g|hg|l|dl|liter|boks|bokser|flaske|flasker|pose|poser|brett|glass|rull|ruller';
const LEAD = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(x|${UNITS})?\\.?\\s+(.+)$`, 'i');

export function parseItem(raw) {
  let text = String(raw || '').replace(/\s+/g, ' ').trim();
  let qty = null, note = null;
  const n = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (n) { text = n[1]; note = n[2].trim().slice(0, 100) || null; }
  const m = text.match(LEAD);
  if (m) {
    const unit = m[2] && m[2].toLowerCase() !== 'x' ? ' ' + m[2].toLowerCase() : '';
    qty = m[1] + unit;
    text = m[3].trim();
  }
  text = text.slice(0, 100);
  if (!text) return null;
  return { text: text[0].toUpperCase() + text.slice(1), qty, note };
}

// Mat: komma, semikolon og linjeskift skiller varer. Hus og hjem: bare semikolon og linjeskift,
// siden komma ofte er en del av beskrivelsen («lyspærer E27, varm hvit»).
// Komma mellom to tall er desimalkomma, og komma inni en parentes hører til notatet.
export function parseInput(input, list) {
  const s = String(input || ''), parts = [];
  let cur = '', depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    if (c === ')') depth = Math.max(0, depth - 1);
    const decimal = c === ',' && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '');
    if (depth === 0 && (c === ';' || c === '\n' || (list === 'mat' && c === ',' && !decimal))) { parts.push(cur); cur = ''; } else cur += c;
  }
  parts.push(cur);
  return parts.map(parseItem).filter(Boolean).slice(0, 30);
}

// Sist betalte pris for en vare, fra varelinjene på kvitteringene (nyeste først).
// receipts: [{ store, items: [{ n, a }] }]. «Lettmelk» treffer «TINE Lettmelk 1L».
export function lastPrice(receipts, text) {
  const words = String(text).toLowerCase().split(/[^a-zæøåéü0-9]+/).filter((w) => w.length > 2);
  if (!words.length) return null;
  for (const r of receipts) {
    for (const v of r.items || []) {
      const name = String(v.n || '').toLowerCase();
      if (v.a > 0 && words.every((w) => name.includes(w))) return { ore: v.a, store: r.store || null };
    }
  }
  return null;
}
