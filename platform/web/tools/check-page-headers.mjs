#!/usr/bin/env node
// Проверка шапок страниц портала (ADR-147).
//
// Правило одно: шапку страницы задаёт .ph из ui.css, а собирает её /page-header.js.
// Своей вёрстки шапки на страницах нет. Документацию можно пролистать — эту проверку
// нет: запускается перед выкатом и валит сборку, если на странице снова появилась
// иконка в заголовке, полоса-разделитель, ссылка-дубль бургера или счётчик внутри H1.
//
// Запуск:  node web/tools/check-page-headers.mjs
// Только отчёт, без кода возврата:  node web/tools/check-page-headers.mjs --report
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const DIR = new URL('../public/', import.meta.url).pathname;

// Не страницы портала: те, что НЕ подключают /sidebar.js ни в одном режиме, —
// лендинги, экраны входа, публичные документы и кабинетные шаблоны на
// /cab-sidebar.js. Шапка платформы им не положена, page-header.js там не работает.
// Список сверять с `grep -l "sidebar.js" web/public/*.html`, а не додумывать.
const NOT_PORTAL = new Set([
  'policy.html', 'patient-auth.html', 'crm-auth.html', 'booking.html',
  'client.html', 'admin-patients.html', 'talents.html', 'team.html', 'test.html',
]);

// H1 целиком, вместе с содержимым.
const H1 = /<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const RULES = [
  {
    id: 'icon-in-h1',
    say: 'значок слева от заголовка',
    hit: (attrs, inner) => /<svg\b/i.test(inner) || /<use\b/i.test(inner),
  },
  {
    id: 'emoji-in-h1',
    say: 'эмодзи в заголовке',
    hit: (attrs, inner) => EMOJI.test(inner.replace(/<[^>]*>/g, '')),
  },
  {
    id: 'counter-in-h1',
    say: 'счётчик внутри H1 — он идёт в подзаголовок (data-sub)',
    // Список тот же, что у COUNTER в page-header.js: проверка должна ругаться ровно
    // на то, что скрипт молча уносит в подзаголовок, иначе она недоговаривает.
    hit: (attrs, inner) => /<span[^>]*\b(class|id)\s*=\s*"[^"]*\b(cnt|count|total|stats|badge|kick|muted|shown)\b/i.test(inner),
  },
];

// Ссылка-возврат на главную рядом с заголовком — дубль бургера.
const BACKLINK = /<a[^>]*href\s*=\s*"\/"[^>]*>\s*[←‹]/i;
// Полоса-разделитель под шапкой: <header> со своей нижней границей.
const HEADER_BORDER = /header\s*\{[^}]*border-bottom\s*:(?!\s*(0|none))/i;

let bad = 0, checked = 0;
const report = [];

for (const f of readdirSync(DIR).filter(n => n.endsWith('.html')).sort()) {
  if (NOT_PORTAL.has(basename(f))) continue;
  const src = readFileSync(join(DIR, f), 'utf8');
  checked++;
  const found = [];

  for (const m of src.matchAll(H1)) {
    const [, attrs, inner] = m;
    if (/\bno-ui-h1\b/.test(attrs)) continue;          // явный отказ: не шапка портала
    for (const r of RULES) if (r.hit(attrs, inner) && !found.some(x => x.id === r.id)) found.push(r);
  }
  if (BACKLINK.test(src)) found.push({ id: 'back-link', say: 'ссылка «← AI-платформа» — навигация живёт в бургере' });
  if (HEADER_BORDER.test(src)) found.push({ id: 'header-rule', say: 'полоса-разделитель под шапкой' });

  if (found.length) {
    bad++;
    report.push(`  ${f}\n` + found.map(r => `    · ${r.say}  [${r.id}]`).join('\n'));
  }
}

if (!bad) {
  console.log(`Шапки в порядке: проверено ${checked} страниц портала.`);
  process.exit(0);
}

console.error(`Своя вёрстка шапки на ${bad} из ${checked} страниц портала:\n`);
console.error(report.join('\n'));
console.error(`
Шапку задаёт .ph в ui.css, собирает /page-header.js (ADR-147). На странице
пишем только заголовок и подзаголовок:

    <h1 data-sub="22 доступа · 5 проектов">Доступы</h1>

Нужна своя разметка — пишем её классами .ph/.ph-row/.ph-ttl/.ph-s/.ph-tools,
тогда скрипт её не трогает. Страница вне портала (лендинг, вход) — class="no-ui-h1".`);
process.exit(process.argv.includes('--report') ? 0 : 1);
