import { json } from '../../../../lib/http.js';

// GET – alt som trengs for å tegne appen: kategorier, regler, sparemål og medlemmer
export async function onRequestGet({ env, data }) {
  const hid = data.hid;
  const [h, categories, rules, goals, members, invites] = await env.DB.batch([
    env.DB.prepare('SELECT id, name FROM households WHERE id = ?').bind(hid),
    env.DB.prepare('SELECT id, name, kind, budget_ore FROM categories WHERE household_id = ? ORDER BY sort, name').bind(hid),
    env.DB.prepare('SELECT id, match_text, category_id FROM category_rules WHERE household_id = ? ORDER BY match_text').bind(hid),
    env.DB.prepare('SELECT id, name, target_ore, saved_ore FROM savings_goals WHERE household_id = ? ORDER BY created_at').bind(hid),
    env.DB.prepare(`SELECT u.id, u.name, u.email, m.role FROM household_members m JOIN users u ON u.id = m.user_id
                     WHERE m.household_id = ? ORDER BY m.joined_at`).bind(hid),
    env.DB.prepare(`SELECT email, role, expires_at FROM invitations
                     WHERE household_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')`).bind(hid),
  ]);
  return json({
    household: h.results[0], role: data.role,
    categories: categories.results, rules: rules.results, goals: goals.results,
    members: members.results, invites: data.role === 'eier' ? invites.results : [],
  });
}
