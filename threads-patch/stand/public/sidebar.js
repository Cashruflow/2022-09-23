/* СТЕНД: заглушка вместо боевого sidebar.js (+ page-header.js, mhead.js). Делает только то, что видно
   на скриншоте: шапку .ph из <h1>+p.ph-s (как page-header.js, ADR-147), плавающую рейку ПК (#506) с
   пунктом «Треды» (i-messages-square — новый символ), кнопки ⚙/☰ на телефоне (M-77). На сервер НЕ едет. */
(function () {
  var p = new URLSearchParams(location.search);
  if (p.get('theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');
  var app = document.getElementById('app'); if (!app) return;
  var h1 = app.querySelector(':scope > h1'), s = app.querySelector(':scope > p.ph-s');
  var ph = document.createElement('header'); ph.className = 'ph';
  ph.innerHTML = '<div class="ph-row"><div class="ph-ttl"></div></div>';
  ph.querySelector('.ph-ttl').appendChild(h1); if (s) ph.appendChild(s);
  app.insertBefore(ph, app.firstChild);
  var I = function (id) { return '<svg><use href="/assets/icons.svg#' + id + '"></use></svg>'; };
  var st = document.createElement('style');
  st.textContent = '@media (min-width:769px){body{padding-left:132px}#sb{position:fixed;left:24px;top:24px;bottom:24px;width:84px;padding:20px;border-radius:24px;background:var(--ui-surface);box-shadow:var(--ui-shadow-lg);display:flex;flex-direction:column;gap:16px;z-index:500}'
    + '#sb .a{width:44px;height:44px;border-radius:50%;background:var(--ui-brand);color:#fff;display:grid;place-items:center;font-weight:600}'
    + '#sb .i{position:relative;height:52px;width:44px;display:grid;place-items:center;color:var(--ui-tx-2)}#sb .i svg{width:22px;height:22px}'
    + '#sb .i.on{color:var(--ui-brand)}#sb .i.on::before{content:"";position:absolute;inset:4px 0;border-radius:12px;background:color-mix(in srgb,var(--ui-brand) 12%,transparent)}#sb .i svg{position:relative}'
    + '#sb .i .ui-badge{position:absolute;top:6px;right:-10px}#sb .sp{flex:1}}'
    + '@media (max-width:768px){#sb{display:none}#mb{position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:600}#mb b{width:42px;height:42px;border-radius:10px;background:var(--ui-surface-2);border:1px solid var(--ui-line);color:var(--ui-tx);display:grid;place-items:center}#mb svg{width:19px;height:19px}.ph-row{padding-right:100px}}'
    + '@media (min-width:769px){#mb{display:none}}';
  document.head.appendChild(st);
  var sb = document.createElement('nav'); sb.id = 'sb';
  sb.innerHTML = '<div class="a">КЛ</div>' + ['i-notify', 'i-tasks', 'i-ticket', 'i-messages-square', 'i-message', 'i-mail', 'i-calendar', 'i-cash'].map(function (x) {
    return '<span class="i' + (x === 'i-messages-square' ? ' on' : '') + '" title="' + (x === 'i-messages-square' ? 'Треды' : '') + '">' + I(x) + (x === 'i-message' ? '<span class="ui-badge">3</span>' : '') + '</span>';
  }).join('') + '<span class="sp"></span><span class="i">' + I('i-settings') + '</span>';
  document.body.appendChild(sb);
  var mb = document.createElement('div'); mb.id = 'mb';
  mb.innerHTML = '<b>' + I('i-settings') + '</b><b>' + I('i-menu') + '</b>';
  document.body.appendChild(mb);
})();
