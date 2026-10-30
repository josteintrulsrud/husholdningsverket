// Tolker det som skrives i handlelisten: flere varer på én gang og antall foran varen.
// «melk, 2 brød, 3 pk gjær» -> [{ text: 'Melk' }, { text: 'Brød', qty: '2' }, { text: 'Gjær', qty: '3 pk' }]

const UNITS = 'stk|pk|pakke|pakker|kg|g|hg|l|dl|liter|boks|bokser|flaske|flasker|pose|poser|brett|glass|rull|ruller';
const LEAD = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(x|${UNITS})?\\.?\\s+(.+)$`, 'i');

export function parseItem(raw) {
  let text = String(raw || '').replace(/\s+/g, ' ').trim();
  let qty = null;
  const m = text.match(LEAD);
  if (m) {
    const unit = m[2] && m[2].toLowerCase() !== 'x' ? ' ' + m[2].toLowerCase() : '';
    qty = m[1] + unit;
    text = m[3].trim();
  }
  text = text.slice(0, 100);
  if (!text) return null;
  return { text: text[0].toUpperCase() + text.slice(1), qty };
}

// Mat: komma, semikolon og linjeskift skiller varer. Hus og hjem: bare semikolon og linjeskift,
// siden komma ofte er en del av beskrivelsen («lyspærer E27, varm hvit»). Komma mellom to tall er desimalkomma.
export function parseInput(input, list) {
  const sep = list === 'mat' ? /[;\n]+|(?<!\d),|,(?!\d)/ : /[;\n]+/;
  return String(input || '').split(sep).map(parseItem).filter(Boolean).slice(0, 30);
}
