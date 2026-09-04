// Собирает артборды .dc.html из фигур gen.mjs. Правки — здесь, потом `node build.mjs`.
import { figure, DOT_G } from './gen.mjs';
import fs from 'fs';

// ---- данные: ОБРАЗЕЦ по бланку DDX/InBody, реальные цифры подставит медкарта ----
// Первично ЧИСЛО ТОЧЕК: одна точка = 20 г, поэтому избыток равен ему по
// определению и разойтись с подписью «610 точек» не может. Жировая масса и
// процент выводятся из избытка — иначе на карточке рядом стоят три числа,
// которые друг из друга не получаются.
const NORM_PCT = 15;
const ru = (n,d=1) => n.toFixed(d).replace('.', ',');
const shown = n => +ru(n).replace(',', '.');
const plural = (n,one,few,many) => { const a = n%100, b = n%10;
  return (a>=11 && a<=14) ? many : b===1 ? one : (b>=2 && b<=4) ? few : many; };

function rec(label, date, weight, muscle, dots){
  const excess = dots*DOT_G/1000, fat = weight*NORM_PCT/100 + excess;
  return { label, date, weight, muscle, excess, fat, fatPct: fat/weight*100, dots };
}
const BEFORE = rec('ДО',    '12.03.2026', 92.4, 34.8, 610);
const AFTER  = rec('ПОСЛЕ', '01.09.2026', 83.4, 35.7, 180);

// Счётная самопроверка образца: макет, который врёт убедительнее, чем ошибается,
// хуже отсутствующего.
const ffm = d => d.weight - d.fat;
for (const d of [BEFORE, AFTER]){
  if (Math.abs(shown(d.fat) - shown(d.fatPct*d.weight/100)) > 0.05)
    throw new Error(d.label+': процент жира и килограммы не сходятся');
  if (Math.abs(shown(d.excess) - shown(d.fat - d.weight*NORM_PCT/100)) > 0.05)
    throw new Error(d.label+': избыток не равен жиру минус норма');
  if (d.muscle > ffm(d)) throw new Error(d.label+': мышц больше, чем безжировой массы');
}
if (AFTER.muscle - BEFORE.muscle > ffm(AFTER) - ffm(BEFORE) + 1e-9)
  throw new Error('мышцы прибавили сильнее безжировой массы — так не бывает');

const dmy = s => { const [d,m,y] = s.split('.').map(Number); return Date.UTC(y, m-1, d); };
const DAYS = Math.round((dmy(AFTER.date) - dmy(BEFORE.date)) / 864e5);

// ---- токены раздела: значения сняты с ui.css и medcard_profile.js --------------
const T = {
  page:'#0a0a0a', card:'#141414', deep:'#111', bd:'#262626', bd2:'#1e1e1e',
  tx:'#e8e8e8', tx2:'#8b8b8b', tx3:'#666', br:'#00a0ff', ok:'#4ade80', fat:'#fbbf24', dg:'#f87171',
  font:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};
const CARD = `background:${T.card};border:1px solid ${T.bd};border-radius:var(--ui-card-radius,12px);padding:var(--ui-card-pad,20px);`;
const PANEL = `background:${T.deep};border:1px solid ${T.bd2};border-radius:12px;`;
const MONO = 'font-variant-numeric:tabular-nums;';
const RULER = 'm21.3 8.7-12.6 12.6a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4zM7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2';
const icon = (d,s=16) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:${s}px;height:${s}px;flex-shrink:0;"><path d="${d}"/></svg>`;
const head = (title, extra='') => `<div style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;color:${T.tx};margin-bottom:14px;">
      ${icon(RULER)}${title}${extra ? `<span style="font-size:10.5px;font-weight:400;color:${T.tx3};margin-left:auto;">${extra}</span>` : ''}</div>`;

// ---- фигуры -------------------------------------------------------------------
// Кадр общий на «до» и «после»: разный кадр сделал бы из сравнения обман.
// Считаем его в два прохода — сначала габариты, потом отрисовка по ним.
const BASE = { width:280, height:520, scale:430, cx:116, footY:492, seed:11 };
function frameFor(list){
  const bb = [1e9, 1e9, -1e9, -1e9];
  for (const o of list){ const b = figure({ ...BASE, ...o, uid:'probe' }).bbox;
    bb[0] = Math.min(bb[0], b[0]); bb[1] = Math.min(bb[1], b[1]);
    bb[2] = Math.max(bb[2], b[2]); bb[3] = Math.max(bb[3], b[3]); }
  const p = 7;
  return [+(bb[0]-p).toFixed(1), +(bb[1]-p).toFixed(1), +(bb[2]-bb[0]+2*p).toFixed(1), +(bb[3]-bb[1]+2*p).toFixed(1)];
}
const fig = (o, view, w) => { const f = figure({ ...BASE, ...o, view });
  return { html:`<div style="width:${w}px;max-width:100%;margin:0 auto;">${f.svg}</div>`, dots:f.dots }; };

const VIEW = frameFor([{ excessKg:BEFORE.excess }, { excessKg:AFTER.excess }]);
const FW = 118, FH = Math.round(FW * VIEW[3] / VIEW[2]);

// ---------------------------- артборд Main -------------------------------------
function panel(d, uid){
  const f = fig({ excessKg:d.excess, uid, aria:`Фигура «${d.label}», вид сбоку` }, VIEW, FW);
  const row = (l, v, u, col) => `<div style="display:flex;align-items:baseline;gap:8px;padding:7px 0;border-top:1px solid ${T.bd2};">
        <span style="font-size:11.5px;color:${T.tx2};">${l}</span>
        <b style="margin-left:auto;font-size:14px;${MONO}color:${col||T.tx};">${v}<span style="font-size:10.5px;font-weight:400;color:${T.tx3};"> ${u}</span></b></div>`;
  return `<div style="${PANEL}padding:14px;display:flex;gap:12px;min-width:0;">
      <div style="flex:0 0 ${FW}px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:${T.tx2};text-align:center;margin-bottom:4px;">${d.label}</div>
        ${f.html}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
        <div style="font-size:11px;${MONO}color:${T.tx3};text-align:right;">${d.date}</div>
        <div style="margin-top:auto;margin-bottom:auto;padding:10px 0;">
          <div style="font-size:30px;font-weight:700;${MONO}color:${T.fat};line-height:1;">${ru(d.excess)}<span style="font-size:13px;font-weight:400;color:${T.tx3};"> кг</span></div>
          <div style="font-size:11.5px;color:${T.tx2};margin-top:5px;">жира сверх нормы</div>
          <div style="display:inline-block;margin-top:9px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;${MONO}background:rgba(251,191,36,.13);color:${T.fat};">${d.dots} ${plural(d.dots,'точка','точки','точек')}</div></div>
        <div>${row('Вес', ru(d.weight), 'кг')}${row('Жир', ru(d.fatPct), '%')}${row('Жировая масса', ru(d.fat), 'кг')}${row('Мышцы', ru(d.muscle), 'кг', T.ok)}</div></div></div>`;
}
const delta = (l, v, good) => `<div style="min-width:0;">
    <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:${T.tx3};">${l}</div>
    <div style="font-size:17px;font-weight:700;${MONO}color:${good?T.ok:T.tx};margin-top:3px;">${v}</div></div>`;

const MAIN = `<div style="${CARD}max-width:800px;">
    ${head('Состав тела · до и после', 'вид сбоку')}
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:12px;color:${T.tx2};line-height:1.5;margin-bottom:16px;">
      <span style="flex:1;min-width:300px;">Контур — одно и то же эталонное тело при ${NORM_PCT}&nbsp;% жира. Меняется только живот.</span>
      <span style="display:flex;align-items:center;gap:7px;">
        <svg width="26" height="10" style="flex-shrink:0;"><circle cx="4" cy="5" r="1.8" fill="${T.fat}"/><circle cx="13" cy="5" r="1.8" fill="${T.fat}"/><circle cx="22" cy="5" r="1.8" fill="${T.fat}"/></svg>
        одна точка = ${DOT_G} г жира сверх нормы</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">${panel(BEFORE,'a')}${panel(AFTER,'b')}</div>
    <div style="display:flex;gap:26px;flex-wrap:wrap;margin-top:16px;padding:14px 16px;${PANEL}">
      <div style="min-width:0;">
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:${T.tx3};">За период</div>
        <div style="font-size:17px;font-weight:700;${MONO}color:${T.tx2};margin-top:3px;">${DAYS} ${plural(DAYS,'день','дня','дней')}</div></div>
      ${delta('Вес', '−'+ru(BEFORE.weight-AFTER.weight)+' кг', true)}
      ${delta('Жир', '−'+ru(BEFORE.fatPct-AFTER.fatPct)+' п.п.', true)}
      ${delta('Сверх нормы', '−'+ru(BEFORE.excess-AFTER.excess)+' кг', true)}
      ${delta('Мышцы', '+'+ru(AFTER.muscle-BEFORE.muscle)+' кг', true)}
      ${delta('Точки', '−'+(BEFORE.dots-AFTER.dots), true)}</div>
    <div style="margin-top:14px;font-size:11px;color:${T.tx3};line-height:1.6;">
      Фигура в профиль, потому что живот виден только сбоку: в фас выпуклость идёт на зрителя и не читается ни при каком размере.
      Весь избыток сведён в живот — туда, где он заметен; разбивка по рукам и ногам остаётся в карточке «Состав по зонам».
      Норма ${NORM_PCT}&nbsp;% — наш ориентир: прибор её не считает, у DDX границы свои и зависят от пола, возраста и роста.</div></div>`;

// ---------------------------- артборд Mobile -----------------------------------
const MFW = 96, MFH = Math.round(MFW * VIEW[3] / VIEW[2]);
function mpanel(d, uid){
  const f = fig({ excessKg:d.excess, uid, aria:`Фигура «${d.label}», вид сбоку` }, VIEW, MFW);
  return `<div style="${PANEL}padding:11px 9px 13px;min-width:0;">
      <div style="display:flex;align-items:baseline;gap:6px;">
        <span style="font-size:9.5px;font-weight:700;letter-spacing:.12em;color:${T.tx2};">${d.label}</span>
        <span style="font-size:10px;${MONO}color:${T.tx3};margin-left:auto;">${d.date}</span></div>
      ${f.html}
      <div style="margin-top:8px;font-size:22px;font-weight:700;${MONO}color:${T.fat};line-height:1;">${ru(d.excess)}<span style="font-size:11px;font-weight:400;color:${T.tx3};"> кг</span></div>
      <div style="margin-top:4px;font-size:10.5px;${MONO}color:${T.fat};opacity:.75;">${d.dots} ${plural(d.dots,'точка','точки','точек')}</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid ${T.bd2};font-size:11px;${MONO}color:${T.tx2};line-height:1.7;">
        Вес <b style="color:${T.tx};">${ru(d.weight)}</b> кг<br>Жир <b style="color:${T.tx};">${ru(d.fatPct)}</b> %<br>Мышцы <b style="color:${T.ok};">${ru(d.muscle)}</b> кг</div></div>`;
}
const MOBILE = `<div style="${CARD}padding:16px;">
    ${head('Состав тела · до и после')}
    <div style="font-size:11.5px;color:${T.tx2};line-height:1.5;margin-bottom:12px;">Контур один и тот же — тело при ${NORM_PCT}&nbsp;% жира, вид сбоку. Точка = ${DOT_G} г жира сверх нормы.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">${mpanel(BEFORE,'ma')}${mpanel(AFTER,'mb')}</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;padding:12px 13px;${PANEL}">
      ${delta('Вес','−'+ru(BEFORE.weight-AFTER.weight)+' кг',true)}
      ${delta('Сверх нормы','−'+ru(BEFORE.excess-AFTER.excess)+' кг',true)}
      ${delta('Точки','−'+(BEFORE.dots-AFTER.dots),true)}</div>
    <div style="margin-top:12px;font-size:10.5px;color:${T.tx3};line-height:1.55;">Выпуклость увеличена для читаемости и растёт пропорционально избытку.</div></div>`;

// ---------------------------- артборд Angles -----------------------------------
// Довод в пользу профиля: в фас живот идёт на зрителя и не виден.
const ANG = [0.15, 0.55, 0.95, 1.30, 1.57];
const AVIEW = frameFor(ANG.map(rot => ({ excessKg:BEFORE.excess, rot })));
const AFW = 130;
const ANGLES = `<div style="${CARD}">
    ${head('Почему в профиль', 'один и тот же расчёт, разный угол')}
    <div style="font-size:12px;color:${T.tx2};line-height:1.55;margin-bottom:14px;">
      Живот выступает ВПЕРЁД. В фас это направление совпадает с направлением взгляда, и выпуклость не видна ни при каком её размере —
      только точки скапливаются в середине силуэта. Читаться живот начинает примерно с 55°.</div>
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;">
      ${ANG.map((rot,i) => `<div style="${PANEL}padding:10px 8px 12px;min-width:0;">
        <div style="font-size:10px;${MONO}color:${T.tx3};text-align:center;margin-bottom:2px;">${Math.round(rot*180/Math.PI)}°</div>
        ${fig({ excessKg:BEFORE.excess, rot, uid:'an'+i, aria:`Поворот ${Math.round(rot*180/Math.PI)}°` }, AVIEW, AFW).html}</div>`).join('')}</div></div>`;

// ---------------------------- артборд Scale ------------------------------------
const STEPS = [0, 3, 6, 9, 12, 15];
const SVIEW = frameFor(STEPS.map(k => ({ excessKg:k })));
const SCALE = `<div style="${CARD}">
    ${head('Шкала', 'сколько лишнего — столько живота')}
    <div style="font-size:12px;color:${T.tx2};line-height:1.55;margin-bottom:14px;">
      Высота выпуклости растёт пропорционально избытку, число точек — тоже (одна точка = ${DOT_G} г).
      Проверка, что промежуточные значения выглядят осмысленно, а не только крайние.</div>
    <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;">
      ${STEPS.map((k,i) => `<div style="${PANEL}padding:10px 6px 12px;min-width:0;">
        <div style="font-size:11px;font-weight:700;${MONO}color:${k?T.fat:T.tx3};text-align:center;">${ru(k,0)} кг</div>
        <div style="font-size:9.5px;${MONO}color:${T.tx3};text-align:center;margin-bottom:2px;">${Math.round(k*1000/DOT_G)} точек</div>
        ${fig({ excessKg:k, uid:'sc'+i, aria:`Избыток ${k} кг` }, SVIEW, 112).html}</div>`).join('')}</div></div>`;

// ---------------------------------- запись -------------------------------------
const doc = (body, pad) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; background: ${T.page}; color: ${T.tx};
           font-family: ${T.font}; -webkit-font-smoothing: antialiased; }
    a { color: ${T.br}; } a:hover { color: #4db8ff; }
  </style>
</helmet>
<div style="padding:${pad};">
${body}
</div>
</x-dc>
</body>
</html>
`;

const files = {
  'Main.dc.html':   doc(MAIN, '30px'),
  'Mobile.dc.html': doc(MOBILE, '14px 14px 22px'),
  'Angles.dc.html': doc(ANGLES, '24px'),
  'Scale.dc.html':  doc(SCALE, '24px'),
};
for (const [name, html] of Object.entries(files)){
  fs.writeFileSync(name, html);
  console.log(name.padEnd(16), (html.length/1024).toFixed(0)+' КБ');
}
for (const gone of ['DotBody.dc.html','ZoneMesh.dc.html'])
  if (fs.existsSync(gone)) fs.unlinkSync(gone);

const canvas = {
  artboards: [
    { file:'Main.dc.html',   x:0,    y:0,    w:900, h:880 },
    { file:'Mobile.dc.html', x:1010, y:0,    w:390, h:850 },
    { file:'Angles.dc.html', x:0,    y:1020, w:940, h:670 },
    { file:'Scale.dc.html',  x:0,    y:1810, w:940, h:690 },
  ],
  annotations: [
    { id:'brief', x:1010, y:930, w:390,
      text:'Живот виден только сбоку — поэтому фигура в профиль. Артборд «Почему в профиль» показывает, что в фас выпуклость не читается ни при каком размере.\n\nЭталонное тело на «до» и «после» ОДНО И ТО ЖЕ — тело при 15 % жира. Меняется только живот.\n\nОдна точка = 20 г жира сверх нормы: 610 точек против 180 — это и есть 12,2 кг против 3,6 кг.\n\nЦифры — образец, не реальные замеры.' },
  ],
  launch: { view:'canvas' },
};
fs.writeFileSync('canvas.json', JSON.stringify(canvas, null, 2));
console.log('canvas.json  кадр', VIEW.join(' '), '→', FW+'×'+FH);
