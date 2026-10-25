import { uuid } from './crypto.js';

// Kategorier (id-suffiks, navn, type, budsjett i kr) og regler som hver nye husholdning starter med.
export const DEFAULT_CATEGORIES = [
  ['mat', 'Mat og dagligvarer', 'utgift', 9000], ['bolig', 'Bolig og strøm', 'utgift', 22000],
  ['bil', 'Bil og transport', 'utgift', 4500], ['fritid', 'Fritid og sport', 'utgift', 6000],
  ['abo', 'Abonnementer', 'utgift', 1500], ['klaer', 'Klær', 'utgift', 3000],
  ['spise', 'Restaurant og kafé', 'utgift', 2000], ['helse', 'Helse', 'utgift', 1000],
  ['hjem', 'Hjem og interiør', 'utgift', 1500], ['annet', 'Annet', 'utgift', 2000],
  ['lonn', 'Lønn', 'inntekt', 0], ['inntekt', 'Annen inntekt', 'inntekt', 0],
  ['sparing', 'Sparing', 'sparing', 0], ['overforing', 'Overføring mellom kontoer', 'overføring', 0],
];

export const DEFAULT_RULES = [
  ['REMA', 'mat'], ['KIWI', 'mat'], ['MENY', 'mat'], ['COOP', 'mat'], ['EXTRA', 'mat'], ['JOKER', 'mat'], ['BUNNPRIS', 'mat'], ['SPAR ', 'mat'], ['ODA', 'mat'],
  ['CIRCLE K', 'bil'], ['ESSO', 'bil'], ['SHELL', 'bil'], ['UNO-X', 'bil'], ['YX ', 'bil'], ['APCOA', 'bil'], ['EASYPARK', 'bil'], ['RUTER', 'bil'], ['VY ', 'bil'], ['AUTOPASS', 'bil'], ['FJELLINJEN', 'bil'],
  ['SPOTIFY', 'abo'], ['NETFLIX', 'abo'], ['VIAPLAY', 'abo'], ['HBO', 'abo'], ['DISNEY', 'abo'], ['TELENOR', 'abo'], ['TELIA', 'abo'], ['ICE.NET', 'abo'], ['APPLE.COM', 'abo'],
  ['FJORDKRAFT', 'bolig'], ['TIBBER', 'bolig'], ['HAFSLUND', 'bolig'], ['ELVIA', 'bolig'], ['HUSLEIE', 'bolig'], ['FELLESKOSTNAD', 'bolig'],
  ['APOTEK', 'helse'], ['VITUSAPOTEK', 'helse'], ['BOOTS', 'helse'],
  ['XXL', 'fritid'], ['INTERSPORT', 'fritid'], ['SPORT 1', 'fritid'],
  ['IKEA', 'hjem'], ['JYSK', 'hjem'], ['CLAS OHLSON', 'hjem'], ['BILTEMA', 'hjem'],
  ['KAFFEBRENNERIET', 'spise'], ['STARBUCKS', 'spise'], ['WAYNE', 'spise'], ['DEG 7', 'spise'],
  ['LØNN', 'lonn'], ['LONN', 'lonn'],
];

export async function seedHousehold(env, householdId) {
  const ids = {};
  const stmts = DEFAULT_CATEGORIES.map(([key, name, kind, kr], i) => {
    ids[key] = uuid();
    return env.DB.prepare('INSERT INTO categories (id, household_id, name, kind, budget_ore, sort) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(ids[key], householdId, name, kind, kr * 100, i);
  });
  for (const [match, key] of DEFAULT_RULES) {
    stmts.push(env.DB.prepare('INSERT INTO category_rules (id, household_id, match_text, category_id) VALUES (?, ?, ?, ?)')
      .bind(uuid(), householdId, match, ids[key]));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}
