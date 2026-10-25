import { html } from '../../../lib/http.js';
import { sha256, uuid } from '../../../lib/crypto.js';
import { createSessionCookie } from '../../../lib/session.js';
import { audit } from '../../../lib/audit.js';

// Lenken i e-posten åpner en bekreftelsesside (GET). Selve innloggingen skjer når man trykker
// på knappen (POST). Slik bruker ikke e-postprogrammer som forhåndssjekker lenker opp tokenet.

const page = (title, body) => `<!doctype html><html lang="nb"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<link rel="stylesheet" href="/css/app.css"></head>
<body><main class="auth-page"><div class="auth-card">
<p class="word">Husholdnings<b>verket</b></p>${body}</div></main></body></html>`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const invite = url.searchParams.get('invite');
  if (!token && !invite) return html(page('Ugyldig lenke', '<h1>Lenken er ugyldig</h1><p><a href="/">Gå til innlogging</a></p>'), 400);
  const field = token ? `<input type="hidden" name="token" value="${esc(token)}">` : `<input type="hidden" name="invite" value="${esc(invite)}">`;
  return html(page('Logg inn', `<h1>${invite ? 'Bli med i husholdningen' : 'Logg inn'}</h1>
    <form method="post">${field}<button class="btn primary" type="submit">${invite ? 'Bli med' : 'Fortsett'}</button></form>`));
}

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const token = form.get('token');
  const invite = form.get('invite');
  const fail = (msg) => html(page('Lenken virker ikke', `<h1>Lenken virker ikke</h1><p>${msg}</p><p><a class="btn primary" href="/">Be om ny lenke</a></p>`), 400);

  let userId = null;

  if (token) {
    const hash = await sha256(String(token));
    const row = await env.DB.prepare(
      `SELECT user_id FROM login_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`
    ).bind(hash).first();
    if (!row) return fail('Den er brukt eller har gått ut på tid.');
    await env.DB.prepare(`UPDATE login_tokens SET used_at = datetime('now') WHERE token_hash = ?`).bind(hash).run();
    userId = row.user_id;
  } else if (invite) {
    const hash = await sha256(String(invite));
    const inv = await env.DB.prepare(
      `SELECT id, household_id, email, role FROM invitations WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > datetime('now')`
    ).bind(hash).first();
    if (!inv) return fail('Invitasjonen er brukt eller har gått ut på tid.');
    let user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(inv.email).first();
    if (!user) {
      user = { id: uuid() };
      await env.DB.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(user.id, inv.email.toLowerCase()).run();
    }
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').bind(inv.household_id, user.id, inv.role),
      env.DB.prepare(`UPDATE invitations SET accepted_at = datetime('now') WHERE id = ?`).bind(inv.id),
    ]);
    await audit(env, inv.household_id, user.id, 'invitasjon_akseptert');
    userId = user.id;
  } else {
    return fail('Mangler kode.');
  }

  const cookie = await createSessionCookie(env, userId);
  return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': cookie } });
}
