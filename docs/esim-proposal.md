# «Связь» (SIM / eSIM) в «Путешествиях» (/trip/app) — проект, редакция 3

Статус: ПРЕДЛОЖЕНИЕ. На сервере ничего не менялось (только `read_file` / `search_code`).
Редакция 3 от 28.09.2026 — второй круг ответов Константина (Часть II, §11–§17). Редакция 2 — первый круг. Автор: Claude.

---

## Решения пользователя (28.09.2026)

| # | Вопрос | Решение | Где в проекте |
|---|---|---|---|
| 1 | Как учитывать деньги | **Отдельной строкой в `trip_expenses`**: у строки `source='sim'` + `source_id`, у SIM — `expense_id`. Категория «Связь» в `CATS`. Дублей нет, сумма синхронизируется при правке SIM, при удалении SIM строка расхода удаляется | §6 |
| 2 | Только eSIM? | **И физическая SIM тоже**: переключатель «SIM / eSIM», поле `kind: 'sim' \| 'esim'`. У физической нет LPA / SM-DP+ / QR, зато есть номер телефона (необязательный). Таблица `trip_sims`, вкладка **«Связь»**, бейдж в поездке показывает тип | §2, §5 |
| 3 | Оплата Trip Coins | **Считается тратой**: 339,80 ₽ идёт в расход, способ оплаты хранится атрибутом `paid_with` | §6.3 |
| 4 | Чем шифровать код активации | **Отдельным ключом `TRIP_SIM_KEY`** из окружения. Без ключа сервер НЕ падает: запись сохраняется без кода, пользователь видит причину. Ключ в код не генерировать | §4.2 |
| 5 | Напоминания в Telegram | **Да**: за сутки до окончания, в момент окончания и так же для «активировать до». Флаги отправки против повторов. Встраивание по образцу `pauseTick` из `habits.js` | §7 |
| — | Декодер QR (ответа не было) | Предложение: `BarcodeDetector` в браузере, **без новой зависимости**. Где его нет (iOS Safari) — просим вставить строку LPA текстом | §5.4 |

### Второй круг (28.09.2026)

| # | Вопрос | Решение | Где |
|---|---|---|---|
| 2.1 | SIM/регистрация, не попавшие в поездку | **Показывать блок «Вне поездок»** с причиной: `before_window` — куплена раньше окна, `no_trip` — поездка не заведена или отменена, `region` — региональная eSIM, `manual_none`, `lost_trip`. Кнопка «Привязать к поездке»: ручная привязка (`trip_leg` + `trip_manual`) перекрывает автоподбор | §11 |
| 2.2 | Оператор | **Справочник `trip_operators`**: страна, название, сеть, APN по умолчанию, сайт. Сделан по образцу справочников раздела (`trip_vendors`), потому что `/refs` закрыт админским паролем. В форме — выбор по стране, «+ Новый оператор…» прямо из формы, выбор подставляет APN. Отметка «нужна ли регистрация телефона» — ручная, в `trip_sim_countries` | §12 |
| 2.3 | Чек-лист | Автоотметка «SIM или eSIM» (`auto_key='sim'`, `items.auto`). Три новых стандартных пункта: в `CHECKLIST_SEED` и разовой миграцией в работающий шаблон. В старые чек-листы — кнопкой «Добавить новые пункты» | §13 |
| 2.4 | Напоминания для SIM без срока | **Не нужны** — только при заполненном сроке | §16 |
| 2.5 | ICCID и номер | **Маской** `8948 **** **** 1430`, значок «глаз» показывает целиком | §14 |
| 2.6 | Устройства | **«Мои устройства» (`trip_devices`)**: IMEI/EID шифром `TRIP_SIM_KEY`, распознавание `*#06#` тем же конвейером, проверка по Луну. SIM → `device_id`. Регистрация IMEI в стране (`trip_imei_regs`) с расходом «Связь» и напоминанием. Кнопка «Телефон украли» | §15 |

Что изменилось относительно редакции 1:
- таблица `trip_esims` → `trip_sims` с полем `kind`; ручки `/esims` → `/sims`, `/esim-scan` → `/sim-scan`;
  вкладка «eSIM» → «Связь»;
- расход больше не производный пункт в `compute()` — это строка `trip_expenses`, привязанная к SIM (§6);
- шифр — собственный ключ модуля `TRIP_SIM_KEY` вместо ключа сейфа доступов (`encSecret` из `server.js` больше не нужен);
- добавлены напоминания в Telegram (§7) и распознавание QR в браузере (§5.4);
- закрыты открытые вопросы 1–6 и 10 редакции 1.

---

## 0. Коротко

- Раздел «Путешествия»: сервер `web/trip.js` (схема, распознавание, CRUD) и `web/trip_journeys.js` (сборка поездок и
  расходы); страница `web/public/trip.html` и `web/public/trip-journeys.js`. Таблицы `trip_*` лежат в `med.sqlite`
  (`medDb`), API — `/api/profile/:profileId/trip/*` (`me` — своя сессия).
- Сущности «поездка» в базе нет: её собирает `buildJourneys()`. SIM живёт в своей таблице `trip_sims` и своей вкладке
  «Связь». В карточку поездки она попадает бейджем, а её стоимость — через строку расхода.
- Распознавание — `POST …/trip/sim-scan`: один файл, до 5 файлов (JSON) или вставленный текст. Конвейер тот же, что у
  брони отеля и рейса. Записи ручка не создаёт.
- Деньги: при сохранении SIM с ценой сервер делает upsert строки `trip_expenses` (`category='comm'`, `source='sim'`,
  `source_id=<id SIM>`) и пишет `trip_sims.expense_id`. Такая строка правится только из «Связи», в шторке расходов она
  только для чтения. Удаление SIM удаляет и строку.
- Напоминания: тик раз в 30 минут в `trip.js`, те же `tgSend` + `patient_telegram_links` + бот `@Ai_dcf_bot`, что у
  пауз привычек. Четыре флага `*_sent_at`, метка ставится до отправки.
- ADR: **ADR-233** (последний занятый — ADR-232; сверить перед созданием).

---

## 1. Найденная архитектура (пути и строки)

| Что | Где | Заметки |
|---|---|---|
| Сервер раздела | `/home/cashruflow/web/trip.js`, `export function mountTrip(app, medDb, deps)` — стр. 1712 | |
| Схема | `trip.js:919` `export function ensureTripTables(medDb)` | идемпотентно на старте; колонки добавляются через `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` |
| Монтирование | `/home/cashruflow/web/server.js:15200` | deps: `profileAuth, pcheck, getPatientAccount, referral, tasksDb, logUpload, logAiCall, apiKey, aiBase, whisperKey, openaiBase` |
| Окружение | `server.js:2-3` `dotenv.config({ path: '/home/cashruflow/mcp-server/.env' })` | `TRIP_SIM_KEY` положить туда же |
| Обход глобального `express.json` | `server.js:249` `RAW_BODY_RE` (только `/trip/scan`) | без этого несколько скринов режутся 413 (ADR-204) |
| Профиль | `trip.js:1772` `pid(req,res)` | |
| Скан брони отеля | `trip.js:4268` `POST …/trip/scan` | только файлы, текста нет |
| Скан рейса + текст | `trip.js:4409` `POST …/trip/boarding`, `DOC_KINDS.text`, `PASTE_MAX=20000` | единственный текстовый вход сейчас |
| Общий приём файла | `trip.js:4601` `takeScan()` | |
| Модель и журналы | `ask` 4174, `parseJson` 4192, `cost` 4198, `logGeneration` 4202, `purgeScansLazy` 4166 | Sonnet 4.6 через `AI_BASE` |
| Помощники | `numAmount` 530, `normDate` 683, `today()` МСК 696, `addDays` 676, `localToUtc` 645, `COUNTRY_TZ` 873, `vendorResolve` 157, `saveVia` 2181, `VIA_TABLES` 146 | |
| Образец CRUD | страховки: `trip_insurance` 1348, `policyBody` 3925, ручки 3971–4036 | |
| Расходы | `/home/cashruflow/web/trip_journeys.js`: `CATS` 35, `BANK_CAT` 42, `ensureJourneyTables` 57 (`trip_expenses`), `compute()` 169, `expenseBody` 286, `POST/PATCH/DELETE …/expenses` 299–328 | колонок `source`/`source_id` нет |
| Страница | `/home/cashruflow/web/public/trip.html`: вкладки 383–399, `go()` 747, `paintIns` 1695, `bindDocScan` 1932, `bindScan` 3083, `shrink` 1329, `send` 529, `priceField/priceBody/priceFill` 703–745 | |
| Карточки поездок | `/home/cashruflow/web/public/trip-journeys.js`: `CAT_COLOR` 7, `rowHtml` 62 (кнопки «править/удалить» у `kind==='manual'`), `cardHtml` 84 | |
| QR-кодер | `/assets/qrcode-gen.js`, загрузчик `loadQrLib()` в `trip-pass.js:233`, наружу не отдан (`window.tripPass` стр. 529) | |
| Telegram | `/home/cashruflow/lib/tg.mjs` `tgSend(token, chatId, text, opts)` → `null` или строка причины | правило CLAUDE.md: только `tgSend` |
| Образец напоминаний | `web/habits.js:1754-1796` `pauseTick`: тик 30 мин, тихие часы, метка `pinged_at` до отправки, адресат из `patient_telegram_links` (join `patient_accounts.profile_id`), бот `TELEGRAM_BOT_TOKEN_AI_DCF`, для профиля 1 запасной `TELEGRAM_BOT_TOKEN_CASHRUFLOW` + `TG_CHAT_ID` | та же копия `aiDcfToken()` есть в `pair.js:360` |
| Привязка Telegram | `web/patient_telegram.js` — таблица `patient_telegram_links` | |
| Карточки ключей | `web/integrations.js:53` `keyCard(id, group, name, envKey, note)` | можно показать статус `TRIP_SIM_KEY` |
| Спрайт | `/assets/icons.svg`, адрес `window.ICONS_URL` (`ICONS_V` в server.js, сейчас `?v=8`) | значка SIM нет |
| Чек-лист | `trip.js:907` `CHECKLIST_SEED` — пункт «SIM или eSIM» | |

Чего в коде нет (здесь не выдумано, а предлагается): таблиц поездок и `trip_id`; справочника категорий трат (есть
константа `CATS`); колонок `trip_expenses.source/source_id`; текстового ввода у отеля; декодера QR; экспорта
`loadQrLib`; общего модуля «напоминания пациенту» (есть две локальные копии в `habits.js` и `pair.js`).

---

## 2. Модель данных — `trip_sims`

### 2.1 Поля

`kind` — `'esim'` (по умолчанию) или `'sim'`. Обязательно одно из: `country`, `region`, `product`, `booking_no`,
`iccid`, `phone`.

| Колонка | Тип | Пример | SIM | eSIM | Примечание |
|---|---|---|:-:|:-:|---|
| `kind` | TEXT NOT NULL | esim | ✓ | ✓ | переключатель «SIM / eSIM» |
| `country` / `region` | TEXT | Египет / — | ✓ | ✓ | |
| `product` / `plan` | TEXT | Egypt 5G eSIM \| Dual SIM / QR code-3 days-Daily-2GB | ✓ | ✓ | как в документе |
| `network` | TEXT | 5G | ✓ | ✓ | |
| `plan_kind` | TEXT | daily | ✓ | ✓ | `daily` / `total` / `unlimited` |
| `data_mb` | INTEGER | 2048 | ✓ | ✓ | 1 ГБ = 1024 МБ |
| `throttle_kbps` | INTEGER | 512 | ✓ | ✓ | скорость после лимита |
| `days` | INTEGER | 3 | ✓ | ✓ | |
| `day_mode` | TEXT | rolling24 | ✓ | ✓ | `rolling24` / `calendar` |
| `sms` / `calls` / `dual_sim` | INTEGER 0/1 | 0/0/1 | ✓ | ✓ | |
| `phone` | TEXT | +20 10 1234 5678 | ✓ | ✓ (редко) | номер линии, необязательный; хранится как `+` и цифры |
| `operator` / `operator_src` | TEXT | Vodafone / manual | ✓ | ✓ | `doc` или `manual` |
| `apn` | TEXT | internet.vodafone.net | ✓ | ✓ | |
| `roaming` | INTEGER 0/1 | 1 | 0 по умолч. | 1 по умолч. | «включить роуминг данных» |
| `smdp` | TEXT | smdp.io | — | ✓ | для `kind='sim'` сервер обнуляет |
| `code_enc` | TEXT | `v1:iv:tag:ct` | — | ✓ | шифр matching ID ключом `TRIP_SIM_KEY` |
| `code_tail` | TEXT | DVXL | — | ✓ | для маски «···DVXL» |
| `lpa_oid` / `confirm_required` | TEXT / INTEGER | — / 0 | — | ✓ | 4-я и 5-я части LPA |
| `iccid` | TEXT | 8948010010094791430 | ✓ | ✓ | 19–20 цифр, начинается с 89, Luhn — предупреждение |
| `balance_url` | TEXT | https://globalesimstore.com/E | ✓ | ✓ | только http(s) |
| `booking_no` / `order_status` | TEXT | 1539367401113525 / Confirmed | ✓ | ✓ | номер — ключ склейки |
| `purchased_on` | TEXT день | 2026-09-28 | ✓ | ✓ | дата расхода |
| `activate_by` | TEXT день | 2026-11-26 | ✓ | ✓ | «действительно до» |
| `extend_until` | TEXT момент | 2026-11-27 19:25:38 | ✓ | ✓ | «продление до» |
| `uses` | INTEGER | 1 | — | ✓ | |
| `installed_on` | TEXT день | | ✓ (вставлена) | ✓ (установлена) | |
| `activated_at` | TEXT момент | | ✓ | ✓ | местное время в `tz` |
| `tz` | TEXT IANA | Africa/Cairo | ✓ | ✓ | из `COUNTRY_TZ` или руками |
| `price` / `price_currency` | REAL / TEXT | 339.80 / RUB | ✓ | ✓ | итого; уходит в расход |
| `price_local` / `price_local_currency` | REAL / TEXT | | ✓ | ✓ | вторая валюта |
| `price_base` / `discount` | REAL | 357.69 / 17.89 | ✓ | ✓ | |
| `paid_with` | TEXT | Trip Coins | ✓ | ✓ | атрибут, на расход не влияет (решение 3) |
| `booked_via` | TEXT | Trip.com | ✓ | ✓ | справочник `trip_vendors` |
| `note` | TEXT | Отмена невозможна после использования | ✓ | ✓ | |
| `expense_id` | INTEGER | 57 | ✓ | ✓ | ссылка на `trip_expenses.id` (§6) |
| `notify_pre_sent_at` | TEXT момент | | ✓ | ✓ | «истекает через сутки» — отправлено (§7) |
| `notify_end_sent_at` | TEXT момент | | ✓ | ✓ | «истекла» — отправлено |
| `notify_actby_pre_sent_at` | TEXT момент | | ✓ | ✓ | «завтра последний день активации» — отправлено |
| `notify_actby_sent_at` | TEXT момент | | ✓ | ✓ | «сегодня последний день активации» — отправлено |
| `notify_error` | TEXT | | ✓ | ✓ | причина последнего отказа `tgSend` |
| `created_at` / `updated_at` | TEXT | | | | |

Не храним и не распознаём: PIN и пароль заказа, имя, телефон и почту **контакта заказа**, номер карты, PIN/PUK
физической SIM. `phone` — это номер самой купленной линии, а не контакт покупателя; в промте они разведены.

### 2.2 Статусы (не хранятся, считает сервер)

| status | SIM (физическая) | eSIM | Условие |
|---|---|---|---|
| `bought` | куплена | куплена | остальное |
| `installed` | вставлена | установлена | `installed_on` есть, `activated_at` нет |
| `active` | активна | активна | `activated_at` есть и сейчас < `expires_at` (или срока нет) |
| `expired` | истекла | истекла | сейчас ≥ `expires_at`; либо не активирована и сегодня > `activate_by` |

Окончание: `rolling24` — `activated_at + days × 24 ч` в поясе `tz`; `calendar` — `(день активации + days − 1) 23:59:59`.
У физической SIM без `days` (обычный контракт) срока нет, статус остаётся `active`.

### 2.3 Миграция `trip_sims` (в `ensureTripTables`, web/trip.js)

```js
  // «Связь» (28.09.2026, ADR-233): купленные SIM и eSIM. kind — 'esim' | 'sim'. У физической SIM
  // нет кода активации: smdp/code_* сервер для неё обнуляет. Код активации eSIM — секрет
  // (кто его знает, ставит себе чужую карту): хранится шифром code_enc ключом TRIP_SIM_KEY, в
  // списке — только хвост. PIN заказа и контакты покупателя не распознаются и не хранятся.
  // Статус не хранится — его считает GET по датам. Деньги — строкой trip_expenses (expense_id).
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_sims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'esim',
    country TEXT, region TEXT, product TEXT, plan TEXT, network TEXT,
    plan_kind TEXT NOT NULL DEFAULT 'daily',
    data_mb INTEGER, throttle_kbps INTEGER, days INTEGER,
    day_mode TEXT NOT NULL DEFAULT 'rolling24',
    sms INTEGER NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0, dual_sim INTEGER NOT NULL DEFAULT 0,
    phone TEXT, operator TEXT, operator_src TEXT, apn TEXT,
    roaming INTEGER NOT NULL DEFAULT 1,
    smdp TEXT, code_enc TEXT, code_tail TEXT, lpa_oid TEXT, confirm_required INTEGER NOT NULL DEFAULT 0,
    iccid TEXT, balance_url TEXT, booking_no TEXT, order_status TEXT,
    purchased_on TEXT, activate_by TEXT, extend_until TEXT, uses INTEGER,
    installed_on TEXT, activated_at TEXT, tz TEXT,
    price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT,
    price_base REAL, discount REAL, paid_with TEXT, booked_via TEXT, note TEXT,
    expense_id INTEGER,
    notify_pre_sent_at TEXT, notify_end_sent_at TEXT, notify_actby_pre_sent_at TEXT, notify_actby_sent_at TEXT,
    notify_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE INDEX IF NOT EXISTS idx_trip_sims_profile ON trip_sims(profile_id, activated_at)`);
  // Повторный импорт той же брони второй записи не заводит: ключ — номер заказа, запасной — ICCID.
  // Индексы частичные: пустые значения (SIM, внесённая руками без номера) под уникальность не попадают.
  try {
    medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_sims_booking ON trip_sims(profile_id, booking_no)
      WHERE booking_no IS NOT NULL AND booking_no <> ''`);
    medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_sims_iccid ON trip_sims(profile_id, iccid)
      WHERE iccid IS NOT NULL AND iccid <> ''`);
  } catch (e) { console.error('trip_sims unique:', e.message); }
```

```diff
-const VIA_TABLES = ['trip_stays', 'trip_flights', 'trip_rides', 'trip_insurance', 'trip_permits'];
+const VIA_TABLES = ['trip_stays', 'trip_flights', 'trip_rides', 'trip_insurance', 'trip_permits', 'trip_sims'];
```

Новые колонки в будущем добавлять только через `PRAGMA table_info` + `ALTER TABLE` (правило CLAUDE.md, ADR-143).
Деньги хранятся парой `price` + `price_currency`, как во всех `trip_*`, а не `*_rub` из общего правила: модуль
мультивалютный (ADR-201/222).

---

## 3. Извлечение

### 3.1 Промт `SIM_PROMPT` (trip.js, рядом с `PERMIT_PROMPT` ~456)

```js
// SIM и eSIM (28.09.2026, ADR-233). Код активации eSIM модель вернуть ОБЯЗАНА — без него карту
// не поставить. PIN заказа и контакты покупателя — запрещены, как PIN у виз.
const SIM_PROMPT = `Ты извлекаешь данные о купленной сим-карте для поездки — физической SIM или eSIM — из
подтверждения заказа (скриншоты, PDF, текст письма) или фото упаковки/карточки SIM. Экранов может быть
несколько — это ОДИН заказ, собери одну запись.
Верни ТОЛЬКО JSON, без markdown:
{"kind":"","country":"","region":"","product":"","plan":"","network":"","plan_kind":"","data_per_day":"","data_total":"","throttle":"","days":"","day_mode":"","sms":null,"calls":null,"dual_sim":null,"phone":"","operator":"","apn":"","lpa":"","smdp":"","activation_code":"","iccid":"","balance_url":"","booking_no":"","order_status":"","purchased_on":"","activate_by":"","extend_until":"","uses":"","price":"","price_currency":"","price_base":"","discount":"","price_local":"","price_local_currency":"","paid_with":"","booked_via":"","note":""}
Правила:
- kind — "esim", если это eSIM (есть LPA, QR-код для установки, SM-DP+, слово eSIM); "sim" — если это
  пластиковая SIM-карта (упаковка, карточка с ICCID, «SIM card», «сим-карта» без eSIM). Не ясно — "esim".
- country — страна действия на русском. region — если план на несколько стран: «Европа, 33 страны».
- product — название продукта как написано; plan — название тарифа как написано; network — 4G/5G.
- plan_kind: "daily" — объём на сутки (Daily, в день); "total" — на весь срок; "unlimited" — безлимит.
  data_per_day / data_total — объём как написан ("2GB").
- throttle — скорость после исчерпания лимита как написана ("512kbps").
- days — срок пакета в днях числом. day_mode — "rolling24", если сутки = 24 часа от активации или
  «обновление каждые 24 часа»; "calendar" — календарные сутки; не сказано — пустая строка.
- sms, calls — true/false, если прямо сказано; не сказано — null. dual_sim — true, если Dual SIM.
- phone — номер телефона САМОЙ купленной SIM, если он напечатан на карточке/в заказе как номер линии.
  Телефон покупателя из контактов заказа сюда НЕ класть.
- operator — оператор сети в стране, только если назван. apn — APN, если напечатан.
- lpa — строка активации eSIM ЦЕЛИКОМ, начинается с «LPA:1$». smdp — адрес SM-DP+. activation_code —
  Activation code / Matching ID. Если код только QR-картинкой без текста — все три пустые, не угадывай.
  Для физической SIM — всегда пустые.
- iccid — ICCID, 19–20 цифр, только цифры.
- balance_url — ссылка проверки баланса как напечатана.
- booking_no — номер заказа. order_status — статус заказа как написан (Confirmed).
- purchased_on — дата заказа; activate_by — «действительно до», крайний срок активации; формат ГГГГ-ММ-ДД.
  extend_until — «продление до» с временем: ГГГГ-ММ-ДД ЧЧ:ММ:СС. uses — число использований.
- price — ИТОГО к оплате числом как в документе ("339,80" → "339.80"), даже если оплачено баллами.
  price_currency — код валюты (₽ = RUB). price_base — цена до скидки, discount — сумма скидки числом
  (не процент). price_local, price_local_currency — вторая сумма, если напечатаны ДВЕ валюты.
- paid_with — чем оплачено, если сказано: карта, Trip Coins, баллы.
- booked_via — площадка покупки: Trip.com, Airalo, Holafly, Yesim, салон оператора, «напрямую».
- note — одна короткая строка важных условий: «отмена невозможна после использования».
- Чего нет — пустая строка. Ничего не выдумывай и не пересчитывай.
ЗАПРЕЩЕНО возвращать PIN или пароль заказа, PIN/PUK сим-карты, имя и фамилию, телефон и почту
покупателя/контакта, номер банковской карты, адрес. Игнорируй их — ни в одно поле, включая note.`;
```

### 3.2 Нормализация (trip.js, рядом с `numAmount`)

Правило CLAUDE.md про `str_replace` запрещает пары «доллар + амперсанд/обратная кавычка/апостроф/цифра» в `new_str`.
Поэтому знак доллара в строках LPA собирается константой `DLR`. В регулярках `\$` стоит перед `(`, `[` или
буквой — это безопасно.

```js
// ---------- SIM/eSIM: нормализация (28.09.2026, ADR-233) ----------
const DLR = String.fromCharCode(36);   // знак доллара константой: литерал рядом с кавычкой ломает str_replace (CLAUDE.md)
// LPA по GSMA SGP.22: LPA:1$<SM-DP+>$<matching ID>[$<OID>[$<флаг кода подтверждения>]].
export function lpaParse(raw) {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, '').replace(/^lpa:/i, 'LPA:');
  const m = /^LPA:1\$([^$]+)\$([^$]*)(?:\$([^$]*))?(?:\$([01]))?$/.exec(s);
  if (!m) return null;
  const smdp = m[1].toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}(:\d{1,5})?$/.test(smdp)) return null;
  const code = m[2];
  if (code && !/^[A-Za-z0-9._-]{1,255}$/.test(code)) return null;
  return { smdp, code, oid: m[3] || '', confirm: m[4] === '1' };
}
export const lpaBuild = p => !p || !p.smdp ? '' : ['LPA:1', p.smdp, p.code || '']
  .concat(p.oid || p.confirm ? [p.oid || ''] : []).concat(p.confirm ? ['1'] : []).join(DLR);
// ICCID: цифры, 19–20 знаков, начинается с 89. Luhn — только предупреждение: у 20-значных бывает без контрольной.
export function iccidNorm(raw) {
  const d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.length < 19 || d.length > 20 || !d.startsWith('89')) return { iccid: '', luhn: null };
  let t = 0;
  for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; }
  return { iccid: d, luhn: t % 10 === 0 };
}
// Номер линии: «+», затем 7–15 цифр (E.164). Без плюса — как есть цифрами; мусор — пусто.
export function phoneNorm(raw) {
  const s = String(raw == null ? '' : raw).trim();
  const d = s.replace(/\D/g, '');
  if (d.length < 7 || d.length > 15) return '';
  return (s.startsWith('+') ? '+' : '') + d;
}
export function dataMb(raw) {
  const m = /([\d.,]+)\s*(tb|тб|gb|гб|mb|мб)/i.exec(String(raw || ''));
  if (!m) return null;
  const n = numAmount(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  const u = m[2].toLowerCase();
  return Math.round(n * (/t|т/.test(u) ? 1048576 : /g|г/.test(u) ? 1024 : 1));
}
export function speedKbps(raw) {
  const m = /([\d.,]+)\s*(kbps|kbit|кбит|mbps|mbit|мбит)/i.exec(String(raw || ''));
  if (!m) return null;
  const n = numAmount(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(/^m|^м/i.test(m[2]) ? n * 1000 : n);
}
export function curCode(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (/₽|руб|rub|rur/i.test(s)) return 'RUB';
  if (/\$|usd/i.test(s)) return 'USD';
  if (/€|eur/i.test(s)) return 'EUR';
  return s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}
function normMoment(raw) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(raw || '').trim());
  if (!m || !normDate(m[1]) || +m[2] > 23 || +m[3] > 59 || +(m[4] || 0) > 59) return null;
  return m[1] + ' ' + m[2].padStart(2, '0') + ':' + m[3] + ':' + (m[4] || '00');
}
```

Суммы разбирает существующий `numAmount()` («357,69», «1 357,69», «5,906.59»). `scanPrice()` для SIM НЕ
использовать: его `replace(',', '.')` ломает «5,906.59».

### 3.3 Сроки и статус

```js
function momentToUtc(moment, tz) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(moment || ''));
  if (!m) return null;
  const base = localToUtc(m[1], m[2] + ':' + m[3], tz);
  return base == null ? null : base + (+m[4]) * 1000;
}
const utcToMoment = (ms, tz) => new Date(ms).toLocaleString('sv-SE', { timeZone: tz, hourCycle: 'h23' }).replace('T', ' ');
const simTz = s => s.tz || COUNTRY_TZ[s.country] || 'Europe/Moscow';
// Когда кончается пакет (UTC-мс) или null, если срока нет / не активирована.
function simExpiresMs(s) {
  if (!s.activated_at || !(s.days > 0)) return null;
  const tz = simTz(s), a = momentToUtc(s.activated_at, tz);
  if (a == null) return null;
  return s.day_mode === 'calendar'
    ? momentToUtc(addDays(s.activated_at.slice(0, 10), s.days - 1) + ' 23:59:59', tz)
    : a + s.days * 86400e3;
}
export function simState(s, nowMs = Date.now()) {
  const tz = simTz(s), exp = simExpiresMs(s);
  let nextReset = null;
  if (exp != null && s.day_mode !== 'calendar') {
    const a = momentToUtc(s.activated_at, tz), k = Math.floor((nowMs - a) / 86400e3) + 1, t = a + k * 86400e3;
    if (nowMs >= a && t < exp) nextReset = t;
  }
  const status = s.activated_at ? (exp != null && nowMs >= exp ? 'expired' : 'active')
    : (s.activate_by && today() > s.activate_by ? 'expired' : s.installed_on ? 'installed' : 'bought');
  return { tz, status,
    expires_at: exp != null ? utcToMoment(exp, tz) : null,
    hours_left: status === 'active' && exp != null ? Math.max(0, Math.floor((exp - nowMs) / 3600e3)) : null,
    next_reset_at: nextReset != null ? utcToMoment(nextReset, tz) : null,
    never_activated: !s.activated_at && status === 'expired' };
}
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;
// «Египет 2 ГБ/день, 3 дня» — бейдж и заголовок строки расхода.
export function simLabel(s) {
  const gb = s.data_mb ? (s.data_mb >= 1024 ? +(s.data_mb / 1024).toFixed(1) + ' ГБ' : s.data_mb + ' МБ') : '';
  const vol = s.plan_kind === 'unlimited' ? 'безлимит' : gb ? gb + (s.plan_kind === 'daily' ? '/день' : '') : '';
  const d = s.days ? s.days + ' ' + plural(s.days, 'день', 'дня', 'дней') : '';
  return [s.country || s.region || (s.kind === 'sim' ? 'SIM' : 'eSIM'), [vol, d].filter(Boolean).join(', ')].filter(Boolean).join(' ');
}
export const SIM_KIND_RU = { sim: 'SIM', esim: 'eSIM' };
```

### 3.4 Ручка `POST …/trip/sim-scan`

Три входа, как в редакции 1: сырой файл (`X-File-Name`), JSON `{files}` до 5 штук или `text/plain` с `X-Doc-Kind: text`.
Приём файлов вынесен в помощник `takeFiles()` — это дословная копия логики из `/trip/scan` (стр. 4272–4323).
`/trip/scan` на него переводится отдельной правкой.

```js
  function takeFiles(req, res, noteOne, noteMany) {
    purgeScansLazy();
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    if (!body.length) { res.status(400).json({ ok: false, error: 'файл не дошёл до сервера — попробуйте ещё раз' }); return null; }
    const cleanName = raw => String(raw || 'screen').replace(/[^\w.\-А-Яа-яЁё ]/g, '_').slice(0, 120);
    const files = [];
    if (String(req.headers['content-type'] || '').includes('application/json')) {
      let parsed;
      try { parsed = JSON.parse(body.toString('utf8')); } catch { res.status(400).json({ ok: false, error: 'не разобрал тело запроса' }); return null; }
      const list = Array.isArray(parsed?.files) ? parsed.files.slice(0, MAX_FILES) : [];
      if (!list.length) { res.status(400).json({ ok: false, error: 'нет файлов' }); return null; }
      for (const f of list) {
        const buf = Buffer.from(String(f?.data || ''), 'base64');
        if (!buf.length) { res.status(400).json({ ok: false, error: 'пустой файл: ' + cleanName(f?.name) }); return null; }
        files.push({ name: cleanName(f?.name), buf });
      }
    } else {
      let n = 'screen';
      try { n = decodeURIComponent(req.headers['x-file-name'] || 'screen'); } catch {}
      files.push({ name: cleanName(n), buf: body });
    }
    for (const f of files) {
      f.ext = (f.name.split('.').pop() || '').toLowerCase();
      const sniff = sniffMime(f.buf);
      f.mime = sniff.mime || (sniff.heic ? null : SCAN_MIME[f.ext] || null);
      if (!f.mime) {
        res.status(415).json({ ok: false, error: sniff.heic
          ? 'снимок «' + f.name + '» в формате HEIC — модель его не читает. Переснимите в JPEG или пришлите скриншот'
          : 'формат не поддерживается: ' + (f.ext || 'без расширения') });
        return null;
      }
    }
    const uploadIds = [];
    for (const f of files) {
      try {
        const full = path.join(UP_DIR, crypto.randomBytes(8).toString('hex') + '.' + f.ext);
        fs.writeFileSync(full, f.buf);
        const id = logUpload({ kind: 'trip', file_name: f.name, file_size: f.buf.length, status: 'ok',
          note: files.length > 1 ? noteMany + ' (' + files.length + ' стр.)' : noteOne, storage_path: full,
          expires_at: new Date(Date.now() + KEEP_HOURS * 3600e3).toISOString().slice(0, 19).replace('T', ' ') });
        if (id) uploadIds.push(id);
      } catch (e) { console.error('trip scan save:', e.message); }
    }
    return { files, uploadIds, uploadId: uploadIds[0] || null, label: files.map(f => f.name).join(', ').slice(0, 160) };
  }

  function simTwin(profileId, booking_no, iccid, exceptId) {
    const q = (col, v) => v ? medDb.prepare(`SELECT * FROM trip_sims WHERE profile_id=? AND ${col}=? AND id<>?`).get(profileId, v, exceptId || 0) : null;
    return q('booking_no', booking_no) || q('iccid', iccid) || null;
  }

  app.post('/api/profile/:profileId/trip/sim-scan', express.raw({ type: '*/*', limit: MAX_BYTES }), async (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'нет ANTHROPIC_API_KEY' });
    const isText = String(req.headers['x-doc-kind'] || '').toLowerCase() === 'text';
    let got = null, pasted = '';
    if (isText) {
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      pasted = buf.toString('utf8').trim().slice(0, PASTE_MAX);
      if (pasted.length < 10) return res.status(400).json({ ok: false, error: 'текста слишком мало — вставьте письмо целиком' });
    } else {
      got = takeFiles(req, res, 'заказ SIM/eSIM → распознавание', 'заказ SIM/eSIM');
      if (!got) return;
    }
    const label = isText ? 'вставленный текст' : got.label;
    const started = Date.now();
    let u, raw;
    try {
      const content = isText ? [{ type: 'text', text: SIM_PROMPT + '\n\nТЕКСТ:\n' + pasted }]
        : [...got.files.map(f => ({ type: f.mime === 'application/pdf' ? 'document' : 'image',
            source: { type: 'base64', media_type: f.mime, data: f.buf.toString('base64') } })),
          { type: 'text', text: SIM_PROMPT }];
      u = await ask(content, 1500);
      raw = parseJson(u.text);
    } catch (e) {
      if (got && tasksDb) for (const id of got.uploadIds) {
        try { tasksDb.prepare("UPDATE file_uploads SET status='error', note=? WHERE id=?").run(String(e.message).slice(0, 300), id); } catch {}
      }
      logAiCall('trip_sim', isText ? null : 'upload', got?.uploadId || null, null, SCAN_MODEL, 0, 0, 0,
        { note: label, durationMs: Date.now() - started, error: e.message });
      logGeneration('trip_sim', 'Заказ SIM: ' + label, '', '', null, 'error', e.message);
      return res.status(502).json({ ok: false, error: 'распознать не удалось: ' + e.message, upload_ids: got?.uploadIds || [] });
    }
    // Белый список — вторая линия защиты: PIN, имя, почта и телефон покупателя наружу не уйдут.
    const S = v => String(v == null ? '' : v).trim().slice(0, TEXT_MAX);
    const B = v => v === true || v === 'true' ? 1 : v === false || v === 'false' ? 0 : '';
    const kind = raw?.kind === 'sim' ? 'sim' : 'esim';
    let lpa = null;
    if (kind === 'esim') {
      // В тексте LPA ловим регуляркой сами: модель может ошибиться в символе кода.
      if (isText) { const m = /LPA:1\$[^\s$]+\$[A-Za-z0-9._-]+(?:\$[^\s$]*)?(?:\$[01])?/i.exec(pasted); if (m) lpa = lpaParse(m[0]); }
      if (!lpa) lpa = lpaParse(raw?.lpa);
      if (!lpa && raw?.smdp && raw?.activation_code) lpa = lpaParse(['LPA:1', raw.smdp, raw.activation_code].join(DLR));
    }
    const ic = iccidNorm(raw?.iccid);
    const pk = ['daily', 'total', 'unlimited'].includes(raw?.plan_kind) ? raw.plan_kind : (raw?.data_per_day ? 'daily' : raw?.data_total ? 'total' : '');
    const money = v => { const n = numAmount(v); return isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : ''; };
    const sim = {
      kind, country: S(raw?.country).slice(0, COUNTRY_MAX), region: S(raw?.region),
      product: S(raw?.product), plan: S(raw?.plan), network: S(raw?.network).toUpperCase().slice(0, 8),
      plan_kind: pk, data_mb: String(dataMb(pk === 'total' ? raw?.data_total : raw?.data_per_day) || ''),
      throttle_kbps: String(speedKbps(raw?.throttle) || ''),
      days: String(raw?.days || '').replace(/\D/g, '').slice(0, 3),
      day_mode: ['rolling24', 'calendar'].includes(raw?.day_mode) ? raw.day_mode : '',
      sms: B(raw?.sms), calls: B(raw?.calls), dual_sim: B(raw?.dual_sim),
      phone: phoneNorm(raw?.phone), operator: S(raw?.operator).slice(0, 60),
      apn: S(raw?.apn).replace(/[^\w.\-]/g, '').slice(0, 60),
      lpa: lpa ? lpaBuild(lpa) : '', smdp: lpa ? lpa.smdp : '',
      iccid: ic.iccid, iccid_luhn: ic.luhn,
      balance_url: (() => { const x = S(raw?.balance_url); return /^https?:\/\/[\w.-]+\.[a-z]{2,}/i.test(x) ? x.slice(0, 300) : ''; })(),
      booking_no: S(raw?.booking_no).replace(/[^\w-]/g, '').slice(0, 40), order_status: S(raw?.order_status).slice(0, 30),
      purchased_on: normDate(raw?.purchased_on) || '', activate_by: normDate(raw?.activate_by) || '',
      extend_until: normMoment(raw?.extend_until) || '', uses: String(raw?.uses || '').replace(/\D/g, '').slice(0, 3),
      price: money(raw?.price), price_currency: curCode(raw?.price_currency),
      price_base: money(raw?.price_base), discount: money(raw?.discount),
      price_local: money(raw?.price_local), price_local_currency: curCode(raw?.price_local_currency),
      paid_with: S(raw?.paid_with).slice(0, 40),
      booked_via: vendorResolve(medDb, S(raw?.booked_via), false) || '', note: S(raw?.note)
    };
    logAiCall('trip_sim', isText ? null : 'upload', got?.uploadId || null, null, SCAN_MODEL, u.inTok, u.outTok, cost(u),
      { note: label, durationMs: Date.now() - started });
    if (!sim.country && !sim.product && !sim.lpa && !sim.iccid && !sim.booking_no && !sim.phone) {
      logGeneration('trip_sim', 'Заказ SIM: ' + label, 'ни одного поля не распознано', '', u, 'error', 'в документе нет данных SIM');
      return res.status(422).json({ ok: false, upload_ids: got?.uploadIds || [],
        error: isText ? 'в тексте не нашлось данных SIM — вставьте письмо целиком или заполните поля руками'
          : 'на снимке не нашлось данных SIM — снимите заказ целиком или заполните поля руками' });
    }
    const twin = simTwin(profileId, sim.booking_no, sim.iccid);
    if (twin) sim.dup_id = twin.id;
    const tail = s => s ? '···' + String(s).slice(-4) : '';
    const genId = logGeneration('trip_sim', 'Заказ ' + SIM_KIND_RU[kind] + ': ' + simLabel({ ...sim, data_mb: +sim.data_mb, days: +sim.days }),
      [sim.country, sim.plan, sim.booked_via].filter(Boolean).join(' · '),
      // В общий журнал код, ICCID, номер заказа и телефон — только хвостом.
      JSON.stringify({ ...sim, lpa: lpa ? ['LPA:1', lpa.smdp, tail(lpa.code)].join(DLR) : '',
        iccid: tail(sim.iccid), booking_no: tail(sim.booking_no), phone: tail(sim.phone) }, null, 2), u, 'ok');
    res.json({ ok: true, sim, upload_ids: got?.uploadIds || [], generation_id: genId });
  });
```

`server.js:249`:

```diff
-const RAW_BODY_RE = /^\/api\/profile\/[^/]+\/trip\/scan$/;
+const RAW_BODY_RE = /^\/api\/profile\/[^/]+\/trip\/(scan|sim-scan)$/;
```

---

## 4. API и шифрование

### 4.1 Ручки (все под `/api/profile/:profileId/trip`, начинаются с `pid()`)

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/sims` | список без `code_enc`: + `kind_ru`, `label`, `status`, `expires_at`, `hours_left`, `next_reset_at`, `lpa_masked`, `has_code`, `iccid_masked`; итоги `active`, `soon`; `key_ok` — задан ли `TRIP_SIM_KEY` |
| GET | `/sims/:id/secret` | `{ lpa }` целиком — только для eSIM, по кнопке «Показать»; нет ключа → 503 |
| POST | `/sims` | создать. Есть близнец по `booking_no`/`iccid` — дозаполнить его пустые поля, вернуть `{merged:true}`. Затем `syncSimExpense()` |
| PATCH | `/sims/:id` | правка; сбрасывает флаги напоминаний, если поменялись сроки; затем `syncSimExpense()` |
| DELETE | `/sims/:id` | удалить SIM и её строку расхода (одна транзакция) |
| POST | `/sim-scan` | распознавание (§3.4), записи не создаёт |

Кнопки «Установил/Вставил» и «Подключилась» — это `PATCH` с `installed_on` / `activated_at`.
`REF_ACTIVITY` (`trip.js:1730`) дополнить `sims`, если сохранение SIM считается первой записью Trip-реферала
(вопрос остаётся открытым, §10).

### 4.2 Шифр кода активации — `TRIP_SIM_KEY` (решение 4)

- Ключ — 32 байта в base64, переменная `TRIP_SIM_KEY` в `/home/cashruflow/mcp-server/.env` (её читает
  `dotenv.config` в `server.js:3`). Генерирует Константин на сервере сам, например
  `openssl rand -base64 32`. В код, в репозиторий и в чат ключ не попадает.
- Модуль читает ключ один раз при монтировании. Ключа нет или он не 32 байта — модуль пишет одну строку
  `console.error` и работает дальше без шифра (`KEY = null`). Сервер не падает.
- Без ключа:
  - `POST`/`PATCH` с `lpa` сохраняют запись **без кода**: `smdp` сохраняется, `code_enc = NULL`. В ответе
    приходит `code_skipped: true`, страница пишет «Код не сохранён: не настроен ключ шифрования — после
    настройки вставьте код ещё раз».
  - Открытым текстом код не пишется НИКОГДА.
  - `GET /secret` отвечает 503 `no_key`.
- Шифротекст имеет префикс `v1:` — задел под смену ключа. Если ключ заменили и старые коды не расшифровываются,
  `GET /secret` отвечает 500 «код не расшифровался — ключ сменился, вставьте код заново». Это не падение.
- Статус ключа можно показать на странице интеграций: `integrations.js` → `keyCard('trip-sim-key', <группа по
  соседству>, 'Шифр кодов eSIM', 'TRIP_SIM_KEY', 'задан')`. Показывается только «задан / не задан», значение — нет.

```js
  // ---------- SIM: шифр кода активации (28.09.2026, ADR-233) ----------
  // Свой ключ модуля, а не ключ сейфа доступов: смена или утечка одного не задевает другой.
  // Нет ключа — модуль работает, коды просто не сохраняются (никогда не пишем открытым текстом).
  const SIM_KEY = (() => {
    const raw = String(process.env.TRIP_SIM_KEY || '').trim();
    if (!raw) { console.error('[trip] TRIP_SIM_KEY не задан — коды активации eSIM сохраняться не будут'); return null; }
    const k = Buffer.from(raw, 'base64');
    if (k.length !== 32) { console.error('[trip] TRIP_SIM_KEY: нужно 32 байта в base64, получено ' + k.length); return null; }
    return k;
  })();
  function simSeal(txt) {
    if (!SIM_KEY || !txt) return null;
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', SIM_KEY, iv);
    const ct = Buffer.concat([c.update(String(txt), 'utf8'), c.final()]);
    return ['v1', iv.toString('hex'), c.getAuthTag().toString('hex'), ct.toString('hex')].join(':');
  }
  function simOpen(blob) {
    if (!SIM_KEY || !blob) return null;
    try {
      const [v, iv, tag, ct] = String(blob).split(':');
      if (v !== 'v1') return null;
      const d = crypto.createDecipheriv('aes-256-gcm', SIM_KEY, Buffer.from(iv, 'hex'));
      d.setAuthTag(Buffer.from(tag, 'hex'));
      return Buffer.concat([d.update(Buffer.from(ct, 'hex')), d.final()]).toString('utf8');
    } catch (e) { return null; }
  }
```

`crypto` в `trip.js` уже импортирован (стр. 42).

### 4.3 Тело и CRUD

```js
  const SIM_TEXT = { country: COUNTRY_MAX, region: TEXT_MAX, product: TEXT_MAX, plan: TEXT_MAX, network: 8,
    operator: 60, apn: 60, order_status: 30, paid_with: 40, note: TEXT_MAX };
  const SIM_INT = ['data_mb', 'throttle_kbps', 'days', 'uses'];
  const SIM_FLAG = ['sms', 'calls', 'dual_sim', 'roaming'];
  const SIM_MONEY = ['price', 'price_local', 'price_base', 'discount'];
  const SIM_LPA_COLS = ['smdp', 'code_enc', 'code_tail', 'lpa_oid', 'confirm_required'];
  // Поля, от которых зависят напоминания: поменялось любое — флаги отправки сбрасываются.
  const SIM_WHEN = ['activated_at', 'days', 'day_mode', 'tz', 'activate_by', 'installed_on'];
  function simBody(body, base) {
    const b = base || {}, out = {}, warn = [];
    const has = k => body?.[k] !== undefined;
    out.kind = has('kind') ? (body.kind === 'sim' ? 'sim' : 'esim') : (b.kind || 'esim');
    for (const [k, max] of Object.entries(SIM_TEXT)) out[k] = has(k) ? str(body[k], max) : (b[k] ?? null);
    for (const k of SIM_INT) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      const n = parseInt(String(body[k]).replace(/\D/g, ''), 10);
      out[k] = Number.isFinite(n) && n > 0 ? n : null;
    }
    for (const k of SIM_FLAG) out[k] = has(k) ? (body[k] === true || body[k] === 1 || body[k] === '1' ? 1 : 0)
      : (b[k] ?? (k === 'roaming' ? (out.kind === 'esim' ? 1 : 0) : 0));
    for (const k of SIM_MONEY) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      if (String(body[k] ?? '').trim() === '') { out[k] = null; continue; }
      const n = numAmount(body[k]);
      if (!isFinite(n) || n < 0) return { error: { error: 'bad_amount', message: 'Сумма — число' } };
      out[k] = Math.round(n * 100) / 100;
    }
    for (const k of ['price_currency', 'price_local_currency']) out[k] = has(k) ? (curCode(body[k]) || null) : (b[k] ?? null);
    if (out.price != null && !out.price_currency) out.price_currency = 'RUB';
    out.plan_kind = has('plan_kind') ? (['daily', 'total', 'unlimited'].includes(body.plan_kind) ? body.plan_kind : 'daily') : (b.plan_kind || 'daily');
    out.day_mode = has('day_mode') ? (body.day_mode === 'calendar' ? 'calendar' : 'rolling24') : (b.day_mode || 'rolling24');
    out.operator_src = has('operator') ? (out.operator ? (body.operator_src === 'doc' ? 'doc' : 'manual') : null) : (b.operator_src ?? null);
    out.phone = has('phone') ? (phoneNorm(body.phone) || null) : (b.phone ?? null);
    if (has('phone') && String(body.phone || '').trim() && !out.phone) return { error: { error: 'bad_phone', message: 'Номер — 7–15 цифр, можно с +' } };
    for (const k of ['purchased_on', 'activate_by', 'installed_on']) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      const v = String(body[k] || '').trim();
      out[k] = v ? normDate(v) : null;
      if (v && !out[k]) return { error: { error: 'bad_date', message: 'Даты в формате ГГГГ-ММ-ДД' } };
    }
    for (const k of ['activated_at', 'extend_until']) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      const v = String(body[k] || '').trim();
      out[k] = v ? normMoment(v) : null;
      if (v && !out[k]) return { error: { error: 'bad_moment', message: 'Время в формате ГГГГ-ММ-ДД ЧЧ:ММ' } };
    }
    out.tz = has('tz') ? (str(body.tz, 40) || null) : (b.tz ?? null);
    if (out.tz) { try { new Intl.DateTimeFormat('en', { timeZone: out.tz }); } catch { return { error: { error: 'bad_tz', message: 'Неизвестный часовой пояс' } }; } }
    if (!out.tz && out.country) out.tz = COUNTRY_TZ[out.country] || null;
    if (has('iccid')) {
      const ic = iccidNorm(body.iccid);
      if (String(body.iccid || '').trim() && !ic.iccid) return { error: { error: 'bad_iccid', message: 'ICCID — 19–20 цифр, начинается с 89' } };
      out.iccid = ic.iccid || null;
    } else out.iccid = b.iccid ?? null;
    out.booking_no = has('booking_no') ? (String(body.booking_no || '').replace(/[^\w-]/g, '').slice(0, 40) || null) : (b.booking_no ?? null);
    if (has('balance_url')) {
      const x = String(body.balance_url || '').trim().slice(0, 300);
      out.balance_url = !x ? null : /^https?:\/\//i.test(x) ? x : (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(x) ? 'https://' + x : null);
    } else out.balance_url = b.balance_url ?? null;
    // Код активации — только у eSIM. Физическая SIM: все LPA-колонки обнуляются.
    if (out.kind === 'sim') Object.assign(out, { smdp: null, code_enc: null, code_tail: null, lpa_oid: null, confirm_required: 0 });
    else if (has('lpa')) {
      const s = String(body.lpa || '').trim();
      if (!s) Object.assign(out, { smdp: null, code_enc: null, code_tail: null, lpa_oid: null, confirm_required: 0 });
      else {
        const p = lpaParse(s);
        if (!p) return { error: { error: 'bad_lpa', message: 'Код активации — строка вида LPA:1, адрес и код через знак доллара' } };
        const sealed = p.code ? simSeal(p.code) : null;
        if (p.code && !sealed) warn.push('code_skipped');   // нет ключа: код не сохраняем, остальное — да
        Object.assign(out, { smdp: p.smdp, code_enc: sealed, code_tail: sealed ? p.code.slice(-4) : null,
          lpa_oid: p.oid || null, confirm_required: p.confirm ? 1 : 0 });
      }
    } else for (const k of SIM_LPA_COLS) out[k] = b[k] ?? (k === 'confirm_required' ? 0 : null);
    if (!out.country && !out.region && !out.product && !out.booking_no && !out.iccid && !out.phone)
      return { error: { error: 'empty', message: 'Укажите страну, тариф, номер заказа, ICCID или номер телефона' } };
    // Сроки поменялись — напоминания заново (иначе продлённая SIM молчала бы: флаг уже стоит).
    if (base && SIM_WHEN.some(k => String(out[k] ?? '') !== String(b[k] ?? '')))
      Object.assign(out, { notify_pre_sent_at: null, notify_end_sent_at: null, notify_actby_pre_sent_at: null, notify_actby_sent_at: null, notify_error: null });
    return { row: out, warn };
  }
  const simView = r => {
    const { code_enc, ...rest } = r;
    const tail = s => s ? '···' + String(s).slice(-4) : '';
    return Object.assign(rest, simState(r), {
      kind_ru: SIM_KIND_RU[r.kind] || 'eSIM', label: simLabel(r), has_code: !!code_enc,
      lpa_masked: r.kind === 'esim' && r.smdp ? ['LPA:1', r.smdp, tail(r.code_tail)].join(DLR) : '',
      iccid_masked: tail(r.iccid) });
  };
  const simGet = id => simView(medDb.prepare('SELECT * FROM trip_sims WHERE id=?').get(id));

  app.get('/api/profile/:profileId/trip/sims', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const rows = medDb.prepare(`SELECT * FROM trip_sims WHERE profile_id=?
        ORDER BY COALESCE(activated_at, purchased_on, created_at) DESC, id DESC`).all(profileId).map(simView);
      res.json({ ok: true, on: today(), key_ok: !!SIM_KEY, sims: rows,
        active: rows.filter(r => r.status === 'active').length,
        soon: rows.filter(r => r.status !== 'expired' && !r.activated_at && r.activate_by && dnum(r.activate_by) - dnum(today()) <= 14).length });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/profile/:profileId/trip/sims/:id/secret', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const r = medDb.prepare(`SELECT kind, smdp, code_enc, lpa_oid, confirm_required FROM trip_sims WHERE id=? AND profile_id=?`).get(req.params.id, profileId);
    if (!r || r.kind !== 'esim') return res.status(404).json({ ok: false, error: 'not_found' });
    if (!r.code_enc) return res.status(404).json({ ok: false, error: 'no_code', message: 'Код активации не сохранён' });
    if (!SIM_KEY) return res.status(503).json({ ok: false, error: 'no_key', message: 'Не настроен ключ шифрования (TRIP_SIM_KEY)' });
    const code = simOpen(r.code_enc);
    if (code == null) return res.status(500).json({ ok: false, error: 'decrypt', message: 'Код не расшифровался — ключ сменился, вставьте код заново' });
    res.json({ ok: true, lpa: lpaBuild({ smdp: r.smdp, code, oid: r.lpa_oid, confirm: !!r.confirm_required }) });
  });

  app.post('/api/profile/:profileId/trip/sims', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const d = simBody(req.body, null);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      const twin = simTwin(profileId, d.row.booking_no, d.row.iccid);
      let id, merged = false, filled = [];
      medDb.transaction(() => {
        if (twin) {
          // Повторный импорт той же брони: дозаполняем пустые поля занесённой записи.
          const fill = Object.fromEntries(Object.entries(d.row).filter(([k, v]) => v != null && v !== ''
            && (twin[k] == null || twin[k] === '') && !k.startsWith('notify_')));
          if (Object.keys(fill).length) medDb.prepare(`UPDATE trip_sims SET ${Object.keys(fill).map(k => k + '=?').join(', ')},
            updated_at=datetime('now') WHERE id=?`).run(...Object.values(fill), twin.id);
          id = twin.id; merged = true; filled = Object.keys(fill);
        } else {
          const row = { profile_id: profileId, ...d.row };
          const cols = Object.keys(row);
          id = medDb.prepare(`INSERT INTO trip_sims (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(',')})`)
            .run(...cols.map(k => row[k])).lastInsertRowid;
        }
        syncSimExpense(profileId, id);
      })();
      saveVia('trip_sims', id, req.body);
      res.json({ ok: true, merged, filled, code_skipped: d.warn.includes('code_skipped'), sim: simGet(id) });
    } catch (e) {
      if (/UNIQUE/.test(e.message)) return res.status(409).json({ ok: false, error: 'dup', message: 'Эта SIM уже занесена' });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.patch('/api/profile/:profileId/trip/sims/:id', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = medDb.prepare('SELECT * FROM trip_sims WHERE id=? AND profile_id=?').get(req.params.id, profileId);
      if (!cur) return res.status(404).json({ ok: false, error: 'not_found' });
      const d = simBody(req.body, cur);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      if (simTwin(profileId, d.row.booking_no, d.row.iccid, cur.id))
        return res.status(409).json({ ok: false, error: 'dup', message: 'Другая SIM уже с этим номером заказа или ICCID' });
      const cols = Object.keys(d.row);
      medDb.transaction(() => {
        medDb.prepare(`UPDATE trip_sims SET ${cols.map(k => k + '=?').join(', ')}, updated_at=datetime('now') WHERE id=?`)
          .run(...cols.map(k => d.row[k]), cur.id);
        syncSimExpense(profileId, cur.id);
      })();
      saveVia('trip_sims', cur.id, req.body);
      res.json({ ok: true, code_skipped: d.warn.includes('code_skipped'), sim: simGet(cur.id) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete('/api/profile/:profileId/trip/sims/:id', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = medDb.prepare('SELECT id FROM trip_sims WHERE id=? AND profile_id=?').get(req.params.id, profileId);
      if (!cur) return res.status(404).json({ ok: false, error: 'not_found' });
      medDb.transaction(() => {
        // Строка расхода живёт ровно столько, сколько SIM: удаляем обе, одной транзакцией.
        medDb.prepare(`DELETE FROM trip_expenses WHERE profile_id=? AND source='sim' AND source_id=?`).run(profileId, cur.id);
        medDb.prepare('DELETE FROM trip_sims WHERE id=?').run(cur.id);
      })();
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
```

`medDb` — better-sqlite3 (везде `prepare().run/get/all`), поэтому `medDb.transaction(fn)()` доступен. Сверить
перед правкой: `search_code` по `medDb.transaction` в `web/` — ни одного вызова я не искал.

`saveVia('trip_sims', …)` сработает только в части `booked_via` — цена идёт через `simBody`.

---

## 5. UI: вкладка «Связь»

### 5.1 Название и место

Вкладка называется **«Связь»**. Соседние вкладки — существительные во множественном числе или общие понятия
(«Отели», «Страховки», «Разрешения», «Полёты»). «Связь» короткая, покрывает оба вида SIM и совпадает с категорией
расхода, поэтому в интерфейсе одно слово. «SIM/eSIM» со слешем в ряду вкладок читается хуже.

```diff
     <button type="button" class="ui-tab" data-t="ins">Страховки</button>
+    <button type="button" class="ui-tab" data-t="sims">Связь</button>
     <button type="button" class="ui-tab" data-t="permits">Разрешения</button>
```

```diff
-     stays: paintStays, ins: paintIns, permits: paintPermits, rules: paintRules }[t])();
+     stays: paintStays, ins: paintIns, sims: paintSims, permits: paintPermits, rules: paintRules }[t])();
```

Ряд `#tripTabs` станет из 11 кнопок — проверить на 360px (правило «в чужой ряд не дописывать, не проверив
flex-wrap»).

### 5.2 Форма и список

Устроены как `paintIns`: карточка формы сверху, список ниже, `formHead` / `bindRows` / `bindCancel`, `EDIT.sims`.
Отличия от редакции 1:

- Вверху формы переключатель типа — пара кнопок (`.btn` у активной, `.tbtn` у второй), как предписывает CLAUDE.md для
  переключателей: **«eSIM» / «SIM»**. Значение кладётся в скрытое `#sm-kind`.
- При `kind='sim'` блок `#sm-esim` (поле «Код активации», подсказка про QR, чекбокс роуминга по умолчанию) скрыт
  атрибутом `hidden`, а поле «Номер телефона» показано. При `esim` номер телефона тоже доступен, но свёрнут в
  «Ещё поля».
- Кнопка статуса называется по типу: у eSIM «Установил», у SIM «Вставил».
- Под формой при `key_ok === false` стоит строка «Шифр кодов не настроен — код активации не сохранится». Причина
  видна до ввода кода, а не после.
- После сохранения: если в ответе `code_skipped` — `note('Код активации не сохранён: не настроен ключ шифрования…')`
  красным через `fail`; если `merged` — «Эта SIM уже была — дополнил: …».

Ключевые куски (остальное — как `paintEsim` редакции 1 с заменой `es-` → `sm-`, `/esims` → `/sims`):

```js
/* ---------- Связь: SIM и eSIM (28.09.2026, ADR-233) ----------
   Статус, срок и «осталось» считает сервер. Код активации — маской; целиком приходит
   отдельным запросом по «Показать» и никуда не сохраняется (замок + пара кнопок). */
const SIM_ST = { sim: { bought: 'куплена', installed: 'вставлена', active: 'активна', expired: 'истекла' },
                 esim: { bought: 'куплена', installed: 'установлена', active: 'активна', expired: 'истекла' } };
let SIM_OPEN = null;
const simIco = n => '<svg class="sim-ico" aria-hidden="true"><use href="' + (window.ICONS_URL || '/assets/icons.svg?v=8') + '#' + n + '"></use></svg>';
function simKindSet(k) {
  set('sm-kind', k);
  $('#sm-k-esim').className = k === 'esim' ? 'btn btn-sm' : 'tbtn btn-sm';
  $('#sm-k-sim').className = k === 'sim' ? 'btn btn-sm' : 'tbtn btn-sm';
  $('#sm-esim').hidden = k !== 'esim';
  if (!EDIT.sims) $('#sm-roam').checked = k === 'esim';   // eSIM почти всегда требует роуминга данных
}
// разметка переключателя в начале формы:
//   <div class="row2" style="margin:0 0 10px;"><button type="button" id="sm-k-esim">eSIM</button>
//   <button type="button" id="sm-k-sim">SIM</button><input type="hidden" id="sm-kind" value="esim"></div>
//   ... <div id="sm-esim"> поле «Код активации» (#sm-lpa) </div>
//   <div class="fld"><span>Номер телефона</span><input id="sm-phone" inputmode="tel" placeholder="+20 …"></div>
// в body(): kind: val('sm-kind'), phone: val('sm-phone'), ...(val('sm-kind') === 'esim' && val('sm-lpa') ? { lpa: val('sm-lpa') } : {})
// в apply(d) скана: simKindSet(d.sim.kind || 'esim'); put('sm-phone', d.sim.phone); ...
// в fill() правки: simKindSet(e.kind); set('sm-phone', e.phone); ...
// на сохранение:
//   const r = EDIT.sims ? await send('/sims/' + EDIT.sims, 'PATCH', body()) : await send('/sims', 'POST', body());
//   if (r.code_skipped) fail(new Error('Код активации не сохранён: не настроен ключ шифрования. Остальное сохранено.'));
//   else if (r.merged) note('Эта SIM уже была — дополнил: ' + (r.filled.length ? r.filled.join(', ') : 'нового нет'), true);
```

Строка списка: `simIco(e.kind === 'sim' ? 'i-sim' : 'i-esim')` + чип типа `e.kind_ru` + `e.label` + статус (§2.2),
затем номер телефона, ICCID маской, ссылка баланса, код маской с кнопками «Показать / Скрыть» (только eSIM с
`has_code`), цена (`priceLine`), «оплачено Trip Coins», площадка и строка «В тратах поездки: Связь» — если
`expense_id` не пуст.

QR (`esimReveal`/`esimQrSvg` редакции 1) — только для `kind==='esim'`. Кодер берётся из `window.tripPass.loadQrLib`
(в `trip-pass.js` добавить `loadQrLib` в экспорт стр. 529 и поднять `?v=` у подключения на `trip.html`).

### 5.3 Значки и бейдж в поездке

Эмодзи запрещены, поэтому нужны два символа в спрайте `/assets/icons.svg` (24×24, стиль Lucide) и `ICONS_V` +1 в
`server.js`:

```xml
<symbol id="i-sim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.172 2a2 2 0 0 1 1.414.586l3.828 3.828A2 2 0 0 1 20 7.828V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="8" y="10" width="8" height="8" rx="1"/><path d="M8 14h8"/><path d="M12 10v8"/></symbol>
<symbol id="i-esim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.172 2a2 2 0 0 1 1.414.586l3.828 3.828A2 2 0 0 1 20 7.828V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M8.5 14.5a5 5 0 0 1 7 0"/><path d="M10.5 16.5a2 2 0 0 1 3 0"/><path d="M12 18.5h.01"/></symbol>
```

Бейдж в карточке поездки (`trip_journeys.js` → `compute()`; `trip-journeys.js` → `cardHtml()`). Подбор SIM к
поездке: страна SIM совпадает со страной одной из точек маршрута, а дата (подключение → установка → покупка)
попадает в окно `[начало − 30 дней, конец]`. Одна SIM — в одну поездку. Функции `simState`, `simLabel` и `SIM_KIND_RU`
приходят через deps, второй копии логики сроков нет:

```diff
-  mountTripJourneys(app, medDb, { pid, airport, tasksDb });
+  mountTripJourneys(app, medDb, { pid, airport, tasksDb, simState, simLabel, simKindRu: SIM_KIND_RU });
```

```js
      // в объект поездки (trip_journeys.js ~268): бейджи SIM
      sims: simIn.map(s => { const st = simState(s); return { id: s.id, kind: s.kind, kind_ru: simKindRu[s.kind],
        label: simLabel(s), status: st.status, expires_at: st.expires_at, activate_by: s.activate_by }; }),
```

```js
    // trip-journeys.js, cardHtml: «[значок] eSIM: Египет 2 ГБ/день, 3 дня · активна до 05.10 14:10»
    const SIM_RU = { bought: 'куплена', installed: 'установлена', active: 'активна', expired: 'истекла' };
    const simLine = (j.sims || []).map(s => '<span class="jr-chip jr-sim"><svg aria-hidden="true"><use href="'
      + (window.ICONS_URL || '/assets/icons.svg?v=8') + '#' + (s.kind === 'sim' ? 'i-sim' : 'i-esim') + '"></use></svg> '
      + esc(s.kind_ru) + ': ' + esc(s.label) + ' · ' + (s.kind === 'sim' && s.status === 'installed' ? 'вставлена' : SIM_RU[s.status])
      + (s.status === 'active' && s.expires_at ? ' до ' + s.expires_at.slice(8, 10) + '.' + s.expires_at.slice(5, 7) + ' ' + s.expires_at.slice(11, 16)
        : s.status === 'bought' && s.activate_by ? ' · активировать до ' + RU(s.activate_by) : '') + '</span>').join('');
```

### 5.4 QR со скрина — `BarcodeDetector` без новой зависимости

Если в заказе код только QR-картинкой, модель его не прочтёт. Поэтому **до** отправки на сервер страница пробует
прочитать QR сама:

```js
/* QR со скрина (28.09.2026, ADR-233): BarcodeDetector есть в Chrome/Edge на Android и ПК, в
   Safari (iOS/macOS) и Firefox его нет. Новых библиотек не тянем: нет детектора — просим
   вставить строку LPA текстом (она почти всегда есть в письме рядом с QR). */
async function simQrFromFiles(files) {
  if (!('BarcodeDetector' in window)) return { lpa: '', why: 'no_api' };
  try {
    const fmts = await BarcodeDetector.getSupportedFormats();
    if (!fmts.includes('qr_code')) return { lpa: '', why: 'no_api' };
    const det = new BarcodeDetector({ formats: ['qr_code'] });
    for (const f of files) {
      if (!/^image\//.test(f.type)) continue;          // PDF не читаем: картинки из него нет
      const bmp = await createImageBitmap(f);
      const codes = await det.detect(bmp);
      bmp.close && bmp.close();
      const hit = codes.map(c => String(c.rawValue || '').trim()).find(v => /^LPA:1\$/i.test(v));
      if (hit) return { lpa: hit, why: '' };
    }
    return { lpa: '', why: 'not_found' };
  } catch (e) { return { lpa: '', why: 'error' }; }
}
```

В `bindSimScan`, до `run(...)`:

```js
    const qr = await simQrFromFiles(picked);
    if (qr.lpa) { simKindSet('esim'); set('sm-lpa', qr.lpa); }
    // после ответа сервера: put('sm-lpa', d.sim.lpa) не затирает найденный QR-ом код — put пишет только непустое.
    // Подсказка, если кода нет ни в тексте, ни в QR:
    //   why === 'no_api'   → «Этот браузер не читает QR со скрина — вставьте строку LPA:1… из письма в поле „Код активации“»
    //   why === 'not_found'→ «QR на скринах не нашёл — вставьте строку LPA:1… текстом»
```

Код из QR не уходит на сервер отдельным запросом. Он попадает в поле формы и сохраняется обычным `POST /sims`
(там шифруется). Картинка при этом уходит на распознавание как раньше — за тарифом и сроками.

---

## 6. Расходы: строка `trip_expenses`, привязанная к SIM (решение 1)

### 6.1 Миграция `trip_expenses` (в `ensureJourneyTables`, web/trip_journeys.js)

```js
  // Откуда строка расхода (28.09.2026, ADR-233). NULL — внесена руками в шторке «+ Расход».
  // 'sim' — создана вкладкой «Связь»: source_id = trip_sims.id. Такие строки ведёт владелец —
  // сумма синхронизируется при правке SIM, строка удаляется вместе с SIM, а в шторке расходов
  // она только для чтения (иначе сумма разъедется с карточкой SIM).
  try {
    const ec = medDb.prepare('PRAGMA table_info(trip_expenses)').all().map(c => c.name);
    if (!ec.includes('source')) medDb.exec('ALTER TABLE trip_expenses ADD COLUMN source TEXT');
    if (!ec.includes('source_id')) medDb.exec('ALTER TABLE trip_expenses ADD COLUMN source_id INTEGER');
    // Одна SIM — не больше одной строки расхода: повторный импорт и гонка двух сохранений упрутся сюда.
    medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_expenses_source ON trip_expenses(profile_id, source, source_id)
      WHERE source IS NOT NULL`);
  } catch (e) { console.error('trip_expenses source:', e.message); }
```

Порядок монтирования: `ensureTripTables` (в `mountTrip`) создаёт `trip_sims` раньше, чем `mountTripJourneys` создаёт
колонки `trip_expenses`. `syncSimExpense` вызывается только из ручек, то есть после монтирования — гонки на старте нет.

### 6.2 Категория «Связь»

```diff
-export const CATS = { transport: 'Транспорт', stay: 'Жильё', food: 'Еда', fun: 'Развлечения', other: 'Прочее' };
+export const CATS = { transport: 'Транспорт', stay: 'Жильё', food: 'Еда', comm: 'Связь', fun: 'Развлечения', other: 'Прочее' };
```

```diff
+  // Связь (ADR-233): SIM/eSIM, пополнение, роуминг. Стоит до «развлечений» и «прочего».
+  ['comm', /esim|e-sim|сим.?карт|sim.?card|airalo|holafly|yesim|nomad|ubigi|drimsim|роуминг|roaming|мобильн.*связ|сотов|пополнени.*телефон|top.?up|билайн|beeline|мтс|мегафон|megafon|tele2|теле2|turkcell|vodafone|etisalat|\bais\b|dtac|truemove/i],
   ['fun', …]
```

`trip-journeys.js:7`: `CAT_COLOR` + `comm: '#a78bfa'`. Чипы в шторке «+ Расход» строятся из `DATA.cats`, поэтому
«Связь» появится там сама: ручной расход «пополнил Vodafone» тоже можно отнести к «Связи».

### 6.3 Синхронизация: `syncSimExpense(profileId, simId)` (trip.js)

Функция вызывается внутри транзакции POST и PATCH SIM. Она идемпотентна: сколько ни зови, строка одна.

```js
  // Строка расхода SIM (решение 28.09.2026): SIM — владелец, расход — её отражение в тратах.
  //  • цена есть → upsert строки (category='comm', source='sim', source_id=id), expense_id на SIM;
  //  • цены нет (стёрли) → строку удалить, expense_id = NULL;
  //  • оплата баллами (Trip Coins) — тоже трата (решение 3): сумма идёт как есть, способ — в note.
  // Ключ upsert — уникальный индекс (profile_id, source, source_id): повторный импорт той же брони
  // попадает в ту же SIM (simTwin) и, значит, в ту же строку расхода.
  function syncSimExpense(profileId, simId) {
    const s = medDb.prepare('SELECT * FROM trip_sims WHERE id=? AND profile_id=?').get(simId, profileId);
    if (!s) return;
    const amount = s.price != null ? s.price : null, local = s.price_local != null ? s.price_local : null;
    if (!amount && !local) {
      medDb.prepare(`DELETE FROM trip_expenses WHERE profile_id=? AND source='sim' AND source_id=?`).run(profileId, simId);
      if (s.expense_id != null) medDb.prepare('UPDATE trip_sims SET expense_id=NULL WHERE id=?').run(simId);
      return;
    }
    // Дата траты — день покупки: по нему операция сойдётся с выпиской. Нет даты — день подключения/установки/заведения.
    const spent = s.purchased_on || (s.activated_at || '').slice(0, 10) || s.installed_on || String(s.created_at || '').slice(0, 10) || today();
    const row = {
      profile_id: profileId, source: 'sim', source_id: simId, spent_on: spent, category: 'comm',
      title: (SIM_KIND_RU[s.kind] || 'eSIM') + ' · ' + simLabel(s),
      amount, currency: amount ? (s.price_currency || 'RUB') : null,
      amount_local: local, currency_local: local ? s.price_local_currency : null,
      note: [s.paid_with ? 'оплачено: ' + s.paid_with : '', s.booked_via || ''].filter(Boolean).join(' · ') || null
    };
    const cols = Object.keys(row), upd = cols.filter(k => !['profile_id', 'source', 'source_id'].includes(k));
    medDb.prepare(`INSERT INTO trip_expenses (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(',')})
      ON CONFLICT(profile_id, source, source_id) WHERE source IS NOT NULL
      DO UPDATE SET ${upd.map(k => k + '=excluded.' + k).join(', ')}, updated_at=datetime('now')`).run(...cols.map(k => row[k]));
    const e = medDb.prepare(`SELECT id FROM trip_expenses WHERE profile_id=? AND source='sim' AND source_id=?`).get(profileId, simId);
    if (e && e.id !== s.expense_id) medDb.prepare('UPDATE trip_sims SET expense_id=? WHERE id=?').run(e.id, simId);
  }
```

`ON CONFLICT … WHERE` для частичного уникального индекса требует SQLite ≥ 3.24 (upsert). Версию SQLite в
better-sqlite3 на сервере я не проверял; если upsert не пройдёт — заменить на «SELECT по (source, source_id) →
UPDATE или INSERT» внутри той же транзакции.

Итог сценариев:

| Сценарий | Что с расходом |
|---|---|
| Сохранили SIM с ценой 339,80 RUB, оплата Trip Coins | строка `trip_expenses`: 339,80 RUB, «Связь», note «оплачено: Trip Coins · Trip.com»; `trip_sims.expense_id` = её id |
| Повторный импорт того же заказа | `simTwin` находит SIM по `booking_no`/`iccid` → дозаполнение → `syncSimExpense` обновляет ту же строку. Второй строки нет: её не пустит и уникальный индекс |
| Правка цены / валюты / даты покупки / тарифа | та же строка обновляется (сумма, валюта, дата, заголовок) |
| Цену стёрли | строка удаляется, `expense_id = NULL` |
| Удалили SIM | строка удаляется в той же транзакции |
| Строку правят или удаляют в шторке расходов | 409 «Эта трата ведётся во вкладке „Связь“» (§6.4) |
| Сменили тип SIM ↔ eSIM | обновляется только заголовок строки |

### 6.4 Защита строк `source='sim'` в ручках расходов (trip_journeys.js)

```diff
   app.patch(P + '/expenses/:id', (req, res) => {
     const profileId = pid(req, res); if (!profileId) return;
-    const cur0 = medDb.prepare('SELECT id FROM trip_expenses WHERE id=? AND profile_id=?').get(req.params.id, profileId);
+    const cur0 = medDb.prepare('SELECT id, source FROM trip_expenses WHERE id=? AND profile_id=?').get(req.params.id, profileId);
     if (!cur0) return res.status(404).json({ ok: false, error: 'расход не найден' });
+    if (cur0.source) return res.status(409).json({ ok: false, error: 'Эта трата ведётся во вкладке «Связь» — правьте там' });
```

```diff
   app.delete(P + '/expenses/:id', (req, res) => {
     const profileId = pid(req, res); if (!profileId) return;
-    const r = medDb.prepare('DELETE FROM trip_expenses WHERE id=? AND profile_id=?').run(req.params.id, profileId);
+    const r = medDb.prepare('DELETE FROM trip_expenses WHERE id=? AND profile_id=? AND source IS NULL').run(req.params.id, profileId);
-    if (!r.changes) return res.status(404).json({ ok: false, error: 'расход не найден' });
+    if (!r.changes) return res.status(404).json({ ok: false, error: 'расход не найден или ведётся во вкладке «Связь»' });
```

`POST /expenses` берёт колонки из списка `COLS`, в котором `source` нет — вручную строку `source='sim'` создать нельзя.

### 6.5 Строка в поездке (`compute()`)

Сейчас ручной расход попадает в поездку, только если `spent_on` в окне поездки (сверка с выпиской ±3 дня). eSIM
покупают заранее, поэтому для строк `source='sim'` окно шире и сверка с выпиской как у страховки:

```diff
-      for (const e of manual) if (inWin(e.spent_on)) items.push(item({ kind: 'manual', id: e.id, cat: CATS[e.category] ? e.category : 'other',
-        title: e.title || CATS[e.category] || 'Расход', note: e.note || '', amount: e.amount, currency: e.currency,
-        amount_local: e.amount_local, currency_local: e.currency_local }, e.spent_on, 3, 3));
+      for (const e of manual) {
+        // Строка SIM: в поездку — по той же привязке, что бейдж (страна маршрута + окно −30 дней),
+        // сверка с выпиской на 60 дней назад, как у полиса. Ручные — как было.
+        const isSim = e.source === 'sim';
+        if (isSim ? !simTrip.get(e.source_id) || simTrip.get(e.source_id) !== J : !inWin(e.spent_on)) continue;
+        items.push(item({ kind: 'manual', id: e.id, source: e.source || null, cat: CATS[e.category] ? e.category : 'other',
+          title: e.title || CATS[e.category] || 'Расход', note: e.note || '', amount: e.amount, currency: e.currency,
+          amount_local: e.amount_local, currency_local: e.currency_local }, e.spent_on, isSim ? 60 : 3, isSim ? 1 : 3));
+      }
```

Здесь `simTrip` — `Map(simId → J)`, построенная до цикла тем же подбором, что и бейдж (§5.3). Если SIM не подошла
ни к одной поездке, её строка расхода в поездку не попадает. Это честно: трата есть, но к поездке не привязана.

На странице (`trip-journeys.js`, `rowHtml`) у строк с `it.source === 'sim'` кнопок «править/удалить» нет. Вместо них
чип «из „Связи“» (`<button class="jr-chip" data-go="sims">`), тап ведёт на вкладку: `go('sims')`.

```diff
-    const acts = it.kind === 'manual'
+    const acts = it.kind === 'manual' && it.source
+      ? '<div class="jr-acts"><button data-jgo="sims">во вкладке «Связь»</button></div>'
+      : it.kind === 'manual'
```

---

## 7. Напоминания в Telegram (решение 5)

### 7.1 Найденный механизм

Общего планировщика уведомлений для пациентов нет — каждый модуль держит свой `setInterval`. Ближайший образец —
`pauseTick` в `web/habits.js:1754-1796`:
- тик: `setTimeout(tick, 60 000)` + `setInterval(tick, 30 мин)`;
- тихие часы по МСК (10–22);
- выборка по флагу `pinged_at IS NULL`, **метка ставится до отправки**: при сбое повтора не будет;
- адресат: `patient_telegram_links l JOIN patient_accounts a ON a.id=l.account_id WHERE a.profile_id=? AND l.chat_id IS NOT NULL ORDER BY l.consumed_at DESC LIMIT 1`;
- бот `@Ai_dcf_bot`: токен `TELEGRAM_BOT_TOKEN_AI_DCF` из env или из `/home/cashruflow/mcp-server/.env` (`aiDcfToken()`);
- для профиля 1 (владелец) запасной канал `TELEGRAM_BOT_TOKEN_CASHRUFLOW` + `TG_CHAT_ID`;
- отправка — `tgSend()` из `lib/tg.mjs`, который возвращает `null` или строку причины (правило CLAUDE.md).

`aiDcfToken()` уже существует в двух копиях (`habits.js:1755`, `pair.js:360`). Третья копия в `trip.js` —
вынужденная. Вынос в общий модуль (например, `lib/patient_notify.mjs` с функцией
`notifyProfile(medDb, profileId, text, opts)`) — отдельная задача: нужна правка `habits.js` и `pair.js`, в эту не
смешиваю (§10).

### 7.2 Правила отправки

| Событие | Когда | Флаг | Текст |
|---|---|---|---|
| Скоро кончится пакет | `activated_at` есть, срок есть, сейчас ≥ `expires − 24 ч` и < `expires` | `notify_pre_sent_at` | «eSIM Египет 2 ГБ/день истекает завтра в 14:10 (по местному). Продление — до 27.11 19:25.» |
| Пакет кончился | сейчас ≥ `expires` и прошло не больше 12 ч | `notify_end_sent_at` | «eSIM Египет 2 ГБ/день закончилась. Мобильный интернет по ней больше не работает.» |
| Завтра последний день активации | не активирована, `activate_by − 1 = сегодня` (в поясе SIM) | `notify_actby_pre_sent_at` | «eSIM Египет: активировать нужно до завтра, 26.11.» |
| Сегодня последний день активации | не активирована, `activate_by = сегодня` | `notify_actby_sent_at` | «eSIM Египет: сегодня последний день активации.» |

- **Тихие часы — по местному времени SIM** (`tz`), а не по МСК: человек в Египте. Отправляем с 09:00 до 22:00 местного.
  Исключение — «пакет кончился»: он и так ждёт утра, если истёк ночью; окно 12 ч гарантирует, что утром он ещё уйдёт.
- **Против повторов:** флаг ставится ДО `tgSend` (как `pinged_at`). При смене сроков (`SIM_WHEN` в `simBody`) флаги
  сбрасываются — продлённая или перезаведённая SIM напомнит заново.
- **Против лавины при первом выкате:** «кончилась» — только если прошло ≤ 12 ч; «скоро кончится» — только пока не
  кончилась; события «активировать до» — только в сам день. Старые SIM молчат.
- **Ошибка отправки** (`tgSend` вернул строку или у профиля нет привязанного Telegram) пишется в `notify_error` и в
  `console.error`. Флаг остаётся — ретраев нет, как у пауз. На странице у SIM видно «напоминание не ушло: <причина>».

### 7.3 Код тика (trip.js, в конце `mountTrip`)

```js
  // ---------- напоминания о сроках SIM (28.09.2026, ADR-233) ----------
  // Образец — pauseTick в habits.js: тик 30 минут, метка ДО отправки, адресат из patient_telegram_links,
  // бот @Ai_dcf_bot. Тихие часы — по местному времени SIM: человек в Египте, а не в Москве.
  let AI_DCF_TOKEN = null;   // третья копия (habits.js, pair.js) — вынос в общий модуль отдельной задачей
  const aiDcfToken = () => {
    if (AI_DCF_TOKEN != null) return AI_DCF_TOKEN;
    AI_DCF_TOKEN = (process.env.TELEGRAM_BOT_TOKEN_AI_DCF || '').trim();
    if (!AI_DCF_TOKEN) {
      try {
        const line = fs.readFileSync('/home/cashruflow/mcp-server/.env', 'utf8').split('\n').find(l => l.startsWith('TELEGRAM_BOT_TOKEN_AI_DCF='));
        AI_DCF_TOKEN = line ? line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
      } catch (e) { AI_DCF_TOKEN = ''; }
    }
    return AI_DCF_TOKEN;
  };
  async function sendToProfile(profileId, text) {
    const link = medDb.prepare(`SELECT l.chat_id FROM patient_telegram_links l JOIN patient_accounts a ON a.id=l.account_id
      WHERE a.profile_id=? AND l.chat_id IS NOT NULL ORDER BY l.consumed_at DESC LIMIT 1`).get(profileId);
    if (link && aiDcfToken()) return tgSend(aiDcfToken(), link.chat_id, text, { buttons: [[{ text: 'Открыть «Связь»', url: 'https://ai.cashruflow.ru/trip/app' }]] });
    if (profileId === 1 && process.env.TELEGRAM_BOT_TOKEN_CASHRUFLOW && process.env.TG_CHAT_ID)
      return tgSend(process.env.TELEGRAM_BOT_TOKEN_CASHRUFLOW.trim(), process.env.TG_CHAT_ID.trim(), text);
    return 'нет привязанного Telegram у профиля ' + profileId;
  }
  let simTickBusy = false;
  async function simTick() {
    if (simTickBusy) return;
    simTickBusy = true;
    try {
      const now = Date.now();
      // Кандидаты: не истёкшие давно. Точные условия — в JS: сроки считаются в поясе SIM.
      const rows = medDb.prepare(`SELECT * FROM trip_sims WHERE
        (activated_at IS NOT NULL AND days > 0 AND (notify_pre_sent_at IS NULL OR notify_end_sent_at IS NULL))
        OR (activated_at IS NULL AND activate_by IS NOT NULL AND (notify_actby_pre_sent_at IS NULL OR notify_actby_sent_at IS NULL))`).all();
      for (const s of rows) {
        const tz = simTz(s);
        const hour = +new Date(now).toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false });
        const day = new Date(now).toLocaleDateString('sv-SE', { timeZone: tz });
        const name = (SIM_KIND_RU[s.kind] || 'eSIM') + ' ' + simLabel(s);
        const exp = simExpiresMs(s);
        let flag = null, text = null;
        if (exp != null) {
          const hm = utcToMoment(exp, tz).slice(11, 16);
          if (!s.notify_end_sent_at && now >= exp && now - exp <= 12 * 3600e3 && hour >= 9 && hour < 22) {
            flag = 'notify_end_sent_at'; text = name + ' закончилась. Мобильный интернет по ней больше не работает.';
            // «скоро кончится» после «кончилась» уже не нужно — гасим оба
            if (!s.notify_pre_sent_at) medDb.prepare(`UPDATE trip_sims SET notify_pre_sent_at=datetime('now') WHERE id=?`).run(s.id);
          } else if (!s.notify_pre_sent_at && now < exp && exp - now <= 24 * 3600e3 && hour >= 9 && hour < 22) {
            flag = 'notify_pre_sent_at';
            text = name + ' истекает ' + (utcToMoment(exp, tz).slice(0, 10) === day ? 'сегодня' : 'завтра') + ' в ' + hm + ' (по местному).'
              + (s.extend_until ? ' Продлить можно до ' + RU_DT(s.extend_until) + '.' : '');
          }
        } else if (!s.activated_at && s.activate_by && hour >= 9 && hour < 22) {
          if (!s.notify_actby_sent_at && s.activate_by === day) {
            flag = 'notify_actby_sent_at'; text = name + ': сегодня последний день, когда её можно активировать.';
            if (!s.notify_actby_pre_sent_at) medDb.prepare(`UPDATE trip_sims SET notify_actby_pre_sent_at=datetime('now') WHERE id=?`).run(s.id);
          } else if (!s.notify_actby_pre_sent_at && addDays(s.activate_by, -1) === day) {
            flag = 'notify_actby_pre_sent_at'; text = name + ': активировать нужно до завтра, ' + RU_D(s.activate_by) + '.';
          }
        }
        if (!flag) continue;
        // Метка ДО отправки — повторного сообщения не будет даже при сбое (как pinged_at у пауз).
        medDb.prepare(`UPDATE trip_sims SET ${flag}=datetime('now'), notify_error=NULL WHERE id=?`).run(s.id);
        const err = await sendToProfile(s.profile_id, text);
        if (err) {
          medDb.prepare('UPDATE trip_sims SET notify_error=? WHERE id=?').run(String(err).slice(0, 300), s.id);
          console.error('[trip] напоминание SIM #' + s.id + ':', err);
        }
      }
    } catch (e) { console.error('[trip] simTick:', e.message); }
    finally { simTickBusy = false; }
  }
  setTimeout(simTick, 90 * 1000);
  setInterval(simTick, 30 * 60 * 1000);
```

`RU_D` / `RU_DT` — форматирование «26.11» и «27.11 19:25» (две строки, рядом с тиком). `fs` и `tgSend` в `trip.js`:
`fs` импортирован (стр. 40), `tgSend` — добавить `import { tgSend } from '../lib/tg.mjs';` в шапку.

Флаг `simTickBusy` — чтобы медленный `tgSend` (таймаут 15 с на сообщение) не наложил два тика друг на друга.
Флаги отправки держат корректность и без него, это страховка.

---

## 8. План правок по файлам

| # | Файл | Правка | Рестарт |
|---|---|---|---|
| 1 | `web/trip.js` | `import { tgSend }`; `VIA_TABLES` + `trip_sims`; таблица и индексы в `ensureTripTables`; `SIM_PROMPT`; `DLR`, `lpaParse/lpaBuild/iccidNorm/phoneNorm/dataMb/speedKbps/curCode/normMoment`; `momentToUtc/utcToMoment/simTz/simExpiresMs/simState/simLabel/SIM_KIND_RU`; `SIM_KEY/simSeal/simOpen`; `takeFiles/simTwin/simBody/simView/syncSimExpense`; ручки `/sims` ×4, `/sims/:id/secret`, `/sim-scan`; `simTick`; deps `mountTripJourneys` | `pm2 restart web-interface` |
| 2 | `web/trip_journeys.js` | миграция `trip_expenses.source/source_id` + уникальный индекс; `CATS.comm`; `BANK_CAT.comm`; защита PATCH/DELETE `/expenses` для строк с `source`; `compute()`: `source` в пункте, особое окно для строк SIM, `sims` в поездке | да |
| 3 | `web/server.js` | `RAW_BODY_RE` → `(scan\|sim-scan)`; `ICONS_V` +1 | да |
| 4 | `/home/cashruflow/mcp-server/.env` | `TRIP_SIM_KEY=<32 байта base64>` — **вносит Константин сам**; до этого модуль работает без сохранения кодов | рестарт web-interface |
| 5 | `web/public/trip.html` | вкладка «Связь», `go()`, `paintSims` с переключателем SIM/eSIM, `simKindSet`, раскрытие кода + QR, `bindSimScan` + `simQrFromFiles`, CSS `.sim-ico/.sim-qr`; `?v=` у `trip-pass.js` и `trip-journeys.js` | статика |
| 6 | `web/public/trip-pass.js` | экспорт `loadQrLib` | статика |
| 7 | `web/public/trip-journeys.js` | `CAT_COLOR.comm`; бейдж SIM в `cardHtml`; в `rowHtml` у строк `source` вместо «править/удалить» ссылка во вкладку | статика |
| 8 | `web/public/assets/icons.svg` | `i-sim`, `i-esim` | через `ICONS_V` |
| 9 | `web/integrations.js` (по желанию) | `keyCard(... 'TRIP_SIM_KEY' ...)` | да |
| 10 | `docs/ADR/ADR-233-trip-sims.md` | §9, затем `node scripts/migrate-ard.js` и `node scripts/validate-ard.js` | — |
| 11 | `docs/CHANGELOG.md`, VERSION модуля trip | запись; версию платформы не поднимать без просьбы | — |

Порядок выката и проверка:
1. Пункты 1–3, затем `node --check web/trip.js web/trip_journeys.js web/server.js`, рестарт, смотреть `↺` в pm2.
2. `get_api GET /api/profile/me/trip/sims` → `key_ok:false`, пустой список. Сервер жив без ключа — это проверка
   деградации.
3. Константин добавляет `TRIP_SIM_KEY`, рестарт → `key_ok:true`.
4. Прогон текста Trip.com из задания. Ожидаемо: `kind:'esim'`, «Египет», daily, 2048 МБ, 512 кбит/с, 3 дня, rolling24,
   `smdp.io`, ICCID `8948010010094791430` (Luhn true), заказ `1539367401113525`, `activate_by` 2026-11-26,
   `extend_until` 2026-11-27 19:25:38, 1 использование, 339.80 RUB, база 357.69, скидка 17.89, Trip Coins, Trip.com.
5. Сохранить → в `GET /trip/journeys` у подходящей поездки строка «Связь 340 ₽», в `trip_sims.expense_id` — id строки.
6. Повторить импорт → `dup_id`, при сохранении `merged:true`, строк расхода по-прежнему одна.
7. Поменять цену → сумма в строке расхода та же, что в SIM. Удалить SIM → строки нет.
8. Физическая SIM руками (Vodafone, номер, ICCID, 500 EGP) → нет поля кода, бейдж «SIM: …».
9. Напоминание: тестовой SIM проставить `activated_at` так, чтобы до окончания было меньше 24 ч, в дневное местное
   время → одно сообщение в Telegram, `notify_pre_sent_at` заполнен; следующий тик ничего не шлёт.

Правила CLAUDE.md, которые правка соблюдает:
- знак доллара в строках — только через `DLR`, чтобы `str_replace` не развернул пару «доллар + апостроф»; после каждой
  правки перечитывать изменённый кусок;
- `r.ok` проверяется перед данными ответа (так в `bindSimScan` и `send`);
- у кнопок нет своих стилей, скрытие через `hidden`, переключатель — пара `.btn`/`.tbtn`;
- ключ дня собирается локальными полями, момент — `sv-SE` в поясе;
- приватные данные: замок + «Показать/Скрыть», разовый показ в хранилище не пишется;
- INSERT/UPDATE с длинным списком колонок — через объект и `Object.keys`;
- Telegram — только через `tgSend`, отказ записывается (`notify_error`), а не глотается.

---

## 9. Черновик ADR-233

```markdown
---
id: ADR-233
title: «Связь» в «Путешествиях» — SIM и eSIM, распознавание заказа, код активации своим ключом, траты строкой расхода, напоминания в Telegram
status: proposed
date: 2026-09-28
domain: platform
depends_on: [ADR-201, ADR-204, ADR-222]
related: [ADR-158]
---

# ADR-233: «Связь» (SIM / eSIM) в «Путешествиях» (28.09.2026)

## Контекст
Купленная для поездки сим-карта — физическая или eSIM — это документ поездки, как полис: тариф,
срок, цена, данные установки. Срок eSIM считается часами от активации (3 дня = 72 ч), код установки
(LPA) — секрет, а о конце пакета человек узнаёт, когда пропал интернет.

## Решение
1. Таблица `trip_sims` (med.sqlite, владелец схемы — trip.js), `kind: 'sim' | 'esim'`, вкладка «Связь».
   У физической SIM нет LPA/SM-DP+/QR, есть номер линии.
2. Статус и окончание не хранятся — считает сервер (`simState`) в поясе страны.
3. Распознавание — `POST …/trip/sim-scan`: файл, до 5 файлов или текст, общий конвейер сканов раздела;
   мимо глобального express.json (RAW_BODY_RE). QR со скрина читает браузер (BarcodeDetector),
   где его нет — строку LPA вставляют текстом. Новых зависимостей нет.
4. Код активации — AES-256-GCM ключом `TRIP_SIM_KEY` из окружения (не ключ сейфа доступов). Нет
   ключа — сервер работает, код не сохраняется и об этом говорится пользователю; открытым текстом
   код не пишется никогда.
5. Деньги — строка `trip_expenses` (`category='comm'` «Связь», `source='sim'`, `source_id`),
   `trip_sims.expense_id`. Владелец — SIM: сумма синхронизируется при правке, строка удаляется с SIM,
   в шторке расходов она только для чтения. Одна SIM — одна строка (уникальный индекс).
   Оплата баллами (Trip Coins) — тоже трата, способ оплаты — атрибут.
6. Повторный импорт склеивается по номеру заказа / ICCID (частичные уникальные индексы).
7. Напоминания в Telegram (@Ai_dcf_bot, как паузы привычек): за сутки до конца пакета, в момент конца,
   накануне и в день «активировать до». Флаги `notify_*_sent_at`, метка до отправки, сброс при смене
   сроков, тихие часы по местному времени SIM.

## Последствия
+ Срок и «осталось N ч» видны, конец пакета не застаёт врасплох; траты на связь — своя категория.
+ Повторная загрузка заказа не плодит ни записей, ни расходов.
− Строки расходов впервые получают владельца: правило «строку с source правит только владелец»
  придётся соблюдать и будущим источникам.
− Потеря TRIP_SIM_KEY = потеря сохранённых кодов (их надо будет вставить заново).
− Третья копия aiDcfToken() — нужен общий модуль уведомлений пациенту.

## Отвергнуто
- Производный пункт в compute() без строки расхода (как у полиса) — пользователь выбрал строку.
- Ключ сейфа доступов — одна утечка/смена задевала бы оба контура.
- jsQR и другие декодеры — новая зависимость ради редкого случая.
```

---

---

# ЧАСТЬ II. Второй круг решений (28.09.2026)

Эта часть **дополняет и местами заменяет** §2–§8. Где сказано «заменяет» — действует текст отсюда.

## 11. Привязка к поездке и блок «Вне поездок» (решение 2.1)

### 11.1 Когда трата оказывается вне поездок

Поездка собирается на лету из билетов (`buildJourneys`). Поэтому строка расхода SIM или регистрации телефона может
не найти поездку. Бывает четыре случая, у каждого свой код причины (`reason`):

| reason | Когда | Подпись в блоке |
|---|---|---|
| `before_window` | поездка в эту страну есть, но покупка раньше окна: больше 30 дней до вылета | «куплена за N дней до поездки в Египет — привяжите вручную» |
| `no_trip` | поездок с этой страной нет: билеты ещё не заведены или поездку отменили и билеты удалили | «поездки в Египет не нашлось — заведите билеты или привяжите вручную» |
| `region` | региональная eSIM («Европа, 33 страны»): страны нет, сверять не с чем | «региональная — выберите поездку вручную» |
| `manual_none` | пользователь сам отметил «не относится ни к одной поездке» | «не относится к поездкам» (кнопка «вернуть») |

Если привязанная вручную поездка перестала существовать (удалили первый билет), привязка считается битой:
`reason = 'lost_trip'`, подпись «поездка, к которой была привязана, удалена».

### 11.2 Как хранится привязка (заменяет подбор из §5.3 и §6.5)

У поездки нет своего id, а её ключ `start:f123` меняется, если поправить дату. Поэтому привязка идёт **к плечу
поездки**: `trip_leg = 'f123'` (рейс) или `'r45'` (наземный билет). Поездка — та, в которую входит это плечо. Так
привязка переживает правку дат и добавление стыковок.

Колонки в `trip_sims` и в новой `trip_imei_regs` (§15):

```js
    trip_leg TEXT,                          -- 'f<id>' | 'r<id>' | 'none' (вне поездок осознанно) | NULL (авто)
    trip_manual INTEGER NOT NULL DEFAULT 0  -- 1 — задано человеком, автоподбор не трогает
```

(Для уже созданной `trip_sims` — через `PRAGMA table_info` + `ALTER TABLE ADD COLUMN`, как требует CLAUDE.md.)

Правило в `compute()` (`trip_journeys.js`) — одна функция на бейдж, строку расхода и блок «Вне поездок»:

```js
  // Куда относится запись SIM/регистрации (28.09.2026, ADR-233). Ручная привязка главнее:
  //   trip_manual=1 и trip_leg='none'  → вне поездок (manual_none);
  //   trip_manual=1 и trip_leg='f12'   → поездка, в которой есть это плечо (нет такой → lost_trip);
  //   иначе автоподбор: страна записи = страна точки маршрута, дата в [начало − 30 дн., конец].
  function placeOf(rec, journeys, dateOf) {
    if (rec.trip_manual) {
      if (rec.trip_leg === 'none') return { J: null, reason: 'manual_none' };
      const J = journeys.find(J => J.legs.some(L => L.type[0] + L.id === rec.trip_leg));
      return J ? { J, reason: null } : { J: null, reason: 'lost_trip' };
    }
    if (!rec.country) return { J: null, reason: 'region' };
    const d = dateOf(rec), c = norm(rec.country);
    const same = journeys.filter(J => J.legs.some(L => norm(L.to.country) === c || norm(L.from.country) === c));
    if (!same.length) return { J: null, reason: 'no_trip' };
    const J = isDate(d) && same.find(J => d <= J.end && dnum(J.start) - dnum(d) <= 30);
    return J ? { J, reason: null } : { J: null, reason: 'before_window', days_before: isDate(d)
      ? Math.min(...same.filter(J => d < J.start).map(J => dnum(J.start) - dnum(d))) : null };
  }
```

Ответ `GET …/trip/journeys` получает поле `outside` — строки `trip_expenses` с `source IN ('sim','imei_reg')`,
которые не попали ни в одну поездку:

```js
  outside: [{ expense_id, source, source_id, title, amount, currency, spent_on, country, reason, days_before }]
```

### 11.3 Ручная привязка

- Ручка — обычный `PATCH /sims/:id` (или `/imei-regs/:id`) с `{ trip_leg: 'f123' }` → сервер ставит `trip_manual=1`.
  `{ trip_leg: 'none' }` — «не относится». `{ trip_leg: null }` — вернуть автоподбор (`trip_manual=0`).
- Проверка на сервере: плечо `f<id>` / `r<id>` должно принадлежать этому профилю (`SELECT 1 FROM trip_flights|trip_rides
  WHERE id=? AND profile_id=?`), иначе 400.
- Страница (`trip-journeys.js`): под списком поездок блок **«Вне поездок»** — показывается, только если `outside` не
  пуст. В каждой строке причина и кнопка **«Привязать к поездке»**. Кнопка открывает шторку `.mdl-*` со списком поездок
  (маршрут и даты из того же `DATA.journeys`; значение — `legs[0]` поездки) и пунктом «Не относится ни к одной».
  После выбора — `PATCH`, затем `paintJourneys()`.
- На карточке SIM во вкладке «Связь» — строка «Поездка: Москва → Хургада · 01.10–08.10 (вручную)» и та же кнопка
  «Изменить поездку».

## 12. Справочник операторов (решение 2.2)

### 12.1 Почему не `/refs`, а справочник раздела

Порталные справочники `/refs` (`dict_items`, `/api/dict/:key`) закрыты админским паролем (`pauth`), а «Путешествия»
работают под сессией пользователя. Это прямо записано в шапке `trip.js` (стр. 11–14). Поэтому общие списки раздела
живут своими таблицами в `med.sqlite` по одному образцу: `trip_vendors` (площадки), `trip_currencies`,
`trip_airports`, `trip_airlines`. Правила образца (`trip.js:3543–3596`, ADR-204):
- читают все;
- **завести новую строку может любой пользователь** (`source='user'`);
- править и удалять — только админ (`isAdmin(req)` — кука `ppass`);
- удаление запрещено, если строка где-то используется (`in_use`, 409);
- на странице это вкладка панели «Справочники» под шестерёнкой (`paintGear`, `trip.html:3725`, массив вкладок
  стр. 3747).

Операторы и сведения о странах сделаны так же.

### 12.2 Таблицы (в `ensureTripTables`)

```js
  // Операторы связи по странам (28.09.2026, ADR-233) — общий справочник, как trip_vendors:
  // заводит любой, правит и удаляет админ. APN по умолчанию подставляется в форму SIM.
  // Сида НЕТ намеренно: названия сетей и APN меняются, а выдуманный APN хуже пустого.
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT NOT NULL,
    name TEXT NOT NULL,
    network TEXT,              -- 4G / 5G / «4G, 5G»
    apn TEXT,                  -- APN по умолчанию
    site TEXT,
    aliases TEXT,              -- как оператора пишут в заказах: «Vodafone EG|Vodafone Egypt»
    sort INTEGER DEFAULT 100,
    source TEXT DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_operators ON trip_operators(country, name)`);

  // Связь по странам: нужна ли регистрация телефона (IMEI) и чем она кончается. Поле ЗАПОЛНЯЕТСЯ
  // РУКАМИ: правила стран меняются, и платформа их фактом не утверждает — 'unknown' по умолчанию.
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_sim_countries (
    country TEXT PRIMARY KEY,
    imei_reg TEXT NOT NULL DEFAULT 'unknown',  -- 'unknown' | 'yes' | 'no'
    imei_reg_note TEXT,                        -- свободный текст: «без регистрации N дней», где оформляют
    imei_reg_url TEXT,
    checked_on TEXT,                           -- когда сведения проверяли (YYYY-MM-DD)
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
```

В `trip_sims` добавляется `operator_id INTEGER`. Имя оператора по-прежнему лежит в `operator` (как `booked_via` у
площадок): список показывается без join, а переименование в справочнике переписывает имя в записях — тем же
приёмом, что `trip_vendors` (стр. 3569).

### 12.3 API (по образцу `/vendors`)

| Метод | Путь | Доступ |
|---|---|---|
| GET | `/operators?country=Египет` | все; `can_edit: isAdmin(req)` |
| POST | `/operators` без `id` — новая строка | любой; дубль (страна+имя или синоним) → 409 `exists` с каноническим именем |
| POST | `/operators` с `id` — правка | только админ; переименование переписывает `trip_sims.operator` |
| DELETE | `/operators/:id` | только админ; 409 `in_use`, если на него ссылаются SIM |
| GET | `/sim-countries` / `/sim-countries/:country` | все |
| PUT | `/sim-countries/:country` | только админ: `imei_reg`, `note`, `url`, `checked_on` |

Распознавание: `operatorResolve(country, text)` — сравнение по `name` и `aliases` в пределах страны через тот же
`vendorKey()`. Незнакомого оператора скан **не заводит** (как `vendorResolve(..., false)`): текст ложится в форму,
завести его в справочник предлагает сама форма.

### 12.4 Форма SIM

- «Оператор» — `<select id="sm-op" data-pick>`, варианты — операторы страны записи. Список перестраивается при
  смене страны и после распознавания. Последний пункт — **«+ Новый оператор…»**.
- «+ Новый оператор…» открывает маленькую шторку `.mdl-*` (z-index выше формы — правило CLAUDE.md) с полями
  «Название, Сеть, APN, Сайт». Страна подставлена из формы. Сохранение: `POST /operators` → в `select` добавляется
  строка, она же выбирается.
- Выбор оператора подставляет `APN`, если поле пустое **или** в нём APN предыдущего выбранного оператора. Набранный
  руками APN не затирается: помним `data-auto-apn` на поле.
- Под полем страны — строка из `trip_sim_countries`:
  - `imei_reg='yes'` → «Для этой страны в справочнике отмечено: телефон нужно регистрировать. <note> · проверено <дата>»
    и кнопка «Добавить регистрацию» (§15);
  - `unknown` → ничего;
  - `no` → ничего.
- Правило CLAUDE.md «новый `select` — подключи `/pick.js` и поставь `data-pick`»: проверить подключение `/pick.js`
  на `trip.html` до выката.

## 13. Чек-лист поездки (решение 2.3)

### 13.1 Как устроено сейчас (прочитано)

- `trip_checklist_template` (`trip.js:1498`) — **один шаблон на платформу**, правит только супер-админ
  (`isAdmin`, ручки `…/checklist-template`, стр. 2752–2801).
- Сид `CHECKLIST_SEED` (стр. 907) заливается **только в пустую таблицу** (стр. 1542–1551). Поэтому правка массива в
  коде на уже работающий сервер НЕ попадёт — там шаблон не пуст.
- `trip_checklists` (стр. 1512) — чек-лист пользователя, к поездке привязан через `move_key` (ключ переезда из
  `/trip/moves`, `m…`/`f…`/`c…`), а не через ключ поездки из `/journeys`.
- `trip_checklist_items` (стр. 1527) — пункты **копируются** из шаблона при создании чек-листа (`origin='tpl'`,
  `tpl_id`). Правка шаблона задним числом чек-листы не меняет — так задумано (стр. 1522–1524): сводка «что чаще
  забываю» считается по `tpl_id`.

### 13.2 Новые стандартные пункты — куда и как

1. **В код — в `CHECKLIST_SEED`** группы «Деньги и связь» (для будущих чистых установок):
   `'Проверить именную карту UnionPay'`, `'Пополнить баланс карты'`,
   `'Взять наличные (не более 10 000 $ без декларации на таможне)'`.
   Формулировка — ровно как у Константина. Порог — его текст; сам ввоз наличных платформа не проверяет и не
   утверждает.
2. **В работающий шаблон — разовой миграцией**. Сид туда не попадёт, а `INSERT … WHERE NOT EXISTS` на каждом старте
   вернул бы пункт, который админ потом удалил. Поэтому:
   - завести маленькую таблицу-флажок `trip_meta(key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)` в `med.sqlite`
     (образец — `settings` + `migr_rs_page_v1` в `rs_expenses.js:296–304`, но `settings` живёт в `tasks.db`, а
     `ensureTripTables` получает только `medDb`);
   - миграция `migr_trip_checklist_v2`: если флага нет — вставить три пункта в группу «Деньги и связь» с `sort`
     сразу после «Карты и наличные» (сдвинуть хвост группы `sort+3`); если пункт с таким текстом уже есть — не
     вставлять; поставить флаг.
   - В той же миграции пометить пункт «SIM или eSIM»: новая колонка `trip_checklist_template.auto_key TEXT`,
     `UPDATE … SET auto_key='sim' WHERE text='SIM или eSIM'`. Если админ этот текст переименовал, пометку ставят
     руками в шаблоне (поле «авто» в правке шаблона, только админ).
3. **Уже созданные чек-листы.** Существующее правило раздела — копии шаблона не меняются задним числом. Его
   сохраняем, но даём явное действие:
   - новые пункты в старые чек-листы **сами не добавляются**;
   - в открытом чек-листе, если в шаблоне есть активные пункты, которых в нём нет, — плашка «В шаблоне появилось
     N новых пунктов» и кнопка **«Добавить»**;
   - `POST /checklists/:id/sync-template` копирует недостающие активные пункты (`origin='tpl'`, `tpl_id`,
     бесплатно — это не «свой пункт» за токены). Ничего не удаляет и не переименовывает;
   - ручка идемпотентна: ищет по `tpl_id`.

### 13.3 Автоотметка «SIM или eSIM»

- Колонка `trip_checklist_items.auto INTEGER NOT NULL DEFAULT 0`:
  - `1` — отметку поставил автомат;
  - `-1` — пользователь снял автоотметку, больше не трогать.
- Функция `autoCheckSim(profileId)` (trip.js):
  1. Берёт чек-листы профиля с `move_key` и их пункты, чей шаблон `auto_key='sim'` (join по `tpl_id`).
  2. По `move_key` находит переезд. Используются существующие `moveKey()` и `asMove()` из ручки `/trip/moves`: страна и
     дата стороны «куда». Сигнатуры `asMove` я не дочитывал — сверить.
  3. Есть SIM профиля (любой `kind`, не `expired` с `never_activated`), которая стоит в той же поездке (плечо
     переезда `flight_id`/`ride_id` входит в поездку записи — по `placeOf` из §11.2) или совпадает страна и
     дата — окно −30 дней … дата переезда:
     - пункт `done=0, auto=0` → `done=1, done_at=now, auto=1`;
     - SIM нет, а пункт `auto=1` → снять (`done=0, auto=0`): отметку ставил автомат, он же её и забирает.
  4. Пункт, который человек отметил руками (`auto=0, done=1`), автомат не трогает никогда.
- Вызовы:
  - после `POST`/`PATCH`/`DELETE /sims` (в той же транзакции);
  - лениво в `GET /checklists` и `GET /checklists/:id`: SIM могла появиться до того, как чек-лист привязали к переезду.
- `PATCH …/items/:itemId` с `done:false` по пункту с `auto=1` → `auto=-1`.
- Чек-лист без `move_key` не автоотмечается. Страница пишет под пунктом: «Привяжите поездку — отметится само, когда
  будет SIM».
- Строка пункта с `auto=1` — подпись «отмечено автоматически: eSIM Египет 2 ГБ/день».

## 14. Маски ICCID и номера, «глаз» (решение 2.5)

- В списках сервер отдаёт только маски:
  - `iccid_masked: '8948 **** **** 1430'` — первые 4 и последние 4 цифры, группы по 4;
  - `phone_masked: '+20 *** *** 78'` — код страны и последние 2 цифры.
  Полные значения в `GET /sims` не приходят (заменяет `iccid_masked` «···1430» из §4.3).
- Показ целиком — `GET /sims/:id/reveal?f=iccid|phone`, по нажатию. Для eSIM-кода остаётся `/sims/:id/secret` (§4).
- Где хранится:
  - ICCID и номер — открытым текстом: нужны для склейки повторного импорта и ссылки на баланс;
  - IMEI и EID — шифром (§15).
- UI: рядом со значением `<button class="ibtn" data-eye="iccid:12" aria-label="Показать целиком">` со значком
  `i-eye`; после показа — `i-eye-off`, повторный тап снова прячет. Показанное значение живёт только в DOM до
  перерисовки, в `localStorage` не пишется.
  Правило CLAUDE.md про приватное («замок + пара кнопок „Показать/Скрыть“») относится к закрытому блоку данных —
  так закрыт код eSIM (§5). Для одиночного поля в строке «глаз» — просьба Константина, противоречия нет.

```js
// Маска для чисел: первые 4 и последние 4 цифры, середина звёздами группами по 4.
// Без replace со ссылкой на группу: пара «доллар+цифра» ломает str_replace (CLAUDE.md).
export function maskDigits(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (d.length <= 8) return d ? '*'.repeat(Math.max(0, d.length - 2)) + d.slice(-2) : '';
  const mid = ('*'.repeat(d.length - 8).match(/.{1,4}/g) || []).join(' ');
  return d.slice(0, 4) + ' ' + mid + ' ' + d.slice(-4);
}
```

`phone_masked` — `'+' + код страны (первые 1–3 цифры по E.164 не определить без справочника) → берём первые 2 цифры`
+ `' *** *** '` + последние 2. Точное разбиение по кодам стран — открытый вопрос §17.

## 15. «Мои устройства» и регистрация телефона в стране (решение 2.6)

### 15.1 Где в интерфейсе

Отдельной вкладки нет: ряд и так 11 кнопок. Раздел «Мои устройства» — верхний блок вкладки «Связь», над SIM:
- карточки устройств (название, модель, IMEI маской с «глазом», значок «eSIM поддерживается» при наличии EID);
- кнопка «+ Устройство»;
- в карточке — регистрации в странах, SIM в этом телефоне и кнопка **«Телефон украли»**.

**Первый вход во вкладку без устройств** — подсказка над формой (закрывается крестиком, флаг в `localStorage` с
try/catch; при ошибке чтения — показываем):

> Браузер не может прочитать IMEI телефона сам. Наберите на телефоне **\*#06#** — появятся IMEI (и EID, если
> телефон умеет eSIM). Сделайте скриншот или скопируйте текст и вставьте сюда — поля заполнятся сами.

и две кнопки: «Скриншот» и «Вставить текст».

### 15.2 Таблица `trip_devices`

```js
  // Мои устройства (28.09.2026, ADR-233). IMEI и EID — идентификаторы телефона: шифром ключом
  // TRIP_SIM_KEY (как код eSIM), в списке — маской. Для склейки дублей — HMAC от IMEI тем же
  // ключом (открытого IMEI в базе нет, а сравнить «этот телефон уже есть» надо).
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    name TEXT,                          -- «Мой iPhone», «Рабочий»
    model TEXT,                         -- iPhone 15 Pro, Galaxy S24
    imei1_enc TEXT, imei1_tail TEXT, imei1_hash TEXT,
    imei2_enc TEXT, imei2_tail TEXT, imei2_hash TEXT,
    eid_enc TEXT, eid_tail TEXT,
    esim_ok INTEGER NOT NULL DEFAULT 0, -- 1 — есть EID (или отмечено руками): телефон умеет eSIM
    meid TEXT,                          -- MEID (14 hex), если показан
    serial TEXT,                        -- серийный номер
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_devices_imei1 ON trip_devices(profile_id, imei1_hash) WHERE imei1_hash IS NOT NULL`);
```

- `trip_sims` получает `device_id INTEGER` — «в каком телефоне». В форме SIM это `select` из устройств. eSIM на
  устройство без `esim_ok` → предупреждение «у этого телефона не указан EID — поддерживает ли он eSIM?».
- `serial` и `meid` хранятся открыто, в списке — маской (§14).

Нормализация (trip.js):

```js
const luhnOk = d => { let t = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const luhnDigit = d14 => { for (let c = 0; c < 10; c++) if (luhnOk(d14 + c)) return String(c); return null; };
// IMEI: 15 цифр с верной контрольной по Луну. *#06# на части телефонов показывает IMEISV (16 цифр,
// «35 123456 789012 3 / 01») — у него контрольной нет: берём первые 14 и считаем контрольную сами.
export function imeiNorm(raw) {
  const d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.length === 15) return luhnOk(d) ? { imei: d, ok: true } : { imei: '', ok: false, why: 'контрольная цифра не сходится' };
  if (d.length === 16) return { imei: d.slice(0, 14) + luhnDigit(d.slice(0, 14)), ok: true, from_sv: true };
  return { imei: '', ok: false, why: 'IMEI — 15 цифр' };
}
// EID: 32 цифры, начинается с 89. Контрольные — ISO/IEC 7064 MOD 97-10 (остаток 1).
// Не сошлось — предупреждаем, но не отказываем: вдруг опечатка в нашем знании формата.
export function eidNorm(raw) {
  const d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.length !== 32 || !d.startsWith('89')) return { eid: '', ok: false };
  let r = 0; for (const ch of d) r = (r * 10 + +ch) % 97;
  return { eid: d, ok: r === 1 };
}
const imeiHash = imei => SIM_KEY && imei ? crypto.createHmac('sha256', SIM_KEY).update('imei:' + imei).digest('hex') : null;
```

**Без `TRIP_SIM_KEY`:**
- устройство сохраняется (название, модель, серийный номер), IMEI и EID — нет: ответ `ids_skipped: true`,
  предупреждение на странице;
- уникальность по IMEI без ключа не работает (хэша нет) — тоже в предупреждении.

### 15.3 Распознавание `*#06#` — тот же конвейер

`POST /sim-scan` с `X-Doc-Kind: device` (файл или текст). Промт `DEVICE_PROMPT` — отдельный вид документа, как
`DOC_KINDS` у рейсов:

```js
const DEVICE_PROMPT = `Ты извлекаешь идентификаторы телефона с экрана *#06#, из «Настройки → Об устройстве» или
с коробки телефона. Верни ТОЛЬКО JSON, без markdown:
{"model":"","imei1":"","imei2":"","eid":"","meid":"","serial":""}
Правила:
- imei1, imei2 — IMEI (15 цифр) или IMEISV (16 цифр), только цифры. Если IMEI один — imei2 пустая.
- eid — EID (32 цифры), только цифры; нет — пустая строка. meid — MEID (14 символов 0-9A-F).
- serial — серийный номер как напечатан. model — модель, если видна.
- Чего нет — пустая строка. Не выдумывай. Номер телефона, имя владельца, Apple ID и почту не возвращай.`;
```

- В тексте, вставленном из `*#06#`, IMEI и EID сервер дополнительно ищет регулярками (`\b\d{15,16}\b`, `\b89\d{30}\b`):
  модель может ошибиться в цифре.
- Ответ: `{ device: { model, imei1, imei2, eid, meid, serial, imei1_ok, imei2_ok, eid_ok } }`. IMEI целиком уходит
  только в форму.
- В `ai_generations` IMEI, EID и серийный номер пишутся только хвостом.
- Картинку `*#06#` на iPhone/Android часто сопровождает штрихкод. `BarcodeDetector` (§5.4) пробует и его — форматы
  `code_128` / `ean_13`; найденное 15-значное число проверяется `imeiNorm`.

### 15.4 Регистрация телефона в стране — `trip_imei_regs`

Константин просил не утверждать правила стран фактом. Поэтому:
- таблица только учитывает то, что человек оформил;
- подсказка «нужна ли регистрация» берётся из вручную заполненного `trip_sim_countries.imei_reg` (§12.2).

```js
  // Регистрация телефона (IMEI) в стране: оформил — где, до какого числа, сколько стоило. Правила
  // стран в коде НЕ зашиты. Стоимость — строкой расхода «Связь» (source='imei_reg'), как у SIM.
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_imei_regs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    imei_slot TEXT NOT NULL DEFAULT '1',   -- '1' | '2' | 'both'
    country TEXT NOT NULL,
    reg_on TEXT,                           -- дата регистрации
    valid_until TEXT,                      -- до какого числа действует (включительно); пусто — бессрочно
    price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT,
    paid_with TEXT,
    receipt_url TEXT,                      -- ссылка на квитанцию (только http/https)
    note TEXT,
    trip_leg TEXT, trip_manual INTEGER NOT NULL DEFAULT 0,
    expense_id INTEGER,
    notify_pre_sent_at TEXT, notify_end_sent_at TEXT, notify_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE INDEX IF NOT EXISTS idx_trip_imei_regs_profile ON trip_imei_regs(profile_id, valid_until)`);
```

API: `GET/POST/PATCH/DELETE /imei-regs` — по образцу `/sims`, проверка, что `device_id` принадлежит профилю. Статус
считается на GET: `active` / `expired` / `perpetual`, плюс `days_left`.

**Расход** — тем же механизмом, что у SIM. `syncSimExpense` из §6.3 обобщается до `syncSourceExpense(profileId,
source, id)`:
- таблица и заголовок берутся из карты источников
  `{ sim: ['trip_sims', r => 'eSIM · …'], imei_reg: ['trip_imei_regs', r => 'Регистрация телефона · ' + r.country] }`;
- дата траты у регистрации — `reg_on`;
- уникальный индекс `(profile_id, source, source_id)` из §6.1 покрывает оба источника;
- защита правки в `/expenses` (§6.4) — по `source IS NOT NULL`, отдельной правки не требует.

**Напоминания** — в тот же `simTick` (§7.3), вторая выборка:
- `valid_until − 1 день = сегодня` → `notify_pre_sent_at`: «Регистрация телефона «Мой iPhone» в Узбекистане
  действует до завтра, 12.10.»;
- `valid_until = сегодня` → `notify_end_sent_at`: «Сегодня последний день регистрации…».
- Пояс берётся по стране (`COUNTRY_TZ`), тихие часы 9–22 местного.
- Бессрочная (`valid_until` пусто) — без напоминаний.
- Смена `valid_until` сбрасывает флаги.

### 15.5 «Телефон украли»

Кнопка в карточке устройства (роль `.btn-danger`) → подтверждение `uiConfirm` («Показать все номера телефона и SIM
целиком?») → `GET /devices/:id/theft-sheet`:

```js
  { device: { name, model, imei1, imei2, eid, meid, serial },   // целиком, расшифровано
    sims: [{ kind_ru, operator, operator_site, phone, iccid, booked_via, booking_no, country, status }],  // SIM с device_id этого телефона
    regs: [{ country, reg_on, valid_until }],
    key_ok }                                                     // false → IMEI/EID нет: «не настроен ключ»
```

Шторка «Для заявления»:
- блоки «Телефон» (IMEI 1/2, EID, серийный), «SIM-карты в нём» (номер, ICCID, оператор и ссылка на его сайт —
  заблокировать SIM), «Регистрации»;
- кнопка **«Копировать всё»** — одним текстом для заявления в полицию или оператору.

Что платформа НЕ делает:
- не советует порядок действий как юридический факт;
- не пишет данные никуда, кроме экрана.

Раскрытие журналируется одной строкой `console.log('[trip] theft-sheet profile=… device=…')` без самих номеров — чтобы
было видно, что данные показывались. Нужен ли настоящий журнал — открытый вопрос §17.

## 16. Напоминания: уточнения (решение 2.4)

Изменения к §7:
- Физическая SIM без срока (`days` пусто и `activate_by` пусто) напоминаний не получает: `simExpiresMs` = `null`, а
  ветка «активировать до» требует `activate_by`. Это уже так по коду §7.3. Для ясности выборка кандидатов получает
  явное условие `AND (days > 0 OR activate_by IS NOT NULL)`.
- В тик добавляется выборка `trip_imei_regs` (§15.4).

## 17. План правок — дополнение к §8

| # | Файл | Правка |
|---|---|---|
| 1 | `web/trip.js` | `trip_meta`; `trip_operators`, `trip_sim_countries`, `trip_devices`, `trip_imei_regs`; колонки `trip_sims.trip_leg/trip_manual/operator_id/device_id`; `trip_checklist_template.auto_key`, `trip_checklist_items.auto`; миграция `migr_trip_checklist_v2` (три пункта + `auto_key='sim'`); `CHECKLIST_SEED` + три пункта; `imeiNorm/eidNorm/imeiHash/maskDigits/operatorResolve`; `DEVICE_PROMPT` и `X-Doc-Kind: device` в `/sim-scan`; ручки `/operators`, `/sim-countries`, `/devices` (+ `/reveal`, `/theft-sheet`), `/imei-regs`, `/sims/:id/reveal`, `/checklists/:id/sync-template`; `autoCheckSim`; `syncSourceExpense`; второй цикл в `simTick` |
| 2 | `web/trip_journeys.js` | `placeOf()`; подбор SIM и регистраций по нему; `outside` в `/journeys` |
| 3 | `web/public/trip.html` | блок «Мои устройства» и подсказка `*#06#`; форма устройства и регистрации; «Телефон украли»; `select` оператора по стране + «Новый оператор…» + APN; «глаз» у ICCID/номера/IMEI; вкладки «Операторы» и «Страны: связь» в `paintGear`; плашка «новые пункты шаблона» и подпись автоотметки в чек-листе |
| 4 | `web/public/trip-journeys.js` | блок «Вне поездок», шторка «Привязать к поездке» |
| 5 | `web/public/assets/icons.svg` | + `i-device` (Lucide smartphone); `i-eye`/`i-eye-off` уже есть |

Проверки после выката (дополнение):
1. Устройство из текста `*#06#` с IMEISV (16 цифр) → IMEI 15 цифр, Luhn верный. Без ключа → `ids_skipped`.
2. SIM, купленная за 40 дней до вылета, → «Вне поездок · before_window» → «Привязать» → строка в поездке.
3. Удалили первый билет поездки → `lost_trip`.
4. В старом чек-листе плашка «новых пунктов: 3» → «Добавить» → пункты есть, повтор ничего не добавляет.
5. Чек-лист привязан к переезду в Египет, SIM Египет сохранена → пункт «SIM или eSIM» отмечен (`auto=1`). Снял руками
   → `auto=-1`, следующее сохранение SIM его не трогает.
6. Регистрация с `valid_until` завтра → одно сообщение в Telegram днём по местному времени.

## ADR-233 — дополнение (в тот же черновик)

```markdown
8. Привязка к поездке — по плечу (trip_leg = 'f<id>' | 'r<id>' | 'none'), ручная главнее автоподбора;
   не попавшее в поездки видно блоком «Вне поездок» с причиной.
9. Операторы и сведения о странах — справочники раздела (trip_operators, trip_sim_countries) по образцу
   trip_vendors: заводит любой, правит админ. Нужна ли регистрация телефона — только ручная отметка,
   платформа правила стран не утверждает.
10. Мои устройства (trip_devices): IMEI/EID шифром TRIP_SIM_KEY + HMAC для склейки; распознавание *#06#
    тем же /sim-scan (X-Doc-Kind: device), IMEI по Луну; регистрация телефона в стране (trip_imei_regs)
    с расходом source='imei_reg' и напоминаниями; «Телефон украли» — сводка для заявления.
11. Чек-лист: новые пункты шаблона — разовой миграцией с флагом в trip_meta; в старые чек-листы — только
    кнопкой «Добавить новые пункты»; «SIM или eSIM» отмечается автоматом (auto=1), ручное снятие (auto=-1)
    автомат уважает.
```

---

## Оставшиеся открытые вопросы (после второго круга)

1. **Реф-награда**: считать сохранение SIM или устройства «первой записью» Trip-реферала (`REF_ACTIVITY`)?
2. **Общий модуль уведомлений пациенту**: `aiDcfToken()` будет в трёх местах. Вынести отдельной задачей? Создать её в
   бэклоге — только по команде Константина.
3. **Маска номера телефона**: код страны без справочника E.164 точно не выделить. Брать первые 2 цифры или завести
   маленькую таблицу кодов? В `geo_countries` (ADR-196) коды есть, но он за админским паролем.
4. **Срок напоминания о регистрации IMEI**: за 1 день может быть поздно — оформление бывает небыстрым. Сделать 3 или
   7 дней, или поле «напомнить за N дней»?
5. **«Телефон украли»**: нужен ли настоящий журнал показов (кто и когда раскрыл IMEI) вместо строки в консоли?
6. **Серийный номер и MEID** хранятся открыто (маской в списке). Шифровать ли и их?
7. **Старые чек-листы**: достаточно ли кнопки «Добавить новые пункты», или для чек-листов будущих поездок
   добавлять автоматически при миграции?
8. **Технические проверки до выката** (только чтение, не делал):
   - версия SQLite для `ON CONFLICT … WHERE`;
   - подключение `/pick.js` на `trip.html`;
   - подхватит ли `vendorStats()` `trip_sims`: сейчас список таблиц в нём зашит (`trip.js:3602–3608`) и
     `trip_sims` туда надо дописать руками вместе с подписью в `KIND` (`trip.html:782`);
   - сигнатуры `moveKey()`/`asMove()` для автоотметки чек-листа.
   `medDb.transaction` в разделе уже используется (`trip.js:1463`, 1547, 2617, 3565) — этот вопрос закрыт.
9. **Перевод `/trip/scan` на общий `takeFiles()`** — отдельной правкой после выката.
