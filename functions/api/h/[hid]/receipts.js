import { json, bad, readJson } from '../../../../lib/http.js';
import { uuid } from '../../../../lib/crypto.js';
import { closestMatch, imageKey, MATCH_DAYS } from '../../../../lib/receipts.js';

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const shift = (date, days) => new Date(Date.parse(date) + days * 864e5).toISOString().slice(0, 10);

// GET – mine kvitteringer (de jeg har skannet). GET ?img=<id> – bildet til én kvittering.
export async function onRequestGet({ request, env, data }) {
  const img = new URL(request.url).searchParams.get('img');
  if (img) {
    const t = await env.DB.prepare('SELECT receipt_image FROM transactions WHERE id = ? AND household_id = ?').bind(img, data.hid).first();
    const obj = t?.receipt_image && env.RECEIPTS ? await env.RECEIPTS.get(t.receipt_image) : null;
    if (!obj) return bad('Fant ikke bildet', 404);
    return new Response(obj.body, {
      headers: { 'content-type': obj.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'private, max-age=86400' },
    });
  }
  const rows = (await env.DB.prepare(
    `SELECT id, user_id, date, amount_ore, description, bank_text, category_id, receipt_json, receipt_pending, receipt_image
     FROM transactions WHERE household_id = ? AND receipt_user_id = ? AND receipt_json IS NOT NULL ORDER BY date DESC, created_at DESC`
  ).bind(data.hid, data.user.id).all()).results;
  return json({ receipts: rows });
}

// POST { store, date, totalOre, categoryId?, items?, image?, mediaType? }
// Kobles til et kortkjøp som allerede er importert, ellers lagres den som egen utgift
// som venter på kontoutskriften (se import.js).
export async function onRequestPost({ request, env, data }) {
  const b = await readJson(request);
  const store = String(b.store || '').trim().slice(0, 200);
  const total = Math.round(Number(b.totalOre));
  if (!store || !isDate(b.date) || !(total > 0)) return bad('Fyll inn butikk, dato og sum');
  if (b.image && b.image.length > 6_000_000) return bad('Bildet er for stort');
  const amount = -total;
  let catId = b.categoryId || null;
  if (catId && !(await env.DB.prepare('SELECT id FROM categories WHERE id = ? AND household_id = ?').bind(catId, data.hid).first())) catId = null;
  const receipt = JSON.stringify({ store, items: Array.isArray(b.items) ? b.items.slice(0, 80) : [] }).slice(0, 20000);

  const near = (await env.DB.prepare(
    `SELECT id, date, amount_ore, receipt_json FROM transactions
     WHERE household_id = ? AND amount_ore = ? AND date BETWEEN ? AND ?`
  ).bind(data.hid, amount, shift(b.date, -MATCH_DAYS), shift(b.date, MATCH_DAYS)).all()).results;

  // Samme kvittering skannet to ganger? Samme butikk og beløp, og samme dato eller samme varer.
  const items = JSON.parse(receipt).items;
  const twice = near.find((t) => {
    if (!t.receipt_json) return false;
    try {
      const r = JSON.parse(t.receipt_json);
      return String(r.store).toUpperCase() === store.toUpperCase()
        && (t.date === b.date || (items.length > 0 && JSON.stringify(r.items) === JSON.stringify(items)));
    } catch { return false; }
  });
  if (twice) return bad('Denne kvitteringen er allerede lagret', 409);

  const bank = closestMatch(near.filter((t) => !t.receipt_json), b.date, amount);
  let id;
  if (bank) {
    id = bank.id;
    await env.DB.prepare('UPDATE transactions SET receipt_json = ?, receipt_user_id = ? WHERE id = ?').bind(receipt, data.user.id, id).run();
    if (catId) await env.DB.prepare("UPDATE transactions SET category_id = ?, categorized_by = 'manuell' WHERE id = ?").bind(catId, id).run();
  } else {
    id = uuid();
    await env.DB.prepare(
      `INSERT INTO transactions (id, household_id, user_id, date, amount_ore, description, category_id, categorized_by, receipt_json, receipt_pending, receipt_user_id, dedupe_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(id, data.hid, data.user.id, b.date, amount, store, catId, catId ? 'manuell' : null, receipt, data.user.id, 'kvittering|' + id).run();
  }

  let imageSaved = false;
  if (b.image && env.RECEIPTS) {
    const media = /^image\/(jpeg|png|webp)$/.test(b.mediaType) ? b.mediaType : 'image/jpeg';
    const bytes = Uint8Array.from(atob(b.image), (c) => c.charCodeAt(0));
    const key = imageKey(data.hid, id);
    await env.RECEIPTS.put(key, bytes, { httpMetadata: { contentType: media } });
    await env.DB.prepare('UPDATE transactions SET receipt_image = ? WHERE id = ?').bind(key, id).run();
    imageSaved = true;
  }
  return json({ ok: true, id, matched: !!bank, imageSaved });
}

// DELETE ?id= – fjerner kvitteringen. Venter den fortsatt på banken, slettes hele utgiften;
// er den koblet til et kortkjøp, beholdes kortkjøpet.
export async function onRequestDelete({ request, env, data }) {
  const id = new URL(request.url).searchParams.get('id');
  const t = await env.DB.prepare('SELECT id, receipt_pending, receipt_image FROM transactions WHERE id = ? AND household_id = ? AND receipt_user_id = ?')
    .bind(id, data.hid, data.user.id).first();
  if (!t) return bad('Fant ikke kvitteringen', 404);
  if (t.receipt_image && env.RECEIPTS) await env.RECEIPTS.delete(t.receipt_image);
  if (t.receipt_pending) await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(t.id).run();
  else await env.DB.prepare('UPDATE transactions SET receipt_json = NULL, receipt_image = NULL, receipt_user_id = NULL WHERE id = ?').bind(t.id).run();
  return json({ ok: true });
}
