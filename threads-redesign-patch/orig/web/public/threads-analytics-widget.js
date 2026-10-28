// Виджет «Аналитика Threads»: 4 карточки (публикации, просмотры, ответы, новые подписчики) за 7 дней.
// Самодостаточный файл: window.renderThreadsAnalytics(containerEl, opts) -> Promise.
// Данные: GET /api/threads/analytics (cards.{posts,views,replies,followers}: cur, prev, series[7]).
// opts.onNoInsights — если задан, вместо собственной плашки «нет прав» вызывается он (страница показывает свою).
// Подключение: <script src="/threads-analytics-widget.js?v=3"></script>. При правках поднимать ?v= во ВСЕХ местах.
(function () {
  if (window.renderThreadsAnalytics) return;

  var CSS = ''
    + '.tha-grid{display:grid;grid-template-columns:1fr;gap:var(--ui-gap,22px)}'
    + '@media(min-width:769px){.tha-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    + '.tha-card{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;min-width:0}'
    + '.tha-main{min-width:0;display:flex;flex-direction:column;gap:6px}'
    + '.tha-title{font-size:13px;color:var(--ui-tx-2,#8b8b8b)}'
    + '.tha-num{font-size:34px;font-weight:600;line-height:1.1;color:var(--ui-tx,#e8e8e8);font-variant-numeric:tabular-nums}'
    + '.tha-prev{font-size:13px;color:var(--ui-tx-2,#8b8b8b);display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
    + '.tha-up{color:var(--ui-ok,#34d399)}.tha-down{color:var(--ui-danger,#f87171)}'
    + '.tha-note{font-size:12px;color:var(--ui-tx-3,#666)}'
    + '.tha-bars{flex:0 0 auto;width:132px;height:64px;display:block}'
    + '.tha-bars rect{fill:var(--ui-tx,#e8e8e8);opacity:.28}'
    + '.tha-bars rect.tha-last{opacity:1}'
    + '.tha-msg{display:flex;align-items:center;gap:12px;flex-wrap:wrap;color:var(--ui-tx-2,#8b8b8b);font-size:13px}'
    + '.tha-msg .tha-dot{width:9px;height:9px;border-radius:50%;background:var(--ui-danger,#f87171);flex:0 0 auto}'
    + '.tha-msg .btn{margin-left:auto}'
    + '.tha-upd{margin-top:12px;font-size:12px;color:var(--ui-tx-3,#666)}';

  function addCss() {
    if (document.getElementById('tha-css')) return;
    var s = document.createElement('style');
    s.id = 'tha-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('ru-RU'); }

  var DEFS = [
    { key: 'posts', title: 'Ваши действия', sub: 'публикации' },
    { key: 'views', title: 'Просмотры', sub: '' },
    { key: 'replies', title: 'Ответы', sub: '' },
    { key: 'followers', title: 'Новые подписчики', sub: '' }
  ];

  function bars(series, dayLabels) {
    var W = 132, H = 64, n = 7, gap = 6, bw = (W - gap * (n - 1)) / n;
    var max = 0;
    series.forEach(function (v) { if (v > max) max = v; });
    var out = '<svg class="tha-bars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="По дням за неделю">';
    series.forEach(function (v, i) {
      var h = v == null || max === 0 ? 3 : Math.max(3, Math.round((v / max) * (H - 2)));
      var x = i * (bw + gap);
      out += '<rect class="' + (i === n - 1 ? 'tha-last' : '') + '" x="' + x.toFixed(1) + '" y="' + (H - h) + '" width="' + bw.toFixed(1)
        + '" height="' + h + '" rx="3"><title>' + esc((dayLabels[i] || '') + ': ' + fmt(v)) + '</title></rect>';
    });
    return out + '</svg>';
  }

  function cardHtml(def, c, days) {
    var labels = days.slice(7).map(function (d) { return d.day; });
    var series = c.series || [];
    var arrow = '';
    if (c.cur != null && c.prev != null && c.cmp !== false) { // cmp=false — история неполна, стрелка была бы ложной
      if (c.cur > c.prev) arrow = '<span class="tha-up" aria-label="выросло">↑</span>';
      else if (c.cur < c.prev) arrow = '<span class="tha-down" aria-label="снизилось">↓</span>';
    }
    var note = '';
    if (def.key === 'followers') {
      if (c.now != null) note = '<div class="tha-note">Сейчас подписчиков: ' + fmt(c.now) + '</div>';
      if (c.cur == null) note += '<div class="tha-note">История копится — прирост появится со второго дня</div>';
    } else if (def.sub) {
      note = '<div class="tha-note">' + esc(def.sub) + '</div>';
    }
    return '<div class="ui-card tha-card">'
      + '<div class="tha-main"><div class="tha-title">' + esc(def.title) + '</div>'
      + '<div class="tha-num">' + fmt(c.cur) + '</div>'
      + '<div class="tha-prev">Предыдущие: ' + fmt(c.prev) + ' ' + arrow + '</div>' + note + '</div>'
      + bars(series, labels) + '</div>';
  }

  window.renderThreadsAnalytics = function (el, opts) {
    opts = opts || {};
    if (!el) return Promise.resolve();
    addCss();
    el.innerHTML = '<div class="ui-card tha-msg">Загрузка…</div>';

    function msg(text, withReconnect, withCollect) {
      el.innerHTML = '<div class="ui-card tha-msg"><span class="tha-dot"></span><span>' + esc(text) + '</span>'
        + (withReconnect ? '<button type="button" class="btn" id="tha-reconnect">Переподключить</button>' : '')
        + (withCollect ? '<button type="button" class="btn" id="tha-collect">Собрать сейчас</button>' : '') + '</div>';
      var rc = el.querySelector('#tha-reconnect');
      if (rc) rc.onclick = function () { location.href = '/api/threads/oauth/start'; };
      var cb = el.querySelector('#tha-collect');
      if (cb) cb.onclick = function () {
        cb.disabled = true; cb.textContent = 'Собираю…';
        // ERR-510: любой исход возвращает кнопку (msg() перерисовывает её) и показывает причину
        fetch('/api/threads/analytics/collect', { method: 'POST' })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d || {} }; }); })
          .then(function (x) {
            var d = x.d, code = d.code || (d.collect_error && d.collect_error.code);
            if (x.status === 403 || code === 'no_insights_permission') {
              if (code !== 'no_insights_permission') return msg(d.error || 'Доступ запрещён', false, true);
              if (opts.onNoInsights) { opts.onNoInsights(); return; } // страница показывает свою плашку; карточки не стираем
              return msg('Нет прав на статистику Threads — переподключите Threads с правом insights', true, true);
            }
            if (!x.ok) return msg(d.error || 'Не удалось собрать статистику', false, true);
            window.renderThreadsAnalytics(el, opts);
          })
          .catch(function (e) { msg((e && e.message) || 'Не удалось собрать статистику', false, true); });
      };
    }

    return fetch('/api/threads/analytics')
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        var d = x.d || {};
        if (d.code === 'no_insights_permission') {
          if (opts.onNoInsights) { opts.onNoInsights(); el.innerHTML = '<div class="ui-card tha-msg">Нет доступа к статистике Threads.</div>'; }
          else msg('Нет прав на статистику Threads — переподключите Threads с правом insights', true, false);
          return;
        }
        if (!x.ok || d.error && !d.cards) {
          if (d.code === 'not_connected') return msg('Threads не подключён', true, false);
          return msg(d.error || 'Не удалось загрузить аналитику', false, false);
        }
        if (d.collect_error && d.collect_error.code === 'no_insights_permission' && opts.onNoInsights) opts.onNoInsights();
        if (!d.has_data) return msg('Данных пока нет — статистика начнёт копироваться после первого сбора', false, true);
        var html = '<div class="tha-grid">' + DEFS.map(function (def) { return cardHtml(def, d.cards[def.key], d.days); }).join('') + '</div>';
        html += '<div class="tha-upd">За последние 7 дней, в сравнении с предыдущими 7. Обновлено: ' + esc(d.updated_at ? (typeof window.locTime === 'function' ? window.locTime(d.updated_at) : String(d.updated_at)) : '—') + '</div>';
        if (d.collect_error && d.collect_error.code === 'no_insights_permission' && !opts.onNoInsights) {
          html = '<div class="ui-card tha-msg" style="margin-bottom:12px"><span class="tha-dot"></span><span>Нет прав на статистику Threads — показаны ранее собранные данные</span>'
            + '<button type="button" class="btn" id="tha-reconnect">Переподключить</button></div>' + html;
        }
        el.innerHTML = html;
        var rc = el.querySelector('#tha-reconnect');
        if (rc) rc.onclick = function () { location.href = '/api/threads/oauth/start'; };
      })
      .catch(function (e) { msg(e.message || 'Не удалось загрузить аналитику', false, false); });
  };
})();
