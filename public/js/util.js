// Formatering, datoer og CSV-tolking. Ingen tilstand her.
export const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const nf0 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function kr(ore, exact) {
  const v = ore / 100;
  return (exact && ore % 100 !== 0 ? nf2.format(v) : nf0.format(Math.round(v))) + ' kr';
}
export function ymNow() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
export function todayIso() { const d = new Date(); return `${ymNow()}-${String(d.getDate()).padStart(2, '0')}`; }
export function ymShift(ym, n) {
  let [y, m] = ym.split('-').map(Number); m += n;
  while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
  return y + '-' + String(m).padStart(2, '0');
}
export function ymLabel(ym) { const [y, m] = ym.split('-').map(Number); const s = MONTHS[m - 1]; return s[0].toUpperCase() + s.slice(1) + ' ' + y; }
export function monthName(ym) { return MONTHS[Number(ym.split('-')[1]) - 1]; }
export function dateLabel(iso) { const [, m, d] = iso.split('-').map(Number); return d + '. ' + MONTHS[m - 1].slice(0, 3); }

export function merchantKey(text) {
  let t = String(text).toUpperCase().replace(/^(VIPPS\*?|VIPPS|KORTKJØP|VAREKJØP|VISA|NETTGIRO|AVTALEGIRO|EFAKTURA|OVERFØRING)\s*\*?\s*/, '');
  t = t.replace(/\*/g, ' ').replace(/\b\d[\d.,/:-]*\b/g, ' ').replace(/\s+/g, ' ').trim();
  const w = t.split(' ').filter((x) => x.length > 1);
  return (w.slice(0, 2).join(' ') || t).slice(0, 30);
}
export function matchRule(rules, text) {
  const T = ' ' + String(text).toUpperCase().replace(/\s+/g, ' ') + ' ';
  let best = null;
  for (const r of rules) { const m = r.match_text.toUpperCase(); if (m && T.includes(m) && (!best || m.length > best.match_text.length)) best = r; }
  return best ? best.category_id : null;
}

// CSV ------------------------------------------------------------------------
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  let d = ';', best = -1;
  for (const c of [';', '\t', ',']) { const n = first.split(c).length; if (n > best) { best = n; d = c; } }
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else f += ch;
  }
  row.push(f); if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}
export function parseNum(s) {
  if (s == null) return NaN;
  let t = String(s).replace(/[\s\u00a0kr]/gi, '').replace(/\u2212/g, '-');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else t = t.replace(',', '.');
  const v = parseFloat(t);
  return isNaN(v) ? NaN : Math.round(v * 100);
}
export function parseDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/))) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}
export function guessMap(header) {
  const find = (re) => header.findIndex((h) => re.test(h));
  let date = find(/dato|date|bokf/i); if (date < 0) date = 0;
  let text = find(/tekst|beskriv|forklar|description|mottaker|spesifik|melding/i); if (text < 0) text = Math.min(1, header.length - 1);
  const out = find(/^ut\b|ut av|uttak|belastet/i), inn = find(/^inn\b|inn på|innskudd|godskrevet/i);
  let amount = find(/beløp|belop|amount|^sum/i);
  if (amount < 0 && (out < 0 || inn < 0)) amount = header.length - 1;
  return { date, text, amount, in: inn, out };
}

// Bilde -> mindre JPEG i base64 (for kvitteringer)
export async function imageToBase64(file) {
  let blob = file;
  try {
    const bmp = await createImageBitmap(file);
    const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    blob = await new Promise((r) => c.toBlob((b) => r(b || file), 'image/jpeg', 0.85));
  } catch { /* bruk originalen */ }
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { data: btoa(bin), mediaType: blob.type || 'image/jpeg' };
}
