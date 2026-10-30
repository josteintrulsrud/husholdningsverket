import { S, catName } from '../state.js';
import { esc, kr, dateLabel, ymLabel } from '../util.js';
import { heading } from './parts.js';

const scanBtn = '<label for="receiptInput" class="btn primary" style="cursor:pointer">Ta bilde av kvittering</label>';
const imgUrl = (id) => `/api/h/${S.hid}/receipts?img=${encodeURIComponent(id)}`;

function card(r) {
  const store = r.receipt.store || r.text;
  const bank = r.bank || (r.text !== store ? r.text : '');
  const n = r.receipt.items?.length || 0;
  return `<section class="panel rcard">
    ${r.hasImg
      ? `<a class="rthumb" href="${imgUrl(r.id)}" target="_blank" rel="noopener"><img src="${imgUrl(r.id)}" alt="Kvittering fra ${esc(store)}" loading="lazy"></a>`
      : '<div class="rthumb none">Uten bilde</div>'}
    <div class="rbody">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><h2 style="overflow-wrap:anywhere">${esc(store)}</h2><strong style="white-space:nowrap">${kr(-r.amount, true)}</strong></div>
      <p class="muted" style="font-size:13px;margin:0">${dateLabel(r.date)} · ${esc(catName(r.cat))}</p>
      <p style="font-size:13px;margin:0">${r.pending
        ? '<span class="pill warn">Venter på kontoutskriften</span>'
        : `<span class="pill ok">Koblet til banken</span>${bank ? ` <span class="muted">${esc(bank)}</span>` : ''}`}</p>
      ${n ? `<details><summary style="cursor:pointer;font-size:14px">${n === 1 ? '1 vare' : n + ' varer'}</summary><div class="rcpt-items">${r.receipt.items.map((v) => `<div><span>${esc(v.n)}</span><span>${v.a != null ? kr(v.a, true) : ''}</span></div>`).join('')}</div></details>` : ''}
      <div><button class="btn small" data-action="delReceipt" data-id="${r.id}" data-pending="${r.pending ? 1 : ''}">Slett kvittering</button></div>
    </div>
  </section>`;
}

export function vKvitteringer() {
  const L = S.receipts;
  if (!L) return `${heading('Mine kvitteringer')}<p class="loading">Laster…</p>`;
  if (!L.length) {
    return `${heading('Mine kvitteringer')}
    <div class="empty"><h2>Ingen kvitteringer ennå</h2><p class="lead">Ta bilde av kvitteringene dine, så samles de her. De kobles automatisk til kortkjøpet når du importerer kontoutskriften, så ingenting telles dobbelt.</p>${scanBtn}</div>`;
  }
  const waiting = L.filter((r) => r.pending).length;
  const months = [];
  for (const r of L) {
    const ym = r.date.slice(0, 7);
    if (months[months.length - 1]?.ym !== ym) months.push({ ym, list: [] });
    months[months.length - 1].list.push(r);
  }
  return `
  ${heading('Mine kvitteringer', `${L.length === 1 ? '1 kvittering' : L.length + ' kvitteringer'}${waiting ? `, ${waiting} venter på kontoutskriften` : ''}. Kvitteringer kobles til kortkjøpet med samme beløp når du importerer, så de telles bare én gang. Betalt kontant eller med et annet kort? Da står kvitteringen som egen utgift.`)}
  <div>${scanBtn}</div>
  ${months.map((m) => `<h2 style="color:inherit;font-size:16px;margin:6px 0 -4px">${ymLabel(m.ym)}</h2><div class="rlist">${m.list.map(card).join('')}</div>`).join('')}`;
}
