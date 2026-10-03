/* Строка профиля в подвале сайдбара и меню «ещё» за тремя точками (19.09.2026).

   ЗАЧЕМ. В портале не было видно, КТО вошёл, и не было выхода: разлогиниться можно было
   только со страницы /set. При этом подвал занимали три плитки высотой ~100px — «На главную»,
   «Копия для ИИ» и масштаб, — то есть место под список разделов уходило на то, что нажимают
   изредка. Всё это переехало сюда, в меню за ⋮, а подвал стал двумя строками: «Настройки»
   (её рисует сам sidebar.js, чтобы вход в настройки жил даже без этого модуля) и профиль.

   ИМЯ И РОЛЬ берём из /api/pass-status — он с ADR-164 отдаёт staff {id,name,sign,is_owner}.
   Своей ручки не заводим. staff = null — это старая сессия без pstaff, и она по тому же
   ADR считается владельцем; выдумывать «Неизвестно» на этом месте нечего.

   ОДИН ФАЙЛ НА ПОРТАЛ И КАБИНЕТ — как menu-pins.js и tbl-freeze.js. Сейчас подключается
   только из sidebar.js; кабинет (cab-sidebar.js, там своя плашка cab-who.js и своя строка
   «Выйти») приедет отдельным шагом, поэтому хост и источник имени вынесены в CFG, а не
   зашиты в тело.

   ЧЕГО ЗДЕСЬ НЕТ. Строки «Поддержка»: в портале адресат обращения — сам Константин, и
   строка была бы мёртвой. Она нужна в кабинете и медкарте, там и появится. */
(function () {
  if (window.__sbProfile) return;
  window.__sbProfile = 1;

  // Адрес спрайта — один на платформу: window.ICONS_URL ставит server.js (ICONS_V) в <head>
  // каждой страницы. Своя ?v= здесь давала браузеру ещё одну копию файла (27.09.2026).
  var ICONS = window.ICONS_URL || '/assets/icons.svg?v=8';

  var CFG = {
    host: '#app-sidebar .sb-foot',   // куда встраиваемся
    who: passStatus                  // чем узнаём, кто вошёл
  };

  function ico(name, cls) {
    return '<svg class="' + (cls || 'ico') + '" aria-hidden="true"><use href="'
      + ICONS + '#' + name + '"></use></svg>';
  }

  /* Инициалы для кружка. Фото у сотрудника нет и не планируется, а кружок нужен:
     без него строка профиля не отличается от остальных строк подвала. */
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
  }

  var CSS =
    /* Подвал становится точкой отсчёта для меню: оно раскрывается ВВЕРХ, потому что
       стоит у нижнего края экрана, а на телефоне — у нижнего края шторки. */
      '#app-sidebar .sb-foot{position:relative;}'
    + '.sb-me{display:flex;align-items:center;gap:10px;padding:7px 10px;margin:4px 10px 2px;'
    +   'box-sizing:border-box;border-radius:var(--ui-radius,8px);'
    +   'background:var(--ui-surface-3,#101010);border:1px solid var(--ui-line-2,#1a1a1a);}'
    + '.sb-ava{width:28px;height:28px;flex:0 0 auto;border-radius:50%;display:flex;'
    +   'align-items:center;justify-content:center;font-size:11px;font-weight:700;'
    +   'color:var(--ui-brand,#00a0ff);background:rgba(0,160,255,.12);'
    +   'border:1px solid rgba(0,160,255,.25);}'
    + '.sb-ava svg{width:15px;height:15px;color:var(--ui-brand,#00a0ff);}'
    + '.sb-me-txt{min-width:0;display:flex;flex-direction:column;line-height:1.25;}'
    /* Имя режем многоточием: «Зубков Михаил Владимирович» в 230px не влезает, а переносом
       строка профиля вырастет вдвое и съест ровно то место, ради которого делалась правка. */
    + '.sb-me-txt b{font-size:12.5px;font-weight:600;color:var(--ui-tx,#e8e8e8);'
    +   'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    + '.sb-me-txt span{font-size:10.5px;color:var(--ui-tx-3,#666);'
    +   'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
    /* Кнопке ⋮ задаём ТОЛЬКО min-*: иконочная роль в btnCss() объявляет
       width/height:auto !important, и обычные width/height молча не сработают
       (docs/rules/ui.md). Цвета, рамку и скругление ей не пишем вовсе. */
    + '.sb-me>.ibtn{margin-left:auto;min-width:30px;min-height:30px;}'
    + '.sb-me>.ibtn svg{width:18px;height:18px;}'

    + '.sb-pm{position:absolute;left:10px;right:10px;bottom:calc(100% + 6px);z-index:5;'
    +   'background:var(--ui-surface,#141414);border:1px solid var(--ui-line,#262626);'
    +   'border-radius:var(--ui-radius,8px);padding:4px;'
    /* тень — токен уровня md (меню/выпадашки, docs/DESIGN-TOKENS.md «Тени», 29.09.2026) */
    +   'box-shadow:var(--ui-shadow-md,0 6px 18px -2px rgba(0,0,0,.30));}'
    /* Своего display у .sb-pm нет намеренно — тогда работает браузерное [hidden].
       Правило ниже всё равно пишем: правило платформы (docs/rules/ui.md) — если
       элементу когда-нибудь дадут display, hidden молча перестанет прятать. */
    + '.sb-pm[hidden]{display:none !important;}'
    /* Строки меню — <a> и <button> БЕЗ классов ролей (.btn/.tbtn/.ibtn), поэтому btnCss()
       их не трогает и вид пишется здесь осознанно (docs/rules/ui.md, последний абзац). */
    + '.sb-pm-row{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;'
    +   'min-height:38px;padding:8px;border:0;background:none;border-radius:7px;'
    +   'color:var(--ui-tx-2,#c8c8c8);font-size:13px;font-family:inherit;text-align:left;'
    +   'text-decoration:none;cursor:pointer;}'
    + '.sb-pm-row[hidden]{display:none !important;}'
    + '.sb-pm-row:hover{background:var(--ui-surface-2,#1a1a1a);color:var(--ui-tx,#e8e8e8);}'
    + '.sb-pm-row .ico{width:17px;height:17px;flex:0 0 auto;color:var(--icon-color,#8a8a8a);}'
    + '.sb-pm-row:hover .ico{color:var(--icon-hover,#fff);}'
    + '.sb-pm-row .r{margin-left:auto;font-size:11px;color:var(--ui-tx-3,#666);}'
    + '.sb-pm-row.dg,.sb-pm-row.dg .ico{color:var(--ui-danger,#f87171);}'
    + '.sb-pm-sep{height:1px;background:var(--ui-line,#262626);margin:4px 8px;}'
    /* Остаток сессии раньше висел серым текстом под логотипом и занимал там две строки
       на каждой странице. Данные те же (updSess в sidebar.js пишет в #sb-session),
       переехало только место. */
    + '.sb-pm .sb-session{padding:2px 8px 6px;font-size:10.5px;line-height:1.45;'
    +   'color:var(--ui-tx-3,#666);}'
    /* Масштаб приезжает из /ui-scale.js одной строкой «Масштаб А 100% А» — в меню она
       ложится как обычный пункт. Специфичность класс+id перебивает собственный #ui-scale
       модуля. */
    + '.sb-pm #ui-scale{display:flex;align-items:center;gap:8px;min-height:38px;padding:6px 8px;'
    +   'margin:0;background:none;border:0;font-size:13px;color:var(--ui-tx-2,#c8c8c8);}'
    + '.sb-pm #ui-scale .ttl{margin-right:auto;font-size:13px;}'
    + '.sb-pm #ui-scale #ui-scale-val{font-size:11px;color:var(--ui-tx-3,#666);}'
    /* Телефон: строки меню дорастают до зоны тапа. 38px мышью — норма, пальцем — нет. */
    + '@media (max-width:768px){.sb-pm-row,.sb-pm #ui-scale{min-height:var(--ui-tap,44px);}'
    +   '.sb-me>.ibtn{min-width:var(--ui-tap,44px);min-height:var(--ui-tap,44px);}}';

  function style() {
    if (document.getElementById('sb-profile-css')) return;
    var st = document.createElement('style');
    st.id = 'sb-profile-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function menuHtml() {
    return ''
      /* Хук страницы (02.10.2026, #411): страница кладёт window.SB_PAGE_SETTINGS = {label, open},
         и первой строкой меню появляется её «Настройки …». Строка скрыта, пока хука нет
         (syncPageSettings() читает его при каждом открытии меню). no-ui-btn — по той же причине,
         что у «Копии для ИИ» ниже. */
      + '<button type="button" class="sb-pm-row no-ui-btn" id="sb-pset" hidden>'
      +   ico('i-settings') + '<span id="sb-pset-t"></span></button>'
      /* Платформенная большая панель (mhSettings из mhead.js/sidebar.js: версия, крошки, кнопки
         бургера) — переехала сюда с мобильной ⚙, которую заняла шторка страницы (#411). */
      + '<button type="button" class="sb-pm-row no-ui-btn" id="sb-mhset" hidden>'
      +   ico('i-settings') + 'Настройки</button>'
      + '<a class="sb-pm-row" href="/set#security">' + ico('i-shield-check') + 'Вход и безопасность</a>'
      /* Тема — та же ручка, что была кнопкой в строке логотипа: id значка и подписи
         менять нельзя, их обновляет paintButton() в /theme-toggle.js (ADR-142). */
      + '<button type="button" class="sb-pm-row" id="sb-theme">'
      +   '<svg class="ico" aria-hidden="true"><use id="sb-theme-ico" href="' + ICONS + '#i-sun"></use></svg>'
      +   'Тема<span class="r" id="sb-theme-name"></span></button>'
      + '<div id="sb-pm-scale"></div>'
      /* no-ui-btn обязателен, и это не перестраховка: normIcons() в sidebar.js вешает
         на значок класс i-copy, а ui.css правилом button:has(.i-copy) объявляет
         padding:4px !important — строка меню схлопнулась бы в кнопку-значок. Ровно на
         этом уже спотыкалась плитка «Копия для ИИ» в прежнем подвале (10.09.2026);
         normIcons() узлы внутри .no-ui-btn пропускает. */
      + '<button type="button" class="sb-pm-row no-ui-btn" id="sb-copy" '
      +   'title="Скопировать адрес и все данные страницы для ИИ-агента">'
      +   ico('i-copy') + 'Копия для ИИ</button>'
      + '<a class="sb-pm-row" href="/app">' + ico('i-home') + 'На главную</a>'
      + '<div class="sb-pm-sep"></div>'
      + '<div class="sb-session" id="sb-session"></div>'
      + '<button type="button" class="sb-pm-row dg" id="sb-logout">'
      +   ico('i-logout') + 'Выйти</button>';
  }

  function draw(who) {
    var host = document.querySelector(CFG.host);
    if (!host || document.getElementById('sb-me')) return;
    style();

    var box = document.createElement('div');
    box.className = 'sb-me';
    box.id = 'sb-me';
    var ini = initials(who.name);
    box.innerHTML =
        '<span class="sb-ava">' + (ini || ico('i-user')) + '</span>'
      + '<span class="sb-me-txt"><b></b><span></span></span>'
      + '<button type="button" class="ibtn" id="sb-me-btn" aria-haspopup="menu" '
      +   'aria-expanded="false" aria-controls="sb-pm" title="Ещё" aria-label="Ещё">'
      +   '<svg aria-hidden="true"><use href="' + ICONS + '#i-dots-v"></use></svg></button>';
    // Имя и роль — текстом, а не через innerHTML: имя приходит из базы и в разметку
    // как разметка попадать не должно.
    box.querySelector('b').textContent = who.name;
    box.querySelector('.sb-me-txt > span').textContent = who.role;

    var menu = document.createElement('div');
    menu.className = 'sb-pm';
    menu.id = 'sb-pm';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    menu.innerHTML = menuHtml();

    host.appendChild(menu);
    host.appendChild(box);

    var btn = document.getElementById('sb-me-btn');
    function syncPageSettings() {
      var ps = window.SB_PAGE_SETTINGS, row = document.getElementById('sb-pset');
      var mh = document.getElementById('sb-mhset');
      if (mh) mh.hidden = typeof window.mhSettings !== 'function';
      if (!row) return;
      var ok = !!(ps && ps.label && typeof ps.open === 'function');
      row.hidden = !ok;
      if (ok) document.getElementById('sb-pset-t').textContent = ps.label;
    }
    function open(v) {
      if (v === undefined) v = menu.hidden;
      if (v) syncPageSettings();
      menu.hidden = !v;
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); open(); });
    // Закрывать по клику мимо и по Esc — иначе меню остаётся висеть над списком
    // разделов и перекрывает их.
    document.addEventListener('click', function (e) {
      if (menu.hidden) return;
      if (e.target.closest && e.target.closest('#sb-pm, #sb-me-btn')) return;
      open(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
    // Переход по пункту меню его закрывает. Важно для ссылки на якорь (/set#security),
    // когда мы УЖЕ на /set: страница не перезагружается, и меню осталось бы висеть.
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a[href]')) open(false);
    });

    document.getElementById('sb-pset').addEventListener('click', function () {
      var ps = window.SB_PAGE_SETTINGS;
      open(false);
      if (ps && typeof ps.open === 'function') ps.open();
    });
    document.getElementById('sb-mhset').addEventListener('click', function () {
      open(false);
      if (typeof window.mhSettings === 'function') window.mhSettings();
    });
    document.getElementById('sb-theme').addEventListener('click', function () {
      if (window.cfToggleTheme) window.cfToggleTheme();
    });
    document.getElementById('sb-copy').addEventListener('click', function () {
      if (window.cfCopyPage) window.cfCopyPage();
      open(false);
    });
    document.getElementById('sb-logout').addEventListener('click', logout);

    // Остаток сессии считает sidebar.js (там же скользящее продление куки) — просим
    // заполнить строку сейчас, иначе она пустует до следующего тика поллера, то есть
    // до минуты.
    if (window.sbUpdSess) window.sbUpdSess();

    // Значок и подпись темы рисует paintButton() в /theme-toggle.js — но он отработал
    // при загрузке страницы, когда меню ещё не существовало. Повторяем его работу один
    // раз: в тёмной теме предлагаем светлую (солнце), в светлой — тёмную (луна).
    if (window.cfThemeCurrent) {
      var light = window.cfThemeCurrent() === 'light';
      var name = document.getElementById('sb-theme-name');
      var use = document.getElementById('sb-theme-ico');
      if (name) name.textContent = light ? 'светлая' : 'тёмная';
      if (use) use.setAttribute('href', ICONS + '#' + (light ? 'i-moon' : 'i-sun'));
    }
  }

  async function logout() {
    if (window.uiConfirm) {
      var ok = await window.uiConfirm('Выйти из портала? Вход спросит пароль и код 2FA.');
      if (!ok) return;
    }
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(function () {})
      .then(function () { location.href = '/'; });
  }

  /* Кто вошёл в портале. Ответ разбираем по шагам, а не общим глотающим хелпером
     (docs/rules/ui.md): на экране входа authed=false — это НЕ ошибка, и рисовать там
     строку профиля нечего. Сеть отвалилась — тоже молчим: подвал остаётся со строкой
     «Настройки», меню просто не появляется. */
  function passStatus() {
    return fetch('/api/pass-status', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.authed) return null;
        var st = d.staff;
        return {
          name: (st && st.name) || 'Администратор',
          role: (!st || st.is_owner) ? 'Владелец платформы' : 'Сотрудник'
        };
      })
      .catch(function () { return null; });
  }

  // Сайдбар рисуется скриптом и появляется позже загрузки страницы — ждём его, но с
  // потолком попыток: на странице без сайдбара (embed=1) просто ничего не делаем.
  function waitHost(tries) {
    if (document.querySelector(CFG.host)) {
      return void CFG.who().then(function (who) { if (who) draw(who); });
    }
    if (tries > 60) return;
    setTimeout(function () { waitHost(tries + 1); }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { waitHost(0); });
  } else waitHost(0);
})();
