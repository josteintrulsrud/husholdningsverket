import { S, allTx, catOptions } from '../state.js';
import { esc, kr, dateLabel } from '../util.js';

// Forhåndsvisning av koblingen. Selve koblingen gjøres på serveren med samme regel (lib/receipts.js).
export function receiptMatch(R) {
  if (!R || R.total == null) return null;
  const d0 = Date.parse(R.date);
  let best = null, bestDiff = Infinity;
  for (const t of allTx()) {
    if (t.receipt || t.amount !== -R.total) continue;
    const diff = Math.abs(Date.parse(t.date) - d0);
    if (diff <= 5 * 864e5 && diff < bestDiff) { best = t; bestDiff = diff; }
  }
  return best;
}

export function receiptShopHits(R) {
  if (!R || !R.items) return [];
  return S.shop.filter((x) => x.list === 'mat' && !x.done).filter((x) => {
    const words = x.text.toLowerCase().split(/\s+/).filter((s) => s.length > 2);
    return R.items.some((v) => { const n = v.n.toLowerCase(); return words.length ? words.some((w) => n.includes(w)) : n.includes(x.text.toLowerCase()); });
  });
}

export function vKvittering() {
  const R = S.receipt;
  if (!R) return '<h1>Kvittering</h1><p class="lead">Trykk på «Kvittering» øverst for å ta bilde av en kvittering.</p>';
  if (R.busy) return '<h1>Leser kvitteringen…</h1><p class="lead" aria-live="polite">Claude finner butikk, dato, sum og varer. Det tar noen sekunder.</p>';
  if (R.error) return `<h1>Kvittering</h1><div class="notice warn">${esc(R.error)}</div><div><label for="receiptInput" class="btn primary" style="cursor:pointer">Ta nytt bilde</label></div>`;
  const m = receiptMatch(R), hits = receiptShopHits(R);
  return `
  <div style="display:flex;flex-direction:column;gap:4px"><h1>Kontroller kvitteringen</h1><p class="lead">Rett opp det Claude kan ha lest feil før du lagrer.</p></div>
  <section class="panel">
    ${R.img ? `<img src="data:${R.img.mediaType};base64,${R.img.data}" alt="Bildet av kvitteringen" style="max-width:180px;max-height:240px;border-radius:10px;object-fit:contain;align-self:flex-start">` : ''}
    <form class="formgrid" data-submit="saveReceipt">
      <label class="f">Butikk<input class="inp" name="store" value="${esc(R.store)}" required></label>
      <label class="f">Dato<input class="inp" type="date" name="date" value="${R.date}" required></label>
      <label class="f">Sum (kr)<input class="inp" name="total" inputmode="decimal" value="${R.total != null ? (R.total / 100).toFixed(2).replace('.', ',') : ''}" required></label>
      <label class="f">Kategori<select class="inp" name="cat" required>${catOptions(R.cat, !R.cat)}</select></label>
      ${hits.length ? `<label class="chk" style="grid-column:1/-1"><input type="checkbox" name="tick" checked>Huk av på handlelisten: ${hits.map((h) => esc(h.text)).join(', ')}</label>` : ''}
      <div style="grid-column:1/-1">${m
        ? `<div class="notice">Kvitteringen kobles til «${esc(m.text)}» ${dateLabel(m.date)}, ${kr(m.amount, true)}, som allerede er importert.</div>`
        : '<div class="notice">Legges inn som ny transaksjon. Når kortkjøpet kommer med i neste CSV-import, kobles de sammen så det ikke telles dobbelt.</div>'}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;grid-column:1/-1"><button class="btn primary" type="submit">Lagre kvittering</button><button class="btn" type="button" data-action="cancelReceipt">Avbryt</button></div>
    </form>
    ${R.items.length ? `<h2 style="font-size:15px;margin-top:8px">Varer på kvitteringen (${R.items.length})</h2><div class="rcpt-items">${R.items.map((v) => `<div><span>${esc(v.n)}</span><span>${v.a != null ? kr(v.a, true) : ''}</span></div>`).join('')}</div>` : ''}
  </section>`;
}
