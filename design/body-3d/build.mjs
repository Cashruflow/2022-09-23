// Собирает артборды .dc.html из фигур gen.mjs. Правки — здесь, потом `node build.mjs`.
import { figure, DOT_G } from './gen.mjs';
import fs from 'fs';

// ---- данные: ОБРАЗЕЦ по бланку DDX/InBody, реальные цифры подставит медкарта ----
// Первично ЧИСЛО ТОЧЕК: одна точка = 20 г, поэтому избыток равен ему по
// определению и разойтись с подписью «610 точек» не может. Жировая масса и
// процент выводятся из избытка — иначе на карточке рядом стоят три числа,
// которые друг из друга не получаются.
const NORM_PCT = 15;
// Числа точек по зонам бланка: одна точка = 20 г, поэтому масса зоны равна им
// по определению.
const DOTS = {
  before: { torso:365, larm:35, rarm:35, lleg:88, rleg:87 },   // 610
  after:  { torso:108, larm:10, rarm:11, lleg:26, rleg:25 },   // 180
};
const ru = (n,d=1) => n.toFixed(d).replace('.', ',');
const shown = n => +ru(n).replace(',', '.');
const plural = (n,one,few,many) => { const a = n%100, b = n%10;
  return (a>=11 && a<=14) ? many : b===1 ? one : (b>=2 && b<=4) ? few : many; };

function rec(label, date, weight, muscle, dots){
  const zones = Object.fromEntries(Object.entries(dots).map(([k,n]) => [k, n*DOT_G/1000]));
  const n = Object.values(dots).reduce((a,b)=>a+b,0);
  const excess = n*DOT_G/1000, fat = weight*NORM_PCT/100 + excess;
  return { label, date, weight, muscle, zones, excess, fat, fatPct: fat/weight*100, dots:n };
}
const BEFORE = rec('ДО',    '12.03.2026', 92.4, 34.8, DOTS.before);
const AFTER  = rec('ПОСЛЕ', '01.09.2026', 83.4, 35.7, DOTS.after);

// Счётная самопроверка образца: макет, который врёт убедительнее, чем ошибается,
// хуже отсутствующего.
const ffm = d => d.weight - d.fat;
for (const d of [BEFORE, AFTER]){
  const z = d.zones, zl = [z.torso, z.larm + z.rarm, z.lleg + z.rleg];
  if (Math.abs(shown(zl[0]) + shown(zl[1]) + shown(zl[2]) - shown(d.excess)) > 1e-6)
    throw new Error(d.label+': строка по зонам не складывается в показанный избыток');
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
const BASE = { width:300, height:520, scale:430, cx:150, footY:492, seed:11 };
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

const VIEW = frameFor([{ zones:BEFORE.zones }, { zones:AFTER.zones }]);
const FW = 190, FH = Math.round(FW * VIEW[3] / VIEW[2]);

// ---------------------------- артборд Main -------------------------------------
function panel(d, uid){
  const f = fig({ zones:d.zones, uid, aria:`Фигура «${d.label}»` }, VIEW, FW);
  const row = (l, v, u, col) => `<div style="display:flex;align-items:baseline;gap:8px;padding:7px 0;border-top:1px solid ${T.bd2};">
        <span style="font-size:11.5px;color:${T.tx2};">${l}</span>
        <b style="margin-left:auto;font-size:14px;${MONO}color:${col||T.tx};">${v}<span style="font-size:10.5px;font-weight:400;color:${T.tx3};"> ${u}</span></b></div>`;
  return `<div style="${PANEL}padding:14px;min-width:0;"><div style="display:flex;gap:14px;min-width:0;">
      <div style="flex:0 0 ${FW}px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:${T.tx2};text-align:center;margin-bottom:4px;">${d.label}</div>
        ${f.html}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
        <div style="font-size:11px;${MONO}color:${T.tx3};text-align:right;">${d.date}</div>
        <div style="margin-top:auto;margin-bottom:auto;padding:10px 0;">
          <div style="font-size:30px;font-weight:700;${MONO}color:${T.fat};line-height:1;">${ru(d.excess)}<span style="font-size:13px;font-weight:400;color:${T.tx3};"> кг</span></div>
          <div style="font-size:11.5px;color:${T.tx2};margin-top:5px;">жира сверх нормы</div>
          <div style="display:inline-block;margin-top:9px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;${MONO}background:rgba(251,191,36,.13);color:${T.fat};">${d.dots} ${plural(d.dots,'точка','точки','точек')}</div></div>
        <div>${row('Вес', ru(d.weight), 'кг')}${row('Жир', ru(d.fatPct), '%')}${row('Жировая масса', ru(d.fat), 'кг')}${row('Мышцы', ru(d.muscle), 'кг', T.ok)}</div></div></div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid ${T.bd2};font-size:11px;${MONO}color:${T.tx3};">
        Торс ${ru(d.zones.torso)} · руки ${ru(d.zones.larm+d.zones.rarm)} · ноги ${ru(d.zones.lleg+d.zones.rleg)} кг</div></div>`;
}
const delta = (l, v, good) => `<div style="min-width:0;">
    <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:${T.tx3};">${l}</div>
    <div style="font-size:17px;font-weight:700;${MONO}color:${good?T.ok:T.tx};margin-top:3px;">${v}</div></div>`;

const MAIN = `<div style="${CARD}max-width:800px;">
    ${head('Состав тела · до и после', 'поза бланка DDX')}
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:12px;color:${T.tx2};line-height:1.5;margin-bottom:16px;">
      <span style="flex:1;min-width:300px;">Внутри — эталонное тело при ${NORM_PCT}&nbsp;% жира, оно одинаковое. Снаружи, янтарным, — сколько поверх него лежит.</span>
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
      Руки отведены, как на бланке DDX, — иначе бока и сами руки закрыты корпусом и жир на них показать нечем.
      Толщина слоя растёт с массой зоны на её площадь, но по сжатой шкале: при строгой пропорции живот пришлось бы раздуть так,
      что слой сомкнулся бы с рукой, а манжета на руке всё равно осталась бы тоньше пикселя. Порядок зон сохраняется.
      На животе слой распределён неравномерно: спереди толще всего, по бокам «ушки», спина почти чистая; в фас выпуклость идёт на зрителя,
      поэтому в силуэте видна боковая толщина, а «где именно» договаривают подписи зон.
      Норма ${NORM_PCT}&nbsp;% — наш ориентир: прибор её не считает, у DDX границы свои и зависят от пола, возраста и роста.</div></div>`;

// ---------------------------- артборд Mobile -----------------------------------
const MFW = 138, MFH = Math.round(MFW * VIEW[3] / VIEW[2]);
function mpanel(d, uid){
  const f = fig({ zones:d.zones, uid, aria:`Фигура «${d.label}»` }, VIEW, MFW);
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
    <div style="font-size:11.5px;color:${T.tx2};line-height:1.5;margin-bottom:12px;">Внутри — эталонное тело при ${NORM_PCT}&nbsp;% жира. Точка = ${DOT_G} г жира сверх него.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">${mpanel(BEFORE,'ma')}${mpanel(AFTER,'mb')}</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;padding:12px 13px;${PANEL}">
      ${delta('Вес','−'+ru(BEFORE.weight-AFTER.weight)+' кг',true)}
      ${delta('Сверх нормы','−'+ru(BEFORE.excess-AFTER.excess)+' кг',true)}
      ${delta('Точки','−'+(BEFORE.dots-AFTER.dots),true)}</div>
    <div style="margin-top:12px;font-size:10.5px;color:${T.tx3};line-height:1.55;">Выпуклость увеличена для читаемости и растёт пропорционально избытку.</div></div>`;

// ---------------------------- артборд Angles -----------------------------------
// Довод в пользу профиля: в фас живот идёт на зрителя и не виден.
const ANG = [0.00, 0.30, 0.70, 1.10, 1.50];
const AVIEW = frameFor(ANG.map(rot => ({ zones:BEFORE.zones, rot })));
const AFW = 158;
const ANGLES = `<div style="${CARD}">
    ${head('Разворот', 'один и тот же расчёт, разный угол')}
    <div style="font-size:12px;color:${T.tx2};line-height:1.55;margin-bottom:14px;">
      Фигура считается, а не рисуется картинкой, поэтому её можно повернуть на любой угол — как глобус в разделе «Жизнь».
      В карточке стоит поза бланка (17°): руки отведены, видны бока. Сбоку виден живот, в профиль — насколько он выступает вперёд.</div>
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;">
      ${ANG.map((rot,i) => `<div style="${PANEL}padding:10px 8px 12px;min-width:0;">
        <div style="font-size:10px;${MONO}color:${T.tx3};text-align:center;margin-bottom:2px;">${Math.round(rot*180/Math.PI)}°</div>
        ${fig({ zones:BEFORE.zones, rot, uid:'an'+i, aria:`Поворот ${Math.round(rot*180/Math.PI)}°` }, AVIEW, AFW).html}</div>`).join('')}</div></div>`;

// ---------------------------- артборд Scale ------------------------------------
const STEPS = [0, 3, 6, 9, 12, 15];
// раскладка избытка по зонам в тех же долях, что у «до»
const SHARE = Object.fromEntries(Object.entries(BEFORE.zones).map(([k,v]) => [k, v/BEFORE.excess]));
const scaleZones = kg => Object.fromEntries(Object.entries(SHARE).map(([k,f]) => [k, kg*f]));
const SVIEW = frameFor(STEPS.map(k => ({ zones:scaleZones(k) })));
const SCALE = `<div style="${CARD}">
    ${head('Шкала', 'сколько лишнего — столько живота')}
    <div style="font-size:12px;color:${T.tx2};line-height:1.55;margin-bottom:14px;">
      Высота выпуклости растёт пропорционально избытку, число точек — тоже (одна точка = ${DOT_G} г).
      Проверка, что промежуточные значения выглядят осмысленно, а не только крайние.</div>
    <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;">
      ${STEPS.map((k,i) => `<div style="${PANEL}padding:10px 6px 12px;min-width:0;">
        <div style="font-size:11px;font-weight:700;${MONO}color:${k?T.fat:T.tx3};text-align:center;">${ru(k,0)} кг</div>
        <div style="font-size:9.5px;${MONO}color:${T.tx3};text-align:center;margin-bottom:2px;">${Math.round(k*1000/DOT_G)} точек</div>
        ${fig({ zones:scaleZones(k), uid:'sc'+i, aria:`Избыток ${k} кг` }, SVIEW, 136).html}</div>`).join('')}</div></div>`;


// ---------------------------- артборд Compare ----------------------------------
// Слева — текущий виджет «Состав по зонам», воспроизведённый по bodySegments()
// из medcard_profile.js: те же чипы, та же раскладка подписей, тот же ореол
// (гауссов размыв альфы + резкий feComponentTransfer + composite out), те же
// цвета вердикта и та же формула радиуса segGlow. Фотография тела заменена
// плоским силуэтом — фотографий из /body/*.webp тут нет.
const SEG_CM = 37.7953, SEG_REFW = 380, SEG_REFCM = .60, SEG_LAYERREF = 9.5/46691;
const SEGAREA = { torso:46691, larm:13039, rarm:12864, lleg:22637, rleg:22894 };
const SEGCOL = { low:'#fbbf24', norm:T.ok, high:T.dg };
const SEGLBL = { larm:'Левая рука', rarm:'Правая рука', torso:'Торс', lleg:'Левая нога', rleg:'Правая нога' };
const SEGST  = { low:'ниже нормы', norm:'норма', high:'выше нормы' };
const segGlow = (kg, zone, W) => W * ((SEG_REFCM*((kg/SEGAREA[zone])/SEG_LAYERREF)) * SEG_CM / SEG_REFW);

// Жир по зонам на дату «до». Сумма равна жировой массе из карточки — тот же человек.
const SEGDATA = {
  torso:{ kg:14.6, pct:168, st:'high' }, rarm:{ kg:1.5, pct:104, st:'norm' },
  larm: { kg:1.5,  pct:106, st:'norm' }, rleg:{ kg:4.2, pct:131, st:'high' },
  lleg: { kg:4.3,  pct:133, st:'high' },
};
if (Math.abs(Object.values(SEGDATA).reduce((a,s)=>a+s.kg,0) - shown(BEFORE.fat)) > 0.05)
  throw new Error('зоны текущего виджета не складываются в жировую массу «до»');

const CW = 420, CIN = CW - 40;                       // ширина карточки и её нутро
const CVIEW = frameFor([{ zones:{} }, { zones:BEFORE.zones }]);
const lean = figure({ ...BASE, zones:{}, view:CVIEW, uid:'seg' });
const BW = Math.round(CIN*.52), BH = Math.round(BW * CVIEW[3] / CVIEW[2]);

const segLabel = (z, top, right) => { const q = SEGDATA[z], c = SEGCOL[q.st];
  return `<div style="position:absolute;${right?'right':'left'}:0;top:${top}px;width:84px;display:flex;
      flex-direction:column;gap:2px;align-items:flex-${right?'start':'end'};text-align:${right?'left':'right'};">
      <div style="font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:${T.tx2};line-height:1.2;">${SEGLBL[z].toUpperCase()}</div>
      <div style="font-size:15px;font-weight:700;${MONO}color:${T.tx};">${ru(q.kg)}<span style="font-size:10.5px;font-weight:400;color:${T.tx2};"> кг</span></div>
      <span style="padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;${MONO}background:${c}24;color:${c};">${q.pct}%</span>
      <span style="font-size:9px;color:${c};">${SEGST[q.st]}</span></div>`;
};
const segChip = (on, l, v) => `<div style="flex:1;text-align:center;padding:7px 12px;border-radius:20px;font-size:12.5px;${MONO}
    border:1px solid ${on?T.br:T.bd};background:${on?'rgba(0,160,255,.13)':'#1a1a1a'};color:${on?T.br:T.tx2};">${l} · ${v} кг</div>`;

const CURRENT = `<div style="${CARD}width:${CW}px;">
    <div style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;color:${T.tx};margin-bottom:14px;">
      ${icon('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8')}Состав по зонам
      <span style="font-size:10.5px;font-weight:400;color:${T.tx3};margin-left:auto;">${BEFORE.date}</span></div>
    <div style="display:flex;gap:7px;">${segChip(false,'Мышцы',ru(BEFORE.muscle))}${segChip(true,'Жир',ru(BEFORE.fat))}</div>
    <div style="position:relative;width:100%;height:${BH+16}px;margin-top:14px;">
      <div style="position:absolute;left:${Math.round((CIN-BW)/2)}px;top:8px;width:${BW}px;">
        <svg viewBox="${CVIEW.join(' ')}" width="100%" style="display:block;overflow:visible;">
          <defs>${['torso','rarm','larm','rleg','lleg'].filter(z=>SEGDATA[z].st!=='low').map(z=>{
            const R = Math.max(.5, segGlow(SEGDATA[z].kg, z, CIN) * CVIEW[2] / BW);
            return `<filter id="bsg-${z}" x="-150%" y="-80%" width="400%" height="260%" color-interpolation-filters="sRGB">
              <feGaussianBlur in="SourceAlpha" stdDeviation="${(R*.652).toFixed(2)}" result="b"/>
              <feComponentTransfer in="b" result="a"><feFuncA type="linear" slope="8" intercept="0"/></feComponentTransfer>
              <feComposite in="a" in2="SourceAlpha" operator="out" result="ring"/>
              <feFlood flood-color="${SEGCOL[SEGDATA[z].st]}" flood-opacity=".5"/>
              <feComposite in2="ring" operator="in"/></filter>`; }).join('')}</defs>
          ${['torso','rarm','larm','rleg','lleg'].map(z =>
            `<path d="${lean.paths[z]}" fill="${SEGCOL[SEGDATA[z].st]}" filter="url(#bsg-${z})"/>`).join('')}
          <path d="${lean.paths.body}" fill="#39424a"/>
          <g style="mix-blend-mode:screen;">${['torso','rarm','larm','rleg','lleg'].map(z =>
            `<path d="${lean.paths[z]}" fill="${SEGCOL[SEGDATA[z].st]}" fill-opacity=".18"/>`).join('')}</g>
        </svg></div>
      ${segLabel('torso', Math.round(BH*.10), false)}
      ${segLabel('rarm',  Math.round(BH*.38), false)}
      ${segLabel('rleg',  Math.round(BH*.68), false)}
      ${segLabel('larm',  Math.round(BH*.38), true)}
      ${segLabel('lleg',  Math.round(BH*.68), true)}</div>
    <div style="margin-top:12px;font-size:11px;color:${T.tx3};line-height:1.5;">Оценка «норма / выше / ниже» взята с бланка, не пересчитывается.</div></div>`;

const NEWW = (() => {
  const d = BEFORE;
  const f = figure({ ...BASE, zones:d.zones, view:CVIEW, uid:'cmp', aria:'Фигура со слоем жира' });
  const lbl = (z, top, right) => { const kg = d.zones[z], n = Math.round(kg*1000/DOT_G);
    return `<div style="position:absolute;${right?'right':'left'}:0;top:${top}px;width:84px;display:flex;
        flex-direction:column;gap:2px;align-items:flex-${right?'start':'end'};text-align:${right?'left':'right'};">
        <div style="font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:${T.tx2};line-height:1.2;">${SEGLBL[z].toUpperCase()}</div>
        <div style="font-size:15px;font-weight:700;${MONO}color:${T.fat};">${ru(kg)}<span style="font-size:10.5px;font-weight:400;color:${T.tx2};"> кг</span></div>
        <span style="padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;${MONO}background:${T.fat}24;color:${T.fat};">${n} ${plural(n,'точка','точки','точек')}</span>
        <span style="font-size:9px;color:${T.tx3};">сверх нормы</span></div>`;
  };
  return `<div style="${CARD}width:${CW}px;">
    <div style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;color:${T.tx};margin-bottom:14px;">
      ${icon(RULER)}Сколько лишнего
      <span style="font-size:10.5px;font-weight:400;color:${T.tx3};margin-left:auto;">${d.date}</span></div>
    <div style="display:flex;gap:7px;">${segChip(false,'Мышцы',ru(d.muscle))}${segChip(true,'Жир',ru(d.fat))}</div>
    <div style="position:relative;width:100%;height:${BH+16}px;margin-top:14px;">
      <div style="position:absolute;left:${Math.round((CIN-BW)/2)}px;top:8px;width:${BW}px;">${f.svg}</div>
      ${lbl('torso', Math.round(BH*.10), false)}
      ${lbl('rarm',  Math.round(BH*.38), false)}
      ${lbl('rleg',  Math.round(BH*.68), false)}
      ${lbl('larm',  Math.round(BH*.38), true)}
      ${lbl('lleg',  Math.round(BH*.68), true)}</div>
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:6px;padding-top:12px;border-top:1px solid ${T.bd2};">
      <span style="font-size:26px;font-weight:700;${MONO}color:${T.fat};line-height:1;">${ru(d.excess)}<span style="font-size:12px;font-weight:400;color:${T.tx3};"> кг</span></span>
      <span style="font-size:11.5px;color:${T.tx2};">сверх нормы ${NORM_PCT}&nbsp;%</span>
      <span style="margin-left:auto;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;${MONO}background:rgba(251,191,36,.13);color:${T.fat};">${d.dots} ${plural(d.dots,'точка','точки','точек')}</span></div>
    <div style="margin-top:11px;font-size:11px;color:${T.tx3};line-height:1.5;">Одна точка = ${DOT_G} г. Толщина слоя растёт с массой зоны на её площадь, но по сжатой шкале — иначе манжета на руке была бы тоньше пикселя.</div></div>`;
})();

const COMPARE = `<div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
    <div>
      <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:${T.tx2};margin-bottom:9px;">СЕЙЧАС В МЕДКАРТЕ</div>
      ${CURRENT}
      <div style="width:${CW}px;margin-top:10px;font-size:11px;color:${T.tx3};line-height:1.5;">
        Воспроизведён по коду <span style="${MONO}">bodySegments()</span>: те же чипы, подписи, формула ореола и цвета вердикта.
        Фотография тела заменена плоским силуэтом — фотографий из <span style="${MONO}">/body/*.webp</span> здесь нет.</div></div>
    <div>
      <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:${T.fat};margin-bottom:9px;">ПРЕДЛАГАЕТСЯ</div>
      ${NEWW}
      <div style="width:${CW}px;margin-top:10px;font-size:11px;color:${T.tx3};line-height:1.5;">
        Тот же человек и та же дата. Слева — сколько жира в зоне и вердикт прибора; справа — сколько его лишнего и как он лежит.
        Виджеты не спорят, а отвечают на разные вопросы.</div></div></div>`;

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
  'Compare.dc.html': doc(COMPARE, '24px'),
};
for (const [name, html] of Object.entries(files)){
  fs.writeFileSync(name, html);
  console.log(name.padEnd(16), (html.length/1024).toFixed(0)+' КБ');
}
for (const gone of ['DotBody.dc.html','ZoneMesh.dc.html'])
  if (fs.existsSync(gone)) fs.unlinkSync(gone);

const canvas = {
  artboards: [
    { file:'Main.dc.html',   x:0,    y:0,    w:900, h:790 },
    { file:'Mobile.dc.html', x:1010, y:0,    w:390, h:700 },
    { file:'Angles.dc.html', x:0,    y:960,  w:940, h:520 },
    { file:'Scale.dc.html',  x:0,    y:1620, w:940, h:520 },
    { file:'Compare.dc.html', x:0,   y:2260, w:960, h:730 },
  ],
  annotations: [
    { id:'cmp', x:1020, y:2260, w:340,
      text:'Сравнение: слева текущий виджет «Состав по зонам», справа новый. Тот же человек, та же дата.\n\nОни не спорят: слева сколько жира в зоне и вердикт прибора, справа — сколько его ЛИШНЕГО и как он лежит.' },
    { id:'brief', x:1010, y:810, w:390,
      text:'Поза как на бланке DDX: руки отведены, поэтому видны и бока, и сами руки — иначе жир на них показать нечем.\n\nЭталонное тело на «до» и «после» ОДНО И ТО ЖЕ — тело при 15 % жира. Янтарный контур снаружи — оно же со слоем жира; между ними точки.\n\nОдна точка = 20 г: 610 точек против 180 — это и есть 12,2 кг против 3,6 кг.\n\nЦифры — образец, не реальные замеры.' },
  ],
  launch: { view:'canvas' },
};
fs.writeFileSync('canvas.json', JSON.stringify(canvas, null, 2));
console.log('canvas.json  кадр', VIEW.join(' '), '→', FW+'×'+FH);
