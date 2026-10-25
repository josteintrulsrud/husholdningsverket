// Små hjelpere for svar og forespørsler
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
export const bad = (message, status = 400) => json({ error: message }, status);
export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
export function html(markup, status = 200, headers = {}) {
  return new Response(markup, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
