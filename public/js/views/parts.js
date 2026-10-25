import { S, cat, catName, catOptions, memberName } from '../state.js';
import { esc, kr, dateLabel } from '../util.js';

export const heading = (title, lead) => `<div style="display:flex;flex-direction:column;gap:4px"><h1>${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>`;

const trash = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

export function txTable(rows, editable) {
  const multi = (S.settings.members || []).length > 1;
  return `<div class="tablewrap"><table>
  <thead><tr><th>Dato</th><th>Beskrivelse</th><th>Kategori</th>${multi ? '<th>Hvem</th>' : ''}<th class="num">Beløp</th>${editable ? '<th><span class="sr">Slett</span></th>' : ''}</tr></thead>
  <tbody>${rows.map((t) => `<tr>
    <td class="muted" style="white-space:nowrap">${dateLabel(t.date)}</td>
    <td style="font-weight:600;min-width:160px">${esc(t.text)}${t.by === 'ai' ? ' <span class="pill" style="font-weight:500">AI</span>' : ''}${t.receipt ? ` <span class="pill ok" title="${esc((t.receipt.items || []).map((v) => v.n).join(', '))}">Kvittering</span>` : ''}</td>
    <td>${editable
      ? `<label class="sr" for="c-${t.id}">Kategori</label><select class="inp sm" id="c-${t.id}" data-change="setCat" data-id="${t.id}">${catOptions(t.cat, !t.cat)}</select>`
      : `<span class="${t.cat ? 'pill' : 'pill warn'}">${esc(catName(t.cat))}</span>`}</td>
    ${multi ? `<td class="muted" style="white-space:nowrap">${esc(memberName(t.userId))}</td>` : ''}
    <td class="num amt ${t.amount > 0 ? 'pos' : ''}">${t.amount > 0 ? '+' : ''}${kr(t.amount, true)}</td>
    ${editable ? `<td class="num"><button class="iconbtn" data-action="delTx" data-id="${t.id}" aria-label="Slett ${esc(t.text)}">${trash}</button></td>` : ''}
  </tr>`).join('')}</tbody></table></div>`;
}

export function pendingList(list) {
  const ai = `<button class="btn small" data-action="aiCategorize" ${S.busy.ai ? 'disabled' : ''}>${S.busy.ai ? 'Claude foreslår…' : 'Foreslå kategorier med Claude'}</button>`;
  return `<div>${ai}</div>` + list.map((t) => `
    <div class="pend">
      <div class="t"><span>${esc(t.text)}</span><span>${kr(t.amount, true)}</span></div>
      <div class="muted" style="font-size:13px">${dateLabel(t.date)}${t.sug && cat(t.sug) ? ` · Forslag: <strong style="color:var(--ink)">${esc(catName(t.sug))}</strong>` : ''}</div>
      <div class="row">
        ${t.sug && cat(t.sug) ? `<button class="btn small primary" data-action="acceptSug" data-id="${t.id}">Godta</button>` : ''}
        <label class="sr" for="pc-${t.id}">Kategori for ${esc(t.text)}</label>
        <select class="inp sm" id="pc-${t.id}" data-change="setCat" data-id="${t.id}">${catOptions(null, true)}</select>
      </div>
    </div>`).join('');
}

export function bar(pct, over, label) {
  return `<div class="bar" role="img" aria-label="${label}"><i class="${over ? 'over' : ''}" style="width:${pct}%"></i></div>`;
}
