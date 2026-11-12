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
    const r = indexedDB.open('electro', 2);
    // tasks — заявки, docs — наряды и информация для ознакомления
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('tasks')) d.createObjectStore('tasks', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs', { keyPath: 'id' });
    };
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });
}
const req = (mode, fn, store = 'tasks') => new Promise((res, rej) => {
  const r = fn(db.transaction(store, mode).objectStore(store));
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const docsAll = () => req('readonly', s => s.getAll(), 'docs');
const docGet = id => req('readonly', s => s.get(id), 'docs');
const docPut = d => req('readwrite', s => s.put(d), 'docs');
const docDel = id => req('readwrite', s => s.delete(id), 'docs');
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

// Пополняемые списки, которые запоминаются на телефоне: люди, приборы, объекты ЗУ, щиты
function getList(key) { try { return JSON.parse(lsGet(key) || '[]'); } catch (e) { return []; } }
function addToList(key, names) {
  const s = new Set(getList(key));
  names.filter(Boolean).forEach(n => s.add(n));
  lsSet(key, JSON.stringify([...s].sort((a, b) => a.localeCompare(b, 'ru'))));
}
const getStaff = () => getList('staff');
const removeFromList = (key, name) => lsSet(key, JSON.stringify(getList(key).filter(x => x !== name)));
// Должности людей (для подписей в протоколе)
const POSITIONS = ['Электромонтёр', 'Мастер ПС ГИ', 'Начальник ПС ГИ', 'Инженер'];
function staffPos(name) { try { return JSON.parse(lsGet('staffPos') || '{}')[name] || ''; } catch (e) { return ''; } }
function setStaffPos(name, pos) { let m = {}; try { m = JSON.parse(lsGet('staffPos') || '{}'); } catch (e) {} m[name] = pos; lsSet('staffPos', JSON.stringify(m)); }
const addStaff = names => addToList('staff', names);
// Запомненные значения (например, норма переходного сопротивления для типа выключателя и тока)
function memoGet(id, key) { try { return JSON.parse(lsGet('memo:' + id) || '{}')[key]; } catch (e) { return undefined; } }
function memoSet(id, key, val) {
  let m = {}; try { m = JSON.parse(lsGet('memo:' + id) || '{}'); } catch (e) {}
  m[key] = val; lsSet('memo:' + id, JSON.stringify(m));
}

// Примеры заявок для показа
async function seed() {
  if ((await dbAll()).length) return;
  const today = new Date().toISOString().slice(0, 10);
  const crew = { respHead: 'Сидоров В. Н.', foreman: 'Иванов С. П.', members: ['Петров А. В.'] };
  const base = { status: 'new', briefing: { checked: [] }, date: today, crew };
  const item = type => ({ type, values: {}, photos: [] });
  await dbPut({ ...base, id: 't1', number: 'З-101', created: Date.now() - 2000,
    object: 'ТП-12', address: 'п. Лесной, ул. Садовая, 3', equipment: '', comment: 'Испытания после ремонта.',
    items: [item('transformer'), item('p1_8_24'), item('grounding')] });
  await dbPut({ ...base, id: 't2', number: 'З-102', created: Date.now() - 1000,
    object: 'КТП-5', address: 'д. Берёзовка', equipment: '', comment: '', items: [item('grounding')] });
  addStaff(['Сидоров В. Н.', 'Иванов С. П.', 'Петров А. В.']);
  addToList('grObjects', ['КТПН', 'Скважина № 1', 'Скважина № 2', 'Станция управления', 'Шкаф КИПиА']);
  addToList('panels', ['ЩР-1', 'Шкаф управления', 'Шкаф освещения']);
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
// Название испытания (номер пункта ПУЭ — отдельно, мелко)
const typeName = type => WORK_TYPES[type]?.short || '—';
const typeCode = type => WORK_TYPES[type] ? `ПУЭ п. ${WORK_TYPES[type].code}` : '';

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
    : f.type === 'dyn' ? f.make(v) : [f]);
}
// Поля строки с полным названием: «ВН — положение 1: AB», единица — из конца названия строки
function rowChildren(f) {
  const i = f.label.lastIndexOf(', ');
  const name = i > 0 ? f.label.slice(0, i) : f.label, unit = i > 0 ? f.label.slice(i + 2) : '';
  return f.fields.map(c => ({ ...c, label: `${name}: ${c.label}`, unit }));
}
// Раздел виден, если подходит к выбранному оборудованию
const secVisible = (sec, v) => !sec.show || sec.show(v);
// Все поля протокола одним списком
function flatFields(wt, v) {
  return wt.form.filter(sec => secVisible(sec, v)).flatMap(sec => expand(sec.fields, v).flatMap(f => f.type === 'row' ? rowChildren(f) : [f]));
}
const missingOf = (wt, v) => flatFields(wt, v).filter(f => f.required && !String(v[f.id] ?? '').trim());
// Тексты норм ПУЭ и РД к пункту испытаний (раскрываются по нажатию)
// Строки «¦ a ¦ b» — строки таблицы, «⟦p⟧…» — текст с выравниванием пробелами (как в документе)
function paras(s) {
  const out = []; let tbl = [], pre = [];
  const flush = () => {
    if (tbl.length) { out.push(`<div class="ntbl"><table>${tbl.map((r, i) => `<tr>${r.map(c => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>`); tbl = []; }
    if (pre.length) {
      // Строки с числами, выровненные пробелами, — в таблицу; короткие подстрочные индексы («обм», «60») пропускаем
      const rows = pre.filter(l => l.trim().length > 5).map(l => l.trim().replace(/\s+,/g, ',').split(/\s{2,}/));
      out.push(rows.length && rows.every(r => r.length >= 3)
        ? `<div class="ntbl"><table>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>`
        : pre.map(l => `<p>${esc(l.trim().replace(/\s+/g, ' '))}</p>`).join(''));
      pre = [];
    }
  };
  for (const line of String(s).split('\n')) {
    if (line.startsWith('¦')) { if (pre.length) flush(); tbl.push(line.slice(1).split('¦').map(c => c.trim())); }
    else if (line.startsWith('⟦p⟧')) { if (tbl.length) flush(); pre.push(line.slice(3).replace(/\uE000/g, ' ')); }
    else { flush(); out.push(`<p>${esc(line)}</p>`); }
  }
  flush();
  return out.join('');
}
function normsHTML(wt, sec, v) {
  const N = wt && sec.ref && typeof NORMS !== 'undefined' ? NORMS[wt.code] : null;
  if (!N) return '';
  const pue = N.pue[sec.ref - 1], ri = N.map[sec.ref - 1], rd = ri >= 0 ? N.rd[ri] : null;
  if (!pue && !rd) return '';
  // Выбран вид испытаний — показываем нормы только для него
  const showP = v.mode !== 'M', showR = v.mode !== 'P';
  const blocks = [
    pue && showP ? `<h4>ПУЭ п. ${wt.code}, пункт ${sec.ref} — приёмо-сдаточные</h4>${paras(pue)}` : '',
    rd && showR ? `<h4>РД 34.45-51.300-97, п. ${rd.n} — в эксплуатации</h4>${paras(rd.t)}` : ''
  ].filter(Boolean);
  if (!blocks.length) return v.mode === 'M' ? '<p class="hint">В РД этого пункта нет.</p>' : '';
  const name = v.mode === 'P' ? 'Нормы ПУЭ' : v.mode === 'M' ? 'Нормы РД' : 'Нормы ПУЭ и РД';
  return `<details class="norms"><summary>📖 ${name}</summary>${blocks.join('')}</details>`;
}
function sectionInner(sec, v, ro, wt, noTitle) {
  return `${noTitle ? '' : `<h3>${esc(sec.title)}</h3>`}${sec.note && !ro ? `<p class="note">${esc(sec.note)}</p>` : ''}
    ${ro ? '' : normsHTML(wt, sec, v)}
    ${expand(sec.fields, v).map(f => fieldHTML(f, v, ro)).join('')}`;
}
const showVal = (f, val) => f.type === 'date' && val ? fmtDate(val) : optText(f, val);
const rowsOf = (v, id) => Array.isArray(v[id]) ? v[id] : [];

// Пополняемый список с галочками (приборы, объекты ЗУ) и, если нужно, колонками для значений
function checklistHTML(f, v, ro) {
  const sel = rowsOf(v, f.id), cols = f.cols || [];
  if (ro) {
    return `<div class="field"><span class="lbl">${esc(f.label)}</span>${sel.length ? sel.map((x, i) => `<div class="ro-val">${esc(x.name)}${
      cols.map(c => x[c.id] ? ` — ${esc(c.label)} ${esc(x[c.id])}` : '').join('')}</div>`).join('') : '<div class="ro-val">—</div>'}</div>`;
  }
  const names = [...new Set([...getList(f.store), ...sel.map(x => x.name)])];
  return `<div class="field cl" data-field="${f.id}"><span class="lbl">${esc(f.label)}</span>
    ${names.length ? '' : '<p class="hint">Список пока пуст. Добавьте первый пункт.</p>'}
    ${names.map(name => {
      const i = sel.findIndex(x => x.name === name);
      return `<div class="cl-row ${i >= 0 ? 'on' : ''}"><label class="cl-check"><input type="checkbox" data-cl="${f.id}" data-name="${esc(name)}" ${i >= 0 ? 'checked' : ''}><span>${esc(name)}</span></label>
        ${i >= 0 ? cols.map(c => `<div class="cl-col"><div class="inp-wrap has-unit"><input data-clv="${f.id}" data-i="${i}" data-col="${c.id}" inputmode="decimal" autocomplete="off"
          value="${esc(sel[i][c.id] ?? '')}"><span class="unit">${esc(c.label)}</span></div><span class="msg" data-msg="${f.id}|${i}|${c.id}"></span></div>`).join('') : ''}</div>`;
    }).join('')}
    <button type="button" class="btn ghost small" data-cladd="${f.id}">${esc(f.add || '+ Добавить')}</button></div>`;
}
// Таблица со строками, которые добавляют сами (щиты и автоматы для петли фаза-нуль)
function tableHTML(f, v, ro) {
  const rows = rowsOf(v, f.id);
  if (ro) {
    return `<div class="field"><span class="lbl">${esc(f.label)}</span>${rows.length ? rows.map(row => `<div class="ro-val">${
      f.cols.filter(c => c.type !== 'calc' && row[c.id]).map(c => `${esc(c.label)}: ${esc(row[c.id])}`).join(' · ')}</div>`).join('') : '<div class="ro-val">—</div>'}</div>`;
  }
  const cell = (c, row, i) => {
    const val = row[c.id] ?? '', data = `data-tv="${f.id}" data-i="${i}" data-col="${c.id}"`;
    let inp;
    if (c.type === 'calc') return `<div class="tcell calc-cell" data-calc="${f.id}|${i}|${c.id}"><span class="tl">${esc(c.label)}</span><span class="calc-val">—</span></div>`;
    if (c.type === 'pick') {
      const list = [...new Set([...getList(c.store), ...(val ? [val] : [])])];
      inp = `<select ${data}><option value="">—</option>${list.map(n => `<option ${n === val ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="__new">+ Новый…</option></select>`;
    } else if (c.type === 'select') {
      inp = `<select ${data}><option value="">—</option>${c.options.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else inp = `<input ${data} ${c.type === 'number' ? 'inputmode="decimal"' : ''} value="${esc(val)}" autocomplete="off">`;
    return `<div class="tcell"><span class="tl">${esc(c.label)}</span>${inp}</div>`;
  };
  return `<div class="field tbl" data-field="${f.id}"><span class="lbl">${esc(f.label)}</span>
    ${rows.map((row, i) => `<div class="trow"><div class="tgrid">${f.cols.map(c => cell(c, row, i)).join('')}</div>
      <span class="msg" data-msg="${f.id}|${i}|ik"></span>
      <button type="button" class="btn ghost small danger" data-trdel="${f.id}" data-i="${i}">Убрать строку</button></div>`).join('')}
    <button type="button" class="btn ghost small" data-tradd="${f.id}">${esc(f.add || '+ Добавить строку')}</button></div>`;
}

function fieldHTML(f, v, ro) {
  if (f.type === 'row') {
    return `<div class="row-wrap"><span class="lbl">${esc(f.label)}</span>
      <div class="row" style="--n:${f.fields.length}">${f.fields.map(c => fieldHTML(c, v, ro)).join('')}</div></div>`;
  }
  if (f.type === 'checklist') return checklistHTML(f, v, ro);
  if (f.type === 'table') return tableHTML(f, v, ro);
  if (f.type === 'reasons') return '<div class="reasons" data-reasons></div>';
  if (f.type === 'weather') {
    return ro ? '' : `<button type="button" class="btn ghost small wbtn" data-weather="1">🌤 Подтянуть погоду из интернета</button>
      <p class="hint">Температура, влажность и давление по месту, где вы сейчас. Если место не определится, приложение спросит населённый пункт. Без интернета введите вручную.</p>`;
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
    // signed — обычная клавиатура: на цифровой клавиатуре iPhone нет минуса, а здесь «+» и «−» есть
    input = `<div class="inp-wrap ${f.unit ? 'has-unit' : ''}">${''}<input data-f="${f.id}" ${f.type === 'number' && !f.signed ? 'inputmode="decimal"' : ''} ${f.signed ? 'placeholder="например, -5 или +12"' : ''}
      value="${esc(val)}" autocomplete="off">${f.unit ? `<span class="unit">${esc(f.unit)}</span>` : ''}</div>`;
  }
  const tag = 'label';
  return `<${tag} class="field" data-field="${f.id}"><span class="lbl">${esc(f.label)}${f.required && !ro ? ' <b class="req">*</b>' : ''}</span>
    ${input}${f.hint && !ro ? `<span class="hint">${esc(f.hint)}</span>` : ''}<span class="msg" data-msg="${f.id}"></span></${tag}>`;
}

// Где лежит поле: название раздела, пункт ПУЭ и подпись — для причин в заключении
function fieldIndex(wt, v) {
  const idx = {};
  for (const sec of wt.form) for (const f of expand(sec.fields, v)) {
    const list = f.type === 'row' ? rowChildren(f) : [f];
    for (const x of list) if (x.id) idx[x.id] = { sec, label: x.label || '' };
  }
  return idx;
}
// Причины, по которым установка не годна: что не в норме, пункт ПУЭ/РД, возможные причины, что требуется
function reasonsOf(wt, v, r = wt.check(v)) {
  const idx = fieldIndex(wt, v);
  return Object.entries(r).filter(([, x]) => x.ok === false).map(([id, x]) => {
    const where = idx[id.split('|')[0]] || {}, sec = where.sec;
    const ref = sec?.ref ? `${isRD(v) ? 'РД 34.45-51.300-97 / ' : ''}ПУЭ п. ${wt.code}, пункт ${sec.ref}` : `ПУЭ п. ${wt.code}`;
    const label = id.includes('|') ? '' : where.label;
    return { what: `${sec ? sec.title.replace(/^\d+\.\s*/, '') + ': ' : ''}${label ? label + ' — ' : ''}${x.value ? x.value + ', ' : ''}${x.msg}`, ref, why: x.why, need: x.need };
  });
}
function reasonsHTML(list) {
  if (!list.length) return '';
  return `<div class="reasons-box"><b>Установка не годна. Причины:</b><ol>${list.map(x => `<li>${esc(x.what)} <span class="ref">(${esc(x.ref)})</span>${
    x.why ? `<br><span class="why">Возможная причина: ${esc(x.why)}.</span>` : ''}${x.need ? `<br><span class="need">Требуется: ${esc(x.need)}.</span>` : ''}</li>`).join('')}</ol></div>`;
}

// Подсвечивает значения: зелёным — в норме, красным — вне нормы
// Оглавление протокола: пункты с отметкой — норма, не норма, заполнено или пусто
function secState(sec, v, r) {
  const ids = expand(sec.fields, v).flatMap(f => f.type === 'row' ? f.fields.map(c => c.id) : [f.id]).filter(Boolean);
  const res = Object.entries(r).filter(([k]) => ids.includes(k) || ids.includes(k.split('|')[0])).map(([, x]) => x.ok);
  if (res.includes(false)) return ['bad', '✗'];
  if (res.includes(true)) return ['ok', '✓'];
  const filled = ids.some(id => Array.isArray(v[id]) ? v[id].length : String(v[id] ?? '').trim());
  return filled ? ['fill', '•'] : ['empty', ''];
}
function applyChecks(box, wt, v) {
  const r = wt.check(v);
  box.querySelectorAll('[data-secmark]').forEach(m => { const [c, x] = secState(wt.form[+m.dataset.secmark], v, r); m.className = 'sec-m ' + c; m.textContent = x; });
  const rb = box.querySelector('[data-reasons]');
  if (rb) rb.innerHTML = reasonsHTML(reasonsOf(wt, v, r));
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
      <span><b>Электромонтёр</b><br><span class="meta">Заявки, инструктаж, протоколы испытаний</span>
      <span id="homeUnread"></span></span></button>
    <button class="card role" data-role="b"><span class="role-ic">📋</span>
      <span><b>Начальник</b><br><span class="meta">Новые заявки и полученные протоколы</span></span></button>
    <div class="tiles home-tiles" id="homeTiles"></div>
    <button class="btn ghost" id="reset">Сбросить демо-данные</button>`;
  app.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { location.hash = '/' + b.dataset.role; });
  counts().then(c => { const ht = $('#homeTiles');
    if (ht) ht.innerHTML = tile('#/h/docs/permit', '📄', 'Наряды') + tile('#/h/devices', '🧰', 'Приборы', c.dev) + tile('#/h/games', '🎮', 'Игры');
    const el = $('#homeUnread'); if (el && c.unread) el.innerHTML = `<br><span class="badge st-pending">📌 Не прочитано: ${c.unread}</span>`; });
  $('#reset').onclick = async () => {
    if (!confirm('Удалить все заявки и протоколы и вернуть примеры?')) return;
    await dbClear(); await seed(); toast('Демо-данные восстановлены');
  };
}

const byNew = (a, b) => (b.created || 0) - (a.created || 0);
// Список испытаний заявки с номерами протоколов
const testsHTML = t => `<ul class="tests">${t.items.map(i => `<li>${esc(typeName(i.type))}${
  i.skip ? ' — <b class="txt-warn">не проводилось</b>' : i.values.proto_no ? ` — протокол № <b>${esc(i.values.proto_no)}</b>` : ''}</li>`).join('')}</ul>`;
// Номер наряда вписывает монтёр в протоколе
const permitOf = t => t.permit || t.items.map(i => i.values.permit).find(Boolean) || '';
const permitHTML = t => permitOf(t) ? `Наряд-допуск / распоряжение № <b>${esc(permitOf(t))}</b><br>` : '';

// ---------- Фильтр заявок ----------
const FILTERS = [
  ['all', 'Все', t => true],
  ['work', 'В работе', t => t.status !== 'sent'],
  ['done', 'Выполнено', t => t.status === 'sent' && t.outcome !== 'notdone'],
  ['notdone', 'Не выполнялась', t => t.status === 'sent' && t.outcome === 'notdone']
];
let filterE = 'all', filterB = 'all';
function filterHTML(cur, tasks, archive) {
  const list = archive ? [...FILTERS, ['archive', 'Архив', t => t.archived]] : FILTERS;
  return `<div class="chips">${list.map(([k, l, fn]) => {
    const n = tasks.filter(t => k === 'archive' ? t.archived : !t.archived && fn(t)).length;
    return `<button class="chip ${k === cur ? 'on' : ''}" data-filter="${k}">${l} <span>${n}</span></button>`;
  }).join('')}</div>`;
}
const applyFilter = (tasks, k) => tasks.filter(t => !t.archived && (FILTERS.find(f => f[0] === k) || FILTERS[0])[2](t));
// Кто сейчас пользуется телефоном как монтёр (для отметки «Ознакомлен»)
const me = () => lsGet('me') || '';
// Старые документы с одной отметкой ackAt → список отметок
const acksOf = d => d.acks || (d.ackAt ? [{ name: '', at: d.ackAt }] : []);
const ackedBy = (d, name) => acksOf(d).some(a => !name || !a.name || a.name === name);
const today = () => new Date().toISOString().slice(0, 10);
// Поверка прибора: просрочена, скоро (30 дней) или в порядке
function verState(d) {
  if (!d.next) return ['', ''];
  const days = (new Date(d.next) - new Date(today())) / 864e5;
  return days < 0 ? ['bad', 'Поверка просрочена'] : days <= 30 ? ['warn', 'Скоро поверка'] : ['ok', 'Поверен'];
}
// Счётчики для напоминаний: непрочитанное, документы без отметок всех людей, приборы с поверкой
async function counts() {
  const docs = await docsAll();
  const info = docs.filter(d => d.kind === 'info');
  const unread = info.filter(d => !ackedBy(d, me())).length + quizPending();
  const people = getStaff().filter(n => !/начальник/i.test(staffPos(n)));
  const waiting = info.filter(d => people.some(n => !acksOf(d).some(a => a.name === n))).length;
  const dev = docs.filter(d => d.kind === 'device' && verState(d)[0] && verState(d)[0] !== 'ok').length;
  try { if (navigator.setAppBadge) unread ? navigator.setAppBadge(unread) : navigator.clearAppBadge(); } catch (e) {}
  return { unread, waiting, dev };
}
const tile = (href, ic, text, n) => `<a class="tile" href="${href}"><span>${ic}</span>${text}${n ? `<b class="tbadge">${n}</b>` : ''}</a>`;
// Куда «Назад» из общих разделов: с главного экрана (h) — на главный
const homeOf = role => role === 'h' ? '/' : '/' + role;
// Плитки разделов: информация, ТБ или бланк протокола
async function sectionsHTML(role) {
  const c = await counts();
  return `<div class="tiles">${tile(`#/${role}/docs/info`, '📌', 'Информация', role === 'e' ? c.unread : c.waiting)}
    ${role === 'e' ? tile('#/e/tb', '📕', 'Техника безопасности') : tile('#/b/settings', '⚙️', 'Бланк протокола')}</div>`;
}

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
  const all = (await dbAll()).sort(byNew);
  const tasks = applyFilter(all, filterE);
  const pending = all.filter(t => t.status === 'pending').length;
  const secHTML = await sectionsHTML('e');
  app.innerHTML = `
    ${secHTML}
    ${notifyBtnHTML()}
    <a class="btn accent" href="#/e/new">+ Новая заявка</a><div class="gap"></div>
    ${pending ? `<div class="banner warn">Не отправлено: <b>${pending}</b>. Уйдёт само, когда появится интернет.</div>` : ''}
    ${filterHTML(filterE, all)}
    ${tasks.length ? tasks.map(t => {
      const [sl, sc] = stOf(t);
      return `<a class="card task" href="#/e/task/${t.id}">
        <div class="top-line"><span>${esc(t.number)} · ${fmtDate(t.date)}</span><span class="badge ${sc}">${sl}</span></div>
        <div class="obj">${esc(t.object)}</div>
        <p class="meta">${t.address ? esc(t.address) + '<br>' : ''}${permitHTML(t)}</p>${testsHTML(t)}</a>`;
    }).join('') : '<div class="card meta">Здесь заявок нет.</div>'}`;
  bindNotifyBtn();
  app.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filterE = b.dataset.filter; viewElList(); });
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
      ${t.status === 'sent' || t.status === 'pending' ? testsHTML(t) : `<ul class="tests ctl">${t.items.map((i, j) => `<li><span>${esc(typeName(i.type))}${
        i.skip ? ` — <b class="txt-warn">не выполнялось</b>${i.reason ? ' (' + esc(i.reason) + ')' : ''}` : ''}</span>
        <button type="button" class="btn ghost small" data-skip="${j}">${i.skip ? 'Вернуть' : 'Не выполнялось'}</button></li>`).join('')}</ul>`}
      ${t.outcome === 'notdone' ? `<div class="banner warn mt">Работа не выполнялась. Причина: ${esc(t.reason)}</div>` : ''}
      <div class="actions">
        <a class="btn ghost small" href="#/e/edit/${id}">✎ Изменить</a>
        <button class="btn ghost small danger" id="delBtn">Удалить</button>
        ${t.status === 'sent'
          ? `<button class="btn ghost small wide" id="reopenBtn">Вернуть в работу</button>`
          : t.status !== 'pending' ? `<button class="btn ghost small wide" id="notDoneBtn">Вся заявка не выполнялась</button>` : ''}
      </div>
    </div>
    <nav class="tabs">${tabs.map(([key, l]) => `<a href="#/e/task/${id}/${key}" class="${key === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>
    <div id="tab"></div>`;
  $('#delBtn').onclick = () => deleteTask(t, '/e');
  app.querySelectorAll('[data-skip]').forEach(b => b.onclick = async () => {
    const it = t.items[+b.dataset.skip];
    if (!it.skip) {
      const reason = prompt(`Почему не выполнялось «${typeName(it.type)}»?`);
      if (reason === null) return;
      it.skip = true; it.reason = reason.trim() || 'не указана';
    } else { it.skip = false; it.reason = ''; }
    if (t.status === 'briefed') t.status = 'draft';
    await dbPut(t); router();
  });
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
  miss.forEach(f => { const el = box.querySelector(`[data-field="${f.id}"]`); if (el) { el.classList.add('missing'); const d = el.closest('details.sec'); if (d) d.open = true; } });
  if (miss.length) setTimeout(() => box.querySelector(`[data-field="${miss[0].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  return miss.length;
}

// Следующий номер протокола: «15» → «16», «П-15» → «П-16»
function shiftNo(val, d) {
  const m = String(val).match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return val;
  const n = +m[2] + d;
  return n > 0 ? m[1] + String(n).padStart(m[2].length, '0') + m[3] : val;
}
// Переносит номер протокола, дату, наряд, вид испытаний и погоду из протокола k в остальные (если там пусто или стоит прежнее перенесённое значение)
function shareValues(t, k, id, oldVal) {
  const val = t.items[k].values[id];
  // Номера идут подряд, невыполненные испытания пропускаем
  const pos = i => t.items.slice(0, i).filter(x => !x.skip).length;
  t.items.forEach((x, j) => {
    if (j === k || x.skip) return;
    const d = pos(j) - pos(k);
    const auto = id === 'proto_no' ? (oldVal ? shiftNo(oldVal, d) : '') : oldVal;
    const cur = x.values[id];
    if (cur === undefined || cur === '' || cur === auto) x.values[id] = id === 'proto_no' ? shiftNo(val, d) : val;
  });
}
const isShared = id => id === 'proto_no' || SHARED_FIELDS.includes(id);
// Заключение ставится само по проверкам, пока его не поменяли вручную
function autoConclusion(wt, v) {
  if (v.concl_manual) return;
  const r = wt.check(v), bad = Object.values(r).some(x => x.ok === false), good = Object.values(r).some(x => x.ok === true);
  if (bad) v.conclusion = 'Не годна к эксплуатации';
  else if (good) v.conclusion = 'Годна к эксплуатации';
}
// Подставляет запомненные значения (норма выключателя по типу и току)
function applyMemo(wt, v) {
  for (const f of flatFields(wt, v)) {
    if (!f.memo || String(v[f.id] ?? '').trim()) continue;
    const key = f.memo.map(m => v[m] || '').join('|');
    const val = f.memo.every(m => v[m]) && memoGet(f.id, key);
    if (val) v[f.id] = val;
  }
}

const openSecs = {};
// Изначально развёрнуты: «Протокол», заполненные пункты и заключение
function isSecOpen(t, k, i, wt, v) {
  const key = t.id + '|' + k;
  if (openSecs[key]) return openSecs[key].has(i);
  const r = wt.check(v);
  return i === 0 || i === wt.form.length - 1 || secState(wt.form[i], v, r)[0] !== 'empty';
}
function secCardHTML(t, k, i, sec, v, ro, wt) {
  return `<details class="card sec" data-sec="${i}" ${isSecOpen(t, k, i, wt, v) ? 'open' : ''}><summary><span class="sec-m" data-secmark="${i}"></span><span class="sec-t">${esc(sec.title)}</span></summary>
    <div class="sec-body">${sectionInner(sec, v, ro, wt, true)}</div></details>`;
}
function renderForm(box, t, k) {
  if (!t.items.length) { box.innerHTML = '<div class="card meta">В заявке нет испытаний. Нажмите «Изменить», чтобы добавить.</div>'; return; }
  k = Math.min(Math.max(0, k), t.items.length - 1);
  const it = t.items[k], wt = WORK_TYPES[it.type], v = it.values;
  currentFormId = t.id;
  const ro = t.status === 'pending' || t.status === 'sent';
  const n = t.items.length;
  if (!ro) { applyMemo(wt, v); autoConclusion(wt, v); }
  let html = '';
  if (n > 1) html += `<div class="subtabs">${t.items.map((x, j) => {
    const mark = x.skip ? '— ' : !missingOf(WORK_TYPES[x.type], x.values).length ? '✓ ' : '';
    return `<a href="#/e/task/${t.id}/form/${j}" class="${j === k ? 'active' : ''}">${mark}${j + 1}. ${esc(typeName(x.type))}</a>`;
  }).join('')}</div>`;
  if (n > 1) swipeNav = { prev: k > 0 ? `/e/task/${t.id}/form/${k - 1}` : null, next: k < n - 1 ? `/e/task/${t.id}/form/${k + 1}` : null };
  if (t.status === 'new') html += `<div class="banner warn">Сначала пройдите инструктаж. Без него протоколы не отправятся.</div>`;
  if (t.status === 'pending') html += `<div class="banner warn">Сохранено на телефоне и ждёт интернета. Отправится само.</div>`;
  if (t.status === 'sent') html += `<div class="banner ok">Отправлено ${fmtDT(t.sentAt)}. Начальник видит.</div>`;
  html += `<div class="card proto-head"><span class="meta">Протокол ${k + 1} из ${n} · ${esc(typeCode(it.type))}</span><h3>${esc(typeName(it.type))}</h3>
    ${ro ? '' : it.skip ? `<button class="btn ghost small mt" id="unskipBtn">Вернуть испытание</button>`
      : `<button class="btn ghost small mt" id="skipBtn">Это испытание не выполнялось</button>`}</div>`;
  // После отправки номер протокола можно вписать или исправить (его дают при регистрации на базе)
  if (ro && t.status === 'sent' && !it.skip) html += `<div class="card"><label class="field"><span class="lbl">Номер протокола</span>
    <input id="noEdit" value="${esc(v.proto_no)}" autocomplete="off"></label><button class="btn ghost small" id="noSave">Сохранить номер</button></div>`;
  if (it.skip) {
    html += `<div class="banner warn">Испытание не проводилось. Причина: ${esc(it.reason)}</div>`;
  } else {
    html += '<p class="meta sec-tip">Нажмите на пункт, чтобы развернуть или свернуть.</p>';
    html += wt.form.map((sec, i) => secVisible(sec, v) ? secCardHTML(t, k, i, sec, v, ro, wt) : '').join('');
    html += `<div class="card" data-sec="photos"><h3>Фото с объекта</h3><div id="photos">${photosHTML(it.photos, ro)}</div>
      ${ro ? '' : `<div class="actions">
        <label class="btn ghost file-btn">📷 Сфотографировать<input type="file" accept="image/*" capture="environment" class="photoInp"></label>
        <label class="btn ghost file-btn">🖼 Из галереи<input type="file" accept="image/*" multiple class="photoInp"></label></div>`}</div>`;
  }
  if (!it.skip) html += `<a class="btn ghost" href="#/e/paper/${t.id}/${k}">👁 Как будет выглядеть протокол</a>`;
  if (k < n - 1) html += `<a class="btn ghost" href="#/e/task/${t.id}/form/${k + 1}">Дальше: ${esc(typeName(t.items[k + 1].type))}</a>`;
  if (!ro) html += `<div class="sticky-actions"><div class="inner"><button class="btn accent" id="sendBtn">Выполнено — отправить ${n > 1 ? `протоколы (${n})` : 'протокол'}</button></div></div>`;
  box.innerHTML = html;
  if (!it.skip) applyChecks(box, wt, v);
  // Запоминаем, какие пункты развёрнуты
  box.addEventListener('toggle', e => {
    if (!e.target.classList?.contains('sec')) return;
    const key = t.id + '|' + k;
    if (!openSecs[key]) openSecs[key] = new Set(wt.form.map((_, i) => i).filter(i => isSecOpen(t, k, i, wt, v)));
    openSecs[key][e.target.open ? 'add' : 'delete'](+e.target.dataset.sec);
  }, true);
  const noSave = $('#noSave');
  if (noSave) noSave.onclick = async () => {
    const old = v.proto_no;
    v.proto_no = $('#noEdit').value.trim();
    shareValues(t, k, 'proto_no', old);
    t.editedAt = Date.now();
    await dbPut(t); toast('Номер протокола сохранён'); router();
  };
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
  const secIndexOf = id => wt.form.findIndex(sec => expand(sec.fields, v).some(f => f.id === id || (f.type === 'row' && f.fields.some(c => c.id === id))));
  const redrawSec = i => {
    const card = box.querySelector(`[data-sec="${i}"]`);
    const body = card?.querySelector('.sec-body');
    if (body) { const open = body.querySelector('details.norms')?.open; body.innerHTML = sectionInner(wt.form[i], v, false, wt, true); if (open) body.querySelector('details.norms').open = true; }
  };
  const redrawSecOf = id => redrawSec(secIndexOf(id));
  // Обновить проверки и заключение после любого изменения
  const refresh = () => {
    const before = v.conclusion;
    autoConclusion(wt, v);
    if (v.conclusion !== before) { const s = box.querySelector('[data-f="conclusion"]'); if (s) s.value = v.conclusion; }
    applyChecks(box, wt, v);
    save();
  };
  const setVal = (id, val) => {
    const old = v[id];
    v[id] = val;
    if (isShared(id)) shareValues(t, k, id, old);
    if (id === 'conclusion') v.concl_manual = '1';
    // Запомнить значение (норма выключателя по типу и току)
    const f = flatFields(wt, v).find(x => x.id === id);
    if (f?.memo && f.memo.every(m => v[m])) memoSet(id, f.memo.map(m => v[m]).join('|'), val);
    // Сменили тип или ток — подставить запомненную норму
    const dep = flatFields(wt, v).filter(x => x.memo?.includes(id));
    if (dep.length) { dep.forEach(d => { v[d.id] = ''; }); applyMemo(wt, v); dep.forEach(d => { const el = box.querySelector(`[data-f="${d.id}"]`); if (el) el.value = v[d.id] ?? ''; }); }
  };
  const onInput = e => {
    const el = e.target, id = el.dataset.f;
    // Значения в списке с галочками
    if (el.dataset.clv) {
      const row = rowsOf(v, el.dataset.clv)[+el.dataset.i];
      if (row) { row[el.dataset.col] = el.value; refresh(); }
      return;
    }
    // Ячейки таблицы
    if (el.dataset.tv) {
      const row = rowsOf(v, el.dataset.tv)[+el.dataset.i];
      if (!row) return;
      if (el.value === '__new') {
        const c = flatFields(wt, v).find(x => x.id === el.dataset.tv).cols.find(c => c.id === el.dataset.col);
        const name = (prompt(c.ask || 'Название') || '').trim();
        if (name) { addToList(c.store, [name]); row[el.dataset.col] = name; }
        redrawSecOf(el.dataset.tv);
      } else row[el.dataset.col] = el.value;
      refresh();
      return;
    }
    if (!id) return;
    setVal(id, el.value);
    if (flatFields(wt, v).some(x => x.id === id && x.reform) || wt.form.some(sec => sec.fields.some(x => x.id === id && x.reform))) {
      const y = scrollY;
      save().then(() => viewTask(t.id, 'form', k)).then(() => scrollTo(0, y));
      return;
    }
    el.closest('.field')?.classList.remove('missing');
    // Поменяли число строк, вид испытаний или знак — перерисовываем раздел
    const card = el.closest('[data-sec]');
    const sec = card && wt.form[+card.dataset.sec];
    if (sec && sec.fields.some(f => f.id === id && f.rerender)) redrawSec(+card.dataset.sec);
    if (id === 'mode') wt.form.forEach((s, i) => s.ref && redrawSec(i));
    if (/^[+-]?$/.test(el.value) || el.closest('.has-sign')) {
      const w = el.closest('.has-sign');
      if (w) { const neg = el.value.trim().startsWith('-'); w.querySelectorAll('.sign').forEach(b => b.classList.toggle('on', el.value !== '' && (b.dataset.s === '-') === neg)); }
    }
    refresh();
  };
  box.addEventListener('input', onInput);
  box.addEventListener('change', e => {
    const el = e.target;
    // Выпадающие списки: на старых iPhone приходит только change, без input
    if (el.isConnected && el.tagName === 'SELECT') {
      if (el.dataset.f && String(v[el.dataset.f] ?? '') !== el.value) return onInput(e);
      if (el.dataset.tv && String(rowsOf(v, el.dataset.tv)[+el.dataset.i]?.[el.dataset.col] ?? '') !== el.value) return onInput(e);
    }
    // Галочка в списке: отметить или снять
    if (el.dataset.cl) {
      const id = el.dataset.cl, name = el.dataset.name;
      const rows = rowsOf(v, id).slice();
      const i = rows.findIndex(x => x.name === name);
      if (el.checked && i < 0) rows.push({ name });
      if (!el.checked && i >= 0) rows.splice(i, 1);
      v[id] = rows;
      redrawSecOf(id); refresh();
    }
  });
  box.addEventListener('click', async e => {
    // Кнопки «+» и «−» перед числом
    const sb = e.target.closest('[data-sign]');
    if (sb) {
      e.preventDefault();
      const id = sb.dataset.sign, inp = box.querySelector(`[data-f="${id}"]`);
      const body = String(v[id] ?? '').trim().replace(/^[+-]/, '');
      setVal(id, sb.dataset.s + body);
      inp.value = v[id];
      sb.parentNode.querySelectorAll('.sign').forEach(b => b.classList.toggle('on', b === sb));
      if (!body) inp.focus();
      refresh();
      return;
    }
    // Добавить пункт в пополняемый список
    const ca = e.target.closest('[data-cladd]');
    if (ca) {
      const f = flatFields(wt, v).find(x => x.id === ca.dataset.cladd);
      const name = (prompt(f.ask || 'Что добавить?') || '').trim();
      if (!name) return;
      addToList(f.store, [name]);
      const rows = rowsOf(v, f.id).slice();
      if (!rows.some(x => x.name === name)) rows.push({ name });
      v[f.id] = rows;
      redrawSecOf(f.id); refresh();
      return;
    }
    // Строки таблицы
    const ta = e.target.closest('[data-tradd]'), td = e.target.closest('[data-trdel]');
    if (ta || td) {
      const id = (ta || td).dataset[ta ? 'tradd' : 'trdel'];
      const rows = rowsOf(v, id).slice();
      if (ta) { const last = rows[rows.length - 1]; rows.push(last ? { panel: last.panel } : {}); }
      else rows.splice(+td.dataset.i, 1);
      v[id] = rows;
      redrawSecOf(id); refresh();
      return;
    }
    if (e.target.closest('[data-weather]')) {
      const btn = e.target.closest('[data-weather]');
      btn.disabled = true; btn.textContent = 'Определяем место и погоду…';
      try {
        const w = await fetchWeather();
        for (const [id, val] of Object.entries(w.values)) setVal(id, val);
        redrawSecOf('temp_air'); refresh();
        toast(`Погода заполнена${w.place ? ': ' + w.place : ''}`);
      } catch (err) {
        toast(err.message || 'Не удалось получить погоду. Введите вручную');
        btn.disabled = false; btn.textContent = '🌤 Подтянуть погоду из интернета';
      }
    }
  });

  if (!v.temp_air && isOnline() && !autoWeatherDone.has(t.id + '|' + k)) {
    autoWeatherDone.add(t.id + '|' + k);
    fetchWeather(true).then(w => {
      if (currentFormId !== t.id || v.temp_air) return;
      for (const [id, val] of Object.entries(w.values)) setVal(id, val);
      redrawSecOf('temp_air'); refresh();
      toast(`Погода заполнена${w.place ? ': ' + w.place : ''}`);
    }).catch(() => {});
  }
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

const autoWeatherDone = new Set();
// Погода: место по телефону, а если не получилось — по населённому пункту (запоминается). Сервис Open-Meteo работает в России без VPN.
const getPos = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error('нет геолокации'));
  navigator.geolocation.getCurrentPosition(p => res(p.coords), rej, { timeout: 10000, maximumAge: 1800000, enableHighAccuracy: false });
});
async function cityCoords(askAgain, quiet) {
  let city = askAgain ? '' : lsGet('weatherCity') || '';
  if (!city && quiet) throw new Error('нет города');
  if (!city) city = (prompt('Не удалось определить место по телефону. Введите населённый пункт (например, Сургут):', lsGet('weatherCity') || '') || '').trim();
  if (!city) throw new Error('Населённый пункт не указан. Введите погоду вручную');
  const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`)).json();
  const p = g.results?.[0];
  if (!p) { lsSet('weatherCity', ''); throw new Error(`Не нашли «${city}». Попробуйте ещё раз`); }
  lsSet('weatherCity', city);
  return { latitude: p.latitude, longitude: p.longitude, place: p.name };
}
async function fetchWeather(quiet) {
  if (!isOnline()) throw new Error('Нет интернета. Введите погоду вручную');
  let c, place = '';
  try { c = await getPos(); } catch (e) {
    try { c = await cityCoords(false, quiet); place = c.place; } catch (err) {
      if (/Не нашли/.test(err.message)) throw err;
      throw new Error(err.message && !/fetch/i.test(err.message) ? err.message : 'Сервис погоды не ответил. Введите вручную');
    }
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.latitude.toFixed(3)}&longitude=${c.longitude.toFixed(3)}&current=temperature_2m,relative_humidity_2m,surface_pressure`;
    const w = (await (await fetch(url)).json()).current;
    const tC = Math.round(w.temperature_2m);
    return { place, values: {
      temp_air: (tC > 0 ? '+' : '') + tC,
      humidity: String(Math.round(w.relative_humidity_2m)),
      pressure: String(Math.round(w.surface_pressure * 0.750062)) // гПа → мм рт. ст.
    }};
  } catch (e) { throw new Error('Сервис погоды не ответил. Введите вручную'); }
}

// ---------- Создание и изменение заявки (общее для обеих ролей) ----------
async function viewEdit(role, id) {
  const old = id ? await dbGet(id) : null;
  if (id && !old) { location.hash = '/' + role; return; }
  const back = id ? `/${role}/task/${id}` : `/${role}`;
  header(id ? `Изменить ${old.number}` : 'Новая заявка', back);
  const t = old || { date: new Date().toISOString().slice(0, 10), items: [{ type: '', values: {}, photos: [] }],
    crew: { respHead: '', foreman: '', members: [''] } };
  const items = t.items.map(i => ({ ...i }));
  const crew = { ...t.crew, members: [...(t.crew.members || [])] };
  if (!crew.members.length) crew.members.push('');

  const typeOpts = sel => `<option value="">— выберите испытание —</option>` +
    Object.entries(WORK_TYPES).map(([key, w]) => `<option value="${key}" ${key === sel ? 'selected' : ''}>${esc(w.short)}</option>`).join('');
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
    <label class="field"><span class="lbl">Оборудование</span><input name="equipment" value="${esc(t.equipment)}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Дата</span><input type="date" name="date" value="${esc(t.date)}"></label>
    <h3 class="mt">Исполнители</h3>
    <div id="crew"></div>
    <details class="people"><summary>👥 Список людей: должности, удалить ошибочного</summary><div id="ppl"></div></details>
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
  const pplBox = $('#ppl');
  const drawPeople = () => {
    const staff = getStaff();
    pplBox.innerHTML = (staff.length ? staff.map(n => `<div class="person"><b>${esc(n)}</b>
      <select data-pos="${esc(n)}"><option value="">— должность —</option>${[...new Set([...POSITIONS, staffPos(n)].filter(Boolean))].map(p => `<option ${p === staffPos(n) ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
      <button type="button" class="x" data-pdel="${esc(n)}" aria-label="Удалить">×</button></div>`).join('') : '<p class="hint">Список пуст.</p>') +
      '<button type="button" class="btn ghost small" id="addPerson">+ Добавить человека</button>';
    $('#addPerson').onclick = () => { const n = (prompt('Фамилия и инициалы') || '').trim(); if (n) { addStaff([n]); drawPeople(); drawCrew(); } };
  };
  pplBox.onchange = e => { if (e.target.dataset.pos !== undefined) { setStaffPos(e.target.dataset.pos, e.target.value); toast('Должность сохранена'); } };
  pplBox.onclick = e => {
    const n = e.target.dataset.pdel;
    if (n === undefined || !confirm(`Удалить «${n}» из списка людей?`)) return;
    removeFromList('staff', n);
    ROLES.forEach(([k]) => { if (crew[k] === n) crew[k] = ''; });
    crew.members = crew.members.map(m => m === n ? '' : m);
    drawPeople(); drawCrew();
  };
  drawTests(); drawCrew(); drawPeople();
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
      object: fd.object.trim(), address: fd.address.trim(), equipment: fd.equipment.trim(), date: fd.date, comment: fd.comment.trim(),
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

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function bossCard(t) {
  const [sl, sc] = bossStatus(t);
  const notOk = t.status === 'sent' && t.outcome !== 'notdone' && t.items.some(i => !i.skip && i.values.conclusion && !isFit(i.values));
  return `<a class="card task" href="#/b/task/${t.id}">
    <div class="top-line"><span>${esc(t.number)} · ${fmtDate(t.date)}</span>
      <span>${notOk ? '<span class="badge st-pending">Не годна</span> ' : ''}<span class="badge ${sc}">${sl}</span></span></div>
    <div class="obj">${esc(t.object)}</div>
    <p class="meta">${esc(crewNames(t).join(', ') || 'Исполнители не назначены')}</p>${testsHTML(t)}</a>`;
}
// Архив: папки по годам, внутри — по месяцам
function archiveHTML(tasks) {
  const list = tasks.filter(t => t.archived);
  if (!list.length) return '<div class="card meta">В архиве пока пусто. Выполненную заявку можно отправить в архив кнопкой «В архив».</div>';
  const when = t => new Date(t.sentAt || t.date || t.created);
  const years = {};
  for (const t of list) { const d = when(t); ((years[d.getFullYear()] ||= {})[d.getMonth()] ||= []).push(t); }
  return Object.keys(years).sort((a, b) => b - a).map((y, yi) => `<details class="folder" ${yi === 0 ? 'open' : ''}><summary>📁 ${y} <span>${Object.values(years[y]).flat().length}</span></summary>
    ${Object.keys(years[y]).sort((a, b) => b - a).map(m => `<details class="folder sub"><summary>📂 ${MONTHS[m]} <span>${years[y][m].length}</span></summary>
      ${years[y][m].map(bossCard).join('')}</details>`).join('')}</details>`).join('');
}

async function viewBossList() {
  header('Заявки и протоколы', '/');
  const all = (await dbAll()).sort(byNew);
  const secHTML = await sectionsHTML('b');
  app.innerHTML = `
    ${secHTML}
    <a class="btn accent" href="#/b/new">+ Новая заявка</a><div class="gap"></div>${notifyBtnHTML()}
    ${filterHTML(filterB, all, true)}
    ${filterB === 'archive' ? archiveHTML(all) : (applyFilter(all, filterB).map(bossCard).join('') || '<div class="card meta">Здесь заявок нет.</div>')}`;
  bindNotifyBtn();
  app.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filterB = b.dataset.filter; viewBossList(); });
}

// Строки отчёта для списка с галочками и таблицы
function listRows(f, v, r) {
  const rows = rowsOf(v, f.id);
  if (f.type === 'checklist') return rows.map((x, i) => [x.name, (f.cols || []).map(c => x[c.id] ? `${c.label.replace(/,.*/, '')} = ${x[c.id]}${/,/.test(c.label) ? ' ' + c.label.split(', ')[1] : ''}` : '').filter(Boolean).join('; ') || '✓', `${f.id}|${i}|${(f.cols || [])[0]?.id}`]);
  return rows.map((x, i) => [[x.panel, x.qf].filter(Boolean).join(', ') || `Строка ${i + 1}`,
    [x.ch && x.in ? `${x.ch}${x.in} А` : '', r[`${f.id}|${i}|ireq`]?.value ? `Iкз треб. = ${r[`${f.id}|${i}|ireq`].value} А` : '', x.z ? `Z = ${x.z} Ом` : '', r[`${f.id}|${i}|ik`]?.value ? `Iкз = ${r[`${f.id}|${i}|ik`].value} А` : ''].filter(Boolean).join(', '), `${f.id}|${i}|ik`]);
}
function protocolHTML(it, k, n, inner) {
  if (it.skip) return `<div class="proto-block"><div class="card proto-head"><span class="meta">Протокол ${k + 1} из ${n} · ${esc(typeCode(it.type))}</span>
    <h3>${esc(typeName(it.type))}</h3></div><div class="banner warn">Испытание не проводилось. Причина: ${esc(it.reason)}</div></div>`;
  const wt = WORK_TYPES[it.type], v = it.values, r = wt.check(v);
  const markOk = id => r[id] && r[id].ok != null ? `<span class="${r[id].ok ? 'mark-ok' : 'mark-bad'}" title="${esc(r[id].msg)}">${r[id].ok ? '✓' : '✗'}</span>` : '';
  const secs = wt.form.filter(sec => secVisible(sec, v) && !(inner && (sec === wt.form[0] || sec.title === 'Заключение'))).map(sec => {
    const rows = expand(sec.fields, v).flatMap(f => {
      if (f.type === 'calc') return r[f.id]?.value ? [[f.label, r[f.id].value, f.id]] : [];
      if (f.type === 'checklist' || f.type === 'table') return listRows(f, v, r);
      if (!f.id && f.type !== 'row') return [];
      const list = f.type === 'row' ? rowChildren(f) : [f];
      return list.filter(x => String(v[x.id] ?? '').trim()).map(x => [x.label, showVal(x, v[x.id]) + (x.unit ? ' ' + x.unit : ''), x.id]);
    });
    if (!rows.length) return '';
    return `<div class="${inner ? 'pres' : 'card'}"><h3>${esc(sec.title)}</h3><table class="res">${rows.map(([l, val, id]) =>
      `<tr><td>${esc(l)}</td><td>${esc(val)}</td><td>${markOk(id)}</td></tr>`).join('')}</table></div>`;
  }).join('');
  if (inner) return secs;
  const reasons = reasonsOf(wt, v, r);
  return `<div class="proto-block">
    <div class="card proto-head"><span class="meta">Протокол ${k + 1} из ${n} · ${esc(typeCode(it.type))}</span>
      <h2>Протокол № ${esc(v.proto_no || '—')}${v.proto_date ? ' от ' + fmtDate(v.proto_date) : ''}</h2>
      <p class="meta">${esc(typeName(it.type))}${v.mode ? ' · ' + esc(optText({ options: MODES }, v.mode)) : ''}</p></div>
    ${reasons.length ? reasonsHTML(reasons) : `<div class="banner ok">Все проверенные значения в норме.</div>`}
    ${secs}<div class="card"><h3>Фото с объекта</h3>${photosHTML(it.photos, true)}</div></div>`;
}

// ---------- Протокол как на бумаге (лист А4) ----------
// Шапка организации, методики и тексты пунктов хранятся только на этом телефоне (сайт открыт всем — в код их не пишем)
const BLANK_DEF = {
  org: '', lab: '', checkerPos: 'Начальник ПС ГИ', checker: '', approved: '',
  p2: 'Протокол распространяется только на испытанное (измеренное) оборудование.',
  p3: 'Протокол не может быть полностью или частично перепечатан без разрешения электролаборатории.',
  p7: 'На каждом листе протокола ставится печать.',
  methods: { '1.8.39': '№ 22', '1.8.16': '№ 4', '1.8.22': '№ 8', '1.8.19': '№ 7', '1.8.40': '№ 23', '1.8.31': '№ 15', '1.8.18': '№ 6', '1.8.17': '№ 5', '1.8.30': '№ 14', '1.8.15': '№ 3' }
};
function blank() { let b = {}; try { b = JSON.parse(lsGet('blank') || '{}'); } catch (e) {} return { ...BLANK_DEF, ...b, methods: { ...BLANK_DEF.methods, ...(b.methods || {}) } }; }
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const longDate = d => { if (!d) return '«___» __________ 20__ г.'; const x = new Date(d); return `«${String(x.getDate()).padStart(2, '0')}» ${MONTHS_GEN[x.getMonth()]} ${x.getFullYear()} г.`; };
const blankOr = (val, hint) => val ? esc(val) : `<span class="empty-set">${hint}</span>`;
// Поля раздела (для норм в таблице «Показатели и нормативные данные»)
const secIds = (sec, v) => expand(sec.fields, v).flatMap(f => f.type === 'row' ? f.fields.map(c => c.id) : [f.id]).filter(Boolean);
function normText(sec, v, r) {
  const ids = secIds(sec, v), out = new Set();
  for (const [k, x] of Object.entries(r)) {
    if (!ids.includes(k) && !ids.includes(k.split('|')[0])) continue;
    const m = String(x.msg || '').match(/норм[аы]\s+([^;(]+)/i);
    if (m) out.add(m[1].replace(/^(не более|не менее)?\s*/, (a) => a).trim());
  }
  return [...out].slice(0, 3).join('; ');
}
function paperHTML(t, it, k) {
  const b = blank(), wt = WORK_TYPES[it.type], v = it.values, r = wt.check(v);
  const N = typeof NORMS !== 'undefined' ? NORMS[wt.code] : null;
  // Пункт НД: по выбранному виду испытаний; если вид не выбран — оба документа
  const ndRef = sec => {
    if (!sec.ref) return '';
    const ri = N?.map[sec.ref - 1], rd = ri >= 0 ? `РД 34.45-51.300-97 п. ${N.rd[ri].n}` : '', pue = `ПУЭ п. ${wt.code}, пункт ${sec.ref}`;
    return v.mode === 'M' ? rd || pue : v.mode === 'P' ? pue : [pue, rd].filter(Boolean).join('; ');
  };
  const ndVal = sec => (typeof sec.nd === 'function' ? sec.nd(v) : sec.nd) || normText(sec, v, r) || 'по инструкции завода-изготовителя';
  const secs = wt.form.filter(sec => sec.ref && secVisible(sec, v));
  const ndRows = secs.map(sec => [sec.title.replace(/^\d+\.\s*/, ''), ndRef(sec), ndVal(sec)]);
  // Результаты — те же строки, что в кратком отчёте
  const results = protocolHTML(it, k, t.items.length, true);
  const devs = rowsOf(v, 'devices');
  const recs = paperDevices || [];
  const devRows = devs.map(x => { const d = recs.find(d => devLabel(d) === x.name) || {};
    return [d.name || x.name, d.no || '', d.range || '', d.acc || '', d.cert || '', [d.date && fmtDate(d.date), d.next && fmtDate(d.next)].filter(Boolean).join(' / ')]; });
  const people = crewNames(t);
  const climate = [v.temp_air && `температура воздуха ${v.temp_air} °C`, v.humidity && `влажность ${v.humidity} %`, v.pressure && `давление ${v.pressure} мм рт. ст.`].filter(Boolean).join(', ');
  const eq = [v.tr_type, v.m_type, v.vb_type, v.cab_mark, v.eq_type].find(Boolean) || '';
  const reasons = reasonsOf(wt, v, r);
  return `<div class="paper">
    <div class="ph-top"><div class="ph-org">${b.org ? esc(b.org).replace(/\n/g, '<br>') : '<span class="empty-set">Шапка организации — заполните в разделе «Бланк протокола»</span>'}
      ${b.lab ? '<br>' + esc(b.lab).replace(/\n/g, '<br>') : ''}</div>
      <div class="ph-obj">Объект: <b>${esc(t.object)}</b>${t.address ? '<br>' + esc(t.address) : ''}</div></div>
    <p>Дата испытания (измерения): ${longDate(v.proto_date || t.date)}</p>
    <h2 class="pc">ПРОТОКОЛ № ${blankOr(v.proto_no, '____')}</h2>
    <p class="pc"><b>${esc(wt.title)}</b>${eq ? '<br>' + esc(eq) + (v.serial ? ', зав. № ' + esc(v.serial) : '') : ''}</p>
    <ol class="pp">
      <li>Место проведения испытаний: ${blankOr(v.place || t.address || t.object, '________')}</li>
      <li>${esc(b.p2)}</li>
      <li>${esc(b.p3)}</li>
      <li>Цель испытаний: ${v.mode === 'M' ? 'контрольные' : v.mode === 'P' ? 'приёмо-сдаточные' : '<span class="empty-set">не выбрана</span>'}.</li>
      <li>Климатические условия: ${climate || '<span class="empty-set">не указаны</span>'}.</li>
      <li>Испытания выполнены в соответствии с Методикой ${blankOr(b.methods[wt.code], '№ __')}${b.approved ? ', ' + esc(b.approved) : ''}.</li>
      <li>${esc(b.p7)}</li>
    </ol>
    <h3 class="pc">Показатели и нормативные данные</h3>
    <div class="ptbl"><table><tr><th>Наименование показателя</th><th>№ пункта НД на требование</th><th>Значение показателя по НД</th></tr>
      ${ndRows.map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>
    <h3 class="pc">Результаты испытаний (измерений)</h3>
    ${results}
    <h3 class="pc">Перечень применяемых средств измерения и испытательного оборудования</h3>
    <div class="ptbl"><table><tr><th>Наименование</th><th>Зав. №</th><th>Диапазон</th><th>Точность</th><th>Свидетельство №</th><th>Поверка (послед. / очередн.)</th></tr>
      ${devRows.map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="6">Приборы не отмечены</td></tr>'}</table></div>
    <h3 class="pc">Заключение</h3>
    <p>${esc(eq ? eq + ': ' : '')}${v.conclusion ? esc(v.conclusion.toLowerCase().replace(/^./, c => c.toUpperCase())) : '<span class="empty-set">не указано</span>'}.</p>
    ${reasons.length ? `<ol class="pr">${reasons.map(x => `<li>${esc(x.what)} (${esc(x.ref)}).${x.need ? ' Требуется: ' + esc(x.need) + '.' : ''}</li>`).join('')}</ol>` : ''}
    ${v.notes ? `<p>Замечания: ${esc(v.notes)}</p>` : ''}
    <div class="signs-block"><p><b>Испытания (измерения) производили:</b></p>
      ${people.map(n => `<div class="sg"><span>${esc(staffPos(n) || 'Электромонтёр')}</span><span class="sg-line"></span><span>${esc(n)}</span></div>`).join('') || '<div class="sg"><span>________</span><span class="sg-line"></span><span>________</span></div>'}
      <p class="mt"><b>Протокол проверил:</b></p>
      <div class="sg"><span>${esc(b.checkerPos)}</span><span class="sg-line"></span><span>${blankOr(b.checker, '________')}</span></div></div>
    <div class="pfoot">№ протокола: ${esc(v.proto_no || '____')} · Лист 1 · Всего листов 1</div>
  </div>`;
}
let paperDevices = [], bossView = lsGet('bossView') || 'paper';
async function loadPaperDevices() { paperDevices = (await docsAll()).filter(d => d.kind === 'device'); }
async function viewPaper(id, kk) {
  const t = await dbGet(id);
  if (!t) { location.hash = '/e'; return; }
  const k = Math.min(Math.max(0, +kk || 0), t.items.length - 1);
  header('Вид протокола', `/e/task/${id}/form/${k}`);
  await loadPaperDevices();
  const it = t.items[k];
  app.innerHTML = (it.skip ? '<div class="banner warn">Это испытание не выполнялось.</div>' : paperHTML(t, it, k)) +
    '<button class="btn no-print" onclick="window.print()">Печать или сохранить в PDF</button>';
}
// Настройки бланка
function viewSettings() {
  header('Бланк протокола', '/b');
  const b = blank();
  const typeList = Object.values(WORK_TYPES).sort((a, b) => a.code.localeCompare(b.code, 'ru', { numeric: true }));
  app.innerHTML = `<form class="card" id="bf">
    <p class="meta">Эти данные хранятся только на этом телефоне и подставляются в шапку и подписи протокола.</p>
    <label class="field"><span class="lbl">Шапка организации (каждая строка — отдельно)</span><textarea name="org" rows="5">${esc(b.org)}</textarea>
      <span class="hint">Организация, управление, служба, адрес, телефон.</span></label>
    <label class="field"><span class="lbl">Свидетельство о регистрации электролаборатории</span><textarea name="lab" rows="2">${esc(b.lab)}</textarea></label>
    <label class="field"><span class="lbl">Кем утверждены методики</span><input name="approved" value="${esc(b.approved)}" autocomplete="off">
      <span class="hint">Например: утверждённой главным инженером … (ФИО)</span></label>
    <h3 class="mt">Протокол проверил</h3>
    <label class="field"><span class="lbl">Должность</span><input name="checkerPos" value="${esc(b.checkerPos)}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Фамилия и инициалы</span><input name="checker" value="${esc(b.checker)}" autocomplete="off"></label>
    <h3 class="mt">Тексты пунктов</h3>
    <label class="field"><span class="lbl">Пункт 2</span><textarea name="p2" rows="2">${esc(b.p2)}</textarea></label>
    <label class="field"><span class="lbl">Пункт 3</span><textarea name="p3" rows="2">${esc(b.p3)}</textarea></label>
    <label class="field"><span class="lbl">Пункт 7</span><textarea name="p7" rows="2">${esc(b.p7)}</textarea></label>
    <h3 class="mt">Номера методик</h3>
    ${typeList.map(w => `<label class="field"><span class="lbl">${esc(w.short)}</span><input data-method="${w.code}" value="${esc(b.methods[w.code] || '')}" placeholder="№ … «название»" autocomplete="off"></label>`).join('')}
    <button class="btn accent" type="submit">Сохранить</button></form>`;
  $('#bf').onsubmit = e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const methods = {};
    app.querySelectorAll('[data-method]').forEach(i => { methods[i.dataset.method] = i.value.trim(); });
    lsSet('blank', JSON.stringify({ ...fd, methods }));
    toast('Бланк сохранён'); location.hash = '/b';
  };
}

async function viewBossTask(id, kk) {
  const t = await dbGet(id);
  if (!t) { location.hash = '/b'; return; }
  const n = t.items.length, k = Math.min(Math.max(0, +kk || 0), Math.max(0, n - 1));
  header(`Заявка ${t.number}`, '/b');
  const [sl, sc] = bossStatus(t);
  const info = `<div class="card">
    <div class="top-line"><span>Заявка ${esc(t.number)} от ${fmtDate(t.date)}</span><span class="badge ${sc}">${sl}</span></div>
    <div class="obj">${esc(t.object)}</div>
    <p class="meta">${t.address ? 'Адрес: ' + esc(t.address) + '<br>' : ''}${permitHTML(t)}${t.equipment ? 'Оборудование: ' + esc(t.equipment) + '<br>' : ''}
    ${crewHTML(t)}<br>Инструктаж: ${t.briefing.at ? fmtDT(t.briefing.at) : 'не пройден'}${t.sentAt ? '<br>Получено: ' + fmtDT(t.sentAt) : ''}
    ${t.comment ? '<br>' + esc(t.comment) : ''}</p>
    ${testsHTML(t)}
    ${t.archived ? '<div class="banner info mt">Заявка в архиве.</div>' : ''}
    <div class="actions no-print">
      <a class="btn ghost small" href="#/b/edit/${id}">✎ Изменить</a>
      <button class="btn ghost small danger" id="delBtn">Удалить</button>
      ${t.status === 'sent' ? `<button class="btn ghost small wide" id="archBtn">${t.archived ? 'Вернуть из архива' : '🗄 В архив'}</button>` : ''}
    </div></div>`;
  let body;
  if (t.status !== 'sent') body = `<div class="banner info">Протоколы ещё не получены. Статус: ${sl.toLowerCase()}.</div>`;
  else if (t.outcome === 'notdone') body = `<div class="banner warn">Работа не выполнялась. Причина: ${esc(t.reason)}</div>`;
  else {
    await loadPaperDevices();
    body = '';
    const mark = x => x.skip ? '— ' : x.values.conclusion ? (isFit(x.values) ? '✓ ' : '✗ ') : '';
    body = `<div class="chips no-print view-sw"><button class="chip ${bossView !== 'short' ? 'on' : ''}" data-view="paper">Как на бумаге</button><button class="chip ${bossView === 'short' ? 'on' : ''}" data-view="short">Кратко</button></div>` + (n > 1 ? `<div class="subtabs no-print">${t.items.map((x, j) => `<a href="#/b/task/${t.id}/${j}" class="${j === k ? 'active' : ''} ${x.skip ? '' : x.values.conclusion && !isFit(x.values) ? 'bad' : ''}">${mark(x)}${j + 1}. ${esc(typeName(x.type))}</a>`).join('')}</div>
      <p class="meta no-print swipe-tip">Листайте пальцем влево-вправо, чтобы перейти к другому протоколу.</p>` : '') +
      (bossView === 'short' ? protocolHTML(t.items[k], k, n) : (t.items[k].skip ? protocolHTML(t.items[k], k, n)
        : (reasonsOf(WORK_TYPES[t.items[k].type], t.items[k].values).length ? `<div class="no-print">${reasonsHTML(reasonsOf(WORK_TYPES[t.items[k].type], t.items[k].values))}</div>` : '') + paperHTML(t, t.items[k], k))) +
      (n > 1 ? `<div class="tb-nav no-print">${k > 0 ? `<a class="btn ghost" href="#/b/task/${t.id}/${k - 1}">‹ Протокол ${k}</a>` : '<span></span>'}${k < n - 1 ? `<a class="btn ghost" href="#/b/task/${t.id}/${k + 1}">Протокол ${k + 2} ›</a>` : '<span></span>'}</div>` : '') +
      `<button class="btn no-print" onclick="window.print()">Печать или сохранить в PDF</button>`;
    if (n > 1) swipeNav = { prev: k > 0 ? `/b/task/${t.id}/${k - 1}` : null, next: k < n - 1 ? `/b/task/${t.id}/${k + 1}` : null };
  }
  app.innerHTML = info + body;
  app.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { bossView = b.dataset.view; lsSet('bossView', bossView); router(); });
  $('#delBtn').onclick = () => deleteTask(t, '/b');
  const ab = $('#archBtn');
  if (ab) ab.onclick = async () => {
    t.archived = !t.archived; t.archivedAt = t.archived ? Date.now() : null;
    await dbPut(t);
    toast(t.archived ? 'Заявка в архиве' : 'Заявка возвращена из архива');
    location.hash = '/b';
  };
}

// ---------- Наряды и информация для ознакомления ----------
// Добавляет начальник (текст и файлы), монтёр смотрит. Пока нет сервера, всё хранится на этом телефоне.
const DOC_KINDS = { permit: ['Наряды', 'наряд'], info: ['Информация для ознакомления', 'документ'] };
const readFile = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
async function viewDocs(role, kind) {
  const [title, one] = DOC_KINDS[kind] || DOC_KINDS.info;
  header(title, homeOf(role));
  const docs = (await docsAll()).filter(d => d.kind === kind).sort((a, b) => b.created - a.created);
  const people = getStaff().filter(n => !/начальник/i.test(staffPos(n)));
  const infoBadge = d => {
    if (role === 'e') { const done = ackedBy(d, me()), late = !done && d.due && d.due < today();
      return `<span class="badge ${done ? 'st-sent' : late ? 'st-not' : 'st-new'}">${done ? 'Ознакомлен' : late ? 'Срок прошёл' : 'Не прочитано'}</span>`; }
    const n = acksOf(d).filter(a => a.name).length;
    const all = people.length && n >= people.length, late = !all && d.due && d.due < today();
    return `<span class="badge ${all ? 'st-sent' : late ? 'st-not' : 'st-new'}">${late ? 'Срок прошёл · ' : ''}Ознакомились: ${n}${people.length ? ' из ' + people.length : ''}</span>`;
  };
  app.innerHTML = `${role !== 'e' ? `<a class="btn accent" href="#/${role}/docnew/${kind}">+ Добавить ${one}</a><div class="gap"></div>` : ''}
    ${kind === 'info' && role === 'b' ? '<div id="quizCard"></div>' : ''}${kind === 'info' && role === 'e' ? '<div id="quizCard"></div><p class="meta">Откройте каждый документ и нажмите «Ознакомлен».</p><div class="gap"></div>' : ''}
    ${docs.map(d => `<a class="card task" href="#/${role}/doc/${d.id}">
      <div class="top-line"><span>${fmtDate(d.created)}${d.due ? ' · до ' + fmtDate(d.due) : ''}</span>${kind === 'info' ? infoBadge(d) : ''}</div>
      <div class="obj">${esc(d.title)}</div>
      ${d.text ? `<p class="meta">${esc(d.text.slice(0, 140))}${d.text.length > 140 ? '…' : ''}</p>` : ''}
      ${d.files?.length ? `<p class="meta">📎 Файлов: ${d.files.length}</p>` : ''}</a>`).join('') || `<div class="card meta">Пока пусто.${role !== 'e' ? '' : ' Начальник добавит сюда документы.'}</div>`}`;
  const qc = $('#quizCard');
  if (qc) qc.innerHTML = quizCardHTML(role);
}
async function viewDocEdit(kind, id, role = 'b') {
  const old = id ? await docGet(id) : null;
  kind = old?.kind || kind;
  const [title, one] = DOC_KINDS[kind] || DOC_KINDS.info;
  header(old ? 'Изменить' : `Новый ${one}`, `/${role}/docs/${kind}`);
  const files = [...(old?.files || [])];
  app.innerHTML = `<form class="card" id="df" novalidate>
    <label class="field"><span class="lbl">Название <b class="req">*</b></span><input name="title" value="${esc(old?.title)}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Текст</span><textarea name="text" rows="6">${esc(old?.text)}</textarea></label>
    ${kind === 'info' ? `<label class="field"><span class="lbl">Ознакомиться до</span><input type="date" name="due" value="${esc(old?.due)}"></label>` : ''}
    <span class="lbl">Файлы (фото, PDF, документы)</span><div id="fl"></div>
    <label class="btn ghost file-btn">📎 Прикрепить файл<input type="file" multiple id="fInp"></label>
    <div class="gap"></div><button class="btn accent" type="submit">Сохранить</button></form>`;
  const fl = $('#fl');
  const draw = () => { fl.innerHTML = files.map((f, i) => `<div class="multi"><span class="fname">📎 ${esc(f.name)}</span><button type="button" class="x" data-fdel="${i}">×</button></div>`).join(''); };
  draw();
  fl.onclick = e => { const i = e.target.dataset.fdel; if (i !== undefined) { files.splice(+i, 1); draw(); } };
  $('#fInp').onchange = async e => {
    for (const file of e.target.files) {
      if (file.size > 15 * 1024 * 1024) { toast(`«${file.name}» больше 15 МБ — слишком большой`); continue; }
      try { files.push({ name: file.name, type: file.type, data: file.type.startsWith('image/') ? await compressPhoto(file) : await readFile(file) }); }
      catch (err) { toast('Не удалось прочитать файл'); }
    }
    e.target.value = ''; draw();
  };
  $('#df').onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    if (!fd.title.trim()) { toast('Укажите название'); return; }
    const d = { ...(old || { id: 'd' + Date.now(), kind, created: Date.now() }), title: fd.title.trim(), text: fd.text.trim(), files, due: fd.due || '' };
    if (old && kind === 'info' && (old.text !== d.text || old.files?.length !== files.length)) { d.ackAt = null; d.acks = []; } // изменили — нужно ознакомиться заново
    await docPut(d);
    toast('Сохранено');
    if (!old) notify(kind === 'info' ? 'Новая информация для ознакомления' : 'Новый наряд', d.title, `/e/doc/${d.id}`);
    location.hash = `/${role}/docs/${kind}`;
  };
}
// Открыть файл: картинки показываем сразу, остальное — кнопкой
function openFile(f) {
  const bin = atob(f.data.split(',')[1]), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: f.type || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  if (!/pdf|image|text/.test(f.type)) a.download = f.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function viewDoc(role, id) {
  const d = await docGet(id);
  if (!d) { location.hash = '/' + role; return; }
  header(DOC_KINDS[d.kind]?.[0] || 'Документ', `/${role}/docs/${d.kind}`);
  const acks = acksOf(d), staff = getStaff();
  const people = staff.filter(n => !/начальник/i.test(staffPos(n)));
  const notYet = people.filter(n => !acks.some(a => a.name === n));
  const late = d.due && d.due < today();
  let ackHTML = '';
  if (d.kind === 'info') {
    // Ознакомился позже срока — помечаем
    const afterDue = a => d.due && new Date(a.at).toISOString().slice(0, 10) > d.due;
    const list = acks.length ? '<ul class="acks">' + acks.map(a => `<li class="${afterDue(a) ? 'txt-bad' : ''}">✓ ${esc(a.name || 'без фамилии')} — ${fmtDT(a.at)}${afterDue(a) ? ' (после срока)' : ''}</li>`).join('') + '</ul>' : '<p class="meta">Пока никто не ознакомился.</p>';
    if (role === 'b') ackHTML = `<div class="card"><h3>Ознакомились</h3>${list}${notYet.length ? `<h3 class="mt ${late ? 'txt-bad' : ''}">${late ? 'Срок прошёл, не ознакомились' : 'Ещё не ознакомились'}</h3><p>${esc(notYet.join(', '))}</p>` : ''}</div>`;
    else ackHTML = ackedBy(d, me()) && me() ? `<div class="banner ok">${esc(me())}: ознакомлен ${fmtDT(acks.find(a => a.name === me())?.at)}.</div>`
      : `<div class="card"><label class="field"><span class="lbl">Кто ознакомился</span><select id="ackName"><option value="">— выберите себя —</option>${
        staff.map(n => `<option ${n === me() ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <button class="btn accent" id="ackBtn">Ознакомлен</button></div>`;
  }
  app.innerHTML = `<div class="card tb-text"><h2>${esc(d.title)}</h2><p class="meta">${fmtDate(d.created)}${d.due ? ` · <b class="${late ? 'txt-bad' : ''}">ознакомиться до ${fmtDate(d.due)}</b>` : ''}</p>
    ${d.text ? paras(d.text) : ''}
    ${(d.files || []).map((f, i) => f.type?.startsWith('image/') ? `<img class="doc-img" src="${f.data}" alt="${esc(f.name)}">`
      : `<button class="btn ghost small" data-open="${i}">📎 Открыть «${esc(f.name)}»</button>`).join('')}</div>
    ${ackHTML}
    ${role !== 'e' ? `<div class="actions"><a class="btn ghost small" href="#/${role}/docedit/${d.id}">✎ Изменить</a><button class="btn ghost small danger" id="ddel">Удалить</button></div>` : ''}`;
  app.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openFile(d.files[+b.dataset.open]));
  const ack = $('#ackBtn');
  if (ack) ack.onclick = async () => {
    const name = $('#ackName').value;
    if (!name) { toast('Выберите свою фамилию'); return; }
    lsSet('me', name);
    d.acks = [...acksOf(d).filter(a => a.name && a.name !== name), { name, at: Date.now() }]; d.ackAt = null;
    await docPut(d); await counts(); toast('Отмечено: ознакомлен');
    notify(`${name} ознакомился`, `«${d.title}»${d.due && today() > d.due ? ' — после срока' : ''}`, `/b/doc/${d.id}`);
    router();
  };
  const del = $('#ddel');
  if (del) del.onclick = async () => {
    if (!confirm(`Удалить «${d.title}»? Отменить нельзя.`)) return;
    await docDel(d.id); toast('Удалено'); location.hash = `/${role}/docs/${d.kind}`;
  };
}

// ---------- Приборы ----------
// Хранятся в том же хранилище, что и документы (kind: 'device'); название попадает в список приборов протокола
const devLabel = d => [d.name, d.no ? '№ ' + d.no : ''].filter(Boolean).join(' ');
async function viewDevices(role) {
  header('Приборы', homeOf(role));
  const devs = (await docsAll()).filter(d => d.kind === 'device').sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const known = new Set(devs.map(devLabel));
  const loose = getList('devices').filter(n => !known.has(n));
  app.innerHTML = `<a class="btn accent" href="#/${role}/device/new">+ Добавить прибор</a><div class="gap"></div>
    ${devs.map(d => { const [c, t] = verState(d);
      return `<a class="card task" href="#/${role}/device/${d.id}"><div class="top-line"><span>${d.next ? 'Очередная поверка: ' + fmtDate(d.next) : 'Дата поверки не указана'}</span>
        ${c ? `<span class="badge ${c === 'ok' ? 'st-sent' : c === 'warn' ? 'st-pending' : 'st-not'}">${t}</span>` : ''}</div>
        <div class="obj">${esc(devLabel(d))}</div><p class="meta">${[d.range && 'Диапазон: ' + esc(d.range), d.acc && 'Точность: ' + esc(d.acc), d.cert && 'Свидетельство № ' + esc(d.cert)].filter(Boolean).join('<br>')}</p>
        ${d.files?.length ? `<p class="meta">📎 Файлов: ${d.files.length}</p>` : ''}</a>`; }).join('') || '<div class="card meta">Приборов пока нет.</div>'}
    ${loose.length ? `<h3 class="mt">Есть в протоколах, но без данных поверки</h3>${loose.map(n => `<a class="card task" href="#/${role}/device/new?${encodeURIComponent(n)}"><div class="obj">${esc(n)}</div><p class="meta">Нажмите, чтобы заполнить</p></a>`).join('')}` : ''}`;
}
async function viewDeviceEdit(role, id) {
  const [rid, preset] = String(id).split('?');
  const old = rid !== 'new' ? await docGet(rid) : null;
  header(old ? 'Прибор' : 'Новый прибор', `/${role}/devices`);
  const d = old || { name: preset ? decodeURIComponent(preset) : '', files: [] };
  const files = [...(d.files || [])];
  const fld = (name, label, val, type = 'text', hint = '') => `<label class="field"><span class="lbl">${label}</span><input name="${name}" type="${type}" value="${esc(val)}" autocomplete="off">${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  app.innerHTML = `<form class="card" id="vf" novalidate>
    ${fld('name', 'Наименование и тип <b class="req">*</b>', d.name, 'text', 'Например: Мегаомметр Е6-24')}
    ${fld('no', 'Заводской номер', d.no)}
    ${fld('range', 'Диапазон измерений', d.range)}
    ${fld('acc', 'Класс точности, погрешность', d.acc)}
    ${fld('cert', '№ свидетельства о поверке', d.cert)}
    ${fld('date', 'Дата последней поверки', d.date, 'date')}
    ${fld('next', 'Дата очередной поверки', d.next, 'date')}
    <span class="lbl">Свидетельство о поверке (фото, PDF)</span><div id="fl"></div>
    <label class="btn ghost file-btn">📎 Прикрепить файл<input type="file" multiple id="fInp"></label>
    <div class="gap"></div><button class="btn accent" type="submit">Сохранить</button>
    ${old ? '<button type="button" class="btn ghost danger mt" id="vdel">Удалить прибор</button>' : ''}</form>`;
  const fl = $('#fl');
  const draw = () => { fl.innerHTML = files.map((f, i) => `<div class="multi"><button type="button" class="fname linkish" data-fopen="${i}">📎 ${esc(f.name)}</button><button type="button" class="x" data-fdel="${i}">×</button></div>`).join(''); };
  draw();
  fl.onclick = e => {
    const i = e.target.dataset.fdel, o = e.target.closest('[data-fopen]');
    if (i !== undefined) { files.splice(+i, 1); draw(); } else if (o) openFile(files[+o.dataset.fopen]);
  };
  $('#fInp').onchange = async e => {
    for (const file of e.target.files) {
      if (file.size > 15 * 1024 * 1024) { toast(`«${file.name}» больше 15 МБ — слишком большой`); continue; }
      try { files.push({ name: file.name, type: file.type, data: file.type.startsWith('image/') ? await compressPhoto(file) : await readFile(file) }); }
      catch (err) { toast('Не удалось прочитать файл'); }
    }
    e.target.value = ''; draw();
  };
  $('#vf').onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    if (!fd.name.trim()) { toast('Укажите наименование'); return; }
    const nd = { ...(old || { id: 'v' + Date.now(), kind: 'device', created: Date.now() }), ...Object.fromEntries(Object.entries(fd).map(([k, x]) => [k, x.trim()])), files };
    if (old && devLabel(old) !== devLabel(nd)) removeFromList('devices', devLabel(old));
    if (preset) removeFromList('devices', decodeURIComponent(preset));
    addToList('devices', [devLabel(nd)]);
    await docPut(nd); toast('Прибор сохранён'); location.hash = `/${role}/devices`;
  };
  const del = $('#vdel');
  if (del) del.onclick = async () => {
    if (!confirm(`Удалить прибор «${devLabel(old)}»?`)) return;
    removeFromList('devices', devLabel(old));
    await docDel(old.id); toast('Удалено'); location.hash = `/${role}/devices`;
  };
}

// ---------- Листание протоколов пальцем влево-вправо ----------
let swipeNav = null, touch0 = null;
document.addEventListener('touchstart', e => {
  const el = e.target;
  touch0 = swipeNav && !el.closest('input, select, textarea, .subtabs, .ntbl, pre, .chips') ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!touch0 || !swipeNav) return;
  const dx = e.changedTouches[0].clientX - touch0.x, dy = e.changedTouches[0].clientY - touch0.y;
  touch0 = null;
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
  const to = dx < 0 ? swipeNav.next : swipeNav.prev;
  if (to) location.hash = to;
}, { passive: true });

// ---------- Переходы между экранами ----------
function router() {
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  window.scrollTo(0, 0);
  currentFormId = null; swipeNav = null;
  if (!p.length) return viewRoles();
  if (p[0] === 'h') {
    if (p[1] === 'docnew') return viewDocEdit(p[2], null, 'h');
    if (p[1] === 'docedit') return viewDocEdit(null, p[2], 'h');
  }
  if (p[0] === 'e' || p[0] === 'b' || p[0] === 'h') {
    if (p[0] !== 'h') lsSet('role', p[0]);
    if (p[1] === 'docs') return viewDocs(p[0], p[2]);
    if (p[1] === 'doc') return viewDoc(p[0], p[2]);
    if (p[1] === 'devices') return viewDevices(p[0]);
    if (p[1] === 'device') return viewDeviceEdit(p[0], p[2]);
    if (p[1] === 'games') return viewGames(p[0], p[2]);
    if (p[1] === 'quiz') return viewQuiz(p[0]);
    if (p[1] === 'rating') return viewRating(p[0]);
  }
  if (p[0] === 'e') {
    if (p[1] === 'tb') return p[2] === 'groups' ? viewTBGroups() : p[2] !== undefined ? viewTBChapter(+p[2], p[3]) : viewTB();
    if (p[1] === 'new') return viewEdit('e');
    if (p[1] === 'paper') return viewPaper(p[2], p[3]);
    if (p[1] === 'edit') return viewEdit('e', p[2]);
    return p[1] === 'task' ? viewTask(p[2], p[3] || 'brief', p[4]) : viewElList();
  }
  if (p[0] === 'b') {
    if (p[1] === 'new') return viewEdit('b');
    if (p[1] === 'edit') return viewEdit('b', p[2]);
    if (p[1] === 'task') return viewBossTask(p[2], p[3]);
    if (p[1] === 'settings') return viewSettings();
    if (p[1] === 'docnew') return viewDocEdit(p[2], null, 'b');
    if (p[1] === 'docedit') return viewDocEdit(null, p[2], 'b');
    return viewBossList();
  }
  if (p[0] === 'h') return viewRoles();
  viewRoles();
}

(async () => {
  await openDB();
  await seed();
  renderNet();
  window.addEventListener('hashchange', router);
  counts();
  router();
  syncPending();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
