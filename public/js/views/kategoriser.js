import { S, catName, catOptions } from '../state.js';
import { esc, kr, dateLabel } from '../util.js';
import { heading } from './parts.js';

const span = (a, b) => (a.slice(0, 7) === b.slice(0, 7) ? dateLabel(a) : `${dateLabel(a)} – ${dateLabel(b)}`);

export function vKategoriser() {
  const G = S.groups;
  if (!G) return `${heading('Kategoriser')}<p class="loading">Laster…</p>`;
  if (!G.groups.length) {
    return `${heading('Kategoriser')}
    <div class="empty"><h2>Alt er kategorisert</h2><p class="lead">Ingen transaksjoner mangler kategori. Nye importer kategoriseres automatisk med reglene dine.</p>
    <button class="btn primary" data-action="go" data-view="oversikt">Til oversikten</button></div>`;
  }
  const sugCount = G.groups.filter((g) => G.sug[g.key]).length;
  const shown = G.groups.slice(0, G.shown);
  return `
  ${heading('Kategoriser', `${G.total} transaksjoner uten kategori, fordelt på ${G.groups.length} butikker og mottakere. Velg kategori én gang per butikk, så får alle transaksjonene den, og det lages en regel for senere importer.`)}
  <section class="panel">
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <button class="btn primary" data-action="aiGroups" ${S.busy.groups ? 'disabled' : ''}>${S.busy.groups ? 'Claude foreslår…' : 'Foreslå kategorier med Claude'}</button>
      ${sugCount ? `<button class="btn" data-action="acceptAllGroups" ${S.busy.accept ? 'disabled' : ''}>${S.busy.accept ? 'Lagrer…' : `Godta alle ${sugCount} forslag`}</button>` : ''}
    </div>
    ${sugCount ? '<p class="muted" style="font-size:14px">Se over forslagene før du godtar alle. Du kan endre enkeltgrupper med nedtrekkslisten.</p>' : ''}
  </section>
  <div style="display:flex;flex-direction:column;gap:12px">
  ${shown.map((g) => {
    const s = G.sug[g.key];
    return `<section class="panel" style="gap:10px">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:baseline">
        <h2 style="overflow-wrap:anywhere">${esc(g.key)}</h2>
        <span style="display:flex;gap:8px;align-items:center"><span class="pill">${g.count} stk</span><strong class="${g.sumOre > 0 ? 'amt pos' : ''}">${kr(g.sumOre)}</strong></span>
      </div>
      <p class="muted" style="font-size:13px">${span(g.first, g.last)} · ${g.samples.map(esc).join(' · ')}</p>
      ${g.generic ? '<p class="muted" style="font-size:13px">Teksten er for generell til å bli en regel, så bare disse transaksjonene kategoriseres.</p>' : ''}
      <div class="row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        ${s ? `<button class="btn small primary" data-action="acceptGroup" data-key="${esc(g.key)}">Godta: ${esc(catName(s))}</button>` : ''}
        <label class="sr" for="g-${encodeURIComponent(g.key)}">Kategori for ${esc(g.key)}</label>
        <select class="inp sm" id="g-${encodeURIComponent(g.key)}" data-change="groupCat" data-key="${esc(g.key)}">${catOptions(null, true)}</select>
      </div>
    </section>`;
  }).join('')}
  </div>
  ${G.groups.length > G.shown ? `<div><button class="btn dark" data-action="moreGroups">Vis flere (${G.groups.length - G.shown} igjen)</button></div>` : ''}`;
}
