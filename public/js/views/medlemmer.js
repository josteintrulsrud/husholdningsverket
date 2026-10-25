import { S } from '../state.js';
import { esc } from '../util.js';
import { heading } from './parts.js';

export function vMedlemmer() {
  const owner = S.role === 'eier';
  const ms = S.settings.members;
  return `
  ${heading('Medlemmer', `Alle i ${esc(S.settings.household.name)} ser økonomien og handlelistene.`)}
  <section class="panel">
    <div>${ms.map((m) => `<div class="ruleline"><span><strong>${esc(m.name || m.email)}</strong>${m.id === S.me.id ? ' (deg)' : ''}<span class="muted" style="display:block;font-size:13px">${esc(m.email)} · ${m.role === 'eier' ? 'Eier' : 'Medlem'}</span></span>
      ${owner && m.id !== S.me.id ? `<button class="btn small danger" data-action="removeMember" data-id="${m.id}">Fjern</button>` : ''}</div>`).join('')}</div>
    ${owner && S.settings.invites.length ? `<h2 style="font-size:15px;margin-top:8px">Venter på svar</h2>${S.settings.invites.map((i) => `<div class="ruleline"><span>${esc(i.email)}</span><span class="pill warn">Invitert</span></div>`).join('')}` : ''}
  </section>
  ${owner ? `<section class="panel" aria-labelledby="h-inv">
    <h2 id="h-inv">Inviter noen</h2>
    <p class="muted" style="font-size:14px">De får en e-post med en lenke som virker i 14 dager.</p>
    <form class="formgrid" data-submit="invite">
      <label class="f">E-post<input class="inp" name="email" type="email" required placeholder="navn@eksempel.no"></label>
      <label class="f">Rolle<select class="inp" name="role"><option value="medlem">Medlem</option><option value="eier">Eier (kan invitere)</option></select></label>
      <button class="btn primary" type="submit">Send invitasjon</button>
    </form>
  </section>` : ''}
  <section class="panel"><h2>Konto</h2><p class="muted" style="font-size:14px">Logget inn som ${esc(S.me.email)}.</p><div><button class="btn" data-action="logout">Logg ut</button></div></section>`;
}
