// Единый тост платформы. Стиль живёт в ui.css (.plt-toast, #plt-toast-stack) — здесь только логика.
// Своих реализаций toast() на страницах больше не пишем, подключаем этот файл.
//
// Использование:
//   pltToast('Сохранено')
//   pltToast('Название раздела — скопировано')
//   pltToast('Ошибка сохранения', { err: true })
//   pltToast('Текст', { ms: 12000 })  // своя длительность; по умолчанию и минимум 8000 (с 08.10.2026), ошибка не гаснет сама
//   pltToast('Факт', { key: 'result-fact', ms: 5000 })       // именованная плашка —
//   pltToast('Мотивация', { key: 'result-encourage', ms: 10000 }) // своя, отдельная от дефолтной
//
// 18.08.2026 (запрос Константина): наведение мышью или тач по плашке ставит
// обратный отсчёт на паузу (полоска замирает, автозакрытие не срабатывает),
// уход курсора/отпускание — отсчёт продолжается с того места, где остановился
// (не с начала). Работает через общий элемент #plt-toast, слушатели вешаются
// один раз при первом создании плашки.
//
// 19.08.2026 (запрос Константина, трекер привычек): без opts.key поведение и id
// элемента (#plt-toast) не меняются — старый код на ~35 страницах трогать не
// пришлось. С opts.key плашка получает свой собственный элемент (#plt-toast-<key>)
// и своё независимое обратное отсчёт — так несколько плашек видны на экране
// одновременно, а не заменяют текст друг друга. Все плашки живут в общем
// #plt-toast-stack (ui.css, column-reverse): первая вызванная остаётся снизу
// (там же, где раньше стоял единственный #plt-toast), следующие стопкой растут
// вверх. hideTimer теперь хранится НА элементе (t._hideTimer), а не в одной общей
// переменной модуля — иначе запуск отсчёта второй одновременной плашки гасил бы
// таймер первой (обе делили один и тот же hideTimer).
(function () {
  function getStack() {
    let s = document.getElementById('plt-toast-stack');
    if (!s) {
      s = document.createElement('div');
      s.id = 'plt-toast-stack';
      document.body.appendChild(s);
    }
    return s;
  }

  // 29.09.2026: тост над нижним доком (bottom-nav.js) на телефоне. Правило — в ui.css (блок
  // «ТОСТЫ НАД ДОКОМ»): нижний угол не опускается ниже --ui-toast-dock. Здесь только точный
  // замер кромки дока вместе с выступающей кнопкой «+» перед показом — пишем его в
  // --ui-toast-dock-js на body. Дока нет / скрыт (выключен, открыта клавиатура) — переменную
  // снимаем, ui.css сам вернёт обычную позицию. Одна функция на toast.js и ui-dialogs.js:
  // кто загрузился первым, тот её и объявил (window.uiToastDockSync).
  const dockSync = window.uiToastDockSync || (window.uiToastDockSync = function () {
    var b = document.body;
    if (!b || !b.classList.contains('cfbn-on')) return;
    var nav = document.getElementById('cfbn'), top = Infinity;
    if (nav && window.innerWidth <= 768) {
      var r = nav.getBoundingClientRect();
      if (r.height) {
        top = r.top;
        var add = nav.querySelector('.cfbn-add'), a = add && add.getBoundingClientRect();
        if (a && a.height) top = Math.min(top, a.top);
      }
    }
    // зазор над доком — --ui-toast-gap из ui.css (тот же, что у верхнего тоста от края экрана)
    var gap = parseFloat(getComputedStyle(b).getPropertyValue('--ui-toast-gap'));
    if (!(gap >= 0)) gap = 14;
    if (top === Infinity) b.style.removeProperty('--ui-toast-dock-js');
    else b.style.setProperty('--ui-toast-dock-js', Math.max(0, Math.round(window.innerHeight - top + gap)) + 'px');
  });

  // 07.10.2026 (запрос Константина): тост ошибки не исчезает сам и копируется вместе с контекстом
  // для чата с ИИ. Одна функция на toast.js и ui-dialogs.js: кто загрузился первым, тот и объявил
  // window.cfErrCopy / window.cfErrCopyText (копии держать одинаковыми). Последний запрос /api/*
  // (метод, путь без query, HTTP-статус) пишет обёртка fetch — её ставим один раз.
  if (!window.cfErrCopyText) {
    window.cfLastApi = null;
    if (window.fetch) {
      var rawFetch = window.fetch;
      window.fetch = function (input, init) {
        var m = 'GET', u = '';
        try {
          m = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          u = String((input && input.url) || input || '');
        } catch (e) {}
        var rec = { m: m, u: u.split('?')[0].replace(location.origin, ''), s: '', t: Date.now() };
        var p = rawFetch.apply(this, arguments);
        if (rec.u.indexOf('/api/') === 0) {
          p.then(function (r) { rec.s = r.status; rec.t = Date.now(); window.cfLastApi = rec; },
            function (e) { rec.s = 'сеть: ' + (e && e.message || e); rec.t = Date.now(); window.cfLastApi = rec; });
        }
        return p;
      };
    }
    window.cfErrCopyText = function (msg) {
      var a = window.cfLastApi, L = [
        'Ошибка на платформе ai.cashruflow.ru. Помоги разобраться и исправить.',
        'Страница: ' + location.pathname,
        'Время: ' + new Date().toLocaleString('ru-RU') + ' (' + new Date().toISOString() + ')',
        'Текст ошибки: ' + String(msg == null ? '' : msg)
      ];
      if (a && Date.now() - a.t < 15000) L.push('Последний запрос API: ' + a.m + ' ' + a.u + ' → HTTP ' + a.s);
      return L.join('\n');
    };
    window.cfErrCopy = function (msg, btn) {
      var text = window.cfErrCopyText(msg);
      function ok() {
        if (btn) { btn.classList.add('done'); setTimeout(function () { btn.classList.remove('done'); }, 1200); }
      }
      function legacy() {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ok(); } catch (e) {}
        ta.remove();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, legacy);
      else legacy();
    };
    window.cfErrCopyIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
  }

  // 08.10.2026 (запрос Константина): «Копировать» у КАЖДОГО тоста, не только у ошибки. Успех/инфо копирует
  // сам текст, ошибка — текст с контекстом для чата с ИИ (cfErrCopyText выше). После копирования кнопка на
  // 1,3 с превращается в «Скопировано». Одна функция на toast.js и ui-dialogs.js (копии держать одинаковыми).
  if (!window.cfToastCopy) {
    window.cfToastCopy = function (msg, isErr, btn) {
      var text = isErr && window.cfErrCopyText ? window.cfErrCopyText(msg) : String(msg == null ? '' : msg);
      function ok() {
        if (!btn) return;
        if (btn._cpHtml == null) btn._cpHtml = btn.innerHTML;
        btn.classList.add('done');
        btn.innerHTML = '<span style="font-size:11px;line-height:1.2;white-space:nowrap;display:block">Скопировано</span>';
        clearTimeout(btn._cpT);
        btn._cpT = setTimeout(function () { btn.classList.remove('done'); btn.innerHTML = btn._cpHtml; }, 1300);
      }
      function legacy() {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ok(); } catch (e) {}
        ta.remove();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, legacy);
      else legacy();
    };
  }

  // 08.10.2026: любой тост живёт не меньше 8 с (успех/инфо; ошибка — не гаснет сама). Раньше 3 с, и
  // вызовы с ms: 1800/2500 пропадали раньше, чем текст успевали прочитать. Меньшее ms из вызова поднимается до пола.
  var MIN_MS = 8000;

  function startCountdown(t, ms) {
    const bar = t.querySelector('.bar');
    clearTimeout(t._hideTimer);
    t._paused = false;
    t._msLeft = ms;
    t._startTs = Date.now();
    bar.style.transition = 'none';
    bar.style.width = '100%';
    void bar.offsetWidth; // форсируем reflow, чтобы transition подхватился заново
    bar.style.transition = 'width ' + ms + 'ms linear';
    bar.style.width = '0%';
    t._hideTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  function pauseCountdown(t) {
    if (t._persist || t._paused || !t.classList.contains('show')) return;
    t._paused = true;
    clearTimeout(t._hideTimer);
    const bar = t.querySelector('.bar');
    const elapsed = Date.now() - t._startTs;
    t._msLeft = Math.max(0, t._msLeft - elapsed);
    const curWidth = getComputedStyle(bar).width;
    bar.style.transition = 'none';
    bar.style.width = curWidth;
  }

  function resumeCountdown(t) {
    if (t._persist || !t._paused) return;
    t._paused = false;
    if (t._msLeft <= 0) { t.classList.remove('show'); return; }
    const bar = t.querySelector('.bar');
    t._startTs = Date.now();
    void bar.offsetWidth;
    bar.style.transition = 'width ' + t._msLeft + 'ms linear';
    bar.style.width = '0%';
    t._hideTimer = setTimeout(() => t.classList.remove('show'), t._msLeft);
  }

  window.pltToast = function (text, opts) {
    opts = opts || {};
    const ms = Math.max(opts.ms || MIN_MS, MIN_MS);
    const id = opts.key ? ('plt-toast-' + opts.key) : 'plt-toast';
    try { dockSync(); } catch (e) {}

    let t = document.getElementById(id);
    if (!t) {
      t = document.createElement('div');
      t.id = id;
      t.className = 'plt-toast';
      t.innerHTML = '<span class="ic"></span><span class="txt"></span>'
        + '<span class="acts"><button type="button" class="cp" title="Копировать" aria-label="Копировать">' + window.cfErrCopyIcon + '</button>'
        + '<button type="button" class="x" title="Закрыть" aria-label="Закрыть">×</button></span><i class="bar"></i>';
      getStack().appendChild(t);
      t.querySelector('.cp').addEventListener('click', () => window.cfToastCopy(t.querySelector('.txt').textContent, t.classList.contains('err'), t.querySelector('.cp')));
      t.querySelector('.x').addEventListener('click', () => { clearTimeout(t._hideTimer); t.classList.remove('show'); });
      t.addEventListener('mouseenter', () => pauseCountdown(t));
      t.addEventListener('mouseleave', () => resumeCountdown(t));
      t.addEventListener('touchstart', () => pauseCountdown(t), { passive: true });
      t.addEventListener('touchend', () => resumeCountdown(t), { passive: true });
    }

    t.classList.toggle('err', !!opts.err);
    // 03.10.2026 (ERR-285): иконка по типу — Lucide из спрайта: успех i-check, ошибка i-circle-alert (alert-circle).
    // Адрес спрайта фиксирован (?v=17, как NEW_ICO в medcard_food.js): i-circle-alert есть не во всех старых ?v=.
    t.querySelector('.ic').innerHTML = '<svg width="16" height="16" aria-hidden="true" style="display:block"><use href="' + (window.ICONS_URL||'/assets/icons.svg?v=28') + '#' + (opts.err ? 'i-circle-alert' : 'i-check') + '"></use></svg>';
    t.querySelector('.txt').textContent = text;
    // «Копировать» и крестик видны у всех тостов. Инлайном, а не правкой ui.css: .plt-toast .acts там скрыт
    // у не-ошибок, а ui.css?v=76 подключён на ~100 страницах и держится в кэше 7 дней.
    t.querySelector('.acts').style.display = 'flex';
    t.querySelector('.cp').title = opts.err ? 'Копировать ошибку для чата с ИИ' : 'Копировать текст';
    t.classList.add('show');
    // Ошибка висит, пока не закроют крестиком (07.10.2026); успех — обратный отсчёт как раньше
    t._persist = !!opts.err;
    if (t._persist) {
      clearTimeout(t._hideTimer);
      t._paused = false;
      const bar = t.querySelector('.bar');
      bar.style.transition = 'none';
      bar.style.width = '0%';
    } else startCountdown(t, ms);
  };
})();
