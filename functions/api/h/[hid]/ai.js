import { json, bad, readJson } from '../../../../lib/http.js';
import { askClaude, parseJson, parseList } from '../../../../lib/anthropic.js';

// POST { task: 'categorize' | 'receipt' | 'wrap', ... } – Claude-funksjonene i appen.
export async function onRequestPost({ request, env, data }) {
  const b = await readJson(request);
  const cats = (await env.DB.prepare('SELECT id, name, kind FROM categories WHERE household_id = ?').bind(data.hid).all()).results;
  const fast = env.AI_MODEL_FAST || 'claude-haiku-5-5';
  const vision = env.AI_MODEL_VISION || 'claude-sonnet-5-5';
  // Claude får korte nummer i stedet for lange id-er, så svaret blir kort og ikke kuttes
  const catList = JSON.stringify(cats.map((c, n) => ({ k: n + 1, navn: c.name, type: c.kind })));
  const catId = (k) => cats[Number(k) - 1]?.id;

  try {
    if (b.task === 'categorize') {
      const items = (b.items || []).slice(0, 40).map((t, i) => ({ i, tekst: String(t.text).slice(0, 120), belop_kr: Number(t.amountOre) / 100 }));
      if (!items.length) return json({ suggestions: [] });
      const text = await askClaude(env, {
        model: fast, maxTokens: 2000,
        content: `Du kategoriserer banktransaksjoner for en norsk husholdning.
Kategorier (bruk kun disse numrene): ${catList}
Negative beløp er utgifter, positive er inntekter. Overføring til sparekonto er sparing.
Transaksjoner: ${JSON.stringify(items)}
Svar KUN med JSON på én linje: [{"i":0,"k":1}]. Utelat transaksjoner du er svært usikker på.`,
      });
      const out = parseList(text).filter((r) => Number.isInteger(r.i) && items[r.i] && catId(r.k)).map((r) => ({ i: r.i, categoryId: catId(r.k) }));
      return json({ suggestions: out });
    }

    if (b.task === 'groups') {
      const items = (b.groups || []).slice(0, 50).map((g, i) => ({
        i, butikk: String(g.key).slice(0, 60), eksempel: String((g.samples || [])[0] || '').slice(0, 100),
        antall: Number(g.count) || 1, snitt_kr: Math.round((Number(g.sumOre) || 0) / (Number(g.count) || 1) / 100),
      }));
      if (!items.length) return json({ suggestions: [] });
      const text = await askClaude(env, {
        model: fast, maxTokens: 4000,
        content: `Du kategoriserer grupper av banktransaksjoner for en norsk husholdning. Hver gruppe er én butikk eller mottaker.
Kategorier (bruk kun disse numrene): ${catList}
Negativt snitt er utgifter, positivt er inntekter. Overføring til sparekonto er sparing.
Grupper: ${JSON.stringify(items)}
Svar KUN med JSON på én linje: [{"i":0,"k":1}]. Utelat grupper du er usikker på (f.eks. Vipps til privatpersoner eller uklare overføringer).`,
      });
      const out = parseList(text).filter((r) => Number.isInteger(r.i) && items[r.i] && catId(r.k))
        .map((r) => ({ key: b.groups[r.i].key, categoryId: catId(r.k) }));
      return json({ suggestions: out });
    }

    if (b.task === 'receipt') {
      const media = String(b.mediaType || 'image/jpeg');
      if (!/^image\/(jpeg|png|webp|gif)$/.test(media) || !b.image) return bad('Mangler bilde');
      if (b.image.length > 6_000_000) return bad('Bildet er for stort');
      const exp = cats.filter((c) => c.kind === 'utgift').map((c) => ({ id: c.id, navn: c.name }));
      const text = await askClaude(env, {
        model: vision, maxTokens: 2000,
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data: b.image } },
          { type: 'text', text: `Les denne norske kvitteringen. Svar KUN med JSON:
{"butikk":"navn","dato":"YYYY-MM-DD","total_kr":123.45,"kategori":"<id>","varer":[{"navn":"Lettmelk 1L","belop_kr":21.9}]}
Kategorier (velg én id for hele kvitteringen): ${JSON.stringify(exp)}
total_kr er totalsummen som ble betalt, som positivt tall. Bruk null for felt du ikke kan lese. Skriv varenavn slik folk sier dem, uten koder.` },
        ],
      });
      const r = parseJson(text);
      return json({
        store: r.butikk || '', date: r.dato || null,
        totalOre: typeof r.total_kr === 'number' ? Math.round(r.total_kr * 100) : null,
        categoryId: cats.some((c) => c.id === r.kategori) ? r.kategori : null,
        items: Array.isArray(r.varer) ? r.varer.filter((v) => v && v.navn).slice(0, 80)
          .map((v) => ({ n: String(v.navn).slice(0, 80), a: typeof v.belop_kr === 'number' ? Math.round(v.belop_kr * 100) : null })) : [],
      });
    }

    if (b.task === 'wrap') {
      const text = await askClaude(env, {
        model: fast, maxTokens: 400,
        content: `Skriv en kort, morsom og varm månedsoppsummering på norsk bokmål (2–3 setninger, maks 60 ord) til et familiemedlem, i stil med Spotify Wrapped. Vær leken, men aldri belærende eller dømmende om forbruk. Ingen emoji, ingen overskrift. Bruk bare disse tallene: ${JSON.stringify(b.facts || {}).slice(0, 3000)}`,
      });
      return json({ text });
    }
    return bad('Ukjent oppgave');
  } catch (e) {
    console.error(e);
    return bad('Claude svarte ikke som forventet. Prøv igjen.', 502);
  }
}
