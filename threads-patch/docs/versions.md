# Версии, которые поднимает патч (значения проверены search_code 26.10.2026 — нигде не выдавались)

| Что | Было | Стало | Где |
|---|---|---|---|
| `ICONS_V` (адрес спрайта) | 30 | **31** | web/server.js:242 (`icons.svg?v=3[1-9]` по web/public — 0 совпадений) |
| SHELL спрайта трекера | `/assets/icons.svg?v=30` | `?v=31` | web/public/habits-sw.js:36 |
| CACHE трекера | `habits-v147` | **`habits-v148`** | web/public/habits-sw.js:24 (sed, строка 21 КБ) |
| `/sidebar.js?v=` | `20261026f` | **`20261027a`** | ~75 подключений: web/public/*.html, web/blog_app/page.html, web/roles.js (tools/bump_sidebar_v.sh) |
| `/discuss.css` | — | `?v=1` | discuss.html (новый) |
| `/discuss_page.js` | — | `?v=1` | discuss.html (новый) |
| `ui.css`, `list-toolbar.js`, `ui-color.js`, `linkify.js` | без изменений | 100 / 6 / 1 / 2 | discuss.html берёт текущие |

page-err.js патч не трогает. Повтор старого значения запрещён: страница со старым спрайтом под тем же `?v=`
даст в /issues «в спрайте нет символа i-messages-square» (checkUse в page-err.js).
