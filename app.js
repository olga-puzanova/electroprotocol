'use strict';
// ЭлектроПротокол — прототип. Все данные хранятся в памяти телефона (IndexedDB).
// В рабочей версии «Отправить» будет передавать протокол на сервер, а начальник увидит его у себя.

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
  sent: ['Отправлено', 'st-sent']
};

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
const dbAll = () => req('readonly', s => s.getAll());
const dbGet = id => req('readonly', s => s.get(id));
const dbPut = t => req('readwrite', s => s.put(t));
const dbClear = () => req('readwrite', s => s.clear());

// Примеры заявок для показа
async function seed() {
  if ((await dbAll()).length) return;
  const today = new Date().toISOString().slice(0, 10);
  const base = { status: 'new', briefing: { checked: [] }, executor: 'Иванов С. П.' };
  await dbPut({ ...base, id: 't1', number: 'З-101', created: Date.now() - 2000, workType: 'transformer',
    object: 'ТП-12, трансформатор Т-1', address: 'п. Лесной, ул. Садовая, 3', equipment: 'ТМГ-400/10/0,4',
    date: today, comment: 'Испытания после ремонта.',
    protocol: { values: { tr_type: 'ТМГ-400/10', power: '400', voltage: '10/0,4', scheme: 'Y/Yн-0', kt_pass: '25', taps_n: '5' }, photos: [] } });
  await dbPut({ ...base, id: 't2', number: 'З-102', created: Date.now() - 1000, workType: 'grounding',
    object: 'КТП-5, контур заземления', address: 'д. Берёзовка, у фермы', equipment: 'КТП 160 кВА, сеть 380/220 В',
    date: today, comment: '', protocol: { values: { gr_type: 'Заземляющее устройство ТП/КТП', r_norm: '4' }, photos: [] } });
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
// Отправляет все протоколы, которые ждут интернета
async function syncPending() {
  if (!isOnline() || syncing) return;
  syncing = true;
  try {
    const list = (await dbAll()).filter(t => t.status === 'pending');
    for (const t of list) { t.status = 'sent'; t.sentAt = Date.now(); await dbPut(t); }
    if (list.length) {
      toast(list.length === 1 ? 'Протокол отправлен начальнику' : `Отправлено протоколов: ${list.length}`);
      if (!location.hash.endsWith('/form') || list.some(t => t.id === currentFormId)) router();
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
function sectionInner(sec, v, ro) {
  return `<h3>${esc(sec.title)}</h3>${sec.note && !ro ? `<p class="note">${esc(sec.note)}</p>` : ''}
    ${expand(sec.fields, v).map(f => fieldHTML(f, v, ro)).join('')}`;
}

function fieldHTML(f, v, ro) {
  if (f.type === 'row') {
    return `<div class="row-wrap"><span class="lbl">${esc(f.label)}</span>
      <div class="row" style="--n:${f.fields.length}">${f.fields.map(c => fieldHTML(c, v, ro)).join('')}</div></div>`;
  }
  if (f.type === 'calc') {
    return `<div class="calc" data-calc="${f.id}"><span class="calc-label">${esc(f.label)}</span>
      <span class="calc-val">—</span><span class="msg" data-msg="${f.id}"></span></div>`;
  }
  const val = v[f.id] ?? '';
  let input;
  if (ro) {
    input = `<div class="ro-val">${val !== '' ? esc(optText(f, val)) + (f.unit ? ' ' + esc(f.unit) : '') : '—'}</div>`;
  } else if (f.type === 'select') {
    input = `<select data-f="${f.id}"><option value="">— выберите —</option>${f.options.map(o => {
      const ov = typeof o === 'string' ? o : o.v, ot = typeof o === 'string' ? o : o.t;
      return `<option value="${esc(ov)}" ${String(val) === ov ? 'selected' : ''}>${esc(ot)}</option>`;
    }).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea data-f="${f.id}" rows="3">${esc(val)}</textarea>`;
  } else {
    input = `<div class="inp-wrap ${f.unit ? 'has-unit' : ''}"><input data-f="${f.id}" ${f.type === 'number' ? 'inputmode="decimal"' : ''}
      value="${esc(val)}" placeholder="${esc(f.ph || '')}" autocomplete="off">${f.unit ? `<span class="unit">${esc(f.unit)}</span>` : ''}</div>`;
  }
  return `<label class="field" data-field="${f.id}"><span class="lbl">${esc(f.label)}${f.required && !ro ? ' <b class="req">*</b>' : ''}</span>
    ${input}${f.hint && !ro ? `<span class="hint">${esc(f.hint)}</span>` : ''}<span class="msg" data-msg="${f.id}"></span></label>`;
}

// Подсвечивает значения: зелёным — в норме, красным — вне нормы
function applyChecks(box, wt, v) {
  const r = wt.check(v);
  box.querySelectorAll('[data-msg]').forEach(m => { m.textContent = ''; m.className = 'msg'; });
  box.querySelectorAll('.field').forEach(f => f.classList.remove('bad', 'good'));
  box.querySelectorAll('[data-calc] .calc-val').forEach(c => { c.textContent = '—'; });
  for (const [id, res] of Object.entries(r)) {
    const m = box.querySelector(`[data-msg="${id}"]`);
    if (m) { m.textContent = (res.ok ? '✓ ' : '✗ ') + res.msg; m.classList.add(res.ok ? 'ok' : 'bad'); }
    const f = box.querySelector(`[data-field="${id}"]`);
    if (f) f.classList.add(res.ok ? 'good' : 'bad');
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

async function viewElList() {
  header('Мои заявки', '/');
  const tasks = (await dbAll()).sort(byNew);
  const pending = tasks.filter(t => t.status === 'pending').length;
  app.innerHTML = `
    <a class="card task tb-link" href="#/e/tb"><span class="role-ic">📕</span>
      <span><b>Техника безопасности</b><br><span class="meta">ПОТЭЭ, приказ № 903н — все главы, поиск</span></span></a>
    ${pending ? `<div class="banner warn">Не отправлено протоколов: <b>${pending}</b>. Они уйдут сами, когда появится интернет.</div>` : ''}
    ${tasks.length ? tasks.map(t => {
      const [sl, sc] = STATUS[t.status];
      return `<a class="card task" href="#/e/task/${t.id}">
        <div class="top-line"><span>${esc(t.number)} · ${fmtDate(t.date)}</span><span class="badge ${sc}">${sl}</span></div>
        <div class="obj">${esc(t.object)}</div>
        <p class="meta">п. ${esc(WORK_TYPES[t.workType].code)} ${esc(WORK_TYPES[t.workType].short)}<br>${esc(t.address)}</p></a>`;
    }).join('') : '<div class="card meta">Заявок пока нет.</div>'}`;
}

async function viewTask(id, tab) {
  const t = await dbGet(id);
  if (!t) { location.hash = '/e'; return; }
  const wt = WORK_TYPES[t.workType];
  const [sl, sc] = STATUS[t.status];
  header(`Заявка ${t.number}`, '/e');
  const tabs = [['brief', '1. Инструктаж'], ['steps', '2. Инструкция'], ['form', '3. Протокол']];
  app.innerHTML = `
    <div class="card">
      <div class="top-line"><span>п. ${esc(wt.code)} ${esc(wt.short)}</span><span class="badge ${sc}">${sl}</span></div>
      <div class="obj">${esc(t.object)}</div>
      <p class="meta">${esc(t.address)}<br>Оборудование: <b>${esc(t.equipment)}</b>${t.comment ? '<br>' + esc(t.comment) : ''}</p>
    </div>
    <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/e/task/${id}/${k}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>
    <div id="tab"></div>`;
  const box = $('#tab');
  if (tab === 'brief') renderBrief(box, t, wt);
  else if (tab === 'steps') renderSteps(box, t, wt);
  else renderForm(box, t, wt);
}

function renderBrief(box, t, wt) {
  const items = [...COMMON_BRIEFING, ...wt.briefing];
  const done = t.status !== 'new';
  const chapterLinks = (wt.potee || []).map(n => {
    const i = POTEE.chapters.findIndex(c => c.n === n);
    return i < 0 ? '' : `<a class="tb-row" href="#/e/tb/${i}"><b>${n}.</b> ${esc(POTEE.chapters[i].t)}</a>`;
  }).join('');
  box.innerHTML = `
    <div class="card"><h3>Прочитать в ПОТЭЭ перед работой</h3>${chapterLinks}</div>
    <div class="card"><h3>Инструктаж перед работой</h3>
      <p class="meta">Основание: ПОТЭЭ (приказ Минтруда № 903н), ${esc(wt.docs)}. Отметьте каждый пункт.</p>
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

function renderSteps(box, t, wt) {
  box.innerHTML = `
    <div class="card"><h3>${esc(wt.title)}</h3><p class="meta" style="margin-bottom:14px">${esc(wt.docs)}</p>
      <ol class="steps">${wt.steps.map(s => `<li><b>${esc(s.title)}</b>${s.text ? '<br>' + esc(s.text) : ''}</li>`).join('')}</ol>
      <p class="small">${esc(DISCLAIMER)}</p></div>
    <a class="btn" href="#/e/task/${t.id}/form">Дальше: заполнить протокол</a>`;
}

function renderForm(box, t, wt) {
  currentFormId = t.id;
  const ro = t.status === 'pending' || t.status === 'sent';
  const v = t.protocol.values;
  if (!v.executor) v.executor = t.executor;
  let html = '';
  if (t.status === 'new') html += `<div class="banner warn">Сначала пройдите инструктаж. Без него протокол не отправится.</div>`;
  if (t.status === 'pending') html += `<div class="banner warn">Протокол сохранён на телефоне и ждёт интернета. Отправится сам.</div>`;
  if (t.status === 'sent') html += `<div class="banner ok">Протокол отправлен ${fmtDT(t.sentAt)}. Начальник его видит.</div>`;
  html += wt.form.map((sec, i) => `<div class="card" data-sec="${i}">${sectionInner(sec, v, ro)}</div>`).join('');
  html += `<div class="card"><h3>Фото с объекта</h3><div id="photos">${photosHTML(t.protocol.photos, ro)}</div>
    ${ro ? '' : `<label class="btn ghost file-btn">📷 Добавить фото<input type="file" accept="image/*" capture="environment" multiple id="photoInp"></label>`}</div>`;
  if (!ro) html += `<div class="sticky-actions"><div class="inner"><button class="btn accent" id="sendBtn">Отправить протокол</button></div></div>`;
  box.innerHTML = html;
  applyChecks(box, wt, v);
  if (ro) return;

  const save = () => {
    if (t.status === 'briefed') t.status = 'draft';
    t.savedAt = Date.now();
    return dbPut(t);
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

  const photoBox = $('#photos');
  $('#photoInp').onchange = async e => {
    for (const file of e.target.files) {
      try { t.protocol.photos.push(await compressPhoto(file)); } catch (err) { toast('Не удалось открыть фото'); }
    }
    e.target.value = '';
    photoBox.innerHTML = photosHTML(t.protocol.photos, false);
    save();
  };
  photoBox.onclick = e => {
    const i = e.target.dataset.del;
    if (i === undefined) return;
    t.protocol.photos.splice(+i, 1);
    photoBox.innerHTML = photosHTML(t.protocol.photos, false);
    save();
  };

  $('#sendBtn').onclick = async () => {
    if (t.status === 'new') { toast('Сначала пройдите инструктаж'); location.hash = `/e/task/${t.id}/brief`; return; }
    const miss = flatFields(wt, v).filter(f => f.required && !String(v[f.id] ?? '').trim());
    box.querySelectorAll('.field.missing').forEach(f => f.classList.remove('missing'));
    if (miss.length) {
      miss.forEach(f => box.querySelector(`[data-field="${f.id}"]`)?.classList.add('missing'));
      box.querySelector(`[data-field="${miss[0].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast(`Заполните обязательные поля: ${miss.length}`);
      return;
    }
    const bad = Object.values(wt.check(v)).filter(x => x.ok === false).length;
    if (bad && v.conclusion === 'Годен к эксплуатации' &&
        !confirm(`Значений вне нормы: ${bad}, а в заключении «Годен». Всё равно отправить?`)) return;
    t.status = 'pending'; t.submittedAt = Date.now();
    await dbPut(t);
    if (isOnline()) {
      toast('Отправляем…');
      await new Promise(r => setTimeout(r, 700));
      await syncPending();
    } else {
      toast('Нет связи. Протокол сохранён и отправится сам');
      router();
    }
  };
}

// ---------- Техника безопасности (ПОТЭЭ) ----------
let tbQuery = '';
function viewTB() {
  header('Техника безопасности', '/e');
  app.innerHTML = `
    <div class="card"><h2>Правила по охране труда при эксплуатации электроустановок</h2>
      <p class="meta">${esc(POTEE.source)}. Работает без интернета.</p></div>
    <input id="tbSearch" type="search" placeholder="Поиск: мегаомметр, наряд-допуск, 39.8…" value="${esc(tbQuery)}" autocomplete="off">
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
  if (t.status === 'sent') return ['Протокол получен', 'st-sent'];
  return ['В работе', 'st-draft'];
}

async function viewBossList() {
  header('Заявки и протоколы', '/');
  const tasks = (await dbAll()).sort(byNew);
  const sent = tasks.filter(t => t.status === 'sent').length;
  app.innerHTML = `
    <div class="stats">
      <div class="stat"><b>${tasks.length}</b><span>всего заявок</span></div>
      <div class="stat"><b>${tasks.length - sent}</b><span>в работе</span></div>
      <div class="stat"><b>${sent}</b><span>протоколов</span></div>
    </div>
    <a class="btn accent" href="#/b/new">+ Новая заявка</a><div class="gap"></div>
    ${tasks.map(t => {
      const [sl, sc] = bossStatus(t);
      const notOk = t.status === 'sent' && t.protocol.values.conclusion?.startsWith('Не годен');
      return `<a class="card task" href="#/b/task/${t.id}">
        <div class="top-line"><span>${esc(t.number)} · ${fmtDate(t.date)}</span>
          <span>${notOk ? '<span class="badge st-pending">Не годен</span> ' : ''}<span class="badge ${sc}">${sl}</span></span></div>
        <div class="obj">${esc(t.object)}</div>
        <p class="meta">п. ${esc(WORK_TYPES[t.workType].code)} ${esc(WORK_TYPES[t.workType].short)} · ${esc(t.executor)}</p></a>`;
    }).join('')}`;
}

async function viewBossTask(id) {
  const t = await dbGet(id);
  if (!t) { location.hash = '/b'; return; }
  const wt = WORK_TYPES[t.workType];
  const v = t.protocol.values;
  header(`Заявка ${t.number}`, '/b');
  const info = `<div class="card"><h2>${esc(wt.title)}</h2>
    <p class="meta">Заявка <b>${esc(t.number)}</b> от ${fmtDate(t.date)}<br>Объект: <b>${esc(t.object)}</b><br>
    Адрес: ${esc(t.address)}<br>Оборудование: ${esc(t.equipment)}<br>Исполнитель: <b>${esc(v.executor || t.executor)}</b><br>
    Инструктаж: ${t.briefing.at ? fmtDT(t.briefing.at) : 'не пройден'}${t.sentAt ? '<br>Протокол получен: ' + fmtDT(t.sentAt) : ''}</p></div>`;
  if (t.status !== 'sent') {
    app.innerHTML = info + `<div class="banner info">Протокол ещё не получен. Статус: ${bossStatus(t)[0].toLowerCase()}.</div>`;
    return;
  }
  const r = wt.check(v);
  const mark = id => r[id] ? `<span class="${r[id].ok ? 'mark-ok' : 'mark-bad'}" title="${esc(r[id].msg)}">${r[id].ok ? '✓' : '✗'}</span>` : '';
  const secs = wt.form.map(sec => {
    const rows = expand(sec.fields, v).flatMap(f => {
      if (f.type === 'calc') return r[f.id]?.value ? [[f.label, r[f.id].value, f.id]] : [];
      const list = f.type === 'row' ? rowChildren(f) : [f];
      return list.filter(x => String(v[x.id] ?? '').trim()).map(x => [x.label, optText(x, v[x.id]) + (x.unit ? ' ' + x.unit : ''), x.id]);
    });
    if (!rows.length) return '';
    return `<div class="card"><h3>${esc(sec.title)}</h3><table class="res">${rows.map(([l, val, id]) =>
      `<tr><td>${esc(l)}</td><td>${esc(val)}</td><td>${mark(id)}</td></tr>`).join('')}</table></div>`;
  }).join('');
  const badCount = Object.values(r).filter(x => x.ok === false).length;
  app.innerHTML = info +
    (badCount ? `<div class="banner warn">Значений вне нормы: <b>${badCount}</b> (отмечены ✗).</div>` : `<div class="banner ok">Все проверенные значения в норме.</div>`) +
    secs + `<div class="card"><h3>Фото с объекта</h3>${photosHTML(t.protocol.photos, true)}</div>
    <button class="btn no-print" onclick="window.print()">Печать или сохранить в PDF</button>`;
}

function viewNew() {
  header('Новая заявка', '/b');
  const today = new Date().toISOString().slice(0, 10);
  app.innerHTML = `<form class="card" id="nf">
    <label class="field"><span class="lbl">Вид работ</span><select name="workType">
      ${Object.entries(WORK_TYPES).map(([k, w]) => `<option value="${k}">${esc(w.code)}. ${esc(w.short)}</option>`).join('')}</select></label>
    <label class="field"><span class="lbl">Объект <b class="req">*</b></span><input name="object" required placeholder="ТП-7, трансформатор Т-2"></label>
    <label class="field"><span class="lbl">Адрес</span><input name="address" placeholder="с. Заречное, ул. Мира, 1"></label>
    <label class="field"><span class="lbl">Оборудование</span><input name="equipment" placeholder="ТМ-250/10/0,4"></label>
    <label class="field"><span class="lbl">Дата</span><input type="date" name="date" value="${today}"></label>
    <label class="field"><span class="lbl">Исполнитель</span><input name="executor" value="Иванов С. П."></label>
    <label class="field"><span class="lbl">Комментарий</span><textarea name="comment" rows="2"></textarea></label>
    <button class="btn accent" type="submit">Создать заявку</button></form>`;
  $('#nf').onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const all = await dbAll();
    await dbPut({ ...fd, id: 't' + Date.now(), number: 'З-' + (101 + all.length), created: Date.now(),
      status: 'new', briefing: { checked: [] }, protocol: { values: {}, photos: [] } });
    toast('Заявка создана и отправлена электромонтёру');
    location.hash = '/b';
  };
}

// ---------- Переходы между экранами ----------
function router() {
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  window.scrollTo(0, 0);
  currentFormId = null;
  if (!p.length) return viewRoles();
  if (p[0] === 'e') {
    if (p[1] === 'tb') return p[2] === 'groups' ? viewTBGroups() : p[2] !== undefined ? viewTBChapter(+p[2], p[3]) : viewTB();
    return p[1] === 'task' ? viewTask(p[2], p[3] || 'brief') : viewElList();
  }
  if (p[0] === 'b') {
    if (p[1] === 'new') return viewNew();
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
