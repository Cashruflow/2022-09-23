// СТЕНД «Треды»: настоящий web/discuss.js (копия с путями из env) + заглушки соседних модулей,
// база-заглушка с данными как на макете. Запуск: node stand/server.mjs (нужны better-sqlite3 и express).
// Порт 3077. Роль — заголовок/параметр ?role=owner|manager|contractor (для проверки прав источников).
import express from 'express';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.join(process.env.STAND_TMP || os.tmpdir(), 'discuss-stand.db');
try { fs.unlinkSync(dbFile); } catch (e) {}
process.env.STAND_DB = dbFile;
process.env.STAND_HTML = path.join(here, '..', 'new', 'web', 'public', 'discuss.html');

// ---------- база-заглушка (схема — подмножество боевых колонок из db_schema) ----------
const db = new Database(dbFile);
db.exec(`
CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT, slug TEXT);
CREATE TABLE tasks (id INTEGER PRIMARY KEY, task TEXT NOT NULL, status TEXT, project_id INTEGER, client_slug TEXT, comment TEXT,
  fact_min INTEGER DEFAULT 0, deadline TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE tickets (id INTEGER PRIMARY KEY, title TEXT NOT NULL, status TEXT, project_id INTEGER, client_slug TEXT, minutes INTEGER DEFAULT 15,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE comments (id INTEGER PRIMARY KEY, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, client_slug TEXT, author_type TEXT DEFAULT 'admin',
  author_name TEXT, text TEXT NOT NULL, link TEXT, parent_id INTEGER, is_read_admin INTEGER DEFAULT 0, is_read_client INTEGER DEFAULT 0,
  deleted INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), visibility TEXT DEFAULT 'public');
CREATE TABLE crm_leads (id INTEGER PRIMARY KEY, name TEXT, last_name TEXT);
CREATE TABLE staff (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE business_connections (id INTEGER PRIMARY KEY, business_connection_id TEXT UNIQUE NOT NULL, source TEXT);
CREATE TABLE business_chats (id INTEGER PRIMARY KEY, business_connection_id TEXT NOT NULL, telegram_chat_id INTEGER NOT NULL, client_username TEXT DEFAULT '',
  client_name TEXT DEFAULT '', crm_lead_id INTEGER, last_message_at TEXT, last_incoming_at TEXT, unread_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), is_archived INTEGER DEFAULT 0, chat_type TEXT DEFAULT 'user', is_enabled INTEGER DEFAULT 1,
  project_id INTEGER, custom_name TEXT DEFAULT '', name_src TEXT DEFAULT '', is_ignored INTEGER DEFAULT 0);
CREATE TABLE business_messages (id INTEGER PRIMARY KEY, business_chat_id INTEGER NOT NULL, direction TEXT NOT NULL, text TEXT DEFAULT '',
  message_type TEXT DEFAULT 'text', created_at TEXT DEFAULT (datetime('now')), deleted_at TEXT, author_id INTEGER, sender_name TEXT,
  hidden_local INTEGER DEFAULT 0, transcript TEXT);
`);
// время — МСК «сегодня ЧЧ:ММ» / «−N дней» → UTC-строка базы
const pad = n => String(n).padStart(2, '0');
function at(daysAgo, hhmm) {
  const now = new Date(Date.now() + 3 * 3600e3);                          // «сейчас» по МСК
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, h - 3, m));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}
const ins = (t, o) => db.prepare(`INSERT INTO ${t} (${Object.keys(o).join(',')}) VALUES (${Object.keys(o).map(() => '?').join(',')})`).run(...Object.values(o));
[[1, 'ТехноСтрой', 'technostroy'], [2, 'Мебель Дом', 'mebel'], [3, 'Автосервис «Мотор»', 'motor'], [4, 'Кофейня «Зёрна»', 'zerna'],
 [5, 'Стройматериалы 24', 'strm24'], [6, 'ЮрКонсалт', 'yurk']].forEach(([id, name, slug]) => ins('projects', { id, name, slug }));
ins('staff', { id: 1, name: 'Константин' });
ins('tasks', { id: 662, task: 'Перенос блога на новый шаблон', status: 'В работе', project_id: 1, client_slug: 'technostroy', fact_min: 160, deadline: '2026-10-30',
  comment: 'Описание\n[x] Карта редиректов\n[x] Шаблон статьи\n[x] Шаблон рубрики\n[x] Стейдж\n[x] Превью\n[ ] Обложка 360 px\n[ ] Релиз' });
ins('tasks', { id: 655, task: 'SEO-аудит: 38 страниц без title', status: 'Проверка', project_id: 5, client_slug: 'strm24', fact_min: 95 });
ins('tasks', { id: 640, task: 'План работ на ноябрь', status: 'В работе', project_id: 4, client_slug: 'zerna', fact_min: 30 });
ins('tickets', { id: 318, title: 'Не приходят заявки с формы Tilda', status: 'waiting_client', project_id: 2, client_slug: 'mebel', minutes: 30, created_at: at(2, '09:10') });
const C = (et, id, type, name, text, when, vis) => ins('comments', { entity_type: et, entity_id: id, author_type: type, author_name: name, text, created_at: when, visibility: vis || 'public' });
C('task', 662, 'client', 'Ольга Смирнова', 'Хотим блог в новом шаблоне до запуска рекламы. Старые адреса статей должны открываться — на них ссылки из рассылок.', at(3, '10:14'));
C('task', 662, 'admin', 'Игорь Петров', 'Собрал карту 301-редиректов: 64 статьи, 3 рубрики. Каннибализации по кластеру «ремонт кровли» нет — проверил по Вебмастеру.', at(1, '18:40'));
for (let i = 0; i < 4; i++) C('task', 662, 'admin', 'Игорь Петров', 'Промежуточный отчёт ' + (i + 1), at(2, '1' + i + ':00'));
C('task', 662, 'admin', 'Анна Ким', 'Залила превью на стейдж. @Константин, проверь мобилку: на 360 px обложка статьи режется сверху.', at(0, '14:30'));
C('task', 662, 'admin', 'Анна Ким', 'Залила превью на стейдж, проверь мобилку', at(0, '14:32'));
C('task', 655, 'admin', 'Анна Ким', 'Сделала шаблон title для карточек товара', at(1, '16:05'));
C('task', 655, 'admin', 'SORIC', 'Робот: напомнил клиенту о проверке', at(1, '16:20'), 'internal');
C('task', 640, 'client', 'Мария Белова', 'Добавьте, пожалуйста, 14 ключей из Wordstat в семантику — прислала файл в почту', at(1, '12:00'));
C('ticket', 318, 'client', 'Мебель Дом', 'Заявки с формы на сайте перестали приходить в Битрикс24 со вчерашнего вечера.', at(1, '09:20'));
C('ticket', 318, 'admin', 'Вы', 'Вебхук отдаёт 502 у Битрикс24, жду доступ', at(0, '11:18'));
ins('business_connections', { business_connection_id: 'bc-tg', source: 'mtproto' });
ins('business_connections', { business_connection_id: 'bc-wa', source: 'whatsapp' });
ins('business_connections', { business_connection_id: 'bc-max', source: 'max_user' });
const CH = (id, bc, name, proj, unread, last) => ins('business_chats', { id, business_connection_id: bc, telegram_chat_id: id, client_name: name, project_id: proj, unread_count: unread, last_message_at: last, last_incoming_at: last });
CH(81, 'bc-tg', 'Ольга Смирнова', 1, 3, at(0, '14:05'));
CH(82, 'bc-wa', 'Сергей Волков', 3, 1, at(0, '10:52'));
CH(83, 'bc-max', 'Мария Белова', 6, 0, at(1, '17:30'));
const M = (chat, dir, text, when, type) => ins('business_messages', { business_chat_id: chat, direction: dir, text, created_at: when, message_type: type || 'text', author_id: dir === 'out' ? 1 : null });
M(81, 'out', 'Ольга, добрый день! Счёт за ноябрь отправили на почту.', at(1, '11:00'));
M(81, 'in', 'Спасибо, получили.', at(1, '11:20'));
M(81, 'in', 'Ещё вопрос по декабрю', at(0, '14:01'));
M(81, 'in', 'Бухгалтерия закрывает месяц раньше', at(0, '14:03'));
M(81, 'in', 'Можно счёт на декабрь до пятницы? Бухгалтерия закрывает месяц', at(0, '14:05'));
M(82, 'in', '', at(0, '10:52'), 'voice');
M(83, 'out', 'Акт сверки за III квартал — подписали, оригинал отправили курьером', at(1, '17:30'));
db.close();

// ---------- соседние модули — заглушки ----------
const { mountDiscuss } = await import('./web/discuss.js');
const app = express();
// лента Threads: как app.locals.threads.posts() из патча threads.js (кэш постов)
const POSTS = [
  { id: '1801', text: 'Разобрали, почему CTR в Яндексе падает после смены сниппета: пять причин и что проверить первым делом', permalink: 'https://www.threads.net/@cashruflow/post/X1', timestamp: new Date(Date.parse(at(0, '12:40').replace(' ', 'T') + 'Z')).toISOString(), media_type: 'TEXT_POST', username: 'cashruflow' },
  { id: '1795', text: 'Как мы перенесли 64 статьи блога без потери трафика: карта 301-редиректов и проверка в Вебмастере', permalink: 'https://www.threads.net/@cashruflow/post/X2', timestamp: new Date(Date.parse(at(2, '19:10').replace(' ', 'T') + 'Z')).toISOString(), media_type: 'TEXT_POST', username: 'cashruflow' },
];
app.locals.threads = { live: () => null, posts: () => ({ ok: true, state: process.env.STAND_FEED || 'ok', items: POSTS, username: 'cashruflow', at: Date.now() }) };
// имя чата — как chatDisplayName() из crm_chats.js (в бою — app.locals.chatDisplayName из патча)
app.locals.chatDisplayName = (chat, lead) => (chat.name_src === 'manual' && chat.custom_name) ? chat.custom_name : (chat.client_name || '');
function scopeSql(req, col) {   // копия roles.js scopeSql
  const ids = req && req.cfScope;
  if (!Array.isArray(ids)) return { sql: '', args: [] };
  if (!ids.length) return { sql: ' AND 0', args: [] };
  return { sql: ` AND ${col} IN (${ids.map(() => '?').join(',')})`, args: ids };
}
const roleOf = req => ({ role: String(req.query.role || req.headers['x-role'] || 'owner') });
const MANAGER_DENY = new Set(['cash']);
const allowed = (role, key) => role === 'owner' || (role === 'manager' && !MANAGER_DENY.has(key)) || (role === 'contractor' && ['tasks', 'issues', 'ticket', 'projects'].includes(key));
app.use((req, res, next) => { if (String(req.query.role || req.headers['x-role'] || '') === 'contractor') req.cfScope = [1]; next(); });
mountDiscuss(app, { pauth: () => true, scopeSql, roleOf, allowed });
// сначала заглушки стенда: в new/web/public лежат ВЫДЕРЖКИ sidebar.js и icons.svg (для диффа), а не рабочие файлы
app.use(express.static(path.join(here, 'public')));
app.use(express.static(path.join(here, '..', 'new', 'web', 'public')));
app.listen(3077, () => console.log('stand: http://127.0.0.1:3077/discuss'));
