'use strict';
// ЭлектроПротокол — прототип. Все данные хранятся в памяти телефона (IndexedDB).
// В рабочей версии «Отправить» будет передавать протоколы на сервер, а начальник увидит их у себя.

const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => d ? new Date(d).toLocaleDateString('ru-RU') : '';
const fmtDT = d => d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

const STATUS = {
  new: ['Новая', 'st-new'],
  briefed: ['Инструктаж пройден', 'st-brief'],
  draft: ['Заполняется', 'st-draft'],
  pending: ['Ждёт отправки', 'st-pending'],
  sent: ['Выполнено', 'st-sent']
};
// Статус с учётом «Работа не выполнялась»
function stOf(t) {
  if (t.status === 'sent' && t.outcome === 'notdone') return ['Работа не выполнялась', 'st-not'];
  return STATUS[t.status] || STATUS.new;
}

// Роли в бригаде (как в наряде-допуске)
const ROLES = [
  ['respExec', 'Ответственный исполнитель'],
  ['respHead', 'Ответственный руководитель работ'],
  ['foreman', 'Производитель работ']
];
function crewNames(t) {
  const c = t.crew || {};
  return [...ROLES.map(([k]) => c[k]), ...(c.members || [])].filter(Boolean);
}
function crewHTML(t) {
  const c = t.crew || {};
  const rows = ROLES.filter(([k]) => c[k]).map(([k, l]) => `${l}: <b>${esc(c[k])}</b>`);
  const m = (c.members || []).filter(Boolean);
  if (m.length) rows.push(`Члены бригады: <b>${esc(m.join(', '))}</b>`);
  return rows.length ? rows.join('<br>') : 'Исполнители не назначены';
}

// ---------- Хранилище на телефоне ----------
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('electro', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('tasks', { keyPath: 'id' });
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });
}
const req = (mode, fn) => new Promise((res, rej) => {
  const r = fn(db.transaction('tasks', mode).objectStore('tasks'));
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
// Переводит заявки старого вида (одно испытание, один исполнитель) в новый
function normalize(t) {
  if (!t) return t;
  if (!t.items) {
    t.items = [{ type: t.workType, values: t.protocol?.values || {}, photos: t.protocol?.photos || [] }];
    delete t.workType; delete t.protocol;
  }
  t.items = t.items.filter(i => WORK_TYPES[i.type]);
  if (!t.crew) {
    t.crew = { respExec: '', respHead: '', foreman: '', members: t.executors || (t.executor ? [t.executor] : []) };
    delete t.executor; delete t.executors;
  }
  t.briefing = t.briefing || { checked: [] };
  return t;
}
const dbAll = async () => (await req('readonly', s => s.getAll())).map(normalize);
const dbGet = async id => normalize(await req('readonly', s => s.get(id)));
const dbPut = t => req('readwrite', s => s.put(t));
const dbDel = id => req('readwrite', s => s.delete(id));
const dbClear = () => req('readwrite', s => s.clear());

// Список людей для выбора исполнителей (запоминается на телефоне)
function getStaff() { try { return JSON.parse(lsGet('staff') || '[]'); } catch (e) { return []; } }
function addStaff(names) {
  const s = new Set(getStaff());
  names.filter(Boolean).forEach(n => s.add(n));
  lsSet('staff', JSON.stringify([...s].sort((a, b) => a.localeCompare(b, 'ru'))));
}

// Примеры заявок для показа
async function seed() {
  if ((await dbAll()).length) return;
  const today = new Date().toISOString().slice(0, 10);
  const crew = { respExec: '', respHead: 'Сидоров В. Н.', foreman: 'Иванов С. П.', members: ['Петров А. В.'] };
  const base = { status: 'new', briefing: { checked: [] }, date: today, crew };
  const item = type => ({ type, values: {}, photos: [] });
  await dbPut({ ...base, id: 't1', number: 'З-101', created: Date.now() - 2000,
    object: 'ТП-12', address: 'п. Лесной, ул. Садовая, 3', equipment: '', comment: 'Испытания после ремонта.',
    items: [item('transformer'), item('p1_8_24'), item('grounding')] });
  await dbPut({ ...base, id: 't2', number: 'З-102', created: Date.now() - 1000,
    object: 'КТП-5', address: 'д. Берёзовка', equipment: '', comment: '', items: [item('grounding')] });
  addStaff(['Сидоров В. Н.', 'Иванов С. П.', 'Петров А. В.']);
}

// ---------- Связь ----------
let demoOffline = lsGet('demoOffline') === '1';
const isOnline = () => navigator.onLine && !demoOffline;
const netBtn = $('#netBtn');
function renderNet() {
  const on = isOnline();
  netBtn.textContent = on ? '● В сети' : '● Нет связи';
  netBtn.className = 'net ' + (on ? 'on' : 'off');
}
netBtn.onclick = () => {
  demoOffline = !demoOffline;
  lsSet('demoOffline', demoOffline ? '1' : '0');
  renderNet();
  toast(demoOffline ? 'Показываем работу без интернета' : 'Связь появилась');
  if (isOnline()) syncPending();
};
window.addEventListener('online', () => { renderNet(); syncPending(); });
window.addEventListener('offline', renderNet);

let syncing = false, currentFormId = null;
// Отправляет всё, что ждёт интернета
async function syncPending() {
  if (!isOnline() || syncing) return;
  syncing = true;
  try {
    const list = (await dbAll()).filter(t => t.status === 'pending');
    for (const t of list) { t.status = 'sent'; t.sentAt = Date.now(); await dbPut(t); }
    if (list.length) {
      toast(list.length === 1 ? 'Отправлено начальнику' : `Отправлено заявок: ${list.length}`);
      // В прототипе начальник и монтёр на одном телефоне; в рабочей версии уведомление придёт начальнику через сервер
      for (const t of list) notify(`Получен протокол: заявка ${t.number}`, `${t.object}. ${t.outcome === 'notdone' ? 'Работа не выполнялась' : 'Протоколов: ' + t.items.length}`, `/b/task/${t.id}`);
      if (!location.hash.includes('/form') || list.some(t => t.id === currentFormId)) router();
    }
  } finally { syncing = false; }
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove('show'), 2800);
}
function header(title, back) {
  $('#title').textContent = title;
  const b = $('#backBtn');
  b.hidden = !back;
  b.onclick = () => { location.hash = back; };
}
const typeName = type => { const w = WORK_TYPES[type]; return w ? `п. ${w.code} ${w.short}` : '—'; };

async function deleteTask(t, back) {
  if (!confirm(`Удалить заявку ${t.number} «${t.object}»?\nПротоколы этой заявки тоже удалятся. Отменить нельзя.`)) return;
  await dbDel(t.id);
  toast('Заявка удалена');
  location.hash = back;
}

// ---------- Поля формы ----------
function optText(f, val) {
  const o = (f.options || []).find(o => (typeof o === 'string' ? o : o.v) === val);
  return o ? (typeof o === 'string' ? o : o.t) : val;
}
// Раскрывает повторяющиеся блоки (например, строки по числу положений переключателя)
function expand(fields, v) {
  return fields.flatMap(f => f.type === 'repeat'
    ? Array.from({ length: Math.max(1, parseInt(v[f.count]) || 1) }, (_, i) => f.make(i + 1)).flat()
    : [f]);
}
// Поля строки с полным названием: «ВН — положение 1: AB», единица — из конца названия строки
function rowChildren(f) {
  const i = f.label.lastIndexOf(', ');
  const name = i > 0 ? f.label.slice(0, i) : f.label, unit = i > 0 ? f.label.slice(i + 2) : '';
  return f.fields.map(c => ({ ...c, label: `${name}: ${c.label}`, unit }));
}
// Все поля протокола одним списком
function flatFields(wt, v) {
  return wt.form.flatMap(sec => expand(sec.fields, v).flatMap(f => f.type === 'row' ? rowChildren(f) : [f]));
}
const missingOf = (wt, v) => flatFields(wt, v).filter(f => f.required && !String(v[f.id] ?? '').trim());
function sectionInner(sec, v, ro) {
  return `<h3>${esc(sec.title)}</h3>${sec.note && !ro ? `<p class="note">${esc(sec.note)}</p>` : ''}
    ${expand(sec.fields, v).map(f => fieldHTML(f, v, ro)).join('')}`;
}
const showVal = (f, val) => f.type === 'date' && val ? fmtDate(val) : optText(f, val);

function fieldHTML(f, v, ro) {
  if (f.type === 'row') {
    return `<div class="row-wrap"><span class="lbl">${esc(f.label)}</span>
      <div class="row" style="--n:${f.fields.length}">${f.fields.map(c => fieldHTML(c, v, ro)).join('')}</div></div>`;
  }
  if (f.type === 'weather') {
    return ro ? '' : `<button type="button" class="btn ghost small wbtn" data-weather="1">🌤 Подтянуть погоду из интернета</button>
      <p class="hint">Температура, влажность и давление по месту, где вы сейчас. Без интернета введите вручную.</p>`;
  }
  if (f.type === 'calc') {
    return `<div class="calc" data-calc="${f.id}"><span class="calc-label">${esc(f.label)}</span>
      <span class="calc-val">—</span><span class="msg" data-msg="${f.id}"></span></div>`;
  }
  const val = v[f.id] ?? '';
  let input;
  if (ro) {
    input = `<div class="ro-val">${val !== '' ? esc(showVal(f, val)) + (f.unit ? ' ' + esc(f.unit) : '') : '—'}</div>`;
  } else if (f.type === 'select') {
    input = `<select data-f="${f.id}"><option value="">— выберите —</option>${f.options.map(o => {
      const ov = typeof o === 'string' ? o : o.v, ot = typeof o === 'string' ? o : o.t;
      return `<option value="${esc(ov)}" ${String(val) === ov ? 'selected' : ''}>${esc(ot)}</option>`;
    }).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea data-f="${f.id}" rows="3">${esc(val)}</textarea>`;
  } else if (f.type === 'date') {
    input = `<input type="date" data-f="${f.id}" value="${esc(val)}">`;
  } else {
    // signed — кнопка ± перед числом (на цифровой клавиатуре iPhone нет минуса)
    input = `<div class="inp-wrap ${f.unit ? 'has-unit' : ''} ${f.signed ? 'has-sign' : ''}">${f.signed ? `<button type="button" class="sign" data-sign="${f.id}" aria-label="Плюс или минус">±</button>` : ''}<input data-f="${f.id}" ${f.type === 'number' ? 'inputmode="decimal"' : ''}
      value="${esc(val)}" autocomplete="off">${f.unit ? `<span class="unit">${esc(f.unit)}</span>` : ''}</div>`;
  }
  // Поле с кнопкой ± — в div, а не label: иначе нажатие на подпись нажимало бы ±
  const tag = f.signed && !ro ? 'div' : 'label';
  return `<${tag} class="field" data-field="${f.id}"><span class="lbl">${esc(f.label)}${f.required && !ro ? ' <b class="req">*</b>' : ''}</span>
    ${input}${f.hint && !ro ? `<span class="hint">${esc(f.hint)}</span>` : ''}<span class="msg" data-msg="${f.id}"></span></${tag}>`;
}

// Подсвечивает значения: зелёным — в норме, красным — вне нормы
function applyChecks(box, wt, v) {
  const r = wt.check(v);
  box.querySelectorAll('[data-msg]').forEach(m => { m.textContent = ''; m.className = 'msg'; });
  box.querySelectorAll('.field').forEach(f => f.classList.remove('bad', 'good'));
  box.querySelectorAll('[data-calc] .calc-val').forEach(c => { c.textContent = '—'; });
  for (const [id, res] of Object.entries(r)) {
    const m = box.querySelector(`[data-msg="${id}"]`);
    // ok: true — норма, false — не норма, null — просто справка
    const cls = res.ok === true ? 'ok' : res.ok === false ? 'bad' : 'info';
    if (m && res.msg) { m.textContent = ({ ok: '✓ ', bad: '✗ ', info: 'ℹ ' })[cls] + res.msg; m.classList.add(cls); }
    const f = box.querySelector(`[data-field="${id}"]`);
    if (f && cls !== 'info') f.classList.add(cls === 'ok' ? 'good' : 'bad');
    const c = box.querySelector(`[data-calc="${id}"] .calc-val`);
    if (c && res.value != null) c.textContent = res.value;
  }
}

// Сжимает фото, чтобы не забить память телефона
function compressPhoto(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = rej; img.src = url;
  });
}
function photosHTML(photos, ro) {
  if (!photos.length) return ro ? '<p class="meta">Фото нет.</p>' : '';
  return `<div class="photos">${photos.map((p, i) => `<div class="ph"><img src="${p}" alt="Фото ${i + 1}">${ro ? '' : `<button data-del="${i}" aria-label="Удалить">×</button>`}</div>`).join('')}</div>`;
}

// ---------- Экраны ----------
function viewRoles() {
  header('ЭлектроПротокол', null);
  app.innerHTML = `
    <div class="hero"><div class="hero-ic">⚡</div><h2>Кто вы?</h2>
      <p class="meta">В рабочей версии здесь будет вход по логину.</p></div>
    <button class="card role" data-role="e"><span class="role-ic">👷</span>
      <span><b>Электромонтёр</b><br><span class="meta">Заявки, инструктаж, протоколы испытаний</span></span></button>
    <button class="card role" data-role="b"><span class="role-ic">📋</span>
      <span><b>Начальник</b><br><span class="meta">Новые заявки и полученные протоколы</span></span></button>
    <div class="gap"></div>
    <button class="btn ghost" id="reset">Сбросить демо-данные</button>`;
  app.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { location.hash = '/' + b.dataset.role; });
  $('#reset').onclick = async () => {
    if (!confirm('Удалить все заявки и протоколы и вернуть примеры?')) return;
    await dbClear(); await seed(); toast('Демо-данные восстановлены');
  };
}

const byNew = (a, b) => (b.created || 0) - (a.created || 0);
// Список испытаний заявки с номерами протоколов
const testsHTML = t => `<ul class="tests">${t.items.map(i => `<li>${esc(typeName(i.type))}${
  i.skip ? ' — <b class="txt-warn">не проводилось</b>' : i.values.proto_no ? ` — протокол № <b>${esc(i.values.proto_no)}</b>` : ''}</li>`).join('')}</ul>`;
const permitHTML = t => t.permit ? `Наряд-допуск / распоряжение № <b>${esc(t.permit)}</b><br>` : '';

// ---------- Уведомления ----------
// Прототип показывает уведомления на этом же телефоне. Чтобы они приходили на другой телефон, нужен сервер.
const canNotify = () => 'Notification' in window;
async function notify(title, body, hash) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: 'icon.svg', badge: 'icon.svg', data: { hash }, tag: title });
    else new Notification(title, { body, icon: 'icon.svg' });
  } catch (e) {}
}
function notifyBtnHTML() {
  if (!canNotify()) return '';
  if (Notification.permission === 'granted') return '';
  if (Notification.permission === 'denied') return '<p class="small">Уведомления запрещены в настройках браузера.</p>';
  return '<button class="btn ghost" id="notifBtn">🔔 Включить уведомления</button><div class="gap"></div>';
}
function bindNotifyBtn() {
  const b = $('#notifBtn');
  if (b) b.onclick = async () => {
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Уведомления включены' : 'Уведомления не разрешены');
    router();
  };
}

async function viewElList() {
  header('Мои заявки', '/');
  const tasks = (await dbAll()).sort(byNew);
  const pending = tasks.filter(t => t.status === 'pending').length;
  app.innerHTML = `
    <a class="card task tb-link" href="#/e/tb"><span class="role-ic">📕</span>
      <span><b>Техника безопасности</b><br><span class="meta">ПОТЭЭ, приказ № 903н — все главы, поиск</span></span></a>
    ${notifyBtnHTML()}
    ${pending ? `<div class="banner warn">Не отправлено: <b>${pending}</b>. Уйдёт само, когда появится интернет.</div>` : ''}
    ${tasks.length ? tasks.map(t => {
      const [sl, sc] = stOf(t);
      return `<a class="card task" href="#/e/task/${t.id}">
        <div class="top-line"><span>${esc(t.number)} · ${fmtDate(t.date)}</span><span class="badge ${sc}">${sl}</span></div>
        <div class="obj">${esc(t.object)}</div>
        <p class="meta">${t.address ? esc(t.address) + '<br>' : ''}${permitHTML(t)}</p>${testsHTML(t)}</a>`;
    }).join('') : '<div class="card meta">Заявок пока нет.</div>'}`;
  bindNotifyBtn();
}

async function viewTask(id, tab, k) {
  const t = await dbGet(id);
  if (!t) { location.hash = '/e'; return; }
  const [sl, sc] = stOf(t);
  header(`Заявка ${t.number}`, '/e');
  const tabs = [['brief', '1. Инструктаж'], ['steps', '2. Инструкция'], ['form', '3. Протоколы']];
  app.innerHTML = `
    <div class="card">
      <div class="top-line"><span>${fmtDate(t.date)}</span><span class="badge ${sc}">${sl}</span></div>
      <div class="obj">${esc(t.object)}</div>
      <p class="meta">${t.address ? esc(t.address) + '<br>' : ''}${permitHTML(t)}${t.equipment ? 'Оборудование: <b>' + esc(t.equipment) + '</b><br>' : ''}${crewHTML(t)}${t.comment ? '<br>' + esc(t.comment) : ''}</p>
      ${testsHTML(t)}
      ${t.outcome === 'notdone' ? `<div class="banner warn mt">Работа не выполнялась. Причина: ${esc(t.reason)}</div>` : ''}
      <div class="actions">
        <a class="btn ghost small" href="#/e/edit/${id}">✎ Изменить</a>
        <button class="btn ghost small danger" id="delBtn">Удалить</button>
        ${t.status === 'sent'
          ? `<button class="btn ghost small wide" id="reopenBtn">Вернуть в работу</button>`
          : t.status !== 'pending' ? `<button class="btn ghost small wide" id="notDoneBtn">Работа не выполнялась</button>` : ''}
      </div>
    </div>
    <nav class="tabs">${tabs.map(([key, l]) => `<a href="#/e/task/${id}/${key}" class="${key === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>
    <div id="tab"></div>`;
  $('#delBtn').onclick = () => deleteTask(t, '/e');
  const nd = $('#notDoneBtn');
  if (nd) nd.onclick = async () => {
    const reason = prompt('Почему работа не выполнялась?');
    if (reason === null) return;
    t.outcome = 'notdone'; t.reason = reason.trim() || 'не указана';
    await submit(t);
  };
  const ro = $('#reopenBtn');
  if (ro) ro.onclick = async () => {
    if (!confirm('Вернуть заявку в работу? Протоколы можно будет исправить и отправить заново.')) return;
    t.status = t.briefing.at ? 'draft' : 'new'; t.outcome = null; t.reason = '';
    await dbPut(t); router();
  };
  const box = $('#tab');
  if (tab === 'brief') renderBrief(box, t);
  else if (tab === 'steps') renderSteps(box, t);
  else renderForm(box, t, +k || 0);
}

// Ставит заявку в очередь отправки и отправляет, если есть связь
async function submit(t) {
  t.status = 'pending'; t.submittedAt = Date.now();
  await dbPut(t);
  if (isOnline()) {
    toast('Отправляем…');
    await new Promise(r => setTimeout(r, 700));
    await syncPending();
  } else {
    toast('Нет связи. Сохранено, отправится само');
    router();
  }
}

const taskTypes = t => [...new Set(t.items.map(i => i.type))].map(k => WORK_TYPES[k]);

function renderBrief(box, t) {
  const wts = taskTypes(t);
  const items = [...new Set([...COMMON_BRIEFING, ...wts.flatMap(w => w.briefing)])];
  const done = t.status !== 'new';
  const chapters = [...new Set(wts.flatMap(w => w.potee || []))]
    .map(n => POTEE.chapters.findIndex(c => c.n === n)).filter(i => i >= 0).sort((a, b) => a - b);
  box.innerHTML = `
    <div class="card"><h3>Прочитать в ПОТЭЭ перед работой</h3>
      ${chapters.map(i => `<a class="tb-row" href="#/e/tb/${i}"><b>${POTEE.chapters[i].n}.</b> ${esc(POTEE.chapters[i].t)}</a>`).join('')}</div>
    <div class="card"><h3>Инструктаж перед работой</h3>
      <p class="meta">Основание: ПОТЭЭ (приказ Минтруда № 903н). Отметьте каждый пункт.</p>
      ${items.map((s, i) => `<label class="check"><input type="checkbox" data-i="${i}"
        ${done || t.briefing.checked.includes(i) ? 'checked' : ''} ${done ? 'disabled' : ''}><span>${esc(s)}</span></label>`).join('')}
    </div>
    ${done
      ? `<div class="banner ok">Инструктаж пройден ${fmtDT(t.briefing.at)}.</div><a class="btn" href="#/e/task/${t.id}/steps">Дальше: инструкция</a>`
      : `<button class="btn accent" id="okBrief" disabled>Подтверждаю: инструктаж пройден</button>`}`;
  if (done) return;
  const btn = $('#okBrief');
  const upd = () => {
    t.briefing.checked = [...box.querySelectorAll('input[type=checkbox]')].filter(c => c.checked).map(c => +c.dataset.i);
    btn.disabled = t.briefing.checked.length !== items.length;
  };
  box.addEventListener('change', () => { upd(); dbPut(t); });
  upd();
  btn.onclick = async () => {
    t.status = 'briefed'; t.briefing.at = Date.now();
    await dbPut(t);
    toast('Инструктаж пройден');
    location.hash = `/e/task/${t.id}/steps`;
  };
}

function renderSteps(box, t) {
  box.innerHTML = taskTypes(t).map(wt => `
    <div class="card"><h3>${esc(wt.title)}</h3><p class="meta" style="margin-bottom:14px">${esc(wt.docs)}</p>
      <ol class="steps">${wt.steps.map(s => `<li><b>${esc(s.title)}</b>${s.text ? '<br>' + esc(s.text) : ''}</li>`).join('')}</ol></div>`).join('') +
    `<p class="small">${esc(DISCLAIMER)}</p><div class="gap"></div>
    <a class="btn" href="#/e/task/${t.id}/form">Дальше: заполнить протоколы</a>`;
}

let highlightMissing = false;
function markMissing(box, wt, v) {
  const miss = missingOf(wt, v);
  box.querySelectorAll('.field.missing').forEach(f => f.classList.remove('missing'));
  miss.forEach(f => box.querySelector(`[data-field="${f.id}"]`)?.classList.add('missing'));
  if (miss.length) setTimeout(() => box.querySelector(`[data-field="${miss[0].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  return miss.length;
}

function renderForm(box, t, k) {
  if (!t.items.length) { box.innerHTML = '<div class="card meta">В заявке нет испытаний. Нажмите «Изменить», чтобы добавить.</div>'; return; }
  k = Math.min(Math.max(0, k), t.items.length - 1);
  const it = t.items[k], wt = WORK_TYPES[it.type], v = it.values;
  currentFormId = t.id;
  const ro = t.status === 'pending' || t.status === 'sent';
  const n = t.items.length;
  let html = '';
  if (n > 1) html += `<div class="subtabs">${t.items.map((x, j) => {
    const mark = x.skip ? '— ' : !missingOf(WORK_TYPES[x.type], x.values).length ? '✓ ' : '';
    return `<a href="#/e/task/${t.id}/form/${j}" class="${j === k ? 'active' : ''}">${mark}${j + 1}. п. ${WORK_TYPES[x.type].code}</a>`;
  }).join('')}</div>`;
  if (t.status === 'new') html += `<div class="banner warn">Сначала пройдите инструктаж. Без него протоколы не отправятся.</div>`;
  if (t.status === 'pending') html += `<div class="banner warn">Сохранено на телефоне и ждёт интернета. Отправится само.</div>`;
  if (t.status === 'sent') html += `<div class="banner ok">Отправлено ${fmtDT(t.sentAt)}. Начальник видит.</div>`;
  html += `<div class="card proto-head"><span class="meta">Протокол ${k + 1} из ${n}</span><h3>${esc(typeName(it.type))}</h3>
    ${ro ? '' : it.skip ? `<button class="btn ghost small mt" id="unskipBtn">Вернуть испытание</button>`
      : `<button class="btn ghost small mt" id="skipBtn">Испытание не проводилось</button>`}</div>`;
  if (it.skip) {
    html += `<div class="banner warn">Испытание не проводилось. Причина: ${esc(it.reason)}</div>`;
  } else {
    html += wt.form.map((sec, i) => `<div class="card" data-sec="${i}">${sectionInner(sec, v, ro)}</div>`).join('');
    html += `<div class="card"><h3>Фото с объекта</h3><div id="photos">${photosHTML(it.photos, ro)}</div>
      ${ro ? '' : `<div class="actions">
        <label class="btn ghost file-btn">📷 Сфотографировать<input type="file" accept="image/*" capture="environment" class="photoInp"></label>
        <label class="btn ghost file-btn">🖼 Из галереи<input type="file" accept="image/*" multiple class="photoInp"></label></div>`}</div>`;
  }
  if (k < n - 1) html += `<a class="btn ghost" href="#/e/task/${t.id}/form/${k + 1}">Дальше: протокол ${k + 2} из ${n}</a>`;
  if (!ro) html += `<div class="sticky-actions"><div class="inner"><button class="btn accent" id="sendBtn">Выполнено — отправить ${n > 1 ? `протоколы (${n})` : 'протокол'}</button></div></div>`;
  box.innerHTML = html;
  if (!it.skip) applyChecks(box, wt, v);
  if (ro) return;
  if (highlightMissing) { highlightMissing = false; markMissing(box, wt, v); }

  const save = () => {
    if (t.status === 'briefed') t.status = 'draft';
    t.savedAt = Date.now();
    return dbPut(t);
  };
  // Испытание не проводилось — с причиной
  const skipBtn = $('#skipBtn'), unskipBtn = $('#unskipBtn');
  if (skipBtn) skipBtn.onclick = async () => {
    const reason = prompt('Почему испытание не проводилось?');
    if (reason === null) return;
    it.skip = true; it.reason = reason.trim() || 'не указана';
    await save(); router();
  };
  if (unskipBtn) unskipBtn.onclick = async () => {
    it.skip = false; it.reason = '';
    await save(); router();
  };
  // Перерисовать раздел, где лежит поле (после погоды или смены числа строк)
  const redrawSecOf = id => {
    const i = wt.form.findIndex(sec => expand(sec.fields, v).some(f => f.id === id || (f.type === 'row' && f.fields.some(c => c.id === id))));
    const card = box.querySelector(`[data-sec="${i}"]`);
    if (card) card.innerHTML = sectionInner(wt.form[i], v, false);
  };
  box.addEventListener('input', e => {
    const id = e.target.dataset.f;
    if (!id) return;
    v[id] = e.target.value;
    e.target.closest('.field')?.classList.remove('missing');
    // Поменяли число положений — перерисовываем раздел с нужным количеством строк
    const card = e.target.closest('[data-sec]');
    const sec = card && wt.form[+card.dataset.sec];
    if (sec && sec.fields.some(f => f.id === id && f.rerender)) card.innerHTML = sectionInner(sec, v, false);
    applyChecks(box, wt, v);
    save();
  });
  box.addEventListener('click', async e => {
    // ± меняет знак числа
    const sb = e.target.closest('[data-sign]');
    if (sb) {
      e.preventDefault();
      const id = sb.dataset.sign, inp = box.querySelector(`[data-f="${id}"]`);
      const cur = String(v[id] ?? '').trim();
      v[id] = cur.startsWith('-') ? cur.slice(1) : '-' + cur;
      inp.value = v[id];
      if (!cur) inp.focus();
      applyChecks(box, wt, v); save();
      return;
    }
    if (e.target.closest('[data-weather]')) {
      const btn = e.target.closest('[data-weather]');
      btn.disabled = true; btn.textContent = 'Определяем место и погоду…';
      try {
        const w = await fetchWeather();
        Object.assign(v, w);
        redrawSecOf('temp_air'); applyChecks(box, wt, v); save();
        toast('Погода заполнена');
      } catch (err) {
        toast(err.message || 'Не удалось получить погоду. Введите вручную');
        btn.disabled = false; btn.textContent = '🌤 Подтянуть погоду из интернета';
      }
    }
  });

  const photoBox = $('#photos');
  box.querySelectorAll('.photoInp').forEach(inp => inp.onchange = async e => {
    for (const file of e.target.files) {
      try { it.photos.push(await compressPhoto(file)); } catch (err) { toast('Не удалось открыть фото'); }
    }
    e.target.value = '';
    photoBox.innerHTML = photosHTML(it.photos, false);
    save();
  });
  if (photoBox) photoBox.onclick = e => {
    const i = e.target.dataset.del;
    if (i === undefined) return;
    it.photos.splice(+i, 1);
    photoBox.innerHTML = photosHTML(it.photos, false);
    save();
  };

  $('#sendBtn').onclick = async () => {
    if (t.status === 'new') { toast('Сначала пройдите инструктаж'); location.hash = `/e/task/${t.id}/brief`; return; }
    // Проверяем все протоколы заявки (кроме тех, что не проводились)
    for (let j = 0; j < n; j++) {
      const x = t.items[j];
      if (x.skip) continue;
      const w = WORK_TYPES[x.type], cnt = missingOf(w, x.values).length;
      if (!cnt) continue;
      toast(`Протокол ${j + 1}: не заполнено обязательных полей — ${cnt}`);
      if (j === k) markMissing(box, wt, v);
      else { highlightMissing = true; location.hash = `/e/task/${t.id}/form/${j}`; }
      return;
    }
    const warn = t.items.map((x, j) => {
      if (x.skip) return '';
      const bad = Object.values(WORK_TYPES[x.type].check(x.values)).filter(r => r.ok === false).length;
      return bad && isFit(x.values) ? `протокол ${j + 1}: вне нормы ${bad}` : '';
    }).filter(Boolean);
    if (warn.length && !confirm(`Есть значения вне нормы при выводе «Годна» (${warn.join('; ')}). Всё равно отправить?`)) return;
    // Пустые «Оценка» и «Результат» автоматически становятся «Не проводилось»
    for (const x of t.items) {
      if (x.skip) continue;
      flatFields(WORK_TYPES[x.type], x.values)
        .filter(f => f.type === 'select' && f.options.includes(NOT_DONE) && !String(x.values[f.id] ?? '').trim())
        .forEach(f => { x.values[f.id] = NOT_DONE; });
    }
    t.outcome = 'done'; t.reason = '';
    await submit(t);
  };
}

// Погода по месту: геолокация телефона + бесплатный сервис Open-Meteo (работает в России без VPN)
function fetchWeather() {
  return new Promise((res, rej) => {
    if (!isOnline()) return rej(new Error('Нет интернета. Введите погоду вручную'));
    if (!navigator.geolocation) return rej(new Error('Телефон не даёт определить место'));
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude: la, longitude: lo } = pos.coords;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(3)}&longitude=${lo.toFixed(3)}&current=temperature_2m,relative_humidity_2m,surface_pressure`;
        const c = (await (await fetch(url)).json()).current;
        res({
          temp_air: String(Math.round(c.temperature_2m)),
          humidity: String(Math.round(c.relative_humidity_2m)),
          pressure: String(Math.round(c.surface_pressure * 0.750062)) // гПа → мм рт. ст.
        });
      } catch (e) { rej(new Error('Сервис погоды не ответил. Введите вручную')); }
    }, () => rej(new Error('Нет доступа к местоположению. Разрешите его или введите вручную')), { timeout: 15000, maximumAge: 600000 });
  });
}

// ---------- Создание и изменение заявки (общее для обеих ролей) ----------
async function viewEdit(role, id) {
  const old = id ? await dbGet(id) : null;
  if (id && !old) { location.hash = '/' + role; return; }
  const back = id ? `/${role}/task/${id}` : `/${role}`;
  header(id ? `Изменить ${old.number}` : 'Новая заявка', back);
  const t = old || { date: new Date().toISOString().slice(0, 10), items: [{ type: '', values: {}, photos: [] }],
    crew: { respExec: '', respHead: '', foreman: '', members: [''] } };
  const items = t.items.map(i => ({ ...i }));
  const crew = { ...t.crew, members: [...(t.crew.members || [])] };
  if (!crew.members.length) crew.members.push('');

  const typeOpts = sel => `<option value="">— выберите испытание —</option>` +
    Object.entries(WORK_TYPES).map(([key, w]) => `<option value="${key}" ${key === sel ? 'selected' : ''}>${esc(w.code)}. ${esc(w.short)}</option>`).join('');
  const personOpts = sel => {
    const staff = getStaff();
    if (sel && !staff.includes(sel)) staff.push(sel);
    return `<option value="">— не назначен —</option>` + staff.map(n => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('') +
      `<option value="__new">+ Новый человек…</option>`;
  };
  app.innerHTML = `<form class="card" id="ef" novalidate>
    <span class="lbl">Испытания <b class="req">*</b></span>
    <div id="tests"></div>
    <button type="button" class="btn ghost small" id="addTest">+ Добавить испытание</button>
    <div class="gap"></div>
    <label class="field"><span class="lbl">Объект <b class="req">*</b></span><input name="object" value="${esc(t.object)}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Адрес</span><input name="address" value="${esc(t.address)}" autocomplete="off"></label>
    <label class="field"><span class="lbl">№ наряда-допуска или распоряжения</span><input name="permit" value="${esc(t.permit)}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Оборудование</span><input name="equipment" value="${esc(t.equipment)}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Дата</span><input type="date" name="date" value="${esc(t.date)}"></label>
    <h3 class="mt">Исполнители</h3>
    <div id="crew"></div>
    <label class="field"><span class="lbl">Комментарий</span><textarea name="comment" rows="2">${esc(t.comment)}</textarea></label>
    <button class="btn accent" type="submit">${id ? 'Сохранить' : 'Создать заявку'}</button></form>`;

  const testsBox = $('#tests'), crewBox = $('#crew');
  const drawTests = () => {
    testsBox.innerHTML = items.map((it, i) => `<div class="multi"><select data-ti="${i}">${typeOpts(it.type)}</select>
      ${items.length > 1 ? `<button type="button" class="x" data-tdel="${i}" aria-label="Убрать испытание">×</button>` : ''}</div>`).join('');
  };
  const drawCrew = () => {
    crewBox.innerHTML = ROLES.map(([key, l]) => `<label class="field"><span class="lbl">${l}</span>
      <select data-role="${key}">${personOpts(crew[key])}</select></label>`).join('') +
      `<span class="lbl">Члены бригады</span>` +
      crew.members.map((m, i) => `<div class="multi"><select data-mi="${i}">${personOpts(m)}</select>
        ${crew.members.length > 1 ? `<button type="button" class="x" data-mdel="${i}" aria-label="Убрать">×</button>` : ''}</div>`).join('') +
      `<button type="button" class="btn ghost small" id="addMember">+ Добавить члена бригады</button><div class="gap"></div>`;
    $('#addMember').onclick = () => { crew.members.push(''); drawCrew(); };
  };
  drawTests(); drawCrew();
  const hasData = it => Object.values(it.values || {}).some(x => String(x).trim()) || it.photos?.length;

  $('#addTest').onclick = () => { items.push({ type: '', values: {}, photos: [] }); drawTests(); };
  testsBox.onclick = e => {
    const i = e.target.dataset.tdel;
    if (i === undefined) return;
    if (hasData(items[i]) && !confirm('В этом протоколе уже есть данные. Убрать испытание вместе с ними?')) return;
    items.splice(+i, 1); drawTests();
  };
  testsBox.onchange = e => {
    const i = e.target.dataset.ti;
    if (i === undefined) return;
    if (hasData(items[i]) && !confirm('В этом протоколе уже есть данные. Сменить испытание? Данные удалятся.')) { drawTests(); return; }
    items[i] = { type: e.target.value, values: {}, photos: [] };
  };
  // Выбор человека; «+ Новый человек…» спрашивает фамилию и добавляет в список
  crewBox.onchange = e => {
    const s = e.target;
    let val = s.value;
    if (val === '__new') {
      val = (prompt('Фамилия и инициалы') || '').trim();
      if (val) addStaff([val]);
    }
    if (s.dataset.role) crew[s.dataset.role] = val;
    if (s.dataset.mi !== undefined) crew.members[+s.dataset.mi] = val;
    drawCrew();
  };
  crewBox.onclick = e => {
    const i = e.target.dataset.mdel;
    if (i === undefined) return;
    crew.members.splice(+i, 1); drawCrew();
  };

  $('#ef').onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const goodItems = items.filter(i => i.type);
    if (!goodItems.length) { toast('Выберите хотя бы одно испытание'); return; }
    if (!fd.object.trim()) { toast('Укажите объект'); e.target.object.focus(); return; }
    crew.members = crew.members.filter(Boolean);
    const all = await dbAll();
    const nextNo = 'З-' + (Math.max(100, ...all.map(x => parseInt(String(x.number).replace(/\D/g, '')) || 0)) + 1);
    const typesChanged = !old || old.items.map(i => i.type).join() !== goodItems.map(i => i.type).join();
    const saved = {
      ...(old || { id: 't' + Date.now(), number: nextNo, created: Date.now(), status: 'new', briefing: { checked: [] } }),
      object: fd.object.trim(), address: fd.address.trim(), equipment: fd.equipment.trim(), permit: fd.permit.trim(), date: fd.date, comment: fd.comment.trim(),
      items: goodItems, crew
    };
    if (typesChanged && saved.status === 'new') saved.briefing = { checked: [] };
    addStaff(crewNames(saved));
    await dbPut(saved);
    toast(id ? 'Заявка сохранена' : 'Заявка создана');
    if (!id) notify(`Новая заявка ${saved.number}`, `${saved.object}${saved.date ? ', ' + fmtDate(saved.date) : ''}`, `/e/task/${saved.id}`);
    location.hash = id ? back : `/${role}`;
  };
}

// ---------- Техника безопасности (ПОТЭЭ) ----------
let tbQuery = '';
function viewTB() {
  header('Техника безопасности', '/e');
  app.innerHTML = `
    <div class="card"><h2>Правила по охране труда при эксплуатации электроустановок</h2>
      <p class="meta">${esc(POTEE.source)}. Работает без интернета.</p></div>
    <input id="tbSearch" type="search" placeholder="Поиск по тексту Правил" value="${esc(tbQuery)}" autocomplete="off">
    <div class="gap"></div>
    <div id="tbList"></div>`;
  const list = $('#tbList'), inp = $('#tbSearch');
  const render = () => {
    tbQuery = inp.value.trim();
    if (tbQuery.length < 3) {
      list.innerHTML = `<div class="card">
        <a class="tb-row" href="#/e/tb/groups"><b>Прил. 1.</b> Группы по электробезопасности и условия их присвоения</a>
        ${POTEE.chapters.map((c, i) => `<a class="tb-row" href="#/e/tb/${i}"><b>${c.n}.</b> ${esc(c.t)}</a>`).join('')}</div>`;
      return;
    }
    const q = tbQuery.toLowerCase(), found = [];
    POTEE.chapters.forEach((c, ci) => c.p.forEach(p => { if (found.length < 60 && p.toLowerCase().includes(q)) found.push([ci, p]); }));
    list.innerHTML = found.length
      ? `<p class="meta">Найдено: ${found.length}${found.length === 60 ? '+ (уточните запрос)' : ''}</p><div class="gap"></div>` +
        found.map(([ci, p]) => `<a class="card task" href="#/e/tb/${ci}/${encodeURIComponent((p.match(/^(\d+\.\d+)\./) || [])[1] || '')}">
          <div class="top-line"><span>Глава ${POTEE.chapters[ci].n}</span></div><div class="tb-snip">${mark(p, tbQuery)}</div></a>`).join('')
      : '<div class="card meta">Ничего не найдено.</div>';
  };
  inp.addEventListener('input', render);
  render();
}
// Подсвечивает найденное слово в тексте
function mark(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text.slice(0, 300));
  const from = Math.max(0, i - 120), to = Math.min(text.length, i + q.length + 180);
  return (from ? '…' : '') + esc(text.slice(from, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' +
    esc(text.slice(i + q.length, to)) + (to < text.length ? '…' : '');
}
function viewTBChapter(i, point) {
  const c = POTEE.chapters[i];
  if (!c) { location.hash = '/e/tb'; return; }
  header(`ПОТЭЭ, глава ${c.n}`, '/e/tb');
  const prev = POTEE.chapters[i - 1], next = POTEE.chapters[+i + 1];
  app.innerHTML = `<div class="card tb-text"><h2>${c.n}. ${esc(c.t)}</h2>
    ${c.p.map(p => {
      const m = p.match(/^(\d+\.\d+)\.\s/);
      return `<p ${m ? `id="pt-${m[1]}"` : ''}>${m ? `<b>${m[1]}.</b> ${esc(p.slice(m[0].length))}` : esc(p)}</p>`;
    }).join('')}</div>
    <div class="tb-nav">
      ${prev ? `<a class="btn ghost" href="#/e/tb/${+i - 1}">‹ Глава ${prev.n}</a>` : '<span></span>'}
      ${next ? `<a class="btn ghost" href="#/e/tb/${+i + 1}">Глава ${next.n} ›</a>` : '<span></span>'}
    </div>`;
  if (point) {
    const el = document.getElementById('pt-' + decodeURIComponent(point));
    if (el) { el.classList.add('hl'); setTimeout(() => { el.scrollIntoView({ block: 'center' }); }, 50); }
  }
}
function viewTBGroups() {
  header('Группы по электробезопасности', '/e/tb');
  const a = POTEE.app1;
  app.innerHTML = `<div class="card"><h2>${esc(a.t)}</h2>
    <p class="meta">Минимальный стаж работы в предыдущей группе, месяцев.</p></div>
    ${a.groups.map(g => `<div class="card tb-text"><h3>Группа ${g.g}</h3>
      ${g.g === 'II' ? '<p class="meta">Стаж не требуется.</p>' : `<table class="res">${a.cols.map((col, k) =>
        `<tr><td>${esc(col)}</td><td>${g.stazh[k] === '-' ? '—' : esc(g.stazh[k]) + ' мес.'}</td></tr>`).join('')}</table>`}
      <h3 style="margin-top:14px">Требования к персоналу</h3>
      ${g.req.map(r => `<p>${esc(r)}</p>`).join('')}</div>`).join('')}`;
}

// ---------- Начальник ----------
function bossStatus(t) {
  if (t.status === 'new') return ['Новая', 'st-new'];
  if (t.status === 'sent') return t.outcome === 'notdone' ? ['Работа не выполнялась', 'st-not'] : ['Выполнено', 'st-sent'];
  return ['В работе', 'st-draft'];
}

async function viewBossList() {
  header('Заявки и протоколы', '/');
  const tasks = (await dbAll()).sort(byNew);
  const done = tasks.filter(t => t.status === 'sent').length;
  app.innerHTML = `
    <div class="stats">
      <div class="stat"><b>${tasks.length}</b><span>всего заявок</span></div>
      <div class="stat"><b>${tasks.length - done}</b><span>в работе</span></div>
      <div class="stat"><b>${done}</b><span>закрыто</span></div>
    </div>
    <a class="btn accent" href="#/b/new">+ Новая заявка</a><div class="gap"></div>${notifyBtnHTML()}
    ${tasks.map(t => {
      const [sl, sc] = bossStatus(t);
      const notOk = t.status === 'sent' && t.outcome !== 'notdone' && t.items.some(i => !i.skip && i.values.conclusion && !isFit(i.values));
      return `<a class="card task" href="#/b/task/${t.id}">
        <div class="top-line"><span>${esc(t.number)} · ${fmtDate(t.date)}</span>
          <span>${notOk ? '<span class="badge st-pending">Не годна</span> ' : ''}<span class="badge ${sc}">${sl}</span></span></div>
        <div class="obj">${esc(t.object)}</div>
        <p class="meta">${esc(crewNames(t).join(', ') || 'Исполнители не назначены')}</p>${testsHTML(t)}</a>`;
    }).join('') || '<div class="card meta">Заявок пока нет.</div>'}`;
  bindNotifyBtn();
}

function protocolHTML(it, k, n) {
  if (it.skip) return `<div class="proto-block"><div class="card proto-head"><span class="meta">Протокол ${k + 1} из ${n}</span>
    <h3>${esc(typeName(it.type))}</h3></div><div class="banner warn">Испытание не проводилось. Причина: ${esc(it.reason)}</div></div>`;
  const wt = WORK_TYPES[it.type], v = it.values, r = wt.check(v);
  const markOk = id => r[id] && r[id].ok != null ? `<span class="${r[id].ok ? 'mark-ok' : 'mark-bad'}" title="${esc(r[id].msg)}">${r[id].ok ? '✓' : '✗'}</span>` : '';
  const secs = wt.form.map(sec => {
    const rows = expand(sec.fields, v).flatMap(f => {
      if (f.type === 'calc') return r[f.id]?.value ? [[f.label, r[f.id].value, f.id]] : [];
      const list = f.type === 'row' ? rowChildren(f) : [f];
      return list.filter(x => String(v[x.id] ?? '').trim()).map(x => [x.label, showVal(x, v[x.id]) + (x.unit ? ' ' + x.unit : ''), x.id]);
    });
    if (!rows.length) return '';
    return `<div class="card"><h3>${esc(sec.title)}</h3><table class="res">${rows.map(([l, val, id]) =>
      `<tr><td>${esc(l)}</td><td>${esc(val)}</td><td>${markOk(id)}</td></tr>`).join('')}</table></div>`;
  }).join('');
  const bad = Object.values(r).filter(x => x.ok === false).length;
  return `<div class="proto-block">
    <div class="card proto-head"><span class="meta">Протокол ${k + 1} из ${n}</span>
      <h2>Протокол № ${esc(v.proto_no || '—')}${v.proto_date ? ' от ' + fmtDate(v.proto_date) : ''}</h2>
      <p class="meta">${esc(typeName(it.type))}</p></div>
    ${bad ? `<div class="banner warn">Значений вне нормы: <b>${bad}</b> (отмечены ✗).</div>` : `<div class="banner ok">Все проверенные значения в норме.</div>`}
    ${secs}<div class="card"><h3>Фото с объекта</h3>${photosHTML(it.photos, true)}</div></div>`;
}

async function viewBossTask(id) {
  const t = await dbGet(id);
  if (!t) { location.hash = '/b'; return; }
  header(`Заявка ${t.number}`, '/b');
  const [sl, sc] = bossStatus(t);
  const info = `<div class="card">
    <div class="top-line"><span>Заявка ${esc(t.number)} от ${fmtDate(t.date)}</span><span class="badge ${sc}">${sl}</span></div>
    <div class="obj">${esc(t.object)}</div>
    <p class="meta">${t.address ? 'Адрес: ' + esc(t.address) + '<br>' : ''}${permitHTML(t)}${t.equipment ? 'Оборудование: ' + esc(t.equipment) + '<br>' : ''}
    ${crewHTML(t)}<br>Инструктаж: ${t.briefing.at ? fmtDT(t.briefing.at) : 'не пройден'}${t.sentAt ? '<br>Получено: ' + fmtDT(t.sentAt) : ''}
    ${t.comment ? '<br>' + esc(t.comment) : ''}</p>
    ${testsHTML(t)}
    <div class="actions no-print">
      <a class="btn ghost small" href="#/b/edit/${id}">✎ Изменить</a>
      <button class="btn ghost small danger" id="delBtn">Удалить</button>
    </div></div>`;
  let body;
  if (t.status !== 'sent') body = `<div class="banner info">Протоколы ещё не получены. Статус: ${sl.toLowerCase()}.</div>`;
  else if (t.outcome === 'notdone') body = `<div class="banner warn">Работа не выполнялась. Причина: ${esc(t.reason)}</div>`;
  else body = t.items.map((it, k) => protocolHTML(it, k, t.items.length)).join('') +
    `<button class="btn no-print" onclick="window.print()">Печать или сохранить в PDF</button>`;
  app.innerHTML = info + body;
  $('#delBtn').onclick = () => deleteTask(t, '/b');
}

// ---------- Переходы между экранами ----------
function router() {
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  window.scrollTo(0, 0);
  currentFormId = null;
  if (!p.length) return viewRoles();
  if (p[0] === 'e') {
    if (p[1] === 'tb') return p[2] === 'groups' ? viewTBGroups() : p[2] !== undefined ? viewTBChapter(+p[2], p[3]) : viewTB();
    if (p[1] === 'edit') return viewEdit('e', p[2]);
    return p[1] === 'task' ? viewTask(p[2], p[3] || 'brief', p[4]) : viewElList();
  }
  if (p[0] === 'b') {
    if (p[1] === 'new') return viewEdit('b');
    if (p[1] === 'edit') return viewEdit('b', p[2]);
    if (p[1] === 'task') return viewBossTask(p[2]);
    return viewBossList();
  }
  viewRoles();
}

(async () => {
  await openDB();
  await seed();
  renderNet();
  window.addEventListener('hashchange', router);
  router();
  syncPending();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
