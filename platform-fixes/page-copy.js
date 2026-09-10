/* «Копия для ИИ» — кладёт в буфер всё про текущую страницу одним markdown-блоком. */
(function () {
  if (window.cfCopyPage) return;

  var MAX = 12;
  var errs = [], reqs = [];

  function push(arr, v) { arr.push(v); if (arr.length > MAX) arr.shift(); }

  // Отчёт — список markdown, и перевод строки внутри записи разваливает его на абзацы:
  // сообщение со стеком превращало «Ошибки консоли (1)» в три строки, из которых две
  // выпадали из списка. Схлопываем всё в одну строку.
  function oneLine(v) { return String(v == null ? '' : v).replace(/\s*[\r\n]+\s*/g, ' ⏎ ').trim(); }

  window.addEventListener('error', function (e) {
    if (!e) return;
    if (e.message) push(errs, oneLine(e.message) + (e.filename ? ' @ ' + e.filename + ':' + e.lineno : ''));
    else if (e.target && e.target.src) push(errs, 'не загрузился ресурс: ' + e.target.src);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    push(errs, 'promise: ' + oneLine(r && (r.message || r.toString ? r.toString() : '') || 'без причины'));
  });

  if (window.fetch && !window.fetch.__cfWrapped) {
    var orig = window.fetch;
    window.fetch = function (input, init) {
      // Адрес: строка, Request (у него есть .url) или URL/что угодно приводимое к строке.
      // Раньше для URL-объекта бралось несуществующее .url, и в отчёт уезжало
      // «GET  → 500» без адреса — понять, какой запрос упал, было нельзя.
      var url = typeof input === 'string' ? input
              : (input && typeof input.url === 'string' ? input.url : String(input || ''));
      var method = (init && init.method) || (input && input.method) || 'GET';
      return orig.apply(this, arguments).then(function (res) {
        if (!res.ok) {
          try {
            res.clone().text().then(function (t) {
              push(reqs, method + ' ' + url + ' → ' + res.status + (t ? ' · ' + t.slice(0, 200) : ''));
            }).catch(function () { push(reqs, method + ' ' + url + ' → ' + res.status); });
          } catch (e) { push(reqs, method + ' ' + url + ' → ' + res.status); }
        }
        return res;
      }).catch(function (err) {
        // Отменённый запрос — не поломка: платформа сама рвёт запросы по AbortController
        // (поиск с задержкой, уход со страницы). Раньше каждая отмена ложилась в отчёт
        // упавшим запросом, и человек нёс разработчику выдуманные ошибки.
        var aborted = err && (err.name === 'AbortError' || (init && init.signal && init.signal.aborted));
        if (!aborted) push(reqs, method + ' ' + url + ' → обрыв: ' + oneLine(err && err.message || err));
        throw err;
      });
    };
    window.fetch.__cfWrapped = true;
  }

  function theme() {
    var a = document.documentElement.getAttribute('data-theme');
    if (a) return a === 'light' ? 'светлая' : 'тёмная';
    try {
      return (getComputedStyle(document.documentElement).colorScheme || '').indexOf('light') === 0
        ? 'светлая' : 'тёмная';
    } catch (e) { return 'тёмная'; }
  }

  function build() {
    var u = new URL(location.href);
    var L = [];
    var h1 = document.querySelector('h1');
    var ver = document.getElementById('sb-version');
    var zoom = getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom').trim();

    L.push('# ' + (document.title || location.pathname));
    L.push('');
    L.push('- Адрес: ' + location.href);
    // Счётчик «(88)» дорисовывает сам сайдбар (.h1n) — он часть заголовка, а не отдельный
    // абзац; вместе с ним из textContent приезжали переводы строк и разваливали пункт.
    // Счётчик «(88)» дорисовывает сам сайдбар (.h1n) — он часть заголовка, а не отдельный
    // абзац. Пробелы схлопываем БЕЗ пометки переноса: в заголовке перенос — это вёрстка,
    // а не содержание (в отличие от сообщения об ошибке, где строки стека важны).
    if (h1) L.push('- Заголовок: ' + h1.textContent.replace(/\s+/g, ' ').trim());
    if (ver && ver.textContent) L.push('- Версия платформы: ' + ver.textContent.trim());
    L.push('- Экран: ' + window.innerWidth + '×' + window.innerHeight
      + ' · масштаб ' + (zoom ? Math.round(parseFloat(zoom) * 100) + '%' : '100%')
      + ' · тема ' + theme());
    L.push('- Снято: ' + new Date().toLocaleString('ru-RU'));

    var qs = [];
    u.searchParams.forEach(function (v, k) { qs.push('- ' + k + ' = ' + v); });
    if (qs.length) { L.push(''); L.push('## Параметры адреса'); L.push.apply(L, qs); }
    if (u.hash) { L.push(''); L.push('## Хеш'); L.push('- ' + u.hash); }

    L.push('');
    L.push('## Ошибки консоли (' + errs.length + ')');
    L.push(errs.length ? errs.map(function (e) { return '- ' + e; }).join('\n') : '- нет');

    L.push('');
    L.push('## Неудачные запросы (' + reqs.length + ')');
    L.push(reqs.length ? reqs.map(function (r) { return '- ' + r; }).join('\n') : '- нет');

    return L.join('\n');
  }

  function toClipboard(text) {
    // Ветку выбираем по РЕЗУЛЬТАТУ, а не по наличию API: navigator.clipboard есть почти
    // везде, но отказывает штатно — «документ не в фокусе», отозванное разрешение, iframe.
    // Раньше такой отказ давал «Не удалось скопировать», хотя запасной путь лежит рядом.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        return navigator.clipboard.writeText(text).catch(function () { return legacy(text); });
      } catch (e) { return legacy(text); }
    }
    return legacy(text);
  }

  function legacy(text) {
    return new Promise(function (ok, no) {
      try {
        // ta.select() забирает фокус. У человека в этот момент может быть открыт поиск с
        // набранным текстом — возвращаем фокус и выделение туда, откуда взяли.
        var prev = document.activeElement;
        var ps = prev && typeof prev.selectionStart === 'number' ? prev.selectionStart : null;
        var pe = prev && typeof prev.selectionEnd === 'number' ? prev.selectionEnd : null;
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        var done = document.execCommand('copy');
        ta.remove();
        if (prev && prev.focus) {
          try {
            prev.focus();
            if (ps !== null && prev.setSelectionRange) prev.setSelectionRange(ps, pe);
          } catch (e) {}
        }
        done ? ok() : no();
      } catch (e) { no(e); }
    });
  }

  window.cfCopyPage = function () {
    toClipboard(build()).then(function () {
      if (window.uiToast) window.uiToast('Страница скопирована для ИИ');
    }).catch(function () {
      if (window.uiToast) window.uiToast('Не удалось скопировать');
    });
  };
})();
