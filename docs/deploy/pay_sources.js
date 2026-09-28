// «Способы оплаты» (28.09.2026, ADR-233 → отдельный ADR по кошельку): у каждого профиля платформы
// свой список — карты, бонусные балансы (Trip Coins, баллы, кэшбэк), наличные, счета.
//
// ПОЧЕМУ НЕ ТАБЛИЦА cards ИЗ /cash. cards живёт в tasks.db, открыта только админу (ppass) и не
// знает ни вида, ни единиц, ни остатка; траты «Путешествий» лежат в med.sqlite под сессией
// пользователя — внешнего ключа между базами нет. Поэтому способы оплаты — таблица профиля в
// med.sqlite. У владельца платформы (profiles.patient_key='1') строку можно связать с картой
// из /cash (card_id → tasks.db cards.id), больше ни у кого.
//
// ОСТАТОК не хранится — считается при запросе:
//   opening_balance + Σ pay_moves.units − Σ trip_expenses.pay_units   (всё — начиная с balance_on)
// Единицы — unit способа: код валюты (RUB, USD…) или PTS для баллов. Трата в рублях с бонусного
// способа списывает amount / rate_rub единиц (rate_rub — сколько рублей стоит 1 единица, вручную).
// Сама трата остаётся тратой (339,80 ₽ баллами — расход поездки): способ оплаты меняет только
// «чем оплачено» и остаток.
//
// УДАЛЕНИЕ способа, на который ссылаются расходы или записи (SIM, регистрации), запрещено (409) —
// только архив: история трат не должна терять «чем платили».

export const PAY_KINDS = { card: "Карта", bonus: "Бонусы", cash: "Наличные", account: "Счёт" };

export function ensurePayTables(medDb) {
  medDb.exec(`CREATE TABLE IF NOT EXISTS pay_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'card',
    title TEXT NOT NULL,
    last4 TEXT,
    bank TEXT,
    unit TEXT NOT NULL DEFAULT 'RUB',
    rate_rub REAL,
    opening_balance REAL,
    balance_on TEXT,
    card_id INTEGER,
    archived INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE INDEX IF NOT EXISTS idx_pay_sources_profile ON pay_sources(profile_id, archived)`);
  medDb.exec(`CREATE TABLE IF NOT EXISTS pay_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    moved_on TEXT NOT NULL,
    units REAL NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec(`CREATE INDEX IF NOT EXISTS idx_pay_moves_source ON pay_moves(source_id, moved_on)`);
}

// Сколько единиц способа уходит на трату amount в валюте currency. null — пересчитать нечем
// (разные валюты без курса): тогда единицы вписывают руками.
export function payUnits(src, amount, currency) {
  const a = Number(amount);
  if (!src || !isFinite(a) || a <= 0) return null;
  const unit = String(src.unit || "RUB").toUpperCase(), cur = String(currency || "RUB").toUpperCase();
  if (unit === cur) return Math.round(a * 100) / 100;
  if (cur === "RUB" && src.rate_rub > 0) return Math.round(a / src.rate_rub * 100) / 100;
  return null;
}
// Способ оплаты профиля (или null): ссылку на чужой способ не пропускаем.
export function paySourceOf(medDb, profileId, id) {
  if (id == null || id === "") return null;
  try { return medDb.prepare("SELECT * FROM pay_sources WHERE id=? AND profile_id=?").get(+id, profileId) || null; } catch (e) { return null; }
}
// Остаток в единицах способа. exceptExpenseId — не считать эту трату (для подсказки при правке).
export function payBalance(medDb, src, exceptExpenseId) {
  if (!src) return null;
  const from = src.balance_on || "0000-00-00";
  const moves = medDb.prepare("SELECT COALESCE(SUM(units),0) s FROM pay_moves WHERE source_id=? AND moved_on>=?").get(src.id, from).s;
  let spent = 0;
  try {
    spent = medDb.prepare(`SELECT COALESCE(SUM(pay_units),0) s FROM trip_expenses WHERE pay_source_id=? AND profile_id=?
      AND spent_on>=? AND id<>?`).get(src.id, src.profile_id, from, exceptExpenseId || 0).s;
  } catch (e) { spent = 0; }   // до миграции trip_expenses колонок ещё нет
  return Math.round(((src.opening_balance || 0) + moves - spent) * 100) / 100;
}

// deps: pid (резолв профиля из сессии), tasksDb (для card_id владельца), isAdmin.
export function mountPaySources(app, medDb, deps) {
  const { pid, tasksDb } = deps;
  const isAdmin = deps.isAdmin || (() => false);
  ensurePayTables(medDb);
  const P = "/api/profile/:profileId/pay-sources";
  const str = (v, max) => { const s = String(v == null ? "" : v).trim().replace(/\s+/g, " "); return s ? s.slice(0, max) : null; };
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  const num = v => { let s = String(v ?? "").replace(/[\s ]/g, ""); if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, ""); else s = s.replace(",", "."); const n = Number(s.replace(/[^\d.\-]/g, "")); return s === "" || !isFinite(n) ? null : n; };
  const err = (res, code, error, message) => res.status(code).json({ ok: false, error, message: message || error });
  // Владелец платформы видит свои карты из /cash и может связать с ними способ оплаты.
  const isOwner = profileId => {
    try { const r = medDb.prepare("SELECT patient_key FROM profiles WHERE id=?").get(profileId); return !!r && String(r.patient_key) === "1"; }
    catch (e) { return false; }
  };
  const canCards = (req, profileId) => !!tasksDb && (isOwner(profileId) || isAdmin(req));
  const usage = id => {
    const q = (t, c) => { try { return medDb.prepare(`SELECT COUNT(*) n FROM ${t} WHERE ${c}=?`).get(id).n; } catch (e) { return 0; } };
    return { expenses: q("trip_expenses", "pay_source_id"), sims: q("trip_sims", "pay_source_id"), regs: q("trip_imei_regs", "pay_source_id") };
  };
  const view = s => {
    const u = usage(s.id);
    return { ...s, kind_ru: PAY_KINDS[s.kind] || s.kind, balance: payBalance(medDb, s),
      balance_rub: s.rate_rub > 0 ? Math.round(payBalance(medDb, s) * s.rate_rub * 100) / 100 : (String(s.unit).toUpperCase() === "RUB" ? payBalance(medDb, s) : null),
      used: u.expenses + u.sims + u.regs };
  };
  function body(profileId, req, b, base) {
    const o = base || {}, out = {};
    const has = k => b && b[k] !== undefined;
    out.kind = has("kind") ? (PAY_KINDS[b.kind] ? b.kind : null) : (o.kind || "card");
    if (!out.kind) return { error: ["bad_kind", "Вид: карта, бонусы, наличные или счёт"] };
    out.title = has("title") ? str(b.title, 60) : (o.title ?? null);
    if (!out.title) return { error: ["empty", "Нужно название"] };
    // Как в cards.js: от номера карты остаются только последние 4 цифры, что бы ни прислали.
    out.last4 = has("last4") ? (String(b.last4 || "").replace(/\D/g, "").slice(-4) || null) : (o.last4 ?? null);
    out.bank = has("bank") ? str(b.bank, 60) : (o.bank ?? null);
    out.unit = has("unit") ? (String(b.unit || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || null) : (o.unit || (out.kind === "bonus" ? "PTS" : "RUB"));
    if (!out.unit) return { error: ["bad_unit", "Единицы — код валюты (RUB, USD) или PTS для баллов"] };
    for (const k of ["rate_rub", "opening_balance"]) {
      if (!has(k)) { out[k] = o[k] ?? null; continue; }
      const n = num(b[k]);
      if (String(b[k] ?? "").trim() !== "" && n == null) return { error: ["bad_number", "Число"] };
      if (k === "rate_rub" && n != null && n <= 0) return { error: ["bad_rate", "Курс — больше нуля"] };
      out[k] = n;
    }
    out.balance_on = has("balance_on") ? (isDate(b.balance_on) ? b.balance_on : null) : (o.balance_on ?? null);
    out.archived = has("archived") ? (b.archived ? 1 : 0) : (o.archived ?? 0);
    out.note = has("note") ? str(b.note, 200) : (o.note ?? null);
    if (has("card_id")) {
      const v = b.card_id == null || b.card_id === "" ? null : parseInt(b.card_id, 10);
      if (v != null) {
        if (!canCards(req, profileId)) return { error: ["forbidden", "Связать с картой из «Кэш-финансов» может только владелец"] };
        let c = null;
        try { c = tasksDb.prepare("SELECT id, last4, bank FROM cards WHERE id=?").get(v); } catch (e) {}
        if (!c) return { error: ["bad_card", "Карта не найдена"] };
        if (!out.last4) out.last4 = c.last4;
        if (!out.bank && c.bank) out.bank = c.bank;
      }
      out.card_id = v;
    } else out.card_id = o.card_id ?? null;
    return { row: out };
  }
  const own = (req, res, profileId) => {
    const s = paySourceOf(medDb, profileId, req.params.id);
    if (!s) { err(res, 404, "not_found"); return null; }
    return s;
  };

  app.get(P, (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const all = req.query.all === "1";
      const rows = medDb.prepare(`SELECT * FROM pay_sources WHERE profile_id=? ${all ? "" : "AND archived=0"} ORDER BY archived, kind, title`).all(profileId);
      res.json({ ok: true, kinds: PAY_KINDS, can_link_cards: canCards(req, profileId), sources: rows.map(view) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  // Карты из /cash для связки — только владельцу.
  app.get(P + "/cards", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    if (!canCards(req, profileId)) return err(res, 403, "forbidden");
    try { res.json({ ok: true, cards: tasksDb.prepare("SELECT id, title, last4, bank FROM cards WHERE project_id IS NULL ORDER BY title").all() }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.post(P, (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const d = body(profileId, req, req.body, null);
      if (d.error) return err(res, d.error[0] === "forbidden" ? 403 : 400, ...d.error);
      const row = { profile_id: profileId, ...d.row };
      const cols = Object.keys(row);
      const id = medDb.prepare(`INSERT INTO pay_sources (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map(k => row[k])).lastInsertRowid;
      res.json({ ok: true, source: view(medDb.prepare("SELECT * FROM pay_sources WHERE id=?").get(id)) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.patch(P + "/:id", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = own(req, res, profileId); if (!cur) return;
      const d = body(profileId, req, req.body, cur);
      if (d.error) return err(res, d.error[0] === "forbidden" ? 403 : 400, ...d.error);
      const cols = Object.keys(d.row);
      medDb.prepare(`UPDATE pay_sources SET ${cols.map(k => k + "=?").join(", ")}, updated_at=datetime('now') WHERE id=?`).run(...cols.map(k => d.row[k]), cur.id);
      res.json({ ok: true, source: view(medDb.prepare("SELECT * FROM pay_sources WHERE id=?").get(cur.id)) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.delete(P + "/:id", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = own(req, res, profileId); if (!cur) return;
      const u = usage(cur.id);
      if (u.expenses + u.sims + u.regs) return res.status(409).json({ ok: false, error: "in_use", usage: u,
        message: "Этим способом оплачено записей: " + (u.expenses + u.sims + u.regs) + ". Удалить нельзя — отправьте в архив" });
      medDb.transaction(() => {
        medDb.prepare("DELETE FROM pay_moves WHERE source_id=?").run(cur.id);
        medDb.prepare("DELETE FROM pay_sources WHERE id=?").run(cur.id);
      })();
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Пополнения и корректировки: units > 0 — начислили/пополнили, < 0 — списание вне поездок.
  app.get(P + "/:id/moves", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const cur = own(req, res, profileId); if (!cur) return;
    res.json({ ok: true, moves: medDb.prepare("SELECT * FROM pay_moves WHERE source_id=? ORDER BY moved_on DESC, id DESC").all(cur.id) });
  });
  app.post(P + "/:id/moves", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const cur = own(req, res, profileId); if (!cur) return;
      const units = num(req.body?.units);
      if (units == null || units === 0) return err(res, 400, "bad_units", "Сколько единиц: число, не ноль");
      const on = isDate(req.body?.moved_on) ? req.body.moved_on : new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
      medDb.prepare("INSERT INTO pay_moves (profile_id, source_id, moved_on, units, note) VALUES (?,?,?,?,?)").run(profileId, cur.id, on, units, str(req.body?.note, 200));
      res.json({ ok: true, source: view(cur) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.delete(P + "/:id/moves/:mid", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const cur = own(req, res, profileId); if (!cur) return;
    const r = medDb.prepare("DELETE FROM pay_moves WHERE id=? AND source_id=?").run(req.params.mid, cur.id);
    if (!r.changes) return err(res, 404, "not_found");
    res.json({ ok: true, source: view(cur) });
  });

  // Подсказка для формы: «спишется ≈ N, останется M». except — id строки расхода, которую правят.
  app.get(P + "/:id/quote", (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const cur = own(req, res, profileId); if (!cur) return;
    const units = payUnits(cur, num(req.query.amount), req.query.currency);
    const bal = payBalance(medDb, cur, +req.query.except || 0);
    res.json({ ok: true, unit: cur.unit, units, balance: bal, remaining: units == null ? null : Math.round((bal - units) * 100) / 100,
      hint: units == null ? "пересчитать нечем — укажите курс способа или впишите единицы вручную"
        : "спишется ≈ " + units + " " + cur.unit + ", останется " + Math.round((bal - units) * 100) / 100 + " " + cur.unit });
  });

  return { payUnits, paySourceOf: (profileId, id) => paySourceOf(medDb, profileId, id), payBalance: s => payBalance(medDb, s) };
}
