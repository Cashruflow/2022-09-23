// Поездки целиком и их расходы (21.09.2026, решения Константина).
//
// (шапка сокращена в локальной копии для теста)

import { paySourceOf, payUnits } from './pay_sources.js';

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
const dnum = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const dstr = n => new Date(n * 86400000).toISOString().slice(0, 10);
const norm = s => String(s == null ? '' : s).normalize('NFC').trim().replace(/\s+/g, ' ')
  .toLowerCase().replace(/ё/g, 'е');
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// «Связь» (comm) — 28.09.2026, ADR-233: SIM/eSIM, пополнение, роуминг, регистрация телефона.
export const CATS = { transport: 'Транспорт', stay: 'Жильё', food: 'Еда', comm: 'Связь', fun: 'Развлечения', other: 'Прочее' };
const ROUND_MAX_DAYS = 90;   // дальше обратное плечо не ищем (см. шапку)
const LINK_DAYS = 2;         // стыковка: следующий вылет не позже чем через 2 дня после прилёта
const BIZ_ACCOUNT = 'Т-Бизнес';

// Категория банковской операции — по категории банка и описанию. Порядок важен:
// «Авиабилеты» раньше «билетов на мероприятия», отели раньше еды («завтрак в отеле»).
const BANK_CAT = [
  ['transport', /авиа|ж\/д|жд билет|такси|транспорт|аренда авто|каршеринг|топлив|азс|трансфер|аэроэкспресс|метро|metro|grab|bolt|uber|yandex ?go|яндекс ?go|airline|aeroflot|аэрофлот|\bs7\b|победа|pobeda|lounge|бизнес.?зал|vip.?зал|parking|парковк/i],
  ['stay', /отел|гостиниц|hotel|booking|agoda|airbnb|аренда жиль|hostel|хостел|resort|суточн/i],
  ['food', /ресторан|кафе|фастфуд|супермаркет|продукт|\bеда\b|\bbar\b|\bбар\b|coffee|кофе|7-eleven|seven eleven|makro|family ?mart|food|доставк|пекарн|bakery/i],
  // Связь (ADR-233): SIM/eSIM, пополнение, роуминг. Раньше «развлечений» и «прочего».
  ['comm', /esim|e-sim|сим.?карт|sim.?card|airalo|holafly|yesim|ubigi|drimsim|роуминг|roaming|мобильн.{0,6}связ|сотов.{0,6}связ|пополнени.{0,12}телефон|билайн|beeline|мегафон|megafon|tele2|теле2|turkcell|vodafone|etisalat|truemove/i],
  ['fun', /развлечен|кино|музе|театр|экскурс|аттракцион|\bspa\b|\bспа\b|массаж|massage|концерт|мероприят|туризм|дайв|diving|аквапарк/i]
];
export function bankCat(category, comment) {
  const s = (category || '') + ' ' + (comment || '');
  for (const [k, re] of BANK_CAT) if (re.test(s)) return k;
  return 'other';
}

// Город из свободного поля наземного билета: «Казань (аэропорт), терминал 1» → «Казань».
const cityOf = s => String(s || '').split(/[,(]/)[0].trim();

export function ensureJourneyTables(medDb) {
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    spent_on TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    title TEXT,
    amount REAL,
    currency TEXT,
    amount_local REAL,
    currency_local TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  medDb.exec('CREATE INDEX IF NOT EXISTS idx_trip_expenses_profile ON trip_expenses(profile_id, spent_on)');
  // Пометки к операциям выписки: своя категория или «не относится к поездке». Сами
  // операции живут в tasks.db и отсюда не правятся — только взгляд раздела на них.
  medDb.exec(`CREATE TABLE IF NOT EXISTS trip_bank_marks (
    profile_id INTEGER NOT NULL,
    tx_id INTEGER NOT NULL,
    category TEXT,
    hidden INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (profile_id, tx_id)
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
}

// Плечи дороги: рейсы и наземные билеты с датой, по порядку.
function loadLegs(medDb, profileId, airport) {
  const place = (city, code) => {
    const a = code ? airport(code) : null;
    return { city: city || (a && a.city) || '', country: (a && a.country) || '', code: code || '' };
  };
  const fl = medDb.prepare(`SELECT * FROM trip_flights WHERE profile_id=? AND depart_on IS NOT NULL AND depart_on<>''`)
    .all(profileId).map(f => ({
      type: 'flight', id: f.id, date: f.depart_on, time: f.depart_time || '',
      arrive: isDate(f.arrive_on) ? f.arrive_on : f.depart_on,
      from: place(f.from_city, f.from_code), to: place(f.to_city, f.to_code),
      title: [f.flight_no || f.airline || 'Рейс', (f.from_code || f.from_city || '—') + ' → ' + (f.to_code || f.to_city || '—')].join(' · '),
      amount: f.price, currency: f.currency, amount_local: f.price_local, currency_local: f.currency_local
    }));
  const KIND = { bus: 'Автобус', train: 'Поезд', ferry: 'Паром', transfer: 'Трансфер' };
  const rd = medDb.prepare(`SELECT * FROM trip_rides WHERE profile_id=? AND depart_on IS NOT NULL AND depart_on<>''`)
    .all(profileId).map(r => ({
      type: 'ride', id: r.id, date: r.depart_on, time: r.depart_time || '',
      arrive: isDate(r.arrive_on) ? r.arrive_on : r.depart_on,
      from: { city: cityOf(r.from_place), country: r.from_country || '' },
      to: { city: cityOf(r.to_place), country: r.to_country || '' },
      title: [(KIND[r.kind] || 'Переезд') + (r.train_no ? ' ' + r.train_no : r.carrier ? ' ' + r.carrier : ''),
        (cityOf(r.from_place) || '—') + ' → ' + (cityOf(r.to_place) || '—')].join(' · '),
      amount: r.price, currency: r.currency, amount_local: null, currency_local: null
    }));
  return [...fl, ...rd].sort((a, b) => a.date === b.date ? (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)
    : (a.date < b.date ? -1 : 1));
}

const samePlace = (a, b) => {
  if (a.code && b.code && a.code === b.code) return true;
  if (a.city && b.city) return norm(a.city) === norm(b.city);
  return !!(a.country && b.country && norm(a.country) === norm(b.country));
};

// Сборка поездок из плеч. Возвращает [{kind:'round'|'oneway', legs, start, end, home}].
export function buildJourneys(legs, stays) {
  const out = [];
  let i = 0;
  while (i < legs.length) {
    const L = legs[i], home = L.from;
    const intl = home.country && L.to.country && norm(home.country) !== norm(L.to.country);
    const atHome = p => intl
      ? !!(p.country && norm(p.country) === norm(home.country))
      : !!((p.code && home.code && p.code === home.code) || (p.city && home.city && norm(p.city) === norm(home.city)));
    let j = -1;
    if (home.country || home.city) {
      for (let k = i + 1; k < legs.length; k++) {
        if (dnum(legs[k].date) - dnum(L.date) > ROUND_MAX_DAYS) break;
        if (atHome(legs[k].to)) { j = k; break; }
      }
    }
    if (j >= 0) {
      out.push({ kind: 'round', legs: legs.slice(i, j + 1), start: L.date, end: legs[j].arrive, home });
      i = j + 1;
      continue;
    }
    // В одну сторону: склеиваем стыковки, конец — заселение в отель по прилёту.
    j = i;
    while (j + 1 < legs.length && dnum(legs[j + 1].date) - dnum(legs[j].arrive) <= LINK_DAYS
      && samePlace(legs[j + 1].from, legs[j].to)) j++;
    const arr = legs[j].arrive;
    const ci = stays.filter(s => isDate(s.check_in) && s.check_in >= arr && dnum(s.check_in) - dnum(arr) <= LINK_DAYS)
      .map(s => s.check_in).sort()[0];
    out.push({ kind: 'oneway', legs: legs.slice(i, j + 1), start: L.date, end: ci || arr, home });
    i = j + 1;
  }
  return out;
}

export function mountTripJourneys(app, medDb, deps) {
  const { pid, airport, tasksDb } = deps;
  // simState/simLabel приходят из trip_sims.js через trip.js (своей копии логики сроков здесь нет).
  const simState = deps.simState || null, simLabel = deps.simLabel || (s => s.country || 'SIM');
  const SIM_RU = deps.simKindRu || { sim: 'SIM', esim: 'eSIM' };
  ensureJourneyTables(medDb);
  const P = '/api/profile/:profileId/trip';
  const hasBank = profileId => {
    if (!tasksDb) return false;
    const r = medDb.prepare('SELECT patient_key FROM profiles WHERE id=?').get(profileId);
    return !!r && String(r.patient_key) === '1';
  };
  const num = v => { const n = Number(String(v == null ? '' : v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) && n ? n : null; };
  const cur = v => { const s = String(v || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); return s || null; };
  const txt = (v, max) => { const s = String(v == null ? '' : v).trim().replace(/\s+/g, ' '); return s ? s.slice(0, max) : null; };
  const isRub = c => !c || String(c).toUpperCase() === 'RUB';

  function compute(profileId) {
    const stays = medDb.prepare('SELECT * FROM trip_stays WHERE profile_id=?').all(profileId);
    const legs = loadLegs(medDb, profileId, airport);
    const journeys = buildJourneys(legs, stays);
    const ins = medDb.prepare('SELECT * FROM trip_insurance WHERE profile_id=?').all(profileId);
    const permits = medDb.prepare('SELECT * FROM trip_permits WHERE profile_id=?').all(profileId);
    const manual = medDb.prepare('SELECT * FROM trip_expenses WHERE profile_id=? ORDER BY spent_on, id').all(profileId);
    // Записи-владельцы строк расходов (ADR-233): SIM (trip_sims) и регистрации телефона в стране
    // (trip_imei_regs), и их место в поездках. Таблиц может ещё не быть — тогда пусто.
    let sims = [], regs = [];
    try { sims = medDb.prepare('SELECT * FROM trip_sims WHERE profile_id=? ORDER BY id').all(profileId); } catch (e) {}
    try { regs = medDb.prepare('SELECT * FROM trip_imei_regs WHERE profile_id=? ORDER BY id').all(profileId); } catch (e) {}
    const simPlace = new Map(sims.map(s => [s.id, placeOf(s, journeys)]));
    const regPlace = new Map(regs.map(r => [r.id, placeOf(Object.assign({}, r, { purchased_on: r.reg_on }), journeys)]));
    const ownerPlace = e => e.source === 'sim' ? simPlace.get(e.source_id) : e.source === 'imei_reg' ? regPlace.get(e.source_id) : null;

    const bank = hasBank(profileId);
    let txs = [];
    const marks = new Map();
    if (bank) {
      try {
        txs = tasksDb.prepare(`SELECT id, date, amount, category, comment, account FROM cash_transactions
          WHERE type='fact' AND amount<0 AND COALESCE(account,'')<>? ORDER BY date`).all(BIZ_ACCOUNT);
      } catch (e) { console.error('[trip journeys] cash_transactions:', e.message); }
      for (const m of medDb.prepare('SELECT * FROM trip_bank_marks WHERE profile_id=?').all(profileId)) marks.set(m.tx_id, m);
    }
    const used = new Set();
    // Совпадение записи с операцией: рублёвая сумма ±0,5% (не меньше рубля), операция
    // в окне [от, до]. Из подходящих берём ближайшую к дате записи.
    const matchTx = (amount, currency, date, back, ahead) => {
      if (!bank || !amount || !isRub(currency) || !isDate(date)) return null;
      const want = Math.abs(amount), tol = Math.max(1, want * 0.005), d0 = dnum(date);
      let best = null;
      for (const t of txs) {
        if (used.has(t.id)) continue;
        const dd = dnum(t.date) - d0;
        if (dd < -back || dd > ahead) continue;
        if (Math.abs(Math.abs(t.amount) - want) > tol) continue;
        if (!best || Math.abs(dd) < Math.abs(dnum(best.date) - d0)) best = t;
      }
      if (best) used.add(best.id);
      return best;
    };
    const item = (o, date, back, ahead) => {
      const t = matchTx(o.amount, o.currency, date, back, ahead);
      return { ...o, date, src: bank ? (t ? 'bank' : 'cash') : null, bank: t ? (t.account || 'выписка') : null, tx_id: t ? t.id : null };
    };

    // Сначала записи с точной датой покупки неизвестной (билеты покупают заранее) — окно
    // назад полгода; свои расходы — ±3 дня. Затем остаток выписки в датах поездки.
    const result = journeys.map(J => {
      const inWin = d => isDate(d) && d >= J.start && d <= J.end;
      const items = [];
      for (const L of J.legs) items.push(item({ kind: L.type, id: L.id, cat: 'transport', title: L.title,
        amount: L.amount, currency: L.currency, amount_local: L.amount_local, currency_local: L.currency_local }, L.date, 180, 1));
      if (J.kind === 'round') for (const s of stays) if (inWin(s.check_in)) items.push(item({ kind: 'stay', id: s.id, cat: 'stay',
        title: s.name + (s.city ? ' · ' + s.city : ''), amount: s.amount, currency: s.currency,
        amount_local: s.amount_local, currency_local: s.currency_local }, s.check_in, 180, 30));
      for (const p of ins) if (inWin(p.from_date)) items.push(item({ kind: 'ins', id: p.id, cat: 'other',
        title: 'Страховка' + (p.insurer ? ' · ' + p.insurer : ''), amount: p.price, currency: p.price_currency,
        amount_local: p.price_local, currency_local: p.price_local_currency }, p.from_date, 60, 1));
      for (const p of permits) {
        const d = isDate(p.valid_from) ? p.valid_from : p.issued_on;
        if (inWin(d)) items.push(item({ kind: 'permit', id: p.id, cat: 'other',
          title: 'Разрешение' + (p.country ? ' · ' + p.country : ''), amount: p.price, currency: p.price_currency,
          amount_local: p.price_local, currency_local: p.price_local_currency }, d, 60, 1));
      }
      for (const e of manual) {
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
      return { J, items };
    });
    // Остаток выписки — после всех совпадений, чтобы оплата брони не пришла вторым разом.
    for (const { J, items } of result) {
      for (const t of txs) {
        if (used.has(t.id) || t.date < J.start || t.date > J.end) continue;
        const m = marks.get(t.id);
        used.add(t.id);
        items.push({ kind: 'bank', id: t.id, tx_id: t.id, date: t.date,
          cat: m && CATS[m.category] ? m.category : bankCat(t.category, t.comment),
          title: t.comment || t.category || 'Операция', bank_category: t.category || '',
          amount: Math.abs(t.amount), currency: 'RUB', src: 'bank', bank: t.account || 'выписка',
          hidden: !!(m && m.hidden) });
      }
    }

    const today0 = today();
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
    const list = result.map(({ J, items }) => {
      items.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      const by = Object.fromEntries(Object.keys(CATS).map(k => [k, 0]));
      const other = {};
      let rub = 0;
      for (const it of items) {
        if (it.hidden) continue;
        if (it.amount && isRub(it.currency)) { rub += Number(it.amount); by[it.cat] += Number(it.amount); }
        else if (it.amount) { const c = cur(it.currency); other[c] = (other[c] || 0) + Number(it.amount); }
        else if (it.amount_local && it.currency_local) { const c = cur(it.currency_local); other[c] = (other[c] || 0) + Number(it.amount_local); }
      }
      const days = dnum(J.end) - dnum(J.start) + 1;
      // Маршрут: дом → места прилёта по порядку (без повторов подряд) → дом.
      const route = [J.home.city || J.home.country || '?'];
      for (const L of J.legs) {
        const c = L.to.city || L.to.country || '?';
        if (norm(c) !== norm(route[route.length - 1])) route.push(c);
      }
      Object.keys(by).forEach(k => by[k] = Math.round(by[k]));
      Object.keys(other).forEach(k => other[k] = Math.round(other[k]));
      return {
        key: J.start + ':' + J.legs[0].type[0] + J.legs[0].id,
        kind: J.kind, start: J.start, end: J.end, days, route,
        status: J.start > today0 ? 'plan' : J.end >= today0 ? 'now' : 'done',
        legs: J.legs.length,
        totals: { rub: Math.round(rub), by, other, per_day: days > 0 ? Math.round(rub / days) : null },
        items,
        // Плечо-якорь для ручной привязки SIM к этой поездке (trip_leg).
        leg: J.legs[0].type[0] + J.legs[0].id,
        sims: sims.filter(s => simPlace.get(s.id).J === J).map(simBadge)
      };
    }).reverse();
    return { list, outside };
  }

  app.get(P + '/journeys', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    try {
      const c = compute(profileId);
      res.json({ ok: true, has_bank: hasBank(profileId), cats: CATS, journeys: c.list, outside: c.outside });
    } catch (e) { console.error('[trip journeys]', e); res.status(500).json({ ok: false, error: e.message }); }
  });

  function expenseBody(b, profileId) {
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
  const COLS = ['spent_on', 'category', 'title', 'amount', 'currency', 'amount_local', 'currency_local', 'note', 'pay_source_id', 'pay_units'];

  app.post(P + '/expenses', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const { err, row } = expenseBody(req.body || {}, profileId);
    if (err) return res.status(400).json({ ok: false, error: err });
    try {
      const r = medDb.prepare(`INSERT INTO trip_expenses (profile_id, ${COLS.join(', ')}) VALUES (?${',?'.repeat(COLS.length)})`)
        .run(profileId, ...COLS.map(k => row[k]));
      res.json({ ok: true, expense: medDb.prepare('SELECT * FROM trip_expenses WHERE id=?').get(r.lastInsertRowid) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.patch(P + '/expenses/:id', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const cur0 = medDb.prepare('SELECT id, source FROM trip_expenses WHERE id=? AND profile_id=?').get(req.params.id, profileId);
    if (!cur0) return res.status(404).json({ ok: false, error: 'расход не найден' });
    // Строку с владельцем (source) ведёт владелец — здесь её не правим (ADR-233).
    if (cur0.source) return res.status(409).json({ ok: false, error: 'Эта трата ведётся во вкладке eSIM — правьте там' });
    const { err, row } = expenseBody(req.body || {}, profileId);
    if (err) return res.status(400).json({ ok: false, error: err });
    try {
      medDb.prepare(`UPDATE trip_expenses SET ${COLS.map(k => k + '=?').join(', ')}, updated_at=datetime('now') WHERE id=?`)
        .run(...COLS.map(k => row[k]), cur0.id);
      res.json({ ok: true, expense: medDb.prepare('SELECT * FROM trip_expenses WHERE id=?').get(cur0.id) });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete(P + '/expenses/:id', (req, res) => {
    const profileId = pid(req, res); if (!profileId) return;
    const r = medDb.prepare('DELETE FROM trip_expenses WHERE id=? AND profile_id=? AND source IS NULL').run(req.params.id, profileId);
    if (!r.changes) return res.status(404).json({ ok: false, error: 'расход не найден или ведётся во вкладке eSIM' });
    res.json({ ok: true });
  });
}
