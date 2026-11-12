'use strict';
// Игры на обеде (работают без интернета) и тест недели по испытаниям.

// ===================== Тест недели =====================
// Вопросы по ПУЭ гл. 1.7–1.8, РД 34.45-51.300-97 и ПОТЭЭ. Каждую неделю — 7 новых вопросов.
// [вопрос, [варианты], номер правильного, пояснение]
const QUIZ = [
  ['Наименьшее R60 обмоток масляного трансформатора до 35 кВ при 20 °C:', ['200 МОм', '300 МОм', '450 МОм', '100 МОм'], 1, 'ПУЭ п. 1.8.16, РД п. 6.4: при 20 °C — 300 МОм.'],
  ['Наименьшее R60 обмоток трансформатора до 35 кВ при 30 °C:', ['300 МОм', '130 МОм', '200 МОм', '90 МОм'], 2, 'По таблице: 10 °C — 450, 20 °C — 300, 30 °C — 200 МОм.'],
  ['Наименьшее R60 обмоток трансформатора до 35 кВ при 10 °C:', ['450 МОм', '300 МОм', '600 МОм', '200 МОм'], 0, 'По таблице ПУЭ п. 1.8.16: при 10 °C — 450 МОм.'],
  ['Коэффициент абсорбции R60/R15 сухой изоляции — не менее:', ['1,1', '1,3', '2,0', '1,05'], 1, 'Ниже 1,3 — признак увлажнения изоляции.'],
  ['Измерять изоляцию трансформатора до 150 кВ можно при температуре обмоток не ниже:', ['0 °C', '+5 °C', '+10 °C', '+20 °C'], 2, 'ПУЭ п. 1.8.16: не ниже 10 °C для трансформаторов до 150 кВ.'],
  ['Каким мегаомметром измеряют изоляцию обмоток силового трансформатора?', ['500 В', '1000 В', '2500 В', '100 В'], 2, 'РД п. 6.4.1: мегаомметр на 2500 В.'],
  ['Сопротивления обмоток постоянному току разных фаз трансформатора могут отличаться не более чем на:', ['1 %', '2 %', '5 %', '10 %'], 1, 'Норма — не более 2 %.'],
  ['Как считается разница фаз при измерении сопротивления постоянному току?', ['(большее − меньшее) ÷ меньшее × 100', '(большее − меньшее) ÷ среднее × 100', 'большее ÷ меньшее', '(большее + меньшее) ÷ 2'], 1, 'Разница = (большее − меньшее) ÷ среднее из них × 100 %.'],
  ['Отклонение коэффициента трансформации от паспортного — не более:', ['0,5 %', '1 %', '2 %', '5 %'], 2, 'Норма — не более 2 %.'],
  ['Сколько длится испытание изоляции повышенным напряжением промышленной частоты?', ['10 секунд', '1 минуту', '5 минут', '15 минут'], 1, 'Время приложения испытательного напряжения — 1 минута.'],
  ['Сопротивление изоляции двигателя до 1 кВ при 10–30 °C — не ниже:', ['0,2 МОм', '0,5 МОм', '1 МОм', '10 МОм'], 2, 'ПУЭ п. 1.8.15: не ниже 1 МОм.'],
  ['Сопротивление изоляции фазного ротора двигателя — не ниже:', ['0,2 МОм', '1 МОм', '0,5 МОм', '2 МОм'], 0, 'ПУЭ п. 1.8.15: не ниже 0,2 МОм, мегаомметр 1000 В.'],
  ['Сопротивления обмоток статора двигателя разных фаз могут отличаться не более чем на:', ['2 %', '5 %', '10 %', '0,5 %'], 0, 'Норма — не более 2 %.'],
  ['При разобранной звезде статор меряют по выводам:', ['С1–С2, С2–С3, С1–С3', 'С1–С4, С2–С5, С3–С6', 'А–В, В–С, С–А', 'С1–С6, С2–С4, С3–С5'], 1, 'Каждая обмотка отдельно: С1–С4, С2–С5, С3–С6.'],
  ['Термореактивная изоляция статора выше 1 кВ: норма сопротивления изоляции —', ['1 МОм на 1 кВ', '10 МОм на 1 кВ', '100 МОм всегда', '0,5 МОм'], 1, 'Не менее 10 МОм на 1 кВ номинального напряжения.'],
  ['Переходное сопротивление металлосвязи (заземляемый элемент — заземлитель) — не более:', ['0,05 Ом', '0,5 Ом', '4 Ом', '1 Ом'], 0, 'Норма — не более 0,05 Ом.'],
  ['Сопротивление заземляющего устройства сети 380/220 В — не более:', ['2 Ом', '4 Ом', '8 Ом', '10 Ом'], 1, 'ПУЭ п. 1.7.101: 380/220 В — не более 4 Ом.'],
  ['Сопротивление заземляющего устройства сети 660/380 В — не более:', ['2 Ом', '4 Ом', '8 Ом', '30 Ом'], 0, 'ПУЭ п. 1.7.101: 660/380 В — не более 2 Ом.'],
  ['Каждое повторное заземление PEN-проводника в сети 380/220 В — не более:', ['4 Ом', '10 Ом', '30 Ом', '60 Ом'], 2, 'ПУЭ п. 1.7.103: не более 30 Ом.'],
  ['При удельном сопротивлении грунта выше 100 Ом·м норму ЗУ можно увеличить в ρ/100 раз, но не более чем в:', ['2 раза', '5 раз', '10 раз', '20 раз'], 2, 'ПУЭ п. 1.7.101: не более чем в 10 раз.'],
  ['Автомат характеристики C на 25 А. Каким должен быть ток КЗ, чтобы он отключился мгновенно?', ['Не меньше 125 А', 'Не меньше 250 А', 'Не меньше 500 А', 'Не меньше 25 А'], 1, 'Для C кратность 10: 10 × 25 = 250 А.'],
  ['Автомат характеристики B на 16 А. Требуемый ток КЗ:', ['80 А', '160 А', '320 А', '16 А'], 0, 'Для B кратность 5: 5 × 16 = 80 А.'],
  ['Сопротивление петли фаза-нуль 0,5 Ом. Ток КЗ при 220 В примерно:', ['110 А', '220 А', '440 А', '880 А'], 2, 'Iкз = 220 ÷ 0,5 = 440 А.'],
  ['Сопротивление изоляции вторичных цепей и электропроводок до 1 кВ — не менее:', ['0,5 МОм', '1 МОм', '10 МОм', '0,2 МОм'], 0, 'ПУЭ п. 1.8.37: электропроводки — не менее 0,5 МОм.'],
  ['Сопротивление изоляции вторичных цепей и обмоток электромагнитов выключателя — не менее:', ['0,5 МОм', '1 МОм', '5 МОм', '100 МОм'], 1, 'Норма — не менее 1 МОм.'],
  ['Электромагнит включения выключателя должен надёжно срабатывать при напряжении:', ['0,5 Uном', '0,7 Uном', '0,85 Uном', '1,1 Uном'], 2, 'Включение — при 0,85 Uном, отключение — при 0,7 Uном.'],
  ['Сколько операций включения-отключения при опробовании вакуумного выключателя?', ['1', '3–5', '10', '20'], 1, '3–5 операций и 2–3 цикла В-О.'],
  ['Испытательное выпрямленное напряжение кабеля 10 кВ с бумажной изоляцией (ПУЭ):', ['36 кВ', '60 кВ', '20 кВ', '100 кВ'], 1, 'ПУЭ табл. 1.8.39: 10 кВ, бумага — 60 кВ.'],
  ['Испытательное выпрямленное напряжение кабеля 6 кВ с бумажной изоляцией (ПУЭ):', ['36 кВ', '18 кВ', '60 кВ', '12 кВ'], 0, 'ПУЭ табл. 1.8.39: 6 кВ — 36 кВ.'],
  ['Коэффициент асимметрии токов утечки кабеля 6–10 кВ — не более:', ['2', '5', '8', '15'], 2, 'ПУЭ табл. 1.8.40: не более 8.'],
  ['Сопротивление изоляции кабеля до 1 кВ — не менее:', ['0,5 МОм', '1 МОм', '10 МОм', '0,2 МОм'], 0, 'Норма — не менее 0,5 МОм.'],
  ['Ёмкость конденсатора может отличаться от паспортной не более чем на:', ['±2 %', '±5 %', '±10 %', '±20 %'], 1, 'ПУЭ п. 1.8.30: не более ±5 %.'],
  ['При трёхкратном включении батареи конденсаторов токи фаз могут отличаться не более чем на:', ['2 %', '5 %', '10 %', '15 %'], 1, 'Норма — не более 5 %.'],
  ['Производитель работ при испытаниях передвижной установкой должен иметь группу:', ['II', 'III', 'IV', 'V'], 2, 'ПОТЭЭ п. 39.3: производитель работ — группа IV.'],
  ['Член бригады, выставленный для охраны при испытаниях, — группа не ниже:', ['I', 'II', 'III', 'IV'], 1, 'ПОТЭЭ п. 39.3: группа II.'],
  ['Сечение медного провода для заземления корпуса испытательной установки — не менее:', ['2,5 мм²', '4 мм²', '10 мм²', '25 мм²'], 2, 'ПОТЭЭ п. 39.13: гибкий медный провод не менее 10 мм².'],
  ['Что говорят перед подачей испытательного напряжения?', ['«Внимание»', '«Подаю напряжение»', '«Включаю»', 'Ничего'], 1, 'ПОТЭЭ п. 39.16: «Подаю напряжение».'],
  ['Чем снимают остаточный заряд с кабеля после испытания?', ['Руками в перчатках', 'Разрядной штангой', 'Мегаомметром', 'Отвёрткой'], 1, 'ПОТЭЭ п. 39.20: разрядной штангой.'],
  ['Какой плакат вешают на ограждение места испытаний?', ['«Заземлено»', '«Работать здесь»', '«Испытание. Опасно для жизни»', '«Не включать»'], 2, 'ПОТЭЭ п. 39.8: «Испытание. Опасно для жизни», надписью наружу.'],
  ['Когда снимают заземление с отключённой части при измерении мегаомметром?', ['До подключения мегаомметра', 'Только после подключения мегаомметра', 'Не снимают', 'После измерения'], 1, 'ПОТЭЭ п. 39.29: заземление снимают только после подключения мегаомметра.'],
  ['Норма тока проводимости ОПН берётся:', ['Всегда 1 мА', 'По паспорту изготовителя', 'По ПОТЭЭ', 'Не нормируется'], 1, 'Ток проводимости ОПН сравнивают с паспортом.'],
  ['В каком порядке испытывают изоляцию: повышенное напряжение — до или после измерения мегаомметром?', ['Сначала повышенным напряжением', 'Сначала мегаомметром, повышенным — последним', 'Порядок не важен', 'Только одно из двух'], 1, 'Испытание повышенным напряжением проводят последним из испытаний изоляции.']
];
const weekNo = (d = new Date()) => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return x.getUTCFullYear() * 100 + Math.ceil(((x - y0) / 864e5 + 1) / 7); };
// 7 вопросов недели — одни и те же всю неделю, каждую неделю другие
function weekQuestions(w = weekNo()) {
  let seed = w * 9301 + 49297;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const idx = QUIZ.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 7);
}
const jget = (k, def) => { try { return JSON.parse(lsGet(k) || '') ?? def; } catch (e) { return def; } };
const quizResults = () => jget('quizRes', []);
const quizDoneBy = (name, w = weekNo()) => quizResults().some(r => r.week === w && (!name || r.name === name));
const quizPending = () => quizDoneBy(lsGet('me') || '') ? 0 : 1;
// Ответы сохраняются сразу: вышел и зашёл — они на месте, переответить нельзя
const ansKey = (w, name) => `${w}|${name}`;
const getAns = (w, name) => jget('quizAns', {})[ansKey(w, name)] || {};
function setAns(w, name, ans) { const all = jget('quizAns', {}); all[ansKey(w, name)] = ans; lsSet('quizAns', JSON.stringify(all)); }
// Награды: медаль за неделю, кубок за месяц
const medal = (score, total) => score === total ? '🥇' : score === total - 1 ? '🥈' : score === total - 2 ? '🥉' : '';
const MEDAL_NAME = { '🥇': 'золото', '🥈': 'серебро', '🥉': 'бронза' };
function rating(list = quizResults()) {
  const by = {};
  for (const r of list) {
    const p = by[r.name] ||= { name: r.name, pts: 0, tests: 0, g: 0, s: 0, b: 0, right: 0, wrong: 0 };
    p.pts += r.score; p.tests++; p.right += r.score; p.wrong += r.total - r.score;
    const m = medal(r.score, r.total);
    if (m === '🥇') p.g++; if (m === '🥈') p.s++; if (m === '🥉') p.b++;
  }
  return Object.values(by).sort((a, b) => b.pts - a.pts || b.g - a.g || a.wrong - b.wrong);
}
const monthOf = r => new Date(r.at).toISOString().slice(0, 7);
// Кубок месяца — у того, кто набрал больше всех правильных ответов за месяц
function cups() {
  const res = quizResults(), months = [...new Set(res.map(monthOf))].sort().reverse();
  return months.map(m => ({ m, top: rating(res.filter(r => monthOf(r) === m))[0] })).filter(x => x.top);
}
function ratingHTML(short) {
  const list = rating();
  if (!list.length) return '<p class="meta">Пока никто не проходил тест.</p>';
  const cupsBy = {}; cups().forEach(c => { cupsBy[c.top.name] = (cupsBy[c.top.name] || 0) + 1; });
  const wk = quizResults().filter(r => r.week === weekNo()).sort((a, b) => b.score - a.score)[0];
  return `<div class="ptbl"><table class="rate"><tr><th>#</th><th>Участник</th><th>Очки</th><th>Награды</th></tr>${list.slice(0, short ? 5 : 50).map((p, i) =>
    `<tr><td>${i === 0 ? '👑' : i + 1}</td><td>${esc(p.name)}${wk && wk.name === p.name ? ' <span title="Лидер недели">⭐</span>' : ''}</td><td><b>${p.pts}</b></td>
      <td>${'🏆'.repeat(Math.min(cupsBy[p.name] || 0, 5))}${p.g ? ' 🥇' + p.g : ''}${p.s ? ' 🥈' + p.s : ''}${p.b ? ' 🥉' + p.b : ''}</td></tr>`).join('')}</table></div>`;
}
function viewRating(role) {
  header('Рейтинг теста', `/${role}/docs/info`);
  const c = cups();
  app.innerHTML = `<div class="card"><h3>🏆 Таблица лидеров</h3>${ratingHTML()}
    <p class="meta">Очки — правильные ответы за все недели. Медаль недели: 7 из 7 — 🥇, 6 — 🥈, 5 — 🥉. Кубок 🏆 — лучшему за месяц. ⭐ — лидер этой недели.</p></div>
    ${c.length ? `<div class="card"><h3>Кубки по месяцам</h3><ul class="acks">${c.map(x => `<li>🏆 ${MONTHS[+x.m.slice(5) - 1]} ${x.m.slice(0, 4)} — <b>${esc(x.top.name)}</b> (${x.top.pts} очк.)</li>`).join('')}</ul></div>` : ''}`;
}
function quizCardHTML(role) {
  const res = quizResults().filter(r => r.week === weekNo());
  if (role === 'b') return `<div class="card"><h3>🧠 Тест недели — результаты</h3>${res.length ? res.map(r => `<details class="qres"><summary>${medal(r.score, r.total)} <b>${esc(r.name)}</b>: верно ${r.score}, неверно ${r.total - r.score} · ${fmtDT(r.at)}</summary>
      ${(r.wrong || []).length ? `<p class="meta">Подтянуть:</p><ol>${r.wrong.map(qi => `<li>${esc(QUIZ[qi][0])}<br><span class="meta">Верно: ${esc(QUIZ[qi][1][QUIZ[qi][2]])}. ${esc(QUIZ[qi][3])}</span></li>`).join('')}</ol>` : '<p class="meta">Все ответы верные.</p>'}</details>`).join('')
      : '<p class="meta">На этой неделе тест ещё никто не прошёл.</p>'}
    <div class="actions"><a class="btn ghost small" href="#/b/quiz">Вопросы недели</a><a class="btn ghost small" href="#/b/rating">🏆 Рейтинг</a></div></div>`;
  const mine = res.find(r => r.name === (lsGet('me') || ''));
  const started = !mine && lsGet('me') && Object.keys(getAns(weekNo(), lsGet('me'))).length;
  const top = rating()[0];
  return `<a class="card task quiz-card" href="#/e/quiz"><div class="top-line"><span>🧠 Тест недели · 7 вопросов</span>
    <span class="badge ${mine ? 'st-sent' : 'st-pending'}">${mine ? `${medal(mine.score, mine.total)} ${mine.score} из ${mine.total}` : started ? 'Не закончен' : 'Новый'}</span></div>
    <div class="obj">${mine ? 'Тест пройден. Следующий — на новой неделе' : 'Проверьте себя и поборитесь за медаль'}</div>
    ${top ? `<p class="meta">👑 Лидер рейтинга: ${esc(top.name)} — ${top.pts} очк.</p>` : ''}</a>
    <a class="btn ghost small" href="#/e/rating">🏆 Рейтинг и награды</a><div class="gap"></div>`;
}
function viewQuiz(role) {
  header('Тест недели', `/${role}/docs/info`);
  const w = weekNo(), qs = weekQuestions(w);
  app.onclick = null;
  // Начальник: вопросы недели с правильными ответами
  if (role === 'b') {
    app.innerHTML = qs.map((qi, n) => { const [q, opts, right, ex] = QUIZ[qi];
      return `<div class="card"><p><b>${n + 1}. ${esc(q)}</b></p>${opts.map((o, j) => `<div class="quiz-o ${j === right ? 'right' : ''}">${esc(o)}</div>`).join('')}<p class="quiz-ex">${esc(ex)}</p></div>`; }).join('');
    return;
  }
  const name = lsGet('me') || '';
  if (!name) {
    app.innerHTML = `<div class="card"><label class="field"><span class="lbl">Кто проходит тест</span><select id="qName"><option value="">— выберите себя —</option>${getStaff().map(n => `<option>${esc(n)}</option>`).join('')}</select></label>
      <button class="btn accent" id="qGo">Начать</button><p class="meta">Ответ засчитывается сразу, изменить его нельзя.</p></div>`;
    $('#qGo').onclick = () => { const n = $('#qName').value; if (!n) { toast('Выберите свою фамилию'); return; } lsSet('me', n); viewQuiz(role); };
    return;
  }
  const ans = getAns(w, name);
  const done = quizResults().find(r => r.week === w && r.name === name);
  const resHTML = r => `<div class="banner ok quiz-res">${medal(r.score, r.total) ? `<span class="big-medal">${medal(r.score, r.total)}</span>` : ''}<b>${esc(name)}: ${r.score} из ${r.total}</b>${medal(r.score, r.total) ? ` — ${MEDAL_NAME[medal(r.score, r.total)]}!` : ''}<br>Следующий тест — на новой неделе.</div>`;
  app.innerHTML = `${done ? resHTML(done) : `<p class="meta">Отвечает: <b>${esc(name)}</b> · <a href="#" id="qChange">не вы?</a><br>Ответ засчитывается сразу, изменить его нельзя.</p><div class="gap"></div>`}
    ${qs.map((qi, n) => { const [q, opts, right, ex] = QUIZ[qi], a = ans[n];
      return `<div class="card quiz-q" data-q="${n}"><p><b>${n + 1}. ${esc(q)}</b></p>${opts.map((o, j) => `<button type="button" class="quiz-o ${a !== undefined && j === right ? 'right' : ''} ${a === j && j !== right ? 'wrong' : ''}" data-q="${n}" data-o="${j}" ${a !== undefined ? 'disabled' : ''}>${esc(o)}</button>`).join('')}
        <p class="quiz-ex">${a !== undefined ? (a === right ? '✓ Верно. ' : '✗ Неверно. ') + esc(ex) : ''}</p></div>`; }).join('')}`;
  const ch = $('#qChange');
  if (ch) ch.onclick = e => { e.preventDefault(); lsSet('me', ''); viewQuiz(role); };
  if (done) return;
  app.onclick = e => {
    const b = e.target.closest('button.quiz-o');
    if (!b || b.disabled) return;
    const n = +b.dataset.q, [, , right, ex] = QUIZ[qs[n]];
    const cur = getAns(w, name);
    if (cur[n] !== undefined) return;
    cur[n] = +b.dataset.o; setAns(w, name, cur);
    const card = app.querySelector(`.quiz-q[data-q="${n}"]`);
    card.querySelectorAll('.quiz-o').forEach((x, j) => { x.classList.toggle('right', j === right); x.classList.toggle('wrong', j === cur[n] && j !== right); x.disabled = true; });
    card.querySelector('.quiz-ex').textContent = (cur[n] === right ? '✓ Верно. ' : '✗ Неверно. ') + ex;
    if (Object.keys(cur).length < qs.length) return;
    // Все ответы есть — итог уходит начальнику
    const wrong = qs.filter((qi, k) => cur[k] !== QUIZ[qi][2]);
    const r = { week: w, name, score: qs.length - wrong.length, total: qs.length, wrong, at: Date.now() };
    lsSet('quizRes', JSON.stringify([...quizResults().filter(x => !(x.week === w && x.name === name)), r].slice(-500)));
    notify(`${name} прошёл тест недели`, `Верно ${r.score}, неверно ${r.total - r.score}`, '/b/docs/info');
    counts();
    toast(`Результат: ${r.score} из ${r.total}${medal(r.score, r.total) ? ' ' + medal(r.score, r.total) : ''}`);
    app.onclick = null;
    setTimeout(() => { viewQuiz(role); window.scrollTo(0, 0); }, 900);
  };
}

// ===================== Игры и очки =====================
// Очки копятся у игрока: змейка и кирпичики — набранный счёт, победа в косынке — 50, в шахматах — 100 (ничья — 30)
const player = () => lsGet('player') || lsGet('me') || '';
function award(game, pts, best) {
  const name = player();
  if (!name) { if (pts) toast('Выберите игрока на экране «Игры», чтобы очки засчитывались'); return; }
  const all = jget('gameScores', {}), p = all[name] ||= { pts: 0 };
  p.pts += pts;
  if (best !== undefined) p[game] = Math.max(p[game] || 0, best); else p[game] = (p[game] || 0) + 1;
  lsSet('gameScores', JSON.stringify(all));
  if (pts) toast(`${name}: +${pts} очк.`);
}
function viewGames(role, which) {
  stopGame();
  app.onclick = null;
  if (which === 'snake') return viewSnake(role);
  if (which === 'blocks') return viewBlocks(role);
  if (which === 'solitaire') return viewSolitaire(role);
  if (which === 'chess') return viewChess(role);
  header('Игры', role === 'h' ? '/' : '/' + role);
  const sc = jget('gameScores', {}), list = Object.entries(sc).sort((a, b) => b[1].pts - a[1].pts);
  const names = [...new Set([...getStaff(), ...Object.keys(sc)])];
  app.innerHTML = `<div class="card"><label class="field"><span class="lbl">Кто играет</span><select id="gPlayer"><option value="">— выберите —</option>${names.map(n => `<option ${n === player() ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="__new">+ Новый игрок…</option></select></label></div>
    <a class="card task" href="#/${role}/games/snake"><div class="obj">🐍 Змейка</div><p class="meta">Яблоко — 1 очко.</p></a>
    <a class="card task" href="#/${role}/games/blocks"><div class="obj">🧱 Кирпичики</div><p class="meta">Собранный ряд — очки.</p></a>
    <a class="card task" href="#/${role}/games/solitaire"><div class="obj">🃏 Косынка</div><p class="meta">Пасьянс. Победа — 50 очков.</p></a>
    <a class="card task" href="#/${role}/games/chess"><div class="obj">♟ Шахматы</div><p class="meta">С телефоном или вдвоём. Победа над телефоном — 100 очков, ничья — 30.</p></a>
    <div class="card"><h3>🏆 Таблица игроков</h3>${list.length ? `<div class="ptbl"><table class="rate"><tr><th>#</th><th>Игрок</th><th>Очки</th><th>🐍</th><th>🧱</th><th>🃏</th><th>♟</th></tr>${list.map(([n, p], i) =>
      `<tr><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(n)}</td><td><b>${p.pts}</b></td><td>${p.snake || 0}</td><td>${p.blocks || 0}</td><td>${p.sol || 0}</td><td>${p.chess || 0}</td></tr>`).join('')}</table></div>
      <p class="meta">🐍 и 🧱 — рекорд, 🃏 и ♟ — победы.</p>` : '<p class="meta">Пока никто не играл. Выберите игрока и начинайте.</p>'}</div>`;
  $('#gPlayer').onchange = e => {
    let v = e.target.value;
    if (v === '__new') { v = (prompt('Имя игрока') || '').trim(); if (!v) { viewGames(role); return; } }
    lsSet('player', v); viewGames(role);
  };
}
let gameTimer = null, gameKeys = null;
function stopGame() {
  clearInterval(gameTimer); gameTimer = null;
  if (gameKeys) { document.removeEventListener('keydown', gameKeys); gameKeys = null; }
}
window.addEventListener('hashchange', () => { if (!location.hash.includes('/games/')) stopGame(); });
function onSwipe(el, fn, tap) {
  let x0, y0;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { if (tap) tap(); return; }
    fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
  });
}
const gameShell = extra => `<div class="game"><div class="game-top"><span>Счёт: <b id="gScore">0</b></span><span>${esc(player() || 'Игрок не выбран')}</span><span>Рекорд: <b id="gBest"></b></span></div>
  <canvas id="gc"></canvas><p class="meta game-msg" id="gMsg"></p>${extra}<button class="btn" id="gStart">Начать</button></div>`;
const bestOf = game => (jget('gameScores', {})[player()] || {})[game] || 0;
const gBack = role => `/${role}/games`;

function viewSnake(role) {
  header('Змейка', gBack(role));
  app.innerHTML = gameShell(`<div class="pad"><button data-d="U">▲</button><button data-d="L">◀</button><button data-d="D">▼</button><button data-d="R">▶</button></div>`);
  const N = 18, cv = $('#gc'), size = Math.min(app.clientWidth, 420), cell = Math.floor(size / N);
  cv.width = cv.height = cell * N;
  const g = cv.getContext('2d');
  $('#gBest').textContent = bestOf('snake');
  let snake, dir, next, food, score, alive = false;
  const place = () => { do { food = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (snake.some(p => p[0] === food[0] && p[1] === food[1])); };
  const draw = () => {
    g.fillStyle = '#16324f'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#f5b800'; g.beginPath(); g.arc(food[0] * cell + cell / 2, food[1] * cell + cell / 2, cell / 2.4, 0, 7); g.fill();
    snake.forEach((p, i) => { g.fillStyle = i ? '#3ec27a' : '#9be8b9'; g.fillRect(p[0] * cell + 1, p[1] * cell + 1, cell - 2, cell - 2); });
  };
  const turn = d => { const v = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[d]; if (v && (v[0] !== -dir[0] || v[1] !== -dir[1])) next = v; };
  const step = () => {
    dir = next;
    const h = [(snake[0][0] + dir[0] + N) % N, (snake[0][1] + dir[1] + N) % N];
    if (snake.some(p => p[0] === h[0] && p[1] === h[1])) {
      alive = false; stopGame(); award('snake', score, score);
      $('#gBest').textContent = bestOf('snake');
      $('#gMsg').textContent = `Игра окончена. Счёт: ${score}`; $('#gStart').hidden = false; $('#gStart').textContent = 'Ещё раз';
      return;
    }
    snake.unshift(h);
    if (h[0] === food[0] && h[1] === food[1]) {
      score++; $('#gScore').textContent = score; place();
      if (score % 5 === 0) { clearInterval(gameTimer); gameTimer = setInterval(step, Math.max(70, 160 - score * 3)); }
    } else snake.pop();
    draw();
  };
  const start = () => {
    snake = [[8, 9], [7, 9], [6, 9]]; dir = next = [1, 0]; score = 0; alive = true;
    $('#gScore').textContent = 0; $('#gMsg').textContent = 'Управление: смахивайте по полю или жмите стрелки.'; $('#gStart').hidden = true;
    place(); draw();
    stopGame(); gameTimer = setInterval(step, 160);
    gameKeys = e => { const d = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R' }[e.key]; if (d) { e.preventDefault(); turn(d); } };
    document.addEventListener('keydown', gameKeys);
  };
  onSwipe(cv, d => alive && turn(d));
  app.querySelectorAll('.pad [data-d]').forEach(b => b.onclick = () => alive && turn(b.dataset.d));
  $('#gStart').onclick = start;
  snake = [[8, 9], [7, 9], [6, 9]]; food = [12, 9]; draw();
}

function viewBlocks(role) {
  header('Кирпичики', gBack(role));
  app.innerHTML = gameShell(`<div class="pad"><button data-a="L">◀</button><button data-a="T">⟳</button><button data-a="R">▶</button><button data-a="D">▼▼</button></div>`);
  const W = 10, H = 18, cv = $('#gc');
  const cell = Math.floor(Math.min(app.clientWidth * 0.62, 300) / W);
  cv.width = cell * W; cv.height = cell * H;
  const g = cv.getContext('2d');
  $('#gBest').textContent = bestOf('blocks');
  const SHAPES = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]]];
  const COLORS = ['#e8833a', '#f5b800', '#3ec27a', '#4aa3df', '#b07cd8', '#e05a5a', '#5ed1c1'];
  let field, piece, score, alive = false;
  const newPiece = () => { const i = Math.floor(Math.random() * SHAPES.length); return { m: SHAPES[i].map(r => r.slice()), c: i + 1, x: 3, y: 0 }; };
  const fits = (p, dx = 0, dy = 0, m = p.m) => m.every((r, y) => r.every((v, x) => !v || (p.x + x + dx >= 0 && p.x + x + dx < W && p.y + y + dy < H && !(field[p.y + y + dy]?.[p.x + x + dx]))));
  const draw = () => {
    g.fillStyle = '#16324f'; g.fillRect(0, 0, cv.width, cv.height);
    const box = (x, y, c) => { g.fillStyle = COLORS[c - 1]; g.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2); };
    field.forEach((r, y) => r.forEach((c, x) => c && box(x, y, c)));
    if (piece) piece.m.forEach((r, y) => r.forEach((v, x) => v && box(piece.x + x, piece.y + y, piece.c)));
  };
  const over = () => {
    alive = false; stopGame(); award('blocks', score, score);
    $('#gBest').textContent = bestOf('blocks');
    $('#gMsg').textContent = `Игра окончена. Счёт: ${score}`; $('#gStart').hidden = false; $('#gStart').textContent = 'Ещё раз';
  };
  const lock = () => {
    piece.m.forEach((r, y) => r.forEach((v, x) => { if (v) field[piece.y + y][piece.x + x] = piece.c; }));
    const before = field.length;
    field = field.filter(r => r.some(c => !c));
    const lines = before - field.length;
    while (field.length < H) field.unshift(Array(W).fill(0));
    if (lines) { score += [0, 1, 3, 5, 8][lines]; $('#gScore').textContent = score; clearInterval(gameTimer); gameTimer = setInterval(tick, Math.max(120, 600 - score * 15)); }
    piece = newPiece();
    if (!fits(piece)) { draw(); over(); }
  };
  const tick = () => { if (fits(piece, 0, 1)) piece.y++; else lock(); if (alive) draw(); };
  const act = a => {
    if (!alive) return;
    if (a === 'L' && fits(piece, -1)) piece.x--;
    if (a === 'R' && fits(piece, 1)) piece.x++;
    if (a === 'T') { const m = piece.m[0].map((_, x) => piece.m.map(r => r[x]).reverse()); if (fits(piece, 0, 0, m)) piece.m = m; else if (fits(piece, -1, 0, m)) { piece.x--; piece.m = m; } else if (fits(piece, 1, 0, m)) { piece.x++; piece.m = m; } }
    if (a === 'D') { while (fits(piece, 0, 1)) piece.y++; lock(); }
    if (alive) draw();
  };
  const start = () => {
    field = Array.from({ length: H }, () => Array(W).fill(0)); piece = newPiece(); score = 0; alive = true;
    $('#gScore').textContent = 0; $('#gMsg').textContent = 'Смахивайте влево-вправо, нажмите на поле — повернуть, смахните вниз — бросить.'; $('#gStart').hidden = true;
    draw(); stopGame(); gameTimer = setInterval(tick, 600);
    gameKeys = e => { const a = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'T', ArrowDown: 'D', ' ': 'D' }[e.key]; if (a) { e.preventDefault(); act(a); } };
    document.addEventListener('keydown', gameKeys);
  };
  onSwipe(cv, d => act({ L: 'L', R: 'R', D: 'D', U: 'T' }[d]), () => act('T'));
  app.querySelectorAll('.pad [data-a]').forEach(b => b.onclick = () => act(b.dataset.a));
  $('#gStart').onclick = start;
  field = Array.from({ length: H }, () => Array(W).fill(0)); piece = null; draw();
}

// ---------- Косынка (пасьянс) ----------
// Нажмите на карту, затем на место, куда её положить. Повторное нажатие на выбранную карту — отправить в «дом».
function viewSolitaire(role) {
  header('Косынка', gBack(role));
  const SU = ['♠', '♥', '♦', '♣'], RK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const red = c => c.s === 1 || c.s === 2;
  let st, sel = null, moves = 0, won = false;
  const deal = () => {
    const deck = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, up: false });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const tab = Array.from({ length: 7 }, (_, i) => deck.splice(0, i + 1));
    tab.forEach(col => { col[col.length - 1].up = true; });
    st = { stock: deck, waste: [], found: [[], [], [], []], tab }; sel = null; moves = 0; won = false;
  };
  const cardHTML = (c, attrs = '') => c.up ? `<div class="sc ${red(c) ? 'red' : ''}" ${attrs}><span>${RK[c.r]}${SU[c.s]}</span><b>${SU[c.s]}</b></div>` : `<div class="sc back" ${attrs}></div>`;
  const isSel = (p, i) => sel && sel.p === p && sel.i === i ? 'data-sel="1"' : '';
  const draw = () => {
    const top = a => a[a.length - 1];
    app.innerHTML = `<div class="sol"><div class="sol-top">
      <div class="pile" data-p="stock">${st.stock.length ? cardHTML({ up: false }, 'data-p="stock"') : '<div class="slot" data-p="stock">↺</div>'}</div>
      <div class="pile" data-p="w">${st.waste.length ? cardHTML(top(st.waste), `data-p="w" data-i="${st.waste.length - 1}" ${isSel('w', st.waste.length - 1)}`) : '<div class="slot" data-p="w"></div>'}</div>
      <div class="pile"></div>
      ${st.found.map((f, k) => `<div class="pile" data-p="f${k}">${f.length ? cardHTML(top(f), `data-p="f${k}" data-i="${f.length - 1}" ${isSel('f' + k, f.length - 1)}`) : `<div class="slot" data-p="f${k}">${SU[k]}</div>`}</div>`).join('')}</div>
      <div class="sol-tab">${st.tab.map((col, k) => `<div class="col" data-p="t${k}">${col.length ? col.map((c, i) => `<div class="stack ${c.up ? 'up' : ''}">${cardHTML(c, `data-p="t${k}" data-i="${i}" ${sel && sel.p === 't' + k && i >= sel.i ? 'data-sel="1"' : ''}`)}</div>`).join('') : `<div class="slot" data-p="t${k}"></div>`}</div>`).join('')}</div>
      <p class="meta game-msg">${won ? '🎉 Пасьянс сошёлся!' : 'Нажмите карту, затем куда положить. Нажмите выбранную карту ещё раз — она уйдёт в «дом».'} Ходов: ${moves}</p>
      <button class="btn ghost" id="solNew">Новая раздача</button></div>`;
    $('#solNew').onclick = () => { if (won || confirm('Начать новую раздачу?')) { deal(); draw(); } };
  };
  const pileArr = p => p === 'w' ? st.waste : p[0] === 'f' ? st.found[+p[1]] : st.tab[+p[1]];
  const canFound = (c, k) => { const f = st.found[k], t = f[f.length - 1]; return c.s === k && (t ? c.r === t.r + 1 : c.r === 1); };
  const canTab = (c, k) => { const col = st.tab[k], t = col[col.length - 1]; return t ? t.up && red(t) !== red(c) && t.r === c.r + 1 : c.r === 13; };
  const doMove = (from, i, to) => {
    const src = pileArr(from), cards = src.slice(i);
    if (to[0] === 'f') { if (cards.length !== 1 || !canFound(cards[0], +to[1])) return false; }
    else if (to[0] === 't') { if (!canTab(cards[0], +to[1])) return false; }
    else return false;
    src.splice(i); pileArr(to).push(...cards);
    if (from[0] === 't' && src.length && !src[src.length - 1].up) src[src.length - 1].up = true;
    moves++;
    if (st.found.every(f => f.length === 13)) { won = true; award('sol', 50); }
    return true;
  };
  app.onclick = e => {
    if (won) return;
    const el = e.target.closest('[data-p]');
    if (!el) return;
    const p = el.dataset.p, i = el.dataset.i !== undefined ? +el.dataset.i : null;
    if (p === 'stock') {
      if (st.stock.length) { const c = st.stock.pop(); c.up = true; st.waste.push(c); }
      else { st.stock = st.waste.reverse().map(c => ({ ...c, up: false })); st.waste = []; }
      sel = null; moves++; draw(); return;
    }
    const arr = pileArr(p);
    if (sel) {
      if (sel.p === p && sel.i === i) {
        // Повторное нажатие — в «дом»
        const c = arr[i];
        if (i === arr.length - 1) for (let k = 0; k < 4; k++) if (doMove(p, i, 'f' + k)) break;
        sel = null; draw(); return;
      }
      if (doMove(sel.p, sel.i, p)) { sel = null; draw(); return; }
    }
    if (i !== null && arr[i]?.up && (p[0] === 't' || i === arr.length - 1)) sel = { p, i };
    else sel = null;
    draw();
  };
  deal(); draw();
}

// ---------- Шахматы ----------
// Белые — вы. Противник — телефон (простой расчёт на 3 хода вперёд) или второй человек на этом же телефоне.
function viewChess(role) {
  header('Шахматы', gBack(role));
  const GL = { wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' };
  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  const init = () => {
    const b = Array(64).fill(null), back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) { b[c] = 'b' + back[c]; b[8 + c] = 'bP'; b[48 + c] = 'wP'; b[56 + c] = 'w' + back[c]; }
    return { b, turn: 'w', cs: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: -1 };
  };
  const rc = i => [i >> 3, i & 7], on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  function attacked(b, sq, by) {
    const [r, c] = rc(sq), dir = by === 'w' ? 1 : -1;
    for (const dc of [-1, 1]) { const rr = r + dir, cc = c + dc; if (on(rr, cc) && b[rr * 8 + cc] === by + 'P') return true; }
    for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const rr = r + dr, cc = c + dc; if (on(rr, cc) && b[rr * 8 + cc] === by + 'N') return true; }
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let rr = r + dr, cc = c + dc, d = 1;
      while (on(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) { if (p[0] === by) { const t = p[1], diag = dr && dc; if (t === 'Q' || (diag ? t === 'B' : t === 'R') || (t === 'K' && d === 1)) return true; } break; }
        rr += dr; cc += dc; d++;
      }
    }
    return false;
  }
  const kingSq = (b, col) => b.indexOf(col + 'K');
  function pseudo(s) {
    const b = s.b, me = s.turn, op = me === 'w' ? 'b' : 'w', out = [];
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p || p[0] !== me) continue;
      const [r, c] = rc(i), t = p[1];
      const add = (to, extra = {}) => out.push({ from: i, to, ...extra });
      if (t === 'P') {
        const d = me === 'w' ? -1 : 1, start = me === 'w' ? 6 : 1, last = me === 'w' ? 0 : 7;
        if (on(r + d, c) && !b[(r + d) * 8 + c]) {
          add((r + d) * 8 + c, r + d === last ? { promo: 1 } : {});
          if (r === start && !b[(r + 2 * d) * 8 + c]) add((r + 2 * d) * 8 + c, { dbl: 1 });
        }
        for (const dc of [-1, 1]) { const rr = r + d, cc = c + dc; if (!on(rr, cc)) continue; const to = rr * 8 + cc;
          if (b[to] && b[to][0] === op) add(to, rr === last ? { promo: 1 } : {});
          else if (to === s.ep) add(to, { ep: 1 }); }
      } else if (t === 'N' || t === 'K') {
        const ds = t === 'N' ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dr, dc] of ds) { const rr = r + dr, cc = c + dc; if (on(rr, cc) && (!b[rr * 8 + cc] || b[rr * 8 + cc][0] === op)) add(rr * 8 + cc); }
        if (t === 'K') {
          const row = me === 'w' ? 56 : 0;
          if (i === row + 4 && !attacked(b, i, op)) {
            if (s.cs[me + 'K'] && b[row + 7] === me + 'R' && !b[row + 5] && !b[row + 6] && !attacked(b, row + 5, op) && !attacked(b, row + 6, op)) add(row + 6, { castle: 'K' });
            if (s.cs[me + 'Q'] && b[row] === me + 'R' && !b[row + 1] && !b[row + 2] && !b[row + 3] && !attacked(b, row + 3, op) && !attacked(b, row + 2, op)) add(row + 2, { castle: 'Q' });
          }
        }
      } else {
        const ds = t === 'B' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : t === 'R' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dr, dc] of ds) { let rr = r + dr, cc = c + dc;
          while (on(rr, cc)) { const q = b[rr * 8 + cc]; if (q && q[0] === me) break; add(rr * 8 + cc); if (q) break; rr += dr; cc += dc; } }
      }
    }
    return out;
  }
  function make(s, m) {
    const b = s.b.slice(), p = b[m.from], me = p[0], cs = { ...s.cs };
    b[m.to] = m.promo ? me + 'Q' : p; b[m.from] = null;
    if (m.ep) b[m.to + (me === 'w' ? 8 : -8)] = null;
    if (m.castle) { const row = me === 'w' ? 56 : 0; if (m.castle === 'K') { b[row + 5] = b[row + 7]; b[row + 7] = null; } else { b[row + 3] = b[row]; b[row] = null; } }
    if (p[1] === 'K') { cs[me + 'K'] = 0; cs[me + 'Q'] = 0; }
    for (const [sq, k] of [[63, 'wK'], [56, 'wQ'], [7, 'bK'], [0, 'bQ']]) if (m.from === sq || m.to === sq) cs[k] = 0;
    return { b, turn: me === 'w' ? 'b' : 'w', cs, ep: m.dbl ? (m.from + m.to) / 2 : -1 };
  }
  const legal = s => pseudo(s).filter(m => { const n = make(s, m); return !attacked(n.b, kingSq(n.b, s.turn), n.turn); });
  const inCheck = s => attacked(s.b, kingSq(s.b, s.turn), s.turn === 'w' ? 'b' : 'w');
  // Оценка позиции для чёрных: материал + немного за центр
  const evalB = b => { let v = 0; for (let i = 0; i < 64; i++) { const p = b[i]; if (!p) continue; const [r, c] = rc(i); const center = (p[1] === 'N' || p[1] === 'P') ? (3.5 - Math.abs(3.5 - c)) * 4 + (3.5 - Math.abs(3.5 - r)) * 2 : 0; v += (p[0] === 'b' ? 1 : -1) * (VAL[p[1]] + center); } return v; };
  function search(s, depth, a, bt) {
    const ms = legal(s);
    if (!ms.length) return inCheck(s) ? (s.turn === 'b' ? -99999 - depth : 99999 + depth) : 0;
    if (!depth) return evalB(s.b);
    ms.sort((x, y) => (s.b[y.to] ? VAL[s.b[y.to][1]] : 0) - (s.b[x.to] ? VAL[s.b[x.to][1]] : 0));
    if (s.turn === 'b') { let best = -Infinity; for (const m of ms) { best = Math.max(best, search(make(s, m), depth - 1, a, bt)); a = Math.max(a, best); if (a >= bt) break; } return best; }
    let best = Infinity; for (const m of ms) { best = Math.min(best, search(make(s, m), depth - 1, a, bt)); bt = Math.min(bt, best); if (a >= bt) break; } return best;
  }
  function aiMove(s) {
    const ms = legal(s); let best = -Infinity, pick = [];
    for (const m of ms) { const v = search(make(s, m), 2, -Infinity, Infinity) + Math.random() * 8; if (v > best) { best = v; pick = m; } }
    return pick;
  }
  let s = init(), sel = -1, last = null, over = '', vsAI = lsGet('chessMode') !== '2', thinking = false;
  const status = () => {
    const ms = legal(s);
    if (!ms.length) {
      if (inCheck(s)) { const winner = s.turn === 'w' ? 'b' : 'w'; over = winner === 'w' ? (vsAI ? 'Мат! Вы выиграли 🎉' : 'Мат! Победили белые') : (vsAI ? 'Мат. Телефон выиграл' : 'Мат! Победили чёрные');
        if (vsAI && winner === 'w') award('chess', 100); }
      else { over = 'Пат — ничья'; if (vsAI) award('chessDraw', 30); }
      return over;
    }
    if (s.b.filter(Boolean).length === 2) { over = 'Ничья — остались одни короли'; if (vsAI) award('chessDraw', 30); return over; }
    return (s.turn === 'w' ? 'Ход белых' : vsAI ? 'Телефон думает…' : 'Ход чёрных') + (inCheck(s) ? ' — шах!' : '');
  };
  const draw = () => {
    const targets = sel >= 0 ? legal(s).filter(m => m.from === sel).map(m => m.to) : [];
    const msg = over || status();
    app.innerHTML = `<div class="chess-wrap"><div class="chips"><button class="chip ${vsAI ? 'on' : ''}" data-mode="1">С телефоном</button><button class="chip ${!vsAI ? 'on' : ''}" data-mode="2">Вдвоём</button></div>
      <p class="game-msg"><b>${msg}</b></p>
      <div class="board">${s.b.map((p, i) => { const [r, c] = rc(i);
        return `<button class="sq ${(r + c) % 2 ? 'dk' : 'lt'} ${i === sel ? 'sel' : ''} ${last && (i === last.from || i === last.to) ? 'last' : ''} ${targets.includes(i) ? (p ? 'cap' : 'dot') : ''} ${p && p[0] === 'b' ? 'bp' : ''}" data-sq="${i}">${p ? GL[p] : ''}</button>`; }).join('')}</div>
      <p class="meta">${vsAI ? 'Вы играете белыми. Победа — 100 очков, ничья — 30.' : 'Игра вдвоём на одном телефоне, очки не начисляются.'}</p>
      <button class="btn ghost" id="chNew">Новая партия</button></div>`;
    $('#chNew').onclick = () => { if (over || confirm('Начать новую партию?')) { s = init(); sel = -1; last = null; over = ''; draw(); } };
    app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { if (!over && last && !confirm('Начать новую партию в другом режиме?')) return; vsAI = b.dataset.mode === '1'; lsSet('chessMode', vsAI ? '1' : '2'); s = init(); sel = -1; last = null; over = ''; draw(); });
  };
  app.onclick = e => {
    const el = e.target.closest('[data-sq]');
    if (!el || over || thinking || (vsAI && s.turn === 'b')) return;
    const i = +el.dataset.sq, p = s.b[i];
    if (sel >= 0) {
      const m = legal(s).find(m => m.from === sel && m.to === i);
      if (m) {
        s = make(s, m); last = m; sel = -1; draw();
        if (vsAI && !over) { thinking = true; setTimeout(() => { const am = aiMove(s); if (am && am.from !== undefined) { s = make(s, am); last = am; } thinking = false; draw(); }, 60); }
        return;
      }
    }
    sel = p && p[0] === s.turn ? i : -1;
    draw();
  };
  draw();
}
