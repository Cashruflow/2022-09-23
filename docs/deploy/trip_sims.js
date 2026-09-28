// «Связь» в «Путешествиях» (28.09.2026, ADR-233): купленные SIM и eSIM для поездки.
//
// ТАБЛИЦА trip_sims (med.sqlite), владелец схемы — этот модуль. kind — 'esim' | 'sim'.
// У физической SIM нет кода активации: LPA-колонки сервер для неё обнуляет.
//
// СЕКРЕТЫ. Код активации eSIM (matching ID из LPA-строки) — это ключ установки: кто его знает,
// ставит себе чужую карту. Хранится шифром AES-256-GCM ключом TRIP_SIM_KEY из окружения
// (/home/cashruflow/mcp-server/.env, читается dotenv в server.js). Ключ в код не пишется и не
// генерируется. Нет ключа — модуль РАБОТАЕТ: запись сохраняется без кода, человек видит причину;
// открытым текстом код не пишется никогда. PIN заказа и контакты покупателя не распознаются и
// не хранятся — полей под них нет. ICCID и номер линии хранятся открыто (склейка дублей, ссылка
// на баланс), но наружу в списке уходят только маской; целиком — отдельной ручкой /reveal.
//
// СТАТУС (куплена / установлена / активна / истекла) не хранится — считает GET по датам в поясе
// SIM: окончание = активация + days × 24 ч (rolling24) или конец календарного дня (calendar).
//
// ДЕНЬГИ. Цена SIM — СТРОКА trip_expenses (category='comm' «Связь», source='sim', source_id=id).
// SIM — владелец: строка создаётся/обновляется при каждом сохранении SIM (syncSimExpense),
// удаляется вместе с SIM, в ручках /expenses она только для чтения (trip_journeys.js).
// Upsert — обычным SELECT → UPDATE/INSERT в транзакции, без ON CONFLICT … WHERE.
// Оплата баллами (Trip Coins) — тоже трата (решение Константина 28.09.2026).
//
// НАПОМИНАНИЯ в Telegram (@Ai_dcf_bot, как паузы привычек в habits.js): за сутки до конца
// пакета, в момент конца, за remind_days до «активировать до» и в этот день. Флаги *_sent_at
// ставятся ДО отправки — повторов нет даже при сбое. Физическая SIM без срока — без напоминаний.

import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { tgSend } from "../lib/tg.mjs";

// Знак доллара константой: литерал рядом с кавычкой ломает правку через str_replace (CLAUDE.md).
const DLR = String.fromCharCode(36);
export const SIM_KIND_RU = { sim: "SIM", esim: "eSIM" };

// ---------- схема ----------
export function ensureSimTables(medDb) {
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_sims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'esim',
    country TEXT, region TEXT, product TEXT, plan TEXT, network TEXT,
    plan_kind TEXT NOT NULL DEFAULT 'daily',
    data_mb INTEGER, throttle_kbps INTEGER, days INTEGER,
    day_mode TEXT NOT NULL DEFAULT 'rolling24',
    sms INTEGER NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0, dual_sim INTEGER NOT NULL DEFAULT 0,
    phone TEXT, operator TEXT, operator_src TEXT, operator_id INTEGER, apn TEXT,
    roaming INTEGER NOT NULL DEFAULT 1,
    smdp TEXT, code_enc TEXT, code_tail TEXT, lpa_oid TEXT, confirm_required INTEGER NOT NULL DEFAULT 0,
    iccid TEXT, balance_url TEXT, booking_no TEXT, order_status TEXT,
    purchased_on TEXT, activate_by TEXT, extend_until TEXT, uses INTEGER,
    installed_on TEXT, activated_at TEXT, tz TEXT,
    price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT,
    price_base REAL, discount REAL, paid_with TEXT, booked_via TEXT, note TEXT,
    device_id INTEGER,
    trip_leg TEXT, trip_manual INTEGER NOT NULL DEFAULT 0,
    expense_id INTEGER,
    remind_days INTEGER NOT NULL DEFAULT 1,
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
  } catch (e) { console.error("trip_sims unique:", e.message); }
}

// ---------- нормализация ----------
// LPA по GSMA SGP.22: LPA:1$<SM-DP+>$<matching ID>[$<OID>[$<флаг кода подтверждения>]].
export function lpaParse(raw) {
  const s = String(raw == null ? "" : raw).replace(/\s+/g, "").replace(/^lpa:/i, "LPA:");
  const parts = s.split(DLR);
  if (parts[0] !== "LPA:1" || parts.length < 3 || parts.length > 5) return null;
  const smdp = parts[1].toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}(:\d{1,5})?$/.test(smdp)) return null;
  const code = parts[2] || "";
  if (code && !/^[A-Za-z0-9._-]{1,255}$/.test(code)) return null;
  const conf = parts[4] || "";
  if (conf && conf !== "0" && conf !== "1") return null;
  return { smdp, code, oid: parts[3] || "", confirm: conf === "1" };
}
export const lpaBuild = p => !p || !p.smdp ? "" : ["LPA:1", p.smdp, p.code || ""]
  .concat(p.oid || p.confirm ? [p.oid || ""] : []).concat(p.confirm ? ["1"] : []).join(DLR);
// Первая LPA-строка из свободного текста (письмо): модель могла ошибиться в символе кода.
function lpaFind(text) {
  const t = String(text || "");
  const i = t.search(/LPA:1/i);
  if (i < 0) return null;
  const m = /^[^\s<>"']+/.exec(t.slice(i));
  return m ? lpaParse(m[0]) : null;
}
const luhnOk = d => { let t = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
// ICCID: 19–20 цифр, начинается с 89. Неверный Luhn — предупреждение, не отказ.
export function iccidNorm(raw) {
  const d = String(raw == null ? "" : raw).replace(/\D/g, "");
  if (d.length < 19 || d.length > 20 || !d.startsWith("89")) return { iccid: "", luhn: null };
  return { iccid: d, luhn: luhnOk(d) };
}
// Номер линии: «+» и 7–15 цифр (E.164).
export function phoneNorm(raw) {
  const s = String(raw == null ? "" : raw).trim();
  const d = s.replace(/\D/g, "");
  if (d.length < 7 || d.length > 15) return "";
  return (s.startsWith("+") ? "+" : "") + d;
}
export function dataMb(raw, numAmount) {
  const m = /([\d.,]+)\s*(tb|тб|gb|гб|mb|мб)/i.exec(String(raw || ""));
  if (!m) return null;
  const n = numAmount(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  const u = m[2].toLowerCase();
  return Math.round(n * (/t|т/.test(u) ? 1048576 : /g|г/.test(u) ? 1024 : 1));
}
export function speedKbps(raw, numAmount) {
  const m = /([\d.,]+)\s*(kbps|kbit|кбит|mbps|mbit|мбит)/i.exec(String(raw || ""));
  if (!m) return null;
  const n = numAmount(m[1]);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(/^m|^м/i.test(m[2]) ? n * 1000 : n);
}
export function curCode(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return "";
  if (/₽|руб|rub|rur/i.test(s)) return "RUB";
  if (s.includes(DLR) || /usd/i.test(s)) return "USD";
  if (/€|eur/i.test(s)) return "EUR";
  return s.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}
function normMoment(raw, normDate) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(raw || "").trim());
  if (!m || !normDate(m[1]) || +m[2] > 23 || +m[3] > 59 || +(m[4] || 0) > 59) return null;
  return m[1] + " " + m[2].padStart(2, "0") + ":" + m[3] + ":" + (m[4] || "00");
}
// Маска числа: первые 4 и последние 4 цифры, середина — две группы звёзд (8948 **** **** 1430).
export function maskDigits(s) {
  const d = String(s || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 8) return "*".repeat(Math.max(0, d.length - 2)) + d.slice(-2);
  return d.slice(0, 4) + " **** **** " + d.slice(-4);
}
// Код страны по префиксу E.164: однозначные 1 и 7, двузначные — из списка, остальные трёхзначные.
const CC2 = new Set(["20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49",
  "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86",
  "90", "91", "92", "93", "94", "95", "98"]);
// Маска номера (решение 28.09.2026): код страны + 3 цифры кода оператора/города + звёзды +
// последние 4 цифры: +7 963 ***-45-03. Код страны не распознан — первые 4 символа.
export function maskPhone(s) {
  const raw = String(s || "").trim();
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (!raw.startsWith("+") || d.length < 9) return raw.slice(0, 4) + "*".repeat(Math.max(3, d.length - 8)) + d.slice(-4);
  const cc = d[0] === "1" || d[0] === "7" ? d.slice(0, 1) : CC2.has(d.slice(0, 2)) ? d.slice(0, 2) : d.slice(0, 3);
  const nat = d.slice(cc.length);
  if (nat.length < 8) return raw.slice(0, 4) + "*".repeat(Math.max(3, d.length - 8)) + d.slice(-4);
  const tail = nat.slice(-4);
  return "+" + cc + " " + nat.slice(0, 3) + " " + "*".repeat(nat.length - 7) + "-" + tail.slice(0, 2) + "-" + tail.slice(2);
}

// ---------- промт распознавания ----------
const SIM_PROMPT = `Ты извлекаешь данные о купленной сим-карте для поездки — физической SIM или eSIM — из
подтверждения заказа (скриншоты, PDF, текст письма) или фото упаковки/карточки SIM. Экранов может быть
несколько — это ОДИН заказ, собери одну запись.
Верни ТОЛЬКО JSON, без markdown:
{"kind":"","country":"","region":"","product":"","plan":"","network":"","plan_kind":"","data_per_day":"","data_total":"","throttle":"","days":"","day_mode":"","sms":null,"calls":null,"dual_sim":null,"phone":"","operator":"","apn":"","lpa":"","smdp":"","activation_code":"","iccid":"","balance_url":"","booking_no":"","order_status":"","purchased_on":"","activate_by":"","extend_until":"","uses":"","price":"","price_currency":"","price_base":"","discount":"","price_local":"","price_local_currency":"","paid_with":"","booked_via":"","note":""}
Правила:
- kind — "esim", если это eSIM (есть LPA, QR-код для установки, SM-DP+, слово eSIM); "sim" — если это
  пластиковая SIM-карта. Не ясно — "esim".
- country — страна действия на русском. region — если план на несколько стран: «Европа, 33 страны».
- product — название продукта как написано; plan — название тарифа как написано; network — 4G/5G.
- plan_kind: "daily" — объём на сутки (Daily, в день); "total" — на весь срок; "unlimited" — безлимит.
  data_per_day / data_total — объём как написан ("2GB").
- throttle — скорость после исчерпания лимита как написана ("512kbps").
- days — срок пакета в днях числом. day_mode — "rolling24", если сутки = 24 часа от активации или
  «обновление каждые 24 часа»; "calendar" — календарные сутки; не сказано — пустая строка.
- sms, calls — true/false, если прямо сказано, включены ли SMS и звонки; не сказано — null.
  dual_sim — true, если написано Dual SIM.
- phone — номер телефона САМОЙ купленной SIM, если напечатан как номер линии. Телефон покупателя
  из контактов заказа сюда НЕ класть.
- operator — оператор сети в стране, только если назван. apn — APN, если напечатан.
- lpa — строка активации eSIM ЦЕЛИКОМ, начинается с «LPA:1». smdp — адрес SM-DP+. activation_code —
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

// ---------- монтирование ----------
// deps — помощники trip.js (передаются из mountTrip, своей копии здесь нет): pid, tasksDb,
// logUpload, logAiCall, logGeneration, ask, parseJson, cost, purgeScansLazy, apiKey, SCAN_MODEL,
// consts {MAX_BYTES, MAX_FILES, UP_DIR, KEEP_HOURS, TEXT_MAX, COUNTRY_MAX, PASTE_MAX, SCAN_MIME},
// sniffMime, numAmount, normDate, addDays, localToUtc, COUNTRY_TZ, vendorResolve.
export function mountTripSims(app, medDb, deps) {
  const { pid, tasksDb, logUpload, logAiCall, logGeneration, ask, parseJson, cost, purgeScansLazy,
    SCAN_MODEL, sniffMime, numAmount, normDate, addDays, localToUtc, COUNTRY_TZ, vendorResolve } = deps;
  const { MAX_BYTES, MAX_FILES, UP_DIR, KEEP_HOURS, TEXT_MAX, COUNTRY_MAX, PASTE_MAX, SCAN_MIME } = deps.consts;
  const hasKey = () => !!deps.apiKey;
  ensureSimTables(medDb);
  const P = "/api/profile/:profileId/trip";
  const str = (v, max) => { const s = String(v == null ? "" : v).trim().replace(/\s+/g, " "); return s ? s.slice(0, max) : null; };
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  const dnum = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
  const todayMsk = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });

  // ---------- шифр кода активации: свой ключ модуля, не ключ сейфа доступов ----------
  const SIM_KEY = (() => {
    const raw = String(process.env.TRIP_SIM_KEY || "").trim();
    if (!raw) { console.error("[trip] TRIP_SIM_KEY не задан — коды активации eSIM сохраняться не будут"); return null; }
    const k = Buffer.from(raw, "base64");
    if (k.length !== 32) { console.error("[trip] TRIP_SIM_KEY: нужно 32 байта в base64, получено " + k.length); return null; }
    return k;
  })();
  function simSeal(txt) {
    if (!SIM_KEY || !txt) return null;
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", SIM_KEY, iv);
    const ct = Buffer.concat([c.update(String(txt), "utf8"), c.final()]);
    return ["v1", iv.toString("hex"), c.getAuthTag().toString("hex"), ct.toString("hex")].join(":");
  }
  function simOpen(blob) {
    if (!SIM_KEY || !blob) return null;
    try {
      const [v, iv, tag, ct] = String(blob).split(":");
      if (v !== "v1") return null;
      const d = crypto.createDecipheriv("aes-256-gcm", SIM_KEY, Buffer.from(iv, "hex"));
      d.setAuthTag(Buffer.from(tag, "hex"));
      return Buffer.concat([d.update(Buffer.from(ct, "hex")), d.final()]).toString("utf8");
    } catch (e) { return null; }
  }

  // ---------- сроки и статус ----------
  function momentToUtc(moment, tz) {
    const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(moment || ""));
    if (!m) return null;
    let base = null;
    try { base = localToUtc(m[1], m[2] + ":" + m[3], tz); } catch (e) { return null; }
    return base == null ? null : base + (+m[4]) * 1000;
  }
  const utcToMoment = (ms, tz) => new Date(ms).toLocaleString("sv-SE", { timeZone: tz, hourCycle: "h23" }).replace("T", " ");
  const simTz = s => s.tz || COUNTRY_TZ[s.country] || "Europe/Moscow";
  const dayIn = (tz, ms) => new Date(ms || Date.now()).toLocaleDateString("sv-SE", { timeZone: tz });
  function simExpiresMs(s) {
    if (!s.activated_at || !(s.days > 0)) return null;
    const tz = simTz(s), a = momentToUtc(s.activated_at, tz);
    if (a == null) return null;
    return s.day_mode === "calendar"
      ? momentToUtc(addDays(s.activated_at.slice(0, 10), s.days - 1) + " 23:59:59", tz)
      : a + s.days * 86400e3;
  }
  function simState(s, nowMs = Date.now()) {
    const tz = simTz(s), exp = simExpiresMs(s);
    let nextReset = null;
    if (exp != null && s.day_mode !== "calendar") {
      const a = momentToUtc(s.activated_at, tz), k = Math.floor((nowMs - a) / 86400e3) + 1, t = a + k * 86400e3;
      if (nowMs >= a && t < exp) nextReset = t;
    }
    // Подключение в будущем (вписали заранее) — ещё не «активна».
    const actMs = s.activated_at ? momentToUtc(s.activated_at, tz) : null;
    const status = s.activated_at && !(actMs != null && nowMs < actMs) ? (exp != null && nowMs >= exp ? "expired" : "active")
      : (s.activate_by && dayIn(tz, nowMs) > s.activate_by ? "expired" : s.installed_on ? "installed" : "bought");
    return { tz, status,
      expires_at: exp != null ? utcToMoment(exp, tz) : null,
      hours_left: status === "active" && exp != null ? Math.max(0, Math.floor((exp - nowMs) / 3600e3)) : null,
      next_reset_at: nextReset != null ? utcToMoment(nextReset, tz) : null,
      never_activated: !s.activated_at && status === "expired" };
  }
  const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;
  function simLabel(s) {
    const gb = s.data_mb ? (s.data_mb >= 1024 ? +(s.data_mb / 1024).toFixed(1) + " ГБ" : s.data_mb + " МБ") : "";
    const vol = s.plan_kind === "unlimited" ? "безлимит" : gb ? gb + (s.plan_kind === "daily" ? "/день" : "") : "";
    const d = s.days ? s.days + " " + plural(s.days, "день", "дня", "дней") : "";
    return [s.country || s.region || (SIM_KIND_RU[s.kind] || "eSIM"), [vol, d].filter(Boolean).join(", ")].filter(Boolean).join(" ");
  }

  // ---------- строка расхода «Связь» ----------
  // Владелец — SIM. Цена есть → строка есть (одна: SELECT → UPDATE или INSERT, уникальный индекс
  // (profile_id, source, source_id) страхует гонку); цены нет → строки нет. Вызывается внутри
  // транзакции POST/PATCH SIM.
  function syncSimExpense(profileId, simId) {
    const s = medDb.prepare("SELECT * FROM trip_sims WHERE id=? AND profile_id=?").get(simId, profileId);
    if (!s) return;
    const cur = medDb.prepare("SELECT id FROM trip_expenses WHERE profile_id=? AND source='sim' AND source_id=?").get(profileId, simId);
    const amount = s.price != null && s.price > 0 ? s.price : null;
    const local = s.price_local != null && s.price_local > 0 ? s.price_local : null;
    if (!amount && !local) {
      if (cur) medDb.prepare("DELETE FROM trip_expenses WHERE id=?").run(cur.id);
      if (s.expense_id != null) medDb.prepare("UPDATE trip_sims SET expense_id=NULL WHERE id=?").run(simId);
      return;
    }
    // Дата траты — день покупки: по нему операция сходится с выпиской.
    const spent = [s.purchased_on, (s.activated_at || "").slice(0, 10), s.installed_on, String(s.created_at || "").slice(0, 10)]
      .find(isDate) || todayMsk();
    const row = {
      spent_on: spent, category: "comm",
      title: (SIM_KIND_RU[s.kind] || "eSIM") + " · " + simLabel(s),
      amount, currency: amount ? (s.price_currency || "RUB") : null,
      amount_local: local, currency_local: local ? s.price_local_currency : null,
      note: [s.paid_with ? "оплачено: " + s.paid_with : "", s.booked_via || ""].filter(Boolean).join(" · ") || null
    };
    const cols = Object.keys(row);
    let id;
    if (cur) {
      medDb.prepare(`UPDATE trip_expenses SET ${cols.map(k => k + "=?").join(", ")}, updated_at=datetime('now') WHERE id=?`)
        .run(...cols.map(k => row[k]), cur.id);
      id = cur.id;
    } else {
      const all = { profile_id: profileId, source: "sim", source_id: simId, ...row };
      const ks = Object.keys(all);
      id = medDb.prepare(`INSERT INTO trip_expenses (${ks.join(", ")}) VALUES (${ks.map(() => "?").join(",")})`)
        .run(...ks.map(k => all[k])).lastInsertRowid;
    }
    if (id !== s.expense_id) medDb.prepare("UPDATE trip_sims SET expense_id=? WHERE id=?").run(id, simId);
  }

  // ---------- тело записи ----------
  const SIM_TEXT = { country: COUNTRY_MAX, region: TEXT_MAX, product: TEXT_MAX, plan: TEXT_MAX, network: 8,
    operator: 60, apn: 60, order_status: 30, paid_with: 40, note: TEXT_MAX };
  const SIM_INT = ["data_mb", "throttle_kbps", "days", "uses"];
  const SIM_FLAG = ["sms", "calls", "dual_sim", "roaming"];
  const SIM_MONEY = ["price", "price_local", "price_base", "discount"];
  const SIM_LPA_COLS = ["smdp", "code_enc", "code_tail", "lpa_oid", "confirm_required"];
  // Поменялись сроки — напоминания заново (иначе продлённая SIM молчала бы: флаг уже стоит).
  const SIM_WHEN = ["activated_at", "days", "day_mode", "tz", "activate_by", "installed_on", "remind_days"];
  function simBody(profileId, body, base) {
    const b = base || {}, out = {}, warn = [];
    const has = k => body && body[k] !== undefined;
    const err = (error, message) => ({ error: { error, message } });
    out.kind = has("kind") ? (body.kind === "sim" ? "sim" : "esim") : (b.kind || "esim");
    for (const [k, max] of Object.entries(SIM_TEXT)) out[k] = has(k) ? str(body[k], max) : (b[k] ?? null);
    for (const k of SIM_INT) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      const n = parseInt(String(body[k] ?? "").replace(/\D/g, ""), 10);
      out[k] = Number.isFinite(n) && n > 0 ? n : null;
    }
    for (const k of SIM_FLAG) out[k] = has(k) ? (body[k] === true || body[k] === 1 || body[k] === "1" ? 1 : 0)
      : (b[k] ?? (k === "roaming" ? (out.kind === "esim" ? 1 : 0) : 0));
    for (const k of SIM_MONEY) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      if (String(body[k] ?? "").trim() === "") { out[k] = null; continue; }
      const n = numAmount(body[k]);
      if (!isFinite(n) || n < 0) return err("bad_amount", "Сумма — число");
      out[k] = Math.round(n * 100) / 100;
    }
    for (const k of ["price_currency", "price_local_currency"]) out[k] = has(k) ? (curCode(body[k]) || null) : (b[k] ?? null);
    if (out.price != null && !out.price_currency) out.price_currency = "RUB";
    out.plan_kind = has("plan_kind") ? (["daily", "total", "unlimited"].includes(body.plan_kind) ? body.plan_kind : "daily") : (b.plan_kind || "daily");
    out.day_mode = has("day_mode") ? (body.day_mode === "calendar" ? "calendar" : "rolling24") : (b.day_mode || "rolling24");
    out.operator_src = has("operator") ? (out.operator ? (body.operator_src === "doc" ? "doc" : "manual") : null) : (b.operator_src ?? null);
    if (has("phone")) {
      out.phone = phoneNorm(body.phone) || null;
      if (String(body.phone || "").trim() && !out.phone) return err("bad_phone", "Номер — 7–15 цифр, можно с +");
    } else out.phone = b.phone ?? null;
    for (const k of ["purchased_on", "activate_by", "installed_on"]) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      const v = String(body[k] || "").trim();
      out[k] = v ? normDate(v) : null;
      if (v && !out[k]) return err("bad_date", "Даты в формате ГГГГ-ММ-ДД");
    }
    for (const k of ["activated_at", "extend_until"]) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      const v = String(body[k] || "").trim();
      out[k] = v ? normMoment(v, normDate) : null;
      if (v && !out[k]) return err("bad_moment", "Время в формате ГГГГ-ММ-ДД ЧЧ:ММ");
    }
    out.tz = has("tz") ? (str(body.tz, 40) || null) : (b.tz ?? null);
    if (out.tz) { try { new Intl.DateTimeFormat("en", { timeZone: out.tz }); } catch (e) { return err("bad_tz", "Неизвестный часовой пояс"); } }
    if (!out.tz && out.country) out.tz = COUNTRY_TZ[out.country] || null;
    if (has("iccid")) {
      const ic = iccidNorm(body.iccid);
      if (String(body.iccid || "").trim() && !ic.iccid) return err("bad_iccid", "ICCID — 19–20 цифр, начинается с 89");
      out.iccid = ic.iccid || null;
    } else out.iccid = b.iccid ?? null;
    out.booking_no = has("booking_no") ? (String(body.booking_no || "").replace(/[^\w-]/g, "").slice(0, 40) || null) : (b.booking_no ?? null);
    if (has("balance_url")) {
      const x = String(body.balance_url || "").trim().slice(0, 300);
      out.balance_url = !x ? null : /^https?:\/\//i.test(x) ? x : (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(x) ? "https://" + x : null);
    } else out.balance_url = b.balance_url ?? null;
    if (has("remind_days")) {
      const n = parseInt(String(body.remind_days ?? ""), 10);
      out.remind_days = Number.isFinite(n) ? Math.max(0, Math.min(60, n)) : 1;
    } else out.remind_days = b.remind_days ?? 1;
    // Привязка к поездке — по плечу: 'f<id>' | 'r<id>' | 'none'; null — автоподбор.
    if (has("trip_leg")) {
      const v = body.trip_leg == null ? "" : String(body.trip_leg).trim();
      if (!v) { out.trip_leg = null; out.trip_manual = 0; }
      else if (v === "none") { out.trip_leg = "none"; out.trip_manual = 1; }
      else {
        const m = /^([fr])(\d+)$/.exec(v);
        if (!m) return err("bad_trip", "Неизвестная поездка");
        const t = m[1] === "f" ? "trip_flights" : "trip_rides";
        if (!medDb.prepare(`SELECT 1 FROM ${t} WHERE id=? AND profile_id=?`).get(+m[2], profileId)) return err("bad_trip", "Поездка не найдена");
        out.trip_leg = v; out.trip_manual = 1;
      }
    } else { out.trip_leg = b.trip_leg ?? null; out.trip_manual = b.trip_manual ?? 0; }
    if (has("booked_via")) out.booked_via = vendorResolve(medDb, body.booked_via) || null;
    else out.booked_via = b.booked_via ?? null;
    // Код активации — только у eSIM. Физическая SIM: все LPA-колонки обнуляются.
    if (out.kind === "sim") Object.assign(out, { smdp: null, code_enc: null, code_tail: null, lpa_oid: null, confirm_required: 0 });
    else if (has("lpa")) {
      const s = String(body.lpa || "").trim();
      if (!s) Object.assign(out, { smdp: null, code_enc: null, code_tail: null, lpa_oid: null, confirm_required: 0 });
      else {
        const p = lpaParse(s);
        if (!p) return err("bad_lpa", "Код активации — строка вида LPA:1, адрес SM-DP+ и код через знак доллара");
        const sealed = p.code ? simSeal(p.code) : null;
        if (p.code && !sealed) warn.push("code_skipped");   // нет ключа: код не сохраняем, остальное — да
        Object.assign(out, { smdp: p.smdp, code_enc: sealed, code_tail: sealed ? p.code.slice(-4) : null,
          lpa_oid: p.oid || null, confirm_required: p.confirm ? 1 : 0 });
      }
    } else for (const k of SIM_LPA_COLS) out[k] = b[k] ?? (k === "confirm_required" ? 0 : null);
    if (!out.country && !out.region && !out.product && !out.booking_no && !out.iccid && !out.phone)
      return err("empty", "Укажите страну, тариф, номер заказа, ICCID или номер телефона");
    if (base && SIM_WHEN.some(k => String(out[k] ?? "") !== String(b[k] ?? "")))
      Object.assign(out, { notify_pre_sent_at: null, notify_end_sent_at: null, notify_actby_pre_sent_at: null, notify_actby_sent_at: null, notify_error: null });
    return { row: out, warn };
  }
  const tail4 = s => s ? "···" + String(s).slice(-4) : "";
  const simView = r => {
    const { code_enc, iccid, phone, ...rest } = r;
    return Object.assign(rest, simState(r), {
      kind_ru: SIM_KIND_RU[r.kind] || "eSIM", label: simLabel(r), has_code: !!code_enc,
      lpa_masked: r.kind === "esim" && r.smdp && r.code_tail ? ["LPA:1", r.smdp, tail4(r.code_tail)].join(DLR) : "",
      has_iccid: !!iccid, iccid_masked: maskDigits(iccid),
      has_phone: !!phone, phone_masked: maskPhone(phone) });
  };
  const simGet = id => simView(medDb.prepare("SELECT * FROM trip_sims WHERE id=?").get(id));
  function simTwin(profileId, booking_no, iccid, exceptId) {
    const q = (col, v) => v ? medDb.prepare(`SELECT * FROM trip_sims WHERE profile_id=? AND ${col}=? AND id<>?`).get(profileId, v, exceptId || 0) : null;
    return q("booking_no", booking_no) || q("iccid", iccid) || null;
  }

  // ---------- ручки ----------
  app.get(P + "/sims", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const rows = medDb.prepare(`SELECT * FROM trip_sims WHERE profile_id=?
        ORDER BY COALESCE(activated_at, purchased_on, created_at) DESC, id DESC`).all(profileId).map(simView);
      const t = todayMsk();
      res.json({ ok: true, on: t, key_ok: !!SIM_KEY, sims: rows,
        active: rows.filter(r => r.status === "active").length,
        soon: rows.filter(r => r.status !== "expired" && !r.activated_at && r.activate_by && dnum(r.activate_by) - dnum(t) <= 14).length });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get(P + "/sims/:id/secret", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const r = medDb.prepare("SELECT kind, smdp, code_enc, lpa_oid, confirm_required FROM trip_sims WHERE id=? AND profile_id=?").get(req.params.id, profileId);
    if (!r || r.kind !== "esim") return res.status(404).json({ ok: false, error: "not_found" });
    if (!r.code_enc) return res.status(404).json({ ok: false, error: "no_code", message: "Код активации не сохранён" });
    if (!SIM_KEY) return res.status(503).json({ ok: false, error: "no_key", message: "Не настроен ключ шифрования (TRIP_SIM_KEY)" });
    const code = simOpen(r.code_enc);
    if (code == null) return res.status(500).json({ ok: false, error: "decrypt", message: "Код не расшифровался — ключ сменился, вставьте код заново" });
    res.json({ ok: true, lpa: lpaBuild({ smdp: r.smdp, code, oid: r.lpa_oid, confirm: !!r.confirm_required }) });
  });

  // Показ ICCID или номера целиком — по нажатию «глаза».
  app.get(P + "/sims/:id/reveal", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const f = req.query.f === "phone" ? "phone" : req.query.f === "iccid" ? "iccid" : null;
    if (!f) return res.status(400).json({ ok: false, error: "bad_field" });
    const r = medDb.prepare(`SELECT ${f} v FROM trip_sims WHERE id=? AND profile_id=?`).get(req.params.id, profileId);
    if (!r) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, value: r.v || "" });
  });

  app.post(P + "/sims", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const d = simBody(profileId, req.body, null);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      const twin = simTwin(profileId, d.row.booking_no, d.row.iccid);
      let id, merged = false, filled = [];
      medDb.transaction(() => {
        if (twin) {
          // Повторный импорт той же брони: дозаполняем пустые поля занесённой записи.
          const fill = Object.fromEntries(Object.entries(d.row).filter(([k, v]) => v != null && v !== ""
            && (twin[k] == null || twin[k] === "") && !k.startsWith("notify_")));
          if (Object.keys(fill).length) medDb.prepare(`UPDATE trip_sims SET ${Object.keys(fill).map(k => k + "=?").join(", ")},
            updated_at=datetime('now') WHERE id=?`).run(...Object.values(fill), twin.id);
          id = twin.id; merged = true; filled = Object.keys(fill);
        } else {
          const row = { profile_id: profileId, ...d.row };
          const cols = Object.keys(row);
          id = medDb.prepare(`INSERT INTO trip_sims (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(",")})`)
            .run(...cols.map(k => row[k])).lastInsertRowid;
        }
        syncSimExpense(profileId, id);
      })();
      res.json({ ok: true, merged, filled, code_skipped: d.warn.includes("code_skipped"), sim: simGet(id) });
    } catch (e) {
      if (/UNIQUE/.test(e.message)) return res.status(409).json({ ok: false, error: "dup", message: "Эта SIM уже занесена" });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.patch(P + "/sims/:id", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = medDb.prepare("SELECT * FROM trip_sims WHERE id=? AND profile_id=?").get(req.params.id, profileId);
      if (!cur) return res.status(404).json({ ok: false, error: "not_found" });
      const d = simBody(profileId, req.body, cur);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      if (simTwin(profileId, d.row.booking_no, d.row.iccid, cur.id))
        return res.status(409).json({ ok: false, error: "dup", message: "Другая SIM уже с этим номером заказа или ICCID" });
      const cols = Object.keys(d.row);
      medDb.transaction(() => {
        medDb.prepare(`UPDATE trip_sims SET ${cols.map(k => k + "=?").join(", ")}, updated_at=datetime('now') WHERE id=?`)
          .run(...cols.map(k => d.row[k]), cur.id);
        syncSimExpense(profileId, cur.id);
      })();
      res.json({ ok: true, code_skipped: d.warn.includes("code_skipped"), sim: simGet(cur.id) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete(P + "/sims/:id", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = medDb.prepare("SELECT id FROM trip_sims WHERE id=? AND profile_id=?").get(req.params.id, profileId);
      if (!cur) return res.status(404).json({ ok: false, error: "not_found" });
      medDb.transaction(() => {
        // Строка расхода живёт ровно столько, сколько SIM: удаляем обе одной транзакцией.
        medDb.prepare("DELETE FROM trip_expenses WHERE profile_id=? AND source='sim' AND source_id=?").run(profileId, cur.id);
        medDb.prepare("DELETE FROM trip_sims WHERE id=?").run(cur.id);
      })();
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- распознавание: файл, до 5 файлов (JSON) или текст (X-Doc-Kind: text) ----------
  // Приём файлов — копия логики /trip/scan (многостраничная бронь); /scan на неё не переведён.
  function takeFiles(req, res, noteOne, noteMany) {
    purgeScansLazy();
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (!body.length) { res.status(400).json({ ok: false, error: "файл не дошёл до сервера — попробуйте ещё раз" }); return null; }
    const cleanName = raw => String(raw || "screen").replace(/[^\w.\-А-Яа-яЁё ]/g, "_").slice(0, 120);
    const files = [];
    if (String(req.headers["content-type"] || "").includes("application/json")) {
      let parsed;
      try { parsed = JSON.parse(body.toString("utf8")); } catch (e) { res.status(400).json({ ok: false, error: "не разобрал тело запроса" }); return null; }
      const list = Array.isArray(parsed?.files) ? parsed.files.slice(0, MAX_FILES) : [];
      if (!list.length) { res.status(400).json({ ok: false, error: "нет файлов" }); return null; }
      for (const f of list) {
        const buf = Buffer.from(String(f?.data || ""), "base64");
        if (!buf.length) { res.status(400).json({ ok: false, error: "пустой файл: " + cleanName(f?.name) }); return null; }
        files.push({ name: cleanName(f?.name), buf });
      }
    } else {
      let n = "screen";
      try { n = decodeURIComponent(req.headers["x-file-name"] || "screen"); } catch (e) {}
      files.push({ name: cleanName(n), buf: body });
    }
    for (const f of files) {
      f.ext = (f.name.split(".").pop() || "").toLowerCase();
      const sniff = sniffMime(f.buf);
      f.mime = sniff.mime || (sniff.heic ? null : SCAN_MIME[f.ext] || null);
      if (!f.mime) {
        res.status(415).json({ ok: false, error: sniff.heic
          ? "снимок «" + f.name + "» в формате HEIC — модель его не читает. Переснимите в JPEG или пришлите скриншот"
          : "формат не поддерживается: " + (f.ext || "без расширения") });
        return null;
      }
    }
    const uploadIds = [];
    for (const f of files) {
      try {
        const full = path.join(UP_DIR, crypto.randomBytes(8).toString("hex") + "." + f.ext);
        fs.writeFileSync(full, f.buf);
        const id = logUpload({ kind: "trip", file_name: f.name, file_size: f.buf.length, status: "ok",
          note: files.length > 1 ? noteMany + " (" + files.length + " стр.)" : noteOne, storage_path: full,
          expires_at: new Date(Date.now() + KEEP_HOURS * 3600e3).toISOString().slice(0, 19).replace("T", " ") });
        if (id) uploadIds.push(id);
      } catch (e) { console.error("trip sim scan save:", e.message); }
    }
    return { files, uploadIds, uploadId: uploadIds[0] || null, label: files.map(f => f.name).join(", ").slice(0, 160) };
  }

  app.post(P + "/sim-scan", express.raw({ type: "*/*", limit: MAX_BYTES }), async (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    if (!hasKey()) return res.status(500).json({ ok: false, error: "нет ANTHROPIC_API_KEY" });
    const isText = String(req.headers["x-doc-kind"] || "").toLowerCase() === "text";
    let got = null, pasted = "";
    if (isText) {
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
      pasted = buf.toString("utf8").trim().slice(0, PASTE_MAX);
      if (pasted.length < 10) return res.status(400).json({ ok: false, error: "текста слишком мало — вставьте письмо целиком" });
    } else {
      got = takeFiles(req, res, "заказ SIM/eSIM → распознавание", "заказ SIM/eSIM");
      if (!got) return;
    }
    const label = isText ? "вставленный текст" : got.label;
    const started = Date.now();
    let u, raw;
    try {
      const content = isText ? [{ type: "text", text: SIM_PROMPT + "\n\nТЕКСТ:\n" + pasted }]
        : [...got.files.map(f => ({ type: f.mime === "application/pdf" ? "document" : "image",
            source: { type: "base64", media_type: f.mime, data: f.buf.toString("base64") } })),
          { type: "text", text: SIM_PROMPT }];
      u = await ask(content, 1500);
      raw = parseJson(u.text);
    } catch (e) {
      if (got && tasksDb) for (const id of got.uploadIds) {
        try { tasksDb.prepare("UPDATE file_uploads SET status='error', note=? WHERE id=?").run(String(e.message).slice(0, 300), id); } catch (x) {}
      }
      logAiCall("trip_sim", isText ? null : "upload", got?.uploadId || null, null, SCAN_MODEL, 0, 0, 0,
        { note: label, durationMs: Date.now() - started, error: e.message });
      logGeneration("trip_sim", "Заказ SIM: " + label, "", "", null, "error", e.message);
      return res.status(502).json({ ok: false, error: "распознать не удалось: " + e.message, upload_ids: got?.uploadIds || [] });
    }
    // Белый список — вторая линия защиты: PIN, имя, почта и телефон покупателя наружу не уйдут.
    const S = v => String(v == null ? "" : v).trim().slice(0, TEXT_MAX);
    const B = v => v === true || v === "true" ? 1 : v === false || v === "false" ? 0 : "";
    const kind = raw?.kind === "sim" ? "sim" : "esim";
    let lpa = null;
    if (kind === "esim") {
      if (isText) lpa = lpaFind(pasted);
      if (!lpa) lpa = lpaParse(raw?.lpa);
      if (!lpa && raw?.smdp && raw?.activation_code) lpa = lpaParse(["LPA:1", raw.smdp, raw.activation_code].join(DLR));
    }
    const ic = iccidNorm(raw?.iccid);
    const pk = ["daily", "total", "unlimited"].includes(raw?.plan_kind) ? raw.plan_kind : (raw?.data_per_day ? "daily" : raw?.data_total ? "total" : "");
    const money = v => { const n = numAmount(v); return isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : ""; };
    const sim = {
      kind, country: S(raw?.country).slice(0, COUNTRY_MAX), region: S(raw?.region),
      product: S(raw?.product), plan: S(raw?.plan), network: S(raw?.network).toUpperCase().slice(0, 8),
      plan_kind: pk, data_mb: String(dataMb(pk === "total" ? raw?.data_total : raw?.data_per_day, numAmount) || ""),
      throttle_kbps: String(speedKbps(raw?.throttle, numAmount) || ""),
      days: String(raw?.days || "").replace(/\D/g, "").slice(0, 3),
      day_mode: ["rolling24", "calendar"].includes(raw?.day_mode) ? raw.day_mode : "",
      sms: B(raw?.sms), calls: B(raw?.calls), dual_sim: B(raw?.dual_sim),
      phone: phoneNorm(raw?.phone), operator: S(raw?.operator).slice(0, 60),
      apn: S(raw?.apn).replace(/[^\w.\-]/g, "").slice(0, 60),
      lpa: lpa ? lpaBuild(lpa) : "", smdp: lpa ? lpa.smdp : "",
      iccid: ic.iccid, iccid_luhn: ic.luhn,
      balance_url: (() => { const x = S(raw?.balance_url); return /^https?:\/\/[\w.-]+\.[a-z]{2,}/i.test(x) ? x.slice(0, 300) : ""; })(),
      booking_no: S(raw?.booking_no).replace(/[^\w-]/g, "").slice(0, 40), order_status: S(raw?.order_status).slice(0, 30),
      purchased_on: normDate(raw?.purchased_on) || "", activate_by: normDate(raw?.activate_by) || "",
      extend_until: normMoment(raw?.extend_until, normDate) || "", uses: String(raw?.uses || "").replace(/\D/g, "").slice(0, 3),
      price: money(raw?.price), price_currency: curCode(raw?.price_currency),
      price_base: money(raw?.price_base), discount: money(raw?.discount),
      price_local: money(raw?.price_local), price_local_currency: curCode(raw?.price_local_currency),
      paid_with: S(raw?.paid_with).slice(0, 40),
      booked_via: vendorResolve(medDb, S(raw?.booked_via), false) || "", note: S(raw?.note)
    };
    logAiCall("trip_sim", isText ? null : "upload", got?.uploadId || null, null, SCAN_MODEL, u.inTok, u.outTok, cost(u),
      { note: label, durationMs: Date.now() - started });
    if (!sim.country && !sim.product && !sim.lpa && !sim.iccid && !sim.booking_no && !sim.phone) {
      logGeneration("trip_sim", "Заказ SIM: " + label, "ни одного поля не распознано", "", u, "error", "в документе нет данных SIM");
      return res.status(422).json({ ok: false, upload_ids: got?.uploadIds || [],
        error: isText ? "в тексте не нашлось данных SIM — вставьте письмо целиком или заполните поля руками"
          : "на снимке не нашлось данных SIM — снимите заказ целиком или заполните поля руками" });
    }
    const twin = simTwin(profileId, sim.booking_no, sim.iccid);
    if (twin) sim.dup_id = twin.id;
    const genId = logGeneration("trip_sim", "Заказ " + SIM_KIND_RU[kind] + ": " + simLabel({ ...sim, data_mb: +sim.data_mb, days: +sim.days }),
      [sim.country, sim.plan, sim.booked_via].filter(Boolean).join(" · "),
      // В общий журнал код, ICCID, номер заказа и телефон — только хвостом.
      JSON.stringify({ ...sim, lpa: lpa ? ["LPA:1", lpa.smdp, tail4(lpa.code)].join(DLR) : "",
        iccid: tail4(sim.iccid), booking_no: tail4(sim.booking_no), phone: tail4(sim.phone) }, null, 2), u, "ok");
    res.json({ ok: true, sim, upload_ids: got?.uploadIds || [], generation_id: genId });
  });

  // ---------- напоминания в Telegram (образец — pauseTick в habits.js) ----------
  let AI_DCF_TOKEN = null;   // та же копия, что в habits.js и pair.js — общий модуль не выделяем (решение 28.09.2026)
  const aiDcfToken = () => {
    if (AI_DCF_TOKEN != null) return AI_DCF_TOKEN;
    AI_DCF_TOKEN = (process.env.TELEGRAM_BOT_TOKEN_AI_DCF || "").trim();
    if (!AI_DCF_TOKEN) {
      try {
        const line = fs.readFileSync("/home/cashruflow/mcp-server/.env", "utf8").split("\n").find(l => l.startsWith("TELEGRAM_BOT_TOKEN_AI_DCF="));
        AI_DCF_TOKEN = line ? line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "") : "";
      } catch (e) { AI_DCF_TOKEN = ""; }
    }
    return AI_DCF_TOKEN;
  };
  async function sendToProfile(profileId, text) {
    const link = medDb.prepare(`SELECT l.chat_id FROM patient_telegram_links l JOIN patient_accounts a ON a.id=l.account_id
      WHERE a.profile_id=? AND l.chat_id IS NOT NULL ORDER BY l.consumed_at DESC LIMIT 1`).get(profileId);
    if (link && aiDcfToken()) return tgSend(aiDcfToken(), link.chat_id, text, { buttons: [[{ text: "Открыть «Связь»", url: "https://ai.cashruflow.ru/trip/app" }]] });
    if (profileId === 1 && process.env.TELEGRAM_BOT_TOKEN_CASHRUFLOW && process.env.TG_CHAT_ID)
      return tgSend(process.env.TELEGRAM_BOT_TOKEN_CASHRUFLOW.trim(), process.env.TG_CHAT_ID.trim(), text);
    return "нет привязанного Telegram у профиля " + profileId;
  }
  const RU_D = d => d ? d.slice(8, 10) + "." + d.slice(5, 7) : "";
  const RU_DT = m => m ? RU_D(m.slice(0, 10)) + " " + m.slice(11, 16) : "";
  let simTickBusy = false;
  async function simTick() {
    if (simTickBusy) return;
    simTickBusy = true;
    try {
      const now = Date.now();
      // Кандидаты — только с заполненным сроком (физическая SIM без срока напоминаний не получает).
      const rows = medDb.prepare(`SELECT * FROM trip_sims WHERE
        (activated_at IS NOT NULL AND days > 0 AND (notify_pre_sent_at IS NULL OR notify_end_sent_at IS NULL))
        OR (activated_at IS NULL AND activate_by IS NOT NULL AND (notify_actby_pre_sent_at IS NULL OR notify_actby_sent_at IS NULL))`).all();
      for (const s of rows) {
        const tz = simTz(s);
        let hour = 12;
        try { hour = +new Date(now).toLocaleString("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }); } catch (e) {}
        if (hour < 9 || hour >= 22) continue;   // тихие часы — по местному времени SIM
        const day = dayIn(tz, now);
        const name = (SIM_KIND_RU[s.kind] || "eSIM") + " " + simLabel(s);
        const exp = simExpiresMs(s);
        let flag = null, text = null;
        if (exp != null) {
          if (!s.notify_end_sent_at && now >= exp && now - exp <= 12 * 3600e3) {
            flag = "notify_end_sent_at"; text = name + " закончилась. Мобильный интернет по ней больше не работает.";
            if (!s.notify_pre_sent_at) medDb.prepare("UPDATE trip_sims SET notify_pre_sent_at=datetime('now') WHERE id=?").run(s.id);
          } else if (!s.notify_pre_sent_at && now < exp && exp - now <= 24 * 3600e3) {
            const em = utcToMoment(exp, tz);
            flag = "notify_pre_sent_at";
            text = name + " истекает " + (em.slice(0, 10) === day ? "сегодня" : "завтра") + " в " + em.slice(11, 16) + " (по местному)."
              + (s.extend_until ? " Продлить можно до " + RU_DT(s.extend_until) + "." : "");
          }
        } else if (!s.activated_at && s.activate_by) {
          const left = dnum(s.activate_by) - dnum(day);
          if (!s.notify_actby_sent_at && left === 0) {
            flag = "notify_actby_sent_at"; text = name + ": сегодня последний день, когда её можно активировать.";
            if (!s.notify_actby_pre_sent_at) medDb.prepare("UPDATE trip_sims SET notify_actby_pre_sent_at=datetime('now') WHERE id=?").run(s.id);
          } else if (!s.notify_actby_pre_sent_at && left > 0 && left <= (s.remind_days ?? 1)) {
            flag = "notify_actby_pre_sent_at";
            text = name + ": активировать нужно до " + RU_D(s.activate_by) + " (осталось " + left + " " + plural(left, "день", "дня", "дней") + ").";
          }
        }
        if (!flag) continue;
        // Метка ДО отправки — повторного сообщения не будет даже при сбое (как pinged_at у пауз).
        medDb.prepare(`UPDATE trip_sims SET ${flag}=datetime('now'), notify_error=NULL WHERE id=?`).run(s.id);
        const e = await sendToProfile(s.profile_id, text);
        if (e) {
          medDb.prepare("UPDATE trip_sims SET notify_error=? WHERE id=?").run(String(e).slice(0, 300), s.id);
          console.error("[trip] напоминание SIM #" + s.id + ":", e);
        }
      }
    } catch (e) { console.error("[trip] simTick:", e.message); }
    finally { simTickBusy = false; }
  }
  setTimeout(simTick, 90 * 1000);
  setInterval(simTick, 30 * 60 * 1000);

  return { simState, simLabel, SIM_KIND_RU };
}
