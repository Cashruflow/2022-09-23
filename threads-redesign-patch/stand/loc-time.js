/* loc-time.js — единый показ времени платформы в зоне устройства (07.09.2026).
 *
 * ЗАЧЕМ: SQLite пишет created_at/updated_at через datetime('now') — это UTC
 * в виде 'YYYY-MM-DD HH:MM:SS', без 'Z' на конце. Браузер такую строку
 * парсит как ЛОКАЛЬНОЕ время, поэтому на странице висело время на смещение
 * назад (в MSK — на 3 часа, в Бангкоке — на 7). До этого файла одна и та же
 * функция была скопирована в company.html (locTime), contacts.html и
 * history.html (локTime), leads.html (lLocTime, lrWhen), projects.html (spDt).
 *
 * ЗОНА: по умолчанию зона устройства (как во всех прежних копиях) — где
 * открыл, там и правильно. Чтобы прибить к поясу портала (/set → «Время и
 * регион»), достаточно на странице ДО подключения этого файла задать:
 *     window.LOC_TZ = window.CF_REGION && window.CF_REGION.timezone;
 *
 * API:
 *   locDT(s)     → Date | null   — разбор строки (для сортировок и разниц)
 *   locTime(s)   → 07.09.2026 14:32
 *   locShort(s)  → 07.09 14:32   (узкие колонки, год не нужен)
 *   locDM(s)     → 07.09         (совсем узкие: реестр лидов)
 *   locDate(s)   → 07.09.2026
 *   locHM(s)     → 14:32
 * Пусто → '—' (locDM → ''), неразобранное → сама строка как есть.
 *
 * Форматтеры кэшируются: реестры рисуют сотни строк за проход, а
 * toLocaleString на каждый вызов заново собирает Intl.DateTimeFormat —
 * это самая дорогая часть отрисовки таблицы.
 *
 * Чистая дата без времени ('2026-09-07') разбирается как локальная полночь и
 * НЕ сдвигается: locDate вернёт 07.09.2026 в любом поясе. У locTime на такой
 * строке будет «00:00» — для колонок с датой берите locDate.
 */
(function () {
  var CACHE = {};

  function fmter(key, opts) {
    var tz = window.LOC_TZ || '';
    var k = key + '|' + tz;
    if (!CACHE[k]) {
      if (tz) opts = Object.assign({ timeZone: tz }, opts);
      CACHE[k] = new Intl.DateTimeFormat('ru-RU', opts);
    }
    return CACHE[k];
  }

  function toDate(s) {
    if (s == null || s === '') return null;
    if (s instanceof Date) return isNaN(s) ? null : s;
    if (typeof s === 'number') { var n = new Date(s); return isNaN(n) ? null : n; }
    var v = String(s).trim();
    if (!v) return null;
    // только дата, без времени — локальная полночь, иначе уедет на день назад
    var only = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (only) {
      var dd = new Date(+only[1], +only[2] - 1, +only[3]);
      return isNaN(dd) ? null : dd;
    }
    // 'YYYY-MM-DD HH:MM[:SS]' без зоны — это UTC из SQLite, помечаем явно
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(v) && !/([zZ]|[+-]\d{2}:?\d{2})$/.test(v)) {
      v = v.replace(' ', 'T') + 'Z';
    }
    var d = new Date(v);
    return isNaN(d) ? null : d;
  }

  function make(key, opts, empty) {
    return function (s) {
      var d = toDate(s);
      if (d) return fmter(key, opts).format(d);
      return s ? String(s) : (empty === undefined ? '—' : empty);
    };
  }

  window.locDT = toDate;
  window.locTime = make('dt', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  window.locShort = make('short', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  window.locDM = make('dm', { day: '2-digit', month: '2-digit' }, '');
  window.locDate = make('date', { day: '2-digit', month: '2-digit', year: 'numeric' });
  window.locHM = make('hm', { hour: '2-digit', minute: '2-digit' });
})();
