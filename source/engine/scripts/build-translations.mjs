import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
const root = dirname(fileURLToPath(import.meta.url));
function csv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (ch === ',' || ch === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (ch === '\n') { rows.push(row); row = []; }
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.slice(1);
}
const id = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const result = {};
for (const type of ['pokemon_species', 'move', 'ability', 'item']) {
  const rows = csv(readFileSync(join(root, 'translation-source', `${type}_names.csv`), 'utf8'));
  const english = new Map(rows.filter(r => r[1] === '9').map(r => [r[0], r[2]]));
  const names = {};
  for (const row of rows) if (row[1] === '12' && english.has(row[0])) {
    names[type === 'pokemon_species' ? row[0] : id(english.get(row[0]))] = row[2];
  }
  result[type] = names;
  console.log(`${type}: ${Object.keys(names).length}`);
}
mkdirSync(join(root, '..', 'src', 'data'), { recursive: true });
const json = JSON.stringify(result);
writeFileSync(join(root, '..', 'src', 'data', 'zh-cn.mjs'), 'export default ' + json + ';\n');
console.log(`名称字典 ${Buffer.byteLength(json)} bytes / gzip ${gzipSync(json).length} bytes`);
