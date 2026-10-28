// Шапка страницы: собирает единый компонент .ph из того, что написано на странице (ADR-147).
//
// Зачем файл. Полсотни страниц портала писали шапку каждая по-своему: где-то иконка
// слева от H1, где-то полоса-разделитель, где-то ссылка «← AI-платформа», дублирующая
// бургер, где-то счётчик внутри заголовка, а сверху у всех — пустая строка под
// fixed-кнопки, место под которые резервировала распорка burger-space.js. Правило
// «делай шапку вот так» в документации это не чинит: оно чинится тем, что шапку
// собирает один файл.
//
// Раскладка (решение Константина, 30.08.2026):
//
//     Заголовок раздела,           [ ⟳ ] [ ☰ ]
//     сколько угодно строк              v1.9.1 👁
//     Подзаголовок одной строкой
//     [кнопки действий]
//
// Слева заголовок — флексом, занимает всё оставшееся место и переносится на столько
// строк, сколько нужно. Названия разделов НЕ сокращаем и НЕ режем многоточием.
// Справа блок-виджет фиксированной ширины: первой строкой две кнопки, под ними версия
// модуля со значком истории. Так заголовок и кнопки никогда не дерутся за место.
//
// Как страница управляет шапкой:
//   <h1 data-sub="22 доступа · 5 проектов">Доступы</h1>   — подзаголовок явно;
//   <h1 class="no-ui-h1">…</h1>                            — не шапка портала (лендинг, вход);
//   <header class="ph">…</header>                          — своя разметка, скрипт её не трогает
//                                                            и только доносит кнопки.
// Счётчики НЕ удаляются, а переезжают вместе с узлом: страница продолжает писать
// в тот же getElementById('cnt'), просто теперь он виден в подзаголовке.
//
// Только портал (sidebar.js). Кабинеты клиентов живут на cab-burger.js со своим
// порогом 820px — туда шапка приедет отдельным шагом, здесь их не трогаем.
(function () {
  if (window.__pageHeader) return;
  if (new URLSearchParams(location.search).get('embed') === '1') return;
  window.__pageHeader = true;

  // Длиннее — это абзац описания, а не подзаголовок: в шапку не тянем, оставляем
  // на месте. Строка шапки одна и режется многоточием, абзац в ней читать нечего.
  var SUB_MAX = 90;

  // Экраны входа, модалки и шторки — не шапка страницы.
  var SKIP = '#login,.modal,dialog,[role="dialog"],#mvModal,.modal-sidebar,.sb-search-results';

  // Счётчик/мета в заголовке: «Доступы (22)», «Проекты (262)», «— расходы на ИИ».
  var COUNTER = /(^|[-_ ])(cnt|count|total|stats|badge|kick|muted|sub|shown)($|[-_ ])/i;

  // Киккер над заголовком: короткая строка капсом («РАБОТА · ПРОЕКТЫ»).
  var KICKER = /^[A-ZА-ЯЁ0-9 .,·•\-\/]{2,40}$/;

  // Порядок кнопок в правом блоке — тот же, что был у fixed-версии: обновление
  // слева (right:62), меню справа (right:12). Порядок задаётся здесь и только здесь.
  // 16.09.2026: #ph-gear — необязательная шестерёнка настроек страницы (сейчас только
  // трекер привычек, habit_settings.js). Есть на странице — встаёт первой, слева от ⟳.
  // 23.09.2026: #cab-burger — бургер личных страниц (cab-sidebar.js → cab-burger.js): шапка
  // одна на портал и личные разделы, поэтому page-header.js грузится и оттуда.
  // 08.10.2026: cf-bank-slot — слот чипа «⚡ баланс проекта» (bank-chip.js, кабинеты клиентов): встаёт первым, левее ⟳ и ☰.
  // Сам чип рисует и обновляет CFBankChip.attach() — его зовёт tick() ниже; в SEO-хабе слот #sv2-wallet стоит в своей шапке справа от колокольчика.
  var BTNS = ['cf-bank-slot', 'ph-gear', 'hard-refresh', 'sb-burger', 'cab-burger'];

  function el(tag, cls) { var e = document.createElement(tag); e.className = cls; return e; }
  function txt(n) { return (n.textContent || '').trim(); }
  function isCounter(e) { return COUNTER.test(e.className || '') || COUNTER.test(e.id || ''); }
  function isBadge(e) { return /^mvBadge/.test(e.id || ''); }
  // .ph-s — подзаголовок, уже написанный страницей по правилу: забираем его как есть.
  function isSubEl(e) { return e.matches && e.matches('.ph-s,.lead,.sub,.ph1-sub'); }
  function isBack(e) { return e.tagName === 'A' && /^[←‹<]/.test(txt(e)); }

  // Киккер узнаём не по регистру букв в разметке, а по тому, как он НАРИСОВАН:
  // «Работа · Проекты» на /projects написан строчными и поднимается в капс
  // средствами CSS (text-transform), поэтому проверки текста было мало.
  function isKicker(e) {
    if (!e || e.children.length) return false;
    var t = txt(e);
    if (!t || t.length > 40) return false;
    if (KICKER.test(t)) return true;
    try { return getComputedStyle(e).textTransform === 'uppercase'; } catch (x) { return false; }
  }

  function findH1() {
    var list = document.querySelectorAll('h1');
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (h.classList.contains('no-ui-h1')) continue;
      if (h.closest(SKIP)) continue;
      if (!h.getClientRects().length) continue;   // страница ещё под формой входа
      return h;
    }
    return null;
  }

  // Пробел-разделитель в подзаголовке — только если там уже что-то есть и последним
  // узлом не пробел: иначе при каждом проходе цикла копились бы лишние пробелы.
  function space(sub) {
    var last = sub.lastChild;
    if (last && !(last.nodeType === 3 && !last.nodeValue.trim())) {
      sub.appendChild(document.createTextNode(' '));
    }
  }

  function restructure(h1) {
    var parent = h1.parentElement;
    if (!parent) return null;

    // Родной <header> ищем на два уровня вверх, а не только прямо над заголовком:
    // на /projects он обёрнут ещё одним <div style="min-width:0">, и без этого
    // кнопка «+ Проект» оставалась в ряду с иконками вместо ряда действий.
    var hostHeader = null;
    if (parent.tagName === 'HEADER') hostHeader = parent;
    else if (parent.parentElement && parent.parentElement.tagName === 'HEADER') hostHeader = parent.parentElement;
    var onHeader = !!hostHeader;
    // Соседей заголовка запоминаем ДО вставки: после неё previousElementSibling —
    // это уже наш пустой <header>, а не киккер страницы.
    var before = h1.previousElementSibling, after = h1.nextElementSibling;
    var hdr = hostHeader || document.createElement('header');
    if (!onHeader) parent.insertBefore(hdr, h1);
    hdr.className = 'ph';
    hdr.removeAttribute('style');
    // Свои боковые поля шапка добавляет только если их не даёт ни один контейнер
    // над ней. Проверять один уровень мало в обе стороны: у /projects обёртка #app
    // без полей (и заголовок прилипал к краю), а у медкарты поля даёт .ui-page
    // через два уровня (и приезжал двойной отступ). Поэтому идём вверх до body.
    var anc = hdr.parentElement, padded = false;
    while (anc && anc !== document.body) {
      var cs = getComputedStyle(anc);
      if (parseFloat(cs.paddingLeft) > 4 || parseFloat(cs.paddingRight) > 4) { padded = true; break; }
      anc = anc.parentElement;
    }
    if (padded) hdr.classList.add('ph-inner');
    // Если шапка оказалась внутри флекс/грид-ряда, она забирает всю строку: иначе
    // соседи по ряду её сжимают и правый блок уезжает за край экрана. Ряд бывает не
    // прямо над заголовком (медкарта: H1 в блоке, а флекс с лозунгом — уровнем
    // выше), поэтому ищем ближайшего предка, который сам является элементом ряда.
    var node = hdr;
    for (var lvl = 0; lvl < 3 && node.parentElement && node.parentElement !== document.body; lvl++) {
      var pcs = getComputedStyle(node.parentElement), d = pcs.display;
      var isFlex = (d === 'flex' || d === 'inline-flex');
      var isGrid = (d === 'grid' || d === 'inline-grid');
      if (isFlex || isGrid) {
        // Только РЯД. В колоночном флексе `flex:1 1 100%` читается совсем иначе:
        // главная ось там вертикальная, то есть это «займи всю высоту контейнера».
        // Если у контейнера высота задана (раздел «Чаты»: .chats на 100vh), шапка
        // растягивается на весь экран, а содержимое сжимается в полоску внизу —
        // ровно так 03.09.2026 легли /crm/chats. В колонке ряд и без того во всю
        // ширину, дописывать нечего: выходим, ничего не трогая.
        if (isFlex && /^column/.test(pcs.flexDirection)) break;
        node.style.flex = '1 1 100%'; node.style.gridColumn = '1/-1'; node.style.minWidth = '0';
        break;
      }
      node = node.parentElement;
    }

    var row  = el('div', 'ph-row'),
        ttl  = el('div', 'ph-ttl'),
        side = el('div', 'ph-side'),
        act  = el('div', 'ph-act'),
        ver  = el('div', 'ph-ver'),
        ownSub = null,
        sub  = el('p',   'ph-s'),
        tools = el('div', 'ph-tools');

    // Что разбираем. Из родного <header> — всё его содержимое; из обычного
    // контейнера только заголовок и соседей, которые точно принадлежат шапке
    // (значок версии, подзаголовок, киккер) — остальное там уже контент страницы.
    var pool = [], wrappers = [];
    if (onHeader) {
      // Обёртку, внутри которой лежит заголовок, разворачиваем на один уровень:
      // её дети (киккер, H1, подзаголовок) — полноправные части шапки, а сама
      // обёртка после разбора пустеет и удаляется.
      Array.prototype.slice.call(hdr.children).forEach(function (c) {
        if (c !== h1 && c.contains(h1)) {
          wrappers.push(c);
          Array.prototype.slice.call(c.children).forEach(function (g) { pool.push(g); });
        } else pool.push(c);
      });
    } else {
      pool.push(h1);
      var n = after;
      while (n && (isSubEl(n) || isBadge(n))) { pool.push(n); n = n.nextElementSibling; }
      if (isKicker(before)) pool.push(before);
      // Ссылку-возврат ищем среди ближайших соседей в ОБЕ стороны: она не всегда
      // лежит в <header> — на /structure стоит перед заголовком, на /vo после.
      [-1, 1].forEach(function (dir) {
        var e = dir < 0 ? before : after;
        for (var k = 0; k < 3 && e; k++) {
          if (isBack(e)) { pool.push(e); return; }
          e = dir < 0 ? e.previousElementSibling : e.nextElementSibling;
        }
      });
    }

    // Страница могла написать подзаголовок сама, по правилу — тогда берём ЕГО,
    // а не заворачиваем в ещё один такой же (иначе <p> оказывался внутри <p>).
    pool.forEach(function (nd) {
      if (!ownSub && nd !== h1 && nd.matches && nd.matches('p.ph-s')) ownSub = nd;
    });
    if (ownSub) sub = ownSub;

    var subParts = [], leftovers = [];

    pool.forEach(function (nd) {
      if (nd === h1 || nd === ownSub) return;
      if (isBack(nd)) { nd.remove(); return; }          // дубль бургера
      if (isBadge(nd)) { ver.appendChild(nd); return; } // версия — в правый блок
      if (isSubEl(nd)) {
        if (txt(nd).length <= SUB_MAX) subParts.push(nd);
        return;                                          // длинное описание — на месте
      }
      if (isKicker(nd)) { nd.remove(); return; }
      leftovers.push(nd);
    });

    subParts.forEach(function (nd) { space(sub); sub.appendChild(nd); });

    side.appendChild(act);
    side.appendChild(ver);
    row.appendChild(ttl);
    row.appendChild(side);
    ttl.appendChild(h1);

    var explicit = h1.getAttribute('data-sub');
    if (explicit) { space(sub); sub.appendChild(document.createTextNode(explicit)); }

    // Кнопки, вклеенные ПРЯМО В ТЕКСТ заголовка («+» на трекере привычек), —
    // это действие страницы, а не часть названия: их место в ряду действий.
    // Исключение — «i» (.ui-info, справка из БЗ /kb-help.js): её место рядом с названием.
    Array.prototype.slice.call(h1.children).forEach(function (c) {
      if ((c.tagName === 'BUTTON' || c.tagName === 'A') && !c.classList.contains('ui-info')) leftovers.push(c);
    });

    leftovers.forEach(function (nd) { tools.appendChild(nd); });

    // Опустевшие обёртки и текстовые огрызки родного <header> не тащим.
    wrappers.forEach(function (w) { if (!w.children.length) w.remove(); });
    Array.prototype.slice.call(hdr.childNodes).forEach(function (nd) {
      if (nd.nodeType === 3) hdr.removeChild(nd);
    });

    hdr.appendChild(row);
    hdr.appendChild(sub);
    hdr.appendChild(tools);
    return hdr;
  }

  // Значок, версия и счётчик внутри заголовка — каждый проход, а не только при сборке:
  // страницы дописывают их в H1 скриптом уже после того, как шапка собрана, и разовой
  // уборки не хватало (на /projects из-за этого счётчик двоился).
  function sweep(hdr) {
    var h1  = hdr.querySelector('.ph-ttl > h1, .ph-ttl > .ph-t');
    var sub = hdr.querySelector('.ph-s');
    var ver = hdr.querySelector('.ph-ver');
    if (!h1) return;
    var tools = hdr.querySelector('.ph-tools');
    var moved = false;
    Array.prototype.slice.call(h1.children).forEach(function (c) {
      if (c.tagName === 'svg' || c.tagName === 'SVG') { c.remove(); moved = true; return; }
      if (isBadge(c)) { if (ver) { ver.appendChild(c); moved = true; } return; }
      if (c.classList.contains('ui-info')) return; // «i» остаётся рядом с названием
      if ((c.tagName === 'BUTTON' || c.tagName === 'A') && tools) { tools.appendChild(c); moved = true; return; }
      if (isCounter(c) && sub) { space(sub); sub.appendChild(c); moved = true; }
    });
    return moved;
  }

  // Кнопки платформы переезжают в правый блок. Порядок наводим КАЖДЫЙ проход:
  // бургер и кнопка обновления создаются разными скриптами и в разное время, и при
  // простом «доложить недостающую» они на части страниц вставали задом наперёд.
  function adopt(hdr) {
    var act = hdr.querySelector('.ph-act');
    if (!act) return false;
    var want = [], i;
    for (i = 0; i < BTNS.length; i++) {
      var b = document.getElementById(BTNS[i]);
      if (b) want.push(b);
    }
    var same = want.length === act.children.length;
    for (i = 0; same && i < want.length; i++) same = act.children[i] === want[i];
    if (same) return false;
    want.forEach(function (b) { act.appendChild(b); });
    return true;
  }

  function tick() {
    // Чип баланса проекта (SEO-хаб и все страницы кабинетов) — раньше сборки шапки: у SEO-хаба своей header.ph и H1 нет.
    try { if (window.CFBankChip) window.CFBankChip.attach(); } catch (e) { /* чип не критичен */ }
    var hdr = document.querySelector('header.ph');
    var changed = false;
    if (!hdr) {
      var h1 = findH1();
      if (!h1) return false;
      hdr = restructure(h1);
      if (!hdr) return false;
      changed = true;
    }
    if (sweep(hdr)) changed = true;
    if (adopt(hdr)) changed = true;
    fit(hdr);
    return changed;
  }

  // <h1 data-fit> — заголовок строго в ОДНУ строку (16.09.2026, трекер привычек, запрос
  // Константина). Кегль берётся из /set как обычно и уменьшается ТОЛЬКО если строка не
  // влезает до кнопок. Пересчёт — при смене ширины или текста, не на каждую мутацию.
  function fit(hdr) {
    var h = hdr.querySelector('.ph-ttl > h1[data-fit]');
    if (!h) return;
    var box = h.parentElement, key = box.clientWidth + '|' + h.textContent;
    if (h.__fitKey === key) return;
    h.__fitKey = key;
    h.style.fontSize = '';
    h.style.whiteSpace = 'nowrap';
    var have = box.clientWidth, need = h.scrollWidth;
    if (have > 0 && need > have) {
      var fs = parseFloat(getComputedStyle(h).fontSize) || 32;
      h.style.fontSize = Math.max(16, Math.floor(fs * have / need * 10) / 10) + 'px';
    }
  }
  window.addEventListener('resize', function () {
    var h = document.querySelector('.ph-ttl > h1[data-fit]');
    if (h) { h.__fitKey = null; schedule(); }
  });

  // ---- когда пересобирать ----------------------------------------------------
  // Раньше здесь был вечный setInterval(500) — как у burger-space.js и hard-refresh.js.
  // На каждой странице портала это три опроса DOM в секунду до закрытия вкладки,
  // просто чтобы поймать момент, когда страница дорисует заголовок после входа.
  // Теперь основной сигнал — MutationObserver, а опрос остаётся только страховкой
  // на время загрузки и сам выключается, когда шапка собрана и перестала меняться.
  var timer = null, calm = 0, queued = false;

  function schedule() {
    if (queued) return;
    queued = true;
    // Один проход на кадр: страница, рисующая список из ста строк, даёт сотни
    // мутаций подряд, а пересобирать шапку нужно один раз.
    requestAnimationFrame(function () { queued = false; tick(); });
  }

  function poll() {
    var hdr = document.querySelector('header.ph');
    var act = hdr && hdr.querySelector('.ph-act');
    if (tick() || !act || !act.children.length) { calm = 0; return; }
    // Шапка собрана, кнопки на месте, три секунды ничего не менялось — опрос
    // выключаем совсем: дальше за изменениями следит наблюдатель.
    if (++calm >= 6 && timer) { clearInterval(timer); timer = null; }
  }

  function start() {
    tick();
    timer = setInterval(poll, 500);
    if (window.MutationObserver) {
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  // 17.09.2026: файл грузится синхронно из sidebar.js, но собирать шапку ДО скриптов
  // страницы нельзя — они пишут в H1 и подзаголовок позже, и шапка пересобиралась
  // второй раз (дёргались другие страницы). Поэтому старт — как раньше.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
