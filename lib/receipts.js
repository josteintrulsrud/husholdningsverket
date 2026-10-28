// Kobling mellom kvitteringer og kortkjøp fra banken, så ingenting telles dobbelt.
// Samme beløp og dato innenfor fem dager (kortkjøp kan bokføres noen dager senere, særlig rundt helger).
export const MATCH_DAYS = 5;

// Nærmeste kandidat i dato, eller null
export function closestMatch(candidates, date, amountOre, used = new Set()) {
  const d0 = Date.parse(date);
  let best = null, bestDiff = Infinity;
  for (const c of candidates) {
    if (used.has(c.id) || c.amount_ore !== amountOre) continue;
    const diff = Math.abs(Date.parse(c.date) - d0);
    if (diff <= MATCH_DAYS * 864e5 && diff < bestDiff) { best = c; bestDiff = diff; }
  }
  return best;
}

export const imageKey = (hid, txId) => `${hid}/${txId}.jpg`;
