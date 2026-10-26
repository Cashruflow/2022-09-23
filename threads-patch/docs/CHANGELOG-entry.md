## 27.10.2026 — «Треды» (/discuss)  <!-- ADR-<номер от create_adr> -->
- Новая страница «Треды» (`/discuss`, пункт меню в «Работе»): обсуждения задач и тикетов, чаты Telegram/WhatsApp/MAX
  и лента Threads одним списком; поиск и вкладки — на сервере; превью справа на ПК, шторкой на телефоне; только чтение.
- API: `GET /api/discuss/list`, `GET /api/discuss/item` (web/discuss.js, readonly-соединение, без миграций).
- Права: раздел `discuss` в roles.js; источники режутся правами tasks/ticket/chats/threads и областью own_projects.
- threads.js: `app.locals.threads.posts()` — кэш своих постов 10 мин; crm_chats.js: `app.locals.chatDisplayName`.
- Спрайт: `i-messages-square`, `i-repeat-2` (Lucide 1.50.0), `ICONS_V` 31; `habits-sw.js` SHELL `?v=31`, CACHE `habits-v148`;
  `sidebar.js?v=20261027a` во всех подключениях.
