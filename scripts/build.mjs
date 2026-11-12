import { cpSync, lstatSync, readFileSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gamesPath = join(root, 'games');
const metadata = JSON.parse(readFileSync(join(root, 'site', 'games.json'), 'utf8'));
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const outputArgument = process.argv[2];
if (!outputArgument) throw new Error('Usage: node scripts/build.mjs <empty-output-directory>');
const output = resolve(outputArgument);

const games = readdirSync(gamesPath, { withFileTypes: true })
  .filter(entry => !entry.name.startsWith('.'))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
for (const game of games) {
  const { name } = game;
  if (!/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/.test(name) || !game.isDirectory()
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
  const details = metadata[name] ?? {};
  const title = escapeHtml(details.title ?? name.split(/[-_]/).map(word => word[0].toUpperCase() + word.slice(1)).join(' '));
  const category = escapeHtml(details.category ?? 'Game · Prototype');
  const description = escapeHtml(details.description ?? 'A new idea to explore. Jump in and try this playable experiment.');
  const art = details.art ?? 'prototype.svg';
  if (!/^[a-z0-9-]+\.svg$/.test(art)
      || !lstatSync(join(root, 'site', 'assets', art), { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing or invalid catalog artwork for ${name}: ${art}`);
  }
  const demo = details.demo;
  if (demo !== undefined && (typeof demo !== 'string' || !/^[a-z0-9-]+\.(?:mp4|webm)$/.test(demo)
      || !lstatSync(join(root, 'site', 'assets', 'demos', demo), { throwIfNoEntry: false })?.isFile())) {
    throw new Error(`Missing or invalid demo video for ${name}: ${demo}`);
  }
  const preview = demo ? `<video class="game-demo" data-src="./assets/demos/${demo}" muted loop playsinline preload="none" disablepictureinpicture tabindex="-1" aria-hidden="true"></video><span class="preview-hint" aria-hidden="true"><svg viewBox="0 0 16 16" fill="currentColor"><path d="m5 3 8 5-8 5V3Z"/></svg><span class="preview-label-idle">Hover to preview</span><span class="preview-label-playing">Gameplay · muted</span></span>` : '';
  links.push(`<li><a class="game" href="./${name}/" aria-labelledby="game-${name}">
          <div class="game-art"><img src="./assets/${art}" alt="" width="800" height="500" decoding="async">${preview}<span class="game-number" aria-hidden="true">EXP. ${String(links.length + 1).padStart(2, '0')}</span><span class="build-badge"><span class="status-dot" aria-hidden="true"></span>Prototype</span></div>
          <div class="game-body"><p class="game-category">${category}</p><h3 id="game-${name}">${title}</h3><p class="game-description">${description}</p>
            <div class="game-footer"><span class="platform"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 9h18M7 6.5h.01m3 0h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Browser game</span><span class="play-link">Play prototype <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
          </div></a></li>`);
}

const catalog = links.length
  ? `<ul class="games" role="list">\n        ${links.join('\n        ')}\n      </ul>`
  : '<p class="empty">No prototypes published yet.</p>';
const index = join(output, 'index.html');
writeFileSync(index, readFileSync(index, 'utf8').replace('<!-- GAMES -->', catalog).replaceAll('<!-- COUNT -->', String(games.length)));
