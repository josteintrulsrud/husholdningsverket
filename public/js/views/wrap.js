import { S, monthTx, cat, catName, monthStats } from '../state.js';
import { esc, kr, ymLabel, ymNow, ymShift, monthName, dateLabel, merchantKey } from '../util.js';

const CAFE_RE = /KAFFE|KAFE|CAFE|CAFÉ|COFFEE|ESPRESSO|STARBUCKS|BAKERI|BAKER |DEG 7|WAYNE|JACU|TIM WENDELBOE|BRENNERI/i;
const WD = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];
const WDF = ['mandager', 'tirsdager', 'onsdager', 'torsdager', 'fredager', 'lørdager', 'søndager'];
let lastAnimated = null;

const isExpense = (t) => t.amount < 0 && (!cat(t.cat) || cat(t.cat).kind === 'utgift');

export function wrapData(ym, who) {
  const mine = (t) => !who || t.userId === who;
  const tx = monthTx(ym).filter(mine);
  const prevTx = monthTx(ymShift(ym, -1)).filter(mine);
  const exp = tx.filter(isExpense);
  const spent = exp.reduce((a, t) => a - t.amount, 0);
  const prevSpent = prevTx.filter(isExpense).reduce((a, t) => a - t.amount, 0);
  const per = {}, prevPer = {};
  for (const t of exp) if (t.cat) per[t.cat] = (per[t.cat] || 0) - t.amount;
  for (const t of prevTx) if (isExpense(t) && t.cat) prevPer[t.cat] = (prevPer[t.cat] || 0) - t.amount;
  const cats = Object.entries(per).sort((a, b) => b[1] - a[1]);
  let jump = null;
  for (const [k, v] of cats) { const pv = prevPer[k] || 0, d = v - pv; if (pv > 0 && d > 0 && (!jump || d > jump.d)) jump = { k, d, pct: Math.round(d / pv * 100) }; }
  const merch = {};
  for (const t of exp) { const k = merchantKey(t.text); if (!k) continue; merch[k] = merch[k] || { n: 0, sum: 0 }; merch[k].n++; merch[k].sum -= t.amount; }
  const fav = Object.entries(merch).sort((a, b) => b[1].n - a[1].n || b[1].sum - a[1].sum)[0];
  const biggest = exp.slice().sort((a, b) => a.amount - b.amount)[0];
  const cafe = exp.filter((t) => CAFE_RE.test(t.text));
  const cafeCount = {}; cafe.forEach((t) => { const k = merchantKey(t.text); cafeCount[k] = (cafeCount[k] || 0) + 1; });
  const cafeFav = Object.entries(cafeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const spiseId = S.settings.categories.find((c) => c.name === 'Restaurant og kafé')?.id;
  const eat = exp.filter((t) => t.cat === spiseId && !CAFE_RE.test(t.text));
  const klaerId = S.settings.categories.find((c) => c.name === 'Klær')?.id;
  const clothes = per[klaerId] || 0, prevClothes = prevPer[klaerId] || 0;
  const [y, m] = ym.split('-').map(Number);
  const wd = [0, 0, 0, 0, 0, 0, 0]; const days = new Set();
  for (const t of exp) { const d = Number(t.date.slice(8, 10)); days.add(d); wd[(new Date(y, m - 1, d).getDay() + 6) % 7] -= t.amount; }
  const dim = ym === ymNow() ? new Date().getDate() : new Date(y, m, 0).getDate();
  let income = 0, saving = 0;
  for (const t of tx) { const c = cat(t.cat); if (!c) continue; if (c.kind === 'inntekt') income += t.amount; if (c.kind === 'sparing') saving -= t.amount; }
  const budgetCats = S.settings.categories.filter((c) => c.kind === 'utgift' && c.budget);
  const hhPer = monthStats(ym).per;
  const withinBudget = budgetCats.filter((c) => (hhPer[c.id] || 0) <= c.budget).length;
  const inMonth = (x) => x && String(x).slice(0, 7) === ym;
  const bought = S.shop.filter((x) => x.done && (!who || x.doneBy === who) && inMonth(x.doneAt)).length;
  const added = S.shop.filter((x) => (!who || x.by === who) && inMonth(x.at)).length;
  const receipts = tx.filter((t) => t.receipt).length;
  return { spent, prevSpent, cats, jump, fav, biggest, cafe, cafeSum: cafe.reduce((a, t) => a - t.amount, 0), cafeFav, eat, clothes, prevClothes, wd, noSpend: Math.max(0, dim - days.size), dim, income, saving, withinBudget, budgetCount: budgetCats.length, bought, added, receipts, count: exp.length };
}

function trend(now, before, prevYm) {
  if (!before) return '';
  const pct = Math.round((now - before) / before * 100);
  if (pct === 0) return '<span class="trend">Som forrige måned</span>';
  return `<span class="trend ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '+' : '−'}${Math.abs(pct)} % fra ${monthName(prevYm)}</span>`;
}

export const wrapKey = () => `${S.month}|${S.wrapWho || S.me.id}`;

export function vWrap() {
  const who = S.wrapWho === 'alle' ? null : (S.wrapWho || S.me.id);
  const W = wrapData(S.month, who);
  const mName = monthName(S.month), prevYm = ymShift(S.month, -1);
  const person = who ? (S.settings.members.find((x) => x.id === who)?.name || '') : '';
  const anim = lastAnimated !== wrapKey(); lastAnimated = wrapKey();
  const members = S.settings.members;
  const picker = members.length > 1 ? `<label class="sr" for="wrapWho">Vis for</label><select class="hhselect" id="wrapWho" data-change="wrapWho">
      ${members.map((mm) => `<option value="${mm.id}" ${mm.id === (who || '') ? 'selected' : ''}>${esc(mm.id === S.me.id ? 'Meg' : (mm.name || mm.email))}</option>`).join('')}
      <option value="alle" ${!who ? 'selected' : ''}>Hele husholdningen</option></select>` : '';
  const head = `<div class="wrap-hero"><div><p class="lead">Måneden din</p><h1>${ymLabel(S.month)}</h1></div><div style="display:flex;gap:10px;flex-wrap:wrap">${picker}<button class="btn dark" data-action="prevMonth">Se forrige måned</button></div></div>`;

  if (!W.count) return `${head}<div class="empty"><h2>Ingen utgifter registrert i ${mName}</h2><p class="lead">Importer kontoutskriften for måneden, så lager appen en oppsummering.</p><button class="btn primary" data-action="go" data-view="import">Importer CSV</button></div>`;

  const top = W.cats.slice(0, 5), max = top.length ? top[0][1] : 1;
  const wmax = Math.max(...W.wd, 1), wTop = W.wd.indexOf(Math.max(...W.wd));
  const ai = S.wrapText[wrapKey()];
  const title = who ? `${person ? esc(person.split(' ')[0]) + 's' : 'Din'} ${mName}` : `Husholdningens ${mName}`;
  const c = [];
  c.push(`<div class="wcard sky big"><span class="lbl">${title}</span><div><div class="num">${kr(W.spent)}</div><p class="sub" style="margin-top:8px">brukt på ${W.count} kjøp ${trend(W.spent, W.prevSpent, prevYm)}</p></div>
    ${ai ? `<p style="font-size:16px;line-height:1.5;max-width:60ch;margin:0">${esc(ai)}</p>` : `<div><button class="btn" data-action="wrapAi" ${S.busy.wrap ? 'disabled' : ''} style="background:var(--sky-ink);border-color:var(--sky-ink);color:#fff">${S.busy.wrap ? 'Claude skriver…' : 'Få en oppsummering fra Claude'}</button></div>`}</div>`);
  if (top.length) c.push(`<div class="wcard"><span class="lbl">Her gikk pengene</span><div class="cbar">${top.map(([k, v]) => `<div class="r"><b>${esc(catName(k))}</b><i style="width:${Math.max(4, Math.round(v / max * 100))}%"></i><span>${kr(v)}</span></div>`).join('')}</div></div>`);
  if (W.cafe.length) c.push(`<div class="wcard deep"><span class="lbl">Kafébesøk</span><div><div class="num">${W.cafe.length}</div><p class="sub" style="margin-top:8px">besøk for til sammen ${kr(W.cafeSum)}${W.cafeFav ? `. Stamstedet: ${esc(W.cafeFav)}` : ''}</p></div></div>`);
  if (W.eat.length) c.push(`<div class="wcard"><span class="lbl">Spist ute</span><div><div class="num md">${W.eat.length} ganger</div><p class="sub" style="margin-top:8px">${kr(W.eat.reduce((a, t) => a - t.amount, 0))} på restaurant og takeaway</p></div></div>`);
  if (W.clothes) c.push(`<div class="wcard"><span class="lbl">Klær</span><div><div class="num md">${kr(W.clothes)}</div><p class="sub" style="margin-top:8px">${trend(W.clothes, W.prevClothes, prevYm) || 'Ingen klær registrert forrige måned'}</p></div></div>`);
  if (W.fav) c.push(`<div class="wcard sky"><span class="lbl">Mest besøkt</span><div><div class="num md" style="overflow-wrap:anywhere">${esc(W.fav[0])}</div><p class="sub" style="margin-top:8px">${W.fav[1].n} ganger, ${kr(W.fav[1].sum)} totalt</p></div></div>`);
  c.push(`<div class="wcard deep"><span class="lbl">Ukedagene</span><div><div class="wk" role="img" aria-label="Mest brukt på ${WDF[wTop]}">${W.wd.map((v, i) => `<i class="${i === wTop ? 'top' : ''}" style="height:${Math.round(v / wmax * 100)}%"></i>`).join('')}</div><div class="wkl" aria-hidden="true">${WD.map((d) => `<span>${d}</span>`).join('')}</div></div><p class="sub">Mest penger går på ${WDF[wTop]}.</p></div>`);
  if (W.biggest) c.push(`<div class="wcard"><span class="lbl">Største kjøp</span><div><div class="num md">${kr(-W.biggest.amount)}</div><p class="sub" style="margin-top:8px">${esc(W.biggest.text)}, ${dateLabel(W.biggest.date)}</p></div></div>`);
  c.push(`<div class="wcard"><span class="lbl">Dager uten kjøp</span><div><div class="num">${W.noSpend}</div><p class="sub" style="margin-top:8px">av ${W.dim} dager${W.noSpend >= 8 ? '. Godt jobbet!' : ''}</p></div></div>`);
  if (W.jump) c.push(`<div class="wcard"><span class="lbl">Økte mest</span><div><div class="num md">${esc(catName(W.jump.k))}</div><p class="sub" style="margin-top:8px">${kr(W.jump.d)} mer enn i ${monthName(prevYm)} (+${W.jump.pct} %)</p></div></div>`);
  if (W.saving) c.push(`<div class="wcard sky"><span class="lbl">Satt av til sparing</span><div><div class="num md">${kr(W.saving)}</div><p class="sub" style="margin-top:8px">${W.income ? Math.round(W.saving / W.income * 100) + ' % av inntektene' : 'Fint!'}</p></div></div>`);
  if (W.budgetCount) c.push(`<div class="wcard"><span class="lbl">Husholdningens budsjett</span><div><div class="num md">${W.withinBudget} av ${W.budgetCount}</div><p class="sub" style="margin-top:8px">kategorier holdt seg innenfor</p></div></div>`);
  if (W.bought || W.added || W.receipts) c.push(`<div class="wcard deep"><span class="lbl">Bidrag hjemme</span><div><div class="num md">${W.bought} varer handlet</div><p class="sub" style="margin-top:8px">${W.added} lagt til på handlelistene${W.receipts ? `, ${W.receipts} kvitteringer skannet` : ''}</p></div></div>`);

  return `${head}<section class="wrap ${anim ? 'reveal' : ''}" aria-label="Oppsummering av ${mName}">${c.join('')}</section>
  <p class="lead" style="font-size:13px">Transaksjoner regnes til den som importerte eller la dem inn.</p>`;
}

export function wrapFacts() {
  const who = S.wrapWho === 'alle' ? null : (S.wrapWho || S.me.id);
  const W = wrapData(S.month, who);
  return {
    maaned: ymLabel(S.month), brukt_kr: Math.round(W.spent / 100), forrige_maaned_kr: Math.round(W.prevSpent / 100),
    toppkategorier: W.cats.slice(0, 5).map(([k, v]) => ({ kategori: catName(k), kr: Math.round(v / 100) })),
    kafebesok: W.cafe.length, kafe_kr: Math.round(W.cafeSum / 100), spist_ute: W.eat.length, klaer_kr: Math.round(W.clothes / 100),
    mest_besokt: W.fav ? W.fav[0] : null, dager_uten_kjop: W.noSpend, sparing_kr: Math.round(W.saving / 100), varer_handlet: W.bought,
  };
}
