import { S } from '../state.js';
import { esc } from '../util.js';
import { heading } from './parts.js';

export function vAdmin() {
  const A = S.admin;
  return `
  ${heading('Husholdninger', 'Opprett husholdninger og inviter den første eieren. Eieren inviterer resten av familien selv.')}
  <div class="notice">Som superadmin ser du bare navn, medlemmer og invitasjoner. Transaksjoner, budsjetter og saldoer i andre husholdninger er ikke tilgjengelige herfra.</div>
  <section class="panel" aria-labelledby="h-new">
    <h2 id="h-new">Ny husholdning</h2>
    <form class="formgrid" data-submit="adminCreate">
      <label class="f">Navn<input class="inp" name="name" required placeholder="F.eks. Familien Trulsrud"></label>
      <label class="f">Eierens e-post<input class="inp" name="ownerEmail" type="email" required value="${S.admin?.list?.length ? '' : esc(S.me.email)}"></label>
      <button class="btn primary" type="submit">Opprett</button>
    </form>
  </section>
  <section class="panel">
    ${!A ? '<p class="muted">Laster…</p>' : !A.list.length ? '<p class="muted">Ingen husholdninger ennå.</p>' : `<div class="tablewrap"><table>
      <thead><tr><th>Husholdning</th><th>Eier</th><th>Medlemmer</th><th>Venter</th><th><span class="sr">Handlinger</span></th></tr></thead>
      <tbody>${A.list.map((h) => `<tr><td style="font-weight:600">${esc(h.name)}</td><td class="muted">${esc(h.owners || '–')}</td><td>${h.members}</td>
        <td>${h.pending ? `<span class="pill warn">${esc(h.pending)}</span>` : ''}</td>
        <td class="num"><button class="btn small" data-action="adminInvite" data-id="${h.id}" data-name="${esc(h.name)}">Inviter eier</button></td></tr>`).join('')}</tbody></table></div>`}
  </section>`;
}
