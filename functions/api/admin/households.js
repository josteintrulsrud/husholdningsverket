import { json, bad, readJson } from '../../../lib/http.js';
import { uuid } from '../../../lib/crypto.js';
import { seedHousehold } from '../../../lib/defaults.js';
import { createInvitation } from '../../../lib/invite.js';
import { audit } from '../../../lib/audit.js';

// GET /api/admin/households – navn, medlemmer og invitasjoner. Ingen transaksjoner, budsjetter eller saldoer.
export async function onRequestGet({ env }) {
  const households = (await env.DB.prepare(
    `SELECT h.id, h.name, h.created_at,
            (SELECT COUNT(*) FROM household_members m WHERE m.household_id = h.id) AS members,
            (SELECT GROUP_CONCAT(COALESCE(u.name, u.email), ', ') FROM household_members m JOIN users u ON u.id = m.user_id
              WHERE m.household_id = h.id AND m.role = 'eier') AS owners,
            (SELECT GROUP_CONCAT(i.email, ', ') FROM invitations i
              WHERE i.household_id = h.id AND i.accepted_at IS NULL AND i.expires_at > datetime('now')) AS pending
       FROM households h ORDER BY h.created_at`
  ).all()).results;
  return json({ households });
}

// POST /api/admin/households { name, ownerEmail } – oppretter husholdning med standardkategorier.
// Er eieren deg selv, blir du med direkte; ellers sendes en invitasjon.
export async function onRequestPost({ request, env, data }) {
  const { name, ownerEmail } = await readJson(request);
  const n = String(name || '').trim().slice(0, 80);
  const email = String(ownerEmail || '').trim().toLowerCase();
  if (!n) return bad('Gi husholdningen et navn');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad('Skriv inn eierens e-postadresse');

  const id = uuid();
  await env.DB.prepare('INSERT INTO households (id, name, created_by) VALUES (?, ?, ?)').bind(id, n, data.user.id).run();
  await seedHousehold(env, id);
  await audit(env, id, data.user.id, 'superadmin_opprettet_husholdning');

  let devLink = null;
  if (email === data.user.email.toLowerCase()) {
    await env.DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').bind(id, data.user.id, 'eier').run();
  } else {
    devLink = await createInvitation(env, {
      request, householdId: id, householdName: n, email, role: 'eier',
      invitedBy: data.user.id, inviterName: data.user.name,
    });
  }
  return json({ ok: true, id, devLink });
}
