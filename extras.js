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
function quizResults() { try { return JSON.parse(lsGet('quizRes') || '[]'); } catch (e) { return []; } }
const quizDoneBy = (name, w = weekNo()) => quizResults().some(r => r.week === w && (!name || r.name === name));
const quizPending = () => quizDoneBy(lsGet('me') || '') ? 0 : 1;
function quizCardHTML(role) {
  const res = quizResults().filter(r => r.week === weekNo());
  if (role === 'b') return `<div class="card"><h3>🧠 Тест недели</h3>${res.length ? '<ul class="acks">' + res.map(r => `<li>${esc(r.name || 'без фамилии')}: <b>${r.score} из ${r.total}</b> — ${fmtDT(r.at)}</li>`).join('') + '</ul>' : '<p class="meta">На этой неделе тест ещё никто не прошёл.</p>'}
    <a class="btn ghost small" href="#/b/quiz">Посмотреть вопросы</a></div>`;
  const mine = res.find(r => r.name === (lsGet('me') || ''));
  return `<a class="card task quiz-card" href="#/e/quiz"><div class="top-line"><span>🧠 Тест недели · 7 вопросов</span>
    <span class="badge ${mine ? 'st-sent' : 'st-pending'}">${mine ? `${mine.score} из ${mine.total}` : 'Новый'}</span></div>
    <div class="obj">${mine ? 'Пройти ещё раз' : 'Проверьте себя: нормы испытаний и охрана труда'}</div></a>`;
}
function viewQuiz(role) {
  header('Тест недели', `/${role}/docs/info`);
  const qs = weekQuestions(), ans = {};
  const staff = getStaff();
  app.innerHTML = `<p class="meta">Вопросы по ПУЭ, РД 34.45-51.300-97 и ПОТЭЭ. Каждую неделю — новые.</p><div class="gap"></div>
    ${qs.map((qi, n) => { const [q, opts] = QUIZ[qi];
      return `<div class="card quiz-q" data-q="${n}"><p><b>${n + 1}. ${esc(q)}</b></p>${opts.map((o, j) => `<button type="button" class="quiz-o" data-q="${n}" data-o="${j}">${esc(o)}</button>`).join('')}<p class="quiz-ex"></p></div>`; }).join('')}
    ${role === 'e' ? `<div class="card"><label class="field"><span class="lbl">Кто проходит тест</span><select id="qName"><option value="">— выберите себя —</option>${staff.map(n => `<option ${n === lsGet('me') ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <button class="btn accent" id="qDone">Завершить тест</button></div>` : ''}`;
  app.onclick = e => {
    const b = e.target.closest('.quiz-o');
    if (!b) return;
    const n = +b.dataset.q, [, , right, ex] = QUIZ[qs[n]];
    if (ans[n] !== undefined) return;
    ans[n] = +b.dataset.o;
    const card = app.querySelector(`.quiz-q[data-q="${n}"]`);
    card.querySelectorAll('.quiz-o').forEach((x, j) => { x.classList.toggle('right', j === right); x.classList.toggle('wrong', j === ans[n] && j !== right); x.disabled = true; });
    card.querySelector('.quiz-ex').textContent = (ans[n] === right ? '✓ Верно. ' : '✗ Неверно. ') + ex;
  };
  const done = $('#qDone');
  if (done) done.onclick = () => {
    const name = $('#qName').value;
    if (!name) { toast('Выберите свою фамилию'); return; }
    if (Object.keys(ans).length < qs.length) { toast(`Ответьте на все вопросы (${Object.keys(ans).length} из ${qs.length})`); return; }
    const score = qs.filter((qi, n) => ans[n] === QUIZ[qi][2]).length;
    lsSet('me', name);
    const list = quizResults().filter(r => !(r.week === weekNo() && r.name === name));
    list.push({ week: weekNo(), name, score, total: qs.length, at: Date.now() });
    lsSet('quizRes', JSON.stringify(list.slice(-200)));
    counts();
    toast(`Результат: ${score} из ${qs.length}`);
    location.hash = '/e/docs/info';
  };
}

// ===================== Игры =====================
function viewGames(role, which) {
  stopGame();
  if (which === 'snake') return viewSnake(role);
  if (which === 'blocks') return viewBlocks(role);
  header('Игры', '/' + role);
  app.innerHTML = `<p class="meta">Работают без интернета. Для обеда 🙂</p><div class="gap"></div>
    <a class="card task" href="#/${role}/games/snake"><div class="obj">🐍 Змейка</div><p class="meta">Собирайте яблоки и не врезайтесь в себя. Рекорд: ${+lsGet('best:snake') || 0}</p></a>
    <a class="card task" href="#/${role}/games/blocks"><div class="obj">🧱 Кирпичики</div><p class="meta">Складывайте падающие фигуры в ровные ряды. Рекорд: ${+lsGet('best:blocks') || 0}</p></a>`;
}
let gameTimer = null, gameKeys = null;
function stopGame() {
  clearInterval(gameTimer); gameTimer = null;
  if (gameKeys) { document.removeEventListener('keydown', gameKeys); gameKeys = null; }
}
window.addEventListener('hashchange', () => { if (!location.hash.includes('/games/')) stopGame(); });
// Смахивание по игровому полю
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
const gameShell = (title, extra) => `<div class="game"><div class="game-top"><span>Счёт: <b id="gScore">0</b></span><span>Рекорд: <b id="gBest"></b></span></div>
  <canvas id="gc"></canvas><p class="meta game-msg" id="gMsg"></p>${extra}<button class="btn" id="gStart">Начать</button></div>`;
function saveBest(key, score) { const b = Math.max(score, +lsGet(key) || 0); lsSet(key, String(b)); return b; }

function viewSnake(role) {
  header('Змейка', `/${role}/games`);
  app.innerHTML = gameShell('Змейка', `<div class="pad"><button data-d="U">▲</button><button data-d="L">◀</button><button data-d="D">▼</button><button data-d="R">▶</button></div>`);
  const N = 18, cv = $('#gc'), size = Math.min(app.clientWidth, 420), cell = Math.floor(size / N);
  cv.width = cv.height = cell * N;
  const g = cv.getContext('2d');
  $('#gBest').textContent = +lsGet('best:snake') || 0;
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
      alive = false; stopGame();
      $('#gBest').textContent = saveBest('best:snake', score);
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
  header('Кирпичики', `/${role}/games`);
  app.innerHTML = gameShell('Кирпичики', `<div class="pad pad4"><button data-a="L">◀</button><button data-a="T">⟳</button><button data-a="R">▶</button><button data-a="D">▼▼</button></div>`);
  const W = 10, H = 18, cv = $('#gc');
  const cell = Math.floor(Math.min(app.clientWidth * 0.62, 300) / W);
  cv.width = cell * W; cv.height = cell * H;
  const g = cv.getContext('2d');
  $('#gBest').textContent = +lsGet('best:blocks') || 0;
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
    alive = false; stopGame();
    $('#gBest').textContent = saveBest('best:blocks', score);
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
