import { randomToken, sha256, uuid } from './crypto.js';
import { sendMail, linkMail } from './mail.js';

// Lager invitasjon og sender e-post. Returnerer devLink lokalt (DEV=1).
export async function createInvitation(env, { request, householdId, householdName, email, role, invitedBy, inviterName }) {
  const raw = randomToken();
  await env.DB.prepare(
    `INSERT INTO invitations (id, household_id, email, role, token_hash, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+14 days'))`
  ).bind(uuid(), householdId, email, role, await sha256(raw), invitedBy).run();
  const url = `${new URL(request.url).origin}/api/auth/verify?invite=${raw}`;
  await sendMail(env, {
    to: email,
    ...linkMail({
      subject: `Du er invitert til ${householdName} i Husholdningsverket`,
      intro: `${inviterName || 'Noen'} har invitert deg til husholdningen «${householdName}» i Husholdningsverket, der dere har oversikt over økonomien og felles handlelister. Lenken virker i 14 dager.`,
      url, button: 'Bli med',
    }),
  });
  return env.DEV === '1' ? url : null;
}
