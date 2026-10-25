import { json, bad, readJson } from '../../../../lib/http.js';
import { uuid } from '../../../../lib/crypto.js';

export async function onRequestPost({ request, env, data }) {
  const { name, targetOre } = await readJson(request);
  const n = String(name || '').trim().slice(0, 60);
  const t = Math.round(Number(targetOre) || 0);
  if (!n || t <= 0) return bad('Gi målet et navn og et beløp');
  const id = uuid();
  await env.DB.prepare('INSERT INTO savings_goals (id, household_id, name, target_ore) VALUES (?, ?, ?, ?)').bind(id, data.hid, n, t).run();
  return json({ ok: true, id });
}

export async function onRequestPatch({ request, env, data }) {
  const { id, savedOre } = await readJson(request);
  await env.DB.prepare('UPDATE savings_goals SET saved_ore = ? WHERE id = ? AND household_id = ?')
    .bind(Math.max(0, Math.round(Number(savedOre) || 0)), id, data.hid).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, data }) {
  const id = new URL(request.url).searchParams.get('id');
  await env.DB.prepare('DELETE FROM savings_goals WHERE id = ? AND household_id = ?').bind(id, data.hid).run();
  return json({ ok: true });
}
