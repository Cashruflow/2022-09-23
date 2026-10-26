/* СТЕНД: заглушка /ui-color.js — uiColorVar(hex) → "--c:#rrggbb" (боевой разбирает и проверяет hex) */
window.uiColorVar = function (h) { h = String(h || ''); return /^#[0-9a-f]{6}$/i.test(h) ? '--c:' + h.toLowerCase() : ''; };
