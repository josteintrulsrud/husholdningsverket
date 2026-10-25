import { json, bad, readJson } from '../../../../lib/http.js';
import { createInvitation } from '../../../../lib/invite.js';
import { audit } from '../../../../lib/audit.js';

// POST { email, role } – eier inviterer et nytt medlem
export async function onRequestPost({ request, env, data }) {
  if (data.role !== 'eier') return bad('Bare eiere kan invitere', 403);
  const { email, role } = await readJson(request);
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return bad('Ugyldig e-postadresse');
  const r = role === 'eier' ? 'eier' : 'medlem';
  const already = await env.DB.prepare(
    'SELECT 1 FROM household_members m JOIN users u ON u.id = m.user_id WHERE m.household_id = ? AND u.email = ?'
  ).bind(data.hid, e).first();
  if (already) return bad('Personen er allerede med');
  const h = await env.DB.prepare('SELECT name FROM households WHERE id = ?').bind(data.hid).first();
  const devLink = await createInvitation(env, {
    request, householdId: data.hid, householdName: h.name, email: e, role: r,
    invitedBy: data.user.id, inviterName: data.user.name,
  });
  await audit(env, data.hid, data.user.id, 'invitasjon_sendt');
  return json({ ok: true, devLink });
}

// DELETE ?userId= – eier fjerner et medlem (ikke seg selv)
export async function onRequestDelete({ request, env, data }) {
  if (data.role !== 'eier') return bad('Bare eiere kan fjerne medlemmer', 403);
  const uid = new URL(request.url).searchParams.get('userId');
  if (uid === data.user.id) return bad('Du kan ikke fjerne deg selv');
  await env.DB.prepare('DELETE FROM household_members WHERE household_id = ? AND user_id = ?').bind(data.hid, uid).run();
  await audit(env, data.hid, data.user.id, 'medlem_fjernet');
  return json({ ok: true });
}
