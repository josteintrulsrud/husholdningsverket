import { monthTx, cat } from './state.js';
import { ymShift, ymNow, merchantKey } from './util.js';

// Store og uforutsette utgifter: enkeltkjøp over grensen som ikke er faste trekk.
export const BIG_ORE = 150000; // 1 500 kr
const SPAN = 6; // måneder før og etter som brukes for å kjenne igjen faste trekk

const isExpense = (t) => t.amount < 0 && (!t.cat || cat(t.cat)?.kind === 'utgift');

// Månedene som trengs for å vurdere ym
export function monthWindow(ym) {
  const out = [];
  for (let i = -SPAN; i <= SPAN; i++) { const m = ymShift(ym, i); if (m <= ymNow()) out.push(m); }
  return out;
}

// Faste trekk: samme mottaker i minst 3 andre måneder rundt ym (husleie, lån, strøm, forsikring)
function recurringKeys(ym) {
  const seen = {};
  for (const m of monthWindow(ym)) {
    if (m === ym) continue;
    for (const k of new Set(monthTx(m).filter(isExpense).map((t) => merchantKey(t.text)))) seen[k] = (seen[k] || 0) + 1;
  }
  return new Set(Object.keys(seen).filter((k) => seen[k] >= 3));
}

export function bigCosts(ym) {
  const fixed = recurringKeys(ym);
  return monthTx(ym).filter((t) => isExpense(t) && -t.amount >= BIG_ORE && !fixed.has(merchantKey(t.text)))
    .sort((a, b) => a.amount - b.amount);
}
