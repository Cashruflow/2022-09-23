// Этап 2: устройства, операторы, регистрация IMEI. Запуск: node itest2.mjs [--nokey]
import express from 'express';
import Database from 'better-sqlite3';
import { mountTripSims } from './trip_sims_test.js';
import { mountTripDevices, imeiNorm, eidNorm, idsFromText } from './trip_devices_test.js';
import { mountTripJourneys } from './trip_journeys.js';

const NOKEY = process.argv.includes('--nokey');
if (!NOKEY) process.env.TRIP_SIM_KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i * 7 % 256)).toString('base64'); // тестовый, только в памяти
else delete process.env.TRIP_SIM_KEY;

const db = new Database(':memory:');
db.exec(`CREATE TABLE profiles (id INTEGER PRIMARY KEY, patient_key TEXT); INSERT INTO profiles VALUES (5,'5'),(6,'6');
CREATE TABLE trip_flights (id INTEGER PRIMARY KEY, profile_id INT, depart_on TEXT, depart_time TEXT, arrive_on TEXT, from_city TEXT, from_code TEXT, to_city TEXT, to_code TEXT, flight_no TEXT, airline TEXT, price REAL, currency TEXT, price_local REAL, currency_local TEXT);
CREATE TABLE trip_rides (id INTEGER PRIMARY KEY, profile_id INT, depart_on TEXT, depart_time TEXT, arrive_on TEXT, kind TEXT, from_place TEXT, to_place TEXT, from_country TEXT, to_country TEXT, train_no TEXT, carrier TEXT, price REAL, currency TEXT);
CREATE TABLE trip_stays (id INTEGER PRIMARY KEY, profile_id INT, check_in TEXT, name TEXT, city TEXT, amount REAL, currency TEXT, amount_local REAL, currency_local TEXT);
CREATE TABLE trip_insurance (id INTEGER PRIMARY KEY, profile_id INT, from_date TEXT, insurer TEXT, price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT);
CREATE TABLE trip_permits (id INTEGER PRIMARY KEY, profile_id INT, valid_from TEXT, issued_on TEXT, country TEXT, price REAL, price_currency TEXT, price_local REAL, price_local_currency TEXT);
CREATE TABLE patient_accounts (id INTEGER PRIMARY KEY, profile_id INT);
CREATE TABLE patient_telegram_links (id INTEGER PRIMARY KEY, account_id INT, chat_id TEXT, consumed_at TEXT);
INSERT INTO trip_flights (id, profile_id, depart_on, from_city, from_code, to_city, to_code, flight_no, price, currency) VALUES
 (21,5,'2026-10-10','Москва','SVO','Ташкент','TAS','HY602', 25000,'RUB'),
 (22,5,'2026-10-20','Ташкент','TAS','Москва','SVO','HY601', 24000,'RUB');`);
const AP = { SVO: { city: 'Москва', country: 'Россия' }, TAS: { city: 'Ташкент', country: 'Узбекистан' } };
const numAmount = v => { let s = String(v ?? '').replace(/[\s ]/g, ''); if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, ''); else s = s.replace(',', '.'); return Number(s.replace(/[^\d.]/g, '')); };
const normDate = r => /^\d{4}-\d{2}-\d{2}$/.test(String(r || '').trim()) ? String(r).trim() : null;
const addDays = (iso, d) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + d * 86400e3).toISOString().slice(0, 10);
function tzOffsetMin(tz, utcMs) { const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(utcMs)).forEach(x => { p[x.type] = x.value; }); return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - utcMs) / 60000); }
function localToUtc(iso, hm, tz) { const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso), t = /^(\d{1,2}):(\d{2})$/.exec(hm); const naive = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]); const utc = naive - tzOffsetMin(tz, naive) * 60000; return naive - tzOffsetMin(tz, utc) * 60000; }
const vendorKey = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
const app = express();
app.use(express.json());
const pid = (req, res) => req.headers['x-auth'] ? +req.headers['x-auth'] : (res.status(401).json({ error: 'auth' }), null);
let fakeAi = '{}';
const sent = [];
const common = {
  pid, tasksDb: null, logUpload: () => null, logAiCall: () => {}, logGeneration: () => 1,
  ask: async () => ({ text: fakeAi, inTok: 1, outTok: 1 }), parseJson: JSON.parse, cost: () => 0, purgeScansLazy: () => {},
  apiKey: 'x', SCAN_MODEL: 'm', sniffMime: b => ({ mime: 'image/png' }), numAmount, normDate, addDays, localToUtc,
  COUNTRY_TZ: { 'Египет': 'Africa/Cairo', 'Узбекистан': 'Asia/Tashkent' }, vendorResolve: (d, v) => v ? String(v).trim() : null, vendorKey,
  isAdmin: req => req.headers['x-admin'] === '1',
  consts: { MAX_BYTES: 1e6, MAX_FILES: 5, UP_DIR: '/tmp', KEEP_HOURS: 24, TEXT_MAX: 200, COUNTRY_MAX: 60, PASTE_MAX: 20000, SCAN_MIME: { png: 'image/png' } }
};
const sims = mountTripSims(app, db, common);
const dev = mountTripDevices(app, db, { ...common, ...sims, noTimers: true, sendToProfile: async (p, t) => { sent.push([p, t]); return null; } });
mountTripJourneys(app, db, { pid, airport: c => AP[c] || null, tasksDb: null, ...sims, simKindRu: sims.SIM_KIND_RU });
const srv = app.listen(0);
const base = 'http://127.0.0.1:' + srv.address().port + '/api/profile/me/trip';
const call = async (m, p, b, h = {}) => { const r = await fetch(base + p, { method: m, headers: { 'x-auth': '5', 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined }); return [r.status, await r.json()]; };
const raw = async (p, body, h) => { const r = await fetch(base + p, { method: 'POST', headers: { 'x-auth': '5', ...h }, body }); return [r.status, await r.json()]; };
let r;
console.log('== mode', NOKEY ? 'БЕЗ ключа' : 'с тестовым ключом');
console.log('imeiNorm15', imeiNorm('490154203237518'), 'bad', imeiNorm('490154203237519').ok, 'sv', imeiNorm('35 209900 176148 23'));
console.log('eid', eidNorm('89049032004008882600018855001434').ok);
console.log('idsFromText', idsFromText('IMEI: 35 209900 176148 1\nIMEI2\n35 209900 176149 9\nEID 89049032004008882600018855001434\nMEID: 35209900176148'));
r = await raw('/device-scan', 'IMEI 490154203237518\nIMEI2 356938035643809\nEID 89049032004008882600018855001434', { 'Content-Type': 'text/plain', 'X-Doc-Kind': 'text' });
console.log('scan text', r[0], JSON.stringify(r[1].device));
fakeAi = JSON.stringify({ model: 'iPhone 15', imei1: '490154203237518', imei2: '', eid: '', serial: 'F2LXK0ABCD' });
r = await raw('/device-scan', Buffer.from('fakepng'), { 'Content-Type': 'application/octet-stream', 'X-File-Name': 's.png' });
console.log('scan image', r[0], JSON.stringify(r[1].device));
r = await call('POST', '/devices', { name: 'Мой iPhone', model: 'iPhone 15', imei1: '490154203237518', imei2: '35 209900 176148 23', eid: '89049032004008882600018855001434', serial: 'F2LXK0ABCD', meid: '35209900176148' });
console.log('create device', r[0], r[1].message || '', r[1].ids_skipped, r[1].warnings, r[1].device && [r[1].device.imei1_masked, r[1].device.imei2_masked, r[1].device.eid_masked, r[1].device.serial_masked, r[1].device.esim_ok]);
const devId = r[1].device ? r[1].device.id : null;
if (!NOKEY) {
  console.log('stored plaintext?', JSON.stringify(db.prepare('SELECT * FROM trip_devices').get()).includes('490154203237518'));
  r = await call('POST', '/devices', { name: 'Дубль', imei1: '352099001761481' }); console.log('dup by imei2', r[0], r[1].message);
  r = await call('POST', '/devices', { name: 'Другой', imei1: '490154203237519' }); console.log('bad luhn', r[0], r[1].message);
  r = await call('GET', '/devices/' + devId + '/reveal?f=imei1'); console.log('reveal imei1', r[0], r[1].value);
  r = await call('GET', '/devices/' + devId + '/reveal?f=serial'); console.log('reveal serial', r[0], r[1].value);
  r = await call('GET', '/devices/' + devId + '/reveal?f=imei1', null, { 'x-auth': '6' }); console.log('чужой профиль', r[0]);
} else {
  r = await call('POST', '/devices', { imei1: '490154203237518' }); console.log('nokey imei only', r[0], r[1].error);
  r = await call('GET', '/devices'); console.log('nokey list key_ok', r[1].key_ok, r[1].devices.length);
}
// операторы
r = await call('POST', '/operators', { country: 'Узбекистан', name: 'Beeline UZ', apn: 'internet.beeline.uz', site: 'https://beeline.uz', aliases: 'Билайн, beeline' }); console.log('op add', r[0]);
const opId = r[1].operator.id;
r = await call('POST', '/operators', { country: 'Узбекистан', name: 'билайн' }); console.log('op dup by alias', r[0], r[1].message);
r = await call('POST', '/operators', { id: opId, country: 'Узбекистан', name: 'Beeline Uzbekistan' }); console.log('op edit not admin', r[0]);
r = await call('GET', '/operators?country=' + encodeURIComponent('Узбекистан') + '&q=Beeline'); console.log('op list', r[0], r[1].operators.length, 'resolved', r[1].resolved_id === opId);
// SIM на устройство с оператором
r = await call('POST', '/sims', { kind: 'sim', country: 'Узбекистан', operator_id: opId, device_id: devId, phone: '+998901234567', iccid: '8948010010094791430', price: 150000, price_currency: 'UZS', purchased_on: '2026-10-10' });
console.log('sim on device', r[0], r[1].message || '', r[1].sim && [r[1].sim.operator, r[1].sim.device_id, r[1].sim.phone_masked]);
r = await call('POST', '/sims', { kind: 'sim', country: 'Узбекистан', device_id: 99999 }); console.log('sim bad device', r[0], r[1].message);
r = await call('POST', '/operators', { id: opId, country: 'Узбекистан', name: 'Beeline Uzbekistan' }, { 'x-admin': '1' }); console.log('op rename admin', r[0], db.prepare('SELECT operator FROM trip_sims').get().operator);
r = await call('DELETE', '/operators/' + opId, null, { 'x-admin': '1' }); console.log('op delete in use', r[0], r[1].message);
// страны
r = await call('PUT', '/sim-countries/' + encodeURIComponent('Узбекистан'), { imei_reg: 'yes', imei_reg_note: 'отмечено вручную' }); console.log('country not admin', r[0]);
r = await call('PUT', '/sim-countries/' + encodeURIComponent('Узбекистан'), { imei_reg: 'yes', imei_reg_note: 'отмечено вручную', checked_on: '2026-09-28' }, { 'x-admin': '1' }); console.log('country admin', r[0], r[1].country.imei_reg);
// регистрация
if (devId) {
  r = await call('POST', '/imei-regs', { device_id: devId, country: 'Узбекистан', reg_on: '2026-10-11', valid_until: '2026-12-31', price: '3,50', price_currency: 'USD', receipt_url: 'https://example.org/r/1' });
  console.log('reg add', r[0], r[1].message || '', r[1].reg && [r[1].reg.status, r[1].reg.remind_days, r[1].reg.country_hint && r[1].reg.country_hint.imei_reg]);
  const regId = r[1].reg.id;
  console.log('reg expense', JSON.stringify(db.prepare("SELECT amount, currency, category, source, source_id, title FROM trip_expenses WHERE source='imei_reg'").all()));
  r = await call('GET', '/journeys'); console.log('journey comm items', JSON.stringify(r[1].journeys.map(j => j.items.filter(i => i.source).map(i => [i.source, i.amount, i.currency]))), 'outside', r[1].outside.length);
  // напоминания: остаток 7 дней → одно; тот же тик второй раз — ничего; последний день — одно
  db.prepare("UPDATE trip_imei_regs SET reg_on='2026-09-01', valid_until=? WHERE id=?").run(addDays(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' }), 7), regId);
  const noon = d => { const x = new Date(); x.setUTCHours(7, 0, 0, 0); return x.getTime() + d * 86400e3; }; // 12:00 Ташкента
  console.log('tick 7d', await dev.regTick(noon(0)), 'again', await dev.regTick(noon(0)), 'last day', await dev.regTick(noon(7)), 'after', await dev.regTick(noon(7)));
  console.log('sent', JSON.stringify(sent));
  db.prepare("UPDATE trip_imei_regs SET notify_pre_sent_at=NULL, notify_end_sent_at=NULL WHERE id=?").run(regId);
  const night = new Date(); night.setUTCHours(20, 0, 0, 0);
  console.log('quiet hours (01:00 Ташкент)', await dev.regTick(night.getTime()));
  r = await call('PATCH', '/imei-regs/' + regId, { remind_days: 3 }); console.log('patch remind_days', r[0], JSON.stringify(r[1]).slice(0, 300));
  r = await call('DELETE', '/imei-regs/' + regId); console.log('reg delete keeps expense', r[0], JSON.stringify(db.prepare("SELECT source, note FROM trip_expenses WHERE title LIKE 'Регистрация%'").all()));
  // кража
  r = await call('GET', '/devices/' + devId + '/theft-sheet'); console.log('theft', r[0], JSON.stringify(r[1].device), JSON.stringify(r[1].sims));
  r = await call('DELETE', '/devices/' + devId); console.log('device delete', r[0], 'sim device_id', db.prepare('SELECT device_id FROM trip_sims').get().device_id);
}
srv.close(); process.exit(0);
