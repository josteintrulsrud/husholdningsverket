// Kategoriregler: lengste treffende tekst vinner.
export function matchRule(rules, text) {
  const T = ' ' + String(text).toUpperCase() + ' ';
  let best = null;
  for (const r of rules) {
    const m = String(r.match_text).toUpperCase();
    if (m && T.includes(m) && (!best || m.length > best.match_text.length)) best = r;
  }
  return best ? best.category_id : null;
}

// «VIPPS *Lommedalen IL 1234» -> «LOMMEDALEN IL»
export function merchantKey(text) {
  let t = String(text).toUpperCase()
    .replace(/^(VIPPS\*?|VIPPS|KORTKJØP|VAREKJØP|VISA|NETTGIRO|AVTALEGIRO|EFAKTURA|OVERFØRING)\s*\*?\s*/, '');
  t = t.replace(/\*/g, ' ').replace(/\b\d[\d.,/:-]*\b/g, ' ').replace(/\s+/g, ' ').trim();
  const words = t.split(' ').filter((w) => w.length > 1);
  return (words.slice(0, 2).join(' ') || t).slice(0, 30);
}

// Gir kategori til alle transaksjoner uten kategori som treffer en regel. Returnerer antall.
export async function applyRules(env, householdId) {
  const rules = (await env.DB.prepare('SELECT match_text, category_id FROM category_rules WHERE household_id = ?').bind(householdId).all()).results;
  if (!rules.length) return 0;
  const open = (await env.DB.prepare('SELECT id, description FROM transactions WHERE household_id = ? AND category_id IS NULL').bind(householdId).all()).results;
  const stmts = [];
  for (const t of open) {
    const c = matchRule(rules, t.description);
    if (c) stmts.push(env.DB.prepare("UPDATE transactions SET category_id = ?, categorized_by = 'regel' WHERE id = ? AND household_id = ?").bind(c, t.id, householdId));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return stmts.length;
}
