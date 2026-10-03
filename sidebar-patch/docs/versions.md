# Новые версии статики (сайдбар, 02.10.2026; сверено с сервером 03.10.2026)

Все значения «Стало» — новые, ранее не выданные (проверено `search_code` по `web/public` и `docs`):
правило CLAUDE.md «бамп `?v=` только на новое, ранее не выданное значение».

| Файл | Было (на сервере 03.10.2026) | Стало | Где поднято |
|---|---|---|---|
| `/sb-resize.js` | `?v=3` | `?v=4` | `web/public/sidebar.js` (`__sbLoad('cf-sb-resize-src', …)`) |
| `/sb-profile.js` | `?v=4` | `?v=5` | `web/public/sidebar.js` (`sp.src`) |
| `/mhead.js` | `?v=9` | `?v=10` | `web/public/sidebar.js` |
| `/sidebar.js` | без версии | без версии | подключается из HTML без `?v=` (ADR-180) — HTML кэшируется до 5 мин, нужен жёсткий рефреш |
| `/issues_page.js` | `?v=8` | `?v=9` | `web/public/issues.html` (в патче) |
| `/ticket_page.js` | `?v=15` | `?v=16` | `web/public/ticket.html` (в патче) |
| спрайт `/assets/icons.svg` | `ICONS_V = 14` | `ICONS_V = 15` | `web/server.js` (нужен `pm2 restart web-interface`); 13 (i-copy-plus) и 14 (i-sim/i-esim) уже выданы |
| `habits-sw.js` SHELL | `/assets/icons.svg?v=13` | `?v=15` | `web/public/habits-sw.js` (в патче) |
| `habits-sw.js` CACHE | `habits-v112` | `habits-v113` | командой `sed` из README (строка 24 — 16 КБ, в дифф не взята) |

Не трогаются патчем, но изменились на сервере после 02.10 и перенесены в `orig/` и `new/` как есть:
`shot.js?v=7` и `ui-dialogs.js?v=8` (в `sidebar.js`), подпись пункта `/seo/app` «SEO» (была «Сайт»),
`ui-menu.js?v=11` (контекст в `ticket.html`).

`page-header.js` НЕ менялся (селектор `.sb-search-results` в `SKIP` безвреден; правка потянула бы
бамп в `cab-sidebar.js` и кэшах SW).
