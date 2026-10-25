import { sha256, randomToken } from './crypto.js';

const COOKIE = 'hv_session';
const DAYS = 30;

export function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export async function currentUser(request, env) {
  const raw = readCookie(request, COOKIE);
  if (!raw) return null;
  const id = await sha256(raw);
  return (await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.is_superadmin
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > datetime('now')`
  ).bind(id).first()) || null;
}

export async function createSessionCookie(env, userId) {
  const raw = randomToken();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+${DAYS} days'))`
  ).bind(await sha256(raw), userId).run();
  return `${COOKIE}=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * DAYS}`;
}

export async function clearSessionCookie(request, env) {
  const raw = readCookie(request, COOKIE);
  if (raw) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(raw)).run();
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
