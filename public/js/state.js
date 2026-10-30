import { ymNow, esc } from './util.js';

// All tilstand i appen samles her.
export const S = {
  me: null,             // { id, email, name, isSuperadmin }
  households: [],       // [{ id, name, role }]
  hid: null,            // valgt husholdning
  role: null,
  settings: null,       // { household, categories, rules, goals, members, invites }
  tx: {},               // { 'YYYY-MM': [transaksjoner] }
  shop: [],
  view: 'oversikt',
  month: ymNow(),
  filter: { q: '', cat: 'all' },
  autoRules: true,
  imp: null,            // CSV-import under arbeid
  receipt: null,        // kvittering under kontroll
  receipts: null,       // arkivet under «Mine kvitteringer»
  wrapText: {},         // AI-tekst per måned+person
  busy: {},
  admin: null,
  groups: null,         // ukategoriserte transaksjoner gruppert per butikk
  shopSug: [],          // hurtigforslag til handlelistene
  sections: [],         // avdelinger i matbutikken, fra serveren
  shopEdit: null,       // varen som redigeres
  shopMode: false,      // handlemodus: store avkrysningsbokser og våken skjerm
  wakeLock: false,
};

export const cat = (id) => S.settings?.categories.find((c) => c.id === id);
export const catName = (id) => cat(id)?.name || 'Uten kategori';
export const monthTx = (ym) => S.tx[ym] || [];
export const allTx = () => Object.values(S.tx).flat();
export const memberName = (id) => {
  if (!id) return '';
  if (id === S.me?.id) return 'deg';
  const m = S.settings?.members.find((x) => x.id === id);
  return m ? (m.name || m.email.split('@')[0]) : 'et tidligere medlem';
};

export function catOptions(selected, withNone) {
  const groups = { utgift: 'Utgifter', inntekt: 'Inntekter', sparing: 'Sparing', overføring: 'Overføringer' };
  let h = withNone ? '<option value="">Velg kategori…</option>' : '';
  for (const k in groups) {
    const cs = S.settings.categories.filter((c) => c.kind === k);
    if (cs.length) h += `<optgroup label="${groups[k]}">` + cs.map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('') + '</optgroup>';
  }
  return h;
}

export function monthStats(ym, userId = null) {
  let income = 0, expense = 0, saving = 0, uncatIn = 0;
  const per = {};
  for (const t of monthTx(ym)) {
    if (userId && t.userId !== userId) continue;
    const c = cat(t.cat);
    if (!c) { if (t.amount < 0) { expense -= t.amount; per._none = (per._none || 0) - t.amount; } else uncatIn += t.amount; continue; }
    if (c.kind === 'inntekt') income += t.amount;
    else if (c.kind === 'utgift') { expense -= t.amount; per[c.id] = (per[c.id] || 0) - t.amount; }
    else if (c.kind === 'sparing') saving -= t.amount;
  }
  const budget = S.settings.categories.filter((c) => c.kind === 'utgift').reduce((a, c) => a + (c.budget || 0), 0);
  return { income, expense, saving, uncatIn, per, budget, pending: monthTx(ym).filter((t) => !t.cat).length, count: monthTx(ym).length };
}

let toastTimer = null;
export function toast(msg) {
  const host = document.getElementById('toastHost');
  host.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.innerHTML = ''; }, 4200);
}
