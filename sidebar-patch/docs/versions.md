# Новые версии статики (ADR-309)

| Файл | Было | Стало | Где поднято |
|---|---|---|---|
| `/sb-resize.js` | `?v=3` | `?v=4` | `web/public/sidebar.js` (`__sbLoad('cf-sb-resize-src', …)`) |
| `/sb-profile.js` | `?v=4` | `?v=5` | `web/public/sidebar.js` (`sp.src`) |
| `/mhead.js` | `?v=9` | `?v=10` | `web/public/sidebar.js` |
| `/sidebar.js` | без версии | без версии | подключается из HTML без `?v=` (ADR-180) — HTML кэшируется до 5 мин, нужен жёсткий рефреш |
| `/issues_page.js` | `?v=8` | `?v=9` | `web/public/issues.html` (в патче) |
| `/ticket_page.js` | `?v=15` | `?v=16` | `web/public/ticket.html` (в патче) |
| спрайт `/assets/icons.svg` | `ICONS_V = 12` | `ICONS_V = 13` | `web/server.js` (нужен `pm2 restart web-interface`) |
| `habits-sw.js` SHELL | `/assets/icons.svg?v=12` | `?v=13` | `web/public/habits-sw.js` (в патче) |
| `habits-sw.js` CACHE | `habits-v106` | `habits-v107` | командой `sed` из README (строка 24 — 16 КБ, в дифф не взята) |

`page-header.js` НЕ менялся (селектор `.sb-search-results` в `SKIP` безвреден; правка потянула бы
бамп в `cab-sidebar.js` и кэшах SW).
