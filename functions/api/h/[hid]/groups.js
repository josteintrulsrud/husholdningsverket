import { json, bad, readJson } from '../../../../lib/http.js';
import { uuid } from '../../../../lib/crypto.js';
import { ruleKey, isGenericKey, applyRules } from '../../../../lib/rules.js';

// Kategoriser er personlig: hver ser og kategoriserer bare sine egne transaksjoner.
// Reglene som lages er felles, så de treffer også de andres transaksjoner fra samme butikk.
async function uncategorized(env, hid, userId) {
  return (await env.DB.prepare(
    'SELECT id, date, amount_ore, description FROM transactions WHERE household_id = ? AND user_id = ? AND category_id IS NULL ORDER BY date'
  ).bind(hid, userId).all()).results;
}

// GET – egne transaksjoner uten kategori (hele historikken), gruppert per butikk
export async function onRequestGet({ env, data }) {
  const rows = await uncategorized(env, data.hid, data.user.id);
  const groups = new Map();
  for (const t of rows) {
    const key = ruleKey(t.description);
    let g = groups.get(key);
    if (!g) { g = { key, count: 0, sumOre: 0, samples: [], first: t.date, last: t.date, generic: isGenericKey(key) }; groups.set(key, g); }
    g.count++; g.sumOre += t.amount_ore; g.last = t.date;
    if (g.samples.length < 3 && !g.samples.includes(t.description)) g.samples.push(t.description);
  }
  const list = [...groups.values()].sort((a, b) => b.count - a.count || Math.abs(b.sumOre) - Math.abs(a.sumOre));
  return json({ total: rows.length, groups: list });
}

// POST { groups: [{ key, categoryId }] } – kategoriserer alle transaksjoner i hver gruppe
// og lager en regel per gruppe (unntatt for generelle nøkler som «VIPPS»).
export async function onRequestPost({ request, env, data }) {
  const b = await readJson(request);
  const wanted = Array.isArray(b.groups) ? b.groups.slice(0, 200) : [];
  if (!wanted.length) return bad('Ingen grupper valgt');

  const cats = new Set((await env.DB.prepare('SELECT id FROM categories WHERE household_id = ?').bind(data.hid).all()).results.map((c) => c.id));
  const choice = new Map();
  for (const g of wanted) if (g && typeof g.key === 'string' && cats.has(g.categoryId)) choice.set(g.key, g.categoryId);
  if (!choice.size) return bad('Ukjent kategori');

  const rules = (await env.DB.prepare('SELECT id, match_text FROM category_rules WHERE household_id = ?').bind(data.hid).all()).results;
  const ruleByText = new Map(rules.map((r) => [r.match_text.toUpperCase(), r.id]));

  const stmts = [];
  let updated = 0, rulesMade = 0;
  for (const t of await uncategorized(env, data.hid, data.user.id)) {
    const cat = choice.get(ruleKey(t.description));
    if (!cat) continue;
    updated++;
    stmts.push(env.DB.prepare("UPDATE transactions SET category_id = ?, categorized_by = ? WHERE id = ? AND household_id = ?")
      .bind(cat, b.by === 'ai' ? 'ai' : 'manuell', t.id, data.hid));
  }
  for (const [key, cat] of choice) {
    if (isGenericKey(key) || key.length < 2) continue;
    const existing = ruleByText.get(key);
    stmts.push(existing
      ? env.DB.prepare('UPDATE category_rules SET category_id = ? WHERE id = ?').bind(cat, existing)
      : env.DB.prepare('INSERT INTO category_rules (id, household_id, match_text, category_id) VALUES (?, ?, ?, ?)').bind(uuid(), data.hid, key, cat));
    rulesMade++;
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  const applied = await applyRules(env, data.hid);
  return json({ ok: true, updated: updated + applied, rules: rulesMade });
}
