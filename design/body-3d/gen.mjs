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
  [0.470, .092, .062, -.008, 2.05],
  [0.505, .104, .070, -.016, 2.05],   // таз, ягодицы назад
  [0.542, .097, .064, -.010, 2.00],
  [0.578, .085, .056, -.002, 1.95],
  [0.612, .078, .050,  .003, 1.95],   // талия
  [0.652, .085, .056,  .001, 2.00],
  [0.694, .094, .062, -.002, 2.05],
  [0.734, .100, .065, -.004, 2.05],   // грудь
  [0.772, .106, .060, -.008, 2.05],
  [0.800, .114, .053, -.012, 2.00],
  [0.818, .116, .046, -.014, 1.95],   // плечевой пояс
  [0.832, .098, .041, -.016, 1.90],
  [0.842, .070, .037, -.017, 1.85],
  [0.850, .048, .034, -.018, 1.80],   // сход в шею
];
const HEAD_KEYS = [
  [0.818, .036, .037, -.016, 1.90],   // шея начинается ниже плеч и видна над ними
  [0.856, .035, .037, -.014, 1.90],
  [0.872, .040, .046, -.008, 2.00],   // подбородок
  [0.890, .046, .054, -.003, 2.05],
  [0.914, .048, .058,  .000, 2.05],   // скулы: ширина головы 15,5 см
  [0.944, .047, .056, -.002, 2.00],
  [0.970, .041, .048, -.004, 1.95],
  [0.990, .028, .033, -.006, 1.90],
  [1.000, .011, .013, -.006, 1.90],
];
// Нос. Мелочь, но именно он превращает овал в голову и задаёт, куда человек
// смотрит: без него фигура в профиль читается манекеном.
const NOSE = (y, th) => 0.015 * Math.exp(-Math.pow((y-0.908)/0.016, 2))
                             * Math.pow(Math.max(0, Math.sin(th)), 8);
// конечности: опорные точки осевой линии и радиус в каждой
// Руки отведены на 30° — как на бланке. При меньшем отводе слой жира на торсе
// смыкается со слоем на руке, и подмышка заливается сплошным клином.
const arm = s => [
  [s*.090, .828, -.010, .018],
  [s*.100, .800, -.010, .036],   // дельта
  [s*.145, .722, -.008, .030],   // плечо, обхват 33 см
  [s*.192, .642, -.005, .026],   // локоть
  [s*.234, .570, -.001, .026],   // предплечье полнее локтя — иначе рука палка
  [s*.268, .512,  .003, .019],
  [s*.284, .484,  .006, .016],   // запястье, обхват 17 см
  [s*.296, .460,  .009, .018],   // кисть
  [s*.306, .438,  .011, .012],
  [s*.311, .428,  .012, .006],
];
const leg = s => [
  [s*.054, .500,  .000, .053],
  [s*.056, .458,  .002, .056],   // верх бедра — самое толстое место ноги
  [s*.058, .400,  .003, .052],
  [s*.060, .330,  .004, .042],
  [s*.062, .284,  .002, .036],   // колено
  [s*.063, .230, -.004, .039],   // икра
  [s*.064, .170, -.008, .034],
  [s*.064, .108, -.010, .025],
  [s*.064, .052, -.006, .020],   // щиколотка
  [s*.064, .020, -.018, .021],   // пятка
  [s*.064, .010,  .046, .014],   // носок
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

// ---- слой жира --------------------------------------------------------------
// Жир лежит СЛОЕМ поверх эталонного тела: толще всего на животе, заметно на
// боках («ушки»), тонкой манжетой на руках и бёдрах. Средняя толщина зоны —
// её масса, делённая на её площадь, как ореол в виджете «Состав по зонам»
// (medcard_profile.js, segGlow), по тем же площадям.
export const SEGAREA = { torso:46691, larm:13039, rarm:12864, lleg:22637, rleg:22894 };
// Толщина слоя зоны ∝ масса / площадь — строго, как ореол в «Составе по зонам».
// Сжимать шкалу больше не нужно: тонкий слой на руке виден не толщиной, а ЦВЕТОМ
// узла сетки, поэтому пропорции остаются честными.
const K_LAYER = 98, EXP = 1.0;              // строгая пропорция: масса зоны на её площадь
const ZONE_OF = { torso:'torso', larm:'larm', rarm:'rarm', lleg:'lleg', rleg:'rleg' };

const bell = (v,c,w) => Math.exp(-((v-c)*(v-c))/(2*w*w));
// Живот СВИСАЕТ: вверх к рёбрам сходит плавно, вниз к паху обрывается коротко,
// самая полная точка ниже пупка. Симметричный колокол давал ровный конус —
// «пирамиду», а не нависающий живот.
const sag = y => y > .562 ? bell(y,.562,.070) : bell(y,.562,.040);
// Слой не должен быть остро сосредоточен на животе: при большом отношении
// «пик к среднему» приходится или раздувать живот, или терять руки. Держим
// отношение около двух — тогда и живот виден, и манжета на руке не исчезает,
// и слой не смыкает подмышку.
// Кверху слой сходит: на груди и плечах подкожного жира мало, и без этого
// он смыкается с рукой у подмышки.
const capY = y => y < .620 ? 1 : Math.max(0.14, 1 - (y-.620)/0.13*0.86);
function torsoShape(y, th){
  const front = Math.pow(Math.max(0, Math.sin(th)), 1.8);    // живот идёт вперёд, а не вширь
  const side  = Math.pow(Math.abs(Math.cos(th)), 2.6);
  return capY(y) * (0.25 + 2.20*sag(y)*(0.32 + 0.68*front)
                        + 0.26*bell(y,.600,.036)*side);      // «ушки» чуть выше живота
}
const TORSO_MEAN = (() => {                 // нормировка: средняя по площади = 1
  let sum = 0, n = 0;
  for (let i=0;i<40;i++) for (let j=0;j<40;j++){
    sum += torsoShape(0.472 + (i+.5)/40*(0.850-0.472), (j+.5)/40*TAU); n++;
  }
  return sum/n;
})();
// Кисть и стопа не полнеют — манжета сходит на нет к концу конечности.
const limbTaper = s => Math.min(1, Math.max(0, (0.86 - s) / 0.16));

function makeFat(parts, zones){
  const t = {};
  for (const k of Object.keys(ZONE_OF)) t[k] = (zones[k] > 0) ? K_LAYER * Math.pow(zones[k]/SEGAREA[k], EXP) : 0;
  const wrap = (part, name) => ({
    kind: part.kind, n: part.n,
    thick(s, th){
      if (name === 'head') return 0;
      if (name === 'torso') return t.torso * torsoShape(0.472 + s*(0.850-0.472), th) / TORSO_MEAN;
      return t[name] * limbTaper(s);
    },
    at(s, th){
      const p = part.at(s, th), d = this.thick(s, th);
      if (!d) return p;
      const nv = normalAt(part, s, th);
      return [p[0]+nv[0]*d, p[1]+nv[1]*d, p[2]+nv[2]*d];
    },
    axis: s => part.axis(s),
  });
  const out = {};
  for (const [name, part] of Object.entries(parts)) out[name] = wrap(part, name);
  return out;
}

// ============================ камера =========================================
export const ROT = 0.32, TILT = 0.12;      // ~18°: поза бланка, руки в стороны.
// Разворот сильнее ломает позу: руки уходят на корпус. В фас выпуклость живота
// идёт на зрителя и в силуэте не видна — в силуэте читается боковая толщина
// слоя, а «где именно» договаривают подписи зон, как в текущем виджете.

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
 *   zones      — жир сверх нормы по зонам бланка, кг: {torso,larm,rarm,lleg,rleg}
 *   seed       — зерно, чтобы точки не «дышали» между сборками
 *   rot, tilt, colors, dotR, uid, aria
 * Возвращает { svg, dots, bbox }.
 */
export function figure(o){
  for (const k of ['width','height','scale','cx','footY'])
    if (typeof o[k] !== 'number') throw new Error('figure(): не задан ' + k);
  const W = o.width, H = o.height, S = o.scale, CX = o.cx, FY = o.footY;
  const cam = camera(o.rot ?? ROT, o.tilt ?? TILT);
  const R = rng(o.seed ?? 7);
  const parts = PARTS();
  const zones = o.zones || {};
  const fat = makeFat(parts, zones);
  const px = q => ({ sx: CX + S*q.x, sy: FY - S*q.y, z: q.z });

  // ---- оболочки: эталонное тело и оно же со слоем жира ----
  const NT = 40, group = {}, fgroup = {}, depth = {};
  const buildShell = (src, bag) => {
    for (const [name, part] of Object.entries(src)){
      const steps = part.kind === 'stack' ? 56 : 44;
      const own = bag[name] = [];
      let dz = 0; const prev = [];
      for (let i=0;i<=steps;i++){
        const s = i/steps, ring = [];
        for (let t=0;t<NT;t++) ring.push(px(cam.p(part.at(s, t/NT*TAU))));
        own.push(ring);
        if (prev.length) for (let t=0;t<NT;t++)        // перемычки между кольцами
          own.push([prev[t], ring[t], ring[(t+1)%NT], prev[(t+1)%NT]]);
        prev.length = 0; prev.push(...ring);
        dz += cam.p(part.axis(s)).z;
      }
      depth[name] = dz/(steps+1);
    }
  };
  buildShell(parts, group); buildShell(fat, fgroup);

  const res = 2;                              // ячейка маски — полпикселя холста
  const gw = Math.ceil(W*res)+1, gh = Math.ceil(H*res)+1;
  const bb = [1e9, 1e9, -1e9, -1e9];
  const grow = (x, y) => { if (x<bb[0]) bb[0]=x; if (y<bb[1]) bb[1]=y;
                           if (x>bb[2]) bb[2]=x; if (y>bb[3]) bb[3]=y; };
  const maskOf = (bag, names) => {
    const mask = new Uint8Array(gw*gh);
    for (const n of names) for (const p of bag[n]) raster(mask, gw, gh, p, res);
    return mask;
  };
  const pathOf = mask => {
    return march(mask, gw, gh)
      .map(l => rdp(chaikin(l, 4).map(p => [(p[0]+.5)/res, (p[1]+.5)/res]), 0.22))
      .filter(l => l.length > 6)
      .map(l => { l.forEach(p => grow(p[0], p[1]));
        return 'M' + l.map(p => f1(p[0])+' '+f1(p[1])).join('L') + 'Z'; }).join('');
  };
  const trace = (bag, names) => pathOf(maskOf(bag, names));

  // Порядок как у художника, от дальнего к ближнему: иначе дальняя рука
  // просвечивает сквозь корпус и фигура превращается в клубок линий.
  const ALL = ['torso','head','rarm','larm','rleg','lleg'];
  const legs = ['rleg','lleg'].sort((a,b) => depth[a] - depth[b]);
  const arms = ['rarm','larm'].sort((a,b) => depth[a] - depth[b]);
  const fatMask = maskOf(fgroup, ALL), bodyMask = maskOf(group, ALL);
  const fatPath = pathOf(fatMask);
  const ringMask = new Uint8Array(fatMask.length);
  for (let i=0;i<ringMask.length;i++) ringMask[i] = (fatMask[i] && !bodyMask[i]) ? 1 : 0;
  const ringPath = pathOf(ringMask);
  // Заливки — от дальнего к ближнему; общий контур — один яркий по всей фигуре;
  // стыки деталей — тихой линией внутри него. Раньше контур торса шёл поверх рук
  // и читался жилеткой.
  const bodyPath = trace(group, ALL);
  // Заливка ОДНА на всю фигуру: раньше корпус шёл градиентом, а ноги отдельным
  // тоном, и человек разваливался пополам по линии таза. Объём даёт не вырезанная
  // тёмная накладка дальних деталей (от неё нога выглядела оторванной), а
  // цилиндрическая светотень по каждой детали плюс контактная тень у ближних.
  // Только руки: контуры торса и ног внутри силуэта читались воротником и шортами.
  const seams = [arms[0], arms[1]].map(n => trace(group, [n])).join('');
  const zonePaths = Object.fromEntries(ALL.map(n => [n, trace(group, [n])]));
  const fzonePaths = Object.fromEntries(ALL.map(n => [n, trace(fgroup, [n])]));

  // ---- поверхность точками ----
  // Как суша на глобусе: не россыпь, а РЕГУЛЯРНАЯ сетка узлов по поверхности.
  // Узел лежит на теле со слоем жира, поэтому живот виден выпуклостью; цвет узла
  // говорит, сколько слоя под ним — от холодного (ничего) до янтарного.
  const STEP = o.step ?? 0.0205;              // шаг сетки в долях роста
  const T_REF = o.tRef ?? 0.065;              // толщина, при которой узел полностью янтарный
  const C0 = [0x7b,0x93,0xa6], C1 = [0xfb,0xbf,0x24];
  const NB = 6, buckets = Array.from({length:NB*2}, () => []);
  const hex = u => '#' + [0,1,2].map(i =>
    Math.round(C0[i] + (C1[i]-C0[i])*u).toString(16).padStart(2,'0')).join('');
  let total = 0;
  for (const [name, part] of Object.entries(parts)){
    const fpart = fat[name];
    // длина детали и её обхваты — чтобы шаг был один и тот же везде
    let len = 0; const N = 40;
    for (let i=0;i<N;i++) len += Math.hypot(...sub(part.axis((i+1)/N), part.axis(i/N)));
    if (part.kind === 'stack') len = Math.abs(part.axis(1)[1] - part.axis(0)[1]);
    const rows = Math.max(3, Math.round(len/STEP));
    for (let i=0;i<=rows;i++){
      const sp = i/rows;
      let circ = 0;
      for (let j=0;j<24;j++) circ += Math.hypot(...sub(fpart.at(sp, (j+1)/24*TAU), fpart.at(sp, j/24*TAU)));
      const cols = Math.max(4, Math.round(circ/STEP));
      for (let j=0;j<cols;j++){
        const th = (j + (i%2)*0.5)/cols*TAU;   // шахматный сдвиг — сетка не полосит
        const p = fpart.at(sp, th), nv = normalAt(part, sp, th);
        const q = px(cam.p(p)), front = cam.nz(nv) > 0;
        const t = fpart.thick(sp, th);
        const u = Math.pow(Math.max(0, Math.min(1, t / T_REF)), 0.65);  // тонкий слой тоже подкрашивает
        const b = Math.min(NB-1, Math.floor(u*NB));
        buckets[b + (front?0:NB)].push(`<circle cx="${f1(q.sx)}" cy="${f1(q.sy)}" r="${front ? (1.4 + 0.5*u) : 1.05}"/>`);
        if (front){ grow(q.sx-2, q.sy-2); grow(q.sx+2, q.sy+2); }
      }
    }
  }
  for (const [zone, kg] of Object.entries(zones)) total += Math.round((kg||0)*1000/DOT_G);
  const dotsFront = buckets.slice(0, NB).map((g, b) => g.length
    ? `<g fill="${hex((b+.5)/NB)}" fill-opacity="${(0.60 + 0.40*(b/(NB-1))).toFixed(2)}">${g.join('')}</g>` : '').join('');
  const dotsBack = buckets.slice(NB).map((g, b) => g.length
    ? `<g fill="${hex((b+.5)/NB)}" fill-opacity="${(0.16 + 0.16*(b/(NB-1))).toFixed(2)}">${g.join('')}</g>` : '').join('');

  // ---- тень под ногами ----
  const shadow = 'M' + Array.from({length:56}, (_,i) => {
    const th = i/56*TAU;
    return px(cam.p([Math.cos(th)*.165, 0.002, Math.sin(th)*.165]));
  }).map(q => f1(q.sx)+' '+f1(q.sy)).join('L') + 'Z';

  const C = o.colors || {};
  const cLine = C.line || '#435b6b', cRim = C.rim || '#9dbecf', cDot = C.dot || '#fbbf24';
  const cF0 = C.fill0 || '#42535f', cF1 = C.fill1 || '#2a353d', cF2 = C.fill2 || '#1b232a', cDeep = C.deep || '#10161a';
  const uid = o.uid || 'b';
  const V = o.view || [0, 0, W, H];
  const has = total > 0;

  const near = [zonePaths[arms[1]], zonePaths[legs[1]]].join('');
  const shade = ALL.map(n => `<path d="${fzonePaths[n]}" fill="url(#c-${uid})"/>`).join('');
  const shell = has ? fatPath : bodyPath;             // видимое тело — со слоем жира

  const svg = `<svg viewBox="${V.join(' ')}" width="100%" role="img" aria-label="${o.aria||''}" style="display:block;">
<defs>
<linearGradient id="g-${uid}" gradientUnits="userSpaceOnUse" x1="${(V[0]+V[2]*0.08).toFixed(1)}" y1="${V[1]}" x2="${(V[0]+V[2]*0.92).toFixed(1)}" y2="${(V[1]+V[3]*0.35).toFixed(1)}">
<stop offset="0" stop-color="${cF0}"/><stop offset=".42" stop-color="${cF1}"/><stop offset="1" stop-color="${cF2}"/></linearGradient>
<linearGradient id="c-${uid}" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".24" stop-color="#000" stop-opacity="0"/>
<stop offset=".60" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
<radialGradient id="s-${uid}"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<filter id="b-${uid}" x="-30%" y="-14%" width="160%" height="128%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="o-${uid}" x="-20%" y="-10%" width="140%" height="120%"><feGaussianBlur stdDeviation="3"/></filter>
<clipPath id="k-${uid}"><path d="${shell}"/></clipPath>
</defs>
<path d="${shadow}" fill="url(#s-${uid})"/>
${has ? `<path d="${fatPath}" fill="${cDot}" fill-opacity=".16" filter="url(#b-${uid})"/>` : ''}
<g>${dotsBack}</g>
<path d="${shell}" fill="url(#g-${uid})" fill-opacity=".9"/>
<g clip-path="url(#k-${uid})">${shade}</g>
<path d="${near}" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="6" filter="url(#o-${uid})" clip-path="url(#k-${uid})"/>
${has ? `<path d="${bodyPath}" fill="none" stroke="${cRim}" stroke-width="1" stroke-opacity=".5" stroke-dasharray="5 4" clip-path="url(#k-${uid})"/>` : ''}
<path d="${shell}" fill="none" stroke="${cRim}" stroke-width="5" stroke-opacity=".14" clip-path="url(#k-${uid})"/>
<path d="${shell}" fill="none" stroke="${cRim}" stroke-width="1.4" stroke-linejoin="round"/>
<g>${dotsFront}</g>
</svg>`;
  return { svg, dots: total, bbox: bb, paths: { body: bodyPath, fat: fatPath, ...zonePaths } };
}
