import { json, bad, readJson } from '../../../../lib/http.js';
import { uuid } from '../../../../lib/crypto.js';

const KINDS = ['utgift', 'inntekt', 'sparing', 'overføring'];

// POST { name, kind } – ny kategori
export async function onRequestPost({ request, env, data }) {
  const { name, kind } = await readJson(request);
  const n = String(name || '').trim().slice(0, 60);
  if (!n || !KINDS.includes(kind)) return bad('Navn og type må fylles ut');
  const id = uuid();
  await env.DB.prepare('INSERT INTO categories (id, household_id, name, kind, sort) VALUES (?, ?, ?, ?, 100)')
    .bind(id, data.hid, n, kind).run();
  return json({ ok: true, id });
}

// PATCH { id, budgetOre?, name? } – endre budsjett eller navn
export async function onRequestPatch({ request, env, data }) {
  const { id, budgetOre, name } = await readJson(request);
  if (budgetOre !== undefined) {
    const v = Math.max(0, Math.round(Number(budgetOre) || 0));
    await env.DB.prepare('UPDATE categories SET budget_ore = ? WHERE id = ? AND household_id = ?').bind(v, id, data.hid).run();
  }
  if (name !== undefined && String(name).trim()) {
    await env.DB.prepare('UPDATE categories SET name = ? WHERE id = ? AND household_id = ?').bind(String(name).trim().slice(0, 60), id, data.hid).run();
  }
  return json({ ok: true });
}
