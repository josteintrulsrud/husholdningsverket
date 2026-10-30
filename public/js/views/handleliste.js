import { S, memberName } from '../state.js';
import { esc, kr } from '../util.js';
import { heading } from './parts.js';

const key = (t) => String(t).trim().toLowerCase();
const pencil = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const cross = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

// Butikk eller lenke: lenker vises med domenenavnet
function placeHtml(p) {
  if (!/^https?:\/\//i.test(p)) return esc(p);
  let host = p; try { host = new URL(p).hostname.replace(/^www\./, ''); } catch { /* */ }
  return `<a href="${esc(p)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a>`;
}

// Linjen under varenavnet: notat, pris, butikk, hvem som tar det, og hvem som la den til
function details(x) {
  const parts = [];
  if (x.list === 'mat' && x.lastPrice) parts.push(`Sist ${kr(x.lastPrice, true)}${x.lastStore ? ` på ${esc(x.lastStore)}` : ''}`);
  if (x.list === 'hjem') {
    if (x.place) parts.push(placeHtml(x.place));
    if (x.price) parts.push(`ca. ${kr(x.price)}`);
    if (x.assignedTo) parts.push(`<strong>${x.assignedTo === S.me.id ? 'Du' : esc(memberName(x.assignedTo))} tar det</strong>`);
  }
  if (!S.shopMode) parts.push(`${x.done ? 'Kjøpt' : 'Lagt til'} av ${esc(memberName(x.done ? x.doneBy : x.by))}`);
  return parts.join(' · ');
}

function editForm(x) {
  const members = S.settings.members || [];
  return `<li class="itemedit"><form class="formgrid" data-submit="saveItem" data-id="${x.id}">
    <label class="f">Antall<input class="inp" name="qty" value="${esc(x.qty || '')}" placeholder="F.eks. 2 pk"></label>
    <label class="f">Notat<input class="inp" name="note" value="${esc(x.note || '')}" placeholder="F.eks. laktosefri"></label>
    ${x.list === 'hjem' ? `
    <label class="f">Butikk eller lenke<input class="inp" name="place" value="${esc(x.place || '')}" placeholder="F.eks. Biltema"></label>
    <label class="f">Omtrentlig pris (kr)<input class="inp" name="price" inputmode="numeric" value="${x.price ? Math.round(x.price / 100) : ''}"></label>
    <label class="f">Hvem tar det<select class="inp" name="who"><option value="">Ingen ennå</option>${members.map((m) => `<option value="${m.id}" ${m.id === x.assignedTo ? 'selected' : ''}>${esc(m.id === S.me.id ? 'Meg' : (m.name || m.email))}</option>`).join('')}</select></label>` : ''}
    <div style="display:flex;gap:8px;grid-column:1/-1"><button class="btn primary small" type="submit">Lagre</button><button class="btn small" type="button" data-action="editItem" data-id="">Avbryt</button></div>
  </form></li>`;
}

export function vHandleliste(list) {
  const isMat = list === 'mat';
  const open = S.shop.filter((x) => x.list === list && !x.done).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const done = S.shop.filter((x) => x.list === list && x.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  const row = (x) => `<li class="item ${x.done ? 'done' : ''}">
      <label><input type="checkbox" data-change="toggleItem" data-id="${x.id}" ${x.done ? 'checked' : ''}>
      <span class="txt">${x.qty ? `<span class="qty">${esc(x.qty)}</span>` : ''}${esc(x.text)}${x.note ? `<span class="note">${esc(x.note)}</span>` : ''}<span class="who">${details(x)}</span></span></label>
      ${S.shopMode ? '' : `<button class="iconbtn" data-action="editItem" data-id="${x.id}" aria-label="Endre ${esc(x.text)}">${pencil}</button>
      <button class="iconbtn" data-action="delItem" data-id="${x.id}" aria-label="Fjern ${esc(x.text)}">${cross}</button>`}
    </li>${S.shopEdit === x.id && !S.shopMode ? editForm(x) : ''}`;

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

  const title = isMat ? 'Handleliste mat' : 'Hus og hjem';
  const modeBtn = `<button class="btn ${S.shopMode ? 'primary' : 'mint'}" data-action="shopMode">${S.shopMode ? 'Ferdig å handle' : 'Handlemodus'}</button>`;

  // Handlemodus: store avkrysningsbokser, ingen skjema, og skjermen holdes på
  if (S.shopMode) {
    return `
    <div class="listhead" style="align-items:center"><div><h1>${title}</h1><p class="lead">${open.length ? `${open.length} igjen` : 'Alt er handlet!'}${S.wakeLock ? ' · skjermen holdes på' : ''}</p></div>${modeBtn}</div>
    <section class="panel shopmode">
      ${openHtml || '<p class="lead">Alt på listen er kjøpt.</p>'}
      ${done.length ? `<h3 class="sect">Kjøpt</h3><ul class="items">${done.slice(0, 30).map(row).join('')}</ul>` : ''}
    </section>`;
  }

  return `
  <div class="listhead">${heading(title, isMat
    ? 'Skriv flere varer på én gang med komma, antall foran og notat i parentes: «melk (laktosefri), 2 brød, egg». Listen sorteres etter avdeling i butikken.'
    : 'Ting som trengs til huset. Skriv flere ting på én gang med semikolon: «lyspærer E27; 2 bokser maling». Trykk blyanten for butikk, pris og hvem som tar det.')}${open.length ? modeBtn : ''}</div>
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
