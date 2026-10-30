import { S } from './state.js';

// Alle kall til serveren går gjennom her.
export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-hv': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch { /* tomt svar */ }
  if (!res.ok) throw new ApiError(data.error || `Feil ${res.status}`, res.status);
  return data;
}

// Kall innenfor valgt husholdning
export const hapi = (path, opts) => api(`/h/${S.hid}${path}`, opts);

// Serverens radformat -> appens format
export function mapTx(r) {
  let receipt = null;
  try { receipt = r.receipt_json ? JSON.parse(r.receipt_json) : null; } catch { receipt = null; }
  return {
    id: r.id, userId: r.user_id, date: r.date, amount: r.amount_ore, text: r.description,
    cat: r.category_id, by: r.categorized_by, receipt, receiptPending: !!r.receipt_pending,
  };
}
export function mapSettings(d) {
  return {
    household: d.household,
    categories: d.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, budget: c.budget_ore })),
    rules: d.rules,
    goals: d.goals.map((g) => ({ id: g.id, name: g.name, target: g.target_ore, saved: g.saved_ore })),
    members: d.members,
    invites: d.invites,
  };
}
export function mapItem(r) {
  return {
    id: r.id, list: r.list, text: r.text, qty: r.qty, section: r.section, done: !!r.done,
    by: r.added_by, at: r.added_at, doneBy: r.done_by, doneAt: r.done_at,
  };
}
