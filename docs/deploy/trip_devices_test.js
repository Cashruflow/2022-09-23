// «Мои устройства», справочник операторов и регистрация телефона в стране (28.09.2026, ADR-233,
// этап 2). Живёт во вкладке eSIM раздела «Путешествия»; владелец таблиц — этот модуль.
//
//   trip_devices       — телефоны: название, модель, IMEI1/IMEI2, EID, MEID, серийный номер.
//   trip_operators     — операторы связи по странам (общий справочник, как trip_vendors:
//                        заводит любой, правит и удаляет админ). APN подставляется в форму SIM.
//   trip_sim_countries — по странам: нужна ли регистрация телефона. ТОЛЬКО ручная отметка
//                        (по умолчанию 'unknown'): правила стран платформа фактом не утверждает.
//   trip_imei_regs     — оформленная регистрация телефона в стране: срок, цена (строка расхода
//                        «Связь», source='imei_reg'), квитанция, напоминание за remind_days (7).
//
// ИДЕНТИФИКАТОРЫ (IMEI, EID, MEID, серийный) — шифром AES-256-GCM ключом TRIP_SIM_KEY (simKeyring
// из trip_sims.js), в списке — маской с «глазом». Дубли телефона — по HMAC-SHA256 от IMEI
// отдельным производным ключом (HKDF), а не по хешу с солью и не bcrypt: значения нужно показывать
// целиком (кража, заявление, регистрация), а IMEI перебирается даже через bcrypt (~10^6 на модель).
// Без ключа устройство сохраняется без идентификаторов (ids_skipped), открытым текстом — никогда.
//
// Браузер IMEI прочитать не может: человек набирает *#06# и вставляет текст или скрин —
// распознавание тем же конвейером, что заказ SIM (ask/parseJson/журналы), IMEI проверяется по Луну,
// IMEISV (16 цифр) переводится в IMEI (14 цифр + контрольная).

const express = { raw: () => (q, r, n) => { const ch=[]; q.on("data",c=>ch.push(c)); q.on("end",()=>{ q.body=Buffer.concat(ch); n(); }); } };
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { tgSend } from "./stub.mjs";
import { simKeyring, maskDigits, curCode } from "./trip_sims_test.js";
import { paySourceOf, payUnits } from "./pay_sources.js";

// ---------- схема ----------
export function ensureDeviceTables(medDb) {
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    name TEXT,
    model TEXT,
    imei1_enc TEXT, imei1_tail TEXT, imei1_hash TEXT,
    imei2_enc TEXT, imei2_tail TEXT, imei2_hash TEXT,
    eid_enc TEXT, eid_tail TEXT,
    esim_ok INTEGER NOT NULL DEFAULT 0,
    meid_enc TEXT, meid_tail TEXT,
    serial_enc TEXT, serial_tail TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE INDEX IF NOT EXISTS idx_trip_devices_profile ON trip_devices(profile_id)`);
  try {
    medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_devices_imei1 ON trip_devices(profile_id, imei1_hash) WHERE imei1_hash IS NOT NULL`);
    medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_devices_imei2 ON trip_devices(profile_id, imei2_hash) WHERE imei2_hash IS NOT NULL`);
  } catch (e) { console.error("trip_devices unique:", e.message); }

  // Сида НЕТ намеренно: названия сетей и APN меняются, а выдуманный APN хуже пустого.
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country TEXT NOT NULL,
    name TEXT NOT NULL,
    network TEXT,
    apn TEXT,
    site TEXT,
    aliases TEXT,
    sort INTEGER DEFAULT 100,
    source TEXT DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_operators ON trip_operators(country, name)`);

  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_sim_countries (
    country TEXT PRIMARY KEY,
    imei_reg TEXT NOT NULL DEFAULT 'unknown',
    imei_reg_note TEXT,
    imei_reg_url TEXT,
    checked_on TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_imei_regs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    imei_slot TEXT NOT NULL DEFAULT '1',
    country TEXT NOT NULL,
    reg_on TEXT,
    valid_until TEXT,
    price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT,
    paid_with TEXT,
    pay_source_id INTEGER,
    receipt_url TEXT,
    note TEXT,
    trip_leg TEXT, trip_manual INTEGER NOT NULL DEFAULT 0,
    expense_id INTEGER,
    remind_days INTEGER NOT NULL DEFAULT 7,
    notify_pre_sent_at TEXT, notify_end_sent_at TEXT, notify_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE INDEX IF NOT EXISTS idx_trip_imei_regs_profile ON trip_imei_regs(profile_id, valid_until)`);
  try {
    const have = medDb.prepare("PRAGMA table_info(trip_imei_regs)").all().map(c => c.name);
    if (!have.includes("pay_source_id")) medDb.exec("ALTER TABLE trip_imei_regs ADD COLUMN pay_source_id INTEGER");
  } catch (e) { console.error("trip_imei_regs pay_source_id:", e.message); }
}

// ---------- нормализация ----------
const luhnOk = d => { let t = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const luhnDigit = d14 => { for (let c = 0; c < 10; c++) if (luhnOk(d14 + c)) return String(c); return null; };
// IMEI: 15 цифр с верной контрольной по Луну. IMEISV (16 цифр, «35 123456 789012 3 / 01») контрольной
// не имеет: берём первые 14 и считаем контрольную сами.
export function imeiNorm(raw) {
  const d = String(raw == null ? "" : raw).replace(/\D/g, "");
  if (!d) return { imei: "", ok: false, empty: true };
  if (d.length === 15) return luhnOk(d) ? { imei: d, ok: true } : { imei: "", ok: false, why: "контрольная цифра IMEI не сходится" };
  if (d.length === 16) return { imei: d.slice(0, 14) + luhnDigit(d.slice(0, 14)), ok: true, from_sv: true };
  if (d.length === 14) return { imei: d + luhnDigit(d), ok: true, from_14: true };
  return { imei: "", ok: false, why: "IMEI — 15 цифр" };
}
// EID: 32 цифры, начинается с 89; контрольные — ISO/IEC 7064 MOD 97-10 (остаток 1).
// Не сошлось — предупреждение, не отказ.
export function eidNorm(raw) {
  const d = String(raw == null ? "" : raw).replace(/\D/g, "");
  if (!d) return { eid: "", ok: false, empty: true };
  if (d.length !== 32 || !d.startsWith("89")) return { eid: "", ok: false, why: "EID — 32 цифры, начинается с 89" };
  let r = 0; for (const ch of d) r = (r * 10 + +ch) % 97;
  return { eid: d, ok: true, check: r === 1 };
}
// MEID: 14 шестнадцатеричных символов (иногда с 15-м проверочным).
export function meidNorm(raw) {
  const s = String(raw == null ? "" : raw).toUpperCase().replace(/[^0-9A-F]/g, "");
  if (!s) return "";
  return s.length === 14 || s.length === 15 ? s.slice(0, 14) : "";
}
const serialNorm = raw => String(raw == null ? "" : raw).toUpperCase().replace(/[^0-9A-Z-]/g, "").slice(0, 40);
const maskText = s => !s ? "" : s.length <= 4 ? "*".repeat(s.length) : s.slice(0, 2) + "*".repeat(Math.max(3, s.length - 6)) + s.slice(-4);

// Из текста экрана *#06#: цифры берём по подписям строк, модель — запасной источник.
export function idsFromText(text) {
  const out = { imei1: "", imei2: "", eid: "", meid: "", serial: "" };
  const lines = String(text || "").split(/\r?\n/);
  const imeis = [];
  lines.forEach((ln, i) => {
    const next = lines[i + 1] || "";
    const val = s => (s.replace(/^[^:]*:/, "").match(/[0-9][0-9 /-]{12,}[0-9]/) || [""])[0];
    if (/\bIMEI\s*SV\b/i.test(ln)) return;
    if (/\bIMEI\b/i.test(ln)) { const v = val(ln) || val(next); if (v) imeis.push(v); }
    else if (/\bEID\b/i.test(ln)) { const v = (ln + " " + next).replace(/\D/g, " ").match(/89\d{30}/); if (v && !out.eid) out.eid = v[0]; }
    else if (/\bMEID\b/i.test(ln)) { const v = (ln.replace(/^[^:]*:/, "") || next).toUpperCase().match(/[0-9A-F]{14}/); if (v && !out.meid) out.meid = v[0]; }
  });
  if (!imeis.length) (String(text || "").match(/\b\d{15,16}\b/g) || []).forEach(v => imeis.push(v));
  const uniq = [...new Set(imeis.map(v => imeiNorm(v).imei).filter(Boolean))];
  out.imei1 = uniq[0] || ""; out.imei2 = uniq[1] || "";
  return out;
}

const DEVICE_PROMPT = `Ты извлекаешь идентификаторы телефона с экрана *#06#, из «Настройки → Об устройстве» или
с коробки телефона. Верни ТОЛЬКО JSON, без markdown:
{"model":"","imei1":"","imei2":"","eid":"","meid":"","serial":""}
Правила:
- imei1, imei2 — IMEI (15 цифр) или IMEISV (16 цифр), только цифры. Если IMEI один — imei2 пустая.
- eid — EID (32 цифры), только цифры; нет — пустая строка. meid — MEID (14 символов 0-9A-F).
- serial — серийный номер как напечатан. model — модель, если видна.
- Чего нет — пустая строка. Не выдумывай. Номер телефона, имя владельца, Apple ID и почту не возвращай.`;

// ---------- монтирование ----------
// deps — те же помощники trip.js, что у mountTripSims, плюс isAdmin, vendorKey и simState/simLabel/
// SIM_KIND_RU из mountTripSims (сроки SIM считаются в одном месте).
export function mountTripDevices(app, medDb, deps) {
  const { pid, tasksDb, logUpload, logAiCall, logGeneration, ask, parseJson, cost, purgeScansLazy,
    SCAN_MODEL, sniffMime, numAmount, normDate, COUNTRY_TZ, isAdmin, vendorKey } = deps;
  const { MAX_BYTES, MAX_FILES, UP_DIR, KEEP_HOURS, TEXT_MAX, COUNTRY_MAX, PASTE_MAX, SCAN_MIME } = deps.consts;
  const simState = deps.simState || (() => ({})), simLabel = deps.simLabel || (s => s.country || "SIM");
  const SIM_KIND_RU = deps.SIM_KIND_RU || { sim: "SIM", esim: "eSIM" };
  ensureDeviceTables(medDb);
  const KR = simKeyring();
  const P = "/api/profile/:profileId/trip";
  const str = (v, max) => { const s = String(v == null ? "" : v).trim().replace(/\s+/g, " "); return s ? s.slice(0, max) : null; };
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  const dnum = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
  const todayMsk = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  const err = (res, code, error, message) => res.status(code).json({ ok: false, error, message: message || error });
  const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;
  const key = s => (vendorKey ? vendorKey(s) : String(s || "").toLowerCase().trim());

  // ================= устройства =================
  // Поле-идентификатор: [колонка, нормализатор → {v, warn}, маска].
  const IDS = {
    imei1: [v => { const r = imeiNorm(v); return r.empty ? { v: "" } : r.ok ? { v: r.imei, warn: r.from_sv ? "IMEISV → IMEI" : null } : { bad: r.why }; }, maskDigits],
    imei2: [v => { const r = imeiNorm(v); return r.empty ? { v: "" } : r.ok ? { v: r.imei, warn: r.from_sv ? "IMEISV → IMEI" : null } : { bad: r.why }; }, maskDigits],
    eid: [v => { const r = eidNorm(v); return r.empty ? { v: "" } : r.ok ? { v: r.eid, warn: r.check ? null : "контрольные цифры EID не сошлись — сверьте" } : { bad: r.why }; }, maskDigits],
    meid: [v => { const s = String(v == null ? "" : v).trim(); if (!s) return { v: "" }; const m = meidNorm(s); return m ? { v: m } : { bad: "MEID — 14 символов 0-9 и A-F" }; }, maskText],
    serial: [v => ({ v: serialNorm(v) }), maskText]
  };
  function deviceBody(profileId, body, base) {
    const b = base || {}, out = {}, warn = [];
    const has = k => body && body[k] !== undefined;
    out.name = has("name") ? str(body.name, 60) : (b.name ?? null);
    out.model = has("model") ? str(body.model, 80) : (b.model ?? null);
    out.note = has("note") ? str(body.note, TEXT_MAX) : (b.note ?? null);
    for (const [f, [norm]] of Object.entries(IDS)) {
      if (!has(f)) continue;
      const r = norm(body[f]);
      if (r.bad) return { error: { error: "bad_" + f, message: r.bad } };
      if (r.warn) warn.push(r.warn);
      if (!r.v) { out[f + "_enc"] = null; out[f + "_tail"] = null; if (f.startsWith("imei")) out[f + "_hash"] = null; continue; }
      const sealed = KR.seal(r.v);
      if (!sealed) { warn.push("ids_skipped"); continue; }      // нет ключа — не сохраняем вовсе
      out[f + "_enc"] = sealed; out[f + "_tail"] = r.v.slice(-4);
      if (f.startsWith("imei")) out[f + "_hash"] = KR.hmac(r.v);
      if (f === "eid") out.esim_ok = 1;
    }
    if (has("esim_ok")) out.esim_ok = body.esim_ok ? 1 : (out.eid_enc || b.eid_enc ? 1 : 0);
    else if (out.esim_ok == null) out.esim_ok = b.esim_ok ?? 0;
    const merged = Object.assign({}, b, out);
    if (!merged.name && !merged.model && !merged.imei1_enc && !merged.imei2_enc && !merged.serial_enc)
      return { error: warn.includes("ids_skipped")
        ? { error: "no_key", message: "IMEI не сохранить: не настроен ключ шифрования (TRIP_SIM_KEY). Укажите хотя бы название или модель" }
        : { error: "empty", message: "Укажите название, модель или IMEI" } };
    return { row: out, warn: [...new Set(warn)] };
  }
  // Этот телефон уже заведён? Любой из его IMEI совпал с imei1 или imei2 другой записи.
  function deviceTwin(profileId, row, exceptId) {
    for (const h of [row.imei1_hash, row.imei2_hash].filter(Boolean)) {
      const t = medDb.prepare("SELECT id FROM trip_devices WHERE profile_id=? AND id<>? AND (imei1_hash=? OR imei2_hash=?)")
        .get(profileId, exceptId || 0, h, h);
      if (t) return t;
    }
    return null;
  }
  const deviceView = r => {
    const v = { id: r.id, name: r.name, model: r.model, note: r.note, esim_ok: r.esim_ok, created_at: r.created_at, updated_at: r.updated_at };
    for (const [f, [, mask]] of Object.entries(IDS)) {
      v["has_" + f] = !!r[f + "_enc"];
      v[f + "_masked"] = r[f + "_tail"] ? (f === "meid" || f === "serial" ? "····" + r[f + "_tail"] : "**** **** " + r[f + "_tail"]) : "";
    }
    v.sims = medDb.prepare("SELECT id, kind, country, region, plan_kind, data_mb, days FROM trip_sims WHERE device_id=? AND profile_id=?")
      .all(r.id, r.profile_id).map(s => ({ id: s.id, kind_ru: SIM_KIND_RU[s.kind] || "eSIM", label: simLabel(s) }));
    v.regs = medDb.prepare("SELECT id, country, valid_until FROM trip_imei_regs WHERE device_id=? AND profile_id=? ORDER BY reg_on DESC").all(r.id, r.profile_id);
    return v;
  };
  const deviceOf = (req, res, profileId) => {
    const r = medDb.prepare("SELECT * FROM trip_devices WHERE id=? AND profile_id=?").get(req.params.id, profileId);
    if (!r) { err(res, 404, "not_found"); return null; }
    return r;
  };

  app.get(P + "/devices", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      res.json({ ok: true, key_ok: KR.ok,
        devices: medDb.prepare("SELECT * FROM trip_devices WHERE profile_id=? ORDER BY id").all(profileId).map(deviceView) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post(P + "/devices", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const d = deviceBody(profileId, req.body, null);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      const twin = deviceTwin(profileId, d.row);
      if (twin) return res.status(409).json({ ok: false, error: "dup", dup_id: twin.id, message: "Этот телефон уже заведён" });
      const row = { profile_id: profileId, ...d.row };
      const cols = Object.keys(row);
      const id = medDb.prepare(`INSERT INTO trip_devices (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(",")})`)
        .run(...cols.map(k => row[k])).lastInsertRowid;
      res.json({ ok: true, ids_skipped: d.warn.includes("ids_skipped"), warnings: d.warn.filter(w => w !== "ids_skipped"),
        device: deviceView(medDb.prepare("SELECT * FROM trip_devices WHERE id=?").get(id)) });
    } catch (e) {
      if (/UNIQUE/.test(e.message)) return err(res, 409, "dup", "Этот телефон уже заведён");
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.patch(P + "/devices/:id", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = deviceOf(req, res, profileId); if (!cur) return;
      const d = deviceBody(profileId, req.body, cur);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      if (deviceTwin(profileId, d.row, cur.id)) return err(res, 409, "dup", "Другой телефон уже с этим IMEI");
      const cols = Object.keys(d.row);
      if (cols.length) medDb.prepare(`UPDATE trip_devices SET ${cols.map(k => k + "=?").join(", ")}, updated_at=datetime('now') WHERE id=?`)
        .run(...cols.map(k => d.row[k]), cur.id);
      res.json({ ok: true, ids_skipped: d.warn.includes("ids_skipped"), warnings: d.warn.filter(w => w !== "ids_skipped"),
        device: deviceView(medDb.prepare("SELECT * FROM trip_devices WHERE id=?").get(cur.id)) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Удаление телефона: SIM отвязываются, регистрации удаляются, их строки расходов ОСТАЮТСЯ
  // обычными тратами (деньги уже потрачены — то же правило, что у SIM).
  app.delete(P + "/devices/:id", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = deviceOf(req, res, profileId); if (!cur) return;
      medDb.transaction(() => {
        medDb.prepare("UPDATE trip_sims SET device_id=NULL WHERE device_id=? AND profile_id=?").run(cur.id, profileId);
        for (const r of medDb.prepare("SELECT id FROM trip_imei_regs WHERE device_id=? AND profile_id=?").all(cur.id, profileId)) detachRegExpense(profileId, r.id);
        medDb.prepare("DELETE FROM trip_imei_regs WHERE device_id=? AND profile_id=?").run(cur.id, profileId);
        medDb.prepare("DELETE FROM trip_devices WHERE id=?").run(cur.id);
      })();
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Показ одного идентификатора целиком — по «глазу».
  app.get(P + "/devices/:id/reveal", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const f = String(req.query.f || "");
    if (!IDS[f]) return err(res, 400, "bad_field");
    const cur = deviceOf(req, res, profileId); if (!cur) return;
    if (!cur[f + "_enc"]) return res.json({ ok: true, value: "" });
    if (!KR.ok) return err(res, 503, "no_key", "Не настроен ключ шифрования (TRIP_SIM_KEY)");
    const v = KR.open(cur[f + "_enc"]);
    if (v == null) return err(res, 500, "decrypt", "Не расшифровалось — ключ сменился, введите заново");
    res.json({ ok: true, value: v });
  });

  // «Телефон украли»: всё для заявления в полицию и оператору — целиком, одним ответом.
  // Раскрытие пишется одной строкой в лог БЕЗ самих номеров: видно, что данные показывались.
  app.get(P + "/devices/:id/theft-sheet", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = deviceOf(req, res, profileId); if (!cur) return;
      const open = f => cur[f + "_enc"] ? KR.open(cur[f + "_enc"]) : null;
      const sims = medDb.prepare("SELECT * FROM trip_sims WHERE device_id=? AND profile_id=? ORDER BY id").all(cur.id, profileId).map(s => {
        const op = s.operator_id ? medDb.prepare("SELECT name, site FROM trip_operators WHERE id=?").get(s.operator_id) : null;
        return { id: s.id, kind_ru: SIM_KIND_RU[s.kind] || "eSIM", label: simLabel(s), status: simState(s).status || null,
          operator: s.operator || (op && op.name) || "", operator_site: (op && op.site) || "",
          phone: s.phone || "", iccid: s.iccid || "", booked_via: s.booked_via || "", booking_no: s.booking_no || "", country: s.country || s.region || "" };
      });
      const regs = medDb.prepare("SELECT country, reg_on, valid_until, receipt_url FROM trip_imei_regs WHERE device_id=? AND profile_id=? ORDER BY reg_on").all(cur.id, profileId);
      console.log("[trip] theft-sheet profile=" + profileId + " device=" + cur.id);
      res.json({ ok: true, key_ok: KR.ok,
        device: { name: cur.name || "", model: cur.model || "", imei1: open("imei1"), imei2: open("imei2"), eid: open("eid"), meid: open("meid"), serial: open("serial") },
        sims, regs });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Распознавание *#06# / «Об устройстве» / коробки: текст или скрин.
  app.post(P + "/device-scan", express.raw({ type: "*/*", limit: MAX_BYTES }), async (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    if (!deps.apiKey) return res.status(500).json({ ok: false, error: "нет ANTHROPIC_API_KEY" });
    purgeScansLazy();
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (!buf.length) return err(res, 400, "empty", "пусто — вставьте текст экрана *#06# или скриншот");
    const isText = String(req.headers["x-doc-kind"] || "").toLowerCase() === "text";
    let text = "", file = null, uploadId = null;
    if (isText) {
      text = buf.toString("utf8").trim().slice(0, PASTE_MAX);
    } else {
      let n = "screen";
      try { n = decodeURIComponent(req.headers["x-file-name"] || "screen"); } catch (e) {}
      n = String(n).replace(/[^\w.\-А-Яа-яЁё ]/g, "_").slice(0, 120);
      const ext = (n.split(".").pop() || "").toLowerCase();
      const sniff = sniffMime(buf);
      const mime = sniff.mime || (sniff.heic ? null : SCAN_MIME[ext] || null);
      if (!mime) return err(res, 415, "format", sniff.heic ? "снимок в HEIC — пришлите скриншот" : "формат не поддерживается: " + (ext || "без расширения"));
      file = { name: n, mime, buf };
      try {
        const full = path.join(UP_DIR, crypto.randomBytes(8).toString("hex") + "." + ext);
        fs.writeFileSync(full, buf);
        uploadId = logUpload({ kind: "trip", file_name: n, file_size: buf.length, status: "ok", note: "экран *#06# → распознавание",
          storage_path: full, expires_at: new Date(Date.now() + KEEP_HOURS * 3600e3).toISOString().slice(0, 19).replace("T", " ") });
      } catch (e) { console.error("trip device scan save:", e.message); }
    }
    // Текст сначала разбираем сами: у *#06# цифры с подписями, модель тут не нужна.
    const local = isText ? idsFromText(text) : null;
    let raw = {}, u = null;
    const started = Date.now();
    if (!local || !local.imei1) {
      try {
        const content = isText ? [{ type: "text", text: DEVICE_PROMPT + "\n\nТЕКСТ:\n" + text }]
          : [{ type: file.mime === "application/pdf" ? "document" : "image", source: { type: "base64", media_type: file.mime, data: file.buf.toString("base64") } },
             { type: "text", text: DEVICE_PROMPT }];
        u = await ask(content, 500);
        raw = parseJson(u.text);
        logAiCall("trip_device", isText ? null : "upload", uploadId, null, SCAN_MODEL, u.inTok, u.outTok, cost(u), { durationMs: Date.now() - started });
      } catch (e) {
        logAiCall("trip_device", isText ? null : "upload", uploadId, null, SCAN_MODEL, 0, 0, 0, { durationMs: Date.now() - started, error: e.message });
        if (!local) return err(res, 502, "ai", "распознать не удалось: " + e.message);
      }
    }
    const pick = f => (local && local[f]) || raw[f] || "";
    const i1 = imeiNorm(pick("imei1")), i2 = imeiNorm(pick("imei2")), ed = eidNorm(pick("eid"));
    const device = {
      model: String(raw.model || "").trim().slice(0, 80),
      imei1: i1.ok ? i1.imei : "", imei1_ok: i1.ok, imei1_from_sv: !!i1.from_sv,
      imei2: i2.ok && i2.imei !== i1.imei ? i2.imei : "", imei2_ok: i2.ok,
      eid: ed.ok ? ed.eid : "", eid_check: ed.ok ? ed.check : null,
      meid: meidNorm(pick("meid")), serial: serialNorm(raw.serial || "")
    };
    if (!device.imei1 && !device.eid && !device.serial) {
      logGeneration("trip_device", "Устройство: не распознано", "", "", u, "error", "нет IMEI в документе");
      return err(res, 422, "nothing", "IMEI не нашёлся — наберите *#06# и вставьте текст целиком или сделайте скриншот");
    }
    const t4 = s => s ? "···" + s.slice(-4) : "";
    logGeneration("trip_device", "Устройство: " + (device.model || "телефон"), "IMEI " + t4(device.imei1),
      JSON.stringify({ ...device, imei1: t4(device.imei1), imei2: t4(device.imei2), eid: t4(device.eid), meid: t4(device.meid), serial: t4(device.serial) }, null, 2), u, "ok");
    const h = [device.imei1, device.imei2].filter(Boolean).map(v => KR.hmac(v)).filter(Boolean);
    let dup = null;
    for (const x of h) { dup = dup || medDb.prepare("SELECT id FROM trip_devices WHERE profile_id=? AND (imei1_hash=? OR imei2_hash=?)").get(profileId, x, x); }
    res.json({ ok: true, device, dup_id: dup ? dup.id : null, upload_id: uploadId });
  });

  // ================= справочник операторов =================
  const opView = o => ({ ...o, aliases: o.aliases ? String(o.aliases).split("|") : [] });
  // Текст оператора из заказа → строка справочника той же страны (по имени и синонимам). Не заводит.
  function operatorResolve(country, text) {
    const k = key(text);
    if (!k || !country) return null;
    for (const o of medDb.prepare("SELECT * FROM trip_operators WHERE country=?").all(country)) {
      if (key(o.name) === k || String(o.aliases || "").split("|").some(a => key(a) === k)) return o;
    }
    return null;
  }
  app.get(P + "/operators", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const c = str(req.query.country, COUNTRY_MAX);
      const rows = c ? medDb.prepare("SELECT * FROM trip_operators WHERE country=? ORDER BY sort, name").all(c)
        : medDb.prepare("SELECT * FROM trip_operators ORDER BY country, sort, name").all();
      const resolved = c && req.query.q ? operatorResolve(c, req.query.q) : null;
      res.json({ ok: true, can_edit: isAdmin(req), operators: rows.map(opView), resolved_id: resolved ? resolved.id : null });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  // Как у площадок: новую строку заводит любой, переписать заведённую — только админ.
  app.post(P + "/operators", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const b = req.body || {};
      const country = str(b.country, COUNTRY_MAX), name = str(b.name, 60);
      if (!country || !name) return err(res, 400, "bad_row", "Нужны страна и название оператора");
      const row = { country, name, network: str(b.network, 20), apn: String(b.apn || "").trim().replace(/[^\w.\-]/g, "").slice(0, 60) || null,
        site: str(b.site, 200), aliases: String(b.aliases || "").split(/[|,;\n]/).map(s => s.trim()).filter(Boolean).join("|").slice(0, 300) || null };
      const id = Number(b.id) || 0;
      if (id) {
        if (!isAdmin(req)) return err(res, 403, "forbidden", "Оператора в общем справочнике правит только админ");
        const was = medDb.prepare("SELECT * FROM trip_operators WHERE id=?").get(id);
        if (!was) return err(res, 404, "not_found");
        medDb.transaction(() => {
          medDb.prepare(`UPDATE trip_operators SET country=?, name=?, network=?, apn=?, site=?, aliases=?, updated_at=datetime('now') WHERE id=?`)
            .run(row.country, row.name, row.network, row.apn, row.site, row.aliases, id);
          // Переименование тянет за собой имя в записях SIM — иначе они осиротеют со старым.
          if (was.name !== row.name) medDb.prepare("UPDATE trip_sims SET operator=? WHERE operator_id=?").run(row.name, id);
        })();
        return res.json({ ok: true, operator: opView(medDb.prepare("SELECT * FROM trip_operators WHERE id=?").get(id)) });
      }
      const same = operatorResolve(country, name);
      if (same) return res.status(409).json({ ok: false, error: "exists", id: same.id, message: "Такой оператор уже есть: " + same.name });
      const r = medDb.prepare(`INSERT INTO trip_operators (country, name, network, apn, site, aliases, source) VALUES (?,?,?,?,?,?,'user')`)
        .run(row.country, row.name, row.network, row.apn, row.site, row.aliases);
      res.json({ ok: true, operator: opView(medDb.prepare("SELECT * FROM trip_operators WHERE id=?").get(r.lastInsertRowid)) });
    } catch (e) {
      if (/UNIQUE/.test(e.message)) return err(res, 409, "exists", "Такой оператор уже есть");
      res.status(500).json({ ok: false, error: e.message });
    }
  });
  app.delete(P + "/operators/:id", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    if (!isAdmin(req)) return err(res, 403, "forbidden", "Общий справочник операторов правит только админ");
    try {
      const used = medDb.prepare("SELECT COUNT(*) n FROM trip_sims WHERE operator_id=?").get(req.params.id).n;
      if (used) return err(res, 409, "in_use", "Оператор указан в " + used + " записях SIM");
      const r = medDb.prepare("DELETE FROM trip_operators WHERE id=?").run(req.params.id);
      if (!r.changes) return err(res, 404, "not_found");
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Нужна ли регистрация телефона в стране — ручная отметка, правит админ.
  app.get(P + "/sim-countries", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      res.json({ ok: true, can_edit: isAdmin(req), countries: medDb.prepare("SELECT * FROM trip_sim_countries ORDER BY country").all() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.put(P + "/sim-countries/:country", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    if (!isAdmin(req)) return err(res, 403, "forbidden", "Сведения о странах правит только админ");
    try {
      const c = str(req.params.country, COUNTRY_MAX);
      if (!c) return err(res, 400, "bad_country");
      const b = req.body || {};
      const reg = ["yes", "no", "unknown"].includes(b.imei_reg) ? b.imei_reg : "unknown";
      const url = String(b.imei_reg_url || "").trim().slice(0, 300);
      medDb.prepare(`INSERT INTO trip_sim_countries (country, imei_reg, imei_reg_note, imei_reg_url, checked_on) VALUES (?,?,?,?,?)
        ON CONFLICT(country) DO UPDATE SET imei_reg=excluded.imei_reg, imei_reg_note=excluded.imei_reg_note,
        imei_reg_url=excluded.imei_reg_url, checked_on=excluded.checked_on, updated_at=datetime('now')`)
        .run(c, reg, str(b.imei_reg_note, 300), /^https?:\/\//i.test(url) ? url : null, normDate(b.checked_on) || null);
      res.json({ ok: true, country: medDb.prepare("SELECT * FROM trip_sim_countries WHERE country=?").get(c) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ================= регистрация телефона в стране =================
  // Строка расхода «Связь» (source='imei_reg') — тот же механизм, что у SIM: владелец — регистрация;
  // цена есть → одна строка; стёрли цену → строки нет; удалили регистрацию → строка ОТВЯЗЫВАЕТСЯ.
  function syncRegExpense(profileId, regId) {
    const r = medDb.prepare("SELECT * FROM trip_imei_regs WHERE id=? AND profile_id=?").get(regId, profileId);
    if (!r) return;
    const cur = medDb.prepare("SELECT id FROM trip_expenses WHERE profile_id=? AND source='imei_reg' AND source_id=?").get(profileId, regId);
    const amount = r.price > 0 ? r.price : null, local = r.price_local > 0 ? r.price_local : null;
    if (!amount && !local) {
      if (cur) medDb.prepare("DELETE FROM trip_expenses WHERE id=?").run(cur.id);
      if (r.expense_id != null) medDb.prepare("UPDATE trip_imei_regs SET expense_id=NULL WHERE id=?").run(regId);
      return;
    }
    const dev = medDb.prepare("SELECT name, model FROM trip_devices WHERE id=?").get(r.device_id) || {};
    const src = r.pay_source_id ? paySourceOf(medDb, profileId, r.pay_source_id) : null;
    const row = { spent_on: [r.reg_on, String(r.created_at || "").slice(0, 10)].find(isDate) || todayMsk(), category: "comm",
      pay_source_id: src ? src.id : null,
      pay_units: src ? payUnits(src, amount || local, amount ? (r.price_currency || "RUB") : r.price_local_currency) : null,
      title: "Регистрация телефона · " + r.country + (dev.name || dev.model ? " · " + (dev.name || dev.model) : ""),
      amount, currency: amount ? (r.price_currency || "RUB") : null, amount_local: local, currency_local: local ? r.price_local_currency : null,
      note: r.paid_with ? "оплачено: " + r.paid_with : null };
    const cols = Object.keys(row);
    let id;
    if (cur) {
      medDb.prepare(`UPDATE trip_expenses SET ${cols.map(k => k + "=?").join(", ")}, updated_at=datetime('now') WHERE id=?`).run(...cols.map(k => row[k]), cur.id);
      id = cur.id;
    } else {
      const all = { profile_id: profileId, source: "imei_reg", source_id: regId, ...row };
      const ks = Object.keys(all);
      id = medDb.prepare(`INSERT INTO trip_expenses (${ks.join(", ")}) VALUES (${ks.map(() => "?").join(",")})`).run(...ks.map(k => all[k])).lastInsertRowid;
    }
    if (id !== r.expense_id) medDb.prepare("UPDATE trip_imei_regs SET expense_id=? WHERE id=?").run(id, regId);
  }
  function detachRegExpense(profileId, regId) {
    medDb.prepare(`UPDATE trip_expenses SET source=NULL, source_id=NULL,
      note=TRIM(COALESCE(note,'') || CASE WHEN COALESCE(note,'')='' THEN '' ELSE ' · ' END || 'запись регистрации удалена'),
      updated_at=datetime('now') WHERE profile_id=? AND source='imei_reg' AND source_id=?`).run(profileId, regId);
  }
  const REG_WHEN = ["valid_until", "remind_days", "country"];
  function regBody(profileId, body, base) {
    const b = base || {}, out = {};
    const has = k => body && body[k] !== undefined;
    const bad = (e, m) => ({ error: { error: e, message: m } });
    if (has("device_id") || !base) {
      const v = parseInt(body?.device_id, 10);
      if (!Number.isFinite(v) || !medDb.prepare("SELECT 1 FROM trip_devices WHERE id=? AND profile_id=?").get(v, profileId))
        return bad("bad_device", "Выберите телефон из «Моих устройств»");
      out.device_id = v;
    }
    out.country = has("country") ? str(body.country, COUNTRY_MAX) : (b.country ?? null);
    if (!out.country) return bad("bad_country", "Укажите страну");
    out.imei_slot = has("imei_slot") ? (["1", "2", "both"].includes(String(body.imei_slot)) ? String(body.imei_slot) : "1") : (b.imei_slot || "1");
    for (const k of ["reg_on", "valid_until"]) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      const v = String(body[k] || "").trim();
      out[k] = v ? normDate(v) : null;
      if (v && !out[k]) return bad("bad_date", "Даты в формате ГГГГ-ММ-ДД");
    }
    if (out.reg_on && out.valid_until && out.valid_until < out.reg_on) return bad("bad_range", "«Действует до» раньше даты регистрации");
    for (const k of ["price", "price_local"]) {
      if (!has(k)) { out[k] = b[k] ?? null; continue; }
      if (String(body[k] ?? "").trim() === "") { out[k] = null; continue; }
      const n = numAmount(body[k]);
      if (!isFinite(n) || n < 0) return bad("bad_amount", "Сумма — число");
      out[k] = Math.round(n * 100) / 100;
    }
    for (const k of ["price_currency", "price_local_currency"]) out[k] = has(k) ? (curCode(body[k]) || null) : (b[k] ?? null);
    if (out.price != null && !out.price_currency) out.price_currency = "RUB";
    out.paid_with = has("paid_with") ? str(body.paid_with, 40) : (b.paid_with ?? null);
    if (has("pay_source_id")) {
      const v = body.pay_source_id == null || body.pay_source_id === "" ? null : parseInt(body.pay_source_id, 10);
      if (v != null) {
        const src = paySourceOf(medDb, profileId, v);
        if (!src) return bad("bad_pay_source", "Способ оплаты не найден");
        if (!out.paid_with) out.paid_with = src.title;
      }
      out.pay_source_id = v;
    }
    out.note = has("note") ? str(body.note, TEXT_MAX) : (b.note ?? null);
    if (has("receipt_url")) {
      const x = String(body.receipt_url || "").trim().slice(0, 300);
      out.receipt_url = !x ? null : /^https?:\/\//i.test(x) ? x : null;
      if (x && !out.receipt_url) return bad("bad_url", "Ссылка на квитанцию — адрес http(s)");
    } else out.receipt_url = b.receipt_url ?? null;
    if (has("remind_days")) {
      const n = parseInt(body.remind_days, 10);
      out.remind_days = Number.isFinite(n) ? Math.max(0, Math.min(60, n)) : 7;
    } else out.remind_days = b.remind_days ?? 7;
    if (has("trip_leg")) {
      const v = body.trip_leg == null ? "" : String(body.trip_leg).trim();
      if (!v) { out.trip_leg = null; out.trip_manual = 0; }
      else if (v === "none") { out.trip_leg = "none"; out.trip_manual = 1; }
      else {
        const m = /^([fr])(\d+)$/.exec(v);
        if (!m || !medDb.prepare(`SELECT 1 FROM ${m[1] === "f" ? "trip_flights" : "trip_rides"} WHERE id=? AND profile_id=?`).get(+m[2], profileId))
          return bad("bad_trip", "Поездка не найдена");
        out.trip_leg = v; out.trip_manual = 1;
      }
    }
    if (base && REG_WHEN.some(k => out[k] !== undefined && String(out[k] ?? "") !== String(b[k] ?? "")))
      Object.assign(out, { notify_pre_sent_at: null, notify_end_sent_at: null, notify_error: null });
    return { row: out };
  }
  const regView = r => {
    const t = todayMsk();
    const left = r.valid_until ? dnum(r.valid_until) - dnum(t) : null;
    const hint = medDb.prepare("SELECT imei_reg, imei_reg_note, imei_reg_url, checked_on FROM trip_sim_countries WHERE country=?").get(r.country) || null;
    return { ...r, status: !r.valid_until ? "perpetual" : left < 0 ? "expired" : "active", days_left: left, country_hint: hint };
  };
  app.get(P + "/imei-regs", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      res.json({ ok: true, regs: medDb.prepare("SELECT * FROM trip_imei_regs WHERE profile_id=? ORDER BY COALESCE(reg_on, created_at) DESC").all(profileId).map(regView) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.post(P + "/imei-regs", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const d = regBody(profileId, req.body, null);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      const row = { profile_id: profileId, ...d.row };
      const cols = Object.keys(row);
      let id;
      medDb.transaction(() => {
        id = medDb.prepare(`INSERT INTO trip_imei_regs (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map(k => row[k])).lastInsertRowid;
        syncRegExpense(profileId, id);
      })();
      res.json({ ok: true, reg: regView(medDb.prepare("SELECT * FROM trip_imei_regs WHERE id=?").get(id)) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.patch(P + "/imei-regs/:id", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = medDb.prepare("SELECT * FROM trip_imei_regs WHERE id=? AND profile_id=?").get(req.params.id, profileId);
      if (!cur) return err(res, 404, "not_found");
      const d = regBody(profileId, req.body, cur);
      if (d.error) return res.status(400).json({ ok: false, ...d.error });
      const cols = Object.keys(d.row);
      medDb.transaction(() => {
        medDb.prepare(`UPDATE trip_imei_regs SET ${cols.map(k => k + "=?").join(", ")}, updated_at=datetime('now') WHERE id=?`).run(...cols.map(k => d.row[k]), cur.id);
        syncRegExpense(profileId, cur.id);
      })();
      res.json({ ok: true, reg: regView(medDb.prepare("SELECT * FROM trip_imei_regs WHERE id=?").get(cur.id)) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.delete(P + "/imei-regs/:id", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = medDb.prepare("SELECT id FROM trip_imei_regs WHERE id=? AND profile_id=?").get(req.params.id, profileId);
      if (!cur) return err(res, 404, "not_found");
      medDb.transaction(() => {
        detachRegExpense(profileId, cur.id);
        medDb.prepare("DELETE FROM trip_imei_regs WHERE id=?").run(cur.id);
      })();
      res.json({ ok: true, expense_kept: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- напоминание об окончании регистрации (за remind_days и в последний день) ----------
  // Образец — pauseTick в habits.js: метка ДО отправки, адресат из patient_telegram_links, бот @Ai_dcf_bot.
  let AI_DCF_TOKEN = null;   // та же копия, что в habits.js, pair.js и trip_sims.js (общий модуль не выделяем)
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
  const send = deps.sendToProfile || (async (profileId, text) => {
    const link = medDb.prepare(`SELECT l.chat_id FROM patient_telegram_links l JOIN patient_accounts a ON a.id=l.account_id
      WHERE a.profile_id=? AND l.chat_id IS NOT NULL ORDER BY l.consumed_at DESC LIMIT 1`).get(profileId);
    if (link && aiDcfToken()) return tgSend(aiDcfToken(), link.chat_id, text, { buttons: [[{ text: "Открыть eSIM", url: "https://ai.cashruflow.ru/trip/app" }]] });
    if (profileId === 1 && process.env.TELEGRAM_BOT_TOKEN_CASHRUFLOW && process.env.TG_CHAT_ID)
      return tgSend(process.env.TELEGRAM_BOT_TOKEN_CASHRUFLOW.trim(), process.env.TG_CHAT_ID.trim(), text);
    return "нет привязанного Telegram у профиля " + profileId;
  });
  let regTickBusy = false;
  async function regTick(nowMs = Date.now()) {
    if (regTickBusy) return 0;
    regTickBusy = true;
    let sent = 0;
    try {
      const rows = medDb.prepare(`SELECT r.*, d.name dname, d.model dmodel FROM trip_imei_regs r LEFT JOIN trip_devices d ON d.id=r.device_id
        WHERE r.valid_until IS NOT NULL AND (r.notify_pre_sent_at IS NULL OR r.notify_end_sent_at IS NULL)`).all();
      for (const r of rows) {
        const tz = COUNTRY_TZ[r.country] || "Europe/Moscow";
        let hour = 12, day = todayMsk();
        try {
          hour = +new Date(nowMs).toLocaleString("en-GB", { timeZone: tz, hour: "2-digit", hour12: false });
          day = new Date(nowMs).toLocaleDateString("sv-SE", { timeZone: tz });
        } catch (e) {}
        if (hour < 9 || hour >= 22) continue;
        const left = dnum(r.valid_until) - dnum(day);
        const who = r.dname || r.dmodel || "телефона";
        const dd = r.valid_until.slice(8, 10) + "." + r.valid_until.slice(5, 7);
        let flag = null, text = null;
        if (!r.notify_end_sent_at && left === 0) {
          flag = "notify_end_sent_at"; text = "Сегодня последний день регистрации «" + who + "» в стране: " + r.country + " (до " + dd + ").";
          if (!r.notify_pre_sent_at) medDb.prepare("UPDATE trip_imei_regs SET notify_pre_sent_at=datetime('now') WHERE id=?").run(r.id);
        } else if (!r.notify_pre_sent_at && left > 0 && left <= (r.remind_days ?? 7)) {
          flag = "notify_pre_sent_at";
          text = "Регистрация «" + who + "» в стране: " + r.country + " действует ещё " + left + " " + plural(left, "день", "дня", "дней") + " — до " + dd + ".";
        }
        if (!flag) continue;
        medDb.prepare(`UPDATE trip_imei_regs SET ${flag}=datetime('now'), notify_error=NULL WHERE id=?`).run(r.id);
        const e = await send(r.profile_id, text);
        sent++;
        if (e) {
          medDb.prepare("UPDATE trip_imei_regs SET notify_error=? WHERE id=?").run(String(e).slice(0, 300), r.id);
          console.error("[trip] напоминание регистрации #" + r.id + ":", e);
        }
      }
    } catch (e) { console.error("[trip] regTick:", e.message); }
    finally { regTickBusy = false; }
    return sent;
  }
  if (!deps.noTimers) {
    setTimeout(regTick, 120 * 1000);
    setInterval(regTick, 30 * 60 * 1000);
  }
  return { regTick, operatorResolve };
}
