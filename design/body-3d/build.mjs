// Собирает артборды .dc.html из фигур gen.mjs. Правки — здесь, потом `node build.mjs`.
import { figure, DOT_G } from './gen.mjs';
import fs from 'fs';

// ---- данные: ОБРАЗЕЦ по бланку DDX/InBody, реальные цифры подставит медкарта ----
const NORM_PCT = 15;                       // ориентир «нормы» по жиру
const BEFORE = { label:'ДО', date:'12.03.2026', weight:92.4, fatPct:28.3, fat:26.1, muscle:34.8,
                 zones:{ torso:7.30, larm:0.70, rarm:0.70, lleg:1.76, rleg:1.74 } };
const AFTER  = { label:'ПОСЛЕ', date:'01.09.2026', weight:82.0, fatPct:19.6, fat:16.1, muscle:36.2,
                 zones:{ torso:2.00, larm:0.24, rarm:0.26, lleg:0.66, rleg:0.64 } };
const sum = z => Object.values(z).reduce((a,b)=>a+b,0);
const ru = (n,d=1) => n.toFixed(d).replace('.', ',');

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

// холст 280×520 обрезан по фигуре: без обрезки треть карточки уходит в пустоту
const fig = (o) => { const f = figure({ width:280, height:520, scale:445, cx:140, footY:500, view:[22,54,236,466], ...o });
  return { html:`<div style="width:${o.cssWidth||290}px;max-width:100%;margin:0 auto;">${f.svg}</div>`, dots:f.dots }; };

// ---------------------------- артборд Main -------------------------------------
function panel(d, uid, seed){
  const excess = d.fat - d.weight * NORM_PCT / 100;
  const f = fig({ zones:d.zones, uid, seed, aria:`Фигура «${d.label}»` });
  const cell = (l, v, u, col) => `<div style="min-width:0;">
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:${T.tx3};">${l}</div>
        <div style="font-size:15px;font-weight:700;${MONO}color:${col||T.tx};margin-top:3px;">${v}<span style="font-size:10.5px;font-weight:400;color:${T.tx3};"> ${u}</span></div></div>`;
  return `<div style="${PANEL}padding:14px 14px 16px;min-width:0;">
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span style="font-size:10px;font-weight:700;letter-spacing:.12em;color:${T.tx2};">${d.label}</span>
        <span style="font-size:11px;${MONO}color:${T.tx3};margin-left:auto;">${d.date}</span></div>
      ${f.html}
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <span style="font-size:26px;font-weight:700;${MONO}color:${T.fat};line-height:1;">${ru(excess)}<span style="font-size:12px;font-weight:400;color:${T.tx3};"> кг</span></span>
        <span style="font-size:11px;color:${T.tx2};">жира сверх нормы</span>
        <span style="margin-left:auto;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;${MONO}background:rgba(251,191,36,.13);color:${T.fat};">${f.dots} точек</span></div>
      <div style="margin-top:9px;font-size:11px;${MONO}color:${T.tx3};">Торс ${ru(d.zones.torso)} · руки ${ru(d.zones.larm + d.zones.rarm)} · ноги ${ru(d.zones.lleg + d.zones.rleg)} кг</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 14px;margin-top:14px;padding-top:13px;border-top:1px solid ${T.bd2};">
        ${cell('Вес', ru(d.weight), 'кг')}${cell('Жир', ru(d.fatPct), '%')}
        ${cell('Жировая масса', ru(d.fat), 'кг')}${cell('Мышцы', ru(d.muscle), 'кг', T.ok)}</div></div>`;
}

const dBefore = BEFORE.fat - BEFORE.weight*NORM_PCT/100;
const dAfter  = AFTER.fat  - AFTER.weight *NORM_PCT/100;
const dotsB = Math.round(sum(BEFORE.zones)*1000/DOT_G), dotsA = Math.round(sum(AFTER.zones)*1000/DOT_G);

const delta = (l, v, good) => `<div style="min-width:0;">
    <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:${T.tx3};">${l}</div>
    <div style="font-size:17px;font-weight:700;${MONO}color:${good?T.ok:T.tx};margin-top:3px;">${v}</div></div>`;

const legend = `<div style="display:flex;align-items:center;gap:7px;font-size:11.5px;color:${T.tx2};">
    <svg width="26" height="10" style="flex-shrink:0;"><circle cx="4" cy="5" r="1.6" fill="${T.fat}"/><circle cx="13" cy="5" r="1.6" fill="${T.fat}"/><circle cx="22" cy="5" r="1.6" fill="${T.fat}"/></svg>
    одна точка = ${DOT_G} г жира сверх нормы</div>`;

const MAIN = `<div style="${CARD}max-width:800px;">
    ${head('Состав тела · до и после', 'бланк DDX · 5 зон')}
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:12px;color:${T.tx2};line-height:1.5;margin-bottom:16px;">
      <span style="flex:1;min-width:280px;">Контур — одно и то же эталонное тело при ${NORM_PCT}&nbsp;% жира. Меняется только облако точек.</span>
      ${legend}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      ${panel(BEFORE,'a',11)}${panel(AFTER,'b',11)}</div>
    <div style="display:flex;gap:26px;flex-wrap:wrap;margin-top:16px;padding:14px 16px;${PANEL}">
      <div style="min-width:0;">
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:${T.tx3};">За период</div>
        <div style="font-size:17px;font-weight:700;${MONO}color:${T.tx2};margin-top:3px;">173 дня</div></div>
      ${delta('Вес', '−'+ru(BEFORE.weight-AFTER.weight)+' кг', true)}
      ${delta('Жир', '−'+ru(BEFORE.fatPct-AFTER.fatPct)+' п.п.', true)}
      ${delta('Сверх нормы', '−'+ru(dBefore-dAfter)+' кг', true)}
      ${delta('Мышцы', '+'+ru(AFTER.muscle-BEFORE.muscle)+' кг', true)}
      ${delta('Точек', '−'+(dotsB-dotsA), true)}</div>
    <div style="margin-top:14px;font-size:11px;color:${T.tx3};line-height:1.6;">
      Норма ${NORM_PCT}&nbsp;% — ориентир, прибор её не считает: границы у DDX свои, от пола, возраста и роста.
      Толщина облака увеличена, иначе восемь миллиметров подкожного жира дали бы на фигуре два пикселя;
      пропорции между зонами настоящие — масса зоны, делённая на её площадь, как в виджете «Состав по зонам».</div></div>`;

// ---------------------------- артборд Mobile -----------------------------------
function mpanel(d, uid, seed){
  const excess = d.fat - d.weight*NORM_PCT/100;
  const f = fig({ zones:d.zones, uid, seed, cssWidth:132, aria:`Фигура «${d.label}»` });
  return `<div style="${PANEL}padding:11px 10px 13px;min-width:0;">
      <div style="display:flex;align-items:baseline;gap:6px;">
        <span style="font-size:9.5px;font-weight:700;letter-spacing:.12em;color:${T.tx2};">${d.label}</span>
        <span style="font-size:10px;${MONO}color:${T.tx3};margin-left:auto;">${d.date}</span></div>
      ${f.html}
      <div style="margin-top:8px;font-size:22px;font-weight:700;${MONO}color:${T.fat};line-height:1;">${ru(excess)}<span style="font-size:11px;font-weight:400;color:${T.tx3};"> кг</span></div>
      <div style="margin-top:4px;font-size:10.5px;${MONO}color:${T.fat};opacity:.75;">${f.dots} точек</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid ${T.bd2};font-size:11px;${MONO}color:${T.tx2};line-height:1.7;">
        Вес <b style="color:${T.tx};">${ru(d.weight)}</b> кг<br>Жир <b style="color:${T.tx};">${ru(d.fatPct)}</b> %<br>Мышцы <b style="color:${T.ok};">${ru(d.muscle)}</b> кг</div></div>`;
}
const MOBILE = `<div style="${CARD}padding:16px;">
    ${head('Состав тела · до и после')}
    <div style="font-size:11.5px;color:${T.tx2};line-height:1.5;margin-bottom:12px;">Контур один и тот же — тело при ${NORM_PCT}&nbsp;% жира. Точка = ${DOT_G} г жира сверх нормы.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">${mpanel(BEFORE,'ma',11)}${mpanel(AFTER,'mb',11)}</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;padding:12px 13px;${PANEL}">
      ${delta('Вес','−'+ru(BEFORE.weight-AFTER.weight)+' кг',true)}
      ${delta('Сверх нормы','−'+ru(dBefore-dAfter)+' кг',true)}
      ${delta('Точек','−'+(dotsB-dotsA),true)}</div>
    <div style="margin-top:12px;font-size:10.5px;color:${T.tx3};line-height:1.55;">Толщина облака увеличена для читаемости, пропорции между зонами настоящие.</div></div>`;

// ---------------------------- артборд Angles -----------------------------------
const ANG = [0, 0.7, 1.4, 2.1, 2.8];
const ANGLES = `<div style="${CARD}">
    ${head('Одна и та же фигура с разных сторон', 'проверка, что модель объёмная')}
    <div style="font-size:12px;color:${T.tx2};line-height:1.5;margin-bottom:14px;">
      Углы 0°, 40°, 80°, 120°, 160°. В интерактивном виде это один и тот же расчёт — меняется только угол поворота, как у глобуса в «Жизни».</div>
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;">
      ${ANG.map((rot,i)=>{ const f = fig({ zones:BEFORE.zones, uid:'an'+i, seed:11, rot, cssWidth:150, aria:`Поворот ${Math.round(rot*180/Math.PI)}°` });
        return `<div style="${PANEL}padding:10px 8px 12px;min-width:0;">
          <div style="font-size:10px;${MONO}color:${T.tx3};text-align:center;margin-bottom:2px;">${Math.round(rot*180/Math.PI)}°</div>${f.html}</div>`;
      }).join('')}</div></div>`;

// ------------------------- альтернативы (варианты) -----------------------------
const ALT_A = `<div style="${CARD}">
    ${head('Вариант A · тело тоже точками')}
    <div style="font-size:12px;color:${T.tx2};line-height:1.55;margin-bottom:14px;">
      Ближе всего к глобусу: поверхность эталонного тела — редкие серые точки, жир — янтарные.
      Плюс: один визуальный язык на весь раздел. Минус: контур тела размывается, силуэт «до» и «после» сравнивать труднее.</div>
    <div style="${PANEL}padding:14px;">${fig({ zones:BEFORE.zones, uid:'alta', seed:11, style:'dots', cssWidth:244, aria:'Тело точками' }).html}</div></div>`;

const FATCOL = { low:'#fbbf24', norm:'#4ade80', high:'#f87171' };   // как SEGCOL.fat
const ALT_B = `<div style="${CARD}">
    ${head('Вариант B · кольца красит вердикт зоны')}
    <div style="font-size:12px;color:${T.tx2};line-height:1.55;margin-bottom:14px;">
      Сетка окрашена по вердикту с бланка — тем же правилом, что «Состав по зонам»: норма зелёная, выше нормы красная.
      Плюс: две карточки сливаются в одну. Минус: цвета спорят с янтарными точками, картинка становится пёстрой.</div>
    <div style="${PANEL}padding:14px;">${fig({ zones:BEFORE.zones, uid:'altb', seed:11, cssWidth:244, aria:'Кольца по вердикту зон',
      zoneColors:{ torso:FATCOL.high, larm:FATCOL.norm, rarm:FATCOL.norm, lleg:FATCOL.high, rleg:FATCOL.high } }).html}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:${T.tx2};">
      ${[['норма',FATCOL.norm],['выше нормы',FATCOL.high],['ниже нормы',FATCOL.low]].map(([l,c])=>
        `<span style="display:inline-flex;align-items:center;gap:6px;"><i style="width:9px;height:9px;border-radius:2px;background:${c};display:inline-block;"></i>${l}</span>`).join('')}</div></div>`;

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
  'Main.dc.html':     doc(MAIN, '30px'),
  'Mobile.dc.html':   doc(MOBILE, '14px 14px 22px'),
  'Angles.dc.html':   doc(ANGLES, '24px'),
  'DotBody.dc.html':  doc(ALT_A, '24px'),
  'ZoneMesh.dc.html': doc(ALT_B, '24px'),
};
for (const [name, html] of Object.entries(files)){
  fs.writeFileSync(name, html);
  console.log(name.padEnd(18), (html.length/1024).toFixed(0)+' КБ');
}

const canvas = {
  artboards: [
    { file:'Main.dc.html',     x:0,    y:0,    w:900, h:1120 },
    { file:'Mobile.dc.html',   x:1010, y:0,    w:390, h:720 },
    { file:'Angles.dc.html',   x:0,    y:1260, w:940, h:500 },
    { file:'DotBody.dc.html',  x:0,    y:1880, w:460, h:750 },
    { file:'ZoneMesh.dc.html', x:560,  y:1880, w:460, h:780 },
  ],
  annotations: [
    { id:'brief', x:1010, y:800, w:390,
      text:'Задача: контур тела в 3D, избыточный жир — точками, «до / после» статикой.\n\nГлавный приём: эталонное тело на обеих картинках ОДНО И ТО ЖЕ — это тело при 15 % жира. Меняется только облако точек, поэтому разницу видно раньше, чем прочитаешь цифры.\n\nОдна точка = 20 г жира сверх нормы. 610 точек против 190 — это и есть 12,2 кг против 3,8 кг.\n\nЦифры — образец с бланка DDX, не реальные замеры.' },
    { id:'alts', x:1090, y:1880, w:330,
      text:'Две альтернативы отрисовки. Выбираем одну — остальные уберу, чтобы канва не разрасталась.' },
  ],
  launch: { view:'canvas' },
};
fs.writeFileSync('canvas.json', JSON.stringify(canvas, null, 2));
console.log('canvas.json');
