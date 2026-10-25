import { S, monthTx, catOptions } from '../state.js';
import { esc, ymLabel, ymNow, todayIso } from '../util.js';
import { txTable, heading } from './parts.js';

export function vTransaksjoner() {
  const f = S.filter;
  let rows = monthTx(S.month);
  if (f.cat === 'none') rows = rows.filter((t) => !t.cat); else if (f.cat !== 'all') rows = rows.filter((t) => t.cat === f.cat);
  if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter((t) => t.text.toLowerCase().includes(q)); }
  const defDate = S.month === ymNow() ? todayIso() : S.month + '-01';
  return `
  ${heading('Transaksjoner', `${ymLabel(S.month)}. Når du endrer kategori, kan appen lage en regel så neste import treffer bedre.`)}
  <section class="panel">
    <div class="formgrid">
      <label class="f">Søk<input class="inp" type="search" id="q" value="${esc(f.q)}" data-input="q" placeholder="F.eks. Rema"></label>
      <label class="f">Vis<select class="inp" data-change="filterCat"><option value="all" ${f.cat === 'all' ? 'selected' : ''}>Alle kategorier</option><option value="none" ${f.cat === 'none' ? 'selected' : ''}>Uten kategori</option>${S.settings.categories.map((c) => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="chk" style="min-height:44px"><input type="checkbox" data-change="autoRules" ${S.autoRules ? 'checked' : ''}>Lag regel når jeg endrer kategori</label>
    </div>
    ${rows.length ? txTable(rows, true) : '<p class="muted">Ingen transaksjoner her.</p>'}
  </section>
  <section class="panel" aria-labelledby="h-add">
    <h2 id="h-add">Legg til manuelt</h2>
    <p class="muted" style="font-size:14px">For kontanter eller utlegg som ikke står på kontoutskriften. Bruk minus for utgifter.</p>
    <form class="formgrid" data-submit="addTx">
      <label class="f">Dato<input class="inp" type="date" name="date" value="${defDate}" required></label>
      <label class="f">Beskrivelse<input class="inp" name="text" required placeholder="F.eks. Loppemarked"></label>
      <label class="f">Beløp (kr)<input class="inp" name="amount" inputmode="decimal" required placeholder="-250"></label>
      <label class="f">Kategori<select class="inp" name="cat">${catOptions(null, true)}</select></label>
      <button class="btn primary" type="submit">Legg til</button>
    </form>
  </section>`;
}
