// Swipe through the most popular shows: right = seen, left = never seen, up = watchlist.
import * as store from '../store.js';
import { raiseTo } from '../model.js';
import { esc, icon, num, genreDE, toast, reducedMotion } from '../ui.js';

const THRESHOLD = 90; // px of drag that commits a swipe
let list = null; // [[id, name, image, from, to, running, network, genres, rating], ...]
let loadError = null;
const handled = new Set(); // swiped this session (store writes may still be in flight)
const history = []; // for undo: { id, kind, before, pending }
let session = { right: 0, left: 0, up: 0 };
let busy = false;
let rootEl = null;

async function loadList() {
  if (list) return list;
  const res = await fetch('data/popular.json');
  if (!res.ok) throw new Error('Die Serienliste konnte nicht geladen werden.');
  list = (await res.json()).shows;
  return list;
}

function inLibrary(id) {
  const e = store.entry(id);
  return !!e && (e.watchlist || e.rating || Object.keys(e.counts).length);
}

/** The next cards, in popularity order, skipping everything already decided. */
function deck(n = 3) {
  const out = [];
  for (let i = 0; i < list.length && out.length < n; i++) {
    const s = list[i];
    if (handled.has(s[0]) || store.isDismissed(s[0]) || inLibrary(s[0])) continue;
    out.push({ s, rank: i + 1 });
  }
  return out;
}

export async function render(root) {
  rootEl = root;
  if (!list && !loadError) {
    root.innerHTML = `<section class="page page--swipe"><p class="muted">Serienliste wird geladen …</p></section>`;
    try { await loadList(); } catch (err) { loadError = err.message; }
    if (!location.hash.startsWith('#/swipen')) return;
  }
  if (loadError) {
    root.innerHTML = `<section class="page page--swipe"><p class="notice notice--error">${esc(loadError)} ${navigator.onLine ? '' : 'Du bist offline.'}</p></section>`;
    return;
  }
  paint();
}

// Store events (writes from earlier swipes) only refresh the counters, never the deck mid-drag.
export function update() {
  const c = rootEl?.querySelector('[data-counts]');
  if (c) c.innerHTML = counts();
}

function counts() {
  return `<span><b>${num(session.right)}</b> gesehen</span><span><b>${num(session.up)}</b> Watchlist</span><span><b>${num(session.left)}</b> nie gesehen</span>`;
}

function card({ s, rank }, depth) {
  const [id, name, image, from, to, running, network, genres] = s;
  const years = from ? (running ? `seit ${from}` : to && to !== from ? `${from}–${to}` : from) : '';
  const meta = [years, network].filter(Boolean).join(' · ');
  return `<article class="swipe-card" data-id="${id}" data-depth="${depth}" ${depth ? 'aria-hidden="true"' : ''}>
    <span class="stamp stamp--right" aria-hidden="true">Gesehen</span>
    <span class="stamp stamp--left" aria-hidden="true">Nie gesehen</span>
    <span class="stamp stamp--up" aria-hidden="true">Watchlist</span>
    <span class="cover cover--case cover--swipe">${image ? `<img src="${esc(image)}" alt="" width="210" height="295" draggable="false"${depth > 1 ? ' loading="lazy"' : ''}>` : `<span class="cover__blank">${esc(name.slice(0, 1))}</span>`}</span>
    <span class="swipe-card__rank">#${num(rank)} der beliebtesten</span>
    <h2 class="swipe-card__name">${esc(name)}</h2>
    <p class="swipe-card__meta">${esc(meta)}</p>
    ${genres.length ? `<p class="swipe-card__genres">${genres.map((g) => esc(genreDE(g))).join(' · ')}</p>` : ''}
  </article>`;
}

function paint() {
  const cards = deck(3);
  rootEl.innerHTML = `<section class="page page--swipe">
    <header class="swipe-head">
      <h1 class="title-md">Durchswipen</h1>
      <p class="swipe-counts" data-counts aria-live="polite">${counts()}</p>
    </header>
    ${cards.length ? `
    <div class="swipe-stage">
      <div class="swipe-deck">${cards.map((c, i) => card(c, i)).reverse().join('')}</div>
    </div>
    <div class="swipe-actions" role="group" aria-label="Entscheidung">
      <button type="button" class="swipe-btn swipe-btn--left" data-swipe="left" aria-label="Nie gesehen (Pfeil links)">${icon('x')}<span>Nie gesehen</span></button>
      <button type="button" class="swipe-btn swipe-btn--up" data-swipe="up" aria-label="Auf die Watchlist (Pfeil hoch)">${icon('bookmark')}<span>Watchlist</span></button>
      <button type="button" class="swipe-btn swipe-btn--right" data-swipe="right" aria-label="Gesehen, ins Regal (Pfeil rechts)">${icon('check')}<span>Gesehen</span></button>
    </div>
    <p class="swipe-help muted">
      <button type="button" class="link-btn" data-undo ${history.length ? '' : 'disabled'}>Rückgängig</button>
      <span>Rechts: gesehen · Links: nie gesehen · Hoch: Watchlist</span>
    </p>` : `
    <div class="swipe-done">
      <p class="lede">Du bist durch alle ${num(list.length)} Serien der Liste. Ganz schön viel Fernsehen.</p>
      <a class="btn btn--primary" href="#/regal">${icon('shelf')}Zum Regal</a>
    </div>`}
  </section>`;

  rootEl.querySelectorAll('[data-swipe]').forEach((b) => b.addEventListener('click', () => commit(b.dataset.swipe)));
  rootEl.querySelector('[data-undo]')?.addEventListener('click', undo);
  const top = rootEl.querySelector('.swipe-card[data-depth="0"]');
  if (top) bindDrag(top);
}

function bindDrag(el) {
  let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
  el.addEventListener('pointerdown', (e) => {
    if (busy || e.button !== 0) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY; dx = dy = 0;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX; dy = e.clientY - startY;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    const dir = direction(dx, dy);
    const strength = Math.min(1, Math.max(Math.abs(dx), -dy) / THRESHOLD);
    el.dataset.dir = dir || '';
    el.style.setProperty('--strength', dir ? strength : 0);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    const dir = direction(dx, dy);
    const far = dir === 'up' ? -dy > THRESHOLD : Math.abs(dx) > THRESHOLD;
    if (dir && far) commit(dir, { dx, dy });
    else {
      el.style.transform = '';
      el.dataset.dir = '';
      el.style.setProperty('--strength', 0);
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function direction(dx, dy) {
  if (-dy > Math.abs(dx) && -dy > 24) return 'up';
  if (dx > 24) return 'right';
  if (dx < -24) return 'left';
  return null;
}

async function commit(kind, from = { dx: 0, dy: 0 }) {
  if (busy) return;
  const el = rootEl?.querySelector('.swipe-card[data-depth="0"]');
  if (!el) return;
  busy = true;
  const id = Number(el.dataset.id);
  const name = el.querySelector('.swipe-card__name').textContent;

  // Fly the card off in its direction, then bring the next one up.
  if (!reducedMotion()) {
    const tx = kind === 'right' ? innerWidth : kind === 'left' ? -innerWidth : from.dx;
    const ty = kind === 'up' ? -innerHeight : from.dy;
    el.dataset.dir = kind;
    el.style.setProperty('--strength', 1);
    el.style.transition = 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms';
    el.style.transform = `translate(${tx}px, ${ty}px) rotate(${kind === 'up' ? 0 : (tx / 40)}deg)`;
    el.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 260));
  }

  handled.add(id);
  session[kind]++;
  const entry = { id, kind, name, before: store.snapshot(id), pending: null };
  history.push(entry);
  if (history.length > 50) history.shift();

  if (kind === 'left') {
    store.dismiss(id);
  } else {
    // Needs the full show (episodes) from TVmaze; runs in the background, queue-throttled.
    entry.pending = store.getShow(id)
      .then((show) => {
        if (kind === 'right') store.updateCounts(id, (c) => raiseTo(show, c, 1));
        else store.setWatchlist(id, true);
      })
      .catch((err) => toast(`${esc(name)}: ${esc(err.message || 'konnte nicht geladen werden')}`));
  }
  busy = false;
  paint();
}

async function undo() {
  const last = history.pop();
  if (!last) return;
  await last.pending;
  if (last.kind === 'left') store.undismiss(last.id);
  else store.restore(last.id, last.before);
  handled.delete(last.id);
  session[last.kind]--;
  paint();
  toast(`<strong>${esc(last.name)}</strong> ist zurück im Stapel.`);
}

// Keyboard: arrows decide, Backspace undoes. Active only while this view is on screen.
document.addEventListener('keydown', (e) => {
  if (!document.querySelector('.page--swipe .swipe-deck') || e.target.closest?.('input, textarea, button')) return;
  const map = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up' };
  if (map[e.key]) { e.preventDefault(); commit(map[e.key]); }
  else if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); undo(); }
});
