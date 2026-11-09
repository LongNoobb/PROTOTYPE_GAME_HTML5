import { cpSync, lstatSync, readFileSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gamesPath = join(root, 'games');
const outputArgument = process.argv[2];
if (!outputArgument) throw new Error('Usage: node scripts/build.mjs <empty-output-directory>');
const output = resolve(outputArgument);

const games = readdirSync(gamesPath, { withFileTypes: true })
  .filter(entry => !entry.name.startsWith('.'))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
for (const game of games) {
  const { name } = game;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || !game.isDirectory()
      || !lstatSync(join(gamesPath, name, 'index.html'), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Expected games/<slug>/index.html, found games/${name}`);
  }
}

if (lstatSync(output, { throwIfNoEntry: false })) rmdirSync(output);
cpSync(join(root, 'site'), output, { recursive: true });

const links = [];
for (const { name } of games) {
  cpSync(join(gamesPath, name), join(output, name), {
    recursive: true,
    filter(source) {
      if (lstatSync(source).isSymbolicLink()) throw new Error(`Symbolic link in game build: ${source}`);
      return !/(?:^|[\\/])(?:\.git|\.DS_Store|Thumbs\.db)$/.test(source);
    },
  });
  const title = name.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  links.push(`<li><a class="game" href="./${name}"><span>${title}</span><span>Play <span aria-hidden="true">↗</span></span></a></li>`);
}

const catalog = links.length
  ? `<ul class="games" role="list">\n        ${links.join('\n        ')}\n      </ul>`
  : '<p class="empty">No prototypes published yet.</p>';
const index = join(output, 'index.html');
writeFileSync(index, readFileSync(index, 'utf8').replace('<!-- GAMES -->', catalog));
