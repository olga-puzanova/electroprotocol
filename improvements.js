'use strict';

const APP_RELEASE = 'psgi-2026-11-17-v23';
const RELEASE_NOTES = ['Ноябрьское нормированное задание автоматически доступно по фотографиям: 41 строка с объёмами, нормами и формулами. Загружать файл не нужно. Сохранённые задания не перезаписываются.'];
const UNITS_TO_MOHM = { 'кОм': .001, 'МОм': 1, 'ГОм': 1000 };
function resistanceCanonical(value, unit) {
  if (!String(value ?? '').trim()) return '';
  const match = String(value).trim().match(/^(>=|<=|≥|≤|>|<)?\s*([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))$/);
  if (!match) return value;
  return (match[1] || '') + Number((Number(match[2].replace(',', '.')) * (UNITS_TO_MOHM[unit] || 1)).toPrecision(12));
}
function resistanceDisplay(value, unit) {
  if (!String(value ?? '').trim()) return '';
  const match = String(value).match(/^(>=|<=|≥|≤|>|<)?\s*([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))$/);
  if (!match) return value;
  return (match[1] || '') + String(Number((Number(match[2].replace(',', '.')) / (UNITS_TO_MOHM[unit] || 1)).toPrecision(12))).replace('.', ',');
}
function measurementText(field, values) {
  const value = values[field.id];
  const resistance = field.unit === 'МОм' || /(?:,|\s)МОм$/.test(field.label || '');
  const unit = resistance ? values._units?.[field.id] || 'МОм' : field.unit;
  return showVal(field, resistance ? resistanceDisplay(value, unit) : value) + (unit ? ' ' + unit : '');
}

const currentRole = () => ['e', 'm', 'b'].includes(location.hash.split('/')[1]) ? location.hash.split('/')[1] : lsGet('role') || 'e';
const isManager = role => role === 'b' || role === 'm';
const docForPerson = (doc, name) => !doc.recipients?.length || (!!name && doc.recipients.includes(name));
const assignedTraining = () => jget('psgiTraining', []);
const personalTrainingPending = () => assignedTraining().filter(t => t.person === me() && !t.completedAt).length;
const managerEvents = docs => [
  ...Object.entries(manualAcks()).flatMap(([key, acks]) => acks.map(a => ({ id: `manual:${key}:${a.name}:${a.at}`, at: a.at }))),
  ...docs.filter(d => d.kind === 'info').flatMap(d => acksOf(d).map(a => ({ id: `ack:${d.id}:${a.name}:${a.at}`, at: a.at }))),
  ...quizResults().map(r => ({ id: `quiz:${r.name}:${r.week}:${r.at}`, at: r.at })),
  ...assignedTraining().filter(t => t.completedAt).map(t => ({ id: `training:${t.id}:${t.completedAt}`, at: t.completedAt }))
];
const managerReadKey = () => `psgiManagerRead:${currentRole()}:${me() || 'manager'}`;
const managerUnread = docs => { const read = new Set(jget(managerReadKey(), [])); return managerEvents(docs).filter(e => !read.has(e.id)).length; };
async function markManagerRead() { lsSet(managerReadKey(), JSON.stringify(managerEvents(await docsAll()).map(e => e.id))); }
const registrationNumbers = t => t.items.filter(i => !i.skip).map(i => String(i.values.proto_no || '').trim()).join('|');
const needsRegistration = t => t.status === 'sent' && t.outcome !== 'notdone' && t.items.some(i => !i.skip) && (t.items.some(i => !i.skip && !String(i.values.proto_no || '').trim()) || t.registrationShared !== registrationNumbers(t));
const assetHistoryTime = item => new Date(item.date || 0).getTime() || item.recordedAt || 0;
const latestAssetTest = asset => (asset.history || []).slice().sort((a, b) => assetHistoryTime(b) - assetHistoryTime(a) || b.recordedAt - a.recordedAt)[0];

// The original IndexedDB and keys remain in place so installed users keep data.
async function rememberEquipment(task) {
  for (const [index, item] of task.items.entries()) {
    const v = item.values;
    if (item.skip || !(v.asset_tag || v.serial || item.assetId)) continue;
    const all = await docsAll();
    let asset = item.assetId ? all.find(a => a.kind === 'asset' && a.id === item.assetId) : all.find(a => a.kind === 'asset' && a.object === task.object && a.tag === (v.asset_tag || '') && a.serial === (v.serial || ''));
    asset ||= { id: 'asset-' + crypto.randomUUID(), kind: 'asset', history: [], created: Date.now() };
    const snapshot = { taskId: task.id, itemIndex: index, type: item.type, date: v.proto_date || task.date, recordedAt: task.editedAt || task.sentAt || Date.now(), number: v.proto_no || '', values: JSON.parse(JSON.stringify(v)) };
    asset = { ...asset, name: v.asset_name || v.m_type || v.tr_type || v.eq_type || task.equipment || typeName(item.type), object: task.object, tag: v.asset_tag || asset.tag || '', serial: v.serial || asset.serial || '', kustId: v.kust_id || asset.kustId || '', updated: Date.now() };
    asset.history = [...(asset.history || []).filter(h => !(h.taskId === task.id && h.itemIndex === index)), snapshot];
    await docPut(asset);
  }
}

const THERMAL_SECTION = {
  title: 'Тепловизионный контроль', fields: [
    { id: 'thermal_result', label: 'Результат контроля', type: 'select', options: ['Не проводился', 'Нагрев не обнаружен', 'Обнаружен нагрев'] },
    { id: 'thermal_breaker', label: 'Номер автомата / обозначение узла', type: 'text' },
    { id: 'thermal_temp', label: 'Измеренная температура', type: 'number', unit: '°C', signed: true },
    { id: 'thermal_reference', label: 'Температура сравнения', type: 'number', unit: '°C', signed: true },
    { id: 'thermal_comment', label: 'Где обнаружен нагрев и что требуется сделать', type: 'textarea' }
  ]
};
const ASSET_SECTION = {
  title: 'Оборудование и привязка к кусту', fields: [
    { id: 'asset_name', label: 'Название оборудования', type: 'text' },
    { id: 'asset_tag', label: 'Инвентарный / позиционный номер', type: 'text', hint: 'Номер отличает этот двигатель или аппарат от других на объекте.' },
    { id: 'kust_id', label: 'Куст', type: 'select', options: [] }
  ]
};
for (const wt of Object.values(WORK_TYPES)) {
  // The same section objects are shared by some forms. Only mutate the form array.
  wt.form = [...wt.form];
  wt.form.splice(1, 0, ASSET_SECTION);
  wt.form.splice(wt.form.length - 1, 0, THERMAL_SECTION);
  const originalCheck = wt.check;
  wt.check = values => {
    const result = originalCheck(values);
    if (values.thermal_result === 'Обнаружен нагрев') result.thermal_result = info(null, 'Обнаружен нагрев. Оценка по методике с учётом нагрузки и условий измерения.');
    return result;
  };
}

WORK_TYPES.technical_survey = {
  code: '', short: 'Техническое освидетельствование', title: 'Техническое освидетельствование электрооборудования',
  briefing: COMMON_BRIEFING, potee: POTEE_COMMON,
  steps: [{ title: 'Объём работ', text: 'Зафиксируйте состав оборудования, состояние и решение комиссии по утверждённой программе освидетельствования.' }],
  form: [PROTO_SECTION, ASSET_SECTION,
    { title: 'Техническое состояние', fields: [
      { id: 'survey_scope', label: 'Состав оборудования и объём освидетельствования', type: 'textarea' },
      { id: 'survey_docs', label: 'Проверенная документация, предыдущие протоколы', type: 'textarea' },
      { id: 'survey_condition', label: 'Состояние, дефекты и выполненные мероприятия', type: 'textarea' },
      { id: 'survey_decision', label: 'Решение комиссии и срок следующего освидетельствования', type: 'textarea' }
    ] }, THERMAL_SECTION, CONCLUSION], check: () => ({})
};
const KTPN_TYPES = ['transformer', 'p1_8_31', 'p1_8_27', 'p1_8_33', 'p1_8_34', 'p1_8_35'];
DEV_ROLES.push(['impulse', 'Испытание импульсным напряжением']);
WORK_TYPES.impulse_test = {
  code: '', short: 'Испытание импульсным напряжением', title: 'Испытание импульсным напряжением по утверждённой программе', deviceRoles: ['impulse'],
  briefing: [...COMMON_BRIEFING, ...HV_BRIEFING], potee: POTEE_COMMON,
  steps: [{ title: 'Программа испытания', text: 'Параметры и порядок берутся из утверждённой программы и руководства специализированной установки. Автоматического подбора напряжения и оценки норм здесь нет.' }],
  form: [PROTO_SECTION, ASSET_SECTION, { title: 'Параметры по программе', fields: [
    { id: 'impulse_method', label: 'Методика / программа, версия', type: 'text', required: true },
    { id: 'impulse_equipment', label: 'Специализированная испытательная установка', type: 'text', required: true },
    { id: 'impulse_shape', label: 'Форма и полярность импульса по программе', type: 'text' },
    { id: 'impulse_voltage', label: 'Амплитуда по программе', type: 'number', unit: 'кВ' },
    { id: 'impulse_count', label: 'Количество импульсов', type: 'number' },
    { id: 'impulse_result', label: 'Результат испытания', type: 'select', options: RESULT },
    { id: 'impulse_observations', label: 'Наблюдения и запись осциллограмм', type: 'textarea' }
  ] }, THERMAL_SECTION, CONCLUSION], check: v => { const result = {}; resultCheck(result, 'impulse_result', v.impulse_result); return result; }
};

const CHECKLIST_ITEMS = ['Выдать задание', 'Заполнить журнал', 'Выдать инструктаж', 'Подготовить рабочее место', 'Проверить, что взять для работы', 'Выписать наряд'];
const REGISTERS = { ppe: 'Выдача СИЗ', briefings: 'Инструктажи и методики', knowledge: 'Проверка знаний', emergency: 'ГО и ЧС', ppe_tests: 'Испытания СИЗ' };
const saveRegister = entries => lsSet('psgiRegisters', JSON.stringify(entries));
const registerEntries = () => jget('psgiRegisters', []);
const byNewest = (a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0);
function roleTiles(role) {
  const items = [['guides', 'book', 'Наглядные инструкции'], ['monthly', 'clipboard', 'Нормированное задание по месяцам'], ['ideas', 'bolt', 'Рационализаторские предложения'], ['chat', 'people', 'Внутренний чат'], ['assets', 'meter', 'Оборудование'], ['kusty', 'rig', 'Кусты'], ['map', 'pin', 'Карта оборудования'], ['devices', 'meter', 'Приборы и паспорта'], ['training', 'book', 'Обучение'], ['cars', 'pin', 'Машины'], ['backup', 'gear', 'Данные и копии'], ['releases', 'info', 'Что нового']];
  if (isManager(role)) items.unshift(['registers', 'permit', 'СИЗ и журналы']);
  return `<div class="tiles">${items.map(([path, ic, title]) => tile(`#/${role}/${path}`, ic, title)).join('')}</div>`;
}
function viewMore(role) {
  header('Разделы', `/${role}`);
  app.innerHTML = `<h2>Рабочие разделы</h2>${roleTiles(role)}<div class="tiles">${tile(`#/${role}/phones`, 'phone', 'Телефоны')}${tile(`#/${role}/people`, 'people', 'Сотрудники')}${tile(`#/${role}/docs/permit`, 'permit', 'Наряды')}${tile('#/e/tb', 'book', 'Техника безопасности')}</div><a class="btn ghost mt" href="#/">Сменить роль</a>`;
}
function viewRegisters(role, kind) {
  header(kind ? REGISTERS[kind] || 'Журнал' : 'СИЗ и журналы', `/${role}/more`);
  if (!isManager(role)) { app.innerHTML = '<p>Журналы доступны в разделах мастера и начальника.</p>'; return; }
  if (!kind) { app.innerHTML = `<h2>Журналы и списки</h2><p class="meta">Записи сохраняются. Списки сотрудников, СИЗ и методик можно постепенно пополнять.</p><div class="tiles mt">${Object.entries(REGISTERS).map(([k, title]) => tile(`#/${role}/registers/${k}`, 'permit', title)).join('')}</div>`; return; }
  if (!REGISTERS[kind]) { location.hash = `/${role}/registers`; return; }
  const list = registerEntries().filter(x => x.kind === kind).sort(byNewest);
  app.innerHTML = `<form id="registerForm" class="card"><h3>Добавить запись</h3>
    <label class="field"><span class="lbl">Сотрудник</span><input name="person" list="regPeople" required></label><datalist id="regPeople">${getStaff().map(n => `<option>${esc(n)}</option>`).join('')}</datalist>
    <label class="field"><span class="lbl">${kind === 'briefings' ? 'Тема / методика' : kind === 'ppe' || kind === 'ppe_tests' ? 'Средство защиты, номер' : 'Название / тема'}</span><input name="title" list="regTitles" required></label><datalist id="regTitles">${[...new Set(list.map(x => x.title))].map(t => `<option>${esc(t)}</option>`).join('')}</datalist>
    <label class="field"><span class="lbl">Дата</span><input type="date" name="date" value="${today()}" required></label>
    <label class="field"><span class="lbl">Следующая дата / срок</span><input type="date" name="next"></label>
    ${kind === 'briefings' ? '<label class="field"><span class="lbl">Норма времени, часов</span><input name="hours" inputmode="decimal"></label>' : ''}
    <label class="field"><span class="lbl">Комментарий / результат</span><textarea name="note"></textarea></label>
    <label class="field"><span class="lbl">Файл методики / подтверждающий документ</span><input type="file" name="attachment" accept="application/pdf,image/*"></label>
    <button class="btn accent">Сохранить запись</button></form>
    ${list.map(x => `<div class="card"><div class="top-line"><span>${fmtDate(x.date)}${x.next ? ' · следующий срок ' + fmtDate(x.next) : ''}</span><span class="badge ${x.next && x.next < today() ? 'st-not' : 'st-sent'}">${x.next && x.next < today() ? 'Срок прошёл' : 'Сохранено'}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.person)}</p><p class="meta">${esc(x.note || '')}${x.hours ? '<br>Норма времени: ' + esc(x.hours) + ' ч' : ''}</p>${x.file ? `<button class="btn ghost small mt" data-regfile="${x.id}">Открыть документ</button>` : ''}<div class="actions mt"><button class="btn ghost small" data-regedit="${x.id}">Изменить</button><button class="btn ghost small danger" data-regdelete="${x.id}">Удалить</button></div></div>`).join('') || '<p class="meta">Записей пока нет. Список и нормы времени добавим по твоим материалам.</p>'}`;
  let editId = null;
  $('#registerForm').onsubmit = async e => {
    e.preventDefault(); const f = e.target, values = Object.fromEntries(new FormData(f));
    if (!values.person.trim() || !values.title.trim()) return;
    const old = editId && registerEntries().find(x => x.id === editId);
    let file = old?.file;
    if (values.attachment?.size) { if (values.attachment.size > 15 * 1024 ** 2) { toast('Файл больше 15 МБ'); return; } file = { name: values.attachment.name, type: values.attachment.type, data: await readFile(values.attachment) }; }
    delete values.attachment;
    const entry = { ...old, ...values, file, person: values.person.trim(), title: values.title.trim(), kind, id: editId || crypto.randomUUID(), created: old?.created || Date.now(), updated: Date.now() };
    try { saveRegister([...registerEntries().filter(x => x.id !== entry.id), entry]); addStaff([entry.person]); viewRegisters(role, kind); toast('Запись сохранена'); } catch (error) { toast('Не удалось сохранить запись'); }
  };
  app.querySelectorAll('[data-regdelete]').forEach(b => b.onclick = () => { if (confirm('Удалить запись журнала?')) { saveRegister(registerEntries().filter(x => x.id !== b.dataset.regdelete)); viewRegisters(role, kind); } });
  app.querySelectorAll('[data-regfile]').forEach(b => b.onclick = () => openFile(list.find(x => x.id === b.dataset.regfile).file));
  app.querySelectorAll('[data-regedit]').forEach(b => b.onclick = () => {
    const x = list.find(x => x.id === b.dataset.regedit), f = $('#registerForm'); editId = x.id;
    for (const key of ['person', 'title', 'date', 'next', 'hours', 'note']) if (f.elements[key]) f.elements[key].value = x[key] || '';
    f.querySelector('h3').textContent = 'Изменить запись'; f.scrollIntoView({ behavior: 'smooth' });
  });
}

async function viewMaster() {
  header('Мастер', '/');
  const all = (await dbAll()).filter(t => !t.archived && (!me() || !t.assignedMaster || t.assignedMaster === me())).sort(byNew);
  const c = await counts();
  app.innerHTML = `<div class="workspace-heading"><h2>Подготовка работ</h2><p class="meta">Задания начальника и поручения бригаде</p></div><div class="tiles">${tile('#/m/docs/info', 'info', 'Информация', c.waiting)}${tile('#/m/registers', 'permit', 'СИЗ и журналы')}</div><a class="btn accent" href="#/m/new">+ Выдать задание</a><div class="gap"></div>
    ${all.map(t => `<div class="card master-task"><div class="top-line"><span>${esc(t.number)} · ${fmtDate(t.date)}</span><span class="badge ${stOf(t)[1]}">${stOf(t)[0]}</span></div><h3>${esc(t.object)}</h3><p class="meta">Мастер: ${esc(t.assignedMaster || 'не назначен')}<br>Электромонтёр: ${esc(t.assignedElectrician || 'не назначен')}</p><div class="master-checks">${CHECKLIST_ITEMS.map((label, i) => `<label><input type="checkbox" data-prep="${t.id}" data-step="${i}" ${t.preparation?.[i]?.done ? 'checked' : ''}><span>${label}${t.preparation?.[i]?.at ? `<small>${fmtDT(t.preparation[i].at)}</small>` : ''}</span></label>`).join('')}</div><label class="field"><span class="lbl">Что взять для работы</span><textarea data-pack="${t.id}">${esc(t.packingList || '')}</textarea></label><div class="actions"><a class="btn ghost small" href="#/m/edit/${t.id}">Поручить монтёру / изменить</a><a class="btn ghost small" href="#/m/task/${t.id}">Протоколы</a></div></div>`).join('') || '<div class="card meta">Активных заданий пока нет. Начальник может создать заявку и указать мастера.</div>'}`;
  app.querySelectorAll('[data-prep]').forEach(inp => inp.onchange = async () => {
    const t = await dbGet(inp.dataset.prep); if (!t) return;
    t.preparation ||= {}; t.preparation[inp.dataset.step] = { done: inp.checked, at: Date.now(), by: me() };
    await dbPut(t); toast('Подготовка сохранена');
  });
  app.querySelectorAll('[data-pack]').forEach(inp => inp.onchange = async () => { const t = await dbGet(inp.dataset.pack); if (t) { t.packingList = inp.value; await dbPut(t); toast('Список сохранён'); } });
}

async function viewAssets(role, id) {
  const all = (await docsAll()).filter(a => a.kind === 'asset').sort(byNewest);
  header(id ? 'История оборудования' : 'Оборудование', `/${role}/more`);
  if (!id) {
    app.innerHTML = `<div class="card"><h2>Оборудование и испытания</h2><p class="meta">Карточка появляется после завершения испытания с инвентарным или заводским номером. При следующем выезде можно выбрать её в протоколе и увидеть прошлые результаты.</p><input id="assetSearch" placeholder="Объект, название, номер" aria-label="Найти оборудование"></div><div id="assetList"></div>`;
    const draw = () => { const q = $('#assetSearch').value.toLowerCase(); $('#assetList').innerHTML = all.filter(a => [a.object, a.name, a.tag, a.serial].join(' ').toLowerCase().includes(q)).map(a => `<a class="card task" href="#/${role}/assets/${a.id}"><p class="meta">${esc(a.object)}</p><h3>${esc(a.name)}</h3><p class="meta">${esc([a.tag, a.serial && 'зав. № ' + a.serial].filter(Boolean).join(' · '))}<br>Испытаний: ${a.history?.length || 0}</p></a>`).join('') || '<div class="card meta">Оборудование не найдено.</div>'; };
    $('#assetSearch').oninput = draw; draw(); return;
  }
  const asset = all.find(a => a.id === id);
  if (!asset) { location.hash = `/${role}/assets`; return; }
  const kust = kusty().find(k => k.id === asset.kustId);
  app.innerHTML = `<div class="card"><h2>${esc(asset.name)}</h2><p>${esc(asset.object)}</p><p class="meta">Инвентарный № ${esc(asset.tag || '—')}<br>Заводской № ${esc(asset.serial || '—')}</p>${kust ? `<a class="btn ghost mt" href="${mapUrl(kust)}" target="_blank" rel="noopener">Куст ${esc(kust.name)} на карте</a>` : ''}</div>${(asset.history || []).slice().sort((a, b) => assetHistoryTime(b) - assetHistoryTime(a)).map(h => `<details class="card"><summary><b>${fmtDate(h.date)} · ${esc(typeName(h.type))}</b><br>Протокол № ${esc(h.number || 'не зарегистрирован')}</summary>${protocolHTML({ type: h.type, values: h.values, photos: [] }, 0, 1, true)}</details>`).join('')}`;
}

async function viewEquipmentMap(role) {
  header('Карта оборудования', `/${role}/more`);
  const assets = (await docsAll()).filter(d => d.kind === 'asset'), sites = kusty();
  const coordinates = sites.filter(k => k.lat !== '' && k.lon !== '' && Number.isFinite(+k.lat) && Number.isFinite(+k.lon) && Math.abs(+k.lat) <= 90 && Math.abs(+k.lon) <= 180);
  const points = coordinates.map(k => { const hot = assets.some(a => a.kustId === k.id && latestAssetTest(a)?.values?.thermal_result === 'Обнаружен нагрев'); return `${+k.lon},${+k.lat},${hot ? 'pm2rdm' : 'pm2blm'}`; });
  const url = points.length ? 'https://yandex.ru/maps/?l=map&pt=' + encodeURIComponent(points.join('~')) : '';
  app.innerHTML = `<div class="card"><h2>Кусты и оборудование</h2><p class="meta">Синяя отметка — куст, красная — есть запись о нагреве в последнем испытании оборудования. Нагрев требует оценки с учётом условий измерения.</p>${url ? `<a class="btn accent mt" href="${url}" target="_blank" rel="noopener">Открыть отметки на Яндекс Картах</a>` : '<p class="hint">Добавь координаты в карточках кустов. После этого появятся отметки на карте.</p>'}</div>${sites.map(k => { const list = assets.filter(a => a.kustId === k.id); return `<div class="card"><h3>Куст ${esc(k.name)}</h3><p class="meta">${esc(k.field || '')}</p><a class="btn ghost small" href="${mapUrl(k)}" target="_blank" rel="noopener">Показать на карте</a>${list.map(a => { const latest = latestAssetTest(a), values = latest?.values || {}, hot = values.thermal_result === 'Обнаружен нагрев'; return `<p><a href="#/${role}/assets/${a.id}">${esc(a.name)} ${esc(a.tag || a.serial || '')}</a>${hot ? `<br><span class="txt-bad">Нагрев · ${fmtDate(latest.date)}${values.thermal_breaker ? ' · автомат / узел ' + esc(values.thermal_breaker) : ''}</span><br>${esc(values.thermal_comment || '')}` : ''}</p>`; }).join('') || '<p class="hint">Оборудование к кусту пока не привязано.</p>'}</div>`; }).join('')}`;
}

async function viewTraining(role, id) {
  header('Обучение и задания', `/${role}/more`);
  const all = assignedTraining(), mine = isManager(role) ? all : all.filter(t => t.person === me());
  if (id) {
    const task = mine.find(x => x.id === id); if (!task) { app.innerHTML = '<div class="card">Задание не найдено для выбранного сотрудника.</div>'; return; }
    if (isManager(role)) { app.innerHTML = `<div class="card"><h2>${esc(task.title)}</h2><p>${esc(task.person)}</p><p>${esc(task.text)}</p><p>${task.completedAt ? 'Выполнено ' + fmtDT(task.completedAt) + (task.score != null ? `: ${task.score} из ${task.questions.length}` : '') : 'Ожидает выполнения'}</p>${(task.questions || []).map((q, i) => `<p>${i + 1}. ${esc(QUIZ[q][0])}${task.answers?.[i] != null ? `<br>Ответ: ${esc(QUIZ[q][1][task.answers[i]])}` : ''}</p>`).join('')}</div>`; return; }
    const draw = () => {
      app.innerHTML = `<div class="card"><h2>${esc(task.title)}</h2><p>${esc(task.text)}</p><p class="meta">Для ${esc(task.person)}${task.due ? ' · до ' + fmtDate(task.due) : ''}</p></div>${task.kind === 'quiz' ? task.questions.map((qi, i) => `<div class="card"><p><b>${i + 1}. ${esc(QUIZ[qi][0])}</b></p>${QUIZ[qi][1].map((answer, j) => `<button class="quiz-o ${task.answers?.[i] === j ? (j === QUIZ[qi][2] ? 'right' : 'wrong') : ''}" data-answer="${i}" data-option="${j}" ${task.answers?.[i] != null ? 'disabled' : ''}>${esc(answer)}</button>`).join('')}${task.answers?.[i] != null ? `<p class="meta">${esc(QUIZ[qi][3])}</p>` : ''}</div>`).join('') : `<button class="btn accent" id="completeTraining" ${task.completedAt ? 'disabled' : ''}>${task.completedAt ? 'Ознакомлен ' + fmtDT(task.completedAt) : 'Ознакомлен'}</button>`}`;
      app.querySelectorAll('[data-answer]').forEach(button => button.onclick = () => {
        task.answers ||= {}; if (task.answers[button.dataset.answer] != null) return;
        task.answers[button.dataset.answer] = +button.dataset.option;
        if (Object.keys(task.answers).length === task.questions.length) { task.score = task.questions.filter((qi, i) => task.answers[i] === QUIZ[qi][2]).length; task.completedAt = Date.now(); }
        save(); draw();
      });
      const complete = $('#completeTraining'); if (complete) complete.onclick = () => { task.completedAt = Date.now(); save(); draw(); };
    };
    const save = () => { lsSet('psgiTraining', JSON.stringify(all.map(x => x.id === task.id ? task : x))); if (task.completedAt) toast('Результат сохранён для проверки'); };
    draw(); return;
  }
  app.innerHTML = `${isManager(role) ? `<form id="trainingForm" class="card"><h3>Назначить сотруднику</h3><label class="field"><span class="lbl">Сотрудник</span><select name="person" required><option value="">Выберите сотрудника</option>${getStaff().map(n => `<option>${esc(n)}</option>`).join('')}</select></label><label class="field"><span class="lbl">Задание</span><select name="kind"><option value="quiz">Повторный тест по ошибкам</option><option value="info">Информация для ознакомления</option></select></label><label class="field"><span class="lbl">Название</span><input name="title" required></label><label class="field"><span class="lbl">Что изучить</span><textarea name="text"></textarea></label><label class="field"><span class="lbl">Выполнить до</span><input type="date" name="due"></label><button class="btn accent">Назначить</button></form>` : `<div class="card"><label class="field"><span class="lbl">Сотрудник</span><select id="trainingPerson"><option value="">Выберите себя</option>${getStaff().map(n => `<option ${n === me() ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>`}
    <a class="btn ghost" href="#/${role}/docs/info">Результаты теста недели и информация</a><div class="gap"></div>${mine.map(t => `<a class="card task" href="#/${role}/training/${t.id}"><div class="top-line"><span>${esc(t.person)}</span><span class="badge ${t.completedAt ? 'st-sent' : 'st-pending'}">${t.completedAt ? 'Выполнено' : 'Нужно выполнить'}</span></div><h3>${esc(t.title)}</h3><p class="meta">${t.due ? 'До ' + fmtDate(t.due) : ''}${t.score != null ? ` · ${t.score} из ${t.questions.length}` : ''}</p></a>`).join('') || '<div class="card meta">Личных заданий пока нет.</div>'}`;
  const person = $('#trainingPerson'); if (person) person.onchange = () => { lsSet('me', person.value); router(); };
  const form = $('#trainingForm'); if (form) form.onsubmit = e => {
    e.preventDefault(); const values = Object.fromEntries(new FormData(form));
    if (!values.person || !values.title.trim()) return;
    const previous = quizResults().filter(r => r.name === values.person).sort((a, b) => b.at - a.at)[0];
    const questions = previous?.wrong?.length ? previous.wrong : weekQuestions(weekNo());
    lsSet('psgiTraining', JSON.stringify([...assignedTraining(), { ...values, title: values.title.trim(), id: crypto.randomUUID(), created: Date.now(), assignedBy: me(), questions: values.kind === 'quiz' ? questions : [] }]));
    toast('Задание сохранено'); viewTraining(role);
  };
}

function viewCars(role) {
  header('Машины', `/${role}/more`);
  const cars = jget('psgiCars', []);
  app.innerHTML = `<div class="card"><h2>Рабочие машины</h2><p class="meta">Отслеживание СКРТ пока не подключено. Нужны название системы и доступ к её данным. Номер машины сам по себе не позволяет определить местоположение.</p></div><form class="card" id="carForm"><label class="field"><span class="lbl">Госномер</span><input name="number" required></label><label class="field"><span class="lbl">Марка / описание</span><input name="name"></label><label class="field"><span class="lbl">Ссылка на машину в системе СКРТ, если есть</span><input type="url" name="url" placeholder="https://"></label><button class="btn accent">Сохранить машину</button></form>${cars.map(c => `<div class="card"><h3>${esc(c.number)}</h3><p>${esc(c.name)}</p>${/^https?:\/\//i.test(c.url || '') ? `<a class="btn ghost" href="${esc(c.url)}" target="_blank" rel="noopener">Открыть систему СКРТ</a>` : ''}<button class="btn ghost danger mt" data-cardel="${c.id}">Удалить</button></div>`).join('')}`;
  $('#carForm').onsubmit = e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.target)); lsSet('psgiCars', JSON.stringify([...cars, { ...values, id: crypto.randomUUID() }])); viewCars(role); };
  app.querySelectorAll('[data-cardel]').forEach(b => b.onclick = () => { if (confirm('Удалить машину из списка?')) { lsSet('psgiCars', JSON.stringify(cars.filter(c => c.id !== b.dataset.cardel))); viewCars(role); } });
}

const BACKUP_KEYS = ['staff', 'staffPos', 'staffBday', 'staffContact', 'devices', 'objBook', 'objHidden', 'grObjects', 'panels', 'kusty', 'reglament', 'phonebook', 'blank', 'quizRes', 'quizAns', 'gameScores', 'psgiRegisters', 'psgiTraining', 'psgiCars', 'psgiManualAcks', 'psgiManualOpened', 'psgiIdeaPlans', 'devPresetV'];
const MANUALS = [
  { id: 'e6-24', match: /Е6-24|E6-24/i, name: 'Е6-24', file: 'manuals/e6-24.pdf', title: 'Руководство по эксплуатации, методика поверки и паспорт', source: 'https://supereyes.ru/img/instructions/manual_rdservis_e624.pdf', author: 'АО «НПФ «Радио-Сервис»', summary: 'Измерение сопротивления изоляции обесточенных цепей и контроль переменного напряжения. В PDF описаны выбор напряжения, измерения, безопасность и поверка. Функция измерения классификационного напряжения ОПН относится к Е6-24/2.' },
  { id: 'ptf-1', match: /ПТФ-1/i, name: 'ПТФ-1', file: 'manuals/ptf-1.pdf', title: 'Руководство по эксплуатации', source: 'https://pribor-energy.ru/uploads/documents/rukovodstvo-po-ekspluatacii-ptf-1-9383.pdf', author: 'Документ изготовителя, открытая копия «Прибор-Энерго»', summary: 'Измерение активного сопротивления цепей с индуктивностью, в том числе обмоток электрических машин и трансформаторов. Руководство содержит подготовку, порядок измерений и требования безопасности. Редакцию и исполнение сверить с вашим прибором.' },
  { id: 'iks-30a', match: /ИКС-30А|ИКС-30A/i, name: 'ИКС-30А', file: 'manuals/iks-30a.pdf', title: 'Руководство ПТМР.411212.024, версия 1.1', source: 'https://limi.ru/assets/files/IKS-30A-tutorial.pdf', author: 'Челэнергоприбор', summary: 'Измерение сопротивления постоянному току активных и индуктивных цепей: контактов и обмоток. Описаны выбор тока, автоматический режим, работа с РПН, сообщения об ошибках и связь Bluetooth.' },
  { id: 'kew-6016', match: /KEW\s*6016/i, name: 'KEW 6016', file: 'manuals/kew-6016.pdf', title: 'Instruction Manual · английский язык', source: 'https://www.kew-ltd.co.jp/en/download/dl/818/', author: 'KYORITSU', summary: 'Многофункциональный измеритель: изоляция, непрерывность цепей, петля, заземление и УЗО. Возможности и ограничения режимов описаны в руководстве производителя на английском языке.' },
  { id: 'mpi-530', match: /MPI-530/i, name: 'MPI-530', file: 'manuals/mpi-530.pdf', title: 'Руководство MPI-530 (IT) · версия 1.00gb', source: 'https://www.sonel.ru/ru/products/multimeter/detail.php?id4=565', author: 'SONEL, файл по ссылке на странице производителя', summary: 'Измерение параметров электробезопасности: петля, изоляция, заземление и УЗО; сохранение результатов. Открытый PDF относится к MPI-530 (IT). Перед применением нужно сверить исполнение и версию прибора.' },
  { id: 'aid-70c', match: /АИД-70/i, name: 'АИД-70Ц', file: 'manuals/aid-70c.pdf', title: 'Паспорт АИД-70Ц · модификацию нужно подтвердить', source: 'https://mildn.ru/upload/iblock/9ac/9ac9655c3d6b9655e2e5e55901095561.pdf', author: 'Паспорт изготовителя, открытая копия МИЛДН', summary: 'Найден паспорт цифрового АИД-70Ц. В вашем списке указан АИД-70 без подтверждённой модификации. Этот документ нельзя считать паспортом АИД-70М или другого исполнения: сверьте шильдик.' },
  { id: 'svi-100-140', match: /СВИ-100\/140/i, name: 'СВИ-100/140', source: 'https://angstrem.tech/products/sistema-izmereniya-vysokogo-napryazheniya-svi-100-140.htm', title: 'Описание производителя; открытый PDF руководства не найден', author: 'Завод Ангстрем', summary: 'Измерительная система для высокого напряжения переменного и постоянного тока. Измерение тока относится к модификации СВИ-100/140Т. Это измерительная система, её не следует путать с источником испытательного напряжения.' }
];
const manualAcks = () => jget('psgiManualAcks', {});
function manualCardHTML(manual, role) {
  const key = manual.id + ':2026-11-15', acks = manualAcks()[key] || [];
  const opened = jget('psgiManualOpened', {})[key + ':' + me()];
  return `<div class="card manual-card"><p class="meta">${esc(manual.author)}</p><h3>${esc(manual.name)}</h3><p>${esc(manual.title)}</p><p class="manual-summary">${esc(manual.summary)}</p><p class="hint">Проверено ${esc(manual.checked || "15.11.2026")}. Паспорта конкретных экземпляров и свидетельства о поверке прикрепляйте в карточке прибора.</p><div class="manual-actions">${manual.file ? `<button class="btn accent small" data-manual-open="${manual.id}">Читать PDF</button><a class="btn ghost small" href="${manual.file}" download>Скачать PDF</a>` : ''}<a class="btn ghost small" href="${esc(manual.source)}" target="_blank" rel="noopener">Источник документа</a>${manual.file ? `<button class="btn ghost small" data-manual-ack="${manual.id}" ${!me() || !opened || acks.some(a => a.name === me()) ? 'disabled' : ''}>${acks.some(a => a.name === me()) ? 'Ознакомлен ' + fmtDT(acks.find(a => a.name === me()).at) : 'Ознакомлен с руководством'}</button>${!me() ? '<p class="hint">Для отметки выбери сотрудника вверху экрана.</p>' : !opened ? '<p class="hint">Сначала открой PDF, затем отметь ознакомление.</p>' : ''}` : ''}</div>${isManager(role) ? `<details class="mt"><summary>Кто ознакомился (${acks.length})</summary><ul class="manual-read-list">${acks.map(a => `<li>${esc(a.name)} — ${fmtDT(a.at)}</li>`).join('') || '<li>Отметок пока нет.</li>'}</ul><p class="hint">Ещё нет отметки: ${esc(getStaff().filter(n => !acks.some(a => a.name === n)).join(', ') || 'все ознакомились')}</p></details>` : ''}</div>`;
}
function bindManualActions(role) {
  app.querySelectorAll('[data-manual-open]').forEach(button => button.onclick = () => {
    const manual = MANUALS.find(m => m.id === button.dataset.manualOpen), key = manual.id + ':2026-11-15';
    const opened = jget('psgiManualOpened', {}); opened[key + ':' + me()] = Date.now(); lsSet('psgiManualOpened', JSON.stringify(opened));
    const dialog = document.createElement('dialog'); dialog.className = 'psgi-dialog manual-reader';
    dialog.innerHTML = `<h3>${esc(manual.name)}</h3><iframe title="${esc(manual.title)}" src="${manual.file}" style="width:100%;height:60dvh;border:0"></iframe><a class="btn ghost small" href="${manual.file}" target="_blank" rel="noopener">Открыть PDF в отдельной вкладке</a><button class="btn accent mt" data-close>Вернуться к отметке ознакомления</button>`;
    document.body.append(dialog); dialog.showModal(); dialog.querySelector('[data-close]').onclick = () => dialog.close(); dialog.onclose = () => { dialog.remove(); router(); };
  });
  app.querySelectorAll('[data-manual-ack]').forEach(button => button.onclick = () => {
    if (!me()) { toast('Выбери сотрудника'); return; }
    const key = button.dataset.manualAck + ':2026-11-15';
    if (!jget('psgiManualOpened', {})[key + ':' + me()]) return;
    const acks = manualAcks(); acks[key] = [...(acks[key] || []).filter(a => a.name !== me()), { name: me(), at: Date.now() }];
    lsSet('psgiManualAcks', JSON.stringify(acks)); toast('Ознакомление сохранено'); router();
  });
}
async function viewManuals(role) {
  header('Паспорта и руководства', `/${role}/devices`);
  app.innerHTML = MANUALS.map(m => manualCardHTML(m, role)).join(''); bindManualActions(role);
}
async function enhanceManuals(role, id) {
  if (!id) { const link = document.createElement('a'); link.className = 'btn ghost mb'; link.href = `#/${role}/manuals`; link.textContent = 'Паспорта, функции приборов и ознакомление'; app.prepend(link); return; }
  const device = await docGet(id); if (!device) return;
  const manuals = MANUALS.filter(m => m.match.test(device.name)); if (!manuals.length) return;
  const panel = document.createElement('section'); panel.innerHTML = manuals.map(m => manualCardHTML(m, role)).join(''); app.prepend(panel); bindManualActions(role);
}
async function initializeRelease() {
  if (lsGet('devPresetV') !== '2') { await addPresetDevices(); lsSet('devPresetV', '2'); }
  const newsId = 'news-insulation-guide-2026-09-21';
  if (!lsGet('psgiNewsV17')) {
    if (!(await docGet(newsId))) await docPut({ id: newsId, kind: 'info', created: new Date('2026-09-21T12:00:00+03:00').getTime(), title: 'Megger: пособие по диагностике изоляции', text: 'На странице от 21.09.2026 Megger представил пособие по испытаниям изоляции постоянным напряжением. Среди тем — временные измерения, температурная коррекция, тренды, PI и DAR. Страница помогает выбрать тему обучения; методику конкретного испытания определяют по применимым документам и паспорту оборудования.\nИсточник: Megger. Проверено 15.11.2026. Новостные материалы включаются в обновления приложения; автоматический сбор пока не подключён.', sourceUrl: 'https://www.megger.com/en/Insulation_Testing_Guide', files: [], acks: [] });
    lsSet('psgiNewsV17', '1');
  }
  if (!lsGet('psgiAssetMigrationV17')) { for (const task of (await dbAll()).filter(t => t.status === 'sent')) await rememberEquipment(task); lsSet('psgiAssetMigrationV17', '1'); }
}
async function exportBackup() {
  const settings = {};
  for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (BACKUP_KEYS.includes(key) || key.startsWith('memo:') || key.startsWith('psgiChat:')) settings[key] = localStorage.getItem(key); }
  const payload = { format: 'psgi-backup', version: 1, exportedAt: new Date().toISOString(), tasks: await dbAll(), docs: await docsAll(), settings };
  downloadFile(new File([JSON.stringify(payload)], `ПСГИ_копия_${today()}.json`, { type: 'application/json' }));
  lsSet('psgiBackupAt', String(Date.now())); toast('Резервная копия скачана');
}
async function importBackup(file) {
  if (file.size > 150 * 1024 ** 2) throw new Error('Копия больше 150 МБ');
  const backup = JSON.parse(await file.text());
  if (backup.format !== 'psgi-backup' || backup.version !== 1 || !Array.isArray(backup.tasks) || !Array.isArray(backup.docs) || !backup.settings || typeof backup.settings !== 'object') throw new Error('Файл не является резервной копией ПСГИ');
  if (!backup.tasks.every(t => t && typeof t.id === 'string' && Array.isArray(t.items) && t.items.every(i => WORK_TYPES[i.type] && i.values && typeof i.values === 'object')) || !backup.docs.every(d => d && typeof d.id === 'string' && typeof d.kind === 'string')) throw new Error('В файле повреждены записи');
  if (!confirm(`Добавить ${backup.tasks.length} заявок и ${backup.docs.length} документов? Записи с совпадающими идентификаторами будут заменены. Сначала сохрани текущую резервную копию.`)) return;
  // Save localStorage first; rollback it if a quota or IndexedDB transaction fails.
  const old = {};
  try {
    for (const [key, value] of Object.entries(backup.settings)) {
      if ((!BACKUP_KEYS.includes(key) && !key.startsWith('memo:') && !key.startsWith('psgiChat:')) || typeof value !== 'string') continue;
      old[key] = localStorage.getItem(key); localStorage.setItem(key, value);
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['tasks', 'docs'], 'readwrite');
      for (const task of backup.tasks) tx.objectStore('tasks').put(task);
      for (const doc of backup.docs) tx.objectStore('docs').put(doc);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } catch (error) { for (const [key, value] of Object.entries(old)) { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } throw new Error('Не удалось восстановить копию. Проверь свободное место.'); }
  toast('Копия восстановлена'); router();
}
function viewBackup(role) {
  header('Данные и резервные копии', `/${role}/more`);
  app.innerHTML = `<div class="card"><h2>Данные сохраняются на этом устройстве</h2><p>Заявки, измерения, фотографии, оборудование и журналы сохраняются в браузере. Обновление приложения не очищает их.</p><p>Для переноса на другой телефон скачай резервную копию и открой её там. Автоматическая синхронизация между устройствами пока не подключена.</p><p class="meta">${lsGet('psgiBackupAt') ? 'Последняя выгрузка: ' + fmtDT(+lsGet('psgiBackupAt')) : 'Резервная копия ещё не выгружалась.'}</p><button class="btn accent mt" id="backupExport">Скачать резервную копию</button><label class="btn ghost file-btn mt">Восстановить из копии<input type="file" id="backupImport" accept="application/json,.json"></label><button class="btn ghost mt" id="persistStorage">Защитить данные от автоматической очистки</button><p class="hint">Копия содержит рабочие данные и фотографии. Храни её в надёжном месте. Очистка данных браузера удаляет локальные записи.</p></div>`;
  $('#backupExport').onclick = () => exportBackup().catch(() => toast('Не удалось создать резервную копию'));
  $('#backupImport').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { await importBackup(file); } catch (error) { toast(error.message || 'Не удалось прочитать копию'); } };
  $('#persistStorage').onclick = async () => { const granted = await navigator.storage?.persist?.(); toast(granted ? 'Браузер разрешил постоянное хранение' : 'Браузер не дал гарантию хранения. Сохраняй резервные копии.'); };
}

function viewReleases(role) {
  header('Что нового в ПСГИ', `/${role}/more`);
  app.innerHTML = `<div class="card"><span class="badge st-sent">Обновление от 17.11.2026</span><h2>ПСГИ · версия 22</h2><ul>${RELEASE_NOTES.map(n => `<li>${esc(n)}</li>`).join('')}</ul><p class="meta">Передача данных между разными устройствами и подключение СКРТ требуют отдельной настройки сервера и доступа.</p></div>`;
  lsSet('psgiSeenRelease', APP_RELEASE);
}

function bottomNav() {
  let nav = document.getElementById('bottomNav');
  if (!nav) { nav = document.createElement('nav'); nav.id = 'bottomNav'; nav.className = 'bottom-nav no-print'; nav.setAttribute('aria-label', 'Главное меню'); document.body.append(nav); }
  const role = currentRole(), path = location.hash.slice(1) || '/';
  const items = [['/', 'bolt', 'Главная'], [`/${role}`, 'clipboard', 'Заявки'], [`/${role}/chat`, 'people', 'Чат'], [`/${role}/docs/info`, 'info', 'Информация'], [`/${role}/more`, 'gear', 'Разделы']];
  nav.innerHTML = items.map(([href, ic, label]) => { const active = href === '/' ? path === '/' : href.endsWith('/more') ? !items.slice(0, 3).some(([p]) => p === path) : path === href || (href === `/${role}` && /\/(?:task|edit|new)(?:\/|$)/.test(path)); return `<a href="#${href}" ${active ? 'aria-current="page" class="active"' : ''}>${icon(ic)}<span>${label}</span></a>`; }).join('');
}

let lastVoiceField, voiceRecognition;
document.addEventListener('focusin', e => { if (e.target.matches('textarea,input:not([type]),input[type="text"],input[type="search"]')) lastVoiceField = e.target; });
function voiceButton() {
  const hasField = !!app.querySelector('textarea, input[type="text"], input:not([type]), input[type="search"]');
  if ($('#voiceInput')) { $('#voiceInput').hidden = !hasField; return; }
  const button = document.createElement('button'); button.id = 'voiceInput'; button.type = 'button'; button.className = 'voice-input no-print'; button.setAttribute('aria-label', 'Голосовой ввод в выбранное поле'); button.textContent = 'Голосом'; document.body.append(button);
  button.hidden = !hasField;
  button.onclick = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { toast('Этот браузер не поддерживает голосовой ввод. Используй микрофон на клавиатуре телефона.'); return; }
    if (!lastVoiceField?.isConnected || lastVoiceField.disabled || lastVoiceField.readOnly) { toast('Сначала выбери текстовое поле или комментарий'); return; }
    if (voiceRecognition) { voiceRecognition.stop(); return; }
    const field = lastVoiceField, recognizer = new Recognition(); voiceRecognition = recognizer;
    recognizer.lang = 'ru-RU'; recognizer.interimResults = false; button.textContent = 'Слушаю…';
    recognizer.onresult = e => { if (!field.isConnected) return; const transcript = e.results[0][0].transcript; field.value = [field.value.trim(), transcript].filter(Boolean).join(' '); field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); };
    recognizer.onerror = e => toast(e.error === 'not-allowed' ? 'Разреши доступ к микрофону в браузере' : 'Речь не распознана. Попробуй снова.');
    recognizer.onend = () => { voiceRecognition = null; button.textContent = 'Голосом'; };
    try { recognizer.start(); } catch (error) { voiceRecognition = null; button.textContent = 'Голосом'; toast('Не удалось включить микрофон'); }
  };
}

function makeSwipeDelete(card, onDelete, editHref) {
  if (card.closest('.swipe-row')) return;
  const wrap = document.createElement('div'); wrap.className = 'swipe-row';
  card.before(wrap); wrap.append(card); card.classList.add('swipe-content');
  const actions=document.createElement('div');actions.className='swipe-actions';wrap.append(actions);
  if(editHref){const edit=document.createElement('a');edit.className='swipe-edit';edit.href=editHref;edit.setAttribute('aria-label','Изменить заявку');edit.innerHTML=icon('edit')+'<span>Изменить</span>';actions.append(edit);}
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'swipe-delete'; remove.setAttribute('aria-label', 'Удалить заявку'); remove.innerHTML = icon('trash')+'<span>Удалить</span>'; actions.append(remove);
  wrap.style.setProperty('--swipe-reveal',editHref?'126px':'68px');
  const more = document.createElement('button'); more.type = 'button'; more.className = 'swipe-menu'; more.textContent = '⋯'; more.setAttribute('aria-label', 'Действия с заявкой'); more.setAttribute('aria-expanded','false'); wrap.append(more);
  const show = open => { wrap.classList.toggle('revealed', open); actions.inert=!open;actions.setAttribute('aria-hidden',String(!open));more.setAttribute('aria-expanded',String(open)); };
  show(false);
  more.onclick = e => { e.preventDefault(); show(!wrap.classList.contains('revealed')); };
  remove.onclick = e => { e.preventDefault(); onDelete(); };
  let start;
  card.addEventListener('pointerdown', e => { if (e.target.closest('input,button,select,textarea')) return; start = { x: e.clientX, y: e.clientY, at: Date.now(), moved: false }; });
  card.addEventListener('pointermove', e => { if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y; if (Math.abs(dy) > 35 && Math.abs(dy) > Math.abs(dx)) { start = null; return; } if (Math.abs(dx) > Math.abs(dy) * 1.5 && (Math.abs(dx)>70 || Date.now()-start.at>180&&Math.abs(dx)>45)) { start.moved=true;show(dx<0); } });
  card.addEventListener('pointerup', () => { if (start && !start.moved) start = null; });
  card.addEventListener('pointercancel', () => { start = null; });
  card.addEventListener('click', e => { if (start?.moved) { e.preventDefault(); e.stopPropagation(); start = null; } else if (wrap.classList.contains('revealed')) { e.preventDefault(); show(false); } }, true);
  wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){show(false);more.focus();}});
}

async function enhanceTask(role, id) {
  const task = await dbGet(id); if (!task) return;
  if (role === 'm') { header(`Заявка ${task.number}`, '/m'); $('#archBtn')?.remove(); }
  app.querySelectorAll('[data-share]').forEach(button => button.remove());
  if (!app.querySelector('.task-extras')) {
    const box = document.createElement('div'); box.className = 'task-extras no-print';
    box.innerHTML = `${task.returnComments?.length ? `<div class="card return-comments"><h3>Замечания к доработке</h3>${task.returnComments.map(c => `<p><b>${fmtDT(c.at)} · ${esc(c.by || 'Руководитель')}</b><br>${esc(c.text)}</p>`).join('')}</div>` : ''}${isManager(role) && task.status === 'sent' && !task.archived ? '<button class="btn ghost mt" data-return>Вернуть на доработку с комментарием</button>' : ''}${needsRegistration(task) ? '<div class="banner warn mt">Напоминание: внесите номера всех протоколов и передайте PDF после регистрации.</div>' : ''}<button class="btn ghost mt" data-share-pdf>Скачать / отправить PDF</button><p class="hint">Выгружается PDF с измерениями, приборами, замечаниями и фотографиями.</p>`;
    app.prepend(box);
    box.querySelector('[data-share-pdf]').onclick = async () => { const current = await dbGet(id); if (current) shareProtocol(current); };
    const ret = box.querySelector('[data-return]');
    if (ret) ret.onclick = async () => {
      const comment = await askText('Вернуть на доработку', 'Укажи номер протокола, раздел и что нужно поправить.', '', 'Что и где исправить');
      if (!comment?.trim()) return;
      const current = await dbGet(id); if (!current || current.status !== 'sent') return;
      current.returnComments = [...(current.returnComments || []), { text: comment.trim(), by: me() || (role === 'm' ? 'Мастер' : 'Начальник'), role, at: Date.now() }];
      current.status = 'returned'; current.archived = false; current.registrationShared = ''; current.returnedAt = Date.now();
      await dbPut(current); toast('Заявка возвращена на доработку'); router();
    };
  }
  const deleteButton = $('#delBtn');
  if (deleteButton) {
    const card=deleteButton.closest('.card'),editLink=card?.querySelector('a[href*="/edit/"]'),editHref=editLink?.getAttribute('href');
    deleteButton.remove();editLink?.remove();
    if(card&&(isManager(role)||canManageWorkerTask(task,me())))makeSwipeDelete(card,()=>deleteTask(task,`/${role}`),editHref);
    card?.querySelector('.actions')?.classList.add('task-actions-compact');
  }
  if (role === 'e' && location.hash.includes('/form')) {
    const index = +location.hash.split('/')[5] || 0, item = task.items[index]; if (!item) return;
    const target = $('#tab .proto-head');
    if (target && !$('#equipmentPicker')) {
      const assets = (await docsAll()).filter(a => a.kind === 'asset' && a.object === task.object);
      const panel = document.createElement('div'); panel.className = 'card no-print';
      panel.innerHTML = `<label class="field"><span class="lbl">Ранее испытанное оборудование на этом объекте</span><select id="equipmentPicker"><option value="">Выбрать оборудование</option>${assets.map(a => `<option value="${a.id}">${esc([a.name, a.tag, a.serial].filter(Boolean).join(' · '))}</option>`).join('')}</select></label><p class="hint">Подставятся только данные оборудования. Старые измерения доступны в истории и не копируются в новое испытание.</p><div id="equipmentHistoryLink"></div>`;
      target.after(panel);
      $('#equipmentPicker').onchange = async e => {
        const asset = assets.find(a => a.id === e.target.value); if (!asset) return;
        $('#equipmentHistoryLink').innerHTML = `<a class="btn ghost small" href="#/e/assets/${asset.id}">Открыть прошлые испытания (${asset.history.length})</a>`;
        if (task.status === 'sent' || task.status === 'pending') return;
        const current = await dbGet(id), values = current.items[index].values;
        current.items[index].assetId = asset.id; values.asset_name = asset.name; values.asset_tag = asset.tag; values.serial = asset.serial; values.kust_id = asset.kustId;
        await dbPut(current); await router();
      };
      if (item.assetId) { $('#equipmentPicker').value = item.assetId; $('#equipmentHistoryLink').innerHTML = `<a class="btn ghost small" href="#/e/assets/${item.assetId}">Открыть прошлые испытания</a>`; }
    }
  }
}

async function enhancePage(role, parts) {
  if (parts[1] === 'doc') {
    const doc = await docGet(parts[2]);
    if (doc?.sourceUrl && /^https?:\/\//.test(doc.sourceUrl)) { const source = document.createElement('a'); source.className = 'btn ghost mt'; source.href = doc.sourceUrl; source.target = '_blank'; source.rel = 'noopener'; source.textContent = 'Читать первоисточник'; app.append(source); }
    if (isManager(role)) await markManagerRead();
  }
  if (parts.length === 0 || parts.length === 1 || ['manuals', 'device', 'training'].includes(parts[1])) {
    const profile = document.createElement('label'); profile.className = 'profile-selector no-print'; profile.innerHTML = `<span>Сотрудник</span><select id="currentPerson"><option value="">Выбрать себя</option>${getStaff().map(n => `<option ${n === me() ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    app.prepend(profile); profile.querySelector('select').onchange = e => { lsSet('me', e.target.value); router(); };
  }
  if (parts.length === 0) {
    const note = $('.home-note'); if (note) note.textContent = 'Данные сохраняются на этом устройстве. Перенос и резервные копии — в разделе «Данные». Вход по ролям пока без авторизации.';
    if (lsGet('psgiSeenRelease') !== APP_RELEASE) {
      const banner = document.createElement('div'); banner.className = 'card release-card'; banner.innerHTML = `<h3>Приложение обновилось: ПСГИ · 23</h3><p class="meta">Нормированное задание по месяцам: таблица, сохранение и Excel с формулами.</p><a class="btn ghost small mt" href="#/${role}/releases">Что изменилось</a><button class="btn link small" data-release-seen>Понятно</button>`;
      app.prepend(banner); banner.querySelector('[data-release-seen]').onclick = () => { lsSet('psgiSeenRelease', APP_RELEASE); banner.remove(); };
    }
    const reset = $('#reset'); if (reset) reset.remove();
  }
  if (parts[1] === 'task') await enhanceTask(role, parts[2]);
  if (parts[1] === 'docs' && parts[2] === 'info') {
    if (isManager(role)) { await markManagerRead(); const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'Новые результаты просмотрены. Список ещё не ознакомившихся сотрудников остаётся в каждом документе.'; app.prepend(hint); }
    const link = document.createElement('a'); link.className = 'btn ghost mt'; link.href = `#/${role}/training`; link.textContent = isManager(role) ? 'Назначить личный тест или информацию' : 'Мои личные задания'; app.prepend(link);
  }
  const links = [...app.querySelectorAll('a.task[href*="/task/"]')];
  for (const link of links) {
    const taskId = link.getAttribute('href').split('/task/')[1]?.split('/')[0]; if (!taskId) continue;
    const card = link.closest('.task-c') || link;
    const task=await dbGet(taskId);
    if(task&&(isManager(role)||canManageWorkerTask(task,me())))makeSwipeDelete(card, async () => { const current = await dbGet(taskId); if (current) { await deleteTask(current, `/${role}`); router(); } },`#/${role}/edit/${taskId}`);
  }
  if (role === 'e' && parts.length === 1) {
    const tasks = await dbAll(), pending = tasks.filter(t => needsRegistration(t) && canRegisterProtocol(t,me()));
    if (pending.length) { const panel = document.createElement('div'); panel.className = 'card registration-reminders'; panel.innerHTML = `<h3>Зарегистрировать и передать протоколы</h3>${pending.map(t => `<a class="reminder-link" href="#/e/task/${t.id}/form">${esc(t.number)} · ${esc(t.object)}<small>${t.items.some(i => !i.skip && !i.values.proto_no) ? 'Внести номера протоколов' : 'Передать PDF с номерами'}</small></a><button type="button" class="btn accent small" data-registration-numbers="${esc(t.id)}">${protocolNumberAction(t)}</button>`).join('')}`; panel.querySelectorAll('[data-registration-numbers]').forEach(button=>button.onclick=()=>editTaskNumbers(button.dataset.registrationNumbers)); app.prepend(panel); }
  }
  if (parts[1] === 'devices' || parts[1] === 'device') await enhanceManuals(role, parts[1] === 'device' ? parts[2] : null);
  // All dates in month-only history/group headings also include their year.
  app.querySelectorAll('.folder.sub > summary').forEach(s => { const year = s.closest('.folder:not(.sub)')?.querySelector(':scope > summary')?.textContent.match(/20\d{2}/)?.[0]; if (year && !s.dataset.yearAdded) { s.prepend(document.createTextNode(year + ' · ')); s.dataset.yearAdded = '1'; } });
}

let routeSequence = 0;
async function router() {
  const sequence = ++routeSequence;
  app.onclick = null; app.onchange = null; currentFormId = null; swipeNav = null;
  const parts = (location.hash.slice(1) || '/').split('/').filter(Boolean), role = parts[0] || currentRole();
  if (voiceRecognition) voiceRecognition.stop();
  if (['e', 'm', 'b'].includes(role)) lsSet('role', role);
  ASSET_SECTION.fields.find(f => f.id === 'kust_id').options = kusty().map(k => ({ v: k.id, t: `Куст ${k.name}${k.field ? ' · ' + k.field : ''}` }));
  try {
    if (parts[1] === 'more') viewMore(role);
    else if (parts[1] === 'chat') await viewChat(role, parts[2]);
    else if (parts[1] === 'connection') await viewConnection(role);
    else if (parts[1] === 'chat-users') await viewChatUsers();
    else if (parts[1] === 'ideas') viewIdeas(role, parts[2]);
    else if (parts[1] === 'registers') viewRegisters(role, parts[2]);
    else if (parts[1] === 'assets') await viewAssets(role, parts[2]);
    else if (parts[1] === 'map') await viewEquipmentMap(role);
    else if (parts[1] === 'training') await viewTraining(role, parts[2]);
    else if (parts[1] === 'cars') viewCars(role);
    else if (parts[1] === 'backup') viewBackup(role);
    else if (parts[1] === 'releases') viewReleases(role);
    else if (parts[1] === 'manuals') await viewManuals(role);
    else if (role === 'm' && parts.length) {
      currentFormId = null; app.onclick = null; app.onchange = null; swipeNav = null;
      if (parts[1] === 'new' || parts[1] === 'edit') await viewEdit('m', parts[2]);
      else if (parts[1] === 'task') { await viewBossTask(parts[2], parts[3]); app.querySelectorAll('a[href^="#/b/"]').forEach(a => a.href = a.getAttribute('href').replace('#/b/', '#/m/')); }
      else if (parts[1] === 'docs') await viewDocs('m', parts[2]);
      else if (parts[1] === 'doc') await viewDoc('m', parts[2]);
      else if (parts[1] === 'docnew') await viewDocEdit(parts[2], null, 'm');
      else if (parts[1] === 'docedit') await viewDocEdit(null, parts[2], 'm');
      else if (parts[1] === 'devices') await viewDevices('m');
      else if (parts[1] === 'device') await viewDeviceEdit('m', parts[2]);
      else if (parts[1] === 'kusty') viewKusty('m');
      else if (parts[1] === 'kust') viewKust('m', parts[2]);
      else if (parts[1] === 'kustimport') viewKustImport('m');
      else if (parts[1] === 'reglament') viewReglament('m');
      else if (parts[1] === 'quiz') viewQuiz('m');
      else if (parts[1] === 'rating') viewRating('m');
      else if (parts[1] === 'people') viewPeople('m');
      else if (parts[1] === 'phones') viewPhones('m');
      else if (parts[1] === 'phone') viewPhone('m', parts[2]);
      else if (parts[1] === 'phoneimport') viewPhoneImport('m');
      else await viewMaster();
    } else await routeCore();
    if (sequence !== routeSequence) return;
    await enhancePage(role, parts); bottomNav(); voiceButton();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось открыть раздел. Данные сохранены.');
  }
}

window.addEventListener('unhandledrejection', e => { console.error(e.reason); toast('Не удалось сохранить или загрузить данные. Проверь свободное место и сделай резервную копию.'); });
