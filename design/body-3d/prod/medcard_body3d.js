/* Виджет «Состав тела 2» — точечная 3D-модель тела (05.09.2026, запрос Константина).
   ВТОРОЙ виджет, добавлен рядом с «Составом по зонам»; первый не тронут.

   Устройство то же, что у шара в разделе «Жизнь» (medcard_life.js): поверхность
   выложена РЕГУЛЯРНОЙ сеткой узлов, ортографическая проекция, дальняя сторона
   тусклее, фигуру можно крутить пальцем. Отличие одно: узел лежит не на сфере, а
   на поверхности тела СО СЛОЕМ ЖИРА, и цвет узла говорит, сколько слоя под ним —
   от холодного (слоя нет) до янтарного.

   Откуда норма. НЕ придумываем свою: на бланке у каждой зоны есть fat_pct —
   процент от нормы прибора. Избыток зоны = kg * (1 - 100/pct) при pct > 100.
   Границы нормы у DDX свои (пол, возраст, рост), и пересчитывать их нельзя.

   Толщина слоя зоны = масса, делённая на площадь зоны, — то же правило и те же
   площади SEGAREA, что у ореола в «Составе по зонам» (medcard_profile.js).

   Рисуем на canvas, а не в DOM: узлов около четырёх тысяч, столько <circle> в
   разметке страница не вывозит. Контур силуэта снимается marching squares с
   альфы вспомогательного канваса — собирать его из перекрывающихся многоугольников
   нельзя, правило nonzero выедает дырки в плечах.

   Фигура пока мужских пропорций для обоих полов — женский набор ключей отдельная
   задача, о чём сказано в подписи под карточкой. */
(function(){
  var C = { card:'#141414', deep:'#111', bd:'#262626', bd2:'#1e1e1e',
            tx:'#e8e8e8', tx2:'#8b8b8b', tx3:'#666', br:'#00a0ff', fat:'#fbbf24' };
  var TAU = Math.PI*2;
  var SEGZONES = ['torso','larm','rarm','lleg','rleg'];
  var SEGLBL = { larm:'Левая рука', rarm:'Правая рука', torso:'Торс',
                 lleg:'Левая нога', rleg:'Правая нога' };
  // площади зон на холсте бланка 470×893 — те же, что в medcard_profile.js
  var SEGAREA = { torso:46691, larm:13039, rarm:12864, lleg:22637, rleg:22894 };

  // ---------- мелкая векторная алгебра ----------
  function sub(a,b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function dot3(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function unit(a){ var l = Math.hypot(a[0],a[1],a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }

  // Катмулл-Ром по опорным точкам: без полки в каждой опоре, которую даёт
  // smoothstep — от неё торс выглядит стопкой шайб.
  function spline(keys, t){
    var n = keys.length, i = Math.max(0, Math.min(n-2, Math.floor(t)));
    var f = Math.max(0, Math.min(1, t - i));
    var p0 = keys[Math.max(0,i-1)], p1 = keys[i], p2 = keys[i+1], p3 = keys[Math.min(n-1,i+2)];
    var out = [];
    for (var k=0;k<p1.length;k++){
      var a = p1[k], b = p2[k], m1 = (p2[k]-p0[k])/2, m2 = (p3[k]-p1[k])/2;
      out.push(((2*a-2*b+m1+m2)*f + (-3*a+3*b-2*m1-m2))*f*f + m1*f + a);
    }
    return out;
  }

  // ---------- анатомия. Доли роста: y вверх от пола, x вправо, z вперёд ----------
  // [y, полуширина, полуглубина, смещение по глубине, показатель суперэллипса]
  var TORSO_KEYS = [
    [0.470, .092, .062, -.008, 2.05], [0.505, .104, .070, -.016, 2.05],
    [0.542, .097, .064, -.010, 2.00], [0.578, .085, .056, -.002, 1.95],
    [0.612, .078, .050,  .003, 1.95], [0.652, .085, .056,  .001, 2.00],
    [0.694, .094, .062, -.002, 2.05], [0.734, .100, .065, -.004, 2.05],
    [0.772, .106, .060, -.008, 2.05], [0.800, .114, .053, -.012, 2.00],
    [0.818, .116, .046, -.014, 1.95], [0.832, .098, .041, -.016, 1.90],
    [0.842, .070, .037, -.017, 1.85], [0.850, .048, .034, -.018, 1.80]
  ];
  var HEAD_KEYS = [
    [0.818, .036, .037, -.016, 1.90], [0.856, .035, .037, -.014, 1.90],
    [0.872, .040, .046, -.008, 2.00], [0.890, .046, .054, -.003, 2.05],
    [0.914, .048, .058,  .000, 2.05], [0.944, .047, .056, -.002, 2.00],
    [0.970, .041, .048, -.004, 1.95], [0.990, .028, .033, -.006, 1.90],
    [1.000, .011, .013, -.006, 1.90]
  ];
  // Нос. Мелочь, но именно он превращает овал в голову.
  function NOSE(y, th){
    return 0.015 * Math.exp(-Math.pow((y-0.908)/0.016, 2))
                 * Math.pow(Math.max(0, Math.sin(th)), 8);
  }
  // Руки отведены на 30°, как на бланке: при меньшем отводе слой жира на торсе
  // смыкается со слоем на руке и подмышка заливается сплошным клином.
  function arm(s){ return [
    [s*.090,.828,-.010,.018], [s*.100,.800,-.010,.036], [s*.145,.722,-.008,.030],
    [s*.192,.642,-.005,.026], [s*.234,.570,-.001,.026], [s*.268,.512,.003,.019],
    [s*.284,.484,.006,.016],  [s*.296,.460,.009,.018],  [s*.306,.438,.011,.012],
    [s*.311,.428,.012,.006] ]; }
  function leg(s){ return [
    [s*.054,.500,.000,.053], [s*.056,.458,.002,.056], [s*.058,.400,.003,.052],
    [s*.060,.330,.004,.042], [s*.062,.284,.002,.036], [s*.063,.230,-.004,.039],
    [s*.064,.170,-.008,.034],[s*.064,.108,-.010,.025], [s*.064,.052,-.006,.020],
    [s*.064,.020,-.018,.021],[s*.064,.010,.046,.014] ]; }
  // естественная стойка: одна нога чуть впереди
  function shiftZ(j, dz){ return j.map(function(p){ return [p[0], p[1], p[2]+dz, p[3]]; }); }

  function sePow(v, e){ var a = Math.abs(v); return (v<0?-1:1) * Math.pow(a, 2/e); }

  function stack(keys, bump){
    return { kind:'stack', n:keys.length-1,
      at:function(s, th){
        var k = spline(keys, s*this.n), c = Math.cos(th), sn = Math.sin(th);
        var b = bump ? bump(k[0], th) : 0;
        return [k[1]*sePow(c,k[4]), k[0], k[3] + k[2]*sePow(sn,k[4]) + b];
      },
      axis:function(s){ var k = spline(keys, s*this.n); return [0, k[0], k[3]]; } };
  }
  function tube(joints){
    return { kind:'tube', n:joints.length-1,
      at:function(s, th){
        var k = spline(joints, s*this.n), r = k[3], h = 0.004;
        var a = spline(joints, Math.max(0, s*this.n - h*this.n));
        var b = spline(joints, Math.min(this.n, s*this.n + h*this.n));
        var ax = unit([b[0]-a[0], b[1]-a[1], b[2]-a[2]]);
        var u = unit(cross(ax, [0,0,1])), v = cross(ax, u);
        var ct = Math.cos(th), st = Math.sin(th);
        return [k[0] + (u[0]*ct+v[0]*st)*r, k[1] + (u[1]*ct+v[1]*st)*r, k[2] + (u[2]*ct+v[2]*st)*r];
      },
      axis:function(s){ var k = spline(joints, s*this.n); return [k[0], k[1], k[2]]; } };
  }
  function normalAt(part, s, th){
    var h = 6e-4, p = part.at(s, th);
    var ds = sub(part.at(Math.min(1,s+h), th), part.at(Math.max(0,s-h), th));
    var dt = sub(part.at(s, th+h), part.at(s, th-h));
    var n = unit(cross(dt, ds));
    if (dot3(n, sub(p, part.axis(s))) < 0) n = [-n[0], -n[1], -n[2]];
    return n;
  }
  function PARTS(){
    return { torso:stack(TORSO_KEYS), head:stack(HEAD_KEYS, NOSE),
      rarm:tube(shiftZ(arm(-1), -.016)), larm:tube(shiftZ(arm(1), .014)),
      rleg:tube(shiftZ(leg(-1), -.020)), lleg:tube(shiftZ(leg(1),  .024)) };
  }

  // ---------- слой жира ----------
  var K_LAYER = 98;                     // толщина зоны = K * масса / площадь
  function bell(v,c,w){ return Math.exp(-((v-c)*(v-c))/(2*w*w)); }
  // Живот СВИСАЕТ: вверх к рёбрам сходит плавно, вниз к паху обрывается вдвое
  // короче. Симметричный колокол давал ровный конус, а не нависающий живот.
  function sag(y){ return y > .562 ? bell(y,.562,.070) : bell(y,.562,.040); }
  // Кверху слой сходит: на груди и плечах подкожного жира мало, и без этого он
  // смыкается с рукой у подмышки.
  function capY(y){ return y < .620 ? 1 : Math.max(0.14, 1 - (y-.620)/0.13*0.86); }
  function torsoShape(y, th){
    var front = Math.pow(Math.max(0, Math.sin(th)), 1.8);
    var side  = Math.pow(Math.abs(Math.cos(th)), 2.6);
    return capY(y) * (0.25 + 2.20*sag(y)*(0.32 + 0.68*front)
                          + 0.26*bell(y,.600,.036)*side);
  }
  var TORSO_MEAN = (function(){
    var sum = 0, n = 0;
    for (var i=0;i<40;i++) for (var j=0;j<40;j++){
      sum += torsoShape(0.472 + (i+.5)/40*(0.850-0.472), (j+.5)/40*TAU); n++;
    }
    return sum/n;
  })();
  function limbTaper(s){ return Math.min(1, Math.max(0, (0.86 - s)/0.16)); }

  function makeFat(parts, zones){
    var t = {}, out = {};
    SEGZONES.forEach(function(k){ t[k] = K_LAYER * ((zones[k] || 0) / SEGAREA[k]); });
    Object.keys(parts).forEach(function(name){
      var part = parts[name];
      out[name] = {
        kind: part.kind, n: part.n,
        thick: function(s, th){
          if (name === 'head') return 0;
          if (name === 'torso') return t.torso * torsoShape(0.472 + s*(0.850-0.472), th) / TORSO_MEAN;
          return (t[name] || 0) * limbTaper(s);
        },
        at: function(s, th){
          var p = part.at(s, th), d = this.thick(s, th);
          if (!d) return p;
          var nv = normalAt(part, s, th);
          return [p[0]+nv[0]*d, p[1]+nv[1]*d, p[2]+nv[2]*d];
        },
        axis: function(s){ return part.axis(s); }
      };
    });
    return out;
  }

  // ---------- камера ----------
  var TILT = 0.12;
  function camera(rot){
    var cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(TILT), st = Math.sin(TILT);
    return {
      p:function(v){ var x1 = v[0]*cr + v[2]*sr, z1 = -v[0]*sr + v[2]*cr;
        return { x:x1, y:v[1]*ct - z1*st, z:v[1]*st + z1*ct }; },
      nz:function(v){ var z1 = -v[0]*sr + v[2]*cr; return v[1]*st + z1*ct; }
    };
  }

  // ---------- контур силуэта: marching squares по альфе ----------
  // Стороны ячейки: 0 север, 1 восток, 2 юг, 3 запад.
  var MS = { 1:[[3,0]], 2:[[0,1]], 3:[[3,1]], 4:[[1,2]], 5:[[3,0],[1,2]], 6:[[0,2]],
             7:[[3,2]], 8:[[2,3]], 9:[[2,0]], 10:[[0,1],[2,3]], 11:[[2,1]], 12:[[1,3]],
             13:[[1,0]], 14:[[0,3]] };
  function march(mask, gw, gh){
    function side(i,j,k){ return k===0?[i+.5,j] : k===1?[i+1,j+.5] : k===2?[i+.5,j+1] : [i,j+.5]; }
    function key(p){ return (p[0]*2)+','+(p[1]*2); }
    var from = new Map(), i, j;
    for (j=0;j<gh-1;j++) for (i=0;i<gw-1;i++){
      var c = mask[j*gw+i] | mask[j*gw+i+1]<<1 | mask[(j+1)*gw+i+1]<<2 | mask[(j+1)*gw+i]<<3;
      var t = MS[c]; if (!t) continue;
      for (var q=0;q<t.length;q++){
        var pa = side(i,j,t[q][0]), pb = side(i,j,t[q][1]);
        if (!from.has(key(pa))) from.set(key(pa), { a:pa, b:pb });
      }
    }
    var loops = [];
    while (from.size){
      var first = from.keys().next().value, cur = from.get(first), loop = [cur.a];
      while (cur){ loop.push(cur.b); from.delete(key(cur.a)); cur = from.get(key(cur.b)); }
      if (loop.length > 12) loops.push(loop);
    }
    return loops;
  }
  function chaikin(loop, times){
    var p = loop, t, i, q;
    for (t=0;t<times;t++){
      q = [];
      for (i=0;i<p.length;i++){
        var a = p[i], b = p[(i+1)%p.length];
        q.push([a[0]*.75+b[0]*.25, a[1]*.75+b[1]*.25], [a[0]*.25+b[0]*.75, a[1]*.25+b[1]*.75]);
      }
      p = q;
    }
    return p;
  }

  // ---------- отрисовка ----------
  var ST = { rot:0.32, zones:null, dpr:1 };

  function draw(cv, zones, rot){
    var w = cv.width / ST.dpr, h = cv.height / ST.dpr;
    var ctx = cv.getContext('2d');
    ctx.setTransform(ST.dpr,0,0,ST.dpr,0,0);
    ctx.clearRect(0,0,w,h);

    var S = h * 0.90, CX = w/2, FY = h*0.965;      // рост фигуры и посадка
    var cam = camera(rot), parts = PARTS(), fat = makeFat(parts, zones);
    var names = Object.keys(parts);
    var has = SEGZONES.some(function(k){ return (zones[k]||0) > 0; });
    function px(q){ return { x: CX + S*q.x, y: FY - S*q.y, z: q.z }; }

    // оболочки кольцами: рисуем кольца часто, чтобы объединение не давало зазубрин
    function shell(src, name, into){
      var part = src[name], rows = part.kind === 'stack' ? 110 : 90, NT = 44, i, t;
      var poly = [];
      for (i=0;i<=rows;i++){
        var ring = [];
        for (t=0;t<NT;t++) ring.push(px(cam.p(part.at(i/rows, t/NT*TAU))));
        poly.push(ring);
      }
      into[name] = poly;
      return poly;
    }
    var shells = {}, fshells = {};
    names.forEach(function(n){ shell(parts, n, shells); shell(fat, n, fshells); });

    // Каждое кольцо — своя заливка: в одном path противоположный обход вычел бы
    // одно из другого по правилу nonzero, и в плечах появились бы прорези.
    function fillShell(c, polys, style){
      c.fillStyle = style;
      polys.forEach(function(ring){
        c.beginPath();
        c.moveTo(ring[0].x, ring[0].y);
        for (var i=1;i<ring.length;i++) c.lineTo(ring[i].x, ring[i].y);
        c.closePath(); c.fill();
      });
    }

    // силуэт снимаем с альфы вспомогательного канваса
    function outline(bag){
      var oc = document.createElement('canvas');
      oc.width = Math.ceil(w); oc.height = Math.ceil(h);
      var oo = oc.getContext('2d');
      names.forEach(function(n){ fillShell(oo, bag[n], '#fff'); });
      var d = oo.getImageData(0,0,oc.width,oc.height).data;
      var gw = oc.width, gh = oc.height, m = new Uint8Array(gw*gh);
      for (var i=0;i<gw*gh;i++) m[i] = d[i*4+3] > 128 ? 1 : 0;
      var p = new Path2D();
      march(m, gw, gh).forEach(function(loop){
        var s = chaikin(loop, 3);
        if (s.length < 8) return;
        p.moveTo(s[0][0]+.5, s[0][1]+.5);
        for (var i=1;i<s.length;i++) p.lineTo(s[i][0]+.5, s[i][1]+.5);
        p.closePath();
      });
      return p;
    }
    var bodyOut = outline(shells), fatOut = has ? outline(fshells) : bodyOut;

    // тень под ногами
    var sh = ctx.createRadialGradient(CX, FY, 0, CX, FY, S*0.20);
    sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(CX, FY, S*0.19, S*0.045, 0, 0, TAU); ctx.fill();

    // свечение слоя
    if (has){
      ctx.save();
      ctx.shadowColor = 'rgba(251,191,36,.55)'; ctx.shadowBlur = 22;
      ctx.fillStyle = 'rgba(251,191,36,.16)';
      ctx.fill(fatOut); ctx.fill(fatOut);
      ctx.restore();
    }

    // тело: одна заливка на всю фигуру, иначе человек разваливается по линии таза
    var g = ctx.createLinearGradient(CX - S*0.22, 0, CX + S*0.26, h*0.35);
    g.addColorStop(0, '#42535f'); g.addColorStop(.42, '#2a353d'); g.addColorStop(1, '#1b232a');
    ctx.save();
    ctx.fillStyle = g; ctx.fill(fatOut);
    // цилиндрическая светотень по каждой детали
    ctx.clip(fatOut);
    names.forEach(function(n){
      var polys = fshells[n], x0 = 1e9, x1 = -1e9;
      polys.forEach(function(r){ r.forEach(function(q){ if(q.x<x0)x0=q.x; if(q.x>x1)x1=q.x; }); });
      if (x1 - x0 < 2) return;
      var cg = ctx.createLinearGradient(x0, 0, x1, 0);
      cg.addColorStop(0,'rgba(0,0,0,.34)'); cg.addColorStop(.24,'rgba(0,0,0,0)');
      cg.addColorStop(.60,'rgba(0,0,0,0)'); cg.addColorStop(1,'rgba(0,0,0,.42)');
      fillShell(ctx, polys, cg);
    });
    ctx.restore();

    // контур нормы пунктиром: каким тело было бы без лишнего
    if (has){
      ctx.save(); ctx.clip(fatOut);
      ctx.setLineDash([5,4]); ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(157,190,207,.5)'; ctx.stroke(bodyOut);
      ctx.restore();
    }
    // кромка
    ctx.save(); ctx.clip(fatOut);
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(157,190,207,.14)'; ctx.stroke(fatOut);
    ctx.restore();
    ctx.lineWidth = 1.4; ctx.strokeStyle = '#9dbecf'; ctx.lineJoin = 'round'; ctx.stroke(fatOut);

    // ---------- узлы сетки ----------
    // Шаг один и тот же по всей поверхности, ряды сдвинуты в шахматном порядке —
    // иначе сетка полосит. Дальняя сторона тусклее и мельче, как суша на шаре.
    var STEP = 0.0132, T_REF = 0.065, C0 = [0x7b,0x93,0xa6], C1 = [0xfb,0xbf,0x24];
    var back = [], front = [];
    names.forEach(function(name){
      var part = parts[name], fp = fat[name], i, j;
      var len = part.kind === 'stack'
        ? Math.abs(part.axis(1)[1] - part.axis(0)[1])
        : (function(){ var L=0; for (var k=0;k<40;k++) L += Math.hypot.apply(null, sub(part.axis((k+1)/40), part.axis(k/40))); return L; })();
      var rows = Math.max(3, Math.round(len/STEP));
      for (i=0;i<=rows;i++){
        var sp = i/rows, circ = 0;
        for (j=0;j<24;j++) circ += Math.hypot.apply(null, sub(fp.at(sp,(j+1)/24*TAU), fp.at(sp,j/24*TAU)));
        var cols = Math.max(4, Math.round(circ/STEP));
        for (j=0;j<cols;j++){
          var th = (j + (i%2)*0.5)/cols*TAU;
          var q = px(cam.p(fp.at(sp, th))), nv = normalAt(part, sp, th);
          var u = Math.pow(Math.max(0, Math.min(1, fp.thick(sp, th)/T_REF)), 0.65);
          (cam.nz(nv) > 0 ? front : back).push([q.x, q.y, u]);
        }
      }
    });
    function paint(list, rBase, aBase, aSpan){
      list.forEach(function(d){
        var u = d[2];
        var col = 'rgb(' + Math.round(C0[0]+(C1[0]-C0[0])*u) + ','
                         + Math.round(C0[1]+(C1[1]-C0[1])*u) + ','
                         + Math.round(C0[2]+(C1[2]-C0[2])*u) + ')';
        ctx.globalAlpha = aBase + aSpan*u;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(d[0], d[1], rBase + (rBase>1.0 ? 0.45*u : 0), 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    // Дальние узлы должны просвечивать сквозь тело, но заливка непрозрачная,
    // поэтому кладём их поверх с малой альфой — тот же приём, что у шара.
    paint(back, 0.8, 0.13, 0.12);
    paint(front, 1.05, 0.55, 0.45);
  }

  // ---------- карточка ----------
  var CARD = 'background:'+C.card+';border:1px solid '+C.bd+
             ';border-radius:var(--ui-card-radius,12px);padding:var(--ui-card-pad,20px);';
  var MONO = 'font-variant-numeric:tabular-nums;';
  var RULER = 'm21.3 8.7-12.6 12.6a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4zM7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2';
  function ico(d,s){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '+
    'stroke-linecap="round" stroke-linejoin="round" style="width:'+(s||16)+'px;height:'+(s||16)+'px;flex-shrink:0;">'+
    '<path d="'+d+'"/></svg>'; }
  function ru(n){ return (Math.round(n*10)/10).toFixed(1).replace('.', ','); }

  function label(z, kg, top, right){
    var warm = kg > 0.049;
    return '<div style="position:absolute;'+(right?'right':'left')+':0;top:'+top+'px;width:86px;display:flex;'+
      'flex-direction:column;gap:2px;align-items:flex-'+(right?'start':'end')+';text-align:'+(right?'left':'right')+';">'+
      '<div style="font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:'+C.tx2+';line-height:1.2;">'+
      SEGLBL[z].toUpperCase()+'</div>'+
      (warm
        ? '<div style="font-size:15px;font-weight:700;'+MONO+'color:'+C.fat+';">'+ru(kg)+
          '<span style="font-size:10.5px;font-weight:400;color:'+C.tx2+';"> кг</span></div>'+
          '<span style="font-size:9px;color:'+C.tx3+';">сверх нормы</span>'
        : '<div style="font-size:14px;font-weight:700;color:'+C.tx3+';">в норме</div>')+
      '</div>';
  }

  // window.body3d(rows, segs) — зовётся из loadWeight() в medcard_profile.js
  window.body3d = function(rows, segs){
    var host = document.getElementById('body3d');
    if (!host) return;
    segs = segs || [];
    if (!segs.length){ host.innerHTML=''; return; }
    var date = segs.map(function(s){ return s.date; }).sort().slice(-1)[0];
    var cur = {};
    segs.filter(function(s){ return s.date === date; }).forEach(function(s){ cur[s.zone] = s; });

    // Избыток зоны берём из процента с бланка: прибор знает свою норму, мы нет.
    var zones = {}, totalExcess = 0, haveAny = false;
    SEGZONES.forEach(function(z){
      var s = cur[z] || {}, kg = s.fat_kg, pct = s.fat_pct;
      var ex = 0;
      if (kg != null && pct != null && +pct > 100){ ex = +kg * (1 - 100/(+pct)); haveAny = true; }
      else if (kg != null) haveAny = true;
      zones[z] = ex > 0 ? ex : 0;
      totalExcess += zones[z];
    });
    if (!haveAny){ host.innerHTML=''; return; }

    var last = {};
    (rows||[]).forEach(function(r){ ['weight_kg','fat_kg','muscle_kg'].forEach(function(k){
      if (r[k] != null && r[k] !== '') last[k] = +r[k]; }); });

    var meta = [];
    if (last.weight_kg != null) meta.push('вес ' + ru(last.weight_kg) + ' кг');
    if (last.fat_kg != null) meta.push('жир ' + ru(last.fat_kg) + ' кг');
    if (last.muscle_kg != null) meta.push('мышцы ' + ru(last.muscle_kg) + ' кг');

    var W = Math.max(260, host.clientWidth || 360);
    var bodyW = Math.round(Math.min(W * 0.62, 300)), bodyH = Math.round(bodyW * 1.62);

    host.innerHTML =
      '<div style="'+CARD+'" id="b3dCard">'+
        '<div style="display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;margin-bottom:14px;padding-right:32px;">'+
          ico(RULER,16)+'Состав тела 2'+
          '<span style="font-size:10.5px;font-weight:400;color:'+C.tx3+';margin-left:auto;">'+date+'</span></div>'+
        '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'+
          '<span style="font-size:28px;font-weight:700;'+MONO+'color:'+C.fat+';line-height:1;">'+ru(totalExcess)+
            '<span style="font-size:12px;font-weight:400;color:'+C.tx3+';"> кг</span></span>'+
          '<span style="font-size:11.5px;color:'+C.tx2+';">жира сверх нормы бланка</span>'+
          (meta.length?'<span style="margin-left:auto;font-size:11px;'+MONO+'color:'+C.tx3+';">'+meta.join(' · ')+'</span>':'')+
        '</div>'+
        '<div style="position:relative;width:100%;height:'+(bodyH+16)+'px;margin-top:14px;">'+
          '<div style="position:absolute;left:'+Math.round((W-bodyW)/2)+'px;top:8px;width:'+bodyW+'px;height:'+bodyH+'px;">'+
            '<canvas id="b3d-cv" style="width:100%;height:100%;display:block;cursor:grab;touch-action:pan-y;"></canvas></div>'+
          label('torso', zones.torso, Math.round(bodyH*.10), false)+
          label('rarm',  zones.rarm,  Math.round(bodyH*.38), false)+
          label('rleg',  zones.rleg,  Math.round(bodyH*.68), false)+
          label('larm',  zones.larm,  Math.round(bodyH*.38), true)+
          label('lleg',  zones.lleg,  Math.round(bodyH*.68), true)+
        '</div>'+
        '<div style="margin-top:12px;font-size:11px;color:'+C.tx3+';line-height:1.55;">'+
          'Узлы сетки лежат на поверхности тела со слоем жира, цвет узла — толщина слоя под ним. '+
          'Пунктир внутри — то же тело без лишнего. Фигуру можно крутить пальцем. '+
          'Норма взята с бланка (процент от нормы прибора), своя не считается. '+
          'Фигура пока мужских пропорций для обоих полов.</div>'+
      '</div>';

    var cv = document.getElementById('b3d-cv');
    if (!cv) return;
    ST.dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = bodyW * ST.dpr; cv.height = bodyH * ST.dpr;
    ST.zones = zones;
    try { draw(cv, zones, ST.rot); } catch(e){ if (window.console) console.warn('body3d', e); }

    // крутим пальцем, как шар в «Жизни»
    var drag = null;
    function down(e){ drag = { x:(e.touches?e.touches[0]:e).clientX, rot:ST.rot }; cv.style.cursor='grabbing'; }
    function move(e){
      if (!drag) return;
      var x = (e.touches?e.touches[0]:e).clientX;
      ST.rot = drag.rot + (x - drag.x) * 0.012;
      if (e.cancelable) e.preventDefault();
      draw(cv, ST.zones, ST.rot);
    }
    function up(){ drag = null; cv.style.cursor='grab'; }
    cv.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down, { passive:true });
    cv.addEventListener('touchmove', move, { passive:false });
    cv.addEventListener('touchend', up);

    if (window.medFold) window.medFold();
  };
})();
