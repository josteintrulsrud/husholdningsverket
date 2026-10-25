import { uuid } from './crypto.js';
export async function audit(env, householdId, userId, action) {
  try {
    await env.DB.prepare('INSERT INTO audit_log (id, household_id, user_id, action) VALUES (?, ?, ?, ?)')
      .bind(uuid(), householdId, userId, action).run();
  } catch (e) { console.error('audit', e); }
}
