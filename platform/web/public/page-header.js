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
  var SUB_MAX = 90;
  var SKIP = '#login,.modal,dialog,[role="dialog"],#mvModal,.drawer-content,.modal-sidebar,.sb-search-results';
  var COUNTER = /(^|[-_ ])(cnt|count|total|stats|badge|kick|muted|sub|shown)($|[-_ ])/i;
  var KICKER = /^[A-ZА-ЯЁ0-9 .,·•\-\/]{2,40}$/;
  var BTNS = ['hard-refresh', 'sb-burger'];
  function el(tag, cls) { var e = document.createElement(tag); e.className = cls; return e; }
  function txt(n) { return (n.textContent || '').trim(); }
  function isCounter(e) { return COUNTER.test(e.className || '') || COUNTER.test(e.id || ''); }
  function isBadge(e) { return /^mvBadge/.test(e.id || ''); }
  function isSubEl(e) { return e.matches && e.matches('.lead,.sub,.ph1-sub'); }
  function isBack(e) { return e.tagName === 'A' && /^[←‹<]/.test(txt(e)); }
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
      if (!h.getClientRects().length) continue;
      return h;
    }
    return null;
  }
  function space(sub) {
    var last = sub.lastChild;
    if (last && !(last.nodeType === 3 && !last.nodeValue.trim())) {
      sub.appendChild(document.createTextNode(' '));
    }
  }
  function restructure(h1) {
    var parent = h1.parentElement;
    if (!parent) return null;
    var hostHeader = null;
    if (parent.tagName === 'HEADER') hostHeader = parent;
    else if (parent.parentElement && parent.parentElement.tagName === 'HEADER') hostHeader = parent.parentElement;
    var onHeader = !!hostHeader;
    var before = h1.previousElementSibling, after = h1.nextElementSibling;
    var hdr = hostHeader || document.createElement('header');
    if (!onHeader) parent.insertBefore(hdr, h1);
    hdr.className = 'ph';
    hdr.removeAttribute('style');
    var anc = hdr.parentElement, padded = false;
    while (anc && anc !== document.body) {
      var cs = getComputedStyle(anc);
      if (parseFloat(cs.paddingLeft) > 4 || parseFloat(cs.paddingRight) > 4) { padded = true; break; }
      anc = anc.parentElement;
    }
    if (padded) hdr.classList.add('ph-inner');
    var node = hdr;
    for (var lvl = 0; lvl < 3 && node.parentElement && node.parentElement !== document.body; lvl++) {
      var d = getComputedStyle(node.parentElement).display;
      if (d === 'flex' || d === 'inline-flex' || d === 'grid' || d === 'inline-grid') {
        node.style.flex = '1 1 100%'; node.style.gridColumn = '1/-1'; node.style.minWidth = '0';
        break;
      }
      node = node.parentElement;
    }
    var row  = el('div', 'ph-row'), ttl  = el('div', 'ph-ttl'), side = el('div', 'ph-side'),
        act  = el('div', 'ph-act'), ver  = el('div', 'ph-ver'), sub  = el('p', 'ph-s'),
        tools = el('div', 'ph-tools');
    var pool = [], wrappers = [];
    if (onHeader) {
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
      [-1, 1].forEach(function (dir) {
        var e = dir < 0 ? before : after;
        for (var k = 0; k < 3 && e; k++) {
          if (isBack(e)) { pool.push(e); return; }
          e = dir < 0 ? e.previousElementSibling : e.nextElementSibling;
        }
      });
    }
    var subParts = [], leftovers = [];
    pool.forEach(function (nd) {
      if (nd === h1) return;
      if (isBack(nd)) { nd.remove(); return; }
      if (isBadge(nd)) { ver.appendChild(nd); return; }
      if (isSubEl(nd)) { if (txt(nd).length <= SUB_MAX) subParts.push(nd); return; }
      if (isKicker(nd)) { nd.remove(); return; }
      leftovers.push(nd);
    });
    subParts.forEach(function (nd) { space(sub); sub.appendChild(nd); });
    side.appendChild(act); side.appendChild(ver);
    row.appendChild(ttl); row.appendChild(side);
    ttl.appendChild(h1);
    var explicit = h1.getAttribute('data-sub');
    if (explicit) { space(sub); sub.appendChild(document.createTextNode(explicit)); }
    Array.prototype.slice.call(h1.children).forEach(function (c) {
      if (c.tagName === 'BUTTON' || c.tagName === 'A') leftovers.push(c);
    });
    leftovers.forEach(function (nd) { tools.appendChild(nd); });
    wrappers.forEach(function (w) { if (!w.children.length) w.remove(); });
    Array.prototype.slice.call(hdr.childNodes).forEach(function (nd) {
      if (nd.nodeType === 3) hdr.removeChild(nd);
    });
    hdr.appendChild(row); hdr.appendChild(sub); hdr.appendChild(tools);
    return hdr;
  }
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
      if ((c.tagName === 'BUTTON' || c.tagName === 'A') && tools) { tools.appendChild(c); moved = true; return; }
      if (isCounter(c) && sub) { space(sub); sub.appendChild(c); moved = true; }
    });
    return moved;
  }
  function adopt(hdr) {
    var act = hdr.querySelector('.ph-act');
    if (!act) return false;
    var want = [], i;
    for (i = 0; i < BTNS.length; i++) { var b = document.getElementById(BTNS[i]); if (b) want.push(b); }
    var same = want.length === act.children.length;
    for (i = 0; same && i < want.length; i++) same = act.children[i] === want[i];
    if (same) return false;
    want.forEach(function (b) { act.appendChild(b); });
    return true;
  }
  function tick() {
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
    return changed;
  }
  var timer = null, calm = 0, queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; tick(); });
  }
  function poll() {
    var hdr = document.querySelector('header.ph');
    var act = hdr && hdr.querySelector('.ph-act');
    if (tick() || !act || !act.children.length) { calm = 0; return; }
    if (++calm >= 6 && timer) { clearInterval(timer); timer = null; window.__phCalm = true; }
  }
  function start() {
    tick();
    timer = setInterval(poll, 500);
    if (window.MutationObserver) {
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
