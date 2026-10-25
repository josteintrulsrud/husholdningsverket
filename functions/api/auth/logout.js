import { json } from '../../../lib/http.js';
import { clearSessionCookie } from '../../../lib/session.js';

export async function onRequestPost({ request, env }) {
  if (request.headers.get('x-hv') !== '1') return json({ error: 'Ugyldig forespørsel' }, 403);
  const cookie = await clearSessionCookie(request, env);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}
