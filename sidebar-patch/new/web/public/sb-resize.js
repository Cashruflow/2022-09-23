/* Тянущаяся граница сайдбара портала (ПК). Подключается ОДНОЙ строкой из sidebar.js —
   как auth-gate / tbl-freeze / scroll-keep, чтобы не править 35 HTML-файлов.

   Что делает: даёт схватить линию между сайдбаром (#app-sidebar) и контентом и менять
   ширину; утянешь влево до упора — сайдбар схлопывается в колонку иконок. Ширина и
   режим иконок запоминаются в localStorage.

   Шесть правил, по которым это сделано (иначе ресайзер всегда выходит кривым):
     1. HIT AREA — рисуется линия 1px (это border-right сайдбара), а ловится полоса
        12px: попасть мышью в один пиксель невозможно.
     2. CLAMP    — ширина зажата между MIN и MAX, руками не растянуть на пол-экрана.
     3. SNAP     — промежуточных огрызков нет: ниже порога — прыжок в режим иконок,
        выше — прыжок обратно в нормальную ширину. Полусайдбар читается как баг.
     4. OVERLAY  — на время перетаскивания на весь экран кладётся прозрачный слой:
        иначе мышь цепляет выделение текста, ссылки и особенно iframe (виджеты,
        карточка задачи внутри лида) — курсор «проваливается» и драг рвётся.
     5. CURSOR   — col-resize вешается на слой поверх ВСЕЙ страницы, а не на ручку:
        если курсор ушёл за линию быстрее, чем перерисовался сайдбар, стрелка мигает.
     6. PERSIST  — ширина переживает перезагрузку. Ресайз, который сбрасывается на
        F5, злит сильнее, чем его отсутствие.

   Мобилы это не касается: там сайдбар — нижняя шторка (см. media-запрос в sidebar.js),
   тянуть нечего, ручка спрятана media-запросом ниже. */
(function () {
  if (window.__sbResize) return;
  window.__sbResize = true;

  var MIN = 200;    // уже — текст пунктов начинает переноситься
  var MAX = 420;    // шире — просто отъедает контент
  var ICON = 64;    // колонка иконок
  var SNAP = 150;   // порог схлопывания: левее — иконки
  var BACK = 170;   // порог обратного разворачивания (гистерезис, чтобы не дрожало)
  var K_W = 'cf-sb-w';
  var K_I = 'cf-sb-icons';

  var root = document.documentElement;
  var lastW = 230;

  // Рамки и ширина по умолчанию — токены из /set («Карточки и сетка» → «Колонки»,
  // 11.09.2026): --ui-sb-min / --ui-sb-max / --ui-sb-w. Литералы выше — фолбэк, если
  // /theme.css не доехал. Кривые сочетания (min > max, дефолт вне рамок) чиним здесь,
  // как bottom-nav.js чинит геометрию дока: сервер отдаёт что попросили.
  (function tokens() {
    try {
      var cs = getComputedStyle(root);
      var px = function (n) { var v = parseInt(cs.getPropertyValue(n), 10); return isFinite(v) ? v : null; };
      var mn = px('--ui-sb-min'), mx = px('--ui-sb-max'), w = px('--ui-sb-w');
      if (mn && mn >= 160 && mn <= 360) MIN = mn;
      if (mx && mx >= 240 && mx <= 640) MAX = mx;
      if (MAX < MIN + 20) MAX = MIN + 20;
      if (SNAP >= MIN) { SNAP = MIN - 50; BACK = MIN - 30; }
      if (w) lastW = Math.max(MIN, Math.min(MAX, w));
    } catch (e) {}
  })();

  // Отладка (10.09.2026): «курсор завис стрелкой ресайза, ни одна кнопка не жмётся,
  // в консоли пусто». Логи только в браузере — на сервер ничего не уходит. Пишем на
  // СОБЫТИЯХ (нажал / снап / отпустил / спасение), а не на каждом pointermove, чтобы
  // не засорять консоль. Выключить: localStorage['cf-sb-debug']='0'.
  // Снимок состояния в любой момент: sbResizeDebug() в консоли.
  function dbg() {
    try { if (localStorage.getItem('cf-sb-debug') === '0') return; } catch (e) {}
    var a = ['[sb-resize]'].concat([].slice.call(arguments));
    try { console.info.apply(console, a); } catch (e) {}
  }

  function ls(k, v) {
    try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); }
    catch (e) { return null; }
  }
  function clamp(x) { return Math.max(MIN, Math.min(MAX, Math.round(x))); }

  // --- состояние ---------------------------------------------------------
  var saved = parseInt(ls(K_W) || '', 10);
  if (saved >= MIN && saved <= MAX) lastW = saved;
  var icons = ls(K_I) === '1';
  var sentIcons = icons;      // последнее разосланное состояние (событие sb:icons)
  // Кнопка «свернуть/развернуть» — объявлена здесь, ВЫШЕ первого apply() и mount():
  // mount() может отработать синхронно, и поздний «var tgl = null» обнулил бы ссылку.
  var tgl = null;

  // Пересчёт того, что зависит от ширины сайдбара (09.09.2026, разбор поломки
  // бэклога). Меняя --sb-w, мы меняем body{padding-left} и, следом, реальные
  // ширины колонок таблиц. Но tbl-freeze.js и tbl-resize.js просыпаются только
  // на window.resize, мутацию своей таблицы или ручной frzTables() — смена
  // CSS-переменной не даёт НИ ОДНОГО из этих поводов. Без этой строки
  // закреплённые колонки остаются с left, посчитанным для прежней ширины:
  // между «ID» и «Тип» появляется щель, а «Статус» подрезается соседней
  // колонкой. Ловилось не только на перетаскивании: скрипт грузится
  // динамически из sidebar.js и ставит сохранённую ширину уже ПОСЛЕ первого
  // прогона tbl-freeze — то есть /tasks открывался кривым, ничего не трогая.
  //
  // Debounce обязателен: apply(false) зовётся на каждый pointermove, а полный
  // прогон tbl-freeze по таблице в 300 строк на каждое движение мыши — это
  // тот самый рывок, ради устранения которого в нём разведены фазы чтения и
  // записи. 120 мс: пересчёт случается один раз, когда мышь притормозила.
  var rlT = null;
  function relayout() {
    clearTimeout(rlT);
    rlT = setTimeout(function () {
      // frzTables вызываем явно: resize покрывает оба модуля, но на первой
      // загрузке порядок скриптов не гарантирован, а подписка на resize
      // появляется позже самой функции.
      try { if (window.frzTables) window.frzTables(); } catch (e) {}
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    }, 120);
  }

  function apply(persist) {
    root.style.setProperty('--sb-w', (icons ? ICON : lastW) + 'px');
    // Класс и на <html>, и на <body>: <html> есть всегда, даже когда скрипт отработал
    // раньше body, — ширина 64px без класса давала колонку, в которой торчали подписи
    // (скрин Константина 10.09.2026). Селекторы ниже — .sb-icons без привязки к тегу.
    root.classList.toggle('sb-icons', icons);
    if (document.body) document.body.classList.toggle('sb-icons', icons);
    if (persist) dbg('apply', { icons: icons, width: icons ? ICON : lastW });
    if (persist) { ls(K_W, lastW); ls(K_I, icons ? '1' : '0'); }
    syncToggle();
    // Событие для соседей (sidebar.js сбрасывает фильтр поиска при уходе в иконки).
    // Только на смену режима, а не на каждый pointermove.
    if (icons !== sentIcons) {
      sentIcons = icons;
      try { window.dispatchEvent(new CustomEvent('sb:icons', { detail: { icons: icons } })); } catch (e) {}
    }
    relayout();
  }
  function setIcons(v) { if (icons === v) return; icons = v; dbg('snap →', v ? 'иконки' : 'полный'); apply(false); }

  // Свернуть/развернуть снаружи (02.10.2026, ADR-309): Ctrl/⌘+K в sidebar.js разворачивает
  // колонку иконок перед фокусом в поиск. Ширина восстанавливается прежняя (lastW),
  // состояние запоминается так же, как двойным щелчком по границе.
  window.sbSetIcons = function (v) { setIcons(!!v); apply(true); };
  window.sbIsIcons = function () { return icons; };

  apply(false);                                     // ширину ставим сразу, до отрисовки
  onBody(function () { apply(false); });

  function onBody(fn) {
    if (document.body) return fn();
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  // --- стили -------------------------------------------------------------
  var css = ''
    + '#sb-resizer{position:fixed;top:0;bottom:0;left:calc(var(--sb-w) - 6px);width:12px;'
    +   'z-index:501;cursor:col-resize;touch-action:none;}'
    // сама подсветка — 2px поверх штатной границы сайдбара, появляется только под мышью
    + '#sb-resizer::after{content:"";position:absolute;left:5px;top:0;bottom:0;width:2px;'
    +   'background:transparent;transition:background .15s;}'
    + '#sb-resizer:hover::after,body.sb-dragging #sb-resizer::after{background:var(--ui-brand,#00a0ff);}'
    + '#sb-drag-shield{position:fixed;inset:0;z-index:9999;cursor:col-resize;}'
    + 'body.sb-dragging{user-select:none;-webkit-user-select:none;}'
    + '@media (max-width:768px){#sb-resizer{display:none;}}'
    // Кнопка «свернуть/развернуть» на краю меню (02.10.2026, ADR-309). Сама кнопка —
    // голая .ibtn (вид — роль из btnCss(), своего фона и рамки ей не пишем); кружок-подложка
    // — обёртка #sb-collapse: кнопка стоит НА границе, половиной над контентом, и без
    // подложки шеврон терялся бы на линии. Цвета — токенами, светлая тема берёт свои.
    // z-index выше ручки (#sb-resizer, 501): клик попадает в кнопку, а тянуть границу
    // можно выше и ниже неё. Ниже слоя перетаскивания (9999) — во время драга не мешает.
    + '#sb-collapse{position:fixed;top:24px;left:calc(var(--sb-w) - 13px);z-index:502;width:26px;height:26px;'
    +   'box-sizing:border-box;border-radius:50%;display:flex;align-items:center;justify-content:center;'
    +   'background:var(--ui-bg,#0a0a0a);border:1px solid var(--ui-line,#262626);'
    +   'box-shadow:var(--ui-shadow-sm,0 2px 6px -1px rgba(0,0,0,.25));color:var(--ui-tx-2,#8b8b8b);}'
    + '#sb-collapse:hover{border-color:var(--ui-brand,#00a0ff);color:var(--ui-tx,#fff);}'
    + '#sb-collapse>.ibtn{min-width:24px;min-height:24px;}'
    + '#sb-collapse>.ibtn svg{width:14px;height:14px;}'
    + 'body.sb-authwall #sb-collapse{display:none;}'
    + '@media (max-width:768px){#sb-collapse{display:none;}}'

    + '@media (min-width:769px){'
    // плавно только на снапе; во время перетаскивания анимация обязана молчать
    + '#app-sidebar,#sb-resizer,#sb-collapse,body{transition:width .16s ease,left .16s ease,padding-left .16s ease;}'
    + 'body.sb-dragging,body.sb-dragging #app-sidebar,body.sb-dragging #sb-resizer,body.sb-dragging #sb-collapse{transition:none;}'

    // ---- режим иконок ----
    + '.sb-icons #app-sidebar .sb-logo{justify-content:center;padding-left:0;padding-right:0;font-size:0;gap:0;}'
    + '.sb-icons #app-sidebar .sb-logo span.v,.sb-icons #sb-health-dot,'
    +   '.sb-icons #app-sidebar .sb-session{display:none;}'
    + '.sb-icons #app-sidebar .sb-group{display:none;}'
    + '.sb-icons #app-sidebar .sb-items{max-height:none !important;padding:4px 0;'
    +   'border-top:1px solid var(--ui-line-2,#1a1a1a);}'
    + '.sb-icons #app-sidebar .sb-nav>div:nth-child(2){border-top:0;}'
    + '.sb-icons #app-sidebar .sb-items::before{display:none;}'
    + '.sb-icons #app-sidebar a.sb-link{justify-content:center;padding:10px 0;margin-right:0;'
    +   'border-radius:0;font-size:0;gap:0;}'
    + '.sb-icons #app-sidebar a.sb-link::before{display:none;}'
    + '.sb-icons #app-sidebar a.sb-link.active{background:rgba(0,160,255,.12);'
    +   'box-shadow:inset 2px 0 0 var(--ui-brand,#00a0ff);}'
    // бейдж в узкой колонке цифрой не влезает — остаётся точкой
    + '.sb-icons #app-sidebar .sb-badge{position:absolute;top:5px;right:12px;margin:0;'
    +   'min-width:8px;width:8px;height:8px;padding:0;border-radius:50%;font-size:0;}'
    // Подвал стал строками (19.09.2026): «Настройки» и профиль с меню за ⋮. В узкой
    // колонке снимаем подписи — остаются значок настроек, кружок с инициалами и ⋮.
    + '.sb-icons #app-sidebar .sb-foot{padding:6px 0;}'
    + '.sb-icons #app-sidebar .sb-frow{justify-content:center;margin:0 6px;padding:10px 0;'
    +   'font-size:0;gap:0;}'
    + '.sb-icons #app-sidebar .sb-me{gap:4px;padding:6px 4px;margin:4px 6px 2px;'
    +   'justify-content:center;}'
    + '.sb-icons #app-sidebar .sb-me-txt{display:none;}'
    + '.sb-icons #app-sidebar .sb-me>.ibtn{margin-left:0;}'
    // Меню за ⋮ в 72px колонке нечитаемо, а вылезти за неё не может: у #app-sidebar
    // overflow:hidden. Поэтому в узком режиме оно position:fixed — фиксированный элемент
    // обрезкой предка не режется — и встаёт СПРАВА от колонки, у нижнего края.
    + '.sb-icons #app-sidebar .sb-pm{position:fixed;left:calc(var(--sb-w,72px) + 6px);'
    +   'right:auto;bottom:10px;width:220px;}'
    + '.sb-icons #app-sidebar .sb-search{display:none;}'
    // «Тема» и «Настройка» больше не значки в строке логотипа (19.09.2026): тема уехала
    // в меню профиля, настройки — строкой подвала. Правило про их столбик снято вместе
    // с ними; осталось только центрирование самой строки логотипа.
    + '.sb-icons #app-sidebar .sb-logo{flex-wrap:wrap;justify-content:center;gap:4px;}'
    // «Быстрый доступ» (/menu-pins.js) в колонке иконок: без подписи-заголовка, без
    // кнопок закрепления и ручек — закреплять в узкой колонке всё равно нечем.
    + '.sb-icons #app-sidebar .mp-cap,.sb-icons #app-sidebar .mp-grip,.sb-icons #sb-logo-act{display:none !important;}'
    + '.sb-icons #app-sidebar .mp-pin{visibility:hidden !important;pointer-events:none !important;}'
    + '.sb-icons #app-sidebar .mp-quick{margin:2px 6px 8px;}'
    + '.sb-icons #app-sidebar .mp-quick .mp-row>a{padding-left:0 !important;padding-right:0 !important;justify-content:center;}'
    + '}';

  var st = document.createElement('style');
  st.id = 'sb-resize-css';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  // --- ручка -------------------------------------------------------------
  onBody(function () { waitSidebar(0); });

  function waitSidebar(n) {
    if (document.getElementById('app-sidebar')) return mount();
    if (n > 60) return;                       // сайдбара нет (embed=1) — молча уходим
    setTimeout(function () { waitSidebar(n + 1); }, 100);
  }

  function mount() {
    if (document.getElementById('sb-resizer')) return;
    var h = document.createElement('div');
    h.id = 'sb-resizer';
    h.setAttribute('role', 'separator');
    h.setAttribute('aria-orientation', 'vertical');
    h.title = 'Потяните, чтобы изменить ширину меню (двойной щелчок — иконки)';
    document.body.appendChild(h);
    titles();
    drag(h);
    h.addEventListener('dblclick', function () { setIcons(!icons); apply(true); });
    toggleBtn();
  }

  // Кнопка «свернуть/развернуть» (02.10.2026, ADR-309). Клик = двойной щелчок по
  // границе: та же пара setIcons + apply(true), прежняя ширина (lastW) возвращается.
  // Спрайт — window.ICONS_URL (ICONS_V в server.js), своей ?v= не пишем.
  function toggleBtn() {
    if (document.getElementById('sb-collapse')) return;
    var w = document.createElement('div');
    w.id = 'sb-collapse';
    w.innerHTML = '<button type="button" class="ibtn" aria-controls="app-sidebar">'
      + '<svg aria-hidden="true"><use href=""></use></svg></button>';
    document.body.appendChild(w);
    tgl = w.querySelector('button');
    tgl.addEventListener('click', function (e) {
      e.preventDefault();
      setIcons(!icons); apply(true);
    });
    // Нажатие по кнопке не должно стать началом перетаскивания и не должно уйти странице.
    tgl.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    syncToggle();
  }
  function syncToggle() {
    if (!tgl) return;
    var t = icons ? 'Развернуть меню' : 'Свернуть меню';
    tgl.setAttribute('aria-label', t);
    tgl.setAttribute('aria-expanded', icons ? 'false' : 'true');
    tgl.title = t;
    var u = tgl.querySelector('use');
    if (u) u.setAttribute('href', (window.ICONS_URL || '/assets/icons.svg?v=13') + (icons ? '#i-chevrons-right' : '#i-chevrons-left'));
  }

  // Подписи в тултипы: в режиме иконок текста не видно, а гадать по картинке нельзя.
  function titles() {
    document.querySelectorAll('#app-sidebar a.sb-link').forEach(function (a) {
      if (!a.title) { var t = (a.textContent || '').trim(); if (t) a.title = t; }
    });
  }

  function drag(h) {
    var shield = null, pid = null;

    // Конец перетаскивания. Раньше ловился ТОЛЬКО pointerup/pointercancel на ручке —
    // и держался на захвате указателя. Браузер его теряет: Ctrl-клик/правый клик на
    // маке (открылось контекстное меню), отпускание кнопки за окном, force-click
    // трекпада, alt-tab посреди жеста. Тогда pointerup уходит мимо ручки, а прозрачный
    // #sb-drag-shield (весь экран, z-index 9999, курсор col-resize) остаётся висеть:
    // курсор — стрелка ресайза, ни одна кнопка страницы не нажимается, ошибок нет.
    // Теперь конец ловится отовсюду, а слой ещё и сам себя снимает (обработчики на нём).
    function done(reason) {
      if (!shield) return;
      try { if (pid != null) h.releasePointerCapture(pid); } catch (err) {}
      shield.remove(); shield = null; pid = null;
      document.body.classList.remove('sb-dragging');
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onBlur);
      apply(true);
      dbg('конец перетаскивания:', reason);
    }
    function onUp(e) { done(e.type); }
    function onBlur() { done('окно потеряло фокус'); }
    function onKey(e) { if (e.key === 'Escape') done('Escape'); }

    h.addEventListener('pointerdown', function (e) {
      if (e.button) { dbg('нажатие не левой кнопкой — игнор', e.button); return; }
      // Ctrl+клик на маке = правый клик: дальше придёт contextmenu, а pointerup — нет
      if (e.ctrlKey) { dbg('Ctrl+клик — игнор (на маке это контекстное меню)'); return; }
      if (shield) done('повторное нажатие поверх незакрытого');
      e.preventDefault();
      pid = e.pointerId;
      try { h.setPointerCapture(e.pointerId); } catch (err) { dbg('захват указателя не удался', err && err.message); }
      document.body.classList.add('sb-dragging');
      shield = document.createElement('div');
      shield.id = 'sb-drag-shield';
      // Страховка на самом слое: если он всё-таки пережил конец жеста, первое же
      // нажатие/отпускание по нему его снимает, а не уходит в пустоту.
      shield.addEventListener('pointerdown', function () { done('клик по зависшему слою'); });
      shield.addEventListener('pointerup', function () { done('pointerup на слое'); });
      document.body.appendChild(shield);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
      window.addEventListener('blur', onBlur);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('visibilitychange', onBlur);
      dbg('начало перетаскивания', { x: e.clientX, width: icons ? ICON : lastW, icons: icons, pointer: e.pointerType });
    });

    function onMove(e) {
      if (!shield) return;
      // Кнопка мыши уже отпущена, а мы всё ещё «тянем» — значит, pointerup потерялся.
      if (e.pointerType === 'mouse' && e.buttons === 0) return done('кнопка отпущена, pointerup потерялся');
      var x = e.clientX;
      if (icons) { if (x > BACK) { setIcons(false); lastW = clamp(x); apply(false); } }
      else if (x < SNAP) { setIcons(true); }
      else { lastW = clamp(x); apply(false); }
    }
    h.addEventListener('pointermove', onMove);
    // Захват потерян — события идут уже не на ручку, а на слой: слушаем и там.
    document.addEventListener('pointermove', function (e) { if (shield && e.target === shield) onMove(e); });
    h.addEventListener('lostpointercapture', function () { if (shield) dbg('захват указателя потерян — жду отпускания на window'); });
  }

  // Снимок состояния для отладки: sbResizeDebug() в консоли.
  window.sbResizeDebug = function () {
    var st = {
      icons: icons, lastW: lastW, toggle: !!document.getElementById('sb-collapse'),
      '--sb-w': getComputedStyle(root).getPropertyValue('--sb-w').trim(),
      htmlClass: root.className, bodyClass: document.body && document.body.className,
      shield: !!document.getElementById('sb-drag-shield'),
      sidebarWidth: (document.getElementById('app-sidebar') || {}).offsetWidth
    };
    console.table ? console.table(st) : console.log(st);
    return st;
  };
})();
