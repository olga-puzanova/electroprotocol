'use strict';

const serverUrl = () => (lsGet('psgiServerUrl') || '').replace(/\/$/, '');
const serverSession = () => { try { return JSON.parse(sessionStorage.getItem('psgiSession') || 'null'); } catch { return null; } };
const chatStorageKey = () => 'psgiChat:' + (serverUrl() || 'local') + ':' + (serverSession()?.user?.id || me() || 'anonymous');
const chatMessages = () => jget(chatStorageKey(), []);
const saveChatMessages = messages => lsSet(chatStorageKey(), JSON.stringify(messages));
async function serverRequest(path, { method = 'GET', body, signal } = {}) {
  if (!serverUrl()) throw new Error('Сервер не подключён');
  const session = serverSession();
  const response = await fetch(serverUrl() + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(session?.token ? { Authorization: 'Bearer ' + session.token } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: signal || AbortSignal.timeout(45000), cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || (response.status === 401 ? 'Войди в учётную запись на сервере' : 'Сервер недоступен'));
  return result;
}
let chatPolling, chatRefreshing = false;
async function refreshTeamChat() {
  if (!serverUrl() || !serverSession() || !isOnline() || chatRefreshing) return;
  chatRefreshing = true;
  const storageKey = chatStorageKey();
  try {
    const local = chatMessages();
    for (const message of local.filter(m => m.channel === 'team' && m.state === 'queued' && m.server === serverUrl() && m.userId === serverSession().user.id)) {
      if (storageKey !== chatStorageKey()) return;
      const result = await serverRequest('/messages', { method: 'POST', body: { id: message.id, text: message.text } });
      message.state = 'stored'; message.seq = result.message.seq; message.at = result.message.at;
    }
    if (storageKey !== chatStorageKey()) return;
    const result = await serverRequest('/messages');
    if (storageKey !== chatStorageKey()) return;
    const remoteIds = new Set(result.messages.map(m => m.id));
    const latest = chatMessages();
    saveChatMessages([...latest.filter(m => !remoteIds.has(m.id)), ...result.messages.map(m => ({ ...m, channel: 'team', state: 'stored' }))].sort((a, b) => a.at - b.at));
    const status = $('#chatConnection'); if (status) status.textContent = 'Подключено. Сообщения сохраняются на сервере.';
    drawChatLog();
  } catch (error) { const status = $('#chatConnection'); if (status) status.textContent = error.message + '. Неотправленные сообщения сохранены на устройстве.'; }
  finally { chatRefreshing = false; }
}
function drawChatLog() {
  const log = $('#chatLog'); if (!log) return;
  const channel = log.dataset.channel, session = serverSession();
  const messages = chatMessages().filter(m => m.channel === channel);
  log.innerHTML = messages.map(m => `<article class="chat-message ${m.userId === session?.user?.id || (!m.userId && m.author === me()) || (channel === 'ai' && m.role === 'user') ? 'mine' : ''}"><small><b>${esc(m.author || (m.role === 'assistant' ? 'ИИ-помощник' : 'Вы'))}</b> · ${fmtDT(m.at)}</small><p>${esc(m.text)}</p><small>${m.state === 'stored' ? 'На сервере' : m.state === 'answered' ? 'Ответ ИИ' : m.state === 'queued' ? 'Ждёт отправки' : m.state === 'error' ? 'Ответ не получен' : 'Только на этом устройстве'}</small></article>`).join('') || `<div class="card meta">${channel === 'team' ? 'Здесь будет переписка начальника, мастера и монтёров. Пока сервер не подключён, сообщения сохраняются только на этом устройстве.' : 'Задай вопрос по работе приложения или приборам. Ответы ИИ станут доступны после подключения сервера и выбранного сервиса ИИ.'}</div>`;
}
async function viewChat(role, channel = 'team') {
  channel = channel === 'ai' ? 'ai' : 'team';
  header('Внутренний чат', `/${role}`);
  clearInterval(chatPolling);
  const session = serverSession();
  app.innerHTML = `<div class="chips"><a class="chip ${channel === 'team' ? 'on' : ''}" href="#/${role}/chat/team">Команда</a><a class="chip ${channel === 'ai' ? 'on' : ''}" href="#/${role}/chat/ai">ИИ-помощник</a><a class="chip" href="#/${role}/connection">Подключение</a></div><p class="hint" id="chatConnection">${session ? 'Учётная запись: ' + esc(session.user.name) + '. Проверяем соединение…' : 'Сервер не подключён или вход не выполнен.'}</p>${channel === 'ai' ? '<p class="hint">Вопрос и история этого диалога передаются подключённому сервису ИИ. Ответ помощника не заменяет утверждённую методику и решение специалиста.</p>' : ''}<div class="chat-log" id="chatLog" data-channel="${channel}" aria-live="polite"></div><form class="chat-composer" id="chatForm"><textarea id="chatText" aria-label="Сообщение" placeholder="${channel === 'ai' ? 'Вопрос помощнику' : 'Сообщение команде'}" maxlength="8000" required></textarea><button class="btn accent" type="submit">Отправить</button></form><div class="actions mt"><button class="btn ghost small" id="chatRefresh">Обновить</button><button class="btn ghost small" id="chatExport">Скачать переписку</button></div>`;
  drawChatLog();
  $('#chatRefresh').onclick = () => refreshTeamChat();
  $('#chatExport').onclick = () => downloadFile(new File([JSON.stringify(chatMessages(), null, 2)], `ПСГИ_чат_${today()}.json`, { type: 'application/json' }));
  $('#chatForm').onsubmit = async e => {
    e.preventDefault(); const input = $('#chatText'), text = input.value.trim(); if (!text) return;
    if (!me() && !session) { toast('Выбери сотрудника на главном экране или войди на сервер'); return; }
    const message = { id: crypto.randomUUID(), channel, role: 'user', text, author: session?.user?.name || me(), userId: session?.user?.id, server: serverUrl(), at: Date.now(), state: session && serverUrl() ? 'queued' : 'local' };
    saveChatMessages([...chatMessages(), message]); input.value = ''; drawChatLog();
    if (channel === 'team') { await refreshTeamChat(); return; }
    if (!session || !serverUrl()) { toast('Вопрос сохранён. Для ответа ИИ подключи сервер.'); return; }
    const button = e.target.querySelector('button'); button.disabled = true;
    const storageKey = chatStorageKey();
    try {
      const history = chatMessages().filter(m => m.channel === 'ai' && m.state !== 'error').slice(-12).map(m => ({ role: m.role, content: m.text }));
      const result = await serverRequest('/assistant', { method: 'POST', body: { messages: history } });
      const current = jget(storageKey, []); const original = current.find(m => m.id === message.id); if (original) original.state = 'stored';
      lsSet(storageKey, JSON.stringify([...current, { id: crypto.randomUUID(), channel: 'ai', role: 'assistant', author: 'ИИ-помощник', text: result.text, at: Date.now(), state: 'answered' }]));
    } catch (error) { const current = jget(storageKey, []); const original = current.find(m => m.id === message.id); if (original) original.state = 'error'; lsSet(storageKey, JSON.stringify(current)); toast(error.message); }
    finally { if (button.isConnected) button.disabled = false; drawChatLog(); }
  };
  if (session) { refreshTeamChat(); chatPolling = setInterval(() => { if (location.hash.includes('/chat')) refreshTeamChat(); else clearInterval(chatPolling); }, 12000); }
}
async function viewConnection(role) {
  header('Подключение чата', `/${role}/chat`);
  const session = serverSession();
  app.innerHTML = `<div class="card"><h2>Сервер ПСГИ</h2><p class="meta">Администратор разворачивает сервер и создаёт учётные записи. Ключ ИИ хранится только на сервере. В это поле вводится адрес сервера, а не API-ключ.</p><form id="serverConfig"><label class="field"><span class="lbl">Адрес сервера</span><input name="url" type="url" value="${esc(serverUrl())}" placeholder="https://psgi.example.ru" required></label><button class="btn ghost">Сохранить адрес</button></form></div>${session ? `<div class="card"><h3>${esc(session.user.name)}</h3><p>Вход выполнен. Роль: ${esc({ b: 'Начальник', m: 'Мастер', e: 'Электромонтёр' }[session.user.role])}</p><button class="btn ghost" id="serverLogout">Выйти</button></div>` : `<form class="card" id="serverLogin"><h3>Вход в рабочий чат</h3><label class="field"><span class="lbl">Логин</span><input name="login" autocomplete="username" required></label><label class="field"><span class="lbl">Пароль</span><input name="password" type="password" autocomplete="current-password" required></label><button class="btn accent">Войти</button></form>`}${session?.user.role === 'b' ? '<a class="btn ghost" href="#/b/chat-users">Учётные записи сотрудников</a>' : ''}<p class="hint">Пока сервер не размещён, общий чат и ИИ не работают между телефонами. Локальные данные приложения сохраняются отдельно.</p>`;
  $('#serverConfig').onsubmit = e => {
    e.preventDefault(); let url;
    try { url = new URL(e.target.elements.url.value); } catch { toast('Нужен корректный адрес сервера'); return; }
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.search || url.hash) { toast('Для сервера нужен HTTPS без пароля или ключа в адресе'); return; }
    lsSet('psgiServerUrl', url.origin + url.pathname.replace(/\/$/, '')); sessionStorage.removeItem('psgiSession'); toast('Адрес сохранён'); viewConnection(role);
  };
  const login = $('#serverLogin'); if (login) login.onsubmit = async e => {
    e.preventDefault(); const button = e.target.querySelector('button'); button.disabled = true;
    try { const result = await serverRequest('/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); sessionStorage.setItem('psgiSession', JSON.stringify(result)); lsSet('me', result.user.name); addStaff([result.user.name]); toast('Вход выполнен'); location.hash = `/${result.user.role}/chat`; }
    catch (error) { toast(error.message); } finally { button.disabled = false; }
  };
  const logout = $('#serverLogout'); if (logout) logout.onclick = async () => { try { await serverRequest('/logout', { method: 'POST' }); } catch {} sessionStorage.removeItem('psgiSession'); viewConnection(role); };
}
async function viewChatUsers() {
  header('Учётные записи чата', '/b/connection');
  try {
    const result = await serverRequest('/users');
    app.innerHTML = `<form class="card" id="newChatUser"><h3>Создать учётную запись</h3><label class="field"><span class="lbl">ФИО</span><input name="name" required></label><label class="field"><span class="lbl">Логин</span><input name="login" autocomplete="off" required></label><label class="field"><span class="lbl">Пароль, от 12 символов</span><input name="password" type="password" minlength="12" autocomplete="new-password" required></label><label class="field"><span class="lbl">Роль</span><select name="role"><option value="e">Электромонтёр</option><option value="m">Мастер</option><option value="b">Начальник</option></select></label><button class="btn accent">Создать</button></form>${result.users.map(u => `<div class="card"><b>${esc(u.name)}</b><p class="meta">${esc(u.login)} · ${esc(u.role)}</p></div>`).join('')}`;
    $('#newChatUser').onsubmit = async e => { e.preventDefault(); try { await serverRequest('/users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Учётная запись создана'); viewChatUsers(); } catch (error) { toast(error.message); } };
  } catch (error) { app.innerHTML = `<div class="card">${esc(error.message)}</div>`; }
}
window.addEventListener('online', refreshTeamChat);
startApp().catch(error => { console.error(error); app.innerHTML = '<div class="card"><h2>Не удалось открыть хранилище</h2><p>Проверь, что браузер разрешает хранение данных и на устройстве есть свободное место.</p></div>'; });
