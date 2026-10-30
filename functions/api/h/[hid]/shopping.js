import { json, bad, readJson } from '../../../../lib/http.js';
import { uuid } from '../../../../lib/crypto.js';
import { parseInput, lastPrice } from '../../../../lib/handleliste.js';
import { SECTIONS, sectionByWords, sectionsByClaude } from '../../../../lib/avdeling.js';

const LISTS = ['mat', 'hjem'];
// Små bokstaver i JavaScript, siden SQLite sin lower() ikke kjenner æ, ø og å
const keyOf = (t) => String(t).trim().toLowerCase();

// GET – begge listene, og hurtigforslag (det som er lagt til minst to ganger). Kjøpte varer eldre enn 60 dager tas ikke med.
export async function onRequestGet({ env, data }) {
  const items = (await env.DB.prepare(
    `SELECT id, list, text, qty, note, section, last_price_ore, last_price_store, place, price_ore, assigned_to,
            done, added_by, added_at, done_by, done_at FROM shopping_items
      WHERE household_id = ? AND (done = 0 OR done_at > datetime('now', '-60 days'))`
  ).bind(data.hid).all()).results;
  // Varer lagt til før avdelinger fantes, får avdeling fra ordlisten
  for (const x of items) if (x.list === 'mat' && !x.section) x.section = sectionByWords(x.text);
  const suggestions = (await env.DB.prepare(
    'SELECT list, text FROM shopping_history WHERE household_id = ? AND uses >= 2 ORDER BY uses DESC, last_used DESC LIMIT 60'
  ).bind(data.hid).all()).results;
  return json({ items, suggestions, sections: SECTIONS });
}

// POST { list, text } – én eller flere varer («melk, 2 brød»). En kjøpt vare med samme navn settes tilbake på listen.
export async function onRequestPost({ request, env, data, waitUntil }) {
  const { list, text } = await readJson(request);
  const wanted = LISTS.includes(list) ? parseInput(text, list) : [];
  if (!wanted.length) return bad('Skriv inn en vare');

  const items = (await env.DB.prepare('SELECT id, text, done FROM shopping_items WHERE household_id = ? AND list = ?').bind(data.hid, list).all()).results;
  const history = new Map((await env.DB.prepare('SELECT key, section FROM shopping_history WHERE household_id = ? AND list = ?').bind(data.hid, list).all()).results
    .map((h) => [h.key, h.section]));
  const existing = [], unknown = new Set(), seen = new Set();
  let added = 0;
  // Matvarer får med seg sist betalte pris fra kvitteringene
  const receipts = list === 'mat' ? (await env.DB.prepare(
    'SELECT receipt_json FROM transactions WHERE household_id = ? AND receipt_json IS NOT NULL ORDER BY date DESC LIMIT 200'
  ).bind(data.hid).all()).results.map((r) => { try { return JSON.parse(r.receipt_json); } catch { return {}; } }) : [];

  for (const w of wanted) {
    const key = keyOf(w.text);
    const section = list === 'mat' ? (history.get(key) || sectionByWords(w.text)) : null;
    if (list === 'mat' && !section) unknown.add(w.text);
    const price = list === 'mat' ? lastPrice(receipts, w.text) : null;
    const ex = items.find((x) => keyOf(x.text) === key);
    if (ex && !ex.done) {
      if (w.qty || w.note) {
        await env.DB.prepare('UPDATE shopping_items SET qty = COALESCE(?, qty), note = COALESCE(?, note) WHERE id = ?').bind(w.qty, w.note, ex.id).run();
      } else existing.push(ex.text);
      continue;
    }
    if (ex) {
      await env.DB.prepare(`UPDATE shopping_items SET done = 0, done_by = NULL, done_at = NULL, qty = ?, note = ?, section = COALESCE(section, ?),
          last_price_ore = ?, last_price_store = ?, added_by = ?, added_at = datetime('now') WHERE id = ?`)
        .bind(w.qty, w.note, section, price?.ore ?? null, price?.store ?? null, data.user.id, ex.id).run();
      ex.done = 0;
    } else {
      const id = uuid();
      await env.DB.prepare(`INSERT INTO shopping_items (id, household_id, list, text, qty, note, section, last_price_ore, last_price_store, added_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, data.hid, list, w.text, w.qty, w.note, section, price?.ore ?? null, price?.store ?? null, data.user.id).run();
      items.push({ id, text: w.text, done: 0 });
    }
    added++;
    if (seen.has(key)) continue;
    seen.add(key);
    await env.DB.prepare(
      `INSERT INTO shopping_history (household_id, list, key, text, section) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (household_id, list, key) DO UPDATE SET uses = uses + 1, last_used = datetime('now'), text = excluded.text,
         section = COALESCE(shopping_history.section, excluded.section)`
    ).bind(data.hid, list, key, w.text, section).run();
  }

  // Varer ordlisten ikke kjente: Claude plasserer dem i bakgrunnen, og neste oppdatering av listen viser avdelingen
  if (unknown.size && waitUntil) waitUntil(placeUnknown(env, data.hid, [...unknown]).catch((e) => console.error(e)));
  return json({ ok: true, added, existing });
}

async function placeUnknown(env, hid, texts) {
  const found = await sectionsByClaude(env, texts);
  const stmts = [];
  const open = (await env.DB.prepare("SELECT id, text FROM shopping_items WHERE household_id = ? AND list = 'mat' AND section IS NULL").bind(hid).all()).results;
  for (const [text, section] of Object.entries(found)) {
    const key = keyOf(text);
    for (const x of open) if (keyOf(x.text) === key) stmts.push(env.DB.prepare('UPDATE shopping_items SET section = ? WHERE id = ?').bind(section, x.id));
    stmts.push(env.DB.prepare("UPDATE shopping_history SET section = ? WHERE household_id = ? AND list = 'mat' AND key = ?").bind(section, hid, key));
  }
  if (stmts.length) await env.DB.batch(stmts);
}

// PATCH { id, done } eller { ids: [...], done } – kjøpt/ikke kjøpt
// PATCH { id, edit: { qty, note, place, priceOre, assignedTo } } – detaljer på én vare
export async function onRequestPatch({ request, env, data }) {
  const b = await readJson(request);
  if (b.edit) {
    const e = b.edit, str = (v, n) => (String(v ?? '').trim().slice(0, n) || null);
    let place = str(e.place, 300);
    if (place && /^[a-z][a-z0-9+.-]*:/i.test(place) && !/^https?:\/\//i.test(place)) place = null; // bare vanlige nettlenker
    const price = e.priceOre == null || e.priceOre === '' ? null : Math.max(0, Math.round(Number(e.priceOre)) || 0);
    let who = e.assignedTo || null;
    if (who && !(await env.DB.prepare('SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?').bind(data.hid, who).first())) who = null;
    await env.DB.prepare('UPDATE shopping_items SET qty = ?, note = ?, place = ?, price_ore = ?, assigned_to = ? WHERE id = ? AND household_id = ?')
      .bind(str(e.qty, 30), str(e.note, 100), place, price, who, b.id, data.hid).run();
    return json({ ok: true });
  }
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
