import { json, bad, readJson } from '../../../lib/http.js';
import { randomToken, sha256, uuid } from '../../../lib/crypto.js';
import { sendMail, linkMail } from '../../../lib/mail.js';

// POST /api/auth/login { email } – sender innloggingslenke hvis brukeren finnes.
// Svarer alltid likt, så ingen kan sjekke hvilke e-poster som er registrert.
export async function onRequestPost({ request, env }) {
  const { email } = await readJson(request);
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return bad('Skriv inn en gyldig e-postadresse');

  let user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(e).first();

  // Første gang superadmin logger inn, opprettes brukeren automatisk
  if (!user && env.SUPERADMIN_EMAIL && e === env.SUPERADMIN_EMAIL.trim().toLowerCase()) {
    const id = uuid();
    await env.DB.prepare('INSERT INTO users (id, email, is_superadmin) VALUES (?, ?, 1)').bind(id, e).run();
    user = { id };
  }

  if (user) {
    const raw = randomToken();
    await env.DB.prepare(
      `INSERT INTO login_tokens (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))`
    ).bind(await sha256(raw), user.id).run();
    const url = `${new URL(request.url).origin}/api/auth/verify?token=${raw}`;
    await sendMail(env, {
      to: e,
      ...linkMail({
        subject: 'Logg inn på Husholdningsverket',
        intro: 'Trykk på knappen for å logge inn. Lenken virker i 15 minutter og kan bare brukes én gang.',
        url, button: 'Logg inn',
      }),
    });
    if (env.DEV === '1') return json({ ok: true, devLink: url });
  }
  return json({ ok: true });
}
