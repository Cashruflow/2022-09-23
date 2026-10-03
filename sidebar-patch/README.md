# Патч бокового меню портала (ПК) — 02.10.2026, сверен с сервером 03.10.2026

Черновик ADR — `docs/ADR-draft-*.md`, номер выдаст `create_adr`; в коде патча номер ADR не упоминается.

Подготовлено, **НЕ применено**. На сервере только читалось (`read_file`, `search_code`, `read_docs`, `list_docs`).
Ничего не коммитилось и не пушилось.

## Сверка с сервером 03.10.2026 (что изменилось после 02.10 и как перенесено)

Все 11 файлов перечитаны `read_file` в `/home/cashruflow`; полные копии сравнены построчно, выдержки — по
затронутым местам и окрестностям.

| Файл | Что на сервере | Что сделано |
|---|---|---|
| `sb-resize.js`, `sb-profile.js` | без изменений | — |
| `sidebar.js` | `shot.js?v=5→7`; `ui-dialogs.js?v=7→8` (строка с комментарием 03.10); подпись `/seo/app` «Сайт» → «SEO» | внесено в `orig/` и `new/` как есть (в `new/` пункт «SEO» остался со значком `i-app-window`) |
| `web/server.js` | +6 строк комментария выше (выдержка теперь стр. 213–220); `ICONS_V = 14` (13 — i-copy-plus, ADR-236; 14 — i-sim/i-esim, ADR-233) | наш бамп **14 → 15** (13 уже выдан другому — повтор запрещён правилом «только новое значение») |
| `assets/icons.svg` | добавлены комментарий + `i-sim`, `i-esim` (стр. 176–178), `</svg>` теперь стр. 179 | выдержка 173–179; 31 символ вставляется перед `</svg>`; совпадений id с новыми нет |
| `habits-sw.js` | SHELL `icons.svg?v=13`, `CACHE = 'habits-v112'` | SHELL → `?v=15`, CACHE → `habits-v113` (sed, см. ниже) |
| `ticket.html` | `ui-menu.js?v=10→11` (строка контекста 312) | выдержка обновлена; `ticket_page.js?v=15→16` без изменений |
| `issues.html`, `issues_page.js`, `ticket_page.js`, `mhead.js` | без изменений (строки на тех же номерах) | — |

Все поднимаемые значения (`sb-resize ?v=4`, `sb-profile ?v=5`, `mhead ?v=10`, `issues_page ?v=9`,
`ticket_page ?v=16`, `ICONS_V 15`, `habits-v113`) проверены `search_code` по `web/public` и `docs`: нигде
раньше не выдавались.

### Сверка с правилами CLAUDE.md (обновлён 02–03.10.2026)
- «ADR — только `create_adr`, номер руками не выбирать, на будущий в коде не ссылаться» — **нарушалось**:
  номер будущего ADR стоял в 14 комментариях (`sidebar.js`, `sb-resize.js`, `sb-profile.js`, `issues_page.js`,
  `ticket_page.js`, `server.js`, `icons.svg`). Убран, остались дата и смысл. Черновик ADR переименован в
  `docs/ADR-draft-…md`, номер — «выдаст create_adr». Шаг с `sed`-подстановкой номера удалён.
- «Бамп `?v=` только на новое, ранее не выданное значение» (страховка page-err.js, 02.10) — **нарушалось**:
  `ICONS_V = 13` и SHELL `?v=13` уже выданы 02.10 под i-copy-plus. Теперь 15. `page-err.js` патч не трогает.
- «Синхронную функцию не делай async ради ожидания данных» — нарушений нет: новые `sbFocusSearch`,
  `sbSetIcons`, фильтр и `showHotkeys` синхронные, права читают из уже готового `CF_PERM_DENY`,
  внешние модули (`sbSetIcons`) — с проверкой `typeof`.
- «Белый список в объекте — `Object.hasOwn`» (01.10) — `GROUP_OF[href]` и `grpHitByName[name]` в фильтре
  переведены на `Object.hasOwn` (раньше было прямое `MAP[key]`).
- `.replace` с пользовательской строкой вторым аргументом — нет (вторые аргументы — литералы или функции).
- Статика едет без рестарта, `server.js` — с рестартом; общий `*.js` на странице с SW — `?v=` поднят.

## Что сделано

| # | Задача | Где |
|---|---|---|
| 1 | Кнопка «свернуть/развернуть» на границе меню: `div#sb-collapse` (подложка на токенах) + голая `button.ibtn`, `i-chevrons-left/right`, `aria-label`/`title`/`aria-expanded`, `z-index:502` (выше `#sb-resizer` 501, ниже слоя драга 9999), клик = двойной щелчок (`setIcons(!icons); apply(true)`), прежняя ширина возвращается, скрыта ≤768px и на экране входа. Колонка иконок — по-прежнему 64px. Экспорт `window.sbSetIcons(bool)`, `window.sbIsIcons()`, событие `sb:icons`. | `sb-resize.js` v4 |
| 2 | ⌘K (Mac, только ⌘) / Ctrl+K (остальные) — на всех страницах портала: фокус + `select()` в поиск, из режима иконок меню разворачивается, на телефоне открывается шторка. Перехват на `window` в фазе capture, по `e.code` (работает в русской раскладке). Бейдж `⌘K` / `Ctrl K` в поле. | `sidebar.js` |
| 3 | Поиск — фильтр самого меню: регистр, ё→е, другая раскладка (qwerty↔йцукен в обе стороны), совпадение по подписи или группе (совпала группа — все пункты, включая закреплённые в «Быстром доступе»), прячутся `a.sb-link`/`.mp-row` классом `.sb-f-off` (без клонов), пустые группы и пустой «Быстрый доступ» — тоже, свёрнутые группы раскрываются и восстанавливаются, `<mark>` в `.sb-lbl` (исходник в `data-sbf-txt`), ↑/↓ с выделением, Enter — переход, Esc — очистка (второй — выход), «Ничего не найдено» в `.sb-nav`. Учитываются права ролей (`CF_PERM_DENY`). Мобильная шторка: фильтр работает в ней же, бейдж скрыт. | `sidebar.js`, `mhead.js` v10 |
| 4 | Уникальные значки у всех 76 пунктов MENU (было 22 повторяющихся значка). 38 замен, 31 новый символ Lucide. `ICONS_V` 14→15, `habits-sw.js` SHELL `?v=15`, CACHE `habits-v113`. | `sidebar.js`, `icons.svg`, `server.js`, `habits-sw.js` |
| 5 | Пункт «Быстрые клавиши» (`i-keyboard`) в меню профиля — окно `uiInfo()` (общая шторка `.mdl-*` из `ui-dialogs.js`) со всеми сочетаниями «сочетание — действие — где», ⌘/⌥/⇧ на Mac, Ctrl/Alt/Shift иначе; сочетания разделов, закрытых ролью, скрыты. | `sb-profile.js` v5 |
| 6 | `node --check` всех новых JS — OK; `cd orig && patch -p1 --dry-run < ../all.diff` — проходит (11 файлов). Дополнительно — прогон в jsdom (см. «Проверка»). | |
| 7 | Черновик ADR, дополнение к `docs/rules/ui.md`, запись CHANGELOG, таблица `?v=`. | `docs/` |

### Роли (п. 5)
`sb-profile.js` грузится только порталом (`sidebar.js`); строку профиля видят все, кто вошёл в портал:
владелец («Владелец платформы») и сотрудники с любой `access_role` (ADR-164/263, «Сотрудник»).
Пункт показан всем им, а сочетания закрытых роли разделов окно отфильтровывает по `window.CF_PERM_DENY`.
Тенанты (кабинеты клиентов) живут на `cab-sidebar.js` + `cab-foot.js` — `sb-profile.js` там пока не
подключён (ADR-217: «кабинет — отдельным шагом»). Для них оставлена ручка `window.cfShowHotkeys()`:
строка в `cab-foot.js` + подключение `sb-profile.js` — отдельная задача (сейчас справочник хоткеев —
портальный, в кабинете другой набор страниц).

## Структура папки

```
sidebar-patch/
  orig/web/...           копии с сервера (см. ниже, какие — выдержки)
  new/web/...            те же файлы с правками
  patches/<файл>.diff    дифф по файлу (пути от /home/cashruflow, a/ b/ → patch -p1)
  all.diff               все диффы одним файлом
  icons-src/*.svg        31 исходник Lucide (lucide-static 1.50.0, ISC)
  icons-add.svg.txt      31 <symbol> (+ строка-комментарий) для вставки в assets/icons.svg
  docs/                  черновик ADR (номер выдаст create_adr), дополнение ui.md, CHANGELOG, таблица ?v=
  tools/make_diffs.sh    пересобрать patches/ и all.diff из orig/ и new/
  tools/make_excerpts.py как собраны выдержки
  tools/check_menu_icons.js  проверка «у каждого пункта MENU свой значок и он есть в спрайте»
```

**Полные копии:** `sidebar.js` (1074 строки), `sb-resize.js` (299), `sb-profile.js` (289).

**Выдержки** (реальные строки на своих номерах, выше — пустые строки-заглушки; только чтобы
собрать и проверить дифф): `server.js` (>1 МБ, стр. 213–220), `habits-sw.js` (стр. 30–39; строка 24 —
16 КБ, её правим `sed`), `issues_page.js` (272–291), `ticket_page.js` (577–596), `mhead.js` (190–198),
`assets/icons.svg` (173–179, файл без перевода строки в конце), `issues.html` (281–288), `ticket.html` (311–317).
Контекст хунков — только реальные строки, номера совпадают с боевыми, поэтому `patch -p1` на сервере
ляжет без смещений. Если файл успел измениться — patch скажет `offset`/`FAILED`, тогда сверять руками.

## Таблица замен значков (пункт → было → стало)

| Группа | Пункт | Было | Стало |
|---|---|---|---|
| РАБОТА | БЗ (`/kb`) | `i-brain` | `i-kb` |
| РАБОТА | Бриф (`/brief`) | `i-message` | `i-clipboard-list` |
| AI-CRM | CRM — обзор (`/crm`) | `i-podium` | `i-layout-dashboard` |
| AI-CRM | Люди (`/contacts`) | `i-clients` | `i-contact` |
| AI-CRM | Компании (`/company`) | `i-projects` | `i-building` |
| AI-CRM | Каналы (`/channels`) | `i-webhooks` | `i-radio-tower` |
| AI-CRM | Сотрудники (`/staff`) | `i-clients` | `i-id-card` |
| AI-CRM | История правок (`/history`) | `i-tracking` | `i-history` |
| AI-CRM | Загрузчик данных (`/import`) | `i-upload` | `i-import` |
| SEO | SEO (`/seo/app`; до 03.10 — «Сайт») | `i-structure` | `i-app-window` |
| SEO | Краулер (`/crawl`) | `i-search` | `i-scan-search` |
| SEO | AI Google PageSpeed (`/pagespeed`) | `i-zap` | `i-gauge` |
| SEO | Индексация (`/index/app`) | `i-search` | `i-file-search` |
| SEO | Я.Директ (`/yadirect`) | `i-chart` | `i-megaphone` |
| SEO | Сжатие картинок (`/img`) | `i-image` | `i-image-down` |
| SEO | JSON-LD (`/jsonld`) | `i-structure` | `i-braces` |
| SEO | Карта сайта (`/index/app#sitemap`) | `i-sites` | `i-network` |
| SEO | Страницы (`/pages`) | `i-settings` | `i-file-cog` |
| SEO | Дневник эмоций (`/emotion-journal`) | `i-diary` | `i-smile` |
| СПРАВОЧНИКИ | Справочники (`/refs`) | `i-fields` | `i-library` |
| СПРАВОЧНИКИ | Поля Б24 (`/b24/fields`) | `i-fields` | `i-table-properties` |
| ФИНАНСЫ | Деньги (`/money/app`) | `i-cash` | `i-coins` |
| ФИНАНСЫ | Продления (`/renew`) | `i-services` | `i-calendar-sync` |
| ФИНАНСЫ | Генерации (ИИ) (`/doclog`) | `i-tracking` | `i-receipt` |
| МЕДКАРТА | Нормы анализов (`/med`) | `i-medcard` | `i-test-tubes` |
| МЕДКАРТА | Миссии (`/missions`) | `i-tracking` | `i-flag` |
| МЕДКАРТА | Пациенты (`/patients`) | `i-clients` | `i-stethoscope` |
| МЕДКАРТА | Контроль (`/control`) | `i-tracking` | `i-clipboard-check` |
| ИНТЕГРАЦИИ | Интеграции (`/integrations`) | `i-zap` | `i-plug` |
| ИНТЕГРАЦИИ | Тредс (`/threads`) | `i-message` | `i-at-sign` |
| ИНТЕГРАЦИИ | MCP-серверы (`/mcp`) | `i-bot` | `i-server` |
| ИНТЕГРАЦИИ | История входов (`/auth-log`) | `i-access` | `i-log-in` |
| ИНТЕГРАЦИИ | Бэкапы (`/backups`) | `i-structure` | `i-database-backup` |
| ИНТЕГРАЦИИ | Скрипты сайта (`/scripts`) | `i-zap` | `i-code-xml` |
| ИНТЕГРАЦИИ | Подвал лендингов (`/footer`) | `i-zap` | `i-panel-bottom` |
| ИНТЕГРАЦИИ | Политика данных (`/policy`) | `i-shield-check` | `i-scroll-text` |
| ИНТЕГРАЦИИ | Промты (`/prompt`) | `i-message` | `i-terminal` |
| ИНТЕГРАЦИИ | Тест (`/test`) | `i-structure` | `i-flask-conical` |

Без изменений остались 38 пунктов (каждый значок теперь у одного пункта): Уведомления `notify`,
Тайминг `calendar`, Бэклог `tasks`, Ошибки `bug`, Тикеты `ticket`, Проекты `projects`, Клиенты `clients`,
Доступы `access`, RAG `brain`, Лиды `leads`, SORIC `zap`, Документы `file-stack`, Чаты `message`, Почта `mail`,
Трекинг `phone-call`, Роли и права `shield-check`, CRM клиентов `circle-pile`, Услуги `services`, Сайты `sites`,
Ключевые слова `search`, Иконки страниц `image`, AI-навыки `skills`, Поля CRM `fields`, Финансы `cash`,
Roistat `chart`, Дневник `diary`, Ai-трекер привычек `check-check`, Путешествия `globe`, KPI `podium`,
Ai-агенты `bot`, Картотека `archive`, Медкарта `medcard`, Активность `heart`, Статистика `tracking`,
Вебхуки `webhooks`, Загрузки `upload`, Структура `structure`, Короткие ссылки `link`.
«Страницы» (`i-settings`) повтором внутри MENU не были, но совпадали со строкой «Настройки» в подвале — тоже заменены.
Новые символы (31): app-window, at-sign, braces, calendar-sync, clipboard-check, clipboard-list, code-xml,
contact, database-backup, file-cog, file-search, flask-conical, history, id-card, image-down, import, keyboard,
layout-dashboard, library, log-in, megaphone, network, plug, radio-tower, scan-search, scroll-text, smile,
stethoscope, table-properties, terminal, test-tubes. Уже были в спрайте и взяты: `kb`, `building`, `gauge`,
`coins`, `receipt`, `flag`, `server`, `panel-bottom` (`i-skills` — это «искры», поэтому для «Генераций (ИИ)»
взят `i-receipt`, а не sparkles).

Иконки скачаны с registry.npmjs.org (пакет `lucide-static`): cdn.jsdelivr.net и unpkg.com закрыты
egress-политикой этой сессии (403).

## Ctrl/⌘+K на /issues и /ticket

Локальные обработчики (`issues_page.js:282`, `ticket_page.js:589`) по Ctrl/⌘+K ставили фокус в поиск
списка (`#iss-q` / `#tk-q`) — ровно то же, что делает клавиша «/» строкой ниже. Уникального действия
нет, переносить нечего — строки удалены, «/» остался. Теперь Ctrl/⌘+K там, как везде, — поиск по меню.
Даже если браузер держит старый `issues_page.js` в кэше, конфликта нет: общий обработчик стоит на
`window` в фазе перехвата и гасит событие (`stopPropagation`) до обработчиков страницы.

## Хоткеи платформы (найдены поиском keydown/ctrlKey/metaKey/altKey; Mod = ⌘ на Mac, Ctrl иначе)

| Сочетание | Действие | Где |
|---|---|---|
| Mod+K | Поиск по меню (разворачивает из иконок) | все страницы портала (новое) |
| ↑ / ↓, Enter, Esc | выбор найденного, переход, очистка | поле поиска меню (новое) |
| Esc | закрыть шторку меню / меню профиля / окно / карточку | все страницы (`sidebar.js`, `sb-profile.js`, `ui-dialogs.js`, модалки страниц) |
| Esc | прервать перетаскивание границы меню | `sb-resize.js` |
| Mod+Enter; Enter в названии | отправить скриншот | окно «Скрин» (`shot.js`) |
| Alt+↑ / Alt+↓ | переставить строку за ручку | `drag-sort.js` (/refs) |
| / | фокус в поиск списка | /issues, /ticket, /timing/app |
| C (С) | новая ошибка / новый тикет | /issues, /ticket |
| Mod+Enter | сохранить карточку (в комментарии тикета — отправить) | /issues, /ticket |
| ← / → | период назад/вперёд | /timing/app |
| Enter (Shift+Enter — перенос) | отправить сообщение (ПК) | /crm/chats |
| Mod+B, Mod+I, Mod+Shift+X, Mod+Shift+P | жирный, курсив, зачёркнутый, спойлер | /crm/chats, поле сообщения |
| Enter / Tab | выбрать участника в списке «@» | /crm/chats, группа |
| Enter | применить выбранную стадию | карточка лида v2 (/crm/leads) |
| Mod+Enter | отправить письмо | /mail, новое письмо |
| Mod+S | сохранить robots.txt / llms.txt | /index/app, редактор |
| Mod+Enter | сохранить пару | /rag/app |
| Mod+Enter | отправить | /brief, окно отправки |
| Mod+Enter | отправить запись | /diary (композер и шторка) |
| Mod+Enter (Esc — отмена) | сохранить описание | /med |
| Enter (Shift+Enter — перенос) | отправить | /agents, чат и «спросить» |
| Enter / Mod+Enter | сохранить название / подзаголовок | окно «Название раздела» (`page-titles.js`) |
| ← / → (Esc) | листать подсказки | /habits/app «Как пользоваться» |

Не включены в окно как «хоткеи»: Enter в однострочных полях форм (логин, добавить телефон, тег и т.п.),
Enter/Пробел на строках с `role=button` (доступность), Esc у каждой отдельной модалки — это общее
поведение, в окне оно одной строкой.

## Порядок применения на сервере

**Шаг 0 — ADR (ДО наложения патча).** Сначала `create_adr` (MCP) с текстом `docs/ADR-draft-*.md`
(без строки `id:` и номера в заголовке) и `status: Proposed` — номер выдаст сам инструмент. В код номер
**не вписывается**: в комментариях патча только дата (02.10.2026) и смысл правки, править `all.diff`
после выдачи номера не нужно. Номер нужен только для записи в CHANGELOG/ui.md (дописать руками в
`docs/CHANGELOG-entry.md` и `docs/ui.md-addition.md` при переносе в docs).

Вариант А — через SSH (из корня проекта):

```bash
cd /home/cashruflow
# 0) бэкап затрагиваемых файлов
tar czf /tmp/sidebar-backup-$(date +%Y%m%d-%H%M).tgz \
  web/public/sidebar.js web/public/sb-resize.js web/public/sb-profile.js web/public/issues_page.js \
  web/public/ticket_page.js web/public/mhead.js web/server.js web/public/habits-sw.js \
  web/public/assets/icons.svg web/public/issues.html web/public/ticket.html
# 1) проверка и наложение (all.diff уже содержит вставку 31 символа в icons.svg и ICONS_V=15)
patch -p1 --dry-run < /path/to/sidebar-patch/all.diff && patch -p1 < /path/to/sidebar-patch/all.diff
# 1а) если icons.svg не лёг — вставить символы руками перед последней строкой </svg>:
#     python3 - <<'PY'
#     p='web/public/assets/icons.svg'; s=open(p).read(); add=open('/path/to/sidebar-patch/icons-add.svg.txt').read()
#     i=s.rindex('</svg>'); open(p,'w').write(s[:i]+add+s[i:])
#     PY
# 2) кэш SW трекера (строка 24 не в диффе — 16 КБ комментария):
sed -i "24s/^const CACHE = 'habits-v112'; \/\/ /const CACHE = 'habits-v113'; \/\/ v113 (02.10.2026, сайдбар) — спрайт ?v=15 в SHELL (уникальные значки меню, i-keyboard). /" web/public/habits-sw.js
grep -n "habits-v113\|icons.svg?v=15" web/public/habits-sw.js
# 3) синтаксис
for f in sidebar sb-resize sb-profile issues_page ticket_page mhead habits-sw; do node --check web/public/$f.js || echo "FAIL $f"; done
node --check web/server.js
grep -c '<symbol id="i-keyboard"' web/public/assets/icons.svg   # 1
node /path/to/sidebar-patch/tools/check_menu_icons.js web/public/sidebar.js web/public/assets/icons.svg
# 4) ADR уже создан на шаге 0 (create_adr) — пересобрать индексы и проверить:
node scripts/migrate-ard.js
node scripts/validate-ard.js      # падает на дублях номеров и ссылках на чужой ADR-файл
# 5) docs: дописать docs/rules/ui.md (docs/ui.md-addition.md), CHANGELOG (docs/CHANGELOG-entry.md — в начало файла)
# 6) рестарт — нужен только из-за ICONS_V в server.js; статика едет без рестарта
sudo pm2 restart web-interface
sudo pm2 logs web-interface --lines 30 --nostream   # ищем «[deploy] start» без стектрейса
curl -s https://ai.cashruflow.ru/issues | grep -o 'icons.svg?v=[0-9]*' | head -1   # ?v=15
```

Вариант Б — через MCP (как принято в проекте: «прод правится только write_file/str_replace»):
по каждому `patches/<файл>.diff` — `str_replace` старого фрагмента на новый (для `sidebar.js`,
`sb-resize.js`, `sb-profile.js` проще `write_file` целиком из `new/web/public/…` — они полные копии;
перед этим `read_file` и сверка с `orig/`, что файл не менялся). icons.svg — `str_replace`
последней строки `</svg>` на содержимое `icons-add.svg.txt` + `</svg>` (после правки перечитать — это не-JS
файл; в `new_str` для JS-файлов с `$`+цифрой/апострофом — только `write_file`, правило CLAUDE.md). `create_adr` —
ДО правок (шаг 0), после — migrate-ard/validate-ard, `restart_service web-interface`.

### Ручная проверка в браузере (жёсткий рефреш — sidebar.js без ?v=)
- 1440px, тёмная и светлая тема: кнопка-кружок на границе у логотипа; клик — колонка 64px, повторный —
  прежняя ширина (проверить с шириной, отличной от 230, предварительно утянув границу); тултип/aria.
- Перетаскивание границы выше и ниже кнопки; двойной щелчок по границе; Esc во время драга.
- Ctrl+K (Windows/Linux) и ⌘K (Mac) на /tasks, /issues, /ticket, /crm/chats (в т.ч. с фокусом в поле
  сообщения), в режиме иконок — меню разворачивается и фокус в поле. На Mac Ctrl+K в поле ввода
  должен остаться системным.
- Поиск: «лиды», «kbls», «ыщкшс» (SORIC), «ёж»/«еж», «финансы» (вся группа), закреплённые пункты в
  «Быстром доступе», «zzz» → «Ничего не найдено», свернуть группу → искать → очистить (группа снова
  свёрнута), ↑/↓/Enter/Esc, бейджи «Уведомления»/«Чаты» на месте при фильтре.
- 390px: шторка ☰ — поиск фильтрует список, бейджа ⌘K нет, кнопки-кружка нет, Esc в поле очищает.
- Сотрудник с урезанной ролью: закрытые пункты не всплывают в поиске; «Быстрые клавиши» без их строк.
- Профиль ⋮ → «Быстрые клавиши»: шторка с таблицей, обе темы, 390px (колонка «Где» уходит под действие).
- Значки: колонка иконок — все разные, тултипы верные; /habits/app офлайн-оболочка подтянула ?v=15.

## Проверка, которая сделана здесь (03.10.2026, после сверки)
- `cd orig && patch -p1 --dry-run < ../all.diff` — все 11 файлов `checking file …` без ошибок, без offset/fuzz;
  наложение на копию `orig/` даёт ровно `new/` (`diff -r` пуст).
- `node --check` всех JS в `new/`: `sidebar.js`, `sb-resize.js`, `sb-profile.js`, `issues_page.js`,
  `ticket_page.js`, `mhead.js`, `server.js` — OK; выдержка `habits-sw.js` обрывается внутри `SHELL = [`
  (так и задумано) — с дописанным `];` проходит, целиком проверяется на сервере (шаг 3).
- `grep -rn "ADR-309" new/ patches/ all.diff` — пусто.
- `tools/check_menu_icons.js`: 76 пунктов — 76 разных значков, повторов нет (на выдержке спрайта
  «нет в спрайте» пишет только для старых символов, которых в выдержке нет — на сервере они есть).
- jsdom-прогон (02.10): фильтр, раскладка, ё, группы, восстановление свёрнутой группы, ↑/↓, Ctrl+K из
  иконок, кнопка, окно хоткеев — без ошибок; правки 03.10 (Object.hasOwn, комментарии) логику не меняют.

## Риски
- Строки-выдержки: если боевой файл изменился после сверки 03.10.2026 — хунк может не лечь (patch скажет).
- `.ibtn` в `/theme.css` (btnCss) может задавать свой фон/рамку, если их включили в /set#btns —
  тогда внутри кружка будет ещё рамка кнопки. Проверить глазами; при необходимости кружок убрать.
- Поле поиска получило `padding-right:56px` под бейдж — отступ полю ввода пишется локально (правило
  «полям не писать отступы» — исключение уже было: поле сайдбара и раньше стилизовалось здесь).
- Ctrl+K теперь перехватывается и в полях ввода страниц (по задаче «одинаково на всех страницах»);
  если где-то нужен будет свой Ctrl+K — конфликт, правило в ui.md это запрещает.
- В режиме иконок Ctrl+K разворачивает меню ЗАПОМНЕННО (как кнопка), а не временно.
- Поиск больше не ищет по адресу (`/crm/leads`) — только по подписи и группе, как в задаче.
- Короткий запрос даёт широкий результат из-за варианта в другой раскладке и совпадений по группе
  («с» → вся AI-CRM, т.к. «c» латиницей есть в «AI-CRM»).
- `page-header.js` не трогали (мёртвый селектор `.sb-search-results` в SKIP безвреден).
- Справочник `HOTKEYS` ручной — разойдётся, если не дописывать (правило в ui.md).
- Новые `<symbol>` — из lucide-static 1.50.0; у некоторых старых символов спрайта геометрия более
  ранних версий Lucide — визуально толщина та же (stroke-width из спрайта).
