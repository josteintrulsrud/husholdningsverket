import { S, catName } from '../state.js';
import { esc, kr, parseNum, parseDate, matchRule } from '../util.js';
import { heading } from './parts.js';

// Tolker radene med valgt kolonneoppsett. Brukes både til forhåndsvisning og selve importen.
export function buildImport() {
  const I = S.imp, m = I.map;
  const items = []; let bad = 0;
  for (const r of I.rows) {
    const date = parseDate(r[m.date]);
    const text = (r[m.text] || '').replace(/\s+/g, ' ').trim();
    let amount = NaN;
    if (m.amount >= 0 && r[m.amount] !== undefined && r[m.amount] !== '') amount = parseNum(r[m.amount]);
    else {
      const i = m.in >= 0 ? parseNum(r[m.in]) : NaN, o = m.out >= 0 ? parseNum(r[m.out]) : NaN;
      if (!isNaN(i) || !isNaN(o)) amount = (isNaN(i) ? 0 : Math.abs(i)) - (isNaN(o) ? 0 : Math.abs(o));
    }
    if (!date || !text || isNaN(amount) || amount === 0) { bad++; continue; }
    items.push({ date, amountOre: amount, text, cat: matchRule(S.settings.rules, text) });
  }
  return { items, bad };
}

export function vImport() {
  const I = S.imp;
  let body = `
  ${heading('Importer kontoutskrift', 'Last ned transaksjonene som CSV fra nettbanken, og velg filen her. Transaksjonene blir registrert på deg.')}
  <section class="panel">
    <label class="f">CSV-fil<input class="inp" type="file" accept=".csv,.txt,text/csv" data-change="csvFile" style="padding-top:9px"></label>
    <label class="f">Eller lim inn<textarea class="inp" id="paste" placeholder="Dato;Beskrivelse;Beløp&#10;24.10.2026;REMA 1000 LOMMEDALEN;-284,50"></textarea></label>
    <div><button class="btn" data-action="parsePaste">Les inn tekst</button></div>
  </section>`;
  if (!I) return body;

  const cols = I.header.map((h, i) => `<option value="${i}">${esc(h || 'Kolonne ' + (i + 1))}</option>`).join('');
  const sel = (k, val, opt) => `<select class="inp" data-change="map" data-k="${k}">${opt ? '<option value="-1">Ingen</option>' : ''}${cols.replace(`value="${val}"`, `value="${val}" selected`)}</select>`;
  const p = buildImport();
  return body + `
  <section class="panel" aria-labelledby="h-map">
    <h2 id="h-map">Hvilke kolonner er hva?</h2>
    <p class="muted" style="font-size:14px">${I.rows.length} rader funnet. Sjekk at kolonnene er riktige før du importerer.</p>
    <div class="formgrid">
      <label class="f">Dato${sel('date', I.map.date)}</label>
      <label class="f">Beskrivelse${sel('text', I.map.text)}</label>
      <label class="f">Beløp${sel('amount', I.map.amount, true)}</label>
      <label class="f">Inn (hvis egen kolonne)${sel('in', I.map.in, true)}</label>
      <label class="f">Ut (hvis egen kolonne)${sel('out', I.map.out, true)}</label>
    </div>
    <div class="tablewrap"><table><thead><tr><th>Dato</th><th>Beskrivelse</th><th>Kategori</th><th class="num">Beløp</th></tr></thead><tbody>
    ${p.items.slice(0, 6).map((t) => `<tr><td class="muted">${t.date}</td><td style="font-weight:600">${esc(t.text)}</td><td><span class="${t.cat ? 'pill' : 'pill warn'}">${esc(catName(t.cat))}</span></td><td class="num amt ${t.amountOre > 0 ? 'pos' : ''}">${kr(t.amountOre, true)}</td></tr>`).join('')}
    </tbody></table></div>
    <p style="font-size:14px">${p.items.length} gyldige rader${p.bad ? `, ${p.bad} kunne ikke leses` : ''}. ${p.items.filter((t) => t.cat).length} får kategori automatisk. Rader som allerede er importert, hoppes over.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn primary" data-action="doImport" ${p.items.length && !S.busy.import ? '' : 'disabled'}>${S.busy.import ? 'Importerer…' : `Importer ${p.items.length} rader`}</button>
      <button class="btn" data-action="cancelImport">Avbryt</button>
    </div>
  </section>`;
}
