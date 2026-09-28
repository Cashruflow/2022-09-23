import { lpaParse, lpaBuild, iccidNorm, maskDigits, maskPhone, curCode, dataMb, speedKbps } from './trip_sims_test.js';
const num = v => { let s = String(v ?? '').replace(/[\s ]/g, ''); if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, ''); else s = s.replace(',', '.'); return Number(s.replace(/[^\d.]/g, '')); };
const D = String.fromCharCode(36);
const p = lpaParse(['LPA:1', 'smdp.io', 'K2-36Y6K0-7CDVXL'].join(D)); console.log(p, lpaBuild(p));
const q = lpaParse(['LPA:1', 'smdp.io', 'ABC', '', '1'].join(D)); console.log(q, lpaBuild(q));
console.log(lpaParse('garbage'), lpaParse(['LPA:1', 'bad host', 'x'].join(D)));
console.log(iccidNorm('8948010010094791430'), maskDigits('8948010010094791430'));
console.log(maskPhone('+79631234503'), '|', maskPhone('+201012345678'), '|', maskPhone('89631234503'), '|', maskPhone('+998901234567'));
console.log(curCode('₽'), curCode(D), curCode('usd'), curCode(''), dataMb('2GB', num), speedKbps('512kbps', num));
