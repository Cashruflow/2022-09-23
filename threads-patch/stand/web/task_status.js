// СТЕНД: заглушка task_status.js (боевой читает справочник /refs#task_status)
const L = { 'В работе': 'в работе', 'Проверка': 'на проверке', 'Готово': 'готово' };
const C = { 'В работе': '#00a0ff', 'Проверка': '#a479e2', 'Готово': '#3dc789' };
export const labelOf = c => L[c] || String(c || '');
export const colorOf = c => C[c] || '';
export const groupOf = c => (c === 'Готово' ? 'done' : 'work');
