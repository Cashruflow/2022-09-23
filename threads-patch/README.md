# Патч «Треды» (/discuss) — 26.10.2026

Подготовлено, **НЕ применено**. На сервере только чтение: `read_file`, `search_code`, `read_docs`, `list_docs`,
`db_schema`. Ничего не коммитилось и не пушилось. Черновик ADR — `docs/ADR-draft-*.md`, номер выдаст `create_adr`;
в коде номер ADR не упоминается.

Макет — `../threads-mockup/` (эталон вида). Скриншоты стенда — `screens/`.

## Что сделано

| # | Что | Где |
|---|---|---|
| 1 | Страница «Треды»: ПК — список слева + липкое превью справа (≥1101px); ≤1100 — превью шторкой `.mdl-back.mdl-right` (на телефоне ui.css делает её нижним листом). Шапка `.ph` (h1 + `p.ph-s`, ADR-147), панель `.lt-one` + `ltBuild` (поиск + вкладки, ADR-338), вкладки `.ui-tabs > .ui-tab` со счётчиками, группы «Сегодня / Вчера / На этой неделе / Раньше», «Показать ещё · осталось N», пустые состояния и ошибки — `.ui-empty` + «Повторить», тосты — `pltToast`. Обе темы — только токены `--ui-*`. Состояние в адресе: `?type=&q=&id=`. Поиск — «/». | `web/public/discuss.html`, `discuss.css?v=1`, `discuss_page.js?v=1` |
| 2 | Бэкенд-агрегатор, **readonly-соединение с tasks.db, без миграций**: `GET /api/discuss/list`, `GET /api/discuss/item`; страница `app.get('/discuss')`. | `web/discuss.js` (новый), `web/server.js` (импорт + mount) |
| 3 | Права: раздел `discuss` (РАБОТА), эталоны в `selfTest()`. | `web/roles.js` |
| 4 | Пункт меню «Треды» (`i-messages-square`, уникальный значок) в группе РАБОТА после «Тикеты». | `web/public/sidebar.js` (MENU) |
| 5 | Лента: `app.locals.threads.posts()` — кэш своих постов 10 мин, не блокирует (как `liveGet`); существующие роуты /threads не тронуты. | `web/threads.js` (+25 строк) |
| 6 | Имя чата — одна функция: `app.locals.chatDisplayName = chatDisplayName`. | `web/crm_chats.js` (+2 строки) |
| 7 | Спрайт: `i-messages-square`, `i-repeat-2` (lucide-static 1.50.0, ISC, с registry.npmjs.org); `ICONS_V` 30→31; `habits-sw.js` SHELL `?v=31`, CACHE `habits-v148`. | `assets/icons.svg`, `server.js`, `habits-sw.js` |
| 8 | Документы: черновик ADR, дополнения ui.md и platform.md, запись CHANGELOG, таблица `?v=`. | `docs/` |

`i-menu` в спрайт **не добавлен**: на странице не используется — ☰ рисует платформа (sidebar.js/mhead.js), своей
шапки страница не делает. Мёртвый символ в спрайте не нужен.

## Маршрут и название

- **`/discuss`** — свободен: `search_code "/discuss"` по web — только `/api/pair/views/discussed` (другая ручка); файла
  `discuss*.html` нет; `sidebar.js?v` / роли — без совпадений. `/inbox` занят смыслом (`/api/mail/inbox*`, вкладка `/mail#inbox`),
  поэтому не он. `/threads` (постинг в Threads, `threads.js:181`, пункт «Тредс» в ИНТЕГРАЦИЯХ) **не тронут**.
- Пункт **«Треды»** — по макету. С «Тредс» (`/threads`) не конфликтует: другой href, группа и значок (`i-messages-square`
  против `i-message`; в sidebar-patch — `i-at-sign`). Поиск меню по «тред» найдёт оба — это правда о двух разделах.
  **Решение за вами:** переименовать «Тредс» → «Threads (постинг)», чтобы не путать на слух.
- Роут монтируется рядом с `/mcp`, `/stats` (стр. ~563) — **выше `app.get("/:slug")`**; на сервере проверить, что проекта со
  слагом `discuss` нет (`SELECT id FROM projects WHERE slug='discuss'` — `db_query` в этой сессии не загружался).

## Эндпоинты

`GET /api/discuss/list?type=all|talks|feed|chats&q=&cursor=&limit=` (limit 30, макс. 60) →
`{ ok, items:[Item], next_cursor, counts:{all,talks,feed,chats}, unread:{chats,messages}, awaiting, feed_state, access }`

`GET /api/discuss/item?id=task:N|ticket:N|chat:N|post:ID` → `{ ok, item: Item + {tiles:[{l,v,s}], messages:[{id,author,role,internal,text,at}], total} }`
(последние 40 сообщений; **ничего не отмечает прочитанным**).

`Item = {kind:'talk'|'chat'|'feed', id, sub:'task'|'ticket'|'tg'|'wa'|'max'|'threads', ref, title, source, project, project_id,
participants:[{name,role}], last_text, last_author, last_at (ISO UTC), unread (число|null), awaiting, replies, status{code,label,color,group}|null, url, ext}`.

Курсор — base64url `{t:'YYYY-MM-DD HH:MM:SS', k:'kind:id'}`; каждый источник отдаёт `limit+1` строк не позже курсора, слияние и
отрезка — в JS. Счётчики вкладок — от поиска, не от вкладки и курсора. Ошибки: 422 `bad_type`/`bad_cursor`/`bad_id`/`gone`,
403 `no_access` (раздел источника закрыт), 503 нет базы; 404 нигде (page-err.js заводит 404/5xx в /issues).

### SQL (суть)
- **Обсуждения** (задачи и тикеты, по одному запросу на тип):
  `FROM (SELECT entity_id, MAX(id) last_id, MAX(created_at) last_at, COUNT(*) n FROM comments WHERE entity_type='task' AND deleted=0 GROUP BY entity_id) a
  JOIN tasks t ON t.id=a.entity_id LEFT JOIN projects pr ON pr.id=t.project_id WHERE 1=1 [scopeSql t.project_id] [поиск] [AND datetime(a.last_at) <= @ct]
  ORDER BY datetime(a.last_at) DESC, t.id DESC LIMIT n`; последняя реплика — `comments WHERE id=last_id`; участники — 3 последних
  `author_name`. Поиск — `instr(lower_ru(...), lower_ru(@q))` по названию, номеру, проекту, slug и текстам/авторам комментариев (ADR-162).
  Статус задачи — `TS.labelOf/colorOf/groupOf`, тикета — `labelMap/colorMap('ticket_status')`.
- **Чаты**: тот же набор, что /crm/chats по умолчанию — `COALESCE(is_archived,0)=0 AND COALESCE(is_ignored,0)=0 AND (тип не group OR is_enabled=1)`;
  `business_connections.source` → канал (whatsapp → WA, max/max_user → MAX, иначе Telegram); последнее сообщение — `deleted_at IS NULL`, `ORDER BY id DESC LIMIT 1`;
  поиск — имя/ник/лид/проект + `EXISTS` по текстам сообщений.
- **Лента**: без SQL — кэш постов threads.js (`GET /{me}/threads?fields=id,text,permalink,timestamp,media_type,username&limit=15`).

## Источники и «непрочитанные»

| Источник | Что берём | Непрочитанное |
|---|---|---|
| Задачи / тикеты | `comments` (entity_type task/ticket, `deleted=0`, внутренние видны с пометкой) + `tasks`/`tickets` | **не считается** (`unread: null`). `is_read_admin` пишет только `tickets.js` (0 при комментарии клиента); места, где флаг снимается при прочтении, в модулях вне server.js нет, а server.js (>1 МБ) поиском не виден. Даже если снимается — это «прочитал хоть кто-то», не «прочитал я». Вместо него **`awaiting`**: последнее слово за клиентом (`author_type <> 'admin'`). |
| Чаты CRM | `business_chats` / `business_messages` | **честно**: `business_chats.unread_count` (сбрасывает открытие диалога на /crm/chats). Превью его не трогает. Разделитель «N новых» — перед последними N входящими. |
| Лента Threads | кэш постов | нет понятия «непрочитано»; ответы/лайки не тянем (N запросов insights к Meta) — «Открыть в Threads». |
| Почта | **не входит** | флаги «удалено/архив» живут в mail_log (`logFlag`), их копию заводить нельзя → нужен экспорт из mail_inbound.js. |

В подзаголовке: «N тредов · M чатов с непрочитанным · K ждут вашего ответа».

## Права

- Раздел `discuss` (страница и `/api/discuss*`). Умолчания (`defaultAllowed`): менеджеру открыт, подрядчику закрыт (нет в `CONTRACTOR_ALLOW`).
- Внутри: задачи — право `tasks`, тикеты — `ticket`, чаты — `chats`, лента — `threads` (`allowed(role,key)` из roles.js). Нет права — вкладка
  скрыта, превью — 403. Роль с областью own_projects: задачи/тикеты только своих проектов (`scopeSql`), чаты и ленту не получает.
- **Решение за вами:** открыть «Треды» подрядчику — галочка на /roles + строка `{ r: true, p: "/api/discuss" }` в `SCOPE_API` (role_scope.js),
  иначе `forbidden_scope`. Обработчик к этому готов.
- Тенанты: страница только портальная (ppass). Кабинетам клиентов не отдаётся; кабинетная версия — отдельной задачей.

## Структура папки

```
threads-patch/
  orig/web/...         ВЫДЕРЖКИ боевых файлов (реальные строки на своих номерах, выше — пустые заглушки)
  new/web/...          те же с правками + новые файлы (discuss.js, discuss.html/.css, discuss_page.js — полные)
  patches/*.diff       по файлу (a/ b/ от /home/cashruflow → patch -p1); all.diff — все одним файлом
  icons-src/*.svg      исходники Lucide; icons-add.svg.txt — 2 <symbol> + комментарий для вставки перед </svg>
  docs/                ADR (черновик), ui.md/platform.md-дополнения, CHANGELOG, versions.md
  tools/               make_excerpts.py + excerpt_src.py (как собраны выдержки), make_diffs.sh, bump_sidebar_v.sh, shots.mjs
  stand/               локальный стенд для скриншотов (заглушки ui.css/theme.css/sidebar.js — НА СЕРВЕР НЕ ЕДЕТ)
  screens/             скриншоты стенда
```

Выдержки (номера строк = боевые на 26.10.2026): `server.js` 1–8, 238–245, 556–567; `roles.js` 40–49, 452–459;
`sidebar.js` 246–254; `threads.js` 307–316; `crm_chats.js` 2579–2588; `habits-sw.js` 30–39 (строку 24 — CACHE, 21 КБ — правим sed);
`assets/icons.svg` 220–224 (считаем, что перевода строки в конце нет, как было 03.10).

## Порядок применения на сервере

**Шаг 0 — ADR.** `create_adr` с текстом `docs/ADR-draft-*.md` (без строки `id:`), `status: Proposed`. Номер в код не вписывать;
дописать его только в `docs/CHANGELOG-entry.md`, `ui.md-addition.md`, `platform.md-addition.md` при переносе.

**Шаг 1 — сверка.** `read_file` выдержек (номера выше): если строки сдвинулись — patch скажет offset/FAILED, сверять руками.
Проверить: нет проекта со слагом `discuss`; `app.get("/:slug"` в server.js ниже стр. 563; `ICONS_V` всё ещё 30; CACHE `habits-v147`.

Вариант А — SSH (из `/home/cashruflow`):
```bash
cd /home/cashruflow
tar czf /tmp/discuss-backup-$(date +%Y%m%d-%H%M).tgz web/server.js web/roles.js web/threads.js web/crm_chats.js \
  web/public/sidebar.js web/public/assets/icons.svg web/public/habits-sw.js
# 1) dry-run ОБЯЗАТЕЛЕН здесь, на сервере (локальный прогон был на выдержках)
patch -p1 --dry-run < /path/to/threads-patch/all.diff && patch -p1 < /path/to/threads-patch/all.diff
# 1а) icons.svg не лёг (в конце файла есть \n или другой хвост) — вставить руками перед последним </svg>:
#   python3 -c "p='web/public/assets/icons.svg';s=open(p).read();a=open('/path/to/threads-patch/icons-add.svg.txt').read();i=s.rindex('</svg>');open(p,'w').write(s[:i]+a+s[i:])"
# 2) иконки/версии: кэш SW трекера (строка 24) и ?v= у sidebar.js во всех подключениях
sed -i "24s/^const CACHE = 'habits-v147'; /const CACHE = 'habits-v148'; \/\/ v148 (27.10.2026, «Треды») — спрайт ?v=31 в SHELL (i-messages-square, i-repeat-2): сброс кэша. /" web/public/habits-sw.js
grep -c "habits-v148\|icons.svg?v=31" web/public/habits-sw.js        # 2
sh /path/to/threads-patch/tools/bump_sidebar_v.sh --dry && sh /path/to/threads-patch/tools/bump_sidebar_v.sh   # «осталось старых: 0»
# 3) синтаксис и спрайт
for f in web/discuss.js web/server.js web/roles.js web/threads.js web/crm_chats.js web/public/sidebar.js \
         web/public/discuss_page.js web/public/habits-sw.js; do node --check $f || echo "FAIL $f"; done
grep -c 'id="i-messages-square"\|id="i-repeat-2"' web/public/assets/icons.svg     # 2
# 4) ADR создан на шаге 0 — индексы
node scripts/migrate-ard.js && node scripts/validate-ard.js
# 5) docs: ui.md, platform.md, CHANGELOG (в начало) — из docs/*-addition.md, CHANGELOG-entry.md
# 6) рестарт (server.js, roles.js, threads.js, crm_chats.js — серверные модули)
sudo pm2 restart web-interface
sudo pm2 logs web-interface --lines 40 --nostream   # «[deploy] start» без стектрейса, «[roles] самопроверка: N ок», нет «[discuss] tasks.db»
curl -s -o /dev/null -w "%{http_code}\n" https://ai.cashruflow.ru/discuss          # без куки — редирект/гейт, не 404
```

Вариант Б — MCP (как принято: «прод правится только write_file/str_replace»): `create_adr` → по каждому `patches/*.diff` —
`str_replace` старого фрагмента на новый (новые файлы — `write_file` целиком из `new/`). Опасных для `String.replace` последовательностей (доллар + `&`, апостроф, обратная кавычка, цифра, `<`) в новом коде нет — проверено grep; `${…}` в discuss.js безопасен, но после записи всё равно проверить, что файл не размножился (`node --check`, конец файла); icons.svg — `str_replace` последнего `</svg>`; строка 24 habits-sw.js — `str_replace` начала строки;
`?v=` sidebar.js — ~75 `str_replace` пакетом (504 бывают — потом `search_code "sidebar.js?v=20261026f"` = 0). **Каждая запись
серверного .js сразу рестартует web-interface — согласовать квизом ДО правки** (CLAUDE.md, #338); затем `pm2_status` (аптайм),
при нужде `restart_service web-interface`, `restart_service` склеиваются в окно 7 мин.

### Ручная проверка
- 1440 и 390, обе темы (`/set` → «Тема»): шапка «Треды» + подзаголовок одной строкой; ⚙ и ☰ на телефоне; вкладки и счётчики;
  выбор строки — превью справа (ПК), шторка (≤1100), Esc и тап по фону закрывают; «Открыть» ведёт в /tasks?id=, /ticket?id=,
  /crm/chats?chat=, пост Threads — в новой вкладке.
- Поиск «/», кириллица в разном регистре («СЧЁТ» = «счёт»), пустой результат — «Ничего не найдено».
- Чат с непрочитанным: открыть превью — бейдж в меню «Чаты» **не** должен сброситься (превью только читает).
- Роль «Менеджер» без «Чатов» — вкладки «Чаты» нет, `/api/discuss/item?id=chat:N` → 403. Подрядчик — `/discuss` закрыт (403-страница).
- Threads отключён/недоступен — заметка в списке, остальные источники работают; первый заход — «Лента собирается в фоне».
- Меню: пункт «Треды» в РАБОТЕ (ПК-аккордеон #506 и шторка телефона), значок — два пузыря; /threads открывается как раньше.
- `/issues` после выкладки — нет новых «не загрузился ресурс …icons.svg?v=31#i-messages-square».

## Проверки, сделанные здесь
- `node --check`: `discuss.js`, `discuss_page.js`, стенд — OK. Выдержки целиком не проверяются (обрезаны); вставленные фрагменты
  server.js/roles.js/sidebar.js/threads.js/crm_chats.js проверены в обёртках — OK. Целиком — на сервере (шаг 3).
- `cd orig && patch -p1 --dry-run < ../all.diff` — 11 файлов `checking file …` без offset/fuzz; наложение на копию `orig/` = `new/` (`diff -r` пуст).
  **Dry-run на сервере повторить обязательно** — здесь он шёл по выдержкам.
- Стенд (`stand/server.mjs`: настоящий `web/discuss.js` + better-sqlite3 + заглушки соседних модулей, база с данными как на макете):
  list/item, курсор (2+2+…), поиск по кириллице без регистра, type=bad → 422, cursor=zzz → 422, id неверный/нет записи → 422,
  чат подрядчику → 403, чужая задача подрядчику → 422, подрядчик видит только задачи своего проекта; превью чата не меняет unread.
- Playwright (Chromium /opt/pw-browsers, МСК): `screens/desktop-{light,dark}.png`, `mobile-{light,dark}.png`, `mobile-sheet-dark.png`,
  `tablet-sheet-light.png`, `desktop-chat-dark.png`, `desktop-search-empty-light.png`; горизонтальной прокрутки нет (scrollWidth = ширине),
  ошибок консоли нет (кроме favicon стенда). Стенд подключает ВЫДЕРЖКИ ui.css + приближения btnCss/inpCss/.mdl-* — кнопки, поля и шторка
  в бою будут по /set; смотреть глазами после выкладки.

## Отличия от макета
- Нет нижней панели iOS и FAB «Новый тред»: плавающие кнопки — только док `dock.js` (#439), создавать тред нечего (ответ — в карточке).
- Нет капс-киккера «Работа» и hero 34/800 своей вёрстки: шапка — общая `.ph` (ADR-147 запрещает киккер; 34/800 — это и есть `.ph`).
- Заголовок/поиск/вкладки — над колонками (шапка `.ph` + `.lt-one`), а не внутри карточки списка; нет «крошек» и сегмента «Мои/Команда/Все»,
  чипа ⚡ и колокольчика в верхней полосе (это дал бы каркас `.sv2-top`; на портале их держат меню и шапка).
- Активная вкладка — `.ui-tab.is-on` (настраивается в /set), а не инверсный чип; бейдж непрочитанного — `.ui-badge` (красный по /set), не синий.
- Поиск — «/» вместо «Ctrl K» (⌘/Ctrl+K — поиск по меню, sidebar-patch); нет кнопок фильтра и «прочитать всё» (писать нечего).
- Превью: без звезды/«⋯», без композера «Ответить в тред…» — вместо него строка «Ответить можно в исходной карточке» и «Открыть …».
- Пост ленты: без лайков/ответов/репостов и мини-аватаров ответивших (нужны N запросов insights в Meta) — «Открыть в Threads».
- Плитки превью — данные сущности: задача «Ответов · Чек-лист · Время · Срок», тикет «Ответов · Единиц · Создан», чат «Сообщений · Непрочитано · Канал · Проект».
- Почты в списке нет (см. «Источники»). Аватары — инициалы с оттенком от имени (как `.sv2-fav`; палитры аватаров в токенах нет).
- Литералы радиусов 16/14/24 (`--th-*` макета) не заводились токенами: строки — 16px, карточки — `--ui-radius-lg`.

## Согласование с sidebar-patch (claude/sidebar-patch, сверен 03.10.2026)
sidebar-patch **устарел** и в нынешнем виде не ложится независимо от этого патча: на сервере `sidebar.js` с тех пор переписан
(новый сайдбар ПК #506 `sbx`, группы CMS/АНАЛИТИКА, `sidebar.js?v=20261026f` во всех подключениях), `ICONS_V` = 30 (в sidebar-patch 14→15),
icons.svg вырос с 179 до 224 строк. Его полная копия `new/web/public/sidebar.js` затёрла бы три недели правок.

Порядок: **сначала этот патч** (маленькие хунки по текущим файлам), **потом пересборка sidebar-patch** на свежем сервере:
- ICONS_V у него — следующее свободное (≥32), SHELL habits-sw и CACHE — следующие после наших (31 / habits-v148);
- в таблицу уникальных значков добавить «Треды» `/discuss` → `i-messages-square` (с его 31 символом не пересекается: проверено по `icons-src`);
- `sidebar.js?v=` — следующее значение после `20261027a`;
- его глобальный Ctrl/⌘+K совместим: «Треды» его не перехватывают, поиск страницы — «/».
Если всё же sidebar-patch пойдёт первым — конфликт только в двух хунках: строка `ICONS_V` (взять большее значение + оба комментария)
и вставка перед `</svg>` (оба блока символов подряд); хунк MENU у нас ложится после строки «Тикеты» независимо от смены значков.

## Риски
- Выдержки: файл изменился после 26.10 — хунк не ляжет (patch скажет). `icons.svg` — хвост файла (`\n` или нет) — см. шаг 1а.
- Время: считаем `comments.created_at`, `business_messages.created_at`, `last_message_at` UTC (`datetime('now')`); если где-то пишется
  локальное/ISO с поясом — сортировка между источниками собьётся на 3 часа (нормализуем через `datetime()`, пояс не угадываем).
- Readonly-соединение better-sqlite3 к WAL-базе требует существующих `-wal/-shm` (есть, пока работает основной процесс); не открылось —
  ручки отвечают 503 и `[discuss] tasks.db (readonly)` в логе, страница показывает ошибку с «Повторить».
- Лента: первый заход после рестарта — пусто («собирается в фоне»); `ensureUserId` из threads.js может обновить `project_access.login`
  (существующее поведение threads.js, не нового кода).
- Превью превью-строки `.dc-pv` липкое с `--dc-top: 112px` (высота `.ph` на ПК) — при другой высоте шапки (длинный подзаголовок, масштаб
  А−/А+) возможен зазор/наезд; на 1440 у задачи с длинной историей низ превью виден после прокрутки страницы.
- `chatList` считает число сообщений подзапросом на каждый чат страницы (≤61 строк) — дёшево на 136 чатах/11 тыс. сообщений, при росте — индекс есть (`idx_bmsg_chat_id`).
- `.dc-row` — своя строка вне кита M-xx (ADR-295 просит сначала паттерн в /refs#mobile) — предложить как M-81.

## Что не сделано
- Ответ в тред, «прочитать всё», «Новый тред», звезда/закрепление — запись вне задачи (нужны решение и, вероятно, таблица прочтений).
- Почта, лиды (`comments` entity_type='lead'), счётчик «Треды» в меню (`sbBadge`) — честного числа нет.
- Кабинетная версия, `page_badges`/PWA-манифест раздела, образец в /refs «Вёрстка».
- `SCOPE_API` для подрядчика (см. «Права»), переименование «Тредс».
