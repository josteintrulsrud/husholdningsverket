import { S, monthTx, monthStats, catName, allTx } from '../state.js';
import { esc, kr, ymLabel, ymNow, ymShift, monthName } from '../util.js';
import { txTable, pendingList, bar } from './parts.js';
import { bigCosts, BIG_ORE } from '../storekjop.js';

function wrapBanner() {
  const prev = ymShift(ymNow(), -1);
  if (S.month !== ymNow() || new Date().getDate() > 10 || !monthTx(prev).length) return '';
  const name = monthName(prev);
  return `<div class="banner"><span><strong>${name[0].toUpperCase() + name.slice(1)} er oppsummert</strong><br><span style="font-size:14px">Se hva pengene gikk til forrige måned.</span></span><button class="btn" data-action="openWrap" data-ym="${prev}">Se måneden din</button></div>`;
}

export function vOversikt() {
  const st = monthStats(S.month);
  const [y, mo] = S.month.split('-').map(Number);
  const shopPanel = `<section class="panel" aria-labelledby="h-shop"><h2 id="h-shop">Handlelister</h2>
    ${[['mat', 'Mat'], ['hjem', 'Hus og hjem']].map(([l, n]) => {
      const o = S.shop.filter((x) => x.list === l && !x.done);
      return `<button class="btn" data-action="go" data-view="${l}" style="justify-content:space-between;width:100%;height:auto;min-height:52px;padding:10px 14px;white-space:normal;text-align:left"><span><strong>${n}</strong><span class="muted" style="display:block;font-weight:400;font-size:13px">${o.length ? esc(o.slice(0, 4).map((x) => x.text).join(', ')) + (o.length > 4 ? ' …' : '') : 'Ingenting står på listen'}</span></span><span class="pill ${o.length ? 'ok' : ''}">${o.length}</span></button>`;
    }).join('')}</section>`;

  if (!allTx().length && !S.busy.loadingTx) {
    return `<div><h1>Velkommen, ${esc(S.me.name || '')}</h1></div>
    <div class="empty"><h2>Start med å hente inn transaksjonene</h2>
      <p class="lead">Last ned en kontoutskrift som CSV fra nettbanken og importer den. Appen kategoriserer det den kjenner igjen, og lærer av det du retter.</p>
      <button class="btn primary" data-action="go" data-view="import">Importer CSV</button></div>
    <div class="cols"><div class="narrow" style="flex:1 1 320px">${shopPanel}</div></div>`;
  }

  const left = st.budget - st.expense;
  const isCur = S.month === ymNow();
  const daysLeft = isCur ? new Date(y, mo, 0).getDate() - new Date().getDate() : null;
  const cats = S.settings.categories.filter((c) => c.kind === 'utgift' && (c.budget || st.per[c.id]));
  const pend = monthTx(S.month).filter((t) => !t.cat);
  const recent = monthTx(S.month).slice(0, 6);
  const goals = S.settings.goals;
  const big = bigCosts(S.month);
  const bigSum = big.reduce((a, t) => a - t.amount, 0);
  const bigIn = (id) => big.filter((t) => t.cat === id);

  return `
  <div style="display:flex;flex-direction:column;gap:4px"><h1>${ymLabel(S.month)}</h1>
    <p class="lead">${st.count} transaksjoner${st.pending ? `, ${st.pending} uten kategori` : ''}.</p></div>
  ${wrapBanner()}
  <section class="kpis" aria-label="Nøkkeltall">
    <div class="kpi"><span class="l">Inntekter</span><span class="v">${kr(st.income)}</span><span class="s">${st.uncatIn ? kr(st.uncatIn) + ' innbetalt uten kategori' : 'Lønn og andre inntekter'}</span></div>
    <div class="kpi"><span class="l">Utgifter</span><span class="v">${kr(st.expense)}</span><span class="s">av ${kr(st.budget)} budsjettert</span></div>
    <div class="kpi hero"><span class="l">${left >= 0 ? 'Igjen av budsjettet' : 'Over budsjettet'}</span><span class="v ${left < 0 ? 'neg' : ''}">${kr(Math.abs(left))}</span><span class="s">${daysLeft !== null ? daysLeft + ' dager igjen av måneden' : 'Hele måneden'}</span></div>
    <div class="kpi"><span class="l">Satt av til sparing</span><span class="v pos">${kr(st.saving)}</span><span class="s">${st.income ? Math.round(st.saving / st.income * 100) + ' % av inntektene' : 'Overføringer til sparing'}</span></div>
  </section>
  <div class="cols">
    <section class="panel wide" aria-labelledby="h-b">
      <div class="panel-head"><h2 id="h-b">Budsjett per kategori</h2><button class="btn small" data-action="go" data-view="budsjett">Endre budsjett</button></div>
      ${cats.map((c) => {
        const sp = st.per[c.id] || 0, b = c.budget || 0, over = b ? sp > b : sp > 0;
        const pct = b ? Math.min(100, Math.round(sp / b * 100)) : (sp ? 100 : 0);
        const why = over ? bigIn(c.id) : [];
        return `<div class="brow"><div class="t"><span>${esc(c.name)}</span><span class="${over ? 'over' : ''}">${kr(sp)} <span class="muted" style="font-weight:400">/ ${b ? kr(b) : 'uten budsjett'}</span></span></div>${bar(pct, over, pct + ' prosent brukt')}
          ${why.length ? `<p class="muted" style="font-size:13px;margin:0">Store kjøp: ${why.slice(0, 3).map((t) => `${esc(t.text)} (${kr(-t.amount)})`).join(', ')}${why.length > 3 ? ` og ${why.length - 3} til` : ''}</p>` : ''}</div>`;
      }).join('')}
      ${st.per._none ? `<p class="muted" style="font-size:14px">${kr(st.per._none)} i utgifter er ikke kategorisert ennå.</p>` : ''}
    </section>
    <div class="narrow">
      ${shopPanel}
      <section class="panel" aria-labelledby="h-p">
        <div class="panel-head"><h2 id="h-p">Trenger kategori</h2>${pend.length ? `<span class="pill warn">${pend.length} igjen</span>` : '<span class="pill ok">Ferdig</span>'}</div>
        ${pend.length ? pendingList(pend.slice(0, 5)) : `<p class="muted" style="font-size:14px">Alt i ${monthName(S.month)} er kategorisert.</p>`}
        ${S.groups?.total ? `<button class="btn small" data-action="go" data-view="kategoriser">Kategoriser dine ${S.groups.total} på én gang</button>` : ''}
      </section>
      <section class="panel" aria-labelledby="h-g">
        <div class="panel-head"><h2 id="h-g">Sparemål</h2><button class="btn small" data-action="go" data-view="budsjett">Administrer</button></div>
        ${goals.length ? goals.map((g) => { const pct = g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0; return `<div class="brow"><div class="t"><span>${esc(g.name)}</span><span>${kr(g.saved)} <span class="muted" style="font-weight:400">/ ${kr(g.target)}</span></span></div>${bar(pct, false, pct + ' prosent spart')}</div>`; }).join('') : '<p class="muted" style="font-size:14px">Ingen sparemål ennå.</p>'}
      </section>
    </div>
  </div>
  <section class="panel" aria-labelledby="h-big">
    <div class="panel-head"><h2 id="h-big">Store og uforutsette utgifter</h2>${big.length ? `<span class="pill warn">${kr(bigSum)}</span>` : ''}</div>
    ${big.length
      ? `<p class="muted" style="font-size:14px;margin:0">${big.length === 1 ? 'Ett kjøp' : big.length + ' kjøp'} over ${kr(BIG_ORE)} som ikke er faste trekk.${left < 0 ? ` Uten ${big.length === 1 ? 'det' : 'disse'} ville dere vært ${kr(Math.abs(left + bigSum))} ${left + bigSum >= 0 ? 'under' : 'over'} budsjettet.` : ''}</p>${txTable(big, false)}`
      : `<p class="muted" style="font-size:14px">Ingen enkeltkjøp over ${kr(BIG_ORE)} utenom faste trekk i ${monthName(S.month)}.</p>`}
  </section>
  <section class="panel" aria-labelledby="h-r">
    <div class="panel-head"><h2 id="h-r">Siste transaksjoner</h2><button class="btn small" data-action="go" data-view="transaksjoner">Se alle</button></div>
    ${recent.length ? txTable(recent, false) : `<p class="muted">Ingen transaksjoner i ${monthName(S.month)}.</p>`}
  </section>`;
}
