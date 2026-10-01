import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = 'dist-yandex';
if (!readFileSync(join(root, 'index.html'), 'utf8').includes('Разгадай и узнай')) throw Error('Missing entry');
const list = dir => readdirSync(dir).flatMap(name => statSync(join(dir, name)).isDirectory() ? list(join(dir, name)) : [join(dir, name)]);
const files = list(root);
for (const file of files) {
  if (/[\sа-яё]/i.test(file)) throw Error(`Invalid filename: ${file}`);
  if (/\.(js|css|html)$/.test(file) && readFileSync(file, 'utf8').includes('__arrowSnapshot')) throw Error('Developer state leaked into release');
  if (/\.(js|css|html)$/.test(file) && /debug-panel|data-debug|data-gallery|victory-gallery|fact-review/.test(readFileSync(file, 'utf8'))) throw Error('Test UI leaked into release');
}
const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
// Yandex specifies 100 MB before ZIP compression; use decimal MB conservatively.
if (bytes > 100_000_000) throw Error('Archive exceeds platform limit');
console.log(`Yandex slice: ${files.length} files, ${bytes} bytes; no development inspector.`);
