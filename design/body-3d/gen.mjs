// Генератор SVG-фигур для карточки «Состав тела · до и после» (медкарта → Профиль).
//
// Идея та же, что у глобуса в разделе «Жизнь»: поверхность разбита на кольца,
// кольца ортографически проецируются на плоскость. Поворот — один угол ROT
// (рыскание) плюс наклон камеры TILT: без наклона горизонтальные кольца
// вырождаются в прямые и объём не читается совсем.
//
// ГЛАВНОЕ ПРАВИЛО КАРТИНКИ: эталонное тело на «до» и «после» ОДНО И ТО ЖЕ.
// Меняется только облако точек — жир сверх нормы. Одна точка = DOT_G граммов,
// так что число точек это не украшение, а сама величина избытка.
//
// Толщина слоя точек = масса, размазанная по площади зоны (кг/площадь) — ровно
// так же считает ореол в виджете «Состав по зонам» (medcard_profile.js, segGlow).
// Площади зон оттуда же (SEGAREA, мужской комплект /body/*.webp).
//
// Порядок слоёв повторяет глобус: дальние точки → дальняя сетка → полупрозрачная
// заливка силуэта (она и даёт окклюзию) → ближняя сетка → ближние точки.

export const DOT_G = 20;                 // граммов в одной точке
const TAU = Math.PI * 2;

export const SEGAREA = { torso:46691, larm:13039, rarm:12864, lleg:22637, rleg:22894 };
// Толщина слоя в долях роста: K * (кг / площадь зоны). K подобран так, чтобы
// торс с 7,3 кг избытка дал слой 0.062 роста. Пропорции между зонами честные,
// абсолютный масштаб увеличен — настоящие 8 мм подкожного жира на фигуре
// высотой 490 px были бы 2 пикселя.
const K_LAYER = 0.062 / (7.3 / SEGAREA.torso);

function rng(seed){
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ============================ геометрия тела =================================
// Доли роста: y — вверх от пола (0) до макушки (1), x — вправо, z — вперёд.

// торс: [y, полуширина, полуглубина, смещение центра по глубине]
const TORSO = [
  [0.470, .099, .073,  .000],
  [0.520, .103, .076,  .000],
  [0.560, .093, .071,  .002],
  [0.600, .086, .065,  .002],
  [0.638, .087, .065,  .002],
  [0.680, .095, .069,  .001],
  [0.722, .103, .073,  .000],
  [0.780, .111, .071, -.002],
  [0.815, .117, .063, -.004],
  [0.838, .104, .053, -.006],
];
const TY0 = TORSO[0][0], TY1 = TORSO[TORSO.length-1][0];

function torsoAt(y){
  if (y <= TY0) return TORSO[0].slice(1);
  if (y >= TY1) return TORSO[TORSO.length-1].slice(1);
  for (let i=1;i<TORSO.length;i++) if (y <= TORSO[i][0]){
    const a = TORSO[i-1], b = TORSO[i];
    let t = (y-a[0])/(b[0]-a[0]); t = t*t*(3-2*t);
    return [a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, a[3]+(b[3]-a[3])*t];
  }
  return TORSO[TORSO.length-1].slice(1);
}
function torsoPt(y, th){
  const [rx, rz, cz] = torsoAt(y);
  const c = Math.cos(th), s = Math.sin(th);
  const n = [c/rx, 0, s/rz], L = Math.hypot(n[0], n[2]);
  return { p:[rx*c, y, cz + rz*s], n:[n[0]/L, 0, n[2]/L] };
}

const NECK = { y0:.836, y1:.878, r0:.037, r1:.032, cz:-.008 };
const HEAD = { cy:.930, rx:.047, ry:.061, rz:.053, cz:-.004 };
const neckPt = (t, th) => {
  const y = NECK.y0 + (NECK.y1-NECK.y0)*t, r = NECK.r0 + (NECK.r1-NECK.r0)*t;
  const n = [Math.cos(th), 0, Math.sin(th)];
  return { p:[n[0]*r, y, NECK.cz + n[2]*r], n };
};
const headPt = (ph, th) => {
  const n = [Math.cos(ph)*Math.cos(th), Math.sin(ph), Math.cos(ph)*Math.sin(th)];
  return { p:[HEAD.rx*n[0], HEAD.cy + HEAD.ry*n[1], HEAD.cz + HEAD.rz*n[2]], n };
};

const arm = s => [
  { p:[s*.104, .806, -.004], r:.042 }, { p:[s*.126, .706,  .000], r:.036 },
  { p:[s*.139, .624,  .004], r:.030 }, { p:[s*.151, .506,  .008], r:.024 },
  { p:[s*.156, .452,  .010], r:.021 }, { p:[s*.161, .392,  .015], r:.017 },
];
const leg = s => [
  { p:[s*.048, .500,  .000], r:.070 }, { p:[s*.052, .400,  .002], r:.058 },
  { p:[s*.054, .288,  .004], r:.046 }, { p:[s*.052, .176,  .000], r:.034 },
  { p:[s*.048, .062, -.008], r:.027 }, { p:[s*.047, .022,  .028], r:.021 },
];
// right/left — как на бланке DDX, глазами пациента
export const LIMBS = { rarm:arm(-1), larm:arm(1), rleg:leg(-1), lleg:leg(1) };

function frame(a, b){
  const d = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], L = Math.hypot(...d), dn = d.map(v=>v/L);
  const up = Math.abs(dn[2]) > .9 ? [1,0,0] : [0,0,1];
  let u = [dn[1]*up[2]-dn[2]*up[1], dn[2]*up[0]-dn[0]*up[2], dn[0]*up[1]-dn[1]*up[0]];
  const lu = Math.hypot(...u); u = u.map(v=>v/lu);
  const v = [dn[1]*u[2]-dn[2]*u[1], dn[2]*u[0]-dn[0]*u[2], dn[0]*u[1]-dn[1]*u[0]];
  return { u, v, len:L };
}
function limbPt(J, i, t, th){
  const a = J[i].p, b = J[i+1].p, { u, v } = frame(a, b);
  const r = J[i].r + (J[i+1].r-J[i].r)*t;
  const c = [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  const ct = Math.cos(th), st = Math.sin(th);
  const n = [u[0]*ct+v[0]*st, u[1]*ct+v[1]*st, u[2]*ct+v[2]*st];
  return { p:[c[0]+n[0]*r, c[1]+n[1]*r, c[2]+n[2]*r], n };
}
const limbLen = J => { let s=0; for(let i=0;i<J.length-1;i++) s += frame(J[i].p, J[i+1].p).len; return s; };

// ============================ камера =========================================
export const ROT = 0.58, TILT = 0.19;    // ~33° рыскания, ~11° наклона камеры

function mk(rot, tilt){
  const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
  return {
    p(v){ const x1 = v[0]*cr + v[2]*sr, z1 = -v[0]*sr + v[2]*cr;
          return { x:x1, y:v[1]*ct - z1*st, z:v[1]*st + z1*ct }; },
    nz(v){ const z1 = -v[0]*sr + v[2]*cr; return v[1]*st + z1*ct; },
  };
}

// ============================ отрисовка ======================================
const f1 = n => (Math.round(n*10)/10).toString();
const poly = r => 'M' + r.map(q => f1(q.sx)+' '+f1(q.sy)).join('L');
const closed = r => poly(r) + 'Z';

// разбить проекцию контура на ближние и дальние куски
function runs(pts, isClosed){
  const out = [[], [], []];
  const list = isClosed ? pts.concat([pts[0]]) : pts;
  let cur = null, side = -1;
  for (const q of list){
    if (q.cls !== side){
      if (cur && cur.length > 1) out[side].push(cur);
      cur = cur && cur.length ? [cur[cur.length-1], q] : [q];
      side = q.cls;
    } else cur.push(q);
  }
  if (cur && cur.length > 1) out[side].push(cur);
  return out;
}

/**
 * Одна фигура.
 *   width,height,scale,cx,footY — холст и посадка фигуры
 *   zones      — избыток жира по зонам бланка, кг: {torso,larm,rarm,lleg,rleg}
 *   seed       — зерно, чтобы точки не «дышали» между сборками
 *   style      — 'mesh' (сетка контуров) | 'dots' (тело тоже точками)
 *   zoneColors — перекрасить кольца зоны (вариант «по зонам»)
 *   rot, tilt, colors, dotR
 * Возвращает { svg, dots } — dots это фактическое число точек, его и печатаем.
 */
export function figure(o){
  const W = o.width, H = o.height, S = o.scale, CX = o.cx, FY = o.footY;
  const cam = mk(o.rot ?? ROT, o.tilt ?? TILT);
  const R = rng(o.seed || 7);
  const zones = o.zones || {};
  const px = q => ({ sx: CX + S*q.x, sy: FY - S*q.y, z: q.z });
  // класс линии: 0 — дальняя сторона, 1 — ближняя, 2 — кромка силуэта.
  // Кромка ярче остального: без этого ортографическая фигура читается плоской.
  const RIM = o.rim ?? 0.42;
  const P = (p, n) => { const q = px(cam.p(p)); const d = cam.nz(n);
    q.cls = d <= 0 ? 0 : (d < RIM ? 2 : 1); return q; };

  // ---------- части тела: каждая часть это стопка колец ----------
  // ring = массив спроецированных точек; из колец собирается и сетка, и заливка
  const parts = [];
  const mkRing = (fn, n) => { const a = []; for (let i=0;i<n;i++){ const s = fn(i/n*TAU); a.push(P(s.p, s.n)); } return a; };

  { // торс
    const rings = [];
    for (let k=0;k<=12;k++){ const y = TY0 + (TY1-TY0)*k/12; rings.push(mkRing(th => torsoPt(y, th), 44)); }
    parts.push({ zone:'torso', rings, mesh:rings });
  }
  { // шея
    const rings = [];
    for (let k=0;k<=3;k++) rings.push(mkRing(th => neckPt(k/3, th), 28));
    parts.push({ rings, mesh:rings.slice(1) });
  }
  { // голова: полюса вырожденные кольца, чтобы заливка закрыла макушку
    const rings = [], mesh = [];
    for (let k=0;k<=8;k++){
      const ph = -Math.PI/2 + k/8*Math.PI;
      const r = mkRing(th => headPt(ph, th), 30);
      rings.push(r); if (k>1 && k<8 && k%2) mesh.push(r);
    }
    parts.push({ rings, mesh });
  }
  for (const [zone, J] of Object.entries(LIMBS)){   // руки и ноги
    const rings = [], segs = J.length - 1;
    for (let i=0;i<segs;i++){
      const steps = i === segs-1 ? 2 : 3;
      for (let k=0;k<steps;k++) rings.push(mkRing(th => limbPt(J, i, k/steps, th), 26));
    }
    rings.push(mkRing(th => limbPt(J, segs-1, 1, th), 26));
    parts.push({ zone, rings, mesh:rings });
  }

  // ---------- заливка силуэта ----------
  // Кольцо как замкнутый многоугольник + четырёхугольник между крайними по
  // экрану точками соседних колец — вместе дают сплошной силуэт без зазубрин
  // на боковой кромке. Два отдельных path, чтобы направление обхода не вычитало
  // одно из другого по правилу nonzero.
  // Каждая часть — СВОЙ path: кольца руки и кольца торса перекрываются, и в одном
  // общем path противоположный обход вычел бы одно из другого по правилу nonzero
  // (именно так на первой сборке в плечах появились чёрные прорези). Прозрачность
  // задаётся на группе, а не на заливке, иначе перекрытия темнеют вдвое.
  const extremes = r => { let lo = 0, hi = 0;
    for (let i=1;i<r.length;i++){ if (r[i].sx < r[lo].sx) lo = i; if (r[i].sx > r[hi].sx) hi = i; }
    return [r[lo], r[hi]]; };
  const fillPaths = [];
  for (const part of parts){
    const rings = [], links = [];
    for (const r of part.rings) if (r.length > 2) rings.push(closed(r));
    for (let i=0;i<part.rings.length-1;i++){
      const [al, ah] = extremes(part.rings[i]), [bl, bh] = extremes(part.rings[i+1]);
      links.push(closed([al, bl, bh, ah]));
    }
    if (rings.length) fillPaths.push(`<path d="${rings.join('')}"/>`);
    if (links.length) fillPaths.push(`<path d="${links.join('')}"/>`);
  }

  // ---------- линии сетки: кольца + продольные ----------
  const mesh = [[], [], []];                 // общие линии по классам
  const zmesh = {};                          // то же, но с разбивкой по зонам
  const push = (segs, zone) => {
    const bag = zone ? (zmesh[zone] ||= [[], [], []]) : mesh;
    for (let i=0;i<3;i++) bag[i].push(...segs[i]);
  };
  for (const part of parts) for (const r of part.mesh) push(runs(r, true), part.zone);
  for (let i=0;i<10;i++){                            // продольные по торсу
    const th = i/10*TAU, pts = [];
    for (let k=0;k<=26;k++){ const s = torsoPt(TY0 + (TY1-TY0)*k/26, th); pts.push(P(s.p, s.n)); }
    push(runs(pts, false), 'torso');
  }
  for (let i=0;i<6;i++){                             // долготы головы
    const th = i/6*TAU, pts = [];
    for (let k=0;k<=20;k++){ const s = headPt(-Math.PI/2 + k/20*Math.PI, th); pts.push(P(s.p, s.n)); }
    push(runs(pts, false));
  }
  for (const [zone, J] of Object.entries(LIMBS)){    // продольные по конечностям
    const segs = J.length - 1;
    for (let a=0;a<6;a++){
      const th = a/6*TAU, pts = [];
      for (let i=0;i<segs;i++) for (let k=0;k<=6;k++){
        if (i && !k) continue;
        const s = limbPt(J, i, k/6, th); pts.push(P(s.p, s.n));
      }
      push(runs(pts, false), zone);
    }
  }

  // ---------- точки избыточного жира ----------
  // Вес выборки по торсу: у мужчин жир садится на живот и на бока, а не на спину.
  const bell = (v,c,w) => Math.exp(-((v-c)*(v-c))/(2*w*w));
  const torsoW = (y,th) => 1 + 2.4*bell(y,.615,.075)*(0.45 + 0.85*Math.max(0, Math.sin(th)))
                             + 1.3*bell(y,.590,.050)*Math.abs(Math.cos(th));
  const dotsFront = [], dotsBack = [];
  let total = 0;
  for (const [zone, kg] of Object.entries(zones)){
    if (!kg) continue;
    const T = K_LAYER * (kg / SEGAREA[zone]);
    const n = Math.round(kg*1000/DOT_G);
    total += n;
    for (let i=0;i<n;i++){
      let s;
      if (zone === 'torso'){
        for (let g=0;g<64;g++){
          const y = TY0 + R()*(TY1-TY0-0.012), th = R()*TAU;
          if (R() < torsoW(y, th)/5.2 || g === 63){ s = torsoPt(y, th); break; }
        }
      } else {
        const J = LIMBS[zone], segs = J.length - 1, u = R()*(segs - 0.55);
        const si = Math.min(segs-1, Math.floor(u));
        s = limbPt(J, si, u - si, R()*TAU);
      }
      const d = T * (0.30 + 0.70*R());
      const q = px(cam.p([s.p[0]+s.n[0]*d, s.p[1]+s.n[1]*d, s.p[2]+s.n[2]*d]));
      const dep = Math.max(0, Math.min(1, (q.z + 0.25)/0.5));
      const r = (o.dotR || 1.45) * (0.74 + 0.30*dep);
      (cam.nz(s.n) > 0 ? dotsFront : dotsBack)
        .push(`<circle cx="${f1(q.sx)}" cy="${f1(q.sy)}" r="${Math.round(r*100)/100}"/>`);
    }
  }

  // ---------- вариант «тело точками» ----------
  let bodyDots = null;
  if (o.style === 'dots'){
    // Плотность общая на всё тело: иначе руки зарастают точками, а торс пустеет —
    // число точек должно идти от ПЛОЩАДИ куска, а не от его длины.
    const D = o.density || 6800;              // точек на единицу площади (доли роста²)
    const bf = [], bb = [];
    const add = (p, n) => { const q = px(cam.p(p)), fwd = cam.nz(n) > 0;
      (fwd ? bf : bb).push(`<circle cx="${f1(q.sx)}" cy="${f1(q.sy)}" r="${fwd?1.15:0.95}"/>`); };
    const ellP = (a,b) => Math.PI * Math.sqrt(2*(a*a + b*b));   // периметр эллипса
    let aTorso = 0;
    for (let k=0;k<200;k++){ const [rx, rz] = torsoAt(TY0 + (k+.5)/200*(TY1-TY0));
      aTorso += ellP(rx, rz) * (TY1-TY0)/200; }
    for (let k=0, n=Math.round(D*aTorso); k<n; k++){
      const s = torsoPt(TY0 + R()*(TY1-TY0), R()*TAU); add(s.p, s.n); }
    for (const J of Object.values(LIMBS)){
      const segs = J.length - 1;
      let A = 0; for (let i=0;i<segs;i++) A += Math.PI*(J[i].r + J[i+1].r)*frame(J[i].p, J[i+1].p).len;
      for (let k=0, n=Math.round(D*A); k<n; k++){
        const u = R()*segs, si = Math.min(segs-1, Math.floor(u));
        const s = limbPt(J, si, u-si, R()*TAU); add(s.p, s.n); }
    }
    const aHead = 4*Math.PI*((HEAD.rx*HEAD.ry + HEAD.ry*HEAD.rz + HEAD.rx*HEAD.rz)/3);
    for (let k=0, n=Math.round(D*aHead); k<n; k++){
      const s = headPt(Math.asin(R()*2-1), R()*TAU); add(s.p, s.n); }
    const aNeck = ellP(NECK.r0, NECK.r0) * (NECK.y1 - NECK.y0);
    for (let k=0, n=Math.round(D*aNeck); k<n; k++){
      const s = neckPt(R(), R()*TAU); add(s.p, s.n); }
    bodyDots = { back:bb.join(''), front:bf.join('') };
  }

  // ---------- пол ----------
  const floor = closed(Array.from({length:49}, (_,i) => {
    const th = i/48*TAU; return px(cam.p([Math.cos(th)*.145, 0.004, Math.sin(th)*.145]));
  }));

  const C = o.colors || {};
  const cBack = C.back || '#2b363d', cFront = C.front || '#3f5867', cRim = C.rim || '#82a9c0';
  const cDot = C.dot || '#fbbf24';
  const cF0 = C.fill0 || '#1c2429', cF1 = C.fill1 || '#0a0d0f';
  const uid = o.uid || 'b';

  const strokes = (arr, col, w) => arr.length
    ? `<g fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${arr.map(poly).join('')}"/></g>` : '';
  // цвет и толщина по классу: дальняя сторона — ближняя — кромка
  const COL = [cBack, cFront, cRim], WID = [.8, 1, 1.25];
  const layer = cls => o.style === 'dots' ? '' :
    strokes(mesh[cls], COL[cls], WID[cls]) +
    Object.entries(zmesh).map(([z, bag]) => {
      const zc = o.zoneColors && o.zoneColors[z];
      return strokes(bag[cls], zc ? (cls ? zc : cBack) : COL[cls], WID[cls]);
    }).join('');

  const back = o.style === 'dots'
    ? `<g fill="${cFront}" fill-opacity=".95">${bodyDots.back}</g>` : layer(0);
  const front = o.style === 'dots'
    ? `<g fill="${cFront}" fill-opacity=".9">${bodyDots.front}</g>` : layer(1) + layer(2);

  const V = o.view || [0, 0, W, H];
  const svg = `<svg viewBox="${V.join(' ')}" width="100%" role="img" aria-label="${o.aria||''}" style="display:block;">
<defs><linearGradient id="g-${uid}" gradientUnits="userSpaceOnUse" x1="${(W*0.16).toFixed(1)}" y1="0" x2="${(W*0.80).toFixed(1)}" y2="0">
<stop offset="0" stop-color="${cF0}"/><stop offset=".72" stop-color="${cF1}"/><stop offset="1" stop-color="${cF1}"/></linearGradient></defs>
<path d="${floor}" fill="none" stroke="#1e1e1e" stroke-width="1" stroke-dasharray="3 5"/>
<g fill="${cDot}" fill-opacity=".85">${dotsBack.join('')}</g>
${back}
<g fill="url(#g-${uid})" opacity="${o.fillOpacity ?? .93}">${fillPaths.join('')}</g>
${front}
<g fill="${cDot}" fill-opacity=".95">${dotsFront.join('')}</g>
</svg>`;
  return { svg, dots: total };
}
