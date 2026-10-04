import { readFileSync, writeFileSync, mkdirSync, cpSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const source = 'docs/publication';
const listing = JSON.parse(readFileSync(join(source, 'store-listing.json'), 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.version !== listing.version) throw Error('Listing and package versions differ');
const constraints = { title: [1, 50], seo: [50, 160], short: [1, 70], about: [100, 1000], howToPlay: [100, 1000], keywords: [1, 100] };
const names = { title: 'Название / Title', seo: 'Описание для SEO / SEO', short: 'Короткое описание / Short description', about: 'Об игре / About the game', howToPlay: 'Как играть / How to play', keywords: 'Ключевые слова / Keywords', productTitle: 'Название товара / Product title', productDescription: 'Описание товара / Product description' };
let text = '# Тексты для черновика Яндекс Игр\n\n';
text += `Версия: ${listing.version}. Языки: ru/en. Платформы: десктоп, Android, iOS. Ориентация: любая. Облачные сохранения: включить. Категории: головоломки, обучающие. Предварительный возрастной рейтинг: 6+ (сверить в консоли).\n\nТовар: disable_ads. Цена задаётся владельцем в консоли. Контакт поддержки ещё не указан. Названия проверить на уникальность.\n`;
for (const lang of listing.languages) {
  text += `\n## ${lang === 'ru' ? 'Русский' : 'English'}\n`;
  for (const [field, label] of Object.entries(names)) {
    const value = listing[lang][field];
    if (!value) throw Error(`Missing ${lang}.${field}`);
    const bounds = constraints[field];
    if (bounds && (value.length < bounds[0] || value.length > bounds[1])) throw Error(`Invalid length ${lang}.${field}: ${value.length}`);
    text += `\n### ${label}\n\n${value}\n`;
  }
}
if (listing.moderatorComment.length > 2048) throw Error('Moderator comment too long');
text += `\n## Комментарий разработчика\n\n${listing.moderatorComment}\n`;
writeFileSync(join(source, 'store-listing.md'), text);
const output = 'artifacts/yandex-publication';
mkdirSync(join(output, 'media'), { recursive: true });
const media = [];
function png(name, width, height) {
  const buffer = readFileSync(join(source, 'media', name));
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || buffer.readUInt32BE(16) !== width || buffer.readUInt32BE(20) !== height || buffer[25] !== 2) throw Error(`Expected RGB PNG ${width}x${height}: ${name}`);
  media.push(name);
}
png('icon.png', 512, 512); png('icon-maskable.png', 512, 512);
for (const lang of listing.languages) {
  png(`cover-${lang}.png`, 800, 470);
  for (const scene of ['linked', 'puzzle']) {
    png(`desktop-${lang}-${scene}.png`, 1280, 720);
    png(`mobile-${lang}-${scene}.png`, 720, 1280);
  }
  const video = `gameplay-${lang}.mp4`;
  const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height:format=duration', '-of', 'json', join(source, 'media', video)], { encoding: 'utf8' }));
  const stream = metadata.streams.find(item => item.codec_name === 'h264');
  const duration = Number(metadata.format.duration);
  if (!stream || stream.width !== 1280 || stream.height !== 720 || duration <= 0 || duration > 28 || statSync(join(source, 'media', video)).size > 100_000_000) throw Error(`Invalid video: ${video}`);
  media.push(video);
}
const files = ['game.zip', 'store-listing.md', 'after-account.md', 'README.md', 'qa.md', 'content-policy.md', ...media.map(name => 'media/' + name)];
cpSync(`artifacts/solve-and-discover-yandex-${pkg.version}.zip`, join(output, 'game.zip'));
cpSync(join(source, 'store-listing.md'), join(output, 'store-listing.md'));
writeFileSync(join(output, 'after-account.md'), readFileSync('docs/yandex-after-account.md', 'utf8').replaceAll('(publication/README.md)', '(README.md)').replaceAll('(publication/store-listing.md)', '(store-listing.md)').replaceAll('(qa/yandex-publication.md)', '(qa.md)'));
writeFileSync(join(output, 'README.md'), readFileSync(join(source, 'README.md'), 'utf8').replaceAll('(../yandex-after-account.md)', '(after-account.md)').replaceAll('(../qa/yandex-publication.md)', '(qa.md)').replaceAll('(../content-policy.md)', '(content-policy.md)'));
cpSync('docs/qa/yandex-publication.md', join(output, 'qa.md'));
cpSync('docs/content-policy.md', join(output, 'content-policy.md'));
for (const name of media) cpSync(join(source, 'media', name), join(output, 'media', name));
const manifest = {
  version: pkg.version,
  preparedAt: new Date().toISOString(),
  gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  platformTested: false,
  files: files.map(path => ({ path, bytes: statSync(join(output, path)).size, sha256: createHash('sha256').update(readFileSync(join(output, path))).digest('hex') })),
};
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Publication package: ${files.length} files + manifest; ${output}/game.zip. Platform acceptance remains pending.`);
