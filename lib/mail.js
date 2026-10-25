// E-post via Resend. Uten RESEND_API_KEY (lokalt) skrives e-posten til terminalen i stedet.
export async function sendMail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    console.log(`\n[E-post til ${to}] ${subject}\n${text}\n`);
    return { dev: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Husholdningsverket <noreply@mail.trulsrud.com>',
      to: [to], subject, html, text,
    }),
  });
  if (!res.ok) throw new Error(`Resend svarte ${res.status}: ${await res.text()}`);
  return { ok: true };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function linkMail({ subject, intro, url, button }) {
  const html = `<!doctype html><html lang="nb"><body style="margin:0;background:#0E1A2B;font-family:Arial,Helvetica,sans-serif;padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px"><tr><td style="padding:32px">
    <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#0E1A2B">Husholdnings<span style="color:#2E8FD8">verket</span></p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#0E1A2B">${esc(intro)}</p>
    <p style="margin:0 0 24px"><a href="${esc(url)}" style="display:inline-block;background:#8CCDF8;color:#0A1C30;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">${esc(button)}</a></p>
    <p style="margin:0;font-size:13px;color:#4A5868">Fikk du denne e-posten uten å ha bedt om den, kan du se bort fra den.</p>
  </td></tr></table></body></html>`;
  return { subject, html, text: `${intro}\n\n${url}` };
}
