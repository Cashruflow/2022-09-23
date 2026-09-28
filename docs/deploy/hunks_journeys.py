H = []

H.append(("""export const CATS = { transport: 'Транспорт', stay: 'Жильё', food: 'Еда', fun: 'Развлечения', other: 'Прочее' };""",
"""// «Связь» (comm) — 28.09.2026, ADR-233: SIM/eSIM, пополнение, роуминг, регистрация телефона.
export const CATS = { transport: 'Транспорт', stay: 'Жильё', food: 'Еда', comm: 'Связь', fun: 'Развлечения', other: 'Прочее' };"""))

H.append(("""  ['fun', /развлечен|кино|музе|театр""",
"""  // Связь (ADR-233): SIM/eSIM, пополнение, роуминг. Раньше «развлечений» и «прочего».
  ['comm', /esim|e-sim|сим.?карт|sim.?card|airalo|holafly|yesim|ubigi|drimsim|роуминг|roaming|мобильн.{0,6}связ|сотов.{0,6}связ|пополнени.{0,12}телефон|билайн|beeline|мегафон|megafon|tele2|теле2|turkcell|vodafone|etisalat|truemove/i],
  ['fun', /развлечен|кино|музе|театр"""))

H.append(("""    PRIMARY KEY (profile_id, tx_id)
  )`);
}""",
"""    PRIMARY KEY (profile_id, tx_id)
  )`);
  // Откуда строка расхода (28.09.2026, ADR-233). NULL — внесена руками в шторке «+ Расход».
  // 'sim' — создана вкладкой eSIM (trip_sims.js): source_id = trip_sims.id; 'imei_reg' — регистрация
  // телефона в стране (trip_devices.js). Такую строку ведёт владелец: сумма синхронизируется при
  // правке записи, ручки /expenses её не правят и не удаляют. Удалили запись-владельца — строка
  // ОТВЯЗЫВАЕТСЯ (source=NULL) и дальше живёт обычной тратой: деньги уже потрачены.
  try {
    const ec = medDb.prepare('PRAGMA table_info(trip_expenses)').all().map(c => c.name);
    if (!ec.includes('source')) medDb.exec('ALTER TABLE trip_expenses ADD COLUMN source TEXT');
    if (!ec.includes('source_id')) medDb.exec('ALTER TABLE trip_expenses ADD COLUMN source_id INTEGER');
    // Чем оплачено (pay_sources.js): способ оплаты и сколько его единиц списано (для остатка).
    if (!ec.includes('pay_source_id')) medDb.exec('ALTER TABLE trip_expenses ADD COLUMN pay_source_id INTEGER');
    if (!ec.includes('pay_units')) medDb.exec('ALTER TABLE trip_expenses ADD COLUMN pay_units REAL');
    // Одна запись-владелец — не больше одной строки расхода.
    medDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_expenses_source ON trip_expenses(profile_id, source, source_id)
      WHERE source IS NOT NULL`);
  } catch (e) { console.error('trip_expenses source:', e.message); }
}

// Куда относится SIM (ADR-233). Ручная привязка главнее: trip_manual=1 и trip_leg='none' — вне
// поездок; trip_leg='f12'/'r5' — поездка, в которой есть это плечо (нет такой — lost_trip).
// Иначе автоподбор: страна SIM = страна точки маршрута, дата в [начало − 30 дн., конец].
// Дата SIM — подключение → установка → покупка → заведение.
export function placeOf(rec, journeys) {
  if (rec.trip_manual) {
    if (rec.trip_leg === 'none') return { J: null, reason: 'manual_none' };
    const J = journeys.find(J => J.legs.some(L => L.type[0] + L.id === rec.trip_leg));
    return J ? { J, reason: null, manual: true } : { J: null, reason: 'lost_trip' };
  }
  if (!rec.country) return { J: null, reason: 'region' };
  const c = norm(rec.country);
  const d = [(rec.activated_at || '').slice(0, 10), rec.installed_on, rec.purchased_on, String(rec.created_at || '').slice(0, 10)].find(isDate);
  const same = journeys.filter(J => J.legs.some(L => norm(L.to.country) === c || norm(L.from.country) === c));
  if (!same.length) return { J: null, reason: 'no_trip' };
  const J = d && same.find(J => d <= J.end && dnum(J.start) - dnum(d) <= 30);
  if (J) return { J, reason: null };
  const ahead = d ? same.filter(J => d < J.start).map(J => dnum(J.start) - dnum(d)) : [];
  return { J: null, reason: ahead.length ? 'before_window' : 'no_trip', days_before: ahead.length ? Math.min(...ahead) : null };
}"""))

H.append(("""  const { pid, airport, tasksDb } = deps;
  ensureJourneyTables(medDb);""",
"""  const { pid, airport, tasksDb } = deps;
  // simState/simLabel приходят из trip_sims.js через trip.js (своей копии логики сроков здесь нет).
  const simState = deps.simState || null, simLabel = deps.simLabel || (s => s.country || 'SIM');
  const SIM_RU = deps.simKindRu || { sim: 'SIM', esim: 'eSIM' };
  ensureJourneyTables(medDb);"""))

H.append(("""    const manual = medDb.prepare('SELECT * FROM trip_expenses WHERE profile_id=? ORDER BY spent_on, id').all(profileId);
""",
"""    const manual = medDb.prepare('SELECT * FROM trip_expenses WHERE profile_id=? ORDER BY spent_on, id').all(profileId);
    // Записи-владельцы строк расходов (ADR-233): SIM (trip_sims) и регистрации телефона в стране
    // (trip_imei_regs), и их место в поездках. Таблиц может ещё не быть — тогда пусто.
    let sims = [], regs = [];
    try { sims = medDb.prepare('SELECT * FROM trip_sims WHERE profile_id=? ORDER BY id').all(profileId); } catch (e) {}
    try { regs = medDb.prepare('SELECT * FROM trip_imei_regs WHERE profile_id=? ORDER BY id').all(profileId); } catch (e) {}
    const simPlace = new Map(sims.map(s => [s.id, placeOf(s, journeys)]));
    const regPlace = new Map(regs.map(r => [r.id, placeOf(Object.assign({}, r, { purchased_on: r.reg_on }), journeys)]));
    const ownerPlace = e => e.source === 'sim' ? simPlace.get(e.source_id) : e.source === 'imei_reg' ? regPlace.get(e.source_id) : null;
"""))

H.append(("""      for (const e of manual) if (inWin(e.spent_on)) items.push(item({ kind: 'manual', id: e.id, cat: CATS[e.category] ? e.category : 'other',
        title: e.title || CATS[e.category] || 'Расход', note: e.note || '', amount: e.amount, currency: e.currency,
        amount_local: e.amount_local, currency_local: e.currency_local }, e.spent_on, 3, 3));
      return { J, items };""",
"""      for (const e of manual) {
        // Строка SIM: в поездку — по той же привязке, что и бейдж (placeOf), сверка с выпиской
        // на 60 дней назад, как у полиса: eSIM покупают заранее. Ручные строки — как было.
        if (e.source === 'sim' || e.source === 'imei_reg') {
          const pl = ownerPlace(e);
          if (!pl || pl.J !== J) continue;
          items.push(item({ kind: 'manual', id: e.id, source: e.source, source_id: e.source_id, cat: CATS[e.category] ? e.category : 'comm',
            title: e.title || 'Связь', note: e.note || '', amount: e.amount, currency: e.currency,
            amount_local: e.amount_local, currency_local: e.currency_local }, e.spent_on, 60, 1));
          continue;
        }
        if (e.source) continue;
        if (inWin(e.spent_on)) items.push(item({ kind: 'manual', id: e.id, cat: CATS[e.category] ? e.category : 'other',
          title: e.title || CATS[e.category] || 'Расход', note: e.note || '', amount: e.amount, currency: e.currency,
          amount_local: e.amount_local, currency_local: e.currency_local }, e.spent_on, 3, 3));
      }
      return { J, items };"""))

H.append(("""    const today0 = today();
    return result.map(({ J, items }) => {""",
"""    const today0 = today();
    const simBadge = s => {
      const st = simState ? simState(s) : {};
      return { id: s.id, kind: s.kind, kind_ru: SIM_RU[s.kind] || 'eSIM', label: simLabel(s), status: st.status || null,
        expires_at: st.expires_at || null, activate_by: s.activate_by || null, manual: !!s.trip_manual };
    };
    // «Вне поездок» (ADR-233): SIM, не попавшие ни в одну поездку, — с причиной и суммой строки расхода.
    const expOf = (src, id) => manual.find(x => x.source === src && x.source_id === id);
    const outside = sims.filter(s => !simPlace.get(s.id).J).map(s => {
      const pl = simPlace.get(s.id), e = expOf('sim', s.id);
      return Object.assign(simBadge(s), { owner: 'sim', country: s.country || s.region || '', reason: pl.reason, days_before: pl.days_before ?? null,
        expense_id: e ? e.id : null, amount: e ? e.amount : null, currency: e ? e.currency : null, spent_on: e ? e.spent_on : null });
    }).concat(regs.filter(r => !regPlace.get(r.id).J).map(r => {
      const pl = regPlace.get(r.id), e = expOf('imei_reg', r.id);
      return { owner: 'imei_reg', id: r.id, kind_ru: 'Регистрация телефона', label: 'Регистрация телефона · ' + r.country,
        country: r.country, reason: pl.reason, days_before: pl.days_before ?? null, manual: !!r.trip_manual,
        expense_id: e ? e.id : null, amount: e ? e.amount : null, currency: e ? e.currency : null, spent_on: e ? e.spent_on : null };
    }));
    const list = result.map(({ J, items }) => {"""))

H.append(("""        totals: { rub: Math.round(rub), by, other, per_day: days > 0 ? Math.round(rub / days) : null },
        items
      };
    }).reverse();
  }""",
"""        totals: { rub: Math.round(rub), by, other, per_day: days > 0 ? Math.round(rub / days) : null },
        items,
        // Плечо-якорь для ручной привязки SIM к этой поездке (trip_leg).
        leg: J.legs[0].type[0] + J.legs[0].id,
        sims: sims.filter(s => simPlace.get(s.id).J === J).map(simBadge)
      };
    }).reverse();
    return { list, outside };
  }"""))

H.append(("""      res.json({ ok: true, has_bank: hasBank(profileId), cats: CATS, journeys: compute(profileId) });""",
"""      const c = compute(profileId);
      res.json({ ok: true, has_bank: hasBank(profileId), cats: CATS, journeys: c.list, outside: c.outside });"""))

H.append(("""    const cur0 = medDb.prepare('SELECT id FROM trip_expenses WHERE id=? AND profile_id=?').get(req.params.id, profileId);
    if (!cur0) return res.status(404).json({ ok: false, error: 'расход не найден' });""",
"""    const cur0 = medDb.prepare('SELECT id, source FROM trip_expenses WHERE id=? AND profile_id=?').get(req.params.id, profileId);
    if (!cur0) return res.status(404).json({ ok: false, error: 'расход не найден' });
    // Строку с владельцем (source) ведёт владелец — здесь её не правим (ADR-233).
    if (cur0.source) return res.status(409).json({ ok: false, error: 'Эта трата ведётся во вкладке eSIM — правьте там' });"""))

H.append(("""    const r = medDb.prepare('DELETE FROM trip_expenses WHERE id=? AND profile_id=?').run(req.params.id, profileId);
    if (!r.changes) return res.status(404).json({ ok: false, error: 'расход не найден' });""",
"""    const r = medDb.prepare('DELETE FROM trip_expenses WHERE id=? AND profile_id=? AND source IS NULL').run(req.params.id, profileId);
    if (!r.changes) return res.status(404).json({ ok: false, error: 'расход не найден или ведётся во вкладке eSIM' });"""))

# --- способы оплаты в ручных расходах (шестой круг) ---
H.append(("""const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });""",
"""import { paySourceOf, payUnits } from './pay_sources.js';

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });"""))
H.append(("""  function expenseBody(b) {
    const spent = String(b.spent_on || '').slice(0, 10);
    if (!isDate(spent)) return { err: 'нужна дата расхода' };
    const amount = num(b.amount), local = num(b.amount_local);
    if (!amount && !local) return { err: 'нужна сумма' };
    return { row: {
      spent_on: spent, category: CATS[b.category] ? b.category : 'other', title: txt(b.title, 120),
      amount, currency: amount ? (cur(b.currency) || 'RUB') : null,
      amount_local: local, currency_local: local ? cur(b.currency_local) : null, note: txt(b.note, 300)
    } };
  }
  const COLS = ['spent_on', 'category', 'title', 'amount', 'currency', 'amount_local', 'currency_local', 'note'];""",
"""  function expenseBody(b, profileId) {
    const spent = String(b.spent_on || '').slice(0, 10);
    if (!isDate(spent)) return { err: 'нужна дата расхода' };
    const amount = num(b.amount), local = num(b.amount_local);
    if (!amount && !local) return { err: 'нужна сумма' };
    const currency = amount ? (cur(b.currency) || 'RUB') : null, currency_local = local ? cur(b.currency_local) : null;
    // Чем оплачено (pay_sources.js). Единицы: вписанные руками главнее, иначе пересчёт по курсу способа.
    let pay_source_id = null, pay_units = null;
    if (b.pay_source_id != null && b.pay_source_id !== '') {
      const src = paySourceOf(medDb, profileId, b.pay_source_id);
      if (!src) return { err: 'способ оплаты не найден' };
      pay_source_id = src.id;
      pay_units = num(b.pay_units) ?? payUnits(src, amount || local, amount ? currency : currency_local);
    }
    return { row: {
      spent_on: spent, category: CATS[b.category] ? b.category : 'other', title: txt(b.title, 120),
      amount, currency, amount_local: local, currency_local, note: txt(b.note, 300), pay_source_id, pay_units
    } };
  }
  const COLS = ['spent_on', 'category', 'title', 'amount', 'currency', 'amount_local', 'currency_local', 'note', 'pay_source_id', 'pay_units'];"""))
H.append(("""    const { err, row } = expenseBody(req.body || {});
    if (err) return res.status(400).json({ ok: false, error: err });
    try {
      const r = medDb.prepare(""","""    const { err, row } = expenseBody(req.body || {}, profileId);
    if (err) return res.status(400).json({ ok: false, error: err });
    try {
      const r = medDb.prepare("""))
H.append(("""    const { err, row } = expenseBody(req.body || {});
    if (err) return res.status(400).json({ ok: false, error: err });
    try {
      medDb.prepare(`UPDATE""","""    const { err, row } = expenseBody(req.body || {}, profileId);
    if (err) return res.status(400).json({ ok: false, error: err });
    try {
      medDb.prepare(`UPDATE"""))
