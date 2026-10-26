// СТЕНД: parseItems — дословная копия из боевого web/checklist_log.js (стр. 33–52)
function parseItems(text) {
  const items = [];
  String(text || "").split("\n").forEach(ln => {
    const m = ln.match(/^([ \t]*)\[( |x|X|-)\]\s?(.*)$/);
    if (!m) return;
    let itemText = m[3], legacyCreated = null;
    const dm = itemText.match(/^(.*?)\s·\s(\d{2}\.\d{2}\.\d{4})(?:→(\d{2}\.\d{2}\.\d{4}))?$/);
    if (dm) { itemText = dm[1]; const [, , dmy] = dm; const p = dmy.split("."); legacyCreated = `${p[2]}-${p[1]}-${p[0]} 00:00:00`; }
    items.push({ done: m[2].toLowerCase() === "x", cancelled: m[2] === "-", text: itemText.trim(), level: m[1].length >= 2 ? 1 : 0, legacyCreated });
  });
  return items;
}
export { parseItems };
