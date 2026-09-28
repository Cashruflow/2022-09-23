// «Способы оплаты»: Trip Coins как bonus, SIM оплачена баллами, пополнение, архив, чужой профиль, 409.
import express from 'express';
import Database from 'better-sqlite3';
import { mountPaySources } from './pay_sources.js';
import { mountTripSims } from './trip_sims_test.js';
import { mountTripDevices } from './trip_devices_test.js';
import { mountTripJourneys } from './trip_journeys.js';

const db = new Database(':memory:');
const tdb = new Database(':memory:');   // tasks.db: карты /cash
tdb.exec(`CREATE TABLE cards (id INTEGER PRIMARY KEY, project_id INT, title TEXT, last4 TEXT, bank TEXT);
INSERT INTO cards VALUES (7, NULL, 'Тинькофф Black', '4417', 'Т-Банк');`);
db.exec(`CREATE TABLE profiles (id INTEGER PRIMARY KEY, patient_key TEXT); INSERT INTO profiles VALUES (1,'1'),(5,'5'),(6,'6');
CREATE TABLE trip_flights (id INTEGER PRIMARY KEY, profile_id INT, depart_on TEXT, depart_time TEXT, arrive_on TEXT, from_city TEXT, from_code TEXT, to_city TEXT, to_code TEXT, flight_no TEXT, airline TEXT, price REAL, currency TEXT, price_local REAL, currency_local TEXT);
CREATE TABLE trip_rides (id INTEGER PRIMARY KEY, profile_id INT, depart_on TEXT, depart_time TEXT, arrive_on TEXT, kind TEXT, from_place TEXT, to_place TEXT, from_country TEXT, to_country TEXT, train_no TEXT, carrier TEXT, price REAL, currency TEXT);
CREATE TABLE trip_stays (id INTEGER PRIMARY KEY, profile_id INT, check_in TEXT, name TEXT, city TEXT, amount REAL, currency TEXT, amount_local REAL, currency_local TEXT);
CREATE TABLE trip_insurance (id INTEGER PRIMARY KEY, profile_id INT, from_date TEXT, insurer TEXT, price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT);
CREATE TABLE trip_permits (id INTEGER PRIMARY KEY, profile_id INT, valid_from TEXT, issued_on TEXT, country TEXT, price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT);
CREATE TABLE patient_accounts (id INTEGER PRIMARY KEY, profile_id INT);
CREATE TABLE patient_telegram_links (id INTEGER PRIMARY KEY, account_id INT, chat_id TEXT, consumed_at TEXT);`);
const numAmount = v => { let s = String(v ?? '').replace(/[\s ]/g, ''); if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, ''); else s = s.replace(',', '.'); return Number(s.replace(/[^\d.]/g, '')); };
const normDate = r => /^\d{4}-\d{2}-\d{2}$/.test(String(r || '').trim()) ? String(r).trim() : null;
const addDays = (iso, d) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + d * 86400e3).toISOString().slice(0, 10);
const app = express();
app.use(express.json());
const pid = (req, res) => req.headers['x-auth'] ? +req.headers['x-auth'] : (res.status(401).json({ error: 'auth' }), null);
const common = {
  pid, tasksDb: tdb, logUpload: () => null, logAiCall: () => {}, logGeneration: () => 1, ask: async () => ({ text: '{}', inTok: 0, outTok: 0 }),
  parseJson: JSON.parse, cost: () => 0, purgeScansLazy: () => {}, apiKey: 'x', SCAN_MODEL: 'm', sniffMime: () => ({}), numAmount, normDate, addDays,
  localToUtc: () => null, COUNTRY_TZ: {}, vendorResolve: (d, v) => v ? String(v).trim() : null, vendorKey: s => String(s || '').toLowerCase(), isAdmin: () => false,
  consts: { MAX_BYTES: 1e6, MAX_FILES: 5, UP_DIR: '/tmp', KEEP_HOURS: 24, TEXT_MAX: 200, COUNTRY_MAX: 60, PASTE_MAX: 20000, SCAN_MIME: {} }
};
mountPaySources(app, db, common);
const sims = mountTripSims(app, db, common);
mountTripDevices(app, db, { ...common, ...sims, noTimers: true });
mountTripJourneys(app, db, { pid, airport: () => null, tasksDb: null, ...sims, simKindRu: sims.SIM_KIND_RU });
const srv = app.listen(0);
const B = 'http://127.0.0.1:' + srv.address().port + '/api/profile/me';
const call = async (m, p, b, who = 5) => { const r = await fetch(B + p, { method: m, headers: { 'x-auth': String(who), 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return [r.status, await r.json()]; };
let r;
// 1 Trip Coins: 1 балл = 0,1 ₽ (курс вручную), на 01.09 было 5000 баллов
r = await call('POST', '/pay-sources', { kind: 'bonus', title: 'Trip Coins', rate_rub: '0,1', opening_balance: 5000, balance_on: '2026-09-01' });
const tc = r[1].source; console.log('bonus created', r[0], [tc.unit, tc.rate_rub, tc.balance, tc.balance_rub]);
r = await call('GET', '/pay-sources/' + tc.id + '/quote?amount=339,80&currency=RUB'); console.log('quote', r[1].units, r[1].remaining, '|', r[1].hint);
// 2 SIM 339,80 ₽ оплачена Trip Coins
r = await call('POST', '/trip/sims', { kind: 'esim', country: 'Египет', booking_no: '1539367401113525', price: '339,80', price_currency: 'RUB', purchased_on: '2026-09-28', pay_source_id: tc.id });
console.log('sim', r[0], r[1].message || '', r[1].sim && [r[1].sim.pay_source_id, r[1].sim.paid_with]);
console.log('expense', JSON.stringify(db.prepare('SELECT amount, currency, pay_source_id, pay_units FROM trip_expenses').get()));
r = await call('GET', '/pay-sources'); console.log('balance after SIM', r[1].sources[0].balance, '(ожидалось 5000 − 3398 = 1602)', 'used', r[1].sources[0].used);
// правка цены → пересчёт единиц
r = await call('PATCH', '/trip/sims/' + 1, { price: 400 }); r = await call('GET', '/pay-sources'); console.log('after price 400', r[1].sources[0].balance, '(ожидалось 1000)');
// 3 пополнение
r = await call('POST', '/pay-sources/' + tc.id + '/moves', { units: 250, moved_on: '2026-09-29', note: 'начислили за отель' }); console.log('top-up', r[0], r[1].source.balance, '(ожидалось 1250)');
// ручной расход с того же способа + единицы руками
r = await call('POST', '/trip/expenses', { spent_on: '2026-09-30', amount: 50, currency: 'RUB', category: 'food', pay_source_id: tc.id, pay_units: 400 });
r = await call('GET', '/pay-sources'); console.log('manual 400 units', r[1].sources[0].balance, '(ожидалось 850)');
// чужой способ в расходе и SIM
r = await call('POST', '/trip/expenses', { spent_on: '2026-09-30', amount: 1, pay_source_id: tc.id }, 6); console.log('чужой способ в расходе', r[0], r[1].error);
r = await call('POST', '/trip/sims', { country: 'Турция', pay_source_id: tc.id }, 6); console.log('чужой способ в SIM', r[0], r[1].error);
// 4 чужой профиль
r = await call('GET', '/pay-sources/' + tc.id + '/quote?amount=1', null, 6); console.log('чужой quote', r[0]);
r = await call('PATCH', '/pay-sources/' + tc.id, { title: 'x' }, 6); console.log('чужой patch', r[0]);
r = await call('DELETE', '/pay-sources/' + tc.id, null, 6); console.log('чужой delete', r[0]);
r = await call('GET', '/pay-sources', null, 6); console.log('чужой список пуст', r[1].sources.length);
// 5 удаление с расходами → 409, архив
r = await call('DELETE', '/pay-sources/' + tc.id); console.log('delete in use', r[0], r[1].message, JSON.stringify(r[1].usage));
r = await call('PATCH', '/pay-sources/' + tc.id, { archived: true }); console.log('archive', r[0], r[1].source.archived);
r = await call('GET', '/pay-sources'); console.log('список без архива', r[1].sources.length);
r = await call('GET', '/pay-sources?all=1'); console.log('с архивом', r[1].sources.length, 'остаток сохранён', r[1].sources[0].balance);
// удаление SIM оставляет расход с pay_source_id → по-прежнему 409
r = await call('DELETE', '/trip/sims/1'); r = await call('DELETE', '/pay-sources/' + tc.id); console.log('после удаления SIM всё ещё 409', r[0]);
// удаление неиспользуемого
r = await call('POST', '/pay-sources', { kind: 'cash', title: 'Наличные USD', unit: 'USD', opening_balance: 300 });
const cash = r[1].source.id; r = await call('POST', '/pay-sources/' + cash + '/moves', { units: -20 }); console.log('cash', r[1].source.balance);
r = await call('DELETE', '/pay-sources/' + cash); console.log('delete unused', r[0], db.prepare('SELECT COUNT(*) n FROM pay_moves WHERE source_id=?').get(cash).n);
// валидация
r = await call('POST', '/pay-sources', { kind: 'bonus', title: 'X', rate_rub: -1 }); console.log('bad rate', r[0], r[1].error);
r = await call('POST', '/pay-sources', { kind: 'card', title: 'Карта', last4: '4276 1234 5678 9012' }); console.log('last4 only', r[1].source.last4);
// карты /cash: у пациента нельзя, у владельца (profile 1) — можно
r = await call('POST', '/pay-sources', { kind: 'card', title: 'Т', card_id: 7 }); console.log('card_id пациентом', r[0]);
r = await call('POST', '/pay-sources', { kind: 'card', title: 'Т-Банк', card_id: 7 }, 1); console.log('card_id владельцем', r[0], r[1].source && [r[1].source.last4, r[1].source.bank]);
r = await call('GET', '/pay-sources/cards', null, 1); console.log('карты владельца', r[1].cards.length);
srv.close(); process.exit(0);
