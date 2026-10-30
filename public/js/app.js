import { S, monthTx, allTx, cat, catName, toast } from './state.js';
import { api, hapi, mapTx, mapSettings, mapItem } from './api.js';
import { esc, ymLabel, ymShift, parseCSV, parseNum, guessMap, imageToBase64, todayIso } from './util.js';
import { vLogin, vName, vNoHousehold } from './views/login.js';
import { vOversikt } from './views/oversikt.js';
import { vTransaksjoner } from './views/transaksjoner.js';
import { vBudsjett } from './views/budsjett.js';
import { vRegler } from './views/regler.js';
import { vImport, buildImport } from './views/import.js';
import { vHandleliste } from './views/handleliste.js';
import { vKvittering, receiptShopHits } from './views/kvittering.js';
import { vKvitteringer } from './views/kvitteringer.js';
import { vWrap, wrapKey, wrapFacts } from './views/wrap.js';
import { vMedlemmer } from './views/medlemmer.js';
import { vAdmin } from './views/admin.js';
import { vKategoriser } from './views/kategoriser.js';
import { monthWindow } from './storekjop.js';

const $ = (id) => document.getElementById(id);
let authState = {};
let loadedMonths = new Set();
let shopTimer = null;

/* ---------- Tegning ---------- */
const VIEWS = [
  ['oversikt', 'Oversikt'], ['kategoriser', 'Kategoriser'], ['wrap', 'Måneden din'], ['mat', 'Handleliste mat'], ['hjem', 'Hus og hjem'],
  ['transaksjoner', 'Transaksjoner'], ['kvitteringer', 'Mine kvitteringer'], ['budsjett', 'Budsjett og sparemål'], ['import', 'Import'],
  ['regler', 'Kategoriregler'], ['medlemmer', 'Medlemmer'],
];
const RENDER = {
  oversikt: vOversikt, wrap: vWrap, mat: () => vHandleliste('mat'), hjem: () => vHandleliste('hjem'),
  transaksjoner: vTransaksjoner, budsjett: vBudsjett, import: vImport, regler: vRegler,
  medlemmer: vMedlemmer, kvittering: vKvittering, admin: vAdmin, kategoriser: vKategoriser,
  kvitteringer: vKvitteringer,
};

function showApp(on) {
  $('top').hidden = !on; $('layout').hidden = !on;
  if (on) $('auth').innerHTML = '';
}

function renderNav() {
  const pend = monthTx(S.month).filter((t) => !t.cat).length;
  const open = (l) => S.shop.filter((x) => x.list === l && !x.done).length;
  const views = S.hid ? [...VIEWS] : [];
  if (S.me?.isSuperadmin) views.push(['admin', 'Husholdninger (admin)']);
  $('nav').innerHTML = views.map(([id, label]) => {
    const n = id === 'transaksjoner' ? pend : id === 'kategoriser' ? (S.groups?.total || 0) : (id === 'mat' || id === 'hjem') ? open(id) : 0;
    const warn = id === 'transaksjoner' || id === 'kategoriser';
    return `<button data-action="go" data-view="${id}" ${S.view === id ? 'aria-current="page"' : ''}><span>${label}</span>${n ? `<span class="count ${warn ? '' : 'neutral'}">${n}</span>` : ''}</button>`;
  }).join('');
  // Antall på handleliste-knappene i toppfeltet (mobil)
  document.querySelectorAll('[data-count]').forEach((el) => { const n = open(el.dataset.count); el.textContent = n; el.hidden = !n; });
}

function render() {
  if (!S.me) { showApp(false); $('auth').innerHTML = vLogin(authState); return; }
  if (!S.me.name) { showApp(false); $('auth').innerHTML = vName(); return; }
  if (!S.hid && S.view !== 'admin') { showApp(false); $('auth').innerHTML = vNoHousehold(S.me.isSuperadmin); return; }
  showApp(true);
  $('monthLabel').textContent = ymLabel(S.month);
  document.querySelector('.month').hidden = !S.hid;
  document.querySelectorAll('.toolbar > label[for=receiptInput], .toolbar > [data-view]').forEach((el) => { el.hidden = !S.hid; });
  $('hhSlot').innerHTML = S.households.length > 1
    ? `<label class="sr" for="hhSel">Husholdning</label><select class="hhselect" id="hhSel" data-change="switchHousehold">${S.households.map((h) => `<option value="${h.id}" ${h.id === S.hid ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>`
    : '';
  renderNav();
  const fn = RENDER[S.view] || vOversikt;
  if (S.view !== 'admin' && !S.settings) { $('main').innerHTML = '<p class="loading">Laster…</p>'; return; }
  $('main').innerHTML = fn();
}

function renderKeepFocus() {
  const a = document.activeElement;
  const id = a?.id, pos = a?.selectionStart, val = a?.id === 'shopAdd' ? a.value : null;
  render();
  if (id) { const n = $(id); if (n) { n.focus(); if (val !== null) n.value = val; try { if (pos != null) n.setSelectionRange(pos, pos); } catch { /* */ } } }
}

/* ---------- Lasting ---------- */
async function boot() {
  try {
    const d = await api('/me');
    S.me = d.user; S.households = d.households;
  } catch (e) {
    S.me = null; render(); return;
  }
  if (!S.me.name) { render(); return; }
  const saved = localStorage.getItem('hv_hid');
  S.hid = S.households.find((h) => h.id === saved)?.id || S.households[0]?.id || null;
  S.autoRules = localStorage.getItem('hv_autoRules') !== '0';
  if (!S.hid) { render(); return; }
  await loadHousehold();
}

async function loadHousehold() {
  S.settings = null; S.tx = {}; S.shop = []; S.groups = null; S.receipts = null; loadedMonths = new Set();
  S.role = S.households.find((h) => h.id === S.hid)?.role;
  localStorage.setItem('hv_hid', S.hid);
  render();
  await Promise.all([loadSettings(), loadShop()]);
  await ensureMonths(monthWindow(S.month));
  render();
  startShopPolling();
  refreshGroups();
}

async function loadSettings() { S.settings = mapSettings(await hapi('/settings')); }
async function loadGroups() {
  const d = await hapi('/groups');
  const prev = S.groups;
  S.groups = { total: d.total, groups: d.groups, sug: prev?.sug || {}, shown: prev?.shown || 40 };
  for (const k of Object.keys(S.groups.sug)) if (!d.groups.some((g) => g.key === k)) delete S.groups.sug[k];
}
function refreshGroups() {
  loadGroups().then(() => (['oversikt', 'kategoriser'].includes(S.view) ? render() : renderNav())).catch(() => {});
}
async function categorizeGroups(groups, by) {
  // Serveren tar maks 200 grupper per kall
  const r = { updated: 0, rules: 0 };
  for (let i = 0; i < groups.length; i += 200) {
    const d = await hapi('/groups', { method: 'POST', body: { groups: groups.slice(i, i + 200), by } });
    r.updated += d.updated || 0; r.rules += d.rules || 0;
  }
  await Promise.all([loadGroups(), loadSettings(), reloadTx()]);
  render();
  toast(`${r.updated} transaksjoner kategorisert${r.rules ? `, ${r.rules === 1 ? '1 regel' : r.rules + ' regler'} lagret` : ''}.`);
}
async function loadShop() { S.shop = (await hapi('/shopping')).items.map(mapItem); }

async function ensureMonths(yms) {
  const missing = yms.filter((m) => !loadedMonths.has(m)).sort();
  if (!missing.length) return;
  S.busy.loadingTx = true;
  const d = await hapi(`/transactions?from=${missing[0]}&to=${missing[missing.length - 1]}`);
  const span = [];
  for (let m = missing[0]; m <= missing[missing.length - 1]; m = ymShift(m, 1)) span.push(m);
  for (const m of span) { S.tx[m] = []; loadedMonths.add(m); }
  for (const r of d.transactions) { const t = mapTx(r); (S.tx[t.date.slice(0, 7)] = S.tx[t.date.slice(0, 7)] || []).push(t); }
  S.busy.loadingTx = false;
}
async function reloadTx() {
  const months = [...loadedMonths];
  loadedMonths = new Set();
  await ensureMonths(months);
}

function startShopPolling() {
  clearInterval(shopTimer);
  shopTimer = setInterval(async () => {
    if (document.hidden || !S.hid) return;
    try { await loadShop(); if (['mat', 'hjem', 'oversikt'].includes(S.view)) renderKeepFocus(); else renderNav(); } catch { /* prøver igjen */ }
  }, 20000);
}

async function loadAdmin() {
  S.admin = S.admin || null; render();
  const d = await api('/admin/households');
  S.admin = { list: d.households }; render();
}

/* ---------- Handlinger ---------- */
const findTx = (id) => allTx().find((t) => t.id === id);

async function setCategory(id, categoryId, by) {
  const t = findTx(id); if (!t) return;
  const r = await hapi('/transactions', { method: 'PATCH', body: { id, categoryId: categoryId || null, by, createRule: !!(categoryId && S.autoRules) } });
  t.cat = categoryId || null; t.by = categoryId ? by : null; delete t.sug;
  if (r.rule) {
    await Promise.all([loadSettings(), reloadTx()]);
    refreshGroups();
    toast(`Regel lagret: «${r.rule}» → ${catName(categoryId)}${r.applied ? `. ${r.applied} til fikk samme kategori.` : ''}`);
  }
  render();
}

async function scanReceipt(file) {
  S.receipt = { busy: true }; S.view = 'kvittering'; render();
  try {
    const img = await imageToBase64(file);
    const r = await hapi('/ai', { method: 'POST', body: { task: 'receipt', image: img.data, mediaType: img.mediaType } });
    S.receipt = { busy: false, store: r.store, date: r.date || todayIso(), total: r.totalOre, cat: cat(r.categoryId) ? r.categoryId : null, items: r.items || [], img };
  } catch (e) {
    S.receipt = { busy: false, error: e.message || 'Klarte ikke å lese kvitteringen. Prøv et skarpere bilde med hele kvitteringen synlig.' };
  }
  render();
}

async function loadReceipts() {
  S.receipts = (await hapi('/receipts')).receipts.map((r) => {
    let receipt = {};
    try { receipt = JSON.parse(r.receipt_json) || {}; } catch { /* */ }
    return { id: r.id, userId: r.user_id, date: r.date, amount: r.amount_ore, text: r.description, bank: r.bank_text, cat: r.category_id, receipt, pending: !!r.receipt_pending, hasImg: !!r.receipt_image };
  });
}

function startImport(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) { toast('Fant ingen rader. Sjekk at det er en CSV-fil med overskriftsrad.'); return; }
  S.imp = { header: rows[0], rows: rows.slice(1), map: guessMap(rows[0]) };
  render();
}

const actions = {
  async go(b) {
    S.view = b.dataset.view;
    if (b.dataset.filter) S.filter.cat = b.dataset.filter;
    render(); window.scrollTo({ top: 0 });
    if (S.view === 'admin') await loadAdmin();
    if (S.view === 'kategoriser') { await loadGroups(); render(); }
    if (S.view === 'kvitteringer') { await loadReceipts(); render(); }
  },
  async delReceipt(b) {
    if (!confirm(b.dataset.pending
      ? 'Slette kvitteringen? Den har ikke kommet på kontoutskriften ennå, så utgiften slettes også.'
      : 'Slette kvitteringen? Kortkjøpet fra banken blir liggende.')) return;
    await hapi(`/receipts?id=${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE' });
    await Promise.all([loadReceipts(), reloadTx()]);
    render();
  },
  async prevMonth() { S.month = ymShift(S.month, -1); render(); await ensureMonths(monthWindow(S.month)); render(); },
  async nextMonth() { S.month = ymShift(S.month, 1); render(); await ensureMonths(monthWindow(S.month)); render(); },
  async openWrap(b) { S.month = b.dataset.ym; S.view = 'wrap'; render(); window.scrollTo({ top: 0 }); await ensureMonths(monthWindow(S.month)); render(); },
  loginAgain() { authState = { email: authState.email }; render(); },
  async logout() { await api('/auth/logout', { method: 'POST' }); location.reload(); },

  async acceptSug(b) { const t = findTx(b.dataset.id); if (t?.sug) await setCategory(t.id, t.sug, 'ai'); },
  async aiCategorize() {
    const pend = monthTx(S.month).filter((t) => !t.cat).slice(0, 40);
    if (!pend.length) return;
    S.busy.ai = true; render();
    try {
      const r = await hapi('/ai', { method: 'POST', body: { task: 'categorize', items: pend.map((t) => ({ text: t.text, amountOre: t.amount })) } });
      for (const s of r.suggestions) if (pend[s.i]) pend[s.i].sug = s.categoryId;
      toast(r.suggestions.length ? `Claude foreslo kategori for ${r.suggestions.length} transaksjoner.` : 'Claude fant ingen sikre forslag.');
    } finally { S.busy.ai = false; render(); }
  },
  async delTx(b) {
    if (!confirm('Slette transaksjonen?')) return;
    await hapi(`/transactions?id=${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE' });
    for (const m in S.tx) S.tx[m] = S.tx[m].filter((t) => t.id !== b.dataset.id);
    render();
  },
  async delRule(b) { await hapi(`/rules?id=${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE' }); await loadSettings(); render(); },
  async reapply() { const r = await hapi('/rules', { method: 'PUT' }); await reloadTx(); render(); toast(r.applied ? `${r.applied} transaksjoner fikk kategori.` : 'Ingen nye treff.'); },
  async delGoal(b) { await hapi(`/goals?id=${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE' }); await loadSettings(); render(); },

  parsePaste() { const v = $('paste').value; if (v.trim()) startImport(v); },
  cancelImport() { S.imp = null; render(); },
  async doImport() {
    const { items } = buildImport();
    if (!items.length) return;
    S.busy.import = true; render();
    try {
      let tot = { inserted: 0, duplicates: 0, merged: 0 };
      for (let i = 0; i < items.length; i += 1000) {
        const r = await hapi('/import', { method: 'POST', body: { rows: items.slice(i, i + 1000).map(({ date, amountOre, text }) => ({ date, amountOre, text })) } });
        tot.inserted += r.inserted; tot.duplicates += r.duplicates; tot.merged += r.merged;
      }
      const latest = items.map((t) => t.date.slice(0, 7)).sort().pop();
      const months = [...new Set(items.map((t) => t.date.slice(0, 7)))];
      S.imp = null; S.month = latest; S.view = 'oversikt';
      await reloadTx(); await ensureMonths([...months, ...monthWindow(latest)]);
      refreshGroups();
      toast(`${tot.inserted} nye transaksjoner${tot.duplicates ? `, ${tot.duplicates} fantes fra før` : ''}${tot.merged ? `, ${tot.merged} koblet til kvitteringer` : ''}.`);
    } finally { S.busy.import = false; render(); }
  },

  async acceptGroup(b) {
    const key = b.dataset.key, cat = S.groups?.sug[key];
    if (cat) await categorizeGroups([{ key, categoryId: cat }], 'ai');
  },
  async acceptAllGroups() {
    const list = S.groups.groups.filter((g) => S.groups.sug[g.key]).map((g) => ({ key: g.key, categoryId: S.groups.sug[g.key] }));
    if (!list.length) return;
    S.busy.accept = true; render();
    try { await categorizeGroups(list, 'ai'); } finally { S.busy.accept = false; render(); }
  },
  async aiGroups() {
    const G = S.groups; if (!G?.groups.length) return;
    const todo = G.groups.filter((g) => !G.sug[g.key]).slice(0, 500);
    const batches = Math.ceil(todo.length / 50);
    let n = 0, failed = 0, lastError = '';
    try {
      for (let b = 0; b < batches; b++) {
        S.busy.groups = batches > 1 ? `${b + 1} av ${batches}` : true; render();
        try {
          const r = await hapi('/ai', { method: 'POST', body: { task: 'groups', groups: todo.slice(b * 50, b * 50 + 50) } });
          for (const s of r.suggestions) { G.sug[s.key] = s.categoryId; n++; }
        } catch (e) { failed++; lastError = e.message; console.error(e); }
      }
    } finally { S.busy.groups = false; render(); }
    if (failed === batches) throw new Error(lastError || 'Claude svarte ikke. Prøv igjen.');
    toast(`${n ? `Claude foreslo kategori for ${n} av ${todo.length} butikker. Se over og godta.` : 'Claude fant ingen sikre forslag.'}${failed ? ` ${failed} av ${batches} runder feilet, trykk igjen for resten.` : ''}`);
  },
  moreGroups() { S.groups.shown += 40; render(); },
  cancelReceipt() { S.receipt = null; S.view = 'oversikt'; render(); },

  async delItem(b) { await hapi(`/shopping?id=${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE' }); S.shop = S.shop.filter((x) => x.id !== b.dataset.id); render(); },
  async clearDone(b) { await hapi(`/shopping?list=${b.dataset.list}&done=1`, { method: 'DELETE' }); await loadShop(); render(); },

  async wrapAi() {
    S.busy.wrap = true; render();
    try { const r = await hapi('/ai', { method: 'POST', body: { task: 'wrap', facts: wrapFacts() } }); S.wrapText[wrapKey()] = r.text; }
    finally { S.busy.wrap = false; render(); }
  },

  async removeMember(b) {
    if (!confirm('Fjerne personen fra husholdningen? Transaksjonene deres blir liggende.')) return;
    await hapi(`/members?userId=${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE' }); await loadSettings(); render();
  },
  async adminInvite(b) {
    const email = prompt(`E-post til eieren av ${b.dataset.name}:`);
    if (!email) return;
    const r = await api('/admin/invite', { method: 'POST', body: { householdId: b.dataset.id, email } });
    toast('Invitasjonen er sendt.'); if (r.devLink) console.log('Invitasjonslenke:', r.devLink);
    await loadAdmin();
  },
};

const changes = {
  receipt(el) { const f = el.files?.[0]; el.value = ''; if (f) scanReceipt(f); },
  setCat(el) { return setCategory(el.dataset.id, el.value, 'manuell'); },
  filterCat(el) { S.filter.cat = el.value; render(); },
  autoRules(el) { S.autoRules = el.checked; localStorage.setItem('hv_autoRules', el.checked ? '1' : '0'); },
  async setBudget(el) {
    const v = parseNum(el.value); const c = cat(el.dataset.id); if (!c || isNaN(v)) return;
    await hapi('/categories', { method: 'PATCH', body: { id: c.id, budgetOre: Math.max(0, v) } }); c.budget = Math.max(0, v); render();
  },
  async goalSaved(el) {
    const v = parseNum(el.value); const g = S.settings.goals.find((x) => x.id === el.dataset.id); if (!g || isNaN(v)) return;
    await hapi('/goals', { method: 'PATCH', body: { id: g.id, savedOre: Math.max(0, v) } }); g.saved = Math.max(0, v); render();
  },
  map(el) { S.imp.map[el.dataset.k] = Number(el.value); render(); },
  csvFile(el) {
    const f = el.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const t = String(r.result);
      if (t.includes('\uFFFD')) { const r2 = new FileReader(); r2.onload = () => startImport(String(r2.result)); r2.readAsText(f, 'windows-1252'); }
      else startImport(t);
    };
    r.readAsText(f, 'utf-8');
  },
  async toggleItem(el) {
    const x = S.shop.find((i) => i.id === el.dataset.id); if (!x) return;
    await hapi('/shopping', { method: 'PATCH', body: { id: x.id, done: el.checked } });
    await loadShop(); render();
  },
  groupCat(el) { if (el.value) return categorizeGroups([{ key: el.dataset.key, categoryId: el.value }], 'manuell'); },
  async switchHousehold(el) { S.hid = el.value; S.view = 'oversikt'; await loadHousehold(); },
};

const submits = {
  async login(form) {
    const email = String(new FormData(form).get('email') || '').trim();
    authState = { email, busy: true }; render();
    try { const r = await api('/auth/login', { method: 'POST', body: { email } }); authState = { email, sent: true, devLink: r.devLink }; }
    catch (e) { authState = { email, error: e.message }; }
    render();
  },
  async setName(form) { await api('/me', { method: 'PATCH', body: { name: new FormData(form).get('name') } }); await boot(); },
  async addTx(form) {
    const fd = new FormData(form);
    const date = fd.get('date'), text = String(fd.get('text')).trim(), amount = parseNum(fd.get('amount'));
    if (!date || !text || isNaN(amount) || !amount) { toast('Fyll inn dato, beskrivelse og et beløp.'); return; }
    await hapi('/transactions', { method: 'POST', body: { date, amountOre: amount, text, categoryId: fd.get('cat') || null } });
    S.month = date.slice(0, 7); await reloadTx(); await ensureMonths([S.month]); render(); toast('Transaksjonen er lagt til.');
  },
  async addCat(form) {
    const fd = new FormData(form);
    await hapi('/categories', { method: 'POST', body: { name: fd.get('name'), kind: fd.get('kind') } }); await loadSettings(); render();
  },
  async addGoal(form) {
    const fd = new FormData(form); const target = parseNum(fd.get('target'));
    if (isNaN(target) || target <= 0) { toast('Gi målet et beløp.'); return; }
    await hapi('/goals', { method: 'POST', body: { name: fd.get('name'), targetOre: target } }); await loadSettings(); render();
  },
  async addRule(form) {
    const fd = new FormData(form);
    const r = await hapi('/rules', { method: 'POST', body: { matchText: fd.get('match'), categoryId: fd.get('cat') } });
    await Promise.all([loadSettings(), reloadTx()]); render();
    toast(`Regel lagret${r.applied ? `, ${r.applied} transaksjoner fikk kategori` : ''}.`);
  },
  async addItem(form) {
    const text = String(new FormData(form).get('text') || '').trim(); if (!text) return;
    const r = await hapi('/shopping', { method: 'POST', body: { list: form.dataset.list, text } });
    if (r.exists) toast(`«${text}» står allerede på listen.`);
    await loadShop(); render();
    const n = $('shopAdd'); if (n) { n.value = ''; n.focus(); }
  },
  async saveReceipt(form) {
    const R = S.receipt; if (!R) return;
    const fd = new FormData(form);
    const store = String(fd.get('store')).trim(), date = fd.get('date'), total = parseNum(fd.get('total')), categoryId = fd.get('cat') || null;
    if (!store || !date || isNaN(total) || total <= 0) { toast('Fyll inn butikk, dato og sum.'); return; }
    const hits = fd.get('tick') ? receiptShopHits(R) : [];
    // Serveren kobler kvitteringen til et kortkjøp som allerede er importert, så den ikke telles dobbelt
    const r = await hapi('/receipts', { method: 'POST', body: { store, date, totalOre: total, categoryId, items: R.items, image: R.img?.data, mediaType: R.img?.mediaType } });
    if (hits.length) await hapi('/shopping', { method: 'PATCH', body: { ids: hits.map((h) => h.id), done: true } });
    S.receipt = null; S.view = 'kvitteringer'; S.month = date.slice(0, 7);
    await Promise.all([reloadTx(), loadShop(), loadReceipts()]); await ensureMonths(monthWindow(S.month));
    render(); window.scrollTo({ top: 0 });
    toast(`${r.matched ? 'Kvitteringen er koblet til kortkjøpet fra banken' : 'Kvitteringen er lagret og kobles til kortkjøpet når du importerer kontoutskriften'}${hits.length ? `, og ${hits.length} varer er huket av på handlelisten` : ''}.${r.imageSaved || !R.img ? '' : ' Bildet ble ikke lagret.'}`);
  },
  async invite(form) {
    const fd = new FormData(form);
    const r = await hapi('/members', { method: 'POST', body: { email: fd.get('email'), role: fd.get('role') } });
    toast('Invitasjonen er sendt.'); if (r.devLink) console.log('Invitasjonslenke:', r.devLink);
    await loadSettings(); render();
  },
  async adminCreate(form) {
    const fd = new FormData(form);
    const r = await api('/admin/households', { method: 'POST', body: { name: fd.get('name'), ownerEmail: fd.get('ownerEmail') } });
    if (r.devLink) console.log('Invitasjonslenke:', r.devLink);
    const me = await api('/me'); S.households = me.households;
    if (!S.hid && S.households.length) { S.hid = S.households[0].id; S.view = 'oversikt'; await loadHousehold(); toast('Husholdningen er opprettet.'); return; }
    toast('Husholdningen er opprettet.'); await loadAdmin();
  },
};

/* ---------- Hendelser ---------- */
function handleError(e) {
  console.error(e);
  if (e?.status === 401) { location.reload(); return; }
  toast(e?.message || 'Noe gikk galt.');
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const fn = actions[b.dataset.action];
  if (fn) Promise.resolve(fn(b)).catch(handleError);
});
document.addEventListener('change', (e) => {
  const fn = changes[e.target.dataset?.change];
  if (fn) Promise.resolve(fn(e.target)).catch(handleError);
});
document.addEventListener('input', (e) => {
  if (e.target.dataset?.input !== 'q') return;
  S.filter.q = e.target.value; renderKeepFocus();
});
document.addEventListener('submit', (e) => {
  const fn = submits[e.target.dataset?.submit]; if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(e.target)).catch(handleError);
});

boot();
