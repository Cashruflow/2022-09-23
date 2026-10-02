// Проверка: у каждого пункта MENU в sidebar.js свой значок, и каждый значок есть в спрайте.
// node tools/check_menu_icons.js /home/cashruflow/web/public/sidebar.js /home/cashruflow/web/public/assets/icons.svg
const fs = require('fs');
const [js, svg] = process.argv.slice(2);
const s = fs.readFileSync(js, 'utf8');
const a = s.indexOf('const MENU = ['), b = s.indexOf('];', a);
const items = [...s.slice(a, b).matchAll(/href: '([^']+)', icon: '([^']+)', label: '([^']+)'/g)].map(m => ({ href: m[1], icon: m[2], label: m[3] }));
const ids = new Set([...fs.readFileSync(svg, 'utf8').matchAll(/<symbol id="i-([^"]+)"/g)].map(m => m[1]));
const seen = {}; let bad = 0;
for (const it of items) (seen[it.icon] = seen[it.icon] || []).push(it.label);
for (const [ic, ls] of Object.entries(seen)) if (ls.length > 1) { bad++; console.log('ПОВТОР i-' + ic + ': ' + ls.join(', ')); }
for (const it of items) if (!ids.has(it.icon)) { bad++; console.log('НЕТ В СПРАЙТЕ i-' + it.icon + ' (' + it.label + ')'); }
console.log(items.length + ' пунктов, ' + Object.keys(seen).length + ' значков' + (bad ? ', ошибок: ' + bad : ', всё уникально'));
process.exit(bad ? 1 : 0);
