import { currentUser } from '../../lib/session.js';
import { bad } from '../../lib/http.js';

// Alle /api-kall: krever innlogging (unntatt /api/auth/*) og en egen header på endringer (CSRF-vern).
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  if (url.pathname.startsWith('/api/auth/')) return ctx.next();

  const method = ctx.request.method;
  if (method !== 'GET' && method !== 'HEAD' && ctx.request.headers.get('x-hv') !== '1') {
    return bad('Ugyldig forespørsel', 403);
  }
  const user = await currentUser(ctx.request, ctx.env);
  if (!user) return bad('Ikke innlogget', 401);
  ctx.data.user = user;
  try {
    return await ctx.next();
  } catch (e) {
    console.error(e);
    return bad('Noe gikk galt på serveren', 500);
  }
}
