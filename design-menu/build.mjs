import fs from 'node:fs';

const icons = JSON.parse(fs.readFileSync('icons.json', 'utf8'));
const style = fs.readFileSync('style.frag', 'utf8').trimEnd();
const logo  = fs.readFileSync('logo.frag', 'utf8').trim();

const svg = (name, cls) => {
  const p = icons[name];
  if (!p) throw new Error('нет иконки: ' + name);
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" `
       + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
};

for (const src of fs.readdirSync('.').filter((f) => f.endsWith('.src.html'))) {
  const out = src.replace('.src.html', '.dc.html');
  let s = fs.readFileSync(src, 'utf8');
  s = s.replace(/@@STYLE@@/g, style).replace(/@@LOGO@@/g, logo);
  s = s.replace(/@@ICO:([a-z]+)(?::([a-z0-9 _-]+))?@@/g, (_m, n, cls) => svg(n, cls || 'ico'));
  const left = s.match(/@@[^@]+@@/);
  if (left) throw new Error(`${src}: не подставлено ${left[0]}`);
  fs.writeFileSync(out, s);
  console.log(out, s.length);
}
