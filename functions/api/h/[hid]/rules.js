import { json, bad, readJson } from '../../../../lib/http.js';
import { uuid } from '../../../../lib/crypto.js';
import { applyRules } from '../../../../lib/rules.js';

// POST { matchText, categoryId } – ny regel (eller oppdater eksisterende med samme tekst), og bruk den
export async function onRequestPost({ request, env, data }) {
  const { matchText, categoryId } = await readJson(request);
  const m = String(matchText || '').trim().toUpperCase().slice(0, 40);
  if (!m) return bad('Skriv inn tekst regelen skal se etter');
  const cat = await env.DB.prepare('SELECT id FROM categories WHERE id = ? AND household_id = ?').bind(categoryId, data.hid).first();
  if (!cat) return bad('Ukjent kategori');
  const ex = await env.DB.prepare('SELECT id FROM category_rules WHERE household_id = ? AND upper(match_text) = ?').bind(data.hid, m).first();
  if (ex) await env.DB.prepare('UPDATE category_rules SET category_id = ? WHERE id = ?').bind(cat.id, ex.id).run();
  else await env.DB.prepare('INSERT INTO category_rules (id, household_id, match_text, category_id) VALUES (?, ?, ?, ?)').bind(uuid(), data.hid, m, cat.id).run();
  const applied = await applyRules(env, data.hid);
  return json({ ok: true, applied });
}

// PUT – bruk alle regler på transaksjoner uten kategori
export async function onRequestPut({ env, data }) {
  return json({ ok: true, applied: await applyRules(env, data.hid) });
}

// DELETE ?id=
export async function onRequestDelete({ request, env, data }) {
  const id = new URL(request.url).searchParams.get('id');
  await env.DB.prepare('DELETE FROM category_rules WHERE id = ? AND household_id = ?').bind(id, data.hid).run();
  return json({ ok: true });
}
