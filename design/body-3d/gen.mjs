// Фигура для карточки «Состав тела · до и после» (медкарта → Профиль).
//
// Что рисуем:
//   1. ЭТАЛОННОЕ ТЕЛО — то же самое на «до» и «после». Силуэт обводится одной
//      линией, внутри редкие поперечные сечения. Проекция ортографическая, как
//      у глобуса в разделе «Жизнь»: угол рыскания ROT плюс наклон камеры TILT.
//   2. ЖИВОТ — весь жир сверх нормы, сведённый туда, где он и виден. Купол на
//      передней стенке торса, заполненный точками. Одна точка = DOT_G граммов,
//      высота купола растёт пропорционально избытку.
//
// Силуэт не собирается из перекрывающихся многоугольников (так было раньше —
// в плечах вылезали чёрные прорези от правила nonzero). Тело растеризуется в
// маску, контур снимается marching squares и сглаживается: одна замкнутая
// линия на деталь, дырки между руками и торсом получаются сами.

export const DOT_G = 20;
const TAU = Math.PI * 2;

// ---------------------------- вектора ----------------------------------------
const sub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot3 = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit = a => { const l = Math.hypot(a[0],a[1],a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };

function rng(seed){
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Катмулл-Ром по опорным точкам: гладко и БЕЗ полки в каждой опоре, которую
// давал smoothstep — от него торс выглядел стопкой шайб.
function spline(keys, t){
  const n = keys.length, i = Math.max(0, Math.min(n-2, Math.floor(t)));
  const f = Math.max(0, Math.min(1, t - i));
  const p0 = keys[Math.max(0,i-1)], p1 = keys[i], p2 = keys[i+1], p3 = keys[Math.min(n-1,i+2)];
  const out = [];
  for (let k=0;k<p1.length;k++){
    const a = p1[k], b = p2[k], m1 = (p2[k]-p0[k])/2, m2 = (p3[k]-p1[k])/2;
    out.push(((2*a-2*b+m1+m2)*f + (-3*a+3*b-2*m1-m2))*f*f + m1*f + a);
  }
  return out;
}

// ============================ анатомия =======================================
// Доли роста: y — вверх от пола (0) до макушки (1), x — вправо, z — вперёд.
// Обхваты взяты от мужчины 180 см: плечи 46 см в поперечнике, талия 30, таз 36,
// грудь 32 — отсюда полуширины 0.116 / 0.084 / 0.102 / 0.098 роста.

// [y, полуширина, полуглубина, смещение по глубине, показатель суперэллипса]
// Показатель > 2 делает сечение скруглённым прямоугольником: грудная клетка и
// таз у человека именно такие, чистый эллипс даёт бочку.
const TORSO_KEYS = [
  [0.470, .094, .062, -.010, 2.5],
  [0.505, .102, .073, -.024, 2.5],   // ягодицы уходят назад
  [0.545, .096, .063, -.012, 2.4],
  [0.582, .088, .056,  .000, 2.3],
  [0.622, .083, .052,  .004, 2.3],   // талия и поясничный прогиб вперёд
  [0.665, .088, .057,  .002, 2.4],
  [0.706, .094, .061, -.002, 2.5],
  [0.744, .098, .066, -.002, 2.5],   // грудь
  [0.778, .104, .058, -.008, 2.4],
  [0.800, .112, .052, -.012, 2.3],
  [0.816, .112, .046, -.014, 2.2],   // плечевой пояс
  [0.830, .086, .040, -.016, 2.1],
  [0.840, .056, .036, -.018, 2.0],   // сход в трапецию, выше видна шея
];
// голова с подбородком и скулами — не шар: шар и делал «страшно»
const HEAD_KEYS = [
  [0.824, .033, .034, -.016, 2.0],   // шея начинается ниже плеч и видна над ними
  [0.858, .032, .034, -.014, 2.0],
  [0.874, .034, .043, -.008, 2.1],   // подбородок
  [0.892, .040, .052, -.003, 2.2],
  [0.916, .043, .056,  .000, 2.2],   // скулы: ширина головы 15,5 см, глубина 19,5
  [0.946, .042, .054, -.002, 2.1],
  [0.972, .036, .046, -.004, 2.0],
  [0.990, .024, .030, -.006, 2.0],
  [1.000, .010, .012, -.006, 2.0],
];
// Нос. Мелочь, но именно он превращает овал в голову и задаёт, куда человек
// смотрит: без него фигура в профиль читается манекеном.
const NOSE = (y, th) => 0.015 * Math.exp(-Math.pow((y-0.908)/0.016, 2))
                             * Math.pow(Math.max(0, Math.sin(th)), 8);
// конечности: опорные точки осевой линии и радиус в каждой
const arm = s => [
  [s*.086, .826, -.014, .019],   // верх дельты скруглён и уходит под плечо
  [s*.096, .800, -.014, .036],   // дельта
  [s*.108, .724, -.014, .030],   // плечо, обхват 33 см
  [s*.113, .638, -.012, .026],   // локоть
  [s*.113, .556, -.006, .024],   // предплечье
  [s*.110, .470,  .004, .017],   // запястье, обхват 17 см
  [s*.109, .432,  .010, .016],   // кисть без утолщения — иначе на бедре висит овал
  [s*.108, .398,  .014, .011],
  [s*.107, .382,  .016, .005],
];
const leg = s => [
  [s*.050, .500,  .000, .052],
  [s*.054, .404,  .002, .049],   // бедро, обхват 56 см
  [s*.056, .312,  .004, .039],
  [s*.056, .282,  .002, .036],   // колено
  [s*.054, .202, -.008, .037],   // икра
  [s*.050, .124, -.010, .027],
  [s*.047, .052, -.006, .021],   // щиколотка
  [s*.047, .020, -.016, .022],   // пятка
  [s*.047, .010,  .046, .014],   // носок задаёт, куда человек смотрит
];

// ---- поверхность как функция (s, θ) -----------------------------------------
// s ∈ [0,1] вдоль детали, θ ∈ [0,2π) по окружности. Нормаль считается численно —
// так она верна и на сужении конечности, и на подбородке.
function sePow(v, e){ const a = Math.abs(v); return (v<0?-1:1) * Math.pow(a, 2/e); }

function stack(keys, bump){                 // торс и голова: горизонтальные кольца
  return { kind:'stack', keys, n:keys.length-1,
    at(s, th){
      const k = spline(keys, s*this.n);
      const c = Math.cos(th), sn = Math.sin(th);
      const b = bump ? bump(k[0], th) : 0;
      return [k[1]*sePow(c, k[4]), k[0], k[3] + k[2]*sePow(sn, k[4]) + b];
    },
    axis(s){ const k = spline(keys, s*this.n); return [0, k[0], k[3]]; } };
}
function tube(joints){                      // конечности: кольца поперёк оси
  return { kind:'tube', keys:joints, n:joints.length-1,
    at(s, th){
      const k = spline(joints, s*this.n), c = [k[0], k[1], k[2]], r = k[3];
      const h = 0.004, a = spline(joints, Math.max(0, s*this.n - h*this.n)),
            b = spline(joints, Math.min(this.n, s*this.n + h*this.n));
      const ax = unit([b[0]-a[0], b[1]-a[1], b[2]-a[2]]);
      const u = unit(cross(ax, [0,0,1])), v = cross(ax, u);
      const ct = Math.cos(th), st = Math.sin(th);
      return [c[0] + (u[0]*ct + v[0]*st)*r, c[1] + (u[1]*ct + v[1]*st)*r, c[2] + (u[2]*ct + v[2]*st)*r];
    },
    axis(s){ const k = spline(joints, s*this.n); return [k[0], k[1], k[2]]; } };
}
function normalAt(part, s, th){
  const h = 6e-4, p = part.at(s, th);
  const ds = sub(part.at(Math.min(1, s+h), th), part.at(Math.max(0, s-h), th));
  const dt = sub(part.at(s, th+h), part.at(s, th-h));
  let n = unit(cross(dt, ds));
  if (dot3(n, sub(p, part.axis(s))) < 0) n = [-n[0], -n[1], -n[2]];
  return n;
}

// Естественная стойка: одна нога чуть впереди. В профиль совмещённые ноги
// сливаются в один столб, и человек стоит как оловянный солдатик.
const shift = (joints, dz) => joints.map(j => [j[0], j[1], j[2]+dz, j[3]]);

export const PARTS = () => ({
  torso: stack(TORSO_KEYS), head: stack(HEAD_KEYS, NOSE),
  rarm: tube(shift(arm(-1), -.016)), larm: tube(shift(arm(1), .014)),
  rleg: tube(shift(leg(-1), -.020)), lleg: tube(shift(leg(1),  .024)),
});

// ---- живот ------------------------------------------------------------------
// Купол на передней стенке торса. По высоте — колокол вокруг пупка, по окружности
// узкий: бока и поясница остаются чистыми, иначе «жир на боках или на животе»
// сливается в одно пятно и не читается.
const BELLY = { y:.580, sy:.052, p:2.6, cm:0.00508, sag:0.20 };   // cm: доля роста на 1 кг
export const bellyRise = kg => BELLY.cm * kg;
function bellyAt(y, th, A){
  const yc = BELLY.y - BELLY.sag * A;                // чем крупнее живот, тем ниже свисает
  const fy = Math.exp(-Math.pow((y - yc)/BELLY.sy, 2));
  const c = Math.max(0, Math.sin(th));
  return A * fy * Math.pow(c, BELLY.p);
}

// ============================ камера =========================================
export const ROT = 1.30, TILT = 0.14;      // ~75°: живот виден только сбоку — как и в жизни

function camera(rot, tilt){
  const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
  return {
    p(v){ const x1 = v[0]*cr + v[2]*sr, z1 = -v[0]*sr + v[2]*cr;
          return { x:x1, y:v[1]*ct - z1*st, z:v[1]*st + z1*ct }; },
    nz(v){ const z1 = -v[0]*sr + v[2]*cr; return v[1]*st + z1*ct; },
  };
}

// ======================= силуэт: маска → контур ===============================
function raster(mask, gw, gh, pts, res){
  let y0 = Infinity, y1 = -Infinity;
  const P = pts.map(p => [p.sx*res, p.sy*res]);
  for (const p of P){ if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const xs = [];
  for (let j = Math.max(0, Math.floor(y0)); j <= Math.min(gh-1, Math.ceil(y1)); j++){
    const y = j + 0.5; xs.length = 0;
    for (let k=0;k<P.length;k++){
      const a = P[k], b = P[(k+1) % P.length];
      if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (y-a[1])/(b[1]-a[1])*(b[0]-a[0]));
    }
    xs.sort((p,q) => p-q);
    for (let k=0;k+1<xs.length;k+=2){
      const i0 = Math.max(0, Math.ceil(xs[k]-0.5)), i1 = Math.min(gw-1, Math.floor(xs[k+1]-0.5));
      for (let i=i0;i<=i1;i++) mask[j*gw+i] = 1;
    }
  }
}
// стороны ячейки: 0 север, 1 восток, 2 юг, 3 запад
const MS = { 1:[[3,0]], 2:[[0,1]], 3:[[3,1]], 4:[[1,2]], 5:[[3,0],[1,2]], 6:[[0,2]], 7:[[3,2]],
             8:[[2,3]], 9:[[2,0]], 10:[[0,1],[2,3]], 11:[[2,1]], 12:[[1,3]], 13:[[1,0]], 14:[[0,3]] };
function march(mask, gw, gh){
  const side = (i,j,k) => k===0 ? [i+.5, j] : k===1 ? [i+1, j+.5] : k===2 ? [i+.5, j+1] : [i, j+.5];
  const key = p => (p[0]*2) + ',' + (p[1]*2);
  const from = new Map();
  for (let j=0;j<gh-1;j++) for (let i=0;i<gw-1;i++){
    const c = mask[j*gw+i] | mask[j*gw+i+1] << 1 | mask[(j+1)*gw+i+1] << 2 | mask[(j+1)*gw+i] << 3;
    const t = MS[c]; if (!t) continue;
    for (const [a,b] of t){ const pa = side(i,j,a), pb = side(i,j,b);
      if (!from.has(key(pa))) from.set(key(pa), { a:pa, b:pb }); }
  }
  const loops = [];
  while (from.size){
    const first = from.keys().next().value;
    let cur = from.get(first), loop = [cur.a];
    while (cur){ loop.push(cur.b); from.delete(key(cur.a)); cur = from.get(key(cur.b)); }
    if (loop.length > 12) loops.push(loop);
  }
  return loops;
}
function chaikin(loop, times){
  let p = loop;
  for (let t=0;t<times;t++){
    const q = [];
    for (let i=0;i<p.length;i++){
      const a = p[i], b = p[(i+1) % p.length];
      q.push([a[0]*.75+b[0]*.25, a[1]*.75+b[1]*.25], [a[0]*.25+b[0]*.75, a[1]*.25+b[1]*.75]);
    }
    p = q;
  }
  return p;
}
function rdp(p, eps){                        // прореживание Дугласа-Пекера
  const keep = new Uint8Array(p.length); keep[0] = keep[p.length-1] = 1;
  const st = [[0, p.length-1]];
  while (st.length){
    const [i0, i1] = st.pop(); if (i1 <= i0+1) continue;
    const a = p[i0], b = p[i1], dx = b[0]-a[0], dy = b[1]-a[1], L = Math.hypot(dx,dy) || 1;
    let best = -1, bi = -1;
    for (let i=i0+1;i<i1;i++){
      const d = Math.abs(dy*(p[i][0]-a[0]) - dx*(p[i][1]-a[1])) / L;
      if (d > best){ best = d; bi = i; }
    }
    if (best > eps){ keep[bi] = 1; st.push([i0, bi], [bi, i1]); }
  }
  return p.filter((_, i) => keep[i]);
}

// ============================ отрисовка ======================================
const f1 = n => (Math.round(n*10)/10).toString();
const poly = r => 'M' + r.map(q => f1(q.sx)+' '+f1(q.sy)).join('L');

function runs(pts, isClosed){                // разбить контур на классы линий
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
 *   width,height,scale,cx,footY — холст и посадка фигуры (обязательные)
 *   view       — [x,y,w,h] viewBox: обрезка холста по самой фигуре
 *   excessKg   — жир сверх нормы, кг: задаёт и высоту живота, и число точек
 *   seed       — зерно, чтобы точки не «дышали» между сборками
 *   rot, tilt, colors, dotR, rings, uid, aria
 * Возвращает { svg, dots } — dots это фактическое число точек.
 */
export function figure(o){
  for (const k of ['width','height','scale','cx','footY'])
    if (typeof o[k] !== 'number') throw new Error('figure(): не задан ' + k);
  const W = o.width, H = o.height, S = o.scale, CX = o.cx, FY = o.footY;
  const cam = camera(o.rot ?? ROT, o.tilt ?? TILT);
  const R = rng(o.seed ?? 7);
  const parts = PARTS();
  const kg = o.excessKg || 0, A = bellyRise(kg);

  const px = q => ({ sx: CX + S*q.x, sy: FY - S*q.y, z: q.z });
  const RIM = o.rim ?? 0.40;
  const P = (p, n) => { const q = px(cam.p(p)); const d = cam.nz(n);
    q.cls = d <= 0 ? 0 : (d < RIM ? 2 : 1); return q; };

  // ---- кольца поверхности: маска силуэта и поперечные сечения ----
  const NT = 40, group = {}, sections = [];
  const depth = {};
  for (const [name, part] of Object.entries(parts)){
    const steps = part.kind === 'stack' ? 44 : 34;
    const own = group[name] = [];
    let dz = 0;
    const prev = [];
    for (let i=0;i<=steps;i++){
      const s = i/steps, ring = [];
      for (let t=0;t<NT;t++){ const th = t/NT*TAU; ring.push(px(cam.p(part.at(s, th)))); }
      own.push(ring);
      if (prev.length) for (let t=0;t<NT;t++)          // перемычки между кольцами
        own.push([prev[t], ring[t], ring[(t+1)%NT], prev[(t+1)%NT]]);
      prev.length = 0; prev.push(...ring);
      dz += cam.p(part.axis(s)).z;
    }
    depth[name] = dz/(steps+1);
    const nSec = o.rings ?? 0;   // поперечные сечения выключены: в профиль они читались рёбрами
    for (let i=1;i<=nSec;i++){
      const s = i/(nSec+1), ring = [];
      for (let t=0;t<=NT;t++){ const th = t/NT*TAU;
        ring.push(P(part.at(s, th), normalAt(part, s, th))); }
      const r = runs(ring, false);
      sections.push(...r[1], ...r[2]);
    }
  }

  const res = 2;                              // ячейка маски — полпикселя холста
  const gw = Math.ceil(W*res)+1, gh = Math.ceil(H*res)+1;
  const bb = [1e9, 1e9, -1e9, -1e9];
  const grow = (x, y) => { if (x<bb[0]) bb[0]=x; if (y<bb[1]) bb[1]=y;
                           if (x>bb[2]) bb[2]=x; if (y>bb[3]) bb[3]=y; };
  const trace = names => {
    const mask = new Uint8Array(gw*gh);
    for (const n of names) for (const p of group[n]) raster(mask, gw, gh, p, res);
    return march(mask, gw, gh)
      .map(l => rdp(chaikin(l, 3).map(p => [(p[0]+.5)/res, (p[1]+.5)/res]), 0.28))
      .filter(l => l.length > 6)
      .map(l => { l.forEach(p => grow(p[0], p[1]));
        return 'M' + l.map(p => f1(p[0])+' '+f1(p[1])).join('L') + 'Z'; }).join('');
  };

  // Порядок как у художника, от дальнего к ближнему. Раньше контуры всех
  // деталей рисовались поверх заливки — дальняя рука просвечивала сквозь
  // корпус, и фигура превращалась в клубок линий.
  const legs = ['rleg','lleg'].sort((a,b) => depth[a] - depth[b]);
  const arms = ['rarm','larm'].sort((a,b) => depth[a] - depth[b]);
  const behind = [
    { d: trace([legs[0]]), far:true }, { d: trace([legs[1]]), far:false },
    { d: trace([arms[0]]), far:true },
  ];
  const bodyPath = trace(['torso','head', arms[1]]);
  const armEdge = trace([arms[1]]);

  // ---- живот точками ----
  // Выборка по высоте купола: гуще там, где живот толще. Точка кладётся между
  // эталонной поверхностью и куполом, чуть ближе к куполу — так виден его край.
  const dotsFront = [], dotsBack = [];
  const n = Math.round(kg*1000/DOT_G);
  const torso = parts.torso, TY0 = TORSO_KEYS[0][0], TY1 = TORSO_KEYS[TORSO_KEYS.length-1][0];
  for (let i=0;i<n;i++){
    let s, th, rise;
    for (let g=0;g<64;g++){
      s = R(); th = R()*TAU;
      rise = bellyAt(TY0 + s*(TY1-TY0), th, A);
      if (R() < rise/(A || 1) || g === 63) break;
    }
    const p = torso.at(s, th), nv = normalAt(torso, s, th);
    const d = rise * Math.pow(R(), 0.40);   // гуще у поверхности купола — виден его край
    const q = px(cam.p([p[0]+nv[0]*d, p[1]+nv[1]*d, p[2]+nv[2]*d]));
    const dep = Math.max(0, Math.min(1, (q.z + 0.25)/0.5));
    const r = (o.dotR ?? 1.8) * (0.76 + 0.28*dep);
    grow(q.sx - r, q.sy - r); grow(q.sx + r, q.sy + r);
    (cam.nz(nv) > 0 ? dotsFront : dotsBack)
      .push(`<circle cx="${f1(q.sx)}" cy="${f1(q.sy)}" r="${Math.round(r*100)/100}"/>`);
  }

  // ---- пол ----
  const floor = 'M' + Array.from({length:48}, (_,i) => {
    const th = i/48*TAU;
    return px(cam.p([Math.cos(th)*.145, 0.004, Math.sin(th)*.145]));
  }).map(q => f1(q.sx)+' '+f1(q.sy)).join('L') + 'Z';

  const C = o.colors || {};
  const cLine = C.line || '#3d5464', cRim = C.rim || '#8fb4c9', cDot = C.dot || '#fbbf24';
  const cF0 = C.fill0 || '#1e262c', cF1 = C.fill1 || '#0b0e10', cDeep = C.deep || '#0e1316';
  const uid = o.uid || 'b';
  const V = o.view || [0, 0, W, H];

  const secPath = sections.length
    ? `<g fill="none" stroke="${cLine}" stroke-width=".85" stroke-opacity=".5" stroke-linecap="round"><path d="${sections.map(poly).join('')}"/></g>` : '';

  const body = behind.map(L => L.d
    ? `<path d="${L.d}" fill="${L.far ? cDeep : `url(#g-${uid})`}" stroke="${cLine}" stroke-width="1" stroke-opacity="${L.far ? .7 : 1}" stroke-linejoin="round"/>` : '').join('\n')
  + `\n<path d="${bodyPath}" fill="url(#g-${uid})"/>`
  + `\n<clipPath id="c-${uid}"><path d="${bodyPath}"/></clipPath>`
  + `\n<path d="${armEdge}" fill="none" stroke="${cLine}" stroke-width=".95" stroke-opacity=".55" stroke-linejoin="round" clip-path="url(#c-${uid})"/>`
  + `\n<path d="${bodyPath}" fill="none" stroke="${cRim}" stroke-width="1.5" stroke-linejoin="round"/>`;

  const svg = `<svg viewBox="${V.join(' ')}" width="100%" role="img" aria-label="${o.aria||''}" style="display:block;">
<defs><linearGradient id="g-${uid}" gradientUnits="userSpaceOnUse" x1="${(V[0]+V[2]*0.14).toFixed(1)}" y1="0" x2="${(V[0]+V[2]*0.82).toFixed(1)}" y2="0">
<stop offset="0" stop-color="${cF0}"/><stop offset=".72" stop-color="${cF1}"/><stop offset="1" stop-color="${cF1}"/></linearGradient></defs>
<path d="${floor}" fill="none" stroke="#1e1e1e" stroke-width="1" stroke-dasharray="3 5"/>
<g fill="${cDot}" fill-opacity=".22">${dotsBack.join('')}</g>
${body}
${secPath}
<g fill="${cDot}" fill-opacity=".95">${dotsFront.join('')}</g>
</svg>`;
  return { svg, dots: n, bbox: bb };
}
