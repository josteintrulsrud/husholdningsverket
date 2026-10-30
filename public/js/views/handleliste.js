import { S, memberName } from '../state.js';
import { esc } from '../util.js';
import { heading } from './parts.js';

const key = (t) => String(t).trim().toLowerCase();

export function vHandleliste(list) {
  const isMat = list === 'mat';
  const open = S.shop.filter((x) => x.list === list && !x.done).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const done = S.shop.filter((x) => x.list === list && x.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  const row = (x) => `<li class="item ${x.done ? 'done' : ''}">
      <label><input type="checkbox" data-change="toggleItem" data-id="${x.id}" ${x.done ? 'checked' : ''}>
      <span class="txt">${x.qty ? `<span class="qty">${esc(x.qty)}</span>` : ''}${esc(x.text)}<span class="who">${x.done ? 'Kjøpt' : 'Lagt til'} av ${esc(memberName(x.done ? x.doneBy : x.by))}</span></span></label>
      <button class="iconbtn" data-action="delItem" data-id="${x.id}" aria-label="Fjern ${esc(x.text)}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </li>`;

  // Hurtigforslag: det dere pleier å kjøpe, unntatt det som allerede står på listen
  const onList = new Set(open.map((x) => key(x.text)));
  const sug = (S.shopSug || []).filter((s) => s.list === list && !onList.has(key(s.text))).slice(0, 12);

  // Mat sorteres etter avdeling i butikken; varer Claude ikke har plassert ennå står under «Annet»
  let openHtml = '';
  if (open.length && isMat && S.sections?.length) {
    const ids = new Set(S.sections.map(([id]) => id));
    openHtml = S.sections.map(([id, name]) => {
      const rows = open.filter((x) => (ids.has(x.section) ? x.section : 'annet') === id).sort((a, b) => a.text.localeCompare(b.text, 'nb'));
      return rows.length ? `<h3 class="sect">${esc(name)}</h3><ul class="items">${rows.map(row).join('')}</ul>` : '';
    }).join('');
  } else if (open.length) {
    openHtml = `<ul class="items" aria-label="Ikke kjøpt">${open.map(row).join('')}</ul>`;
  }

  return `
  ${heading(isMat ? 'Handleliste mat' : 'Hus og hjem', isMat
    ? 'Skriv flere varer på én gang med komma, og antall foran: «melk, 2 brød, egg». Listen sorteres etter avdeling i butikken.'
    : 'Ting som trengs til huset. Skriv flere ting på én gang med semikolon: «lyspærer E27; 2 bokser maling».')}
  <section class="panel">
    <form class="addrow" data-submit="addItem" data-list="${list}">
      <label class="sr" for="shopAdd">Legg til på listen</label>
      <input class="inp" id="shopAdd" name="text" autocomplete="off" enterkeyhint="done" placeholder="${isMat ? 'F.eks. melk, 2 brød, egg' : 'F.eks. lyspærer E27'}">
      <button class="btn primary" type="submit">Legg til</button>
    </form>
    ${sug.length ? `<div class="chips" aria-label="Det dere pleier å kjøpe">${sug.map((s) => `<button class="chip" data-action="addSug" data-list="${list}" data-text="${esc(s.text)}">+ ${esc(s.text)}</button>`).join('')}</div>` : ''}
    ${openHtml || `<p class="muted">Listen er tom. ${isMat ? 'Kjøleskapet er visst fullt.' : 'Ingenting mangler.'}</p>`}
    ${done.length ? `<div class="subhead"><h2 style="font-size:15px">Kjøpt (${done.length})</h2><button class="btn small" data-action="clearDone" data-list="${list}">Tøm kjøpte</button></div>
    <p class="muted" style="font-size:13px">Fjern haken for å sette en vare tilbake på listen.</p>
    <ul class="items" aria-label="Kjøpt">${done.slice(0, 30).map(row).join('')}</ul>` : ''}
  </section>`;
}
