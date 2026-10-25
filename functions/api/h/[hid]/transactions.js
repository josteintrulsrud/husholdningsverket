import { json, bad, readJson } from '../../../../lib/http.js';
import { uuid } from '../../../../lib/crypto.js';
import { merchantKey, applyRules } from '../../../../lib/rules.js';

const ym = (s) => /^\d{4}-\d{2}$/.test(s || '');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

// GET ?from=YYYY-MM&to=YYYY-MM – transaksjoner i perioden (hele husholdningen)
export async function onRequestGet({ request, env, data }) {
  const p = new URL(request.url).searchParams;
  const from = p.get('from'), to = p.get('to') || from;
  if (!ym(from) || !ym(to)) return bad('Ugyldig periode');
  const rows = (await env.DB.prepare(
    `SELECT id, user_id, date, amount_ore, description, category_id, categorized_by, receipt_json, receipt_pending
       FROM transactions WHERE household_id = ? AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC`
  ).bind(data.hid, from + '-01', to + '-31').all()).results;
  return json({ transactions: rows });
}

// POST { date, amountOre, text, categoryId?, receipt?, receiptPending? } – manuell transaksjon eller kvittering
export async function onRequestPost({ request, env, data }) {
  const b = await readJson(request);
  const text = String(b.text || '').trim().slice(0, 200);
  const amount = Math.round(Number(b.amountOre));
  if (!isDate(b.date) || !text || !amount) return bad('Dato, beskrivelse og beløp må fylles ut');
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO transactions (id, household_id, user_id, date, amount_ore, description, category_id, categorized_by, receipt_json, receipt_pending, dedupe_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, data.hid, data.user.id, b.date, amount, text, b.categoryId || null, b.categoryId ? 'manuell' : null,
         b.receipt ? JSON.stringify(b.receipt).slice(0, 20000) : null, b.receiptPending ? 1 : 0, 'manuell|' + id).run();
  return json({ ok: true, id });
}

// PATCH { id, categoryId, by?, createRule?, receipt? }
export async function onRequestPatch({ request, env, data }) {
  const b = await readJson(request);
  const t = await env.DB.prepare('SELECT id, description FROM transactions WHERE id = ? AND household_id = ?').bind(b.id, data.hid).first();
  if (!t) return bad('Fant ikke transaksjonen', 404);
  let catId = b.categoryId || null;
  if (catId) {
    const c = await env.DB.prepare('SELECT id FROM categories WHERE id = ? AND household_id = ?').bind(catId, data.hid).first();
    if (!c) return bad('Ukjent kategori');
  }
  const by = catId ? (b.by === 'ai' ? 'ai' : 'manuell') : null;
  await env.DB.prepare('UPDATE transactions SET category_id = ?, categorized_by = ? WHERE id = ?').bind(catId, by, t.id).run();
  if (b.receipt) {
    await env.DB.prepare('UPDATE transactions SET receipt_json = ? WHERE id = ?').bind(JSON.stringify(b.receipt).slice(0, 20000), t.id).run();
  }

  let rule = null, applied = 0;
  if (catId && b.createRule) {
    const key = merchantKey(t.description);
    if (key.length >= 2) {
      const ex = await env.DB.prepare('SELECT id FROM category_rules WHERE household_id = ? AND upper(match_text) = ?').bind(data.hid, key).first();
      if (ex) await env.DB.prepare('UPDATE category_rules SET category_id = ? WHERE id = ?').bind(catId, ex.id).run();
      else await env.DB.prepare('INSERT INTO category_rules (id, household_id, match_text, category_id) VALUES (?, ?, ?, ?)').bind(uuid(), data.hid, key, catId).run();
      rule = key;
      applied = await applyRules(env, data.hid);
    }
  }
  return json({ ok: true, rule, applied });
}

// DELETE ?id=
export async function onRequestDelete({ request, env, data }) {
  const id = new URL(request.url).searchParams.get('id');
  await env.DB.prepare('DELETE FROM transactions WHERE id = ? AND household_id = ?').bind(id, data.hid).run();
  return json({ ok: true });
}
