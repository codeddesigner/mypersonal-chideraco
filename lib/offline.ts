import { INK, PAPER } from './accent'
import { GAMES, GAMES_VERSION, gameLabel, gameScript } from './games'

// Switching the website off (Admin → Settings → Website availability).
// middleware.ts sends visitors this page instead of the site; the admin still sees everything.
// It's plain HTML so it can be sent straight from the middleware, without the site around it.
// While they wait, visitors can play the tiny games (lib/games.ts), loaded from public/games.

export const OFFLINE_DEFAULT_TITLE = 'This website is not available right now'
// Set by the middleware (never by the browser) when the admin is looking at the site while it's off.
export const OFFLINE_HEADER = 'x-chidera-offline'
// The admin's preview of what visitors see.
export const OFFLINE_PREVIEW_PATH = '/unavailable'

export type OfflineState = { offline: boolean; title: string; note: string }

// What still works while the site is off: signing in (so the admin can get back in), unsubscribing from
// the newsletter, and the cover pictures inside newsletters people already have.
const OPEN = ['/login', '/auth', '/verify', '/forgot-password', '/reset-password', '/unsubscribe', '/api/newsletter/unsubscribe', '/api/cover']
const CLOSED = ['/auth/signup', '/auth/resend']

const under = (path: string, base: string) => path === base || path.startsWith(base + '/')

export function openWhileOffline(path: string): boolean {
  if (CLOSED.some((base) => under(path, base))) return false
  return OPEN.some((base) => under(path, base))
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Email addresses and https links in the note become links. Everything else is shown as typed.
function linkify(escaped: string): string {
  return escaped.replace(/\bhttps:\/\/[^\s<]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (match) => {
    const trail = match.match(/[.,;:!?)]+$/)?.[0] ?? ''
    const text = trail ? match.slice(0, -trail.length) : match
    const href = text.startsWith('https://') ? text : `mailto:${text}`
    return `<a href="${href}">${text}</a>${trail}`
  })
}

function noteHtml(note: string): string {
  return note
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p class="note">${linkify(escapeHtml(para)).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

const first = GAMES[0]

const picker = GAMES.map(
  (game, i) =>
    `<button type="button" data-game="${game.id}" aria-pressed="${i === 0}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">${game.icon}</svg>${escapeHtml(game.name)}</button>`
).join('')

// Swaps the game on the court when another is picked. Each game's script is fetched the first time it's picked.
function pickerScript(): string {
  const info = GAMES.map(({ id, mouse, touch }) => ({ id, mouse, touch, label: gameLabel(GAMES.find((g) => g.id === id)!) }))
  return `(function () {
  var info = ${JSON.stringify(info).replace(/</g, '\\u003c')}, version = ${JSON.stringify(GAMES_VERSION)};
  var canvas = document.getElementById('game'), score = document.getElementById('game-score'), how = document.getElementById('game-how');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.picker button')), loaded = {}, current = '', stop = null;
  function load(id) {
    return loaded[id] || (loaded[id] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/games/' + id + '.js?v=' + version;
      s.onload = resolve;
      s.onerror = function () { loaded[id] = null; s.remove(); reject() };
      document.head.appendChild(s);
    }));
  }
  function play(id) {
    var game = info.filter(function (g) { return g.id === id })[0];
    if (!game || id === current) return;
    current = id;
    if (stop) { stop(); stop = null }
    // A fresh court for each game.
    var fresh = canvas.cloneNode(false);
    fresh.removeAttribute('style'); fresh.setAttribute('aria-label', game.label);
    canvas.parentNode.replaceChild(fresh, canvas); canvas = fresh;
    while (score.firstChild) score.removeChild(score.firstChild);
    how.querySelector('.how-mouse').textContent = game.mouse;
    how.querySelector('.how-touch').textContent = game.touch;
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-game') === id)) });
    load(id).then(function () {
      var start = window.chideraGames && window.chideraGames[id];
      if (current === id && typeof start === 'function') stop = start(canvas, { score: score });
    }, function () {
      how.querySelector('.how-mouse').textContent = how.querySelector('.how-touch').textContent = 'This game didn’t load. Try again in a moment.';
    });
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () { play(b.getAttribute('data-game')); canvas.focus({ preventScroll: true }) });
  });
  play(info[0].id);
})();`
}

export function offlinePage(state: OfflineState, options: { preview?: boolean } = {}): string {
  const title = state.title.trim() || OFFLINE_DEFAULT_TITLE
  const preview = options.preview
    ? `<p class="preview" role="status">${
        state.offline
          ? 'Preview. This is what visitors see while your website is off.'
          : 'Preview. Visitors will see this once you switch your website off.'
      } <a href="/admin/settings#availability">Back to Settings</a></p>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${PAPER}">
<title>${escapeHtml(title)} | Chidera’s Note</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/ChideraSpar-Regular.woff" as="font" type="font/woff" crossorigin>
<style>
@font-face { font-family: 'Chidera SPAR'; src: url('/fonts/ChideraSpar-Regular.woff') format('woff'); font-weight: 400; font-style: normal; font-display: swap; }
:root { --paper: ${PAPER}; --ink: ${INK}; --ink-2: #3f4d43; color-scheme: light; }
*, *::before, *::after { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  margin: 0; display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh;
  background: var(--paper); color: var(--ink);
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', sans-serif;
  font-size: 16px; line-height: 1.5; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
a { color: inherit; text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 4px; }
a:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; border-radius: 2px; }
.note a { overflow-wrap: anywhere; }
.preview { margin: 0; padding: 10px 16px; background: var(--ink); color: var(--paper); text-align: center; font-size: 14px; }
.page { flex: 1; display: flex; flex-direction: column; width: 100%; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px); }
.brand { margin: 0; font-family: 'Chidera SPAR', Georgia, 'Times New Roman', serif; font-size: 25px; line-height: 1; letter-spacing: -0.02em; }
main {
  flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 5vw, 88px);
  align-items: center; padding: clamp(40px, 7vw, 96px) 0 clamp(16px, 3vw, 40px);
}
h1 {
  margin: 0 0 0 -0.03em; max-width: 11ch;
  font-family: 'Chidera SPAR', Georgia, 'Times New Roman', serif; font-weight: 400;
  font-size: clamp(46px, 6.6vw, 112px); line-height: 0.94; letter-spacing: -0.03em; text-wrap: balance;
}
.note { margin: 24px 0 0; max-width: 44ch; font-size: clamp(17px, 1.45vw, 20px); line-height: 1.45; color: var(--ink-2); text-wrap: pretty; }
.note + .note { margin-top: 12px; }
.game { margin: 0; min-width: 0; }
.game-intro { margin: 0 0 10px; font-size: 15px; color: var(--ink-2); }
.picker { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 14px; }
.picker button {
  display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 5px 12px 5px 8px;
  border: 1.5px solid var(--ink); border-radius: 999px; background: none; color: var(--ink); cursor: pointer;
  font: 600 14.5px/1 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.picker button:hover { background: #efefe5; }
.picker button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
.picker button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.picker svg { flex: none; }
.game canvas {
  display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; border-radius: 6px;
  outline: 1.5px solid var(--ink); outline-offset: -1.5px; touch-action: none; cursor: crosshair; user-select: none; -webkit-user-select: none;
}
.game canvas:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.game-foot { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 20px; margin-top: 12px; font-size: 15px; color: var(--ink-2); }
.game-foot p { margin: 0; }
.game-foot p:first-child { flex: 1 1 240px; }
/* The how-to matches the device: a mouse aims and clicks, a finger pulls back and lets go. */
.how-mouse { display: none; }
@media (hover: hover) and (pointer: fine) { .how-mouse { display: inline; } .how-touch { display: none; } }
.score { display: flex; gap: 18px; font-variant-numeric: tabular-nums; }
.score b { font-family: 'Chidera SPAR', Georgia, serif; font-weight: 400; font-size: 24px; line-height: 1; color: var(--ink); margin-left: 6px; }
@media (max-width: 820px) {
  main { grid-template-columns: minmax(0, 1fr); align-items: start; align-content: start; gap: 40px; padding-top: 48px; }
  h1 { max-width: 12ch; }
}
</style>
</head>
<body>
${preview}<div class="page">
<p class="brand">Chidera’s Note</p>
<main>
<div>
<h1>${escapeHtml(title)}</h1>
${noteHtml(state.note)}
</div>
<section class="game" aria-label="Tiny games">
<p class="game-intro">While you wait, play a tiny game.</p>
<div class="picker" role="group" aria-label="Choose a game">${picker}</div>
<canvas id="game" width="600" height="450" tabindex="0" aria-label="${escapeHtml(gameLabel(first))}" aria-describedby="game-how"></canvas>
<div class="game-foot">
<p id="game-how"><span class="how-mouse">${escapeHtml(first.mouse)}</span><span class="how-touch">${escapeHtml(first.touch)}</span></p>
<p class="score" id="game-score" aria-live="polite"></p>
</div>
</section>
</main>
</div>
<script src="${gameScript('kit')}"></script>
<script>${pickerScript()}</script>
</body>
</html>
`
}
