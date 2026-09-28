# eSIM в «Путешествиях» (/trip/app) — проект

Статус: ПРЕДЛОЖЕНИЕ. На сервере ничего не менялось (только `read_file`/`search_code`).
Дата: 28.09.2026. Автор: Claude (по задаче Константина).

---

## 0. Коротко

- Раздел «Путешествия» — это `web/trip.js` (сервер, 4862 строки) + `web/trip_journeys.js` (сборка поездок и расходы)
  + `web/public/trip.html` (страница, вкладки) + `web/public/trip-journeys.js` (карточки поездок на «Обзоре»).
  Все таблицы — `trip_*` в `med.sqlite` (`medDb`), API — `/api/profile/:profileId/trip/*` (`me` — своя сессия).
- **Сущности «поездка» в базе нет.** Поездка собирается на лету (`buildJourneys()` в `trip_journeys.js`) из рейсов и
  наземных билетов. Поэтому eSIM — это **своя таблица `trip_esims` + своя вкладка «eSIM»** рядом со «Страховками» и
  «Разрешениями» (тот же образец), а в карточку поездки она попадает при сборке — как страховка и виза.
- **Распознавание у отеля — только файлы** (`POST …/trip/scan`: 1 файл сырыми байтами или до 5 файлов JSON-ом).
  Вставки текста у отеля НЕТ — она есть только у рейсов (`POST …/trip/boarding` с `X-Doc-Kind: text`).
  Предлагаю ручку `POST …/trip/esim-scan`, которая принимает все три входа (файл / несколько файлов / текст) тем же
  конвейером: `sniffMime` → `logUpload` (file_uploads, kind='trip') → `ask()` (Sonnet 4.6 через `AI_BASE`) →
  `parseJson` → белый список полей → `logAiCall` + `logGeneration`. Записи ручка НЕ создаёт.
- **Расходы.** Страховка и разрешение попадают в траты поездки не строкой `trip_expenses`, а как производный
  пункт в `compute()` (`trip_journeys.js:219–227`). Рекомендую для eSIM то же самое: пункт `kind:'esim'`,
  категория новая `comm: 'Связь'` в `CATS`. Дублей нет по построению (одна запись eSIM = один пункт), повторный
  импорт склеивается уникальным индексом по `booking_no`/`iccid`. Вариант «строка в `trip_expenses` + `expense_id`
  + `source='esim'`», как в задании, расписан в §6.2 — он работает, но вводит второй источник суммы.
- Код активации (LPA) — шифруется тем же AES-256-GCM, что сейф доступов (`encSecret`/`decSecret`, `server.js:7806`),
  в списке отдаётся маской, целиком — только отдельной ручкой по кнопке «Показать». PIN брони и контакты
  (имя/телефон/email) не распознаются и не хранятся — как паспорт и PIN у виз (`PERMIT_PROMPT`).
- Нужен ADR: **ADR-233** (последний занятый номер в `docs/ADR/` — ADR-232; сверить перед созданием, номера уже
  дважды сталкивались).

---

## 1. Найденная архитектура (пути и строки)

| Что | Где | Заметки |
|---|---|---|
| Сервер раздела | `/home/cashruflow/web/trip.js` | `export function mountTrip(app, medDb, deps)` — строка 1712 |
| Схема (миграции) | `trip.js`, `export function ensureTripTables(medDb)` — строка 919 | идемпотентно на старте, `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` |
| Монтирование | `/home/cashruflow/web/server.js:15200` | `mountTrip(app, medDb, { profileAuth, pcheck, getPatientAccount, referral, tasksDb: db, logUpload, logAiCall, apiKey, aiBase, whisperKey, openaiBase })` |
| Обход глобального `express.json` | `server.js:249` `RAW_BODY_RE = /^\/api\/profile\/[^/]+\/trip\/scan$/` | без этого многостраничный JSON >100 КБ режется 413 до роута (ADR-204) |
| Резолв профиля | `trip.js:1772` `pid(req,res)` | каждая ручка начинается с него |
| Скан брони отеля | `trip.js:4268` `POST …/trip/scan` | промт `SCAN_PROMPT` (стр. 172), `sniffMime` (80), белый список полей (4349–4368) |
| Скан рейса + ТЕКСТ | `trip.js:4409` `POST …/trip/boarding`, `DOC_KINDS.text` (460–466), `PASTE_MAX = 20000` | единственное место, где уже есть «вставить текст» |
| Общий приём одиночного скана | `trip.js:4601` `takeScan(req,res,title,note)` | у наземки, полиса, визы |
| Скан полиса / визы | `trip.js:4757` `policy-scan`, `4695` `permit-scan` | образец «сканер → форма» |
| Помощники модели | `trip.js:4174` `ask(content,maxTokens)`, `4192` `parseJson`, `4198` `cost(u)`, `4202` `logGeneration(...)`, `4166` `purgeScansLazy` | модель `SCAN_MODEL = 'claude-sonnet-4-6'` |
| Числа/даты | `numAmount()` (530, «357,69», «5 906,59», «5,906.59»), `normDate()` (683), `today()` МСК (696), `dnum/dstr`, `localToUtc(iso,hm,tz)` (645), `tzOffsetMin` (636), `COUNTRY_TZ` (873, Египет → `Africa/Cairo`) | |
| Площадки | `VIA_TABLES` (146), `vendorResolve()` (157), `saveVia(tbl,id,body)` (2181), сид `VENDOR_SEED` уже содержит Trip.com | |
| Страховки (образец CRUD) | таблица `trip_insurance` (1348), `policyBody()` (3925), ручки 3971–4036 | статус считает сервер |
| Разрешения | `trip_permits` (1079), ручки 2248–2294 | url чистится в `saveVia` |
| Чек-лист «Перед путешествием» | `CHECKLIST_SEED` (907) — пункт «SIM или eSIM» в группе «Деньги и связь» | можно отмечать автоматически (открытый вопрос) |
| Поездки и расходы | `/home/cashruflow/web/trip_journeys.js` | `CATS` (35), `BANK_CAT` (42), `trip_expenses` (58), `compute()` (169), `POST/PATCH/DELETE …/expenses` (299–328) |
| Страница | `/home/cashruflow/web/public/trip.html` | вкладки `#tripTabs` (383–399), `go(t)` (747), `paintIns` (1695), `paintPermits` (1809), `bindDocScan` (1932), `bindScan` отеля (3083), `scanFiles/pdfPages` (3047–3079), `shrink` (1329), `send` с защитой от двойного тапа (529) |
| Карточки поездок | `/home/cashruflow/web/public/trip-journeys.js` | `CAT_COLOR` (7) — зашит, категории приходят с сервера (`DATA.cats`) |
| QR-кодер | `/home/cashruflow/web/public/assets/qrcode-gen.js` (qrcode-generator, MIT), загрузчик `loadQrLib()` в `trip-pass.js:233` — наружу НЕ экспортирован (`window.tripPass = { open, render, UTM, utmContent, refUrl }`, стр. 529) | |
| QR-декодера | НЕТ на платформе | чтение QR со скрина — открытый вопрос (§9) |
| Шифрование | `server.js:7802–7823` `ACC_KEY` из `/home/cashruflow/.access_key`, `encSecret(txt)`, `decSecret(blob)` | функции объявлены в server.js, в trip.js не переданы |
| Спрайт значков | `/assets/icons.svg`, адрес `window.ICONS_URL` (`ICONS_V` в server.js, сейчас `?v=8`) | значка SIM нет (есть `i-phone`, `i-phone-call`, `i-globe`) |
| ADR раздела | `docs/ADR/ADR-201-trip-module.md`, `ADR-204-…raw-scan-body.md`, `ADR-222-trip-journeys-expenses.md` | |

Чего нет и что я НЕ выдумываю:
- «Поездки» как таблицы (`trips`, `trip_id`) — нет. Привязка eSIM к поездке — по датам и стране, как у страховок.
- Справочника категорий расходов в `/refs` — нет, это константа `CATS` в `trip_journeys.js`.
- Поля `expense.source` / `trip_expenses.source` — нет (колонки таблицы: id, profile_id, spent_on, category, title,
  amount, currency, amount_local, currency_local, note, created_at, updated_at).
- Текстового ввода у отеля — нет.
- Экспорта `loadQrLib` — нет (нужна одна строка в `trip-pass.js`).

---

## 2. Модель данных

### 2.1 Поля

Обязательное одно из: `country` / `region` / `product` / `booking_no` / `iccid` (иначе 400 `empty`, как
«Укажите страховую или номер полиса»). Остальное — необязательно.

| Колонка | Тип | Пример (Trip.com) | Откуда | Примечание |
|---|---|---|---|---|
| `country` | TEXT | Египет | скан/форма | по-русски, `list="places"` как у страховки |
| `region` | TEXT | — | скан/форма | для региональных планов «Europe 33» |
| `product` | TEXT | Egypt 5G eSIM \| Dual SIM \| QR code | скан | как в документе |
| `plan` | TEXT | QR code-3 days-Daily- 2GB | скан | как в документе |
| `network` | TEXT | 5G | скан | 4G/5G |
| `plan_kind` | TEXT | daily | вычисляется | `daily` (N ГБ в сутки) / `total` (N ГБ на весь срок) / `unlimited` |
| `data_mb` | INTEGER | 2048 | нормализация «2GB» | в сутки для daily, всего для total; 1 ГБ = 1024 МБ |
| `throttle_kbps` | INTEGER | 512 | «после — 512kbps» | скорость после лимита |
| `days` | INTEGER | 3 | «3 days» | |
| `day_mode` | TEXT | rolling24 | «сутки = 24 ч от активации» | `rolling24` / `calendar` (календарные сутки по местному) |
| `sms` / `calls` | INTEGER 0/1 | 0 / 0 | «Не включено: SMS/звонки» | |
| `dual_sim` | INTEGER 0/1 | 1 | «Dual SIM» | |
| `operator` | TEXT | — (Vodafone EG / Orange / Etisalat / WE) | скан или руками | сеть в стране часто неизвестна |
| `operator_src` | TEXT | manual | | `doc` — из документа, `manual` — выбран руками |
| `apn` | TEXT | — | | необязательно |
| `roaming` | INTEGER 0/1 | 1 | по умолчанию 1 | «Включить роуминг данных» — почти все туристические eSIM без него не работают |
| `smdp` | TEXT | smdp.io | разбор LPA | адрес SM-DP+ — не секрет |
| `code_enc` | TEXT | (шифр) | разбор LPA | matching ID `K2-36Y6K0-7CDVXL`, AES-256-GCM |
| `code_tail` | TEXT | CDVXL → «DVXL» | | последние 4 знака для маски «···DVXL» |
| `lpa_oid` | TEXT | — | 4-я часть LPA | редко |
| `confirm_required` | INTEGER 0/1 | 0 | 5-я часть LPA = «1» | нужен код подтверждения от продавца |
| `iccid` | TEXT | 8948010010094791430 | скан | 19–20 цифр, начинается с 89, Luhn — предупреждение, не отказ |
| `balance_url` | TEXT | https://globalesimstore.com/E | скан | только http(s) |
| `booking_no` | TEXT | 1539367401113525 | скан | ключ склейки повторного импорта |
| `order_status` | TEXT | Confirmed | скан | статус брони у площадки (не путать со статусом eSIM) |
| `purchased_on` | TEXT YYYY-MM-DD | | скан/форма | дата покупки — для сверки с выпиской |
| `activate_by` | TEXT YYYY-MM-DD | 2026-11-26 | «действительно до» | крайний срок активации |
| `extend_until` | TEXT YYYY-MM-DD HH:MM:SS | 2026-11-27 19:25:38 | «продление до» | |
| `uses` | INTEGER | 1 | «1 использование» | |
| `installed_on` | TEXT YYYY-MM-DD | | кнопка «Установил» | профиль добавлен в телефон |
| `activated_at` | TEXT YYYY-MM-DD HH:MM:SS | | кнопка «Подключилась сейчас» / руками | МЕСТНОЕ время страны в поясе `tz` |
| `tz` | TEXT (IANA) | Africa/Cairo | `COUNTRY_TZ[country]` или руками | нужен для «+ N×24 ч» |
| `price` / `price_currency` | REAL / TEXT | 339.80 / RUB | «итого» | та же пара, что у полиса и визы |
| `price_local` / `price_local_currency` | REAL / TEXT | | вторая валюта, если напечатана | |
| `price_base` | REAL | 357.69 | «базовая» | в валюте `price_currency` |
| `discount` | REAL | 17.89 | «скидка 5%» | процент не храним — считается |
| `paid_with` | TEXT | Trip Coins | «оплачено» | способ оплаты (см. открытый вопрос про баллы) |
| `booked_via` | TEXT | Trip.com | скан → `vendorResolve` | общий справочник `trip_vendors`, `VIA_TABLES` + `trip_esims` |
| `note` | TEXT | Отмена невозможна после использования | скан/форма | одна строка условий |
| `created_at` / `updated_at` | TEXT | | | |

Не храним и не распознаём: PIN брони, имя/телефон/email контакта, номер карты. Модели это запрещено промтом,
и полей под это нет — вторая линия защиты белым списком, как во всех сканах раздела.

Отклонение от общих правил (`docs/rules/data.md`): рубли в модуле хранятся парой `price` + `price_currency`, а не
`*_rub` — так устроены все `trip_*` (мультивалютность, ADR-201/222); eSIM держится модуля, а не общего правила.

### 2.2 Статусы (НЕ хранятся — считает сервер на GET, как `status` у полиса)

| status | Условие | Подпись |
|---|---|---|
| `expired` | `activated_at` есть и сейчас ≥ `expires_at`; ИЛИ не активирована и сегодня > `activate_by` | «истекла» / «не активирована до 26.11.2026» |
| `active` | `activated_at` есть и сейчас < `expires_at` | «активна, осталось 41 ч» |
| `installed` | `installed_on` есть, `activated_at` нет | «установлена» |
| `bought` | остальное | «куплена» |

Окончание:
- `day_mode='rolling24'`: `expires_at = activated_at + days × 24 ч` (считается в UTC через `localToUtc(…, tz)` и
  переводится обратно в местное время — перевод часов учтён тем же `Intl`, что у рейсов). Пример: активация
  `2026-10-02 14:10:00` Каир, 3 дня → `2026-10-05 14:10:00`.
- `day_mode='calendar'`: `expires_at = (дата активации + days − 1) 23:59:59` местного.
- Сдвиг сброса лимита («обновление каждые 24 ч») при `rolling24` — `next_reset_at` = ближайшая точка
  `activated_at + k×24 ч` в будущем; отдаётся в GET для подписи «лимит обновится в 14:10».

### 2.3 SQL — миграция в `ensureTripTables()` (web/trip.js)

Таблица новая, поэтому `CREATE TABLE IF NOT EXISTS` достаточно; все будущие колонки — только через
`PRAGMA table_info` + `ALTER TABLE ADD COLUMN` (правило CLAUDE.md, ADR-143). Частичные уникальные индексы — ключ
склейки повторного импорта.

```js
  // eSIM (28.09.2026, ADR-233). Купленная сим-карта для поездки: тариф, сроки, код установки.
  // Код активации (matching ID из LPA-строки) — СЕКРЕТ: кто его знает, тот ставит себе чужую
  // eSIM. Хранится шифром code_enc (тот же AES-256-GCM, что у сейфа доступов, ключ в
  // /home/cashruflow/.access_key), наружу в списке — только хвост code_tail. PIN брони, имя,
  // телефон и почта контакта не распознаются и не хранятся — полей под них нет намеренно.
  // Статус (куплена/установлена/активна/истекла) НЕ хранится: считает GET по датам.
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_esims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    country TEXT,
    region TEXT,
    product TEXT,
    plan TEXT,
    network TEXT,
    plan_kind TEXT NOT NULL DEFAULT 'daily',
    data_mb INTEGER,
    throttle_kbps INTEGER,
    days INTEGER,
    day_mode TEXT NOT NULL DEFAULT 'rolling24',
    sms INTEGER NOT NULL DEFAULT 0,
    calls INTEGER NOT NULL DEFAULT 0,
    dual_sim INTEGER NOT NULL DEFAULT 0,
    operator TEXT,
    operator_src TEXT,
    apn TEXT,
    roaming INTEGER NOT NULL DEFAULT 1,
    smdp TEXT,
    code_enc TEXT,
    code_tail TEXT,
    lpa_oid TEXT,
    confirm_required INTEGER NOT NULL DEFAULT 0,
    iccid TEXT,
    balance_url TEXT,
    booking_no TEXT,
    order_status TEXT,
    purchased_on TEXT,
    activate_by TEXT,
    extend_until TEXT,
    uses INTEGER,
    installed_on TEXT,
    activated_at TEXT,
    tz TEXT,
    price REAL,
    price_currency TEXT,
    price_local REAL,
    price_local_currency TEXT,
    price_base REAL,
    discount REAL,
    paid_with TEXT,
    booked_via TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE INDEX IF NOT EXISTS idx_trip_esims_profile ON trip_esims(profile_id, activated_at)`);
  // Повторный импорт той же брони не заводит вторую запись: ключ — номер брони, запасной — ICCID.
  // Индексы частичные: пустые значения (ручной ввод без номера) под уникальность не попадают.
  try {
    medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_esims_booking ON trip_esims(profile_id, booking_no)
      WHERE booking_no IS NOT NULL AND booking_no <> ''`);
    medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_esims_iccid ON trip_esims(profile_id, iccid)
      WHERE iccid IS NOT NULL AND iccid <> ''`);
  } catch (e) { console.error('trip_esims unique:', e.message); }
```

И одна строка в `VIA_TABLES` (стр. 146), чтобы `saveVia` и «Где покупаю» знали таблицу:

```diff
-const VIA_TABLES = ['trip_stays', 'trip_flights', 'trip_rides', 'trip_insurance', 'trip_permits'];
+const VIA_TABLES = ['trip_stays', 'trip_flights', 'trip_rides', 'trip_insurance', 'trip_permits', 'trip_esims'];
```

(«Где покупаю» — `GET …/trip/vendor-stats`, стр. 3629: проверить, берёт ли он список таблиц из `VIA_TABLES` или
свой — я его не читал целиком; если свой, дописать `esims` туда и в `KIND` на странице, `trip.html:782`.)

---

## 3. Извлечение: промт, нормализация, ручка

### 3.1 Промт `ESIM_PROMPT` (рядом с `PERMIT_PROMPT`, trip.js ~456)

```js
// eSIM (28.09.2026, ADR-233). Код активации модель вернуть ОБЯЗАНА — без него карту не
// поставить; PIN брони, имя, телефон и почта контакта — запрещены (как PIN у виз).
const ESIM_PROMPT = `Ты извлекаешь данные о купленной eSIM из подтверждения заказа (скриншоты, PDF или текст
письма). Экранов может быть несколько — это ОДИН заказ, собери одну запись.
Верни ТОЛЬКО JSON, без markdown:
{"country":"","region":"","product":"","plan":"","network":"","plan_kind":"","data_per_day":"","data_total":"","throttle":"","days":"","day_mode":"","sms":null,"calls":null,"dual_sim":null,"operator":"","apn":"","lpa":"","smdp":"","activation_code":"","iccid":"","balance_url":"","booking_no":"","order_status":"","purchased_on":"","activate_by":"","extend_until":"","uses":"","price":"","price_currency":"","price_base":"","discount":"","price_local":"","price_local_currency":"","paid_with":"","booked_via":"","note":""}
Правила:
- country — страна действия на русском (Египет, Турция). region — если план на несколько стран: «Европа, 33 страны».
- product — название продукта как написано. plan — название тарифа/пакета как написано.
- network — поколение сети, если указано: 4G, 5G.
- plan_kind — "daily", если объём даётся на сутки (Daily, в день, /day); "total" — на весь срок;
  "unlimited" — безлимит. data_per_day — объём в сутки как написан ("2GB"); data_total — на весь срок.
- throttle — скорость после исчерпания лимита как написана ("512kbps"). Нет — пустая строка.
- days — сколько дней действует пакет, число. day_mode — "rolling24", если сутки считаются 24 часа от
  активации / обновление каждые 24 часа; "calendar", если календарные сутки. Не сказано — пустая строка.
- sms, calls — true/false, если прямо сказано, включены ли SMS и звонки; не сказано — null.
- dual_sim — true, если написано Dual SIM. operator — оператор сети в стране, только если он назван.
- apn — точка доступа APN, если напечатана.
- lpa — строка активации ЦЕЛИКОМ, как напечатана, начинается с «LPA:1$». smdp — адрес SM-DP+.
  activation_code — код активации (Activation code / Matching ID). Если в документе только QR-картинка
  без текста — все три пустые, код с картинки не угадывай.
- iccid — номер ICCID, 19–20 цифр, только цифры.
- balance_url — ссылка проверки баланса/трафика, как напечатана.
- booking_no — номер заказа/бронирования. order_status — статус заказа как написан (Confirmed).
- purchased_on — дата заказа. activate_by — «действительно до», крайний срок активации.
  Все даты ГГГГ-ММ-ДД. extend_until — «продление до» с временем: ГГГГ-ММ-ДД ЧЧ:ММ:СС.
- uses — сколько раз можно использовать, число.
- price — ИТОГО к оплате, только число как в документе (357,69 → "357.69").
  price_currency — код валюты: RUB, USD, EUR (₽ = RUB). price_base — цена до скидки. discount — сумма скидки
  числом, не процент. price_local, price_local_currency — вторая сумма, если напечатаны ДВЕ валюты.
- paid_with — чем оплачено, если сказано: карта, Trip Coins, баллы.
- booked_via — площадка покупки: Trip.com, Airalo, Holafly, Yesim, «напрямую». Не видно — пустая строка.
- note — одна короткая строка важных условий: «отмена невозможна после использования».
- Чего нет — пустая строка. Ничего не выдумывай и не пересчитывай.
ЗАПРЕЩЕНО возвращать PIN или пароль заказа, имя и фамилию, телефон, электронную почту, номер карты,
адрес. Они есть в подтверждении — просто игнорируй их, в ответ они не должны попасть ни в одно поле,
включая note.`;
```

### 3.2 Нормализация (trip.js, рядом с `scanPrice`/`numAmount`)

```js
// ---------- eSIM: нормализация (28.09.2026, ADR-233) ----------
// LPA-строка по GSMA SGP.22: LPA:1$<SM-DP+>$<matching ID>[$<OID>[$<флаг кода подтверждения>]].
// Возвращает null, если строка не похожа на код активации. Регистр matching ID сохраняем:
// большинство SM-DP+ регистронезависимы, но не все.
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
// Обратно — каноническая строка для QR. Пустые хвосты не пишем: LPA:1$smdp.io$K2-36Y6K0-7CDVXL.
export const lpaBuild = p => p && p.smdp
  ? 'LPA:1$' + p.smdp + '$' + (p.code || '') + (p.oid || p.confirm ? '$' + (p.oid || '') : '') + (p.confirm ? '$1' : '')
  : '';
// ICCID: только цифры, 19–20 знаков, начинается с 89 (телеком). Luhn у 19-значных почти всегда
// сходится, у 20-значных бывает без контрольной цифры — поэтому неверный Luhn это предупреждение
// (luhn:false в ответе скана), а не отказ.
export function iccidNorm(raw) {
  const d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.length < 19 || d.length > 20 || !d.startsWith('89')) return { iccid: '', luhn: null };
  let t = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    t += n;
  }
  return { iccid: d, luhn: t % 10 === 0 };
}
// «2GB», «2 ГБ», «512MB», «1.5 GB» → мегабайты (1 ГБ = 1024 МБ). «Unlimited» → null.
export function dataMb(raw) {
  const m = /([\d.,]+)\s*(tb|тб|gb|гб|mb|мб)/i.exec(String(raw || ''));
  if (!m) return null;
  const n = numAmount(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  const u = m[2].toLowerCase();
  return Math.round(n * (/t|т/.test(u) ? 1048576 : /g|г/.test(u) ? 1024 : 1));
}
// «512kbps», «1 Мбит/с», «384 kbit/s» → кбит/с.
export function speedKbps(raw) {
  const m = /([\d.,]+)\s*(kbps|kbit|кбит|mbps|mbit|мбит)/i.exec(String(raw || ''));
  if (!m) return null;
  const n = numAmount(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(/^m|^м/i.test(m[2]) ? n * 1000 : n);
}
// Валюта: символ и слово → код. Незнакомое — первые 3 латинские буквы, как у scanPrice.
export function curCode(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (/₽|руб|rub|rur/i.test(s)) return 'RUB';
  if (/\$|usd/i.test(s)) return 'USD';
  if (/€|eur/i.test(s)) return 'EUR';
  return s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}
// Момент «YYYY-MM-DD HH:MM[:SS]» → строго YYYY-MM-DD HH:MM:SS или null.
function normMoment(raw) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(raw || '').trim());
  if (!m || !normDate(m[1]) || +m[2] > 23 || +m[3] > 59 || +(m[4] || 0) > 59) return null;
  return m[1] + ' ' + m[2].padStart(2, '0') + ':' + m[3] + ':' + (m[4] || '00');
}
```

Суммы — через уже существующий `numAmount()` (стр. 530): он правильно разбирает «357,69», «1 357,69» и «5,906.59».
`scanPrice()` (стр. 151) для eSIM НЕ использовать: у него `replace(',', '.')` без учёта разделителя тысяч.

### 3.3 Сроки и статус (trip.js, рядом с `localToUtc`)

```js
// Местный момент в поясе → UTC-мс и обратно. Секунды localToUtc не берёт — добавляем сами.
function momentToUtc(moment, tz) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(moment || ''));
  if (!m) return null;
  const base = localToUtc(m[1], m[2] + ':' + m[3], tz);
  return base == null ? null : base + (+m[4]) * 1000;
}
function utcToMoment(ms, tz) {
  // sv-SE даёт «2026-10-05 14:10:00» — ровно формат момента платформы.
  return new Date(ms).toLocaleString('sv-SE', { timeZone: tz, hourCycle: 'h23' }).replace('T', ' ');
}
// Статус и сроки eSIM. Всё считает сервер (как status у полиса), страница только рисует.
function esimState(e, nowMs = Date.now()) {
  const tz = e.tz || COUNTRY_TZ[e.country] || 'Europe/Moscow';
  let expiresMs = null, nextReset = null;
  if (e.activated_at && e.days > 0) {
    const a = momentToUtc(e.activated_at, tz);
    if (a != null) {
      if (e.day_mode === 'calendar') {
        const lastDay = addDays(e.activated_at.slice(0, 10), e.days - 1);
        expiresMs = momentToUtc(lastDay + ' 23:59:59', tz);
      } else {
        expiresMs = a + e.days * 86400e3;
        const k = Math.floor((nowMs - a) / 86400e3) + 1;
        if (nowMs >= a && nowMs < expiresMs) nextReset = a + k * 86400e3;
      }
    }
  }
  const status = e.activated_at
    ? (expiresMs != null && nowMs >= expiresMs ? 'expired' : 'active')
    : (e.activate_by && today() > e.activate_by ? 'expired'
      : e.installed_on ? 'installed' : 'bought');
  return {
    tz, status,
    expires_at: expiresMs != null ? utcToMoment(expiresMs, tz) : null,
    hours_left: status === 'active' && expiresMs != null ? Math.max(0, Math.floor((expiresMs - nowMs) / 3600e3)) : null,
    next_reset_at: nextReset != null && nextReset < expiresMs ? utcToMoment(nextReset, tz) : null,
    never_activated: !e.activated_at && status === 'expired'
  };
}
// Бейдж для карточки поездки и списка: «Египет 2 ГБ/день, 3 дня».
function esimLabel(e) {
  const gb = e.data_mb ? (e.data_mb >= 1024 ? +(e.data_mb / 1024).toFixed(1) + ' ГБ' : e.data_mb + ' МБ') : '';
  const vol = e.plan_kind === 'unlimited' ? 'безлимит' : gb ? gb + (e.plan_kind === 'daily' ? '/день' : '') : '';
  const d = e.days ? e.days + ' ' + (e.days % 10 === 1 && e.days % 100 !== 11 ? 'день'
    : [2, 3, 4].includes(e.days % 10) && ![12, 13, 14].includes(e.days % 100) ? 'дня' : 'дней') : '';
  return [e.country || e.region || 'eSIM', [vol, d].filter(Boolean).join(', ')].filter(Boolean).join(' ');
}
```

### 3.4 Ручка распознавания `POST …/trip/esim-scan`

Три входа одним конвейером (как просили — «тот же механизм, что у отеля»):
1. `application/octet-stream` + `X-File-Name` — один файл (как `/scan` и `takeScan`);
2. `application/json` `{files:[{name,data}]}` — до 5 скринов одного заказа (как `/scan`);
3. `text/plain` + `X-Doc-Kind: text` — вставленное письмо (как `/boarding`), лимит `PASTE_MAX`.

Приём файлов у `/scan` написан прямо в теле ручки (4272–4323). Предлагаю вынести его в помощник
`takeFiles()` рядом с `takeScan()` и звать из `esim-scan`; перевести на него `/scan` — отдельным коммитом
после проверки (чтобы не трогать работающий скан брони в той же правке).

```js
  // Приём файлов для скана из нескольких экранов (28.09.2026): одно тело — сырые байты,
  // несколько — JSON {files:[{name,data(base64)}]}. Вынесено из /trip/scan дословно; /scan
  // переводится на этот помощник отдельной правкой. null — ответ уже отправлен.
  function takeFiles(req, res, noteOne, noteMany) {
    purgeScansLazy();
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    if (!body.length) { res.status(400).json({ ok: false, error: 'файл не дошёл до сервера — попробуйте ещё раз' }); return null; }
    const cleanName = raw => String(raw || 'screen').replace(/[^\w.\-А-Яа-яЁё ]/g, '_').slice(0, 120);
    const files = [];
    if (String(req.headers['content-type'] || '').includes('application/json')) {
      let parsed;
      try { parsed = JSON.parse(body.toString('utf8')); }
      catch { res.status(400).json({ ok: false, error: 'не разобрал тело запроса' }); return null; }
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

  // Кто уже занесён с тем же номером брони или ICCID — ключи склейки (уникальные индексы).
  function esimTwin(profileId, booking_no, iccid) {
    if (booking_no) {
      const r = medDb.prepare('SELECT * FROM trip_esims WHERE profile_id=? AND booking_no=?').get(profileId, booking_no);
      if (r) return r;
    }
    if (iccid) return medDb.prepare('SELECT * FROM trip_esims WHERE profile_id=? AND iccid=?').get(profileId, iccid) || null;
    return null;
  }

  // Подтверждение заказа eSIM → поля формы. Записи НЕ создаёт: человек проверяет и сохраняет сам.
  app.post('/api/profile/:profileId/trip/esim-scan', express.raw({ type: '*/*', limit: MAX_BYTES }), async (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'нет ANTHROPIC_API_KEY' });
    const isText = String(req.headers['x-doc-kind'] || '').toLowerCase() === 'text';
    let got = null, pasted = '';
    if (isText) {
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      pasted = buf.toString('utf8').trim().slice(0, PASTE_MAX);
      if (pasted.length < 10) return res.status(400).json({ ok: false, error: 'текста слишком мало — вставьте письмо целиком' });
    } else {
      got = takeFiles(req, res, 'заказ eSIM → распознавание', 'заказ eSIM');
      if (!got) return;
    }
    const label = isText ? 'вставленный текст' : got.label;
    const started = Date.now();
    let u, raw;
    try {
      const content = isText ? [{ type: 'text', text: ESIM_PROMPT + '\n\nТЕКСТ:\n' + pasted }]
        : [...got.files.map(f => f.mime === 'application/pdf'
            ? { type: 'document', source: { type: 'base64', media_type: f.mime, data: f.buf.toString('base64') } }
            : { type: 'image', source: { type: 'base64', media_type: f.mime, data: f.buf.toString('base64') } }),
          { type: 'text', text: ESIM_PROMPT }];
      u = await ask(content, 1500);
      raw = parseJson(u.text);
    } catch (e) {
      if (got && tasksDb) for (const id of got.uploadIds) {
        try { tasksDb.prepare("UPDATE file_uploads SET status='error', note=? WHERE id=?").run(String(e.message).slice(0, 300), id); } catch {}
      }
      logAiCall('trip_esim', isText ? null : 'upload', got?.uploadId || null, null, SCAN_MODEL, 0, 0, 0,
        { note: label, durationMs: Date.now() - started, error: e.message });
      logGeneration('trip_esim', 'Заказ eSIM: ' + label, '', '', null, 'error', e.message);
      return res.status(502).json({ ok: false, error: 'распознать не удалось: ' + e.message, upload_ids: got?.uploadIds || [] });
    }
    // Белый список — вторая линия защиты: PIN, имя, телефон и почта заказа наружу не уйдут.
    const S = v => String(v == null ? '' : v).trim().slice(0, TEXT_MAX);
    const B = v => v === true || v === 'true' ? 1 : v === false || v === 'false' ? 0 : '';
    // LPA: в тексте ищем строку регуляркой САМИ — модель могла ошибиться в символе.
    let lpa = null;
    if (isText) { const m = /LPA:1\$[^\s$]+\$[A-Za-z0-9._-]+(?:\$[^\s$]*)?(?:\$[01])?/i.exec(pasted); if (m) lpa = lpaParse(m[0]); }
    if (!lpa) lpa = lpaParse(raw?.lpa);
    if (!lpa && raw?.smdp && raw?.activation_code) lpa = lpaParse('LPA:1$' + raw.smdp + '$' + raw.activation_code);
    const ic = iccidNorm(raw?.iccid);
    const kind = ['daily', 'total', 'unlimited'].includes(raw?.plan_kind) ? raw.plan_kind : (raw?.data_per_day ? 'daily' : raw?.data_total ? 'total' : '');
    const money = v => { const n = numAmount(v); return isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : ''; };
    const esim = {
      country: S(raw?.country).slice(0, COUNTRY_MAX), region: S(raw?.region),
      product: S(raw?.product), plan: S(raw?.plan), network: S(raw?.network).toUpperCase().slice(0, 8),
      plan_kind: kind,
      data_mb: String(dataMb(kind === 'total' ? raw?.data_total : raw?.data_per_day) || ''),
      throttle_kbps: String(speedKbps(raw?.throttle) || ''),
      days: String(raw?.days || '').replace(/\D/g, '').slice(0, 3),
      day_mode: ['rolling24', 'calendar'].includes(raw?.day_mode) ? raw.day_mode : '',
      sms: B(raw?.sms), calls: B(raw?.calls), dual_sim: B(raw?.dual_sim),
      operator: S(raw?.operator).slice(0, 60), apn: S(raw?.apn).replace(/[^\w.\-]/g, '').slice(0, 60),
      lpa: lpa ? lpaBuild(lpa) : '', smdp: lpa ? lpa.smdp : '',
      iccid: ic.iccid, iccid_luhn: ic.luhn,
      balance_url: (() => { const x = S(raw?.balance_url); return /^https?:\/\/[\w.-]+\.[a-z]{2,}/i.test(x) ? x.slice(0, 300) : ''; })(),
      booking_no: S(raw?.booking_no).replace(/[^\w-]/g, '').slice(0, 40),
      order_status: S(raw?.order_status).slice(0, 30),
      purchased_on: normDate(raw?.purchased_on) || '', activate_by: normDate(raw?.activate_by) || '',
      extend_until: normMoment(raw?.extend_until) || '',
      uses: String(raw?.uses || '').replace(/\D/g, '').slice(0, 3),
      price: money(raw?.price), price_currency: curCode(raw?.price_currency),
      price_base: money(raw?.price_base), discount: money(raw?.discount),
      price_local: money(raw?.price_local), price_local_currency: curCode(raw?.price_local_currency),
      paid_with: S(raw?.paid_with).slice(0, 40),
      booked_via: vendorResolve(medDb, S(raw?.booked_via), false) || '',
      note: S(raw?.note)
    };
    logAiCall('trip_esim', isText ? null : 'upload', got?.uploadId || null, null, SCAN_MODEL, u.inTok, u.outTok, cost(u),
      { note: label, durationMs: Date.now() - started });
    if (!esim.country && !esim.product && !esim.lpa && !esim.iccid && !esim.booking_no) {
      logGeneration('trip_esim', 'Заказ eSIM: ' + label, 'ни одного поля не распознано', '', u, 'error', 'в документе нет данных eSIM');
      return res.status(422).json({ ok: false, upload_ids: got?.uploadIds || [],
        error: isText ? 'в тексте не нашлось данных eSIM — вставьте письмо целиком или заполните поля руками'
          : 'на снимке не нашлось данных eSIM — снимите заказ целиком или заполните поля руками' });
    }
    // Сверка с занесённым ДО сохранения — как у рейсов: человек видит «уже есть», а не узнаёт после.
    const twin = esimTwin(profileId, esim.booking_no, esim.iccid);
    if (twin) esim.dup_id = twin.id;
    const tail = s => s ? '···' + String(s).slice(-4) : '';
    const genId = logGeneration('trip_esim', 'Заказ eSIM: ' + (esimLabel({ ...esim, data_mb: +esim.data_mb, days: +esim.days }) || label),
      [esim.country, esim.plan, esim.booked_via].filter(Boolean).join(' · '),
      // В общий журнал код активации, ICCID и номер заказа — только хвостом.
      JSON.stringify({ ...esim, lpa: esim.lpa ? 'LPA:1$' + esim.smdp + '$' + tail(lpa.code) : '',
        iccid: tail(esim.iccid), booking_no: tail(esim.booking_no) }, null, 2), u, 'ok');
    res.json({ ok: true, esim, upload_ids: got?.uploadIds || [], generation_id: genId });
  });
```

И в `server.js:249` — пропустить новую ручку мимо глобального `express.json` (иначе JSON из 2–5 скринов режется 413
ещё до роута — ровно грабля из ADR-204):

```diff
-const RAW_BODY_RE = /^\/api\/profile\/[^/]+\/trip\/scan$/;
+const RAW_BODY_RE = /^\/api\/profile\/[^/]+\/trip\/(scan|esim-scan)$/;
```

---

## 4. API

Все под `/api/profile/:profileId/trip` (`me` — своя сессия), начало каждой ручки — `pid(req,res)`.

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/esims` | список: поля без `code_enc`, + `lpa_masked` («LPA:1$smdp.io$···DVXL»), `has_code`, `iccid_masked`, `label`, `status`, `expires_at`, `hours_left`, `next_reset_at`, `tz`; итоги `active`, `soon` |
| GET | `/esims/:id/secret` | `{ lpa }` целиком — только по кнопке «Показать»/«QR»; в журналы не пишется; `Cache-Control: no-store` уже ставит общий middleware (`server.js:261`) |
| POST | `/esims` | создать; если есть близнец по `booking_no`/`iccid` — дозаполнить пустые поля близнеца и вернуть `{merged:true, esim}` (без 409: повторный импорт — нормальный сценарий) |
| PATCH | `/esims/:id` | правка; то же тело, частично (`undefined` — не трогаем, как `policyBody`) |
| DELETE | `/esims/:id` | удалить |
| POST | `/esim-scan` | распознавание (§3.4), записи не создаёт |

Кнопки «Установил» и «Подключилась сейчас» — это обычный `PATCH` с `installed_on` / `activated_at`
(момент считает страница в поясе `tz`, сервер проверяет формат) — отдельных ручек не заводим.

`REF_ACTIVITY` (реф-награда за первую запись, `trip.js:1730`) — дописать `esims`, если eSIM должна считаться
«первой записью» (открытый вопрос; по смыслу — да).

### 4.1 Тело и CRUD (trip.js, рядом с ручками страховок ~4037)

Правило CLAUDE.md «INSERT с длинным списком колонок — через объект и `Object.keys`» — соблюдено.

```js
  // ---------- eSIM (28.09.2026, ADR-233) ----------
  // Секрет шифруется функциями из server.js (сейф доступов): своей криптографии в модуле не заводим.
  const encSecret = deps?.encSecret || null, decSecret = deps?.decSecret || null;
  const ESIM_TEXT = { country: COUNTRY_MAX, region: TEXT_MAX, product: TEXT_MAX, plan: TEXT_MAX, network: 8,
    operator: 60, apn: 60, order_status: 30, paid_with: 40, note: TEXT_MAX };
  const ESIM_INT = ['data_mb', 'throttle_kbps', 'days', 'uses'];
  const ESIM_FLAG = ['sms', 'calls', 'dual_sim', 'roaming'];
  const ESIM_MONEY = ['price', 'price_local', 'price_base', 'discount'];
  function esimBody(body, base) {
    const b = base || {}, out = {};
    const has = k => body?.[k] !== undefined;
    for (const [k, max] of Object.entries(ESIM_TEXT)) out[k] = has(k) ? str(body[k], max) : (b[k] ?? null);
    for (const k of ESIM_INT) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      const n = parseInt(String(body[k]).replace(/\D/g, ''), 10);
      out[k] = Number.isFinite(n) && n > 0 ? n : null;
    }
    for (const k of ESIM_FLAG) out[k] = has(k) ? (body[k] === true || body[k] === 1 || body[k] === '1' ? 1 : 0) : (b[k] ?? (k === 'roaming' ? 1 : 0));
    for (const k of ESIM_MONEY) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      const n = numAmount(body[k]);
      out[k] = String(body[k] ?? '').trim() === '' ? null : (isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN);
    }
    if (ESIM_MONEY.some(k => Number.isNaN(out[k]))) return { error: { error: 'bad_amount', message: 'Сумма — число' } };
    for (const k of ['price_currency', 'price_local_currency']) out[k] = has(k) ? (curCode(body[k]) || null) : (b[k] ?? null);
    out.plan_kind = has('plan_kind') ? (['daily', 'total', 'unlimited'].includes(body.plan_kind) ? body.plan_kind : 'daily') : (b.plan_kind || 'daily');
    out.day_mode = has('day_mode') ? (body.day_mode === 'calendar' ? 'calendar' : 'rolling24') : (b.day_mode || 'rolling24');
    out.operator_src = has('operator') ? (out.operator ? (body.operator_src === 'doc' ? 'doc' : 'manual') : null) : (b.operator_src ?? null);
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
    // Код активации: пришла строка LPA — разбираем и шифруем; пустая строка — стереть; нет ключа — не трогаем.
    if (has('lpa')) {
      const s = String(body.lpa || '').trim();
      if (!s) Object.assign(out, { smdp: null, code_enc: null, code_tail: null, lpa_oid: null, confirm_required: 0 });
      else {
        const p = lpaParse(s);
        if (!p) return { error: { error: 'bad_lpa', message: 'Код активации — строка вида LPA:1$адрес$код' } };
        if (p.code && !encSecret) return { error: { error: 'no_key', message: 'Нет ключа шифрования — код не сохранён' } };
        Object.assign(out, { smdp: p.smdp, code_enc: p.code ? encSecret(p.code) : null,
          code_tail: p.code ? p.code.slice(-4) : null, lpa_oid: p.oid || null, confirm_required: p.confirm ? 1 : 0 });
      }
    } else for (const k of ['smdp', 'code_enc', 'code_tail', 'lpa_oid', 'confirm_required']) out[k] = b[k] ?? (k === 'confirm_required' ? 0 : null);
    if (!out.country && !out.region && !out.product && !out.booking_no && !out.iccid)
      return { error: { error: 'empty', message: 'Укажите страну, тариф, номер заказа или ICCID' } };
    return out;
  }
  const esimView = r => {
    const { code_enc, ...rest } = r;
    const tail = s => s ? '···' + String(s).slice(-4) : '';
    return Object.assign(rest, esimState(r), {
      label: esimLabel(r), has_code: !!code_enc,
      lpa_masked: r.smdp ? 'LPA:1$' + r.smdp + '$' + tail(r.code_tail) : '',
      iccid_masked: tail(r.iccid)
    });
  };

  app.get('/api/profile/:profileId/trip/esims', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const rows = medDb.prepare(`SELECT * FROM trip_esims WHERE profile_id=?
        ORDER BY COALESCE(activated_at, purchased_on, created_at) DESC, id DESC`).all(profileId).map(esimView);
      res.json({ ok: true, on: today(), esims: rows,
        active: rows.filter(r => r.status === 'active').length,
        // «Скоро сгорит»: не активирована, а до крайнего срока активации ≤ 14 дней.
        soon: rows.filter(r => r.status !== 'expired' && !r.activated_at && r.activate_by
          && dnum(r.activate_by) - dnum(today()) <= 14).length });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/profile/:profileId/trip/esims/:id/secret', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const r = medDb.prepare('SELECT smdp, code_enc, lpa_oid, confirm_required FROM trip_esims WHERE id=? AND profile_id=?').get(req.params.id, profileId);
    if (!r) return res.status(404).json({ ok: false, error: 'not_found' });
    const code = r.code_enc && decSecret ? decSecret(r.code_enc) : '';
    if (r.code_enc && !code) return res.status(500).json({ ok: false, error: 'код не расшифровался — ключ сменился?' });
    res.json({ ok: true, lpa: lpaBuild({ smdp: r.smdp, code, oid: r.lpa_oid, confirm: !!r.confirm_required }) });
  });

  app.post('/api/profile/:profileId/trip/esims', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const d = esimBody(req.body, null);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      // Повторный импорт той же брони — дозаполняем занесённую запись, второй не заводим.
      const twin = esimTwin(profileId, d.booking_no, d.iccid);
      if (twin) {
        const fill = Object.fromEntries(Object.entries(d).filter(([k, v]) => v != null && v !== ''
          && (twin[k] == null || twin[k] === '')));
        if (Object.keys(fill).length) medDb.prepare(`UPDATE trip_esims SET ${Object.keys(fill).map(k => k + '=?').join(', ')},
          updated_at=datetime('now') WHERE id=?`).run(...Object.values(fill), twin.id);
        saveVia('trip_esims', twin.id, req.body);
        return res.json({ ok: true, merged: true, filled: Object.keys(fill),
          esim: esimView(medDb.prepare('SELECT * FROM trip_esims WHERE id=?').get(twin.id)) });
      }
      const row = { profile_id: profileId, ...d };
      const cols = Object.keys(row);
      const r = medDb.prepare(`INSERT INTO trip_esims (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(',')})`)
        .run(...cols.map(k => row[k]));
      saveVia('trip_esims', r.lastInsertRowid, req.body);
      res.json({ ok: true, esim: esimView(medDb.prepare('SELECT * FROM trip_esims WHERE id=?').get(r.lastInsertRowid)) });
    } catch (e) {
      // Гонка двух импортов одной брони: второй ловит уникальный индекс — отдаём понятную причину.
      if (/UNIQUE/.test(e.message)) return res.status(409).json({ ok: false, error: 'dup', message: 'Эта eSIM уже занесена' });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.patch('/api/profile/:profileId/trip/esims/:id', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const row = medDb.prepare('SELECT * FROM trip_esims WHERE id=? AND profile_id=?').get(req.params.id, profileId);
      if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
      const d = esimBody(req.body, row);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      const cols = Object.keys(d);
      medDb.prepare(`UPDATE trip_esims SET ${cols.map(k => k + '=?').join(', ')}, updated_at=datetime('now') WHERE id=?`)
        .run(...cols.map(k => d[k]), row.id);
      saveVia('trip_esims', row.id, req.body);
      res.json({ ok: true, esim: esimView(medDb.prepare('SELECT * FROM trip_esims WHERE id=?').get(row.id)) });
    } catch (e) {
      if (/UNIQUE/.test(e.message)) return res.status(409).json({ ok: false, error: 'dup', message: 'Другая eSIM уже с этим номером заказа или ICCID' });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.delete('/api/profile/:profileId/trip/esims/:id', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const r = medDb.prepare('DELETE FROM trip_esims WHERE id=? AND profile_id=?').run(req.params.id, profileId);
    if (!r.changes) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true });
  });
```

`saveVia` для `trip_esims` сработает только в части `booked_via` (цены там пишутся для `trip_insurance`/
`trip_permits`, а у eSIM цена идёт через `esimBody`) — это и нужно.

В `server.js:15200` передать шифрование (функции объявлены `function` на стр. 7806/7814 — всплывают, TDZ нет):

```diff
 mountTrip(app, medDb, {
   profileAuth, pcheck, getPatientAccount: patientAuthApi.getAccount,
   referral: referralApi,
   tasksDb: db, logUpload, logAiCall,
   apiKey: ANTHROPIC_KEY, aiBase: AI_BASE,
+  encSecret, decSecret,   // код активации eSIM — тем же шифром, что сейф доступов (ADR-233)
   whisperKey: …,
   openaiBase: …
 });
```

---

## 5. UI: вкладка «eSIM», бейдж, QR

### 5.1 Вкладка (trip.html)

```diff
     <button type="button" class="ui-tab" data-t="ins">Страховки</button>
+    <button type="button" class="ui-tab" data-t="esim">eSIM</button>
     <button type="button" class="ui-tab" data-t="permits">Разрешения</button>
```

```diff
   ({ home: paintHome, plan: paintPlan, flights: paintFlights, rides: paintRides, moves: paintMoves,
-     stays: paintStays, ins: paintIns, permits: paintPermits, rules: paintRules }[t])();
+     stays: paintStays, ins: paintIns, esim: paintEsim, permits: paintPermits, rules: paintRules }[t])();
```

Ряд `#tripTabs` уже 10 кнопок; проверить на 360px, что `.ui-tabs` скроллится/переносится (правило «в чужой ряд не
дописывать, не проверив flex-wrap»). Если ряд не переносится — это правка общего `.ui-tabs`, не eSIM.

Форма — тем же приёмом, что `paintIns` (карточка формы сверху, список ниже, `formHead`/`bindRows`/`bindCancel`,
`EDIT.esim`). Код (вставить после `paintIns`, ~стр. 1800):

```js
/* ---------- eSIM (28.09.2026, ADR-233) ----------
   Купленная сим-карта для поездки. Статус, срок и «осталось» считает сервер. Код активации
   в списке — маской; целиком приходит отдельным запросом по «Показать» и не кладётся ни в
   localStorage, ни в DOM закрытой карточки (правило «Скрытие приватных данных» — замок и
   пара кнопок, не одно blur). */
const ESIM_ST = { bought: 'куплена', installed: 'установлена', active: 'активна', expired: 'истекла' };
const ESIM_OPS = ['', 'Vodafone', 'Orange', 'Etisalat', 'WE', 'Turkcell', 'AIS', 'dtac', 'TrueMove H'];   // подсказки; ввод свободный
let ESIM_OPEN = null;   // id карточки с раскрытым кодом — живёт до перерисовки, не в хранилище
const esimIco = n => '<svg class="esim-ico" aria-hidden="true"><use href="' + (window.ICONS_URL || '/assets/icons.svg?v=8') + '#' + n + '"></use></svg>';
function esimStatusLine(e) {
  if (e.status === 'active') return '<span class="ok">Активна' + (e.hours_left != null ? ', осталось ' + (e.hours_left >= 24 ? days(Math.floor(e.hours_left / 24)) + ' ' + (e.hours_left % 24) + ' ч' : e.hours_left + ' ч') : '')
    + '</span>' + (e.expires_at ? ' · до ' + RU(e.expires_at.slice(0, 10)) + ' ' + e.expires_at.slice(11, 16) : '')
    + (e.next_reset_at ? '<br>Лимит обновится ' + e.next_reset_at.slice(11, 16) : '');
  if (e.status === 'expired') return '<span class="warn">' + (e.never_activated ? 'Не активирована до ' + RU(e.activate_by) : 'Истекла ' + (e.expires_at ? RU(e.expires_at.slice(0, 10)) : '')) + '</span>';
  return (e.status === 'installed' ? 'Установлена' : 'Куплена') + (e.activate_by ? ' · активировать до ' + RU(e.activate_by) : '');
}
async function paintEsim() {
  let d;
  try { d = await api('/esims'); } catch (e) { return fail(e); }
  if (EDIT.esim && !d.esims.find(x => x.id === EDIT.esim)) EDIT.esim = null;
  const rows = d.esims.map(e => `
    <div class="card${e.id === EDIT.esim ? ' edit' : ''}">
      <div class="top">
        <div>
          <div class="nm">${esimIco('i-sim')} ${esc(e.label)}</div>
          <div class="meta">${ESIM_ST[e.status]} · ${esimStatusLine(e)}</div>
          <div class="meta">${[e.product, e.plan].filter(Boolean).map(esc).join(' · ')}${
            e.throttle_kbps ? '<br>После лимита ' + e.throttle_kbps + ' кбит/с' : ''}${
            '<br>' + (e.sms ? 'SMS' : 'без SMS') + ' · ' + (e.calls ? 'звонки' : 'без звонков')}${
            e.operator ? ' · сеть ' + esc(e.operator) : ' · сеть не указана'}${
            e.apn ? ' · APN ' + esc(e.apn) : ''}${e.roaming ? '<br>Включите «Роуминг данных» для этой линии' : ''}</div>
          ${e.iccid_masked ? '<div class="meta">ICCID ' + esc(e.iccid_masked) + (e.balance_url
            ? ' · <a href="' + esc(e.balance_url) + '" target="_blank" rel="noopener" style="color:var(--ui-brand,#00a0ff);">баланс</a>' : '') + '</div>' : ''}
          ${e.has_code ? `<div class="meta esim-code" data-esim-code="${e.id}">
            ${esimIco('i-lock')} <span>${esc(e.lpa_masked)}</span>
            <div class="row2" style="margin:6px 0 0;">
              <button class="${ESIM_OPEN === e.id ? 'btn' : 'tbtn'} btn-sm" data-esim-show="${e.id}">Показать</button>
              <button class="${ESIM_OPEN === e.id ? 'tbtn' : 'btn'} btn-sm" data-esim-hide="${e.id}">Скрыть</button>
            </div></div>` : ''}
          ${priceLine(e) || e.booked_via ? '<div class="meta">' + [priceLine(e), e.discount ? 'скидка ' + fmtMoney(e.discount, e.price_currency) : '',
            e.paid_with ? esc(e.paid_with) : '', e.booked_via ? esc(e.booked_via) : '', e.booking_no ? 'заказ ···' + esc(e.booking_no.slice(-4)) : ''].filter(Boolean).join(' · ') + '</div>' : ''}
          ${e.note ? '<div class="meta">' + esc(e.note) + '</div>' : ''}
        </div>
        <div class="acts">
          ${!e.installed_on && !e.activated_at ? `<span class="act" data-esim-inst="${e.id}">Установил</span>` : ''}
          ${!e.activated_at ? `<span class="act" data-esim-act="${e.id}" data-tz="${esc(e.tz || '')}">Подключилась</span>` : ''}
          <span class="act" data-edit="${e.id}">Изменить</span>
          <span class="act del" data-del="${e.id}">Удалить</span>
        </div>
      </div>
    </div>`).join('');
  $('#pane').innerHTML = `
    <div class="card">
      <div class="row2" style="margin-bottom:10px;align-items:center;flex-wrap:wrap;">
        <button class="btn ghost" id="es-pick">Скрин или PDF</button>
        <button class="btn ghost" id="es-pick-txt">Вставить текст</button>
        <input type="file" id="es-file" accept="image/*,application/pdf" multiple style="display:none;">
        <div class="hint" id="hint" style="margin:0;flex:1 0 100%;">Подтверждение заказа eSIM (Trip.com, Airalo, Holafly…) — до 5 экранов одного заказа или текст письма. PIN заказа, имя, телефон и почта не распознаются и не хранятся. Код активации хранится зашифрованным.</div>
      </div>
      <div id="es-txt" style="display:none;margin:0 0 10px;">
        <textarea id="es-txta" rows="6" placeholder="Вставьте письмо или текст заказа целиком" style="width:100%;"></textarea>
        <button class="btn" id="es-txt-go" style="margin-top:6px;">Распознать</button>
      </div>
      <div class="fld"><span>Страна</span><input id="es-country" list="places" placeholder="Египет"></div>
      <div class="fld"><span>Регион</span><input id="es-region" placeholder="если план на несколько стран"></div>
      <div class="fld"><span>Продукт</span><input id="es-product" placeholder="Egypt 5G eSIM | Dual SIM"></div>
      <div class="fld"><span>Тариф</span><input id="es-plan" placeholder="3 days · Daily 2GB"></div>
      <div class="fld"><span>Объём</span><select id="es-kind" data-pick>
        <option value="daily">в сутки</option><option value="total">на весь срок</option><option value="unlimited">безлимит</option></select></div>
      <div class="fld"><span>МБ</span><input id="es-mb" type="number" inputmode="numeric" placeholder="2048"></div>
      <div class="fld"><span>После лимита, кбит/с</span><input id="es-kbps" type="number" inputmode="numeric" placeholder="512"></div>
      <div class="fld"><span>Дней</span><input id="es-days" type="number" inputmode="numeric" placeholder="3"></div>
      <div class="fld"><span>Сутки</span><select id="es-daymode" data-pick>
        <option value="rolling24">24 ч от активации</option><option value="calendar">календарные</option></select></div>
      <div class="fld"><span>Сеть</span><input id="es-network" placeholder="5G"></div>
      <div class="fld"><span>Оператор</span><input id="es-operator" list="es-ops" placeholder="не знаю"></div>
      <datalist id="es-ops">${ESIM_OPS.filter(Boolean).map(o => '<option value="' + esc(o) + '">').join('')}</datalist>
      <div class="fld"><span>APN</span><input id="es-apn" placeholder="необязательно"></div>
      <label class="fld"><span>Роуминг данных</span><input type="checkbox" id="es-roam" checked></label>
      <label class="fld"><span>SMS</span><input type="checkbox" id="es-sms"></label>
      <label class="fld"><span>Звонки</span><input type="checkbox" id="es-calls"></label>
      <div class="fld"><span>Код активации</span><input id="es-lpa" autocomplete="off" spellcheck="false" placeholder="LPA:1$smdp.io$…"></div>
      <div class="fld"><span>ICCID</span><input id="es-iccid" inputmode="numeric" placeholder="89…"></div>
      <div class="fld"><span>Проверка баланса</span><input id="es-bal" type="url" inputmode="url" placeholder="https://…"></div>
      <div class="fld"><span>Номер заказа</span><input id="es-booking" placeholder="1539367401113525"></div>
      ${dateFld('Куплена', 'es-bought', '')}
      ${dateFld('Активировать до', 'es-by', '')}
      <div class="fld"><span>Подключилась</span><input id="es-act" placeholder="ГГГГ-ММ-ДД ЧЧ:ММ (местное)"></div>
      <div class="fld"><span>Пояс</span><input id="es-tz" placeholder="Africa/Cairo"></div>
      <div class="fpair">
        ${priceField('Итого', 'es-price', 'es-pcur', '', 'RUB', '339.80')}
        ${priceField('Вторая валюта', 'es-lprice', 'es-lcur', '', 'USD', '4')}
      </div>
      <div class="fld"><span>Скидка</span><input id="es-disc" type="number" inputmode="decimal" placeholder="17.89"></div>
      <div class="fld"><span>Оплачено</span><input id="es-paid" placeholder="карта / Trip Coins"></div>
      ${viaFld('es-via', 'Trip.com')}
      <div class="fld"><span>Заметка</span><input id="es-note" placeholder="отмена невозможна после использования"></div>
      <input type="hidden" id="es-base">
      <input type="hidden" id="es-ext">
      <div class="err" id="err"></div>
      ${formHead('esim', 'Добавить eSIM')}
      <div class="hint">Срок считается от момента подключения: 3 дня = 72 часа. Сумма попадёт в траты поездки в категорию «Связь».</div>
    </div>
    ${d.esims.length ? '<div class="sub" style="margin:0 0 8px;">eSIM ' + d.esims.length + (d.active ? ' · активных ' + d.active : '') + (d.soon ? ' · пора активировать: ' + d.soon : '') + '</div>' : ''}
    ${rows || '<div class="empty">eSIM пока нет. Загрузите скрин заказа или вставьте письмо — тариф, сроки и код установки заполнятся сами.</div>'}`;
  const body = () => ({
    country: val('es-country'), region: val('es-region'), product: val('es-product'), plan: val('es-plan'),
    plan_kind: val('es-kind'), data_mb: val('es-mb'), throttle_kbps: val('es-kbps'), days: val('es-days'),
    day_mode: val('es-daymode'), network: val('es-network'), operator: val('es-operator'), apn: val('es-apn'),
    roaming: $('#es-roam').checked, sms: $('#es-sms').checked, calls: $('#es-calls').checked,
    iccid: val('es-iccid'), balance_url: val('es-bal'), booking_no: val('es-booking'),
    purchased_on: val('es-bought'), activate_by: val('es-by'), activated_at: val('es-act'), tz: val('es-tz'),
    discount: val('es-disc'), paid_with: val('es-paid'), booked_via: val('es-via'), note: val('es-note'),
    price_base: val('es-base'), extend_until: val('es-ext'),
    ...priceBody('es-price', 'es-pcur', 'es-lprice', 'es-lcur'),
    // Код уходит, ТОЛЬКО если его вписали/распознали: при правке поле пустое, и пустота не должна стирать код.
    ...(val('es-lpa') ? { lpa: val('es-lpa') } : {})
  });
  $('#f-save').onclick = async () => {
    try {
      let r;
      if (EDIT.esim) { r = await send('/esims/' + EDIT.esim, 'PATCH', body()); EDIT.esim = null; }
      else r = await send('/esims', 'POST', body());
      if (r && r.merged) note('Эта eSIM уже была — дополнил: ' + (r.filled.length ? r.filled.join(', ') : 'нового нет'), true);
      paintEsim();
    } catch (e) { fail(e); }
  };
  bindCancel('esim', paintEsim);
  ['es-bought', 'es-by'].forEach(bindDate);
  // Установил / подключилась — PATCH одним полем. Момент «сейчас» — в поясе eSIM, не телефона.
  document.querySelectorAll('[data-esim-inst]').forEach(el => el.onclick = async () => {
    try { await send('/esims/' + el.dataset.esimInst, 'PATCH', { installed_on: localDay() }); paintEsim(); } catch (e) { fail(e); }
  });
  document.querySelectorAll('[data-esim-act]').forEach(el => el.onclick = async () => {
    const tz = el.dataset.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date().toLocaleString('sv-SE', { timeZone: tz, hourCycle: 'h23' });
    try { await send('/esims/' + el.dataset.esimAct, 'PATCH', { activated_at: now, tz }); paintEsim(); } catch (e) { fail(e); }
  });
  document.querySelectorAll('[data-esim-show]').forEach(el => el.onclick = () => esimReveal(+el.dataset.esimShow));
  document.querySelectorAll('[data-esim-hide]').forEach(el => el.onclick = () => { ESIM_OPEN = null; paintEsim(); });
  bindEsimScan();
  bindRows('/esims', paintEsim, 'esim', () => {
    const e = d.esims.find(x => x.id === EDIT.esim);
    if (!e) return;
    set('es-country', e.country); set('es-region', e.region); set('es-product', e.product); set('es-plan', e.plan);
    set('es-kind', e.plan_kind); set('es-mb', e.data_mb); set('es-kbps', e.throttle_kbps); set('es-days', e.days);
    set('es-daymode', e.day_mode); set('es-network', e.network); set('es-operator', e.operator); set('es-apn', e.apn);
    $('#es-roam').checked = !!e.roaming; $('#es-sms').checked = !!e.sms; $('#es-calls').checked = !!e.calls;
    set('es-iccid', e.iccid); set('es-bal', e.balance_url); set('es-booking', e.booking_no);
    set('es-bought', e.purchased_on); set('es-by', e.activate_by); set('es-act', e.activated_at); set('es-tz', e.tz);
    set('es-disc', e.discount); set('es-paid', e.paid_with); set('es-via', e.booked_via); set('es-note', e.note);
    set('es-base', e.price_base); set('es-ext', e.extend_until);
    $('#es-lpa').placeholder = e.has_code ? e.lpa_masked + ' (оставьте пустым — код не изменится)' : 'LPA:1$smdp.io$…';
    priceFill(e, 'es-price', 'es-pcur', 'es-lprice', 'es-lcur');
  });
}
// Ключ дня — ЛОКАЛЬНЫМИ полями, не toISOString (правило CLAUDE.md).
const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* Раскрытие кода: запрос /secret, текст + QR в карточке. Ничего не пишется в хранилище;
   перерисовка вкладки (любая) код снова прячет. */
async function esimReveal(id) {
  const box = document.querySelector('[data-esim-code="' + id + '"]');
  if (!box) return;
  let d;
  try { d = await api('/esims/' + id + '/secret'); } catch (e) { return fail(e); }
  ESIM_OPEN = id;
  box.querySelector('[data-esim-show]').className = 'btn btn-sm';
  box.querySelector('[data-esim-hide]').className = 'tbtn btn-sm';
  box.querySelector('span').textContent = d.lpa;
  const q = document.createElement('div');
  q.className = 'esim-qr';
  q.innerHTML = await esimQrSvg(d.lpa) || '<div class="meta">QR не собрался — установите по коду вручную</div>';
  const cp = document.createElement('button');
  cp.className = 'tbtn btn-sm'; cp.textContent = 'Копировать код';
  cp.onclick = () => copyText(d.lpa);
  box.append(q, cp);
}
/* QR из LPA-строки. Кодер — тот же /assets/qrcode-gen.js, что у посадочного талона
   (trip-pass.js, loadQrLib). Чёрное на белом ЛИТЕРАЛАМИ, а не токенами темы: сканер камеры
   в «Настройки → Сотовая связь → Добавить eSIM» инверсию и низкий контраст не читает. */
async function esimQrSvg(text) {
  const lib = window.tripPass && window.tripPass.loadQrLib ? await window.tripPass.loadQrLib() : null;
  if (!lib) return '';
  const q = lib(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), quiet = 3, s = n + quiet * 2;
  let p = '';
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (q.isDark(i, j)) p += 'M' + (j + quiet) + ' ' + (i + quiet) + 'h1v1h-1z';
  return '<svg viewBox="0 0 ' + s + ' ' + s + '" width="220" height="220" shape-rendering="crispEdges" role="img" aria-label="QR-код установки eSIM">'
    + '<rect width="' + s + '" height="' + s + '" fill="#fff"/><path d="' + p + '" fill="#000"/></svg>';
}

/* Скан заказа: несколько скринов → JSON одним запросом (как бронь отеля), PDF — как есть
   (фото из него не нужно, модель читает PDF сама), текст — text/plain с X-Doc-Kind: text
   (как рейсы). Разбор ответа — один на три входа. */
function bindEsimScan() {
  const pick = $('#es-pick'), inp = $('#es-file'), tbtn = $('#es-pick-txt'), tbox = $('#es-txt'), tgo = $('#es-txt-go');
  if (!pick || !inp) return;
  const apply = d => {
    const e = d.esim || {};
    const put = (id, v) => { if (v !== '' && v != null) set(id, v); };
    put('es-country', e.country); put('es-region', e.region); put('es-product', e.product); put('es-plan', e.plan);
    put('es-kind', e.plan_kind); put('es-mb', e.data_mb); put('es-kbps', e.throttle_kbps); put('es-days', e.days);
    put('es-daymode', e.day_mode); put('es-network', e.network); put('es-operator', e.operator); put('es-apn', e.apn);
    if (e.sms !== '') $('#es-sms').checked = !!e.sms;
    if (e.calls !== '') $('#es-calls').checked = !!e.calls;
    put('es-lpa', e.lpa); put('es-iccid', e.iccid); put('es-bal', e.balance_url); put('es-booking', e.booking_no);
    put('es-bought', e.purchased_on); put('es-by', e.activate_by);
    put('es-disc', e.discount); put('es-paid', e.paid_with); put('es-note', e.note);
    put('es-base', e.price_base); put('es-ext', e.extend_until);
    put('es-via', vendorCanon(e.booked_via));
    priceFill(e, 'es-price', 'es-pcur', 'es-lprice', 'es-lcur', true);
    const warn = [];
    if (!e.lpa) warn.push('кода активации в тексте нет — если он только QR-картинкой, впишите строку LPA руками');
    if (e.iccid && e.iccid_luhn === false) warn.push('ICCID не сошёлся по контрольной цифре — сверьте');
    if (!e.operator) warn.push('оператор сети не указан — выберите, если знаете');
    note((e.dup_id ? 'Эта eSIM уже занесена — сохранение дополнит её. ' : 'Распознал. ')
      + (warn.length ? warn.join('; ') + '. ' : '') + 'Проверьте и сохраните.', !warn.length && !e.dup_id);
  };
  const run = async (body, headers) => {
    [pick, tbtn].forEach(b => b && (b.disabled = true));
    clearErr(); note('Читаю…');
    try {
      const r = await fetch(API + '/esim-scan', { method: 'POST', credentials: 'same-origin', headers, body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) throw new Error(d.message || d.error
        || (r.status === 413 ? 'файлы слишком тяжёлые для загрузки' : RESTARTING.includes(r.status) ? RESTART_MSG : 'сервер ответил HTTP ' + r.status));
      apply(d);
    } catch (e) { note('Не разобрал'); fail(e); }
    [pick, tbtn].forEach(b => b && (b.disabled = false));
  };
  pick.onclick = () => inp.click();
  inp.onchange = async () => {
    const picked = Array.from(inp.files || []).slice(0, 5);
    inp.value = '';
    if (!picked.length) return;
    note('Готовлю…');
    try {
      const small = [];
      for (const f of picked) small.push(/\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? { name: f.name, blob: f } : await shrink(f));
      if (small.length === 1) return run(small[0].blob, { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(small[0].name) });
      const files = await Promise.all(small.map(f => new Promise((ok, bad) => {
        const fr = new FileReader();
        fr.onload = () => ok({ name: f.name, data: String(fr.result).split(',')[1] });
        fr.onerror = () => bad(new Error('не прочитался файл ' + f.name));
        fr.readAsDataURL(f.blob);
      })));
      run(JSON.stringify({ files }), { 'Content-Type': 'application/json' });
    } catch (e) { fail(e); }
  };
  if (tbtn && tbox && tgo) {
    tbtn.onclick = () => { const on = tbox.style.display === 'none'; tbox.style.display = on ? 'block' : 'none'; if (on) $('#es-txta').focus(); };
    tgo.onclick = () => {
      const t = val('es-txta').trim();
      if (t.length < 10) return fail(new Error('вставьте письмо или текст заказа целиком'));
      run(t, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Doc-Kind': 'text' });
    };
  }
}
```

CSS в `<style>` страницы (не в ui.css — компонент раздела):

```css
/* eSIM (ADR-233): значок SIM у названия и QR установки. Цвет QR — литералы (см. esimQrSvg). */
.esim-ico{width:var(--ui-nav-ico,16px);height:var(--ui-nav-ico,16px);vertical-align:-3px;}
.esim-code span{font-family:ui-monospace,monospace;overflow-wrap:anywhere;}
.esim-qr{margin:8px 0;display:inline-block;padding:6px;background:#fff;border-radius:var(--ui-radius,8px);}
```

Проверить до выката: использует ли страница `data-pick` + `/pick.js` (правило «новый select — подключи
/pick.js и поставь data-pick»); если `/pick.js` на `trip.html` не подключён — либо подключить, либо (как
существующий `#pm-kind`) оставить обычный `select` без `data-pick` — решить по факту.

`trip-pass.js`: открыть загрузчик QR наружу, поднять `?v=` на `trip.html` (`/trip-pass.js?v=5` → `?v=6`):

```diff
-  window.tripPass = { open, render, UTM, utmContent, refUrl };
+  window.tripPass = { open, render, UTM, utmContent, refUrl, loadQrLib };   // loadQrLib — ещё и QR установки eSIM (ADR-233)
```

### 5.2 Значок `i-sim` в спрайт

Эмодзи 📶 запрещены (CLAUDE.md) — значок из спрайта. Нужного нет → добавить в `/assets/icons.svg` (Lucide
«card-sim», 24×24) и поднять `ICONS_V` в `server.js` (адрес спрайта `window.ICONS_URL` один на платформу;
фолбэк `?v=8` в модулях и `habits-sw.js` SHELL — поднять там же, где его поднимали в прошлый раз):

```xml
<symbol id="i-sim" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.172 2a2 2 0 0 1 1.414.586l3.828 3.828A2 2 0 0 1 20 7.828V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="8" y="10" width="8" height="8" rx="1"/><path d="M8 14h8"/><path d="M12 10v8"/></symbol>
```

### 5.3 Бейдж в карточке поездки (`trip_journeys.js` + `trip-journeys.js`)

Сервер — в `compute()` рядом со страховками (`trip_journeys.js:219`):

```js
    const esims = medDb.prepare('SELECT * FROM trip_esims WHERE profile_id=?').all(profileId);
    const esimUsed = new Set();
    ...
      // eSIM (28.09.2026, ADR-233): в поездку, если страна совпала с одной из точек маршрута и
      // дата (подключение → установка → покупка) в окне [начало − 30 дней, конец]. Покупают заранее,
      // поэтому окно назад шире, чем у своих расходов. Одна eSIM — в одну поездку.
      const legCountries = new Set(J.legs.flatMap(L => [L.to.country, L.from.country]).filter(Boolean).map(norm));
      const eDate = e => (e.activated_at || '').slice(0, 10) || e.installed_on || e.purchased_on || (e.created_at || '').slice(0, 10);
      const esimIn = [];
      for (const e of esims) {
        const d = eDate(e);
        if (esimUsed.has(e.id) || !isDate(d) || d > J.end || dnum(J.start) - dnum(d) > 30) continue;
        if (e.country && !legCountries.has(norm(e.country))) continue;
        esimUsed.add(e.id);
        esimIn.push(e);
        items.push(item({ kind: 'esim', id: e.id, cat: 'comm',
          title: 'eSIM · ' + [e.country || e.region, e.plan].filter(Boolean).join(' · '),
          amount: e.price, currency: e.price_currency, amount_local: e.price_local, currency_local: e.price_local_currency },
          e.purchased_on || d, 60, 1));
      }
      return { J, items, esimIn };
```

и в итоговом объекте поездки (`trip_journeys.js:268`) — краткая сводка для бейджа (статус и срок считает тот же
`esimState()`; его надо экспортировать из `trip.js` вместе с `esimLabel` и передать в `mountTripJourneys` через
`deps`, чтобы не держать второй копии логики сроков):

```js
        esims: esimIn.map(e => { const s = esimState(e); return { id: e.id, label: esimLabel(e), status: s.status,
          expires_at: s.expires_at, activate_by: e.activate_by }; }),
```

```diff
   // Поездки целиком + расходы по ним (21.09.2026) — сборка и ручки в trip_journeys.js.
-  mountTripJourneys(app, medDb, { pid, airport, tasksDb });
+  mountTripJourneys(app, medDb, { pid, airport, tasksDb, esimState, esimLabel });
```

(`esimState`/`esimLabel` — функции модуля `trip.js`, объявлены `function` — доступны по имени.)

Страница — в `cardHtml()` (`trip-journeys.js:84`), строкой под датами:

```js
    const ESIM_RU = { bought: 'куплена', installed: 'установлена', active: 'активна', expired: 'истекла' };
    const esimLine = (j.esims || []).map(e => '<span class="jr-chip jr-esim"><svg aria-hidden="true"><use href="'
      + (window.ICONS_URL || '/assets/icons.svg?v=8') + '#i-sim"></use></svg> eSIM: ' + esc(e.label) + ' · ' + ESIM_RU[e.status]
      + (e.status === 'active' && e.expires_at ? ' до ' + e.expires_at.slice(8, 10) + '.' + e.expires_at.slice(5, 7) + ' ' + e.expires_at.slice(11, 16)
        : e.status === 'bought' && e.activate_by ? ' · активировать до ' + RU(e.activate_by) : '') + '</span>').join('');
    ...
      + (esimLine ? '<div class="jr-sub" style="margin-top:6px;">' + esimLine + '</div>' : '')
```

CSS (в `jr-css`): `#jr .jr-esim svg{width:12px;height:12px;vertical-align:-2px;}`. Тап по бейджу → `go('esim')`
(`window.go` доступен со страницы) — по желанию.

Итог в карточке: «[SIM] eSIM: Египет 2 ГБ/день, 3 дня · активна до 05.10 14:10».

---

## 6. Связь с расходами

### 6.1 Рекомендуемый вариант — производный пункт (как страховка и виза)

Правки `trip_journeys.js`:

```diff
-export const CATS = { transport: 'Транспорт', stay: 'Жильё', food: 'Еда', fun: 'Развлечения', other: 'Прочее' };
+export const CATS = { transport: 'Транспорт', stay: 'Жильё', food: 'Еда', comm: 'Связь', fun: 'Развлечения', other: 'Прочее' };
```

```diff
 const BANK_CAT = [
   ['transport', …],
   ['stay', …],
   ['food', …],
+  // Связь (28.09.2026, ADR-233): eSIM, пополнение, роуминг. До «развлечений» и «прочего».
+  ['comm', /esim|e-sim|сим.?карт|sim.?card|airalo|holafly|yesim|nomad|ubigi|drimsim|роуминг|roaming|мобильн.*связ|сотов|пополнени.*телефон|top.?up|билайн|beeline|мтс|мегафон|megafon|tele2|теле2|\bais\b|dtac|truemove|turkcell|vodafone|orange|etisalat/i],
   ['fun', …]
 ];
```

`trip-journeys.js:7`:

```diff
-  const CAT_COLOR = { transport: '#00a0ff', stay: '#34d399', food: '#fbbf24', fun: '#f472b6', other: '#8a8a8a' };
+  const CAT_COLOR = { transport: '#00a0ff', stay: '#34d399', food: '#fbbf24', comm: '#a78bfa', fun: '#f472b6', other: '#8a8a8a' };
```

(`CAT_COLOR` — литералы и сейчас; перевод палитры на токены — отдельная задача, не в этой правке.)

Как это работает:
- Сумма eSIM живёт в ОДНОМ месте — `trip_esims.price`. В поездке она появляется пунктом `kind:'esim'`,
  категория «Связь». Итог поездки, полоса по категориям и «в день» пересчитываются сами.
- Выписка: пункт проходит через `matchTx()` — оплата картой с той же суммой ±0,5% в окне 60 дней назад
  получит метку «есть в выписке», и та же операция не придёт второй строкой из остатка выписки.
- Повторный импорт: `POST /esims` находит близнеца по `booking_no`/`iccid` и дозаполняет его — второй записи нет,
  значит и второго пункта нет. Уникальные индексы страхуют гонку.
- Категория «Связь» — просто новый ключ в `CATS`: справочника в `/refs` у трат поездок нет; ручной расход
  «Пополнил Vodafone» тоже можно отнести в «Связь» через шторку `+ Расход` (чипы берутся из `DATA.cats`).
- Правка/удаление — только из вкладки eSIM (у пункта нет кнопок «править/удалить», как у страховки).

### 6.2 Вариант из задания — строка `trip_expenses` + `expense_id`

Если Константину важно, чтобы eSIM была именно строкой расходов (править сумму в шторке расхода):

```js
  // trip_journeys.js → ensureJourneyTables: откуда пришла строка расхода
  const ec = medDb.prepare('PRAGMA table_info(trip_expenses)').all().map(c => c.name);
  if (!ec.includes('source')) medDb.exec('ALTER TABLE trip_expenses ADD COLUMN source TEXT');
  if (!ec.includes('source_id')) medDb.exec('ALTER TABLE trip_expenses ADD COLUMN source_id INTEGER');
  medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_expenses_source ON trip_expenses(profile_id, source, source_id)
    WHERE source IS NOT NULL`);
  // trip.js → trip_esims: + expense_id INTEGER (миграцией PRAGMA, если таблица уже создана)
```

После `INSERT`/`UPDATE` eSIM — upsert:
`INSERT INTO trip_expenses (profile_id, spent_on, category, title, amount, currency, amount_local, currency_local, source, source_id)
 VALUES (…,'comm',…,'esim',:id) ON CONFLICT(profile_id, source, source_id) WHERE source IS NOT NULL DO UPDATE SET …`
→ `UPDATE trip_esims SET expense_id=?`. На `DELETE` eSIM — удалить строку расхода. В `compute()` пункт `esim`
НЕ добавлять (иначе двойной счёт), бейдж — оставить.

Почему не рекомендую: сумма живёт в двух местах; правка суммы в шторке расхода разъедется с карточкой eSIM
(нужно либо запрещать правку строк `source='esim'`, либо писать обратно); страховки и визы устроены иначе
(ADR-222), и на обзоре появятся два способа учёта «документных» трат.

---

## 7. План правок по файлам

| # | Файл | Правка | Рестарт |
|---|---|---|---|
| 1 | `web/trip.js` | `VIA_TABLES` + `trip_esims`; таблица и индексы в `ensureTripTables`; `ESIM_PROMPT`; `lpaParse/lpaBuild/iccidNorm/dataMb/speedKbps/curCode/normMoment`; `momentToUtc/utcToMoment/esimState/esimLabel`; `takeFiles`, `esimTwin`, `esimBody`, `esimView`; ручки `/esims` (GET/POST/PATCH/DELETE), `/esims/:id/secret`, `/esim-scan`; `REF_ACTIVITY` + `esims` (если да); `mountTripJourneys(..., { esimState, esimLabel })` | `pm2 restart web-interface` |
| 2 | `web/server.js` | `RAW_BODY_RE` → `(scan|esim-scan)`; `encSecret, decSecret` в deps `mountTrip`; `ICONS_V` +1 | да |
| 3 | `web/trip_journeys.js` | `CATS.comm`; `BANK_CAT` comm; пункт `esim` и `esims` в `compute()` | да |
| 4 | `web/public/trip.html` | вкладка, `go()`, `paintEsim`, `esimReveal`, `esimQrSvg`, `bindEsimScan`, `localDay`, CSS; `trip-pass.js?v=6`; `trip-journeys.js?v=`+1 | нет (статика) |
| 5 | `web/public/trip-pass.js` | экспорт `loadQrLib` | нет |
| 6 | `web/public/trip-journeys.js` | `CAT_COLOR.comm`; бейдж eSIM в `cardHtml`; CSS `.jr-esim` | нет |
| 7 | `web/public/assets/icons.svg` | `<symbol id="i-sim">` | нет, но `ICONS_V` |
| 8 | `docs/ADR/ADR-233-trip-esim.md` | черновик §8, затем `node scripts/migrate-ard.js` и `node scripts/validate-ard.js` | — |
| 9 | `docs/CHANGELOG.md`, VERSION модуля trip (ADR-099) | запись; версию платформы не поднимать без просьбы | — |

Порядок выката: 1–3 (сервер, `node --check web/trip.js web/trip_journeys.js web/server.js`, рестарт, смотреть `↺`
в pm2) → проверка `get_api GET /api/profile/me/trip/esims` (пустой список) → 4–7 (статика) → ручной прогон на
тексте Trip.com из задания (ожидаемо: country «Египет», plan_kind daily, data_mb 2048, throttle 512, days 3,
day_mode rolling24, smdp smdp.io, iccid 8948010010094791430 luhn:true, booking_no 1539367401113525,
activate_by 2026-11-26, extend_until 2026-11-27 19:25:38, uses 1, price 339.80 RUB, price_base 357.69,
discount 17.89, paid_with Trip Coins, booked_via Trip.com, sms/calls 0) → повторный импорт того же текста
(ожидаемо: `dup_id`, при сохранении `merged:true`) → карточка поездки на «Обзоре» с бейджем.

Правила CLAUDE.md, которые правка обязана соблюсти (сверено):
- прод — только `write_file`/`str_replace`; в `new_str` без `$&`, `` $` ``, `$'`, `$1` — **в этом коде есть `$`
  внутри LPA-регулярок и строк (`'LPA:1$'`, `/^LPA:1\$…/`)**: безопасно, пока за `$` не идёт `&`, `` ` ``, `'` или
  цифра. В `'LPA:1$' + p.smdp` за `$` идёт `'` — это **`$'`, опасная пара!** При вставке через `str_replace`
  переписать как `'LPA:1' + '$' + …` или `'LPA:1$'` и перечитать кусок после правки.
- `r.ok` проверяется перед `r.json()` — в `bindEsimScan` через `if (!r.ok || d.ok === false)`, как в `bindDocScan`;
- «Сохранить» не закрывает карточку — форма вкладки инлайновая, как у страховки (закрывать нечего);
- удаление — существующий `bindRows` (он на `confirm()`; перевод раздела на `uiConfirm` — отдельно, не здесь);
- ключ дня — локальными полями (`localDay`), момент — `sv-SE` в поясе;
- приватные данные — замок + пара кнопок «Показать/Скрыть», режим НЕ запоминается (разовый показ в хранилище не
  пишется, при перерисовке закрыто).

---

## 8. Черновик ADR-233

```markdown
---
id: ADR-233
title: eSIM в «Путешествиях» — своя таблица, распознавание заказа тремя входами, код активации шифром, траты в «Связь»
status: proposed
date: 2026-09-28
domain: platform
depends_on: [ADR-201, ADR-204, ADR-222]
related: [ADR-158]
---

# ADR-233: eSIM в «Путешествиях» (28.09.2026)

## Контекст
Туристическая eSIM (Trip.com, Airalo…) — тот же «документ поездки», что полис и виза: у неё есть
тариф, срок, цена и данные для установки (LPA-строка, ICCID, ссылка на баланс). Держать её в заметках
неудобно: срок считается не по датам, а по часам от активации (3 дня = 72 ч), код установки — секрет.

## Решение
1. Таблица `trip_esims` (med.sqlite), владелец схемы — `trip.js`. Сущности «поездка» нет — eSIM
   попадает в поездку при сборке (`trip_journeys.js`) по стране маршрута и дате, как страховка.
2. Статус (куплена/установлена/активна/истекла) и окончание НЕ хранятся — считает сервер на GET
   (`esimState`): `activated_at` + days × 24 ч в поясе страны (`rolling24`) или конец календарного дня.
3. Распознавание — `POST …/trip/esim-scan`: файл, до 5 файлов JSON-ом или вставленный текст, один
   конвейер с остальными сканами раздела (sniffMime, file_uploads, ai_calls, ai_generations,
   белый список). LPA из текста дополнительно ловится регуляркой. Ручка идёт мимо глобального
   express.json (RAW_BODY_RE, как /trip/scan по ADR-204).
4. Код активации шифруется encSecret (AES-256-GCM, ключ сейфа доступов), в списке — маска,
   целиком — `GET …/esims/:id/secret` по кнопке. PIN заказа и контакты не распознаются и не хранятся.
5. Склейка повторного импорта — частичные уникальные индексы (profile_id, booking_no) и
   (profile_id, iccid); POST с близнецом дозаполняет его.
6. Траты: новая категория `comm: 'Связь'` в `CATS`; eSIM — производный пункт поездки (как полис
   и виза, ADR-222), строка в trip_expenses не заводится — сумма живёт в одном месте.
7. QR установки — из LPA-строки тем же qrcode-gen.js, что у посадочного талона (ADR-158).

## Последствия
+ Срок eSIM виден «осталось 41 ч», бейдж в карточке поездки, траты на связь отдельной категорией.
+ Повторная загрузка того же заказа не плодит записи и расходы.
− Ключ сейфа доступов теперь защищает и данные пациентов: смена ключа ломает расшифровку кодов eSIM.
− QR-картинку со скрина модель не читает: если LPA есть только картинкой, строку вписывают руками
  (декодера QR на платформе нет).

## Отвергнуто
- Строка в trip_expenses с expense_id/source='esim' — второй источник суммы (см. проект §6.2).
- Хранить статус колонкой — разъезжался бы с часами; статус — функция от дат.
- Хранить код открытым текстом — это ключ установки чужой eSIM.
```

---

## 9. Открытые вопросы

1. **Расход: производный пункт (рекомендую) или строка `trip_expenses` с `expense_id`/`source='esim'`?** (§6)
2. **Оплата Trip Coins.** Баллы — это деньги? Если заказ оплачен баллами целиком, считать ли 339,80 ₽ тратой
   поездки (сейчас — да, `price` попадает в итог) или вести `paid_with='Trip Coins'` как «без списания» и не
   считать? Возможен флаг `paid_points INTEGER`.
3. **Шифрование ключом сейфа доступов** (`/home/cashruflow/.access_key`) для данных пациентов — ок, или завести
   отдельный ключ для пациентских секретов? Отдельный — чище (утечка/смена одного не задевает другое).
4. **Хранить ли ICCID открыто?** Он нужен для ссылки баланса и склейки; сейчас — открыто, в UI маской. Можно
   хранить хэш для склейки + шифр для показа.
5. **Контакты (имя/телефон/email) и PIN** — предлагаю НЕ хранить вовсе (по правилам раздела). Нужны хотя бы маски?
6. **QR на скрине вместо текста.** Декодера на платформе нет. Варианты: `BarcodeDetector` в браузере (Android
   Chrome — да, iOS Safari — нет) до отправки на сервер; или вендорить `jsQR` (~130 КБ) в `/vendor/`. Нужно?
7. **Оператор сети** — свободный текст с подсказками (datalist) или справочник `/refs` по стране (правило
   «выпадающий список — только справочником `/refs`»)? Datalist — это подсказка, а не выпадающий список, но
   если нужен фильтр/статистика по операторам — справочник.
8. **Автоотметка в чек-листе** «SIM или eSIM» (`CHECKLIST_SEED`, группа «Деньги и связь») при сохранении eSIM
   для привязанной поездки — делать?
9. **Реф-награда**: считать сохранение eSIM «первой записью» Trip-реферала (`REF_ACTIVITY`)?
10. **Уведомления**: «eSIM истекает через 6 ч» / «активируйте до 26.11» в Telegram (`tgSend`) — нужно? Сейчас
    только в интерфейсе.
11. **Перевод `/trip/scan` на общий `takeFiles()`** — отдельной правкой после выката eSIM (регресс-риск для отелей).
12. `GET …/vendor-stats` (стр. 3629) — не читал целиком: проверить, подхватит ли он `trip_esims` из `VIA_TABLES`
    сам или нужен явный `esims` + подпись в `KIND` (`trip.html:782`).
13. `data-pick` / `/pick.js` на `trip.html` — не проверял подключение; у существующих `select` раздела
    (`#pm-kind`) `data-pick` нет.
