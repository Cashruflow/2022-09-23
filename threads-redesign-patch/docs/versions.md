# Новые значения ?v= и версий (28.10.2026)

| Что | Было | Стало | Где меняется | Проверка «значение не выдавалось» |
|---|---|---|---|---|
| `threads-analytics-widget.js?v=` | 3 | **4** | `web/public/threads.html` (единственное подключение), комментарий в шапке самого файла | `search_code "threads-analytics-widget"` по `web/public` (html) — одно место, `?v=3`; `?v=4` нигде не было |
| `ICONS_V` (адрес спрайта) | 31 | **32** | `web/server.js`, строка 242 | максимальная `icons.svg?v=` по проекту — 31 (`habits-sw.js`); `?v=32` нигде нет |
| `habits-sw.js` SHELL спрайт | `?v=31` | **`?v=32`** | `web/public/habits-sw.js`, строка 36 | = `ICONS_V` |
| `habits-sw.js` CACHE | `habits-v147` | **`habits-v148`** | `web/public/habits-sw.js`, строка 24 | `habits-v148` не встречается |
| `ui.css?v=` | 105 | 105 (без изменений) | — | `ui.css` не правился |
| `/theme.css`, `toast.js`, `loc-time.js?v=1`, `sidebar.js?v=20261028b` | — | без изменений | — | — |
| `threads.html` | без `?v=` (навигация) | — | — | — |

VERSION платформы (`update_version`) не поднимается — только по прямой просьбе Константина.
