import { S, catName, catOptions } from '../state.js';
import { esc } from '../util.js';
import { heading } from './parts.js';

export function vRegler() {
  const rs = [...S.settings.rules].sort((a, b) => a.match_text.localeCompare(b.match_text, 'nb'));
  return `
  ${heading('Kategoriregler', 'Teksten i transaksjonen sammenlignes med reglene. Den lengste treffende teksten vinner.')}
  <section class="panel">
    <form class="formgrid" data-submit="addRule">
      <label class="f">Når teksten inneholder<input class="inp" name="match" required placeholder="F.eks. SATS"></label>
      <label class="f">Sett kategori<select class="inp" name="cat" required>${catOptions(null, true)}</select></label>
      <button class="btn primary" type="submit">Legg til regel</button>
    </form>
    <div>${rs.map((r) => `<div class="ruleline"><span><strong>«${esc(r.match_text)}»</strong> <span class="muted">→ ${esc(catName(r.category_id))}</span></span><button class="btn small danger" data-action="delRule" data-id="${r.id}" aria-label="Slett regel ${esc(r.match_text)}">Slett</button></div>`).join('')}</div>
    <button class="btn small" data-action="reapply">Bruk reglene på transaksjoner uten kategori</button>
  </section>`;
}
