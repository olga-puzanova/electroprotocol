'use strict';
// Люди и дни рождения, кусты скважин с картой и сроками испытаний, отправка протокола в мессенджер.

// ===================== Люди и дни рождения =====================
const bdays = () => jget('staffBday', {});
function setBday(name, date) { const m = bdays(); if (date) m[name] = date; else delete m[name]; lsSet('staffBday', JSON.stringify(m)); }
// Через сколько дней день рождения (0 — сегодня)
function daysToBday(date) {
  if (!date) return null;
  const now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [, m, d] = date.split('-').map(Number);
  let b = new Date(now.getFullYear(), m - 1, d);
  if (b < t0) b = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((b - t0) / 864e5);
}
const upcomingBdays = (within = 7) => getStaff().map(n => ({ n, date: bdays()[n], d: daysToBday(bdays()[n]) })).filter(x => x.d !== null && x.d <= within).sort((a, b) => a.d - b.d);
// Раз в день при открытии приложения — уведомление и поздравление
function checkBirthdays() {
  const today = upcomingBdays(0);
  if (!today.length || lsGet('bdayShown') === new Date().toDateString()) return;
  lsSet('bdayShown', new Date().toDateString());
  for (const x of today) notify(`🎂 Сегодня день рождения: ${x.n}`, 'Поздравьте коллегу! Здоровья, удачи и безопасной работы.', '/h/people');
}
function bdayBannerHTML() {
  const list = upcomingBdays(7);
  if (!list.length) return '';
  const today = list.filter(x => x.d === 0), soon = list.filter(x => x.d > 0);
  return `<a class="bday" href="#/h/people"><span class="bday-ic">🎂</span><span>${today.length ? `<b>Сегодня день рождения: ${today.map(x => esc(x.n)).join(', ')}!</b><br>Поздравляем! Здоровья, удачи и безопасной работы.` : ''}
    ${soon.length ? `<small>${today.length ? '<br>' : ''}Скоро: ${soon.map(x => `${esc(x.n)} — ${x.d === 1 ? 'завтра' : 'через ' + x.d + ' дн.'}`).join('; ')}</small>` : ''}</span></a>`;
}
function viewPeople(role) {
  header('Люди', homeOf(role));
  const staff = getStaff().slice().sort((a, b) => a.localeCompare(b, 'ru'));
  const bd = bdays();
  app.innerHTML = `${bdayBannerHTML()}
    <div class="card"><p class="meta">Должность и день рождения. В день рождения придёт уведомление с поздравлением (на этом телефоне, когда откроете приложение).</p></div>
    ${staff.map(n => `<div class="card person-c"><div class="pc-top"><b>${esc(n)}</b><button type="button" class="del-x sm" data-pdel="${esc(n)}" aria-label="Удалить">${icon('trash')}</button></div>
      <div class="pc-row"><label class="field"><span class="lbl">Должность</span><select data-pos="${esc(n)}"><option value="">—</option>${[...new Set([...POSITIONS, staffPos(n)].filter(Boolean))].map(p => `<option ${p === staffPos(n) ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">День рождения</span><input type="date" data-bd="${esc(n)}" value="${esc(bd[n] || '')}"></label></div>
      ${bd[n] && daysToBday(bd[n]) === 0 ? '<p class="bday-today">🎉 Сегодня день рождения!</p>' : ''}</div>`).join('') || '<div class="card meta">Список пуст.</div>'}
    <button class="btn accent" id="pAdd">+ Добавить человека</button>`;
  app.onchange = e => {
    const el = e.target;
    if (el.dataset.pos !== undefined) { setStaffPos(el.dataset.pos, el.value); toast('Должность сохранена'); }
    if (el.dataset.bd !== undefined) { setBday(el.dataset.bd, el.value); toast('День рождения сохранён'); viewPeople(role); }
  };
  app.onclick = async e => {
    const d = e.target.closest('[data-pdel]');
    if (d) { const n = d.dataset.pdel; if (!confirm(`Удалить «${n}» из списка людей?`)) return; removeFromList('staff', n); setBday(n, ''); viewPeople(role); }
    if (e.target.id === 'pAdd') { const n = (await askText('Новый человек', '', '', 'Фамилия и инициалы') || '').trim(); if (n) { addStaff([n]); viewPeople(role); } }
  };
}

// ===================== Кусты =====================
// Регламент: что проверяем на кусте и как часто. Типы испытаний из заявки сами обновляют дату.
const REG_DEF = [
  { k: 'pzu', n: 'Заземляющее устройство (ПЗУ)', m: 36, types: ['grounding'] },
  { k: 'metal', n: 'Металлосвязь', m: 36, types: ['grounding'] },
  { k: 'loop', n: 'Петля фаза-нуль', m: 36, types: ['grounding'] },
  { k: 'ktpm', n: 'КТПМ (трансформатор)', m: 36, types: ['transformer'] }
];
const reglament = () => jget('reglament', null) || REG_DEF;
const kusty = () => jget('kusty', []);
const saveKusty = list => lsSet('kusty', JSON.stringify(list));
const addMonths = (date, m) => { const d = new Date(date); d.setMonth(d.getMonth() + +m); return d.toISOString().slice(0, 10); };
const periodTxt = m => m % 12 === 0 ? `${m / 12} ${m / 12 === 1 ? 'год' : m / 12 < 5 ? 'года' : 'лет'}` : `${m} мес.`;
// Состояние одной проверки: просрочено / скоро (60 дней) / в порядке / не проводилось
function regState(kust, r) {
  const last = kust.tests?.[r.k];
  if (!last) return { cls: 'st-not', txt: 'нет данных', next: '' };
  const next = addMonths(last, r.m), days = (new Date(next) - new Date(new Date().toISOString().slice(0, 10))) / 864e5;
  return days < 0 ? { cls: 'st-over', txt: 'просрочено', next } : days <= 60 ? { cls: 'st-pending', txt: 'скоро', next } : { cls: 'st-sent', txt: 'в порядке', next };
}
function kustWorst(kust) {
  const st = reglament().map(r => regState(kust, r));
  return st.some(s => s.txt === 'просрочено') ? 'over' : st.some(s => s.txt === 'скоро') ? 'soon' : st.some(s => s.txt === 'нет данных') ? 'none' : 'ok';
}
const kustOverdue = () => kusty().filter(k => kustWorst(k) === 'over').length;
const mapUrl = k => k.lat && k.lon ? `https://yandex.ru/maps/?pt=${k.lon},${k.lat}&z=15&l=map` : `https://yandex.ru/maps/?text=${encodeURIComponent([k.field, 'куст', k.name].filter(Boolean).join(' '))}`;
const routeUrl = k => `https://yandex.ru/maps/?rtext=~${k.lat},${k.lon}&rtt=auto`;
// Когда протокол отправлен — у куста с таким же названием обновляется дата проверки
function kustMark(t) {
  if (t.outcome === 'notdone') return;
  const list = kusty(), norm = s => String(s || '').toLowerCase().replace(/куст\s*№?\s*/g, '').replace(/\s+/g, ' ').trim();
  const k = list.find(x => norm(x.name) === norm(t.object));
  if (!k) return;
  const date = t.date || new Date().toISOString().slice(0, 10);
  k.tests ||= {}; k.log ||= [];
  for (const r of reglament()) if (t.items.some(i => !i.skip && (r.types || []).includes(i.type))) {
    if (!k.tests[r.k] || k.tests[r.k] < date) k.tests[r.k] = date;
    k.log.unshift({ date, what: r.n, task: t.number });
  }
  k.log = k.log.slice(0, 50);
  saveKusty(list);
}
let kustQ = '', kustF = 'all';
function viewKusty(role) {
  header('Кусты', homeOf(role));
  const all = kusty().sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true }));
  const cnt = { all: all.length, over: 0, soon: 0, none: 0 };
  all.forEach(k => { const w = kustWorst(k); if (cnt[w] !== undefined) cnt[w]++; });
  const F = [['all', 'Все'], ['over', 'Просрочено'], ['soon', 'Скоро'], ['none', 'Нет данных']];
  app.innerHTML = `<div class="kust-search"><input id="kq" type="search" placeholder="Поиск: номер куста или месторождение" value="${esc(kustQ)}" autocomplete="off"></div>
    <div class="seg" style="--n:4">${F.map(([k, l]) => `<button class="seg-b ${k === kustF ? 'on' : ''}" data-kf="${k}"><b>${cnt[k]}</b><span>${l}</span></button>`).join('')}</div>
    <div id="kl"></div>
    <div class="actions mt"><a class="btn accent small" href="#/${role}/kust/new">+ Добавить куст</a><a class="btn ghost small" href="#/${role}/kustimport">Загрузить список</a></div>
    <a class="btn ghost small mt" href="#/${role}/reglament">Регламент: что и как часто проверяем</a>`;
  const draw = () => {
    const q = kustQ.trim().toLowerCase();
    const list = all.filter(k => (kustF === 'all' || kustWorst(k) === kustF) && (!q || `${k.name} ${k.field || ''}`.toLowerCase().includes(q)))
      .sort((a, b) => q ? (+!a.name.toLowerCase().startsWith(q)) - (+!b.name.toLowerCase().startsWith(q)) : 0);
    $('#kl').innerHTML = list.map(k => {
      const w = kustWorst(k), nexts = reglament().map(r => regState(k, r).next).filter(Boolean).sort();
      return `<div class="card kust-c ${w}"><a class="task" href="#/${role}/kust/${k.id}"><div class="top-line"><span>${esc(k.field || '')}</span>
        <span class="badge ${w === 'over' ? 'st-over' : w === 'soon' ? 'st-pending' : w === 'ok' ? 'st-sent' : 'st-new'}">${{ over: 'Просрочено', soon: 'Скоро проверка', ok: 'В порядке', none: 'Нет данных' }[w]}</span></div>
        <div class="obj">Куст ${esc(k.name)}</div>${nexts.length ? `<p class="meta">Ближайшая проверка: <b>${fmtDate(nexts[0])}</b></p>` : ''}</a>
        <a class="btn ghost small map-btn" href="${mapUrl(k)}" target="_blank" rel="noopener">${icon('pin')} На карте</a></div>`;
    }).join('') || `<div class="card meta">${all.length ? 'Ничего не найдено.' : 'Список кустов пуст. Добавьте кусты по одному или загрузите списком.'}</div>`;
  };
  draw();
  $('#kq').oninput = e => { kustQ = e.target.value; draw(); };
  app.onclick = e => { const f = e.target.closest('[data-kf]'); if (f) { kustF = f.dataset.kf; viewKusty(role); } };
}
function viewKust(role, id) {
  const list = kusty(), old = id !== 'new' ? list.find(k => k.id === id) : null;
  if (id !== 'new' && !old) { location.hash = `/${role}/kusty`; return; }
  header(old ? `Куст ${old.name}` : 'Новый куст', `/${role}/kusty`);
  const k = old || { name: '', field: '', lat: '', lon: '', note: '', tests: {}, log: [] };
  const regs = reglament();
  app.innerHTML = `${old ? `<div class="actions"><a class="btn accent small" href="${mapUrl(k)}" target="_blank" rel="noopener">${icon('pin')} Показать на карте</a>
      ${k.lat && k.lon ? `<a class="btn ghost small" href="${routeUrl(k)}" target="_blank" rel="noopener">Маршрут</a>` : ''}</div>
    <button class="btn ghost small mt" id="kTask">+ Заявка на этот куст</button>
    <div class="card mt"><h3>Испытания по регламенту</h3>${regs.map(r => { const s = regState(k, r);
      return `<div class="reg-row"><div><b>${esc(r.n)}</b><br><span class="meta">Раз в ${periodTxt(r.m)}${s.next ? ` · следующее: <b>${fmtDate(s.next)}</b>` : ''}</span></div>
        <span class="badge ${s.cls}">${s.txt}</span>
        <label class="field reg-date"><span class="lbl">Проводилось</span><input type="date" data-rt="${r.k}" value="${esc(k.tests?.[r.k] || '')}"></label></div>`; }).join('')}
      <p class="hint">Дата ставится сама, когда отправлен протокол по заявке с этим кустом в поле «Объект». Можно поправить вручную.</p></div>
    ${k.log?.length ? `<details class="card"><summary><b>История</b></summary><ul class="acks">${k.log.map(l => `<li>${fmtDate(l.date)} — ${esc(l.what)}${l.task ? ` (заявка ${esc(l.task)})` : ''}</li>`).join('')}</ul></details>` : ''}` : ''}
    <form class="card" id="kf"><h3>${old ? 'Данные куста' : 'Новый куст'}</h3>
      <label class="field"><span class="lbl">Номер или название куста <b class="req">*</b></span><input name="name" value="${esc(k.name)}" autocomplete="off" placeholder="Например, 125"></label>
      <label class="field"><span class="lbl">Месторождение</span><input name="field" value="${esc(k.field || '')}" autocomplete="off"></label>
      <div class="pc-row"><label class="field"><span class="lbl">Широта</span><input name="lat" inputmode="decimal" value="${esc(k.lat || '')}" placeholder="61.2541"></label>
      <label class="field"><span class="lbl">Долгота</span><input name="lon" inputmode="decimal" value="${esc(k.lon || '')}" placeholder="73.3962"></label></div>
      <button type="button" class="btn ghost small" id="kHere">${icon('pin')} Я сейчас на этом кусте — взять координаты</button>
      <label class="field mt"><span class="lbl">Примечание</span><textarea name="note" rows="2">${esc(k.note || '')}</textarea></label>
      <button class="btn accent" type="submit">Сохранить</button>
      ${old ? '<button type="button" class="btn ghost danger mt" id="kDel">Удалить куст</button>' : ''}</form>`;
  const f = $('#kf');
  $('#kHere').onclick = async () => {
    try { const c = await getPos(); f.lat.value = c.latitude.toFixed(5); f.lon.value = c.longitude.toFixed(5); toast('Координаты взяты с телефона'); }
    catch (e) { toast('Не получилось: ' + e.message); }
  };
  f.onsubmit = e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f));
    const num = x => String(x).replace(',', '.').trim();
    if (!fd.name.trim()) { toast('Укажите номер куста'); return; }
    const nk = { ...k, id: k.id || 'k' + Date.now(), name: fd.name.trim(), field: fd.field.trim(), lat: num(fd.lat), lon: num(fd.lon), note: fd.note.trim() };
    const l = kusty().filter(x => x.id !== nk.id); l.push(nk); saveKusty(l);
    toast('Куст сохранён'); location.hash = `/${role}/kust/${nk.id}`; if (old) viewKust(role, nk.id);
  };
  app.onchange = e => {
    const rt = e.target.dataset.rt; if (!rt) return;
    const l = kusty(), x = l.find(y => y.id === k.id); x.tests ||= {};
    if (e.target.value) x.tests[rt] = e.target.value; else delete x.tests[rt];
    saveKusty(l); toast('Дата сохранена'); viewKust(role, k.id);
  };
  const del = $('#kDel');
  if (del) del.onclick = () => { if (!confirm(`Удалить куст ${k.name}?`)) return; saveKusty(kusty().filter(x => x.id !== k.id)); toast('Удалено'); location.hash = `/${role}/kusty`; };
  const kt = $('#kTask');
  if (kt) kt.onclick = () => { sessionStorage.setItem('prefillObject', JSON.stringify({ object: `Куст ${k.name}`, address: k.field || '' })); location.hash = `/${role === 'b' ? 'b' : 'e'}/new`; };
}
// Загрузка списка: из Excel — скопировать столбцы и вставить; или файл CSV
function viewKustImport(role) {
  header('Загрузить кусты', `/${role}/kusty`);
  app.innerHTML = `<div class="card"><p>Каждый куст — с новой строки, через точку с запятой или табуляцию:</p>
    <p class="meta"><b>Номер куста; Месторождение; Широта; Долгота</b><br>Например: <code>125; Ватьеганское; 62.1234; 74.5678</code></p>
    <p class="meta">Из Excel: выделите 4 столбца, скопируйте и вставьте сюда. Координаты можно не указывать.</p>
    <textarea id="kt" rows="8" placeholder="125; Ватьеганское; 62.1234; 74.5678"></textarea>
    <label class="btn ghost small file-btn mt">Выбрать файл CSV или TXT<input type="file" accept=".csv,.txt,text/plain,text/csv" id="kfile"></label>
    <div class="gap"></div><button class="btn accent" id="kGo">Загрузить</button></div>`;
  $('#kfile').onchange = async e => { const file = e.target.files[0]; if (file) $('#kt').value = await file.text(); };
  $('#kGo').onclick = () => {
    const rows = $('#kt').value.split(/\r?\n/).map(l => l.split(/\t|;/).map(x => x.trim())).filter(r => r[0] && !/^(номер|куст|название)$/i.test(r[0]));
    if (!rows.length) { toast('Нет строк для загрузки'); return; }
    const list = kusty(); let added = 0, upd = 0;
    for (const [name, field = '', lat = '', lon = ''] of rows) {
      const nm = name.replace(/^куст\s*№?\s*/i, '');
      const ex = list.find(k => k.name.toLowerCase() === nm.toLowerCase() && (k.field || '') === field);
      const c = { lat: lat.replace(',', '.'), lon: lon.replace(',', '.') };
      if (ex) { if (c.lat) Object.assign(ex, c); upd++; }
      else { list.push({ id: 'k' + Date.now() + '_' + added, name: nm, field, ...c, tests: {}, log: [] }); added++; }
    }
    saveKusty(list); toast(`Добавлено: ${added}${upd ? `, обновлено: ${upd}` : ''}`); location.hash = `/${role}/kusty`;
  };
}
function viewReglament(role) {
  header('Регламент', `/${role}/kusty`);
  const regs = reglament();
  const typeOpts = Object.entries(WORK_TYPES).sort((a, b) => a[1].code.localeCompare(b[1].code, 'ru', { numeric: true }));
  app.innerHTML = `<p class="meta">Что проверяем на кустах и как часто. Испытание из заявки само обновит дату у куста.</p><div class="gap"></div>
    ${regs.map((r, i) => `<div class="card"><label class="field"><span class="lbl">Проверка</span><input data-ri="${i}" data-rf="n" value="${esc(r.n)}"></label>
      <div class="pc-row"><label class="field"><span class="lbl">Периодичность, мес.</span><input data-ri="${i}" data-rf="m" type="number" min="1" value="${r.m}"><span class="hint">${periodTxt(r.m)}</span></label>
      <label class="field"><span class="lbl">Испытание в заявке</span><select data-ri="${i}" data-rf="types"><option value="">— вручную —</option>${typeOpts.map(([k, w]) => `<option value="${k}" ${(r.types || [])[0] === k ? 'selected' : ''}>${esc(w.short)}</option>`).join('')}</select></label></div>
      <button type="button" class="btn ghost small danger" data-rdel="${i}">Удалить</button></div>`).join('')}
    <button class="btn accent" id="rAdd">+ Добавить проверку</button>
    <button class="btn ghost small mt" id="rReset">Вернуть как было</button>`;
  const save = l => { lsSet('reglament', JSON.stringify(l)); };
  app.onchange = e => {
    const i = e.target.dataset.ri; if (i === undefined) return;
    const l = reglament(), f = e.target.dataset.rf;
    l[+i][f] = f === 'm' ? Math.max(1, +e.target.value || 12) : f === 'types' ? (e.target.value ? [e.target.value] : []) : e.target.value.trim();
    save(l); toast('Сохранено'); if (f === 'm') viewReglament(role);
  };
  app.onclick = e => {
    const d = e.target.closest('[data-rdel]');
    if (d) { const l = reglament(); if (!confirm(`Удалить «${l[+d.dataset.rdel].n}»?`)) return; l.splice(+d.dataset.rdel, 1); save(l); viewReglament(role); }
    if (e.target.id === 'rAdd') { const l = reglament(); l.push({ k: 'r' + Date.now(), n: 'Новая проверка', m: 12, types: [] }); save(l); viewReglament(role); }
    if (e.target.id === 'rReset' && confirm('Вернуть регламент по умолчанию?')) { lsSet('reglament', ''); viewReglament(role); }
  };
}

// ===================== Отправка протокола в мессенджер =====================
// Файл протокола (откроется на любом телефоне и распечатается) + короткий текст.
async function protocolFile(t) {
  await loadPaperDevices();
  let css = '';
  try { css = await (await fetch('styles.css')).text(); } catch (e) {}
  const items = t.items.map((it, k) => [it, k]).filter(([it]) => !it.skip);
  const body = t.outcome === 'notdone' ? `<p>Заявка ${esc(t.number)}, ${esc(t.object)}: работа не выполнялась. Причина: ${esc(t.reason || '')}</p>`
    : items.map(([it, k]) => paperHTML(t, it, k)).join('<div style="page-break-after:always;height:24px"></div>');
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Протокол — ${esc(t.object)}</title>
    <style>${css}\nbody{background:#fff}main{padding:12px}.no-print{display:none}</style></head><body><main>${body}</main></body></html>`;
  const safe = s => String(s).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 40);
  return new File([html], `Протокол_${safe(t.number)}_${safe(t.object)}.html`, { type: 'text/html' });
}
function protocolText(t) {
  const lines = [`Заявка ${t.number} · ${t.object}${t.date ? ' · ' + fmtDate(t.date) : ''}`];
  if (t.outcome === 'notdone') lines.push(`Работа не выполнялась. Причина: ${t.reason || 'не указана'}`);
  else t.items.forEach(it => lines.push(`• ${typeName(it.type)}${it.skip ? ' — не проводилось' : it.values.proto_no ? ` — протокол № ${it.values.proto_no}` : ''}${!it.skip && it.values.conclusion ? (isFit(it.values) ? ' — годно' : ' — НЕ ГОДНО') : ''}`));
  lines.push('Протокол во вложении (открывается в браузере, можно распечатать).');
  return lines.join('\n');
}
async function shareProtocol(t) {
  const text = protocolText(t);
  let file = null;
  try { file = await protocolFile(t); } catch (e) {}
  try {
    if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `Заявка ${t.number}`, text }); return; }
    if (navigator.share) { await navigator.share({ title: `Заявка ${t.number}`, text }); toast('Отправлен текст. Файл этот телефон приложить не дал'); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  // Компьютер или старый телефон: скачиваем файл и копируем текст
  if (file) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
  try { await navigator.clipboard.writeText(text); } catch (e) {}
  toast('Файл сохранён, текст скопирован — вставьте в Telegram или MAX');
}
const shareBtnHTML = () => `<button type="button" class="btn ghost share-btn" data-share>${icon('send')} Отправить в мессенджер</button>`;

// ===================== Телефонный справочник =====================
// Все рабочие контакты (не только монтёры): ФИО, должность, подразделение, телефоны. Нажал на номер — звонок.
const phones = () => jget('phonebook', []);
const savePhones = l => lsSet('phonebook', JSON.stringify(l));
const telHref = p => 'tel:' + String(p).replace(/[^\d+]/g, '');
let phoneQ = '';
function viewPhones(role) {
  header('Телефоны', homeOf(role));
  const all = phones().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  app.innerHTML = `<div class="kust-search"><input id="pq" type="search" placeholder="Поиск: фамилия, должность, номер" value="${esc(phoneQ)}" autocomplete="off"></div>
    <p class="meta ph-count" id="pc"></p><div id="pl"></div>
    <div class="actions mt"><a class="btn accent small" href="#/${role}/phone/new">+ Добавить</a><a class="btn ghost small" href="#/${role}/phoneimport">Загрузить список</a></div>`;
  const draw = () => {
    const q = phoneQ.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    const list = all.filter(c => !q || `${c.name} ${c.pos || ''} ${c.dep || ''} ${c.note || ''}`.toLowerCase().includes(q) || (qd.length > 2 && (c.phones || []).some(p => p.replace(/\D/g, '').includes(qd))))
      .sort((a, b) => q ? (+!a.name.toLowerCase().startsWith(q)) - (+!b.name.toLowerCase().startsWith(q)) : 0);
    $('#pc').textContent = all.length ? `Контактов: ${list.length}${q ? ' из ' + all.length : ''}` : '';
    $('#pl').innerHTML = list.map(c => `<div class="card ph-c"><a class="task" href="#/${role}/phone/${c.id}"><div class="obj">${esc(c.name)}</div>
      ${c.pos || c.dep ? `<p class="meta">${esc([c.pos, c.dep].filter(Boolean).join(' · '))}</p>` : ''}</a>
      <div class="ph-nums">${(c.phones || []).map(p => `<a class="ph-num" href="${telHref(p)}">📞 ${esc(p)}</a>`).join('')}</div></div>`).join('')
      || `<div class="card meta">${all.length ? 'Никого не нашли.' : 'Справочник пуст. Добавьте контакты по одному или загрузите списком.'}</div>`;
  };
  draw();
  $('#pq').oninput = e => { phoneQ = e.target.value; draw(); };
}
function viewPhone(role, id) {
  const old = id !== 'new' ? phones().find(c => c.id === id) : null;
  if (id !== 'new' && !old) { location.hash = `/${role}/phones`; return; }
  header(old ? 'Контакт' : 'Новый контакт', `/${role}/phones`);
  const c = old || { name: '', pos: '', dep: '', phones: [], note: '' };
  app.innerHTML = `<form class="card" id="cf">
    <label class="field"><span class="lbl">Фамилия, имя, отчество <b class="req">*</b></span><input name="name" value="${esc(c.name)}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Должность</span><input name="pos" value="${esc(c.pos || '')}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Подразделение, организация</span><input name="dep" value="${esc(c.dep || '')}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Телефоны (каждый с новой строки)</span><textarea name="phones" rows="3" inputmode="tel">${esc((c.phones || []).join('\n'))}</textarea></label>
    <label class="field"><span class="lbl">Примечание</span><input name="note" value="${esc(c.note || '')}" autocomplete="off"></label>
    <button class="btn accent" type="submit">Сохранить</button>
    ${old ? '<button type="button" class="btn ghost danger mt" id="cDel">Удалить контакт</button>' : ''}</form>`;
  $('#cf').onsubmit = e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    if (!fd.name.trim()) { toast('Укажите ФИО'); return; }
    const nc = { ...c, id: c.id || 'c' + Date.now(), name: fd.name.trim(), pos: fd.pos.trim(), dep: fd.dep.trim(), note: fd.note.trim(), phones: fd.phones.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean) };
    savePhones([...phones().filter(x => x.id !== nc.id), nc]); toast('Контакт сохранён'); location.hash = `/${role}/phones`;
  };
  const del = $('#cDel');
  if (del) del.onclick = () => { if (!confirm(`Удалить «${c.name}»?`)) return; savePhones(phones().filter(x => x.id !== c.id)); toast('Удалено'); location.hash = `/${role}/phones`; };
}
function viewPhoneImport(role) {
  header('Загрузить телефоны', `/${role}/phones`);
  app.innerHTML = `<div class="card"><p>Каждый человек — с новой строки, через точку с запятой или табуляцию:</p>
    <p class="meta"><b>ФИО; Должность; Подразделение; Телефон; Ещё телефон</b><br>Из Excel: выделите столбцы, скопируйте и вставьте сюда.</p>
    <textarea id="kt" rows="8" placeholder="Иванов Иван Иванович; Мастер; ЦДНГ-2; +7 900 000-00-00"></textarea>
    <label class="btn ghost small file-btn mt">Выбрать файл CSV или TXT<input type="file" accept=".csv,.txt,text/plain,text/csv" id="kfile"></label>
    <div class="gap"></div><button class="btn accent" id="kGo">Загрузить</button></div>`;
  $('#kfile').onchange = async e => { const file = e.target.files[0]; if (file) $('#kt').value = await file.text(); };
  $('#kGo').onclick = () => {
    const rows = $('#kt').value.split(/\r?\n/).map(l => l.split(/\t|;/).map(x => x.trim())).filter(r => r[0] && !/^(фио|ф\.и\.о\.|фамилия)/i.test(r[0]));
    if (!rows.length) { toast('Нет строк для загрузки'); return; }
    const list = phones(); let added = 0, upd = 0;
    rows.forEach(([name, pos = '', dep = '', ...ph], i) => {
      const nums = ph.flatMap(p => p.split(/,/)).map(x => x.trim()).filter(Boolean);
      const ex = list.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (ex) { Object.assign(ex, { pos: pos || ex.pos, dep: dep || ex.dep, phones: [...new Set([...(ex.phones || []), ...nums])] }); upd++; }
      else { list.push({ id: 'c' + Date.now() + '_' + i, name, pos, dep, phones: nums, note: '' }); added++; }
    });
    savePhones(list); toast(`Добавлено: ${added}${upd ? `, обновлено: ${upd}` : ''}`); location.hash = `/${role}/phones`;
  };
}


// ===================== Приборы: проверенные данные =====================
// Диапазоны и погрешности взяты из описаний типа (Госреестр СИ) и руководств производителей.
// Свидетельства о поверке и даты — из присланных протоколов.
const DEV_ROLES = [
  ['megger', 'Сопротивление изоляции (мегаомметр)'],
  ['hv', 'Повышенное напряжение переменного тока'],
  ['hv_dc', 'Повышенное выпрямленное напряжение'],
  ['wind', 'Сопротивление обмоток постоянному току'],
  ['contact', 'Сопротивление контактов (микроомметр)'],
  ['earth', 'Сопротивление заземления, металлосвязь'],
  ['loop', 'Петля «фаза-нуль»']
];
// Какие измерения нужны для каждого вида испытания (по разделам ПУЭ 1.8)
const DEV_FOR_TYPE = {
  '1.8.13': ['megger', 'wind'], '1.8.14': ['megger', 'wind'], '1.8.15': ['megger', 'wind'],
  '1.8.16': ['megger', 'hv', 'wind'], '1.8.17': ['megger', 'hv_dc'], '1.8.18': ['megger', 'wind', 'hv'],
  '1.8.19': ['megger', 'contact', 'hv'], '1.8.20': ['megger', 'contact', 'hv'], '1.8.21': ['megger', 'contact', 'hv'],
  '1.8.22': ['megger', 'contact', 'hv'], '1.8.23': ['megger', 'contact', 'hv'], '1.8.24': ['megger', 'contact', 'hv'],
  '1.8.25': ['megger', 'hv'], '1.8.26': ['megger', 'hv'], '1.8.27': ['megger', 'hv'], '1.8.28': ['megger', 'hv'],
  '1.8.29': ['megger', 'hv_dc'], '1.8.30': ['megger', 'hv_dc'], '1.8.31': ['megger', 'hv'], '1.8.32': ['megger', 'hv'],
  '1.8.33': ['megger', 'hv'], '1.8.34': ['megger', 'hv'], '1.8.35': ['megger', 'hv'], '1.8.36': [],
  '1.8.37': ['megger', 'loop'], '1.8.38': ['megger'], '1.8.39': ['earth', 'loop'], '1.8.40': ['megger', 'hv_dc'], '1.8.41': ['megger']
};
const DEV_ROLE_SHORT = { megger: 'изоляция', hv: 'повышенное ~', hv_dc: 'выпрямленное', wind: 'обмотки', contact: 'контакты', earth: 'заземление', loop: 'петля Ф-0' };
const devRoleName = r => DEV_ROLE_SHORT[r] || r;
// Роли для вида испытания (wt — запись из WORK_TYPES, у неё есть номер пункта ПУЭ code)
function rolesForType(wt) {
  if (!wt) return [];
  return DEV_FOR_TYPE[wt.code] || ['megger'];
}
// Приборы, которые нужны для набора испытаний (ключи WORK_TYPES)
function devicesForTypes(devs, keys) {
  const roles = new Set(keys.flatMap(k => rolesForType(WORK_TYPES[k])));
  return devs.filter(d => (d.roles || []).some(r => roles.has(r)));
}
const DEVICE_PRESET = [
  { name: 'Мегаомметр Е6-24', no: '23772', range: '0,01 МОм – 300 ГОм (500, 1000, 2500 В)', acc: '±(3 % + 3 е.м.р.) до 9,99 ГОм; ±(5 % + 5 е.м.р.) до 99,9 ГОм; ±(15 % + 10 е.м.р.) до 300 ГОм', roles: ['megger'], src: 'Описание типа СИ, Госреестр № 47135-11', cert: 'С-АХД/20-01-2026/499881362', date: '2026-01-20', next: '2027-01-19' },
  { name: 'Установка испытательная СВИ-100/140', no: '', range: 'переменное 10–100 кВ, постоянное 10–140 кВ', acc: '±2 %', roles: ['hv', 'hv_dc'], src: 'Описание типа СИ, Госреестр № 73144-18', cert: 'С-ДЭН/27-11-2025-484082537', date: '2025-11-27', next: '2027-11-26' },
  { name: 'Миллиомметр ПТФ-1', no: '4419', range: '0,0001–200 Ом', acc: '±(0,5 % + 1 е.м.р.)', roles: ['wind'], src: 'Описание типа СИ, Госреестр № 40520-09', cert: 'С-АХД/20-01-2025/406524643', date: '2026-01-20', next: '2027-01-19' },
  { name: 'Микроомметр ИКС-30А', no: '434', range: '1 мкОм – 100 кОм', acc: '±0,1 %', roles: ['contact'], src: 'Руководство по эксплуатации ПТМР.411212.024', cert: 'С-ГА/27-10-2023/291206404', date: '2023-10-27', next: '2028-10-27' },
  { name: 'Измеритель сопротивления заземления KEW 6016', no: '8334063', range: '0–2000 Ом (пределы 20 / 200 / 2000 Ом)', acc: '±(3 % + 0,1 Ом) на 20 Ом; ±(3 % + 3 е.м.р.) на 200 и 2000 Ом', roles: ['earth'], src: 'Руководство Kyoritsu KEW 6016', cert: 'С-ВЯ/07-04-2026/517665849', date: '2026-04-07', next: '2027-04-06' },
  { name: 'Измеритель параметров электробезопасности MPI-530', no: 'АН7709', range: 'петля Zs 0,13–1999,9 Ом; заземление 0,5 Ом – 1,99 кОм', acc: 'петля ±(5 % + 30 е.м.р.); заземление ±(2 % + 4 е.м.р.)', roles: ['loop', 'earth'], src: 'Руководство Sonel MPI-530', cert: 'С-ВВО/17-10-2025/474838401', date: '2025-10-17', next: '2026-10-16' },
  { name: 'Аппарат испытания диэлектриков АИД-70', no: '2339', range: 'выпрямленное 10–70 кВ', acc: '±3 % по напряжению; ±5 % по току', roles: ['hv_dc'], src: 'Паспорт АИД-70Ц / описание типа АИД-70М (модификацию уточнить)', cert: '3226282/2039/1', date: '2025-11-05', next: '2026-11-04' }
];
// Старые названия из протоколов → новые, чтобы обновить уже добавленные приборы
const DEV_OLD_NAMES = {
  'Измеритель параметров заземляющих устройств KEW 6016': 'Измеритель сопротивления заземления KEW 6016',
  'Измеритель петли фаза-нуль MPI-530': 'Измеритель параметров электробезопасности MPI-530',
  'Высоковольтная установка АИД-70': 'Аппарат испытания диэлектриков АИД-70'
};
// Добавляет недостающие приборы и исправляет диапазоны/погрешности у уже добавленных.
// Свидетельства и даты поверки, которые человек поменял сам, не трогаем.
async function addPresetDevices() {
  const devs = (await docsAll()).filter(d => d.kind === 'device');
  let added = 0, fixed = 0;
  for (const [i, p] of DEVICE_PRESET.entries()) {
    const ex = devs.find(d => d.no === p.no && (d.name === p.name || DEV_OLD_NAMES[d.name] === p.name));
    if (ex) {
      if (ex.presetV === 2) continue;
      const oldLabel = devLabel(ex);
      Object.assign(ex, { name: p.name, range: p.range, acc: p.acc, roles: p.roles, src: p.src, presetV: 2 });
      await docPut(ex);
      if (oldLabel !== devLabel(ex)) { removeFromList('devices', oldLabel); addToList('devices', [devLabel(ex)]); }
      fixed++; continue;
    }
    await docPut({ ...p, id: 'vp' + Date.now() + i, kind: 'device', created: Date.now(), files: [], presetV: 2 });
    addToList('devices', [devLabel(p)]); added++;
  }
  return { added, fixed };
}
