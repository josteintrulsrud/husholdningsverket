import { bad } from '../../../../lib/http.js';

// Alt under /api/h/:hid krever at du er medlem av husholdningen
export async function onRequest(ctx) {
  const hid = ctx.params.hid;
  const row = await ctx.env.DB.prepare('SELECT role FROM household_members WHERE household_id = ? AND user_id = ?')
    .bind(hid, ctx.data.user.id).first();
  if (!row) return bad('Fant ikke husholdningen', 404);
  ctx.data.hid = hid;
  ctx.data.role = row.role;
  return ctx.next();
}
