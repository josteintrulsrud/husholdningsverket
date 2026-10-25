import { S, memberName } from '../state.js';
import { esc } from '../util.js';
import { heading } from './parts.js';

export function vHandleliste(list) {
  const isMat = list === 'mat';
  const open = S.shop.filter((x) => x.list === list && !x.done).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const done = S.shop.filter((x) => x.list === list && x.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  const row = (x) => `<li class="item ${x.done ? 'done' : ''}">
      <label><input type="checkbox" data-change="toggleItem" data-id="${x.id}" ${x.done ? 'checked' : ''}>
      <span class="txt">${esc(x.text)}<span class="who">${x.done ? 'Kjøpt' : 'Lagt til'} av ${esc(memberName(x.done ? x.doneBy : x.by))}</span></span></label>
      <button class="iconbtn" data-action="delItem" data-id="${x.id}" aria-label="Fjern ${esc(x.text)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </li>`;
  return `
  ${heading(isMat ? 'Handleliste mat' : 'Hus og hjem', isMat ? 'Skriv opp det dere er tomme for. Huk av når det er kjøpt.' : 'Ting som trengs til huset: lyspærer, maling, oppbevaring og lignende.')}
  <section class="panel">
    <form class="addrow" data-submit="addItem" data-list="${list}">
      <label class="sr" for="shopAdd">Legg til på listen</label>
      <input class="inp" id="shopAdd" name="text" autocomplete="off" enterkeyhint="done" placeholder="${isMat ? 'F.eks. melk' : 'F.eks. lyspærer E27'}">
      <button class="btn primary" type="submit">Legg til</button>
    </form>
    ${open.length ? `<ul class="items" aria-label="Ikke kjøpt">${open.map(row).join('')}</ul>` : `<p class="muted">Listen er tom. ${isMat ? 'Kjøleskapet er visst fullt.' : 'Ingenting mangler.'}</p>`}
    ${done.length ? `<div class="subhead"><h2 style="font-size:15px">Kjøpt (${done.length})</h2><button class="btn small" data-action="clearDone" data-list="${list}">Tøm kjøpte</button></div>
    <p class="muted" style="font-size:13px">Fjern haken for å sette en vare tilbake på listen.</p>
    <ul class="items" aria-label="Kjøpt">${done.slice(0, 30).map(row).join('')}</ul>` : ''}
  </section>`;
}
