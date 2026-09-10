/* Закрепление строк меню — общий модуль портала (/sidebar.js) и кабинета (/cab-sidebar.js).
   ОДНА копия на оба: правка «поменять порядок» иначе прилетела бы в каждый файл отдельно.

   Что делает: поднимает выбранные пункты в блок «Быстрый доступ» над списком разделов.
   Два входа в одно и то же действие: долгое нажатие 600 мс (мобилка) и режим правки
   (карандаш в шапке — и на ПК, и на мобилке).

   Решения, которые выглядят странно, но сделаны намеренно:

   1. Закреплённая строка ПЕРЕЕЗЖАЕТ в «Быстрый доступ», а не копируется. Клон был бы проще,
      но бейджи вешают поллеры сайдбара по `querySelector('a[href="…"]')` — они нашли бы
      ОРИГИНАЛ, и счётчик остался бы на строке, спрятанной в свёрнутой группе. Переезд заодно
      держит правило «дублей страниц в меню быть не должно» (docs/rules/ui.md).
   2. Ссылка обёрнута в .mp-row ОДИН раз при монтировании: кнопка не может лежать внутри <a>
      (невалидная вложенность интерактивных элементов), а собирать и разбирать контейнер на
      каждое включение режима правки — лишняя возня с DOM.
   3. Набор СВОЙ НА КАЖДОМ УСТРОЙСТВЕ и в settings не уезжает — это решение, а не недоделка.

   Значок — i-pushpin (канцелярская кнопка). НЕ i-pin: под этим именем в спрайте лежит
   ГЕО-МЕТКА, занятая местом на карте (place-field.js, медкарта, «Жизнь», чаты).

   Хранилище считаем ВРАЖДЕБНЫМ. Его правят руками из консоли, туда попадает старый формат
   и записи из чужой вкладки. Любой мусор обязан оставить меню рабочим: раньше одно число
   внутри массива роняло mount() исключением наружу, обрывало inject() портала — и человек
   получал полуразобранное меню с пустой шапкой «Быстрый доступ» на всех страницах. */
(function () {
  if (window.MenuPins) return;

  var KEY = 'cf_pins_v1';
  var HOLD_MS = 600;      // порог удержания; 2 с ощущаются как зависание, а не как жест
  var MOVE_TOL = 10;      // сдвиг пальца, после которого жест — прокрутка, а не удержание
  var MAX_PINS = 50;      // потолок набора: render() ходит в DOM на каждую запись

  // Сработавшее удержание оставляет ОДИН непогашенный клик. Флаг одноразовый и живёт до
  // первого спросившего, а не N миллисекунд: cab-burger.js спрашивает suppressed() в фазе
  // ПЕРЕХВАТА на document, то есть раньше, чем модуль успевает погасить click у себя.
  // Было окно в 500 мс — и оно ломалось с двух сторон: при удержании дольше 1.1 с окно
  // истекало, и шторка кабинета захлопывалась прямо в момент закрепления, а сразу после
  // короткого удержания то же окно глушило ОБЫЧНЫЙ тап по соседнему пункту.
  var HELD_PENDING = false;

  function suppressed(t) {
    if (HELD_PENDING) { HELD_PENDING = false; return true; }
    if (!t || !t.closest) return false;
    if (t.closest('.mp-pin, .mp-grip, .mp-edit-btn, #cab-pins-edit')) return true;
    // В режиме правки гасим клики по САМИМ строкам меню, а не по всему сайдбару: раньше
    // сюда попадали «Выход», «Тема» и логотип кабинета — они работали, но шторка после них
    // не закрывалась.
    return !!(t.closest('.mp-edit') && t.closest('.mp-row'));
  }

  // ---- хранилище -----------------------------------------------------------
  // Формат: { "<scope>": ["/href", …] }. Scope разный у портала и каждого кабинета:
  // href кабинета содержит slug, и общий список смешал бы разделы разных проектов.
  function readAll() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '{}');
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    } catch (e) { return {}; }
  }
  // Возвращает УСПЕХ записи: в приватном режиме setItem бросает QuotaExceededError, и раньше
  // человек видел бодрое «Закреплено», хотя не сохранялось ничего.
  function writeAll(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }

  // Только непустые строки, без повторов, с потолком. Мусор молча выбрасываем: чинить
  // чужую запись мы не можем, а падать из-за неё — тем более не должны.
  function clean(list) {
    var out = [], seen = {};
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < MAX_PINS; i++) {
      var h = list[i];
      if (typeof h !== 'string' || !h || seen[h]) continue;
      seen[h] = 1; out.push(h);
    }
    return out;
  }

  // Значение атрибута в кавычной CSS-строке: экранируем И обратный слэш, И кавычку, причём
  // слэш ПЕРВЫМ. Раньше экранировалась только кавычка, и адрес с «\» либо не находился
  // молча (тост врал «Закреплено»), либо ронял querySelector неверным селектором.
  function escAttr(v) {
    return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function ico(name, cls) {
    return '<svg class="' + (cls || '') + '" aria-hidden="true"><use href="/assets/icons.svg#' + name + '"></use></svg>';
  }

  function toast(msg, undo) {
    if (typeof window.uiToast === 'function') {
      try { window.uiToast(msg); } catch (e) {}
    }
    if (!undo) return;
    var old = document.querySelector('.mp-undo');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'mp-undo';
    el.innerHTML = '<span></span><button type="button" class="mp-undo-btn no-ui-btn">Отменить</button>';
    el.firstChild.textContent = msg;
    document.body.appendChild(el);
    var t = setTimeout(function () { el.remove(); }, 6000);
    el.querySelector('.mp-undo-btn').addEventListener('click', function () {
      clearTimeout(t); el.remove(); undo();
    });
  }

  // ---- оформление ----------------------------------------------------------
  // Цвета — токенами (ADR-142). Кнопки НЕ красим: у них роль .ibtn из btnCss(),
  // тут только состояние значка цветом — как у .sb-link.active .ico.
  function css() {
    if (document.getElementById('mp-css')) return;
    var s = document.createElement('style');
    s.id = 'mp-css';
    s.textContent = [
      '.mp-row{position:relative;display:flex;align-items:center;}',
      '.mp-row>a{flex:1 1 auto;min-width:0;}',
      '.mp-pin{display:none;flex:0 0 auto;margin-right:6px;min-width:var(--ui-tap-sm,30px);min-height:var(--ui-tap-sm,30px);}',
      '.mp-pin svg{width:16px;height:16px;color:var(--ui-tx-3,#555);}',
      '.mp-pin[data-on="1"] svg{color:var(--ui-brand,#00a0ff);}',
      '.mp-grip{display:none;flex:0 0 auto;margin-left:8px;min-width:var(--ui-tap-sm,30px);min-height:var(--ui-tap-sm,30px);color:var(--ui-line,#3a3a3a);cursor:grab;touch-action:none;}',
      '.mp-grip svg{width:16px;height:16px;}',
      '.mp-edit .mp-pin{display:inline-flex;}',
      '.mp-edit .mp-quick .mp-grip{display:inline-flex;}',
      '.mp-edit .mp-row>a{pointer-events:none;}',
      '@media (hover:hover) and (min-width:769px){.mp-row:hover .mp-pin{display:inline-flex;}}',
      '.mp-quick{margin:2px 10px 10px 14px;background:var(--ui-surface-3,#101010);border:1px solid var(--ui-line-2,#1e1e1e);border-radius:10px;overflow:hidden;}',
      '.mp-quick .mp-row+.mp-row{border-top:1px solid var(--ui-line-2,#1a1a1a);}',
      '.mp-quick .mp-row>a{padding-left:12px !important;margin-right:0 !important;border-radius:0 !important;min-height:var(--ui-tap,44px);box-sizing:border-box;}',
      '.mp-quick .mp-row>a::before{display:none !important;}',
      '.mp-cap{padding:12px 20px 6px;font-size:10px;letter-spacing:.08em;color:var(--ui-tx-3,#555);text-transform:uppercase;}',
      '.mp-row.mp-drag{opacity:.6;}',
      '.mp-row.mp-hold{background:var(--ui-surface,#161616);border-radius:10px;box-shadow:0 8px 22px rgba(0,0,0,.6);}',
      '.mp-row.mp-hold .mp-pin{display:inline-flex;}',
      '.mp-row.mp-hold .mp-pin svg{color:var(--ui-brand,#00a0ff);}',
      '.mp-undo{position:fixed;left:14px;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:900;display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;background:var(--ui-surface,#161616);border:1px solid var(--ui-line,#262626);border-radius:10px;box-shadow:0 10px 26px rgba(0,0,0,.6);font-size:13px;color:var(--ui-tx,#e8e8e8);}',
      '@media (min-width:769px){.mp-undo{left:auto;right:20px;width:340px;}}',
      '.mp-undo-btn{margin-left:auto;background:none;border:0;padding:0 4px;font:inherit;color:var(--ui-brand,#00a0ff);cursor:pointer;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---- монтирование --------------------------------------------------------
  function mount(o) {
    if (!o || !o.root || !o.list) return null;
    // Второй вызов на том же сайдбаре (перерисовка, повторный inject) раньше заворачивал
    // строки ещё раз: .mp-row внутри .mp-row, два «Быстрых доступа», две кнопки правки и
    // два тоста на одно удержание. Отдаём уже собранное.
    if (o.root.__mpApi) return o.root.__mpApi;
    css();

    var root = o.root, list = o.list, scope = o.scope || 'portal';
    var mq = o.mq || '(max-width:768px)';
    var all = readAll();
    var stored = Array.isArray(all[scope]);
    var pins = clean(stored ? all[scope] : o.defaults);

    var links = [].slice.call(root.querySelectorAll(o.linkSel));
    if (!links.length) return null;

    links.forEach(function (a) {
      var row = document.createElement('div');
      row.className = 'mp-row';
      a.parentNode.insertBefore(row, a);
      row.appendChild(a);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mp-pin ibtn';
      btn.innerHTML = ico('i-pushpin');
      btn.title = 'Закрепить';
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        prefer(a.getAttribute('href'), row);
        toggle(a.getAttribute('href'));
      });
      row.appendChild(btn);

      // Ручка — КНОПКА, а не div с aria-hidden: порядок закреплённых должен меняться и с
      // клавиатуры, стрелками вверх/вниз, а не только перетаскиванием указателем.
      var grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'mp-grip ibtn';
      grip.innerHTML = ico('i-grip-vertical');
      grip.title = 'Переставить';
      grip.setAttribute('aria-label', 'Переставить пункт');
      row.insertBefore(grip, a);
      grip.addEventListener('pointerdown', function (e) { dragStart(e, row); });
      grip.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
      grip.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        if (row.parentNode !== quick) return;
        e.preventDefault();
        var sib = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
        if (!sib) return;
        if (e.key === 'ArrowUp') quick.insertBefore(row, sib);
        else quick.insertBefore(sib, row);
        syncOrder();
        grip.focus();
      });
    });

    // Куда вернуть строку при откреплении — ВТОРЫМ проходом, когда обёрнуты уже все.
    // Считать соседа сразу при обёртке нельзя: у строки запомнилась бы ещё не обёрнутая
    // следующая ССЫЛКА, к моменту возврата её в родителе нет, и пункт уезжал бы в конец группы.
    links.forEach(function (a) {
      var row = a.closest('.mp-row');
      row.mpHome = { parent: row.parentNode, next: row.nextSibling };
    });

    var quick = document.createElement('div');
    quick.className = 'mp-quick';
    var cap = document.createElement('div');
    cap.className = 'mp-cap';
    cap.textContent = o.title || 'Быстрый доступ';
    // Куда встать блоку. В портале это начало прокручиваемой части (.sb-nav), в кабинете
    // список и контейнер — один и тот же .cl-sb, и «в начало» означало бы НАД логотипом,
    // поэтому вызывающий передаёт опорный узел явно. Ищем его ЧЕРЕЗ обёртку: ссылки уже
    // лежат внутри .mp-row и прямыми детьми списка больше не являются.
    var b = o.before;
    if (b && b.closest) b = b.closest('.mp-row') || b;
    var at = (b && b.parentNode === list) ? b : list.firstChild;
    list.insertBefore(quick, at);
    list.insertBefore(cap, quick);

    // Какую именно строку человек трогал. Ключ набора — адрес, и если в меню две строки с
    // одним href, поиск по адресу всегда возвращает ПЕРВУЮ: нажимали кнопку во второй
    // группе, а уезжала строка из первой. Запоминаем нажатую и предпочитаем её.
    var preferred = Object.create(null);
    function prefer(href, row) { if (typeof href === 'string' && href) preferred[href] = row; }

    function rowOf(href) {
      if (typeof href !== 'string' || !href) return null;
      var p = preferred[href];
      if (p && p.isConnected) {
        var pa = p.querySelector('a');
        if (pa && pa.getAttribute('href') === href) return p;
      }
      var a;
      // Селектор клеится из чужой строки — на всякий отказ отвечаем «строки нет», а не
      // исключением наружу: выше по стеку стоит inject() всего сайдбара.
      try { a = root.querySelector(o.linkSel + '[href="' + escAttr(href) + '"]'); }
      catch (e) { return null; }
      return a ? a.closest('.mp-row') : null;
    }

    function save() {
      all[scope] = pins.slice();
      return writeAll(all);
    }

    function syncOrder() {
      pins = clean([].slice.call(quick.children).map(function (r) {
        var a = r.querySelector('a'); return a && a.getAttribute('href');
      }));
      save();
    }

    function render() {
      pins = clean(pins).filter(function (h) { return !!rowOf(h); });
      pins.forEach(function (h) {
        var row = rowOf(h);
        if (row) { quick.appendChild(row); row.querySelector('.mp-pin').dataset.on = '1'; }
      });
      [].slice.call(root.querySelectorAll('.mp-row')).forEach(function (row) {
        if (row.parentNode === quick) return;
        var b = row.querySelector('.mp-pin');
        if (b) b.dataset.on = '';
      });
      [].slice.call(quick.children).forEach(function (row) {
        var a = row.querySelector('a');
        if (a && pins.indexOf(a.getAttribute('href')) >= 0) return;
        var h = row.mpHome;
        // Группу могли пересобрать, пока строка лежала в «Быстром доступе». Возврат в
        // оторванный от документа контейнер означал бы, что пункт исчезает из меню совсем —
        // поэтому в этом случае кладём его в конец списка: место не родное, зато видно.
        if (!h || !h.parent || !h.parent.isConnected) { list.appendChild(row); }
        else {
          // Опора могла сама уехать в «Быстрый доступ» — идём по цепочке к следующему
          // соседу, который ещё на месте. Иначе строка вернулась бы в конец группы.
          var ref = h.next;
          while (ref && ref.parentNode !== h.parent) ref = ref.mpHome ? ref.mpHome.next : null;
          if (ref) h.parent.insertBefore(row, ref); else h.parent.appendChild(row);
        }
        var b = row.querySelector('.mp-pin');
        if (b) b.dataset.on = '';
      });
      cap.hidden = quick.hidden = !pins.length;
    }

    function toggle(href, silent) {
      if (typeof href !== 'string' || !href) return;
      var i = pins.indexOf(href);
      var was = pins.slice();
      if (i >= 0) pins.splice(i, 1);
      else {
        if (pins.length >= MAX_PINS) { toast('Закреплено уже ' + MAX_PINS + ' — больше некуда'); return; }
        pins.push(href);
      }
      var ok = save();
      render();
      if (silent) return;
      var done = i >= 0 ? 'Откреплено' : 'Закреплено в быстром доступе';
      // Не сохранилось (приватный режим, переполненное хранилище) — говорим прямо,
      // иначе человек второй раз закрепляет то же самое и не понимает, почему не держится.
      if (!ok) { toast(done + ', но не запомнится: хранилище браузера недоступно'); return; }
      toast(done, function () {
        pins = was.slice(); save(); render();
      });
    }

    // ---- перетаскивание закреплённых (режим правки) ----
    var drag = null;
    function dragStart(e, row) {
      if (!root.classList.contains('mp-edit') || row.parentNode !== quick) return;
      e.preventDefault();
      drag = row; row.classList.add('mp-drag');
      row.setPointerCapture && row.setPointerCapture(e.pointerId);
      document.addEventListener('pointermove', dragMove);
      // Завершаем жест и по отмене тоже: входящий звонок, системный жест, палец за краем
      // экрана. Раньше висел только pointerup — строка продолжала ездить за пальцем,
      // которого уже нет, а порядок расходился с сохранённым.
      document.addEventListener('pointerup', dragEnd);
      document.addEventListener('pointercancel', dragEnd);
    }
    function dragMove(e) {
      if (!drag) return;
      var rows = [].slice.call(quick.children);
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] === drag) continue;
        var r = rows[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { quick.insertBefore(drag, rows[i]); return; }
      }
      quick.appendChild(drag);
    }
    function dragEnd() {
      document.removeEventListener('pointermove', dragMove);
      document.removeEventListener('pointerup', dragEnd);
      document.removeEventListener('pointercancel', dragEnd);
      if (!drag) return;
      drag.classList.remove('mp-drag');
      drag = null;
      syncOrder();
    }

    // ---- долгое нажатие (мобилка) ----
    var hold = null, hx = 0, hy = 0, fired = false, firedTimer = null;
    function holdClear() {
      if (hold) clearTimeout(hold);
      hold = null;
      var el = root.querySelector('.mp-row.mp-hold');
      if (el) el.classList.remove('mp-hold');
    }
    function clearFired() {
      fired = false; HELD_PENDING = false;
      if (firedTimer) { clearTimeout(firedTimer); firedTimer = null; }
    }
    root.addEventListener('pointerdown', function (e) {
      // Новое касание — прошлый жест закончен в любом случае.
      clearFired();
      // Предыдущий таймер ОБЯЗАТЕЛЬНО гасим: второй палец (двупальцевая прокрутка, ладонь)
      // раньше осиротил первый — holdClear по pointerup снимал только последний, а
      // осиротевший доживал и закреплял случайную строку через 0.6 с после того,
      // как руку уже убрали, с вибрацией и тостом.
      if (hold) { clearTimeout(hold); hold = null; }
      if (e.pointerType === 'mouse') return;
      if (!window.matchMedia(mq).matches) return;
      if (root.classList.contains('mp-edit')) return;
      var row = e.target.closest && e.target.closest('.mp-row');
      if (!row) return;
      hx = e.clientX; hy = e.clientY;
      hold = setTimeout(function () {
        hold = null; fired = true; HELD_PENDING = true;
        // Страховка: click после удержания приходит не всегда. Непогашенный флаг съел бы
        // следующий тап — по совсем другому пункту.
        firedTimer = setTimeout(clearFired, 1000);
        row.classList.add('mp-hold');
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) {} }
        var a = row.querySelector('a');
        if (a) { prefer(a.getAttribute('href'), row); toggle(a.getAttribute('href')); }
        setTimeout(function () { row.classList.remove('mp-hold'); }, 180);
      }, HOLD_MS);
    });
    root.addEventListener('pointermove', function (e) {
      if (!hold) return;
      if (Math.abs(e.clientX - hx) > MOVE_TOL || Math.abs(e.clientY - hy) > MOVE_TOL) holdClear();
    });
    root.addEventListener('pointerup', holdClear);
    // Отмена жеста системой означает, что click НЕ придёт — гасим флаг сразу, иначе он
    // съест следующий клик по меню, включая нажатие самой кнопки «Закрепить».
    root.addEventListener('pointercancel', function () { holdClear(); clearFired(); });
    root.addEventListener('click', function (e) {
      // В режиме правки строка не ведёт по ссылке. Держать это одним CSS-правилом
      // pointer-events:none нельзя: с клавиатуры Enter по ссылке уводил со страницы.
      if (root.classList.contains('mp-edit') && e.target.closest && e.target.closest('.mp-row')
          && !e.target.closest('.mp-pin, .mp-grip')) {
        e.preventDefault(); e.stopPropagation();
        return;
      }
      if (!fired) return;
      clearFired();
      e.preventDefault(); e.stopPropagation();
    }, true);

    // ---- режим правки ----
    var edBtn = null;
    var expanded = [];
    function setEdit(on) {
      if (on === undefined) on = !root.classList.contains('mp-edit');
      root.classList.toggle('mp-edit', on);
      if (edBtn) {
        edBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        edBtn.title = on ? 'Готово' : 'Правка меню';
      }
      var rows = [].slice.call(root.querySelectorAll('.mp-row > a'));
      rows.forEach(function (a) {
        if (on) { a.setAttribute('aria-disabled', 'true'); a.setAttribute('tabindex', '-1'); }
        else { a.removeAttribute('aria-disabled'); a.removeAttribute('tabindex'); }
      });
      if (on) {
        // Раскрываем свёрнутые группы: иначе половину пунктов не закрепить, не выйдя из
        // режима. ЗАПОМИНАЕМ какие — на выходе возвращаем как было; раньше инлайновый
        // max-height:none оставался навсегда и перебивал .sb-items.collapsed из таблицы
        // стилей, так что группа больше не сворачивалась вообще.
        expanded = [];
        root.querySelectorAll('.sb-items.collapsed, .sb-group.collapsed').forEach(function (el) {
          expanded.push({ el: el, mh: el.style.maxHeight });
          el.classList.remove('collapsed');
          el.style.maxHeight = 'none';
        });
      } else {
        expanded.forEach(function (r) {
          r.el.classList.add('collapsed');
          r.el.style.maxHeight = r.mh || '';
        });
        expanded = [];
      }
      return on;
    }

    // Портал даёт контейнер под кнопку. Кабинет вместо этого вешает setEdit на СВОЮ строку
    // меню: там служебные пункты («Тема», «Выйти») — обычные строки .cl-nav.
    if (o.editHost) {
      edBtn = document.createElement('button');
      edBtn.type = 'button';
      edBtn.className = 'mp-edit-btn ibtn';
      edBtn.innerHTML = ico('i-edit');
      edBtn.title = 'Правка меню';
      edBtn.setAttribute('aria-pressed', 'false');
      edBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        setEdit();
      });
      o.editHost.appendChild(edBtn);
    }

    render();
    // Умолчания записываем сразу: иначе scope так и остаётся пустым, и открепив всё,
    // человек получил бы их обратно после перезагрузки.
    if (!stored && pins.length) save();

    var api = {
      toggle: toggle, render: render, edit: setEdit,
      pins: function () { return pins.slice(); }
    };
    root.__mpApi = api;
    return api;
  }

  window.MenuPins = { mount: mount, suppressed: suppressed };
})();
