import { S } from '../state.js';
import { esc, kr } from '../util.js';
import { heading, bar } from './parts.js';

export function vBudsjett() {
  const cs = S.settings.categories;
  const total = cs.filter((c) => c.kind === 'utgift').reduce((a, c) => a + (c.budget || 0), 0);
  return `
  ${heading('Budsjett og sparemål', `Budsjettet gjelder hver måned og er felles for husholdningen. Totalt ${kr(total)} per måned.`)}
  <div class="cols">
    <section class="panel wide" aria-labelledby="h-bud">
      <h2 id="h-bud">Månedsbudsjett per kategori</h2>
      <div>${cs.filter((c) => c.kind === 'utgift').map((c) => `
        <div class="budgetline"><label for="b-${c.id}" style="font-weight:600;font-size:14px">${esc(c.name)}</label>
        <input class="inp" id="b-${c.id}" inputmode="numeric" value="${Math.round((c.budget || 0) / 100)}" data-change="setBudget" data-id="${c.id}" aria-describedby="krsuf"></div>`).join('')}
      </div>
      <span id="krsuf" class="sr">kroner per måned</span>
      <form class="formgrid" data-submit="addCat" style="margin-top:6px">
        <label class="f">Ny kategori<input class="inp" name="name" required placeholder="F.eks. Barn"></label>
        <label class="f">Type<select class="inp" name="kind"><option value="utgift">Utgift</option><option value="inntekt">Inntekt</option><option value="sparing">Sparing</option></select></label>
        <button class="btn" type="submit">Legg til kategori</button>
      </form>
    </section>
    <div class="narrow">
      <section class="panel" aria-labelledby="h-goal">
        <h2 id="h-goal">Sparemål</h2>
        ${S.settings.goals.map((g) => `<div class="goal">
          <div style="display:flex;justify-content:space-between;gap:10px;font-weight:600;font-size:14px"><span>${esc(g.name)}</span><span>${kr(g.target)}</span></div>
          ${bar(g.target ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0, false, 'Fremgang')}
          <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">
            <label class="f" style="flex:1 1 120px">Spart så langt (kr)<input class="inp" inputmode="numeric" value="${Math.round(g.saved / 100)}" data-change="goalSaved" data-id="${g.id}"></label>
            <button class="btn small danger" data-action="delGoal" data-id="${g.id}">Fjern</button>
          </div></div>`).join('') || '<p class="muted" style="font-size:14px">Ingen sparemål ennå.</p>'}
        <form class="formgrid" data-submit="addGoal">
          <label class="f">Navn<input class="inp" name="name" required placeholder="F.eks. Sommerferie"></label>
          <label class="f">Mål (kr)<input class="inp" name="target" inputmode="numeric" required placeholder="50000"></label>
          <button class="btn primary" type="submit">Legg til mål</button>
        </form>
      </section>
    </div>
  </div>`;
}
