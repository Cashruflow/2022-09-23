// Виджет «Аналитика Threads»: 4 карточки (публикации, просмотры, ответы, новые подписчики) за 7 дней.
// Самодостаточный файл: window.renderThreadsAnalytics(containerEl, opts) -> Promise.
// Данные: GET /api/threads/analytics (cards.{posts,views,replies,followers}: cur, prev, series[7]).
// opts.onNoInsights — если задан, вместо собственной плашки «нет прав» вызывается он (страница показывает свою).
// Подключение: <script src="/threads-analytics-widget.js?v=4"></script>. При правках поднимать ?v= во ВСЕХ местах.
// Вид (28.10.2026, редизайн /threads): плитка-значок у заголовка, число, «Предыдущие» + стрелка в пилюле,
// 7 столбиков с подписями дней (на телефоне — справа от числа, без подписей). Цвета — только токены --ui-*,
// кнопки — роль .btn, пустые состояния — общий .ui-empty, раскладка карточек — .ui-auto (ui.css).
(function () {
  if (window.renderThreadsAnalytics) return;

  var CSS = ''
    + '.tha-grid{--gap:var(--ui-gap,16px)}'
    + '.tha-card{display:flex;flex-direction:column;gap:6px;min-width:0;box-shadow:var(--ui-shadow-sm)}'
    + '.tha-title{display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:500;color:var(--ui-tx-2,#8b8b8b)}'
    + '.tha-ic{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;flex:0 0 auto;background:var(--ui-brand-soft);color:var(--ui-brand-soft-tx)}'
    + '.tha-ic svg{width:16px;height:16px;fill:none;stroke:currentColor}'
    + '.tha-ic.is-violet{background:var(--ui-violet-soft);color:var(--ui-violet-soft-tx)}'
    + '.tha-ic.is-ok{background:var(--ui-ok-soft);color:var(--ui-ok-soft-tx)}'
    + '.tha-ic.is-warn{background:var(--ui-warn-soft);color:var(--ui-warn-soft-tx)}'
    + '.tha-row{display:flex;flex-direction:column;gap:6px;flex:1 1 auto;min-width:0}'
    + '.tha-main{min-width:0;display:flex;flex-direction:column;gap:6px}'
    + '.tha-num{font-size:40px;font-weight:700;line-height:1.05;letter-spacing:-.02em;color:var(--ui-tx,#e8e8e8);font-variant-numeric:tabular-nums}'
    + '.tha-prev{font-size:13px;color:var(--ui-tx-2,#8b8b8b);display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-variant-numeric:tabular-nums}'
    + '.tha-up,.tha-down{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:999px;font-size:12px;font-weight:700}'
    + '.tha-up{background:var(--ui-ok-soft);color:var(--ui-ok-soft-tx)}'
    + '.tha-down{background:var(--ui-danger-soft);color:var(--ui-danger-soft-tx)}'
    + '.tha-note{font-size:12.5px;color:var(--ui-tx-3,#666)}'
    + '.tha-bars{display:flex;align-items:stretch;gap:8px;height:118px;margin-top:auto;padding-top:10px}'
    + '.tha-bar{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px}'
    + '.tha-col{position:relative;flex:1 1 auto;width:100%}'
    + '.tha-col i{position:absolute;left:0;right:0;bottom:0;height:var(--h,3%);min-height:3px;border-radius:6px;background:color-mix(in srgb,var(--ui-tx,#e8e8e8) 14%,var(--ui-card-bg,#141414))}'
    + '.tha-bar.tha-last .tha-col i{background:var(--ui-brand,#00a0ff)}'
    + '.tha-bar span{font-size:11px;line-height:1;color:var(--ui-tx-3,#666)}'
    + '.tha-bar.tha-last span{color:var(--ui-tx,#e8e8e8);font-weight:600}'
    + '@media(max-width:768px){.tha-row{flex-direction:row;align-items:flex-end;gap:14px}.tha-main{flex:1 1 auto}'
    + '.tha-num{font-size:32px}.tha-bars{flex:0 0 132px;height:64px;gap:5px;margin:0;padding:0}.tha-bar span{display:none}.tha-col i{border-radius:4px}}'
    + '.tha-warn{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 12px 12px 16px;border-radius:var(--ui-card-radius,12px);'
    + 'background:var(--ui-danger-soft);border:1px solid var(--ui-danger-soft-line);color:var(--ui-tx,#e8e8e8);font-size:13.5px}'
    + '.tha-warn+.tha-grid{margin-top:var(--ui-gap,16px)}'
    + '.tha-warn__ico{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;background:color-mix(in srgb,var(--ui-danger,#f87171) 16%,var(--ui-card-bg,#141414));color:var(--ui-danger-soft-tx)}'
    + '.tha-warn__ico svg{width:16px;height:16px;fill:none;stroke:currentColor}'
    + '.tha-warn__t{flex:1 1 200px;min-width:0}'
    + '.tha-warn__t small{display:block;font-size:12.5px;color:var(--ui-tx-2,#8b8b8b)}'
    + '.tha-msg .ui-empty__ico{box-sizing:border-box;width:48px;height:48px;padding:13px;border-radius:16px;background:var(--ui-surface-2,#1a1a1a);color:var(--ui-tx-3,#666)}'
    + '.tha-msg .btn{margin-top:12px}'
    + '.tha-btn-i{width:16px;height:16px;fill:none;stroke:currentColor}'
    + '.tha-upd{display:flex;align-items:center;gap:8px;margin-top:14px;padding:0 4px;font-size:12.5px;color:var(--ui-tx-3,#666)}'
    + '.tha-upd svg{width:15px;height:15px;flex:0 0 auto;fill:none;stroke:currentColor}';

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
  function ico(id, cls) {
    return '<svg class="' + (cls || '') + '" aria-hidden="true"><use href="' + (window.ICONS_URL || '/assets/icons.svg?v=32') + '#' + id + '"></use></svg>';
  }
  // день недели по ключу YYYY-MM-DD: только T00:00:00Z + getUTCDay (локальная полночь МСК дала бы вчера)
  var WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  function wd(day) {
    var d = new Date(String(day || '') + 'T00:00:00Z');
    return isNaN(d) ? '' : WD[d.getUTCDay()];
  }

  var DEFS = [
    { key: 'posts', title: 'Ваши действия', sub: 'публикации', icon: 'i-edit', tone: '' },
    { key: 'views', title: 'Просмотры', sub: '', icon: 'i-eye', tone: 'is-violet' },
    { key: 'replies', title: 'Ответы', sub: '', icon: 'i-reply', tone: 'is-ok' },
    { key: 'followers', title: 'Новые подписчики', sub: '', icon: 'i-users', tone: 'is-warn' }
  ];

  function bars(series, dayLabels) {
    var n = 7, max = 0;
    series.forEach(function (v) { if (v > max) max = v; });
    var out = '<div class="tha-bars" role="img" aria-label="По дням за неделю">';
    for (var i = 0; i < n; i++) {
      var v = series[i];
      var h = v == null || max === 0 ? 3 : Math.max(3, Math.round((v / max) * 100));
      out += '<div class="tha-bar' + (i === n - 1 ? ' tha-last' : '') + '" title="' + esc((dayLabels[i] || '') + ': ' + fmt(v)) + '">'
        + '<div class="tha-col"><i style="--h:' + h + '%"></i></div><span>' + esc(wd(dayLabels[i])) + '</span></div>';
    }
    return out + '</div>';
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
      + '<div class="tha-title"><span class="tha-ic ' + def.tone + '">' + ico(def.icon) + '</span>' + esc(def.title) + '</div>'
      + '<div class="tha-row"><div class="tha-main">'
      + '<div class="tha-num">' + fmt(c.cur) + '</div>'
      + '<div class="tha-prev">Предыдущие: ' + fmt(c.prev) + ' ' + arrow + '</div>' + note + '</div>'
      + bars(series, labels) + '</div></div>';
  }

  // плашка «нет прав» — тот же вид, что #th-noins на странице
  function warnHtml(title, sub, extra) {
    return '<div class="tha-warn"><span class="tha-warn__ico">' + ico('i-circle-alert') + '</span>'
      + '<span class="tha-warn__t">' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>'
      + '<button type="button" class="btn btn-sm" id="tha-reconnect">' + ico('i-refresh', 'tha-btn-i') + 'Переподключить</button>' + (extra || '') + '</div>';
  }
  function collectBtn() {
    return '<button type="button" class="btn" id="tha-collect">' + ico('i-refresh', 'tha-btn-i') + '<span class="tha-cl">Собрать сейчас</span></button>';
  }
  // пустое состояние: значок в плитке, заголовок, пояснение (текст «А — Б» делится на заголовок и пояснение)
  function emptyHtml(text, icon, btn) {
    var parts = String(text).split(' — ');
    var t = parts.shift(), s = parts.join(' — ');
    if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
    return '<div class="ui-card tha-msg"><div class="ui-empty is-c">'
      + ico(icon, 'ui-empty__ico') + '<b class="ui-empty__t">' + esc(t) + '</b>'
      + (s ? '<p class="ui-empty__s">' + esc(s) + '</p>' : '') + (btn || '') + '</div></div>';
  }

  window.renderThreadsAnalytics = function (el, opts) {
    opts = opts || {};
    if (!el) return Promise.resolve();
    addCss();
    el.innerHTML = emptyHtml('Загрузка…', 'i-chart');

    // kind: 'empty' — данных нет (значок графика), иначе ошибка (значок предупреждения)
    function msg(text, withReconnect, withCollect, kind) {
      if (withReconnect) {
        var p = String(text).split(' — ');
        el.innerHTML = warnHtml(p[0], p.slice(1).join(' — ').replace(/^./, function (c) { return c.toUpperCase(); }), withCollect ? collectBtn() : '');
      } else {
        el.innerHTML = emptyHtml(text, kind === 'empty' ? 'i-chart' : 'i-circle-alert',
          withCollect ? collectBtn() : '');
      }
      var rc = el.querySelector('#tha-reconnect');
      if (rc) rc.onclick = function () { location.href = '/api/threads/oauth/start'; };
      var cb = el.querySelector('#tha-collect');
      if (cb) cb.onclick = function () {
        cb.disabled = true; cb.querySelector('.tha-cl').textContent = 'Собираю…';
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
          if (opts.onNoInsights) { opts.onNoInsights(); el.innerHTML = emptyHtml('Нет доступа к статистике Threads.', 'i-circle-alert'); }
          else msg('Нет прав на статистику Threads — переподключите Threads с правом insights', true, false);
          return;
        }
        if (!x.ok || d.error && !d.cards) {
          if (d.code === 'not_connected') return msg('Threads не подключён', true, false);
          return msg(d.error || 'Не удалось загрузить аналитику', false, false);
        }
        if (d.collect_error && d.collect_error.code === 'no_insights_permission' && opts.onNoInsights) opts.onNoInsights();
        if (!d.has_data) return msg('Данных пока нет — статистика начнёт копироваться после первого сбора', false, true, 'empty');
        var html = '<div class="ui-auto tha-grid" style="--min:460px">' + DEFS.map(function (def) { return cardHtml(def, d.cards[def.key], d.days); }).join('') + '</div>';
        html += '<div class="tha-upd">' + ico('i-clock') + '<span>За последние 7 дней, в сравнении с предыдущими 7. Обновлено: ' + esc(d.updated_at ? (typeof window.locTime === 'function' ? window.locTime(d.updated_at) : String(d.updated_at)) : '—') + '</span></div>';
        if (d.collect_error && d.collect_error.code === 'no_insights_permission' && !opts.onNoInsights) {
          html = warnHtml('Нет прав на статистику Threads', 'Показаны ранее собранные данные') + html;
        }
        el.innerHTML = html;
        var rc = el.querySelector('#tha-reconnect');
        if (rc) rc.onclick = function () { location.href = '/api/threads/oauth/start'; };
      })
      .catch(function (e) { msg(e.message || 'Не удалось загрузить аналитику', false, false); });
  };
})();
