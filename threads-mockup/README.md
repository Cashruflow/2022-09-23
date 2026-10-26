# Макет «Треды» — список тредов (ПК и телефон, светлая и тёмная тема)

Файлы:
- `threads.html` — один файл: инлайн CSS, встроенный спрайт иконок, данные — в `<script>`. Параметры: `?view=desktop|mobile&theme=light|dark`.
- `render.mjs` — рендер в PNG через Playwright + уже установленный Chromium (`node render.mjs`).
- `desktop-light.png`, `desktop-dark.png` — 1440×900 @2x; `mobile-light.png`, `mobile-dark.png` — 390×844 @3x.

## Откуда взят стиль

| Что | Источник на сервере (/home/cashruflow) |
|---|---|
| Каркас страницы (верхняя полоса с крошками, сегмент, чип ⚡, карточки 18px, заголовок 28/700, плитки) | `/analytics?tab=wsite`: `web/public/analytics.html`, `analytics_app.js` (build/renderTop/head/tile), `seo-v2.css` (`.sv2-*`) |
| Сайдбар ПК — плавающая рейка 84px, left/top/bottom 24px, радиус 24, shadow-lg, пункты 22px, 4 кнопки внизу | `web/public/sidebar.js` (`cssPc`, `buildSbx`, `SBX_DEF_PINS`) |
| Телефон: кнопки ⚙ и ☰ 42×42, радиус 10, `--ui-surface-2` + рамка `--ui-line` | `web/public/mhead.js`, мобильная часть `sidebar.js` |
| Чипы, `.ui-st`, `.ui-badge`, `.ui-id`, iOS-строки с разделителем от аватара, `.ui-mhead__t` 34/800, eyebrow | `web/public/ui.css` |
| Значения токенов тёмной/светлой темы | `web/public/ui.css :root`, `DEFAULTS` в `web/public/set.html` (ключи `ui_*` и `ui_l_*`), `docs/DESIGN-TOKENS.md` |
| Иконки | `web/public/assets/icons.svg` (Lucide) — символы скопированы как есть |
| Сущности | задачи `#662`, тикеты `TIC-318` и статусы (`task-card.js`: новый / в работе / ждём вас / решён), CRM-чаты Telegram/WhatsApp/MAX/почта (`crm-chats.html`, `leads.html WC_KIND_LBL`), лента Threads (`threads.html` платформы — посты, ответы, статистика) |

## Токены

Цвета: `--ui-brand`, `--ui-danger`, `--ui-ok`, `--ui-warn`, `--ui-violet`, `--ui-id`, `--ui-bg`, `--ui-page-bg`, `--ui-surface`,
`--ui-card-bg`, `--ui-surface-2`, `--ui-surface-3`, `--ui-line`, `--ui-card-border`, `--ui-line-2`, `--ui-tx`, `--ui-tx-2`, `--ui-tx-3`,
`--ui-row-hover`, `--ui-badge-bg/-text`, `--ui-btn1-text`; мягкие `--ui-brand-soft(-line/-tx)`, `--ui-ok-soft*`, `--ui-warn-soft*`, `--ui-violet-soft*`.
Геометрия: `--ui-radius` 8, `--ui-card-radius` 12, `--ui-radius-lg` 24, `--ui-chip-radius`, `--ui-tap` 44, `--ui-badge-h/-radius`.
Тени: `--ui-shadow-sm/md/lg`; в светлой — через `--ui-shadow-c` (rgba(15,28,46,.35)) по формуле DESIGN-TOKENS.
Шрифт: стек платформы `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

### Своё (в токенах нет) — помечено `--th-*`
- `--th-radius: 18px` — радиус карточек каркаса; сейчас это литерал `.sv2-nav` в `seo-v2.css`, токена нет.
- `--th-row-radius: 14px` — радиус выделенной строки и плиток; литерал `.sv2-tile`.
- `--th-glass` — фон полупрозрачной нижней панели (карточка 84–86% + blur 20px). В платформе шапка нарочно плоская (`--ui-header-blur: 0`), стекла нет.
- `--th-av-l` — светлота аватаров-инициалов (`hsl(h 55% 42%)` как `.sv2-fav`; в светлой 46%).
- В шрифтовой стек добавлены `Roboto, "Liberation Sans"` перед `sans-serif` — только чтобы headless Linux не взял DejaVu; на устройствах ничего не меняет.
- Цвета каналов: фирменных цветов Telegram/WhatsApp в токенах нет — значок канала покрашен `--ui-brand` (TG), `--ui-ok` (WA), `--ui-violet` (почта), `--ui-warn` (MAX).
- `--ui-row-hover` светлой темы и `--ui-page-bg` светлой взяты равными `ui_l_surface3` / `ui_l_bg` — отдельного ключа в `/set` нет. `--ui-danger` для светлой не переопределён (в `set.html` нет `ui_l_danger`).
- Иконки `i-repeat-2` (репост) и `i-menu` (бургер) — из Lucide, в спрайте их нет (бургер на платформе — символ ☰).

## Элементы iOS / One UI
- **iOS:** large title (28px ПК / 34px телефон), поиск-пилюля, фильтр-чипы как сегмент (активный — инверсный), разделители строк с отступом под аватар (как `.ui-ios-row`), мягкие радиусы 14–24, полупрозрачная нижняя панель с blur и home-индикатором, круглая кнопка отправки, «2 новых» — разделитель непрочитанного.
- **One UI:** на телефоне заголовок опущен в верхнюю треть (eyebrow «Работа» + «Треды» + счётчики), список и действия — в нижней половине, ближе к пальцу; центральная кнопка «Новый тред» в нижней панели.
- **Threads (Meta):** пост ленты — аватар, имя + @handle, текст, вертикальная линия ветки к мини-аватарам ответивших, счётчики лайков/ответов/репостов.
- **iMessage / Samsung Messages:** чат-строки — аватар с бейджем канала, имя, клиент · канал, последнее сообщение, время синим при непрочитанном, бейдж числа, «прочитано» двумя галочками.

## Чем отличается от текущей платформы
- Нижней панели у портала нет (есть только ⚙/☰ сверху и док `bottom-nav.js` на личных страницах) — здесь добавлена.
- Активный чип — инверсный (`--ui-tx` фоном), а не `.ui-tab.is-on` (`--ui-card-border`).
- Карточка списка в телефоне — `--ui-radius-lg` 24 (как `.ui-ios-card`), строки без собственных рамок.
- Раздела «Треды» в меню нет: на макете он закреплён в рейке вместо «Чатов» (иконка `i-message`, бейдж 12).

## Что нужно для переноса в код
1. Страница `web/public/threads-hub.html` (имя `/threads` занято постингом в Threads) на каркасе `.sv2` из `seo-v2.css`; `ui.css` → `theme.css` по правилу ADR-319.
2. API-агрегатор: обсуждения задач/тикетов/клиентов (комментарии `tasks`, `tickets`), чаты CRM (`/crm/chats`, непрочитанные уже считает sidebar `sbBadge`), посты Threads — единый формат `{kind, title, source, last, time, unread, replies, status}`; фильтр — на сервере (`docs/rules/ui.md` «Фильтры реестров считаются на сервере»).
3. Завести токены вместо `--th-*` через `/set` + `THEME_DEFAULTS` (server.js) + `set.html DEFAULTS` + `CABINET_THEME_KEYS`; добавить в спрайт `i-repeat-2`, `i-menu` (с `?v=`).
4. Телефон: строки — `.ui-ios-row`, карточка — `.ui-ios-card`; нижнюю панель согласовать с `bottom-nav.js` (`--cfbn-pad`, тосты над доком) или отказаться от неё в пользу FAB.
5. Пункт меню в `sidebar.js MENU` (группа «Работа»), бейдж непрочитанного, `page_badges.js`.
