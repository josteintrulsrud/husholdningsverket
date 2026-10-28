import { json, bad, readJson } from '../../../../lib/http.js';
import { uuid } from '../../../../lib/crypto.js';
import { matchRule } from '../../../../lib/rules.js';
import { closestMatch } from '../../../../lib/receipts.js';

// POST { rows: [{ date, amountOre, text }] } – rader fra CSV, ferdig tolket i nettleseren.
// Dubletter hoppes over, og kortkjøp kobles til kvitteringer som venter.
export async function onRequestPost({ request, env, data }) {
  const { rows } = await readJson(request);
  if (!Array.isArray(rows) || !rows.length) return bad('Ingen rader å importere');
  if (rows.length > 3000) return bad('Maks 3000 rader per import');

  const hid = data.hid;
  const rules = (await env.DB.prepare('SELECT match_text, category_id FROM category_rules WHERE household_id = ?').bind(hid).all()).results;
  const pending = (await env.DB.prepare('SELECT id, date, amount_ore FROM transactions WHERE household_id = ? AND receipt_pending = 1').bind(hid).all()).results;
  // Rader som allerede er importert, skal ikke kobles til en kvittering på nytt
  const dates = rows.map((r) => String(r.date || '')).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const existing = new Set(dates.length ? (await env.DB.prepare('SELECT dedupe_hash FROM transactions WHERE household_id = ? AND date BETWEEN ? AND ?')
    .bind(hid, dates[0], dates[dates.length - 1]).all()).results.map((x) => x.dedupe_hash) : []);
  const used = new Set();
  const seen = {};
  const stmts = [];
  let merged = 0, invalid = 0;

  for (const r of rows) {
    const date = String(r.date || '');
    const text = String(r.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const amount = Math.round(Number(r.amountOre));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text || !amount) { invalid++; continue; }

    const base = `${date}|${amount}|${text.toUpperCase()}`;
    seen[base] = (seen[base] || 0) + 1;
    const hash = `${base}#${seen[base]}`;

    if (existing.has(hash)) continue;

    // Kvittering skannet tidligere? Samme beløp, nærmeste dato innenfor fem dager.
    const rc = closestMatch(pending, date, amount, used);
    if (rc) {
      used.add(rc.id); merged++;
      stmts.push(env.DB.prepare('UPDATE OR IGNORE transactions SET dedupe_hash = ?, bank_text = ?, receipt_pending = 0 WHERE id = ?').bind(hash, text, rc.id));
      continue;
    }
    const cat = matchRule(rules, text);
    stmts.push(env.DB.prepare(
      `INSERT OR IGNORE INTO transactions (id, household_id, user_id, date, amount_ore, description, category_id, categorized_by, dedupe_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(uuid(), hid, data.user.id, date, amount, text, cat, cat ? 'regel' : null, hash));
  }

  let inserted = 0;
  for (let i = 0; i < stmts.length; i += 50) {
    const res = await env.DB.batch(stmts.slice(i, i + 50));
    for (const x of res) inserted += x.meta?.changes || 0;
  }
  inserted -= merged;
  const duplicates = rows.length - invalid - merged - inserted;
  return json({ ok: true, inserted, duplicates: Math.max(0, duplicates), merged, invalid });
}
