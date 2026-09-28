import express from 'express';
import Database from 'better-sqlite3';
import { mountTripSims } from './trip_sims_test.js';
import { mountTripJourneys } from './trip_journeys.js';

const db = new Database(':memory:');
db.exec(`CREATE TABLE profiles (id INTEGER PRIMARY KEY, patient_key TEXT);
INSERT INTO profiles VALUES (5,'5');
CREATE TABLE trip_flights (id INTEGER PRIMARY KEY, profile_id INT, depart_on TEXT, depart_time TEXT, arrive_on TEXT, from_city TEXT, from_code TEXT, to_city TEXT, to_code TEXT, flight_no TEXT, airline TEXT, price REAL, currency TEXT, price_local REAL, currency_local TEXT);
CREATE TABLE trip_rides (id INTEGER PRIMARY KEY, profile_id INT, depart_on TEXT, depart_time TEXT, arrive_on TEXT, kind TEXT, from_place TEXT, to_place TEXT, from_country TEXT, to_country TEXT, train_no TEXT, carrier TEXT, price REAL, currency TEXT);
CREATE TABLE trip_stays (id INTEGER PRIMARY KEY, profile_id INT, check_in TEXT, name TEXT, city TEXT, amount REAL, currency TEXT, amount_local REAL, currency_local TEXT);
CREATE TABLE trip_insurance (id INTEGER PRIMARY KEY, profile_id INT, from_date TEXT, insurer TEXT, price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT);
CREATE TABLE trip_permits (id INTEGER PRIMARY KEY, profile_id INT, valid_from TEXT, issued_on TEXT, country TEXT, price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT);
CREATE TABLE patient_accounts (id INTEGER PRIMARY KEY, profile_id INT);
CREATE TABLE patient_telegram_links (id INTEGER PRIMARY KEY, account_id INT, chat_id TEXT, consumed_at TEXT);
INSERT INTO trip_flights (id, profile_id, depart_on, from_city, from_code, to_city, to_code, flight_no, price, currency) VALUES
 (11,5,'2026-10-01','Москва','SVO','Хургада','HRG','SU1', 30000,'RUB'),
 (12,5,'2026-10-08','Хургада','HRG','Москва','SVO','SU2', 28000,'RUB');
`);
const AP = { SVO: { city: 'Москва', country: 'Россия' }, HRG: { city: 'Хургада', country: 'Египет' } };
const airport = c => AP[c] || null;
const numAmount = v => { let s = String(v ?? '').replace(/[\s ]/g, ''); if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, ''); else s = s.replace(',', '.'); return Number(s.replace(/[^\d.]/g, '')); };
const normDate = r => /^\d{4}-\d{2}-\d{2}$/.test(String(r || '').trim()) ? String(r).trim() : null;
const addDays = (iso, d) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + d * 86400e3).toISOString().slice(0, 10);
function tzOffsetMin(tz, utcMs) { const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(utcMs)).forEach(x => { p[x.type] = x.value; }); return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - utcMs) / 60000); }
function localToUtc(iso, hm, tz) { const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso), t = /^(\d{1,2}):(\d{2})$/.exec(hm); const naive = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]); let utc = naive - tzOffsetMin(tz, naive) * 60000; return naive - tzOffsetMin(tz, utc) * 60000; }
const app = express();
app.use(express.json());
const pid = (req, res) => req.headers['x-auth'] ? 5 : (res.status(401).json({ error: 'auth' }), null);
const helpers = mountTripSims(app, db, {
  pid, tasksDb: null, logUpload: () => null, logAiCall: () => {}, logGeneration: () => 1,
  ask: async () => ({ text: '{}', inTok: 0, outTok: 0 }), parseJson: JSON.parse, cost: () => 0, purgeScansLazy: () => {},
  apiKey: 'x', SCAN_MODEL: 'm', sniffMime: () => ({}), numAmount, normDate, addDays, localToUtc,
  COUNTRY_TZ: { 'Египет': 'Africa/Cairo' }, vendorResolve: (db, v) => v ? String(v).trim() : null,
  consts: { MAX_BYTES: 1e6, MAX_FILES: 5, UP_DIR: '/tmp', KEEP_HOURS: 24, TEXT_MAX: 200, COUNTRY_MAX: 60, PASTE_MAX: 20000, SCAN_MIME: {} }
});
mountTripJourneys(app, db, { pid, airport, tasksDb: null, ...helpers, simKindRu: helpers.SIM_KIND_RU });
const srv = app.listen(0);
const base = 'http://127.0.0.1:' + srv.address().port + '/api/profile/me/trip';
const H = { 'x-auth': '1', 'Content-Type': 'application/json' };
const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); return [r.status, await r.json()]; };
const D = String.fromCharCode(36);
let r;
r = await fetch(base + '/sims'); console.log('noauth', r.status);
r = await call('POST', '/sims', { kind: 'esim', country: 'Египет', product: 'Egypt 5G eSIM', plan: 'QR code-3 days-Daily- 2GB', plan_kind: 'daily', data_mb: 2048, throttle_kbps: 512, days: 3,
  lpa: ['LPA:1', 'smdp.io', 'K2-36Y6K0-7CDVXL'].join(D), iccid: '8948010010094791430', booking_no: '1539367401113525', purchased_on: '2026-09-28', activate_by: '2026-11-26',
  price: '339,80', price_currency: 'RUB', price_base: '357,69', discount: '17,89', paid_with: 'Trip Coins', booked_via: 'Trip.com', phone: '+79631234503' });
console.log('create', r[0], r[1].code_skipped, r[1].sim && [r[1].sim.id, r[1].sim.status, r[1].sim.label, r[1].sim.iccid_masked, r[1].sim.phone_masked, r[1].sim.lpa_masked, r[1].sim.expense_id, 'iccid' in r[1].sim]);
const id = r[1].sim.id;
console.log('exp rows', db.prepare("SELECT id, amount, category, source, source_id, title, note, spent_on FROM trip_expenses").all());
r = await call('POST', '/sims', { country: 'Египет', booking_no: '1539367401113525', apn: 'internet' });
console.log('reimport', r[0], r[1].merged, r[1].filled, db.prepare('SELECT COUNT(*) n FROM trip_sims').get().n, db.prepare('SELECT COUNT(*) n FROM trip_expenses').get().n);
r = await call('PATCH', '/sims/' + id, { price: '400' });
console.log('patch price', r[0], db.prepare("SELECT amount FROM trip_expenses").get());
r = await call('GET', '/journeys');
console.log('journeys', r[0], JSON.stringify(r[1].journeys.map(j => ({ leg: j.leg, comm: j.totals.by.comm, sims: j.sims, items: j.items.filter(i => i.source).map(i => i.title) }))), 'outside', JSON.stringify(r[1].outside), r[1].cats.comm);
r = await call('PATCH', '/sims/' + id, { trip_leg: 'none' });
r = await call('GET', '/journeys'); console.log('manual none -> outside', JSON.stringify(r[1].outside.map(o => [o.reason, o.amount])), r[1].journeys[0].totals.by.comm);
r = await call('PATCH', '/sims/' + id, { trip_leg: 'f11' });
r = await call('GET', '/journeys'); console.log('manual f11', r[1].outside.length, r[1].journeys[0].totals.by.comm, r[1].journeys[0].sims[0].manual);
r = await call('PATCH', '/sims/' + id, { trip_leg: 'f999' }); console.log('bad leg', r[0], r[1].message);
const eid = db.prepare('SELECT id FROM trip_expenses').get().id;
r = await call('PATCH', '/expenses/' + eid, { spent_on: '2026-10-01', amount: 1 }); console.log('patch exp locked', r[0]);
r = await call('DELETE', '/expenses/' + eid); console.log('delete exp locked', r[0]);
r = await call('GET', '/sims/' + id + '/secret'); console.log('secret', r[0], r[1]);
r = await call('GET', '/sims/' + id + '/reveal?f=iccid'); console.log('reveal', r[0], r[1]);
r = await call('PATCH', '/sims/' + id, { activated_at: '2026-10-02 14:10', tz: 'Africa/Cairo' });
console.log('activated', r[0], r[1].sim.status, r[1].sim.expires_at, r[1].sim.hours_left);
r = await call('POST', '/sims', { kind: 'sim', country: 'Турция', operator: 'Turkcell', lpa: ['LPA:1', 'x.io', 'A'].join(D), price: 500, price_currency: 'TRY' });
console.log('physical', r[0], r[1].sim && [r[1].sim.kind, r[1].sim.smdp, r[1].sim.has_code, r[1].sim.roaming]);
r = await call('GET', '/journeys'); console.log('outside no_trip', JSON.stringify(r[1].outside.map(o => [o.kind_ru, o.reason, o.amount, o.currency])));
r = await call('PATCH', '/sims/' + r[1].outside[0].id, { price: '' }); console.log('price cleared rows', db.prepare("SELECT COUNT(*) n FROM trip_expenses WHERE source_id=?").get(r[1].sim.id).n, r[1].sim.expense_id);
r = await call('DELETE', '/sims/' + id); console.log('delete sim', r[0], r[1].expense_kept, JSON.stringify(db.prepare('SELECT id, amount, source, source_id, note FROM trip_expenses').all()));
r = await call('PATCH', '/expenses/' + eid, { spent_on: '2026-10-01', amount: 350, category: 'comm', title: 'eSIM Египет' }); console.log('detached row editable', r[0], r[1].expense && r[1].expense.amount);
r = await call('POST', '/sims', { country: '' }); console.log('empty', r[0], r[1].error);
r = await call('POST', '/sims', { country: 'X', iccid: '123' }); console.log('bad iccid', r[0], r[1].error);
r = await call('POST', '/expenses', { spent_on: '2026-10-03', amount: 100, category: 'comm', title: 'Пополнил' }); console.log('manual comm', r[0]);
srv.close(); process.exit(0);
