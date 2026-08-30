// Шапка страницы: собирает единый компонент .ph из того, что написано на странице (ADR-147).
//
// Зачем файл. Полсотни страниц портала писали шапку каждая по-своему: где-то иконка
// слева от H1, где-то полоса-разделитель, где-то ссылка «← AI-платформа», дублирующая
// бургер, где-то счётчик внутри заголовка, а сверху у всех — пустая строка 46px под
// fixed-кнопки, место под которые резервировала распорка burger-space.js. Правило
// «делай шапку вот так» в документации это не чинит: оно чинится тем, что шапку
// собирает один файл.
//
// Тот же приём, что у sidebar.js, hard-refresh.js и cab-burger.js: разметку рисует
// скрипт, подключённый на каждой странице, а не копия вёрстки в каждом файле.
//
// Что делает: находит <h1> страницы, заворачивает его в <header class="ph"> с рядами
// .ph-row / .ph-s / .ph-tools (геометрия — ui.css), выкидывает значок из заголовка и
// ссылку-возврат, уносит счётчики из H1 в подзаголовок и забирает кнопки обновления
// и меню к себе в ряд — после этого распорка не нужна и пустая строка исчезает.
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
  var SKIP = '#login,.modal,dialog,[role="dialog"],#mvModal,.drawer-content,.modal-sidebar,.sb-search-results';

  // Счётчик/мета в заголовке: «Доступы (22)», «Проекты 262», «— расходы на ИИ».
  var COUNTER = /(^|[-_ ])(cnt|count|total|stats|badge|kick|muted|sub)($|[-_ ])/i;

  // Киккер над заголовком: короткая строка капсом («РАБОТА · ПРОЕКТЫ»).
  var KICKER = /^[A-ZА-ЯЁ0-9 .,·•\-\/]{2,40}$/;

  function el(tag, cls) { var e = document.createElement(tag); e.className = cls; return e; }
  function txt(n) { return (n.textContent || '').trim(); }
  function isCounter(e) { return COUNTER.test(e.className || '') || COUNTER.test(e.id || ''); }
  function isBadge(e) { return /^mvBadge/.test(e.id || ''); }
  function isSubEl(e) { return e.matches && e.matches('.lead,.sub,.ph1-sub'); }
  function isBack(e) {
    return e.tagName === 'A' && /^[←‹<]/.test(txt(e));
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

  function restructure(h1) {
    var parent = h1.parentElement;
    if (!parent) return null;

    // Родной <header> переиспользуем — иначе заводим свой прямо перед заголовком.
    var onHeader = parent.tagName === 'HEADER';
    // Соседей заголовка запоминаем ДО вставки: после неё previousElementSibling —
    // это уже наш пустой <header>, а не киккер страницы.
    var before = h1.previousElementSibling, after = h1.nextElementSibling;
    var hdr = onHeader ? parent : document.createElement('header');
    if (!onHeader) parent.insertBefore(hdr, h1);
    hdr.className = 'ph';
    hdr.removeAttribute('style');
    // Внутри уже отбитого контейнера (.wrap/.container/.ui-page) своих полей не добавляем.
    if (hdr.parentElement !== document.body) hdr.classList.add('ph-inner');
    // Если шапка оказалась внутри флекс/грид-ряда, она забирает всю строку: иначе
    // соседи по ряду её сжимают и кнопки уезжают за край экрана. Ряд бывает не
    // прямо над заголовком (медкарта: H1 в блоке, а флекс с лозунгом — уровнем
    // выше), поэтому ищем ближайшего предка, который сам является элементом ряда.
    var node = hdr;
    for (var lvl = 0; lvl < 3 && node.parentElement && node.parentElement !== document.body; lvl++) {
      var d = getComputedStyle(node.parentElement).display;
      if (d === 'flex' || d === 'inline-flex' || d === 'grid' || d === 'inline-grid') {
        node.style.flex = '1 1 100%'; node.style.gridColumn = '1/-1'; node.style.minWidth = '0';
        break;
      }
      node = node.parentElement;
    }

    var row = el('div', 'ph-row'), ttl = el('div', 'ph-ttl'),
        act = el('div', 'ph-act'), sub = el('p', 'ph-s'), tools = el('div', 'ph-tools');

    // Что разбираем. Из родного <header> — всё его содержимое; из обычного
    // контейнера только заголовок и соседей, которые точно принадлежат шапке
    // (значок версии, подзаголовок) — остальное там уже контент страницы.
    var pool = [];
    if (onHeader) {
      pool = Array.prototype.slice.call(hdr.children);
    } else {
      pool.push(h1);
      var n = after;
      while (n && (isSubEl(n) || isBadge(n))) { pool.push(n); n = n.nextElementSibling; }
      if (before && !before.children.length && KICKER.test(txt(before))) pool.push(before);
    }

    var subParts = [], leftovers = [];

    pool.forEach(function (node) {
      if (node === h1) return;
      if (isBack(node)) { node.remove(); return; }                 // дубль бургера
      if (isBadge(node)) { ttl.appendChild(node); return; }        // версия модуля
      if (isSubEl(node)) {
        if (txt(node).length <= SUB_MAX) subParts.push(node);
        return;                                                     // длинное описание — на месте
      }
      if (!node.children.length && KICKER.test(txt(node))) { node.remove(); return; }
      leftovers.push(node);
    });

    // Значок слева от заголовка не рисуем нигде.
    Array.prototype.slice.call(h1.querySelectorAll('svg')).forEach(function (s) { s.remove(); });

    // Значок версии, если он был внутри H1 (медкарта, CRM, трекер), — наружу,
    // иначе H1 не может резаться многоточием, не съев версию вместе с текстом.
    Array.prototype.slice.call(h1.children).forEach(function (c) {
      if (isBadge(c)) ttl.appendChild(c);
    });

    // Счётчики из заголовка — в подзаголовок. Именно ПЕРЕЕЗДОМ узла: страница
    // продолжает писать в него по id, просто теперь он виден строкой ниже.
    Array.prototype.slice.call(h1.children).forEach(function (c) {
      if (isCounter(c)) subParts.push(c);
    });

    row.appendChild(ttl); row.appendChild(act);
    ttl.insertBefore(h1, ttl.firstChild);

    var explicit = h1.getAttribute('data-sub');
    if (explicit) sub.appendChild(document.createTextNode(explicit));
    subParts.forEach(function (node, i) {
      if (i || explicit) sub.appendChild(document.createTextNode(' '));
      sub.appendChild(node);
    });

    leftovers.forEach(function (node) { tools.appendChild(node); });

    // Текстовые огрызки родного <header> в новую шапку не тащим.
    Array.prototype.slice.call(hdr.childNodes).forEach(function (n) {
      if (n.nodeType === 3) hdr.removeChild(n);
    });

    hdr.appendChild(row);
    hdr.appendChild(sub);
    hdr.appendChild(tools);
    return hdr;
  }

  // Кнопки платформы переезжают в ряд заголовка: обновление слева от меню — тот же
  // порядок, что был у fixed-версии (right:62 и right:12).
  function adopt(hdr) {
    var act = hdr.querySelector('.ph-act');
    if (!act) return;
    ['hard-refresh', 'sb-burger'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b && b.parentElement !== act) act.appendChild(b);
    });
  }

  function tick() {
    var hdr = document.querySelector('header.ph');
    if (!hdr) {
      var h1 = findH1();
      if (!h1) return;
      hdr = restructure(h1);
      if (!hdr) return;
    }
    adopt(hdr);
  }

  function start() {
    tick();
    // Заголовок и кнопки появляются асинхронно (страница ждёт вход, sidebar.js
    // рисует меню скриптом) — следим, как это делают burger-space.js и hard-refresh.js.
    setInterval(tick, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
