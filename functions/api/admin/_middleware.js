import { bad } from '../../../lib/http.js';

// Kun superadmin. Superadmin ser husholdninger og medlemmer, aldri økonomidata.
export async function onRequest(ctx) {
  if (!ctx.data.user?.is_superadmin) return bad('Ingen tilgang', 403);
  return ctx.next();
}
