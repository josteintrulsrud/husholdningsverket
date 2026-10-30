import { askClaude, parseJson } from './anthropic.js';

// Avdelinger i matbutikken, i omtrent den rekkefølgen man går gjennom en norsk dagligvarebutikk.
export const SECTIONS = [
  ['frukt', 'Frukt og grønt'], ['brod', 'Brød og bakervarer'], ['kjott', 'Kjøtt, fisk og pålegg'],
  ['meieri', 'Meieri, ost og egg'], ['torr', 'Tørrvarer og krydder'], ['frys', 'Frysevarer'],
  ['drikke', 'Drikke'], ['snacks', 'Snacks og godteri'], ['hus', 'Husholdning og hygiene'], ['annet', 'Annet'],
];
const IDS = new Set(SECTIONS.map(([id]) => id));

// Ord per avdeling. Rekkefølgen teller: «potetgull» skal til snacks før «potet» treffer frukt og grønt,
// og «peanøttsmør» til tørrvarer før «smør» treffer meieri.
// Ord med * må stå alene («is», ikke «ris»); de andre treffer også i sammensatte ord («lettmelk», «brunost»).
const WORDS = [
  ['frys', 'frossen frosne pizza fiskepinner pommes iskrem is*'],
  ['kjott', 'postei kjøtt kylling karbonade pølse bacon skinke salami laks torsk fisk reker filet biff svin lam kalkun makrell tunfisk pålegg kebab entrecote ribbe kotelett servelat hamburger kjøttkake'],
  ['snacks', 'chips sjokolade godteri godis kjeks nøtter popcorn smågodt lakris potetgull cookies'],
  ['frukt', 'eple epler banan appelsin sitron lime druer pære avokado tomat agurk salat paprika løk gulrot gulrøtter potet poteter brokkoli blomkål spinat sopp champignon squash bær melon mango ananas ingefær persille basilikum koriander purre selleri rødbet kål frukt grønnsak'],
  ['brod', 'brød rundstykke rundstykker baguette ciabatta lompe lomper tortilla pita knekkebrød flatbrød bolle boller rugbrød loff croissant wraps'],
  ['drikke', 'brus cola pepsi juice saft vann mineralvann farris solo energidrikk smoothie øl*'],
  ['torr', 'pasta spaghetti makaroni ris mel* hvetemel sukker havregryn müsli musli frokostblanding cornflakes hermetikk tomatsaus buljong krydder salt pepper olje eddik ketchup sennep majones taco nudler bønner linser kaffe kakao honning syltetøy nugatti peanøttsmør gryn bakepulver gjær te*'],
  ['meieri', 'melk ost smør yoghurt rømme fløte egg kesam cottage kremost skyr kefir margarin creme'],
  ['hus', 'dopapir toalettpapir tørkerull kjøkkenrull oppvask zalo vaskemiddel tøymykner såpe sjampo shampoo tannkrem tannbørste bleier våtservietter søppelpose søppelposer folie bakepapir batterier deodorant bind tamponger skyllemiddel svamp klut'],
].map(([id, w]) => [id, w.split(' ').map((s) => ({ s: s.replace('*', ''), exact: s.endsWith('*') }))]);

export function sectionByWords(text) {
  const words = String(text).toLowerCase().split(/[^a-zæøåéü]+/).filter(Boolean);
  for (const [id, stems] of WORDS) {
    for (const { s, exact } of stems) {
      if (words.some((w) => (exact ? w === s : w === s || w.startsWith(s) || w.endsWith(s)))) return id;
    }
  }
  return null;
}

// Claude tar varene ordlisten ikke kjenner. Svaret huskes i shopping_history, så hver vare spørres bare én gang.
export async function sectionsByClaude(env, texts) {
  if (!env.ANTHROPIC_API_KEY || !texts.length) return {};
  const reply = await askClaude(env, {
    model: env.AI_MODEL_FAST || 'claude-haiku-5-5', maxTokens: 4000, effort: 'low',
    content: `Plasser hver vare i avdelingen den står i i en norsk dagligvarebutikk.
Avdelinger: ${JSON.stringify(Object.fromEntries(SECTIONS))}
Varer: ${JSON.stringify(texts.map((t, i) => ({ i, vare: t })))}
Svar KUN med JSON på én linje: [{"i":0,"a":"meieri"}]. Bruk "annet" hvis du er usikker.`,
  });
  const out = {};
  for (const r of parseJson(reply)) if (Number.isInteger(r.i) && texts[r.i] && IDS.has(r.a)) out[texts[r.i]] = r.a;
  return out;
}
