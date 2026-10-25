import { esc } from '../util.js';

export function vLogin(st = {}) {
  return `<main class="auth-page"><div class="auth-card">
    <p class="word">Husholdnings<b>verket</b></p>
    ${st.sent
      ? `<h1>Sjekk e-posten</h1><p>Vi har sendt en innloggingslenke til ${esc(st.email)} hvis adressen er registrert. Lenken virker i 15 minutter.</p>
         ${st.devLink ? `<p><a class="btn primary" href="${esc(st.devLink)}">Åpne innloggingslenken (lokal utvikling)</a></p>` : ''}
         <button class="btn" data-action="loginAgain">Bruk en annen e-post</button>`
      : `<h1>Logg inn</h1><p>Skriv inn e-posten din, så sender vi deg en innloggingslenke. Du trenger ikke passord.</p>
         <form data-submit="login"><label class="sr" for="email">E-post</label>
         <input class="inp" id="email" name="email" type="email" autocomplete="email" required placeholder="navn@eksempel.no" value="${esc(st.email || '')}">
         <button class="btn primary" type="submit" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Sender…' : 'Send innloggingslenke'}</button></form>
         ${st.error ? `<div class="notice warn">${esc(st.error)}</div>` : ''}`}
  </div></main>`;
}

export function vName() {
  return `<main class="auth-page"><div class="auth-card">
    <p class="word">Husholdnings<b>verket</b></p>
    <h1>Hva heter du?</h1><p>Navnet vises for de andre i husholdningen, for eksempel på handlelistene.</p>
    <form data-submit="setName"><label class="sr" for="nm">Fornavn</label>
    <input class="inp" id="nm" name="name" required autocomplete="given-name" placeholder="Fornavn">
    <button class="btn primary" type="submit">Fortsett</button></form>
  </div></main>`;
}

export function vNoHousehold(isSuperadmin) {
  return `<main class="auth-page"><div class="auth-card">
    <p class="word">Husholdnings<b>verket</b></p>
    <h1>Ingen husholdning ennå</h1>
    ${isSuperadmin
      ? `<p>Opprett din første husholdning. Bruker du din egen e-post som eier, blir du med med en gang.</p><button class="btn primary" data-action="go" data-view="admin">Gå til husholdninger</button>`
      : '<p>Du er ikke med i noen husholdning. Be eieren om å sende deg en invitasjon.</p>'}
    <button class="btn" data-action="logout">Logg ut</button>
  </div></main>`;
}
