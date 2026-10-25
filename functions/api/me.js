import { json, bad, readJson } from '../../lib/http.js';

// GET /api/me – hvem er jeg, og hvilke husholdninger er jeg med i
export async function onRequestGet({ data, env }) {
  const u = data.user;
  const households = (await env.DB.prepare(
    `SELECT h.id, h.name, m.role FROM household_members m JOIN households h ON h.id = m.household_id
      WHERE m.user_id = ? ORDER BY h.created_at`
  ).bind(u.id).all()).results;
  return json({ user: { id: u.id, email: u.email, name: u.name, isSuperadmin: !!u.is_superadmin }, households });
}

// PATCH /api/me { name } – sett visningsnavn
export async function onRequestPatch({ request, data, env }) {
  const { name } = await readJson(request);
  const n = String(name || '').trim().slice(0, 60);
  if (!n) return bad('Skriv inn et navn');
  await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(n, data.user.id).run();
  return json({ ok: true });
}
