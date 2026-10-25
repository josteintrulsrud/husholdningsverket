import { json, bad, readJson } from '../../../../lib/http.js';
import { uuid } from '../../../../lib/crypto.js';

const LISTS = ['mat', 'hjem'];

// GET – begge listene. Kjøpte varer eldre enn 60 dager tas ikke med.
export async function onRequestGet({ env, data }) {
  const items = (await env.DB.prepare(
    `SELECT id, list, text, done, added_by, added_at, done_by, done_at FROM shopping_items
      WHERE household_id = ? AND (done = 0 OR done_at > datetime('now', '-60 days'))`
  ).bind(data.hid).all()).results;
  return json({ items });
}

// POST { list, text } – legg til (eller sett tilbake en kjøpt vare med samme navn)
export async function onRequestPost({ request, env, data }) {
  const { list, text } = await readJson(request);
  const t = String(text || '').trim().slice(0, 100);
  if (!LISTS.includes(list) || !t) return bad('Skriv inn en vare');
  const ex = await env.DB.prepare('SELECT id, done FROM shopping_items WHERE household_id = ? AND list = ? AND lower(text) = lower(?)').bind(data.hid, list, t).first();
  if (ex && !ex.done) return json({ ok: true, exists: true, id: ex.id });
  if (ex) {
    await env.DB.prepare(`UPDATE shopping_items SET done = 0, done_by = NULL, done_at = NULL, added_by = ?, added_at = datetime('now') WHERE id = ?`).bind(data.user.id, ex.id).run();
    return json({ ok: true, id: ex.id });
  }
  const id = uuid();
  await env.DB.prepare('INSERT INTO shopping_items (id, household_id, list, text, added_by) VALUES (?, ?, ?, ?, ?)').bind(id, data.hid, list, t, data.user.id).run();
  return json({ ok: true, id });
}

// PATCH { id, done } eller { ids: [...], done }
export async function onRequestPatch({ request, env, data }) {
  const b = await readJson(request);
  const ids = Array.isArray(b.ids) ? b.ids.slice(0, 100) : [b.id];
  const stmts = ids.map((id) => b.done
    ? env.DB.prepare(`UPDATE shopping_items SET done = 1, done_by = ?, done_at = datetime('now') WHERE id = ? AND household_id = ?`).bind(data.user.id, id, data.hid)
    : env.DB.prepare(`UPDATE shopping_items SET done = 0, done_by = NULL, done_at = NULL, added_at = datetime('now') WHERE id = ? AND household_id = ?`).bind(id, data.hid));
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true });
}

// DELETE ?id=  eller  ?list=mat&done=1 (tøm kjøpte)
export async function onRequestDelete({ request, env, data }) {
  const p = new URL(request.url).searchParams;
  if (p.get('list') && p.get('done') === '1') {
    await env.DB.prepare('DELETE FROM shopping_items WHERE household_id = ? AND list = ? AND done = 1').bind(data.hid, p.get('list')).run();
  } else {
    await env.DB.prepare('DELETE FROM shopping_items WHERE id = ? AND household_id = ?').bind(p.get('id'), data.hid).run();
  }
  return json({ ok: true });
}
