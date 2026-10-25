import { json, bad, readJson } from '../../../lib/http.js';
import { createInvitation } from '../../../lib/invite.js';

// POST /api/admin/invite { householdId, email } – send (ny) eierinvitasjon
export async function onRequestPost({ request, env, data }) {
  const { householdId, email } = await readJson(request);
  const e = String(email || '').trim().toLowerCase();
  const h = await env.DB.prepare('SELECT id, name FROM households WHERE id = ?').bind(householdId).first();
  if (!h) return bad('Fant ikke husholdningen', 404);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return bad('Ugyldig e-postadresse');
  const devLink = await createInvitation(env, {
    request, householdId: h.id, householdName: h.name, email: e, role: 'eier',
    invitedBy: data.user.id, inviterName: data.user.name,
  });
  return json({ ok: true, devLink });
}
