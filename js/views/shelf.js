import * as store from '../store.js';
import { showStats, libraryStats } from '../model.js';
import { esc, num, duration, hoursOf, spine, boxHeight, icon } from '../ui.js';

const SORTS = {
  added: { label: 'Zuletzt', fn: (a, b) => b.entry.updatedAt - a.entry.updatedAt },
  rating: { label: 'Wertung', fn: (a, b) => (b.entry.rating || 0) - (a.entry.rating || 0) || a.show.name.localeCompare(b.show.name, 'de') },
  time: { label: 'Laufzeit', fn: (a, b) => b.stats.watchedMinutes - a.stats.watchedMinutes },
  name: { label: 'A–Z', fn: (a, b) => a.show.name.localeCompare(b.show.name, 'de') },
};
const FILTERS = {
  all: { label: 'Alle', fn: () => true },
  complete: { label: 'Komplett', fn: (x) => x.stats.complete },
  open: { label: 'Angefangen', fn: (x) => x.stats.started && !x.stats.complete },
};

let sort = 'added';
let filter = 'all';
try {
  sort = localStorage.getItem('serienregal.sort') || sort;
  if (!SORTS[sort]) sort = 'added';
} catch { /* ignore */ }

const STARTERS = ['Breaking Bad', 'Game of Thrones', 'Friends', 'Dark', 'Stranger Things', 'The Office', 'The Sopranos', 'How I Met Your Mother'];

export function render(root) {
  // Shows that are only on the watchlist are not on the shelf yet.
  const items = store.libraryShows().filter((x) => x.entry.rating || Object.keys(x.entry.counts).length);
  const pending = store.pendingCount();
  const lib = libraryStats(items);

  if (!items.length && !pending) {
    root.innerHTML = `
      <section class="page page--shelf">
        <div class="empty-shelf" aria-hidden="true">
          <div class="shelf shelf--ghost">${'<span class="ghost-gap"></span>'.repeat(3)}</div>
        </div>
        <div class="empty-copy">
          <h1 class="title-xl">Dein Regal ist noch leer.</h1>
          <p class="lede">Stell die erste Serie hinein, die du je gesehen hast. Ein Tipp genügt: Staffeln und Folgen kannst du später noch genauer eintragen.</p>
          <div class="swipe-entry"><p><strong>Schnellstart: Zappen</strong>Die beliebtesten Serien nacheinander: rechts gesehen, links nie gesehen, hoch auf die Watchlist.</p><a class="btn btn--primary" href="#/zappen">${icon('tv')}Los geht's</a></div>
          <a class="btn btn--outline" href="#/suche">${icon('search')}Gezielt suchen</a>
          <p class="starters-label">Oder fang mit einem Klassiker an:</p>
          <ul class="chips">${STARTERS.map((n) => `<li><a class="chip" href="#/suche?q=${encodeURIComponent(n)}">${esc(n)}</a></li>`).join('')}</ul>
        </div>
      </section>`;
    return;
  }

  const enriched = items.map((x) => ({ ...x, stats: showStats(x.show, x.entry) }));
  const list = enriched.filter(FILTERS[filter].fn).sort(SORTS[sort].fn);

  root.innerHTML = `
    <section class="page page--shelf">
      <header class="ledger">
        <h1 class="ledger__sentence">
          ${lib.minutes ? `Du hast <span class="ledger__time">${duration(lib.minutes, { long: true })}</span> Serien geschaut.` : 'Noch keine Folge als gesehen markiert.'}
        </h1>
        <dl class="specs">
          <div class="spec"><dt>Serien</dt><dd>${num(lib.started)}</dd></div>
          <div class="spec"><dt>Komplett</dt><dd>${num(lib.complete)}</dd></div>
          <div class="spec"><dt>Staffeln</dt><dd>${num(lib.seasonsWatched)}</dd></div>
          <div class="spec"><dt>Folgen</dt><dd>${num(lib.episodes)}</dd></div>
          <div class="spec"><dt>Stunden</dt><dd>${lib.estimated ? '<abbr title="Für manche Folgen fehlt die genaue Länge, dort zählt die übliche Laufzeit der Serie.">ca.</abbr> ' : ''}${hoursOf(lib.minutes)}</dd></div>
        </dl>
      </header>

      <div class="shelf-tools">
        <div class="seg" role="group" aria-label="Sortieren">
          ${Object.entries(SORTS).map(([k, s]) => `<button type="button" class="seg__btn" data-sort="${k}" aria-pressed="${k === sort}">${s.label}</button>`).join('')}
        </div>
        <div class="seg" role="group" aria-label="Filtern">
          ${Object.entries(FILTERS).map(([k, f]) => `<button type="button" class="seg__btn" data-filter="${k}" aria-pressed="${k === filter}">${f.label}</button>`).join('')}
        </div>
      </div>

      ${list.length ? `<div class="shelf" role="list" aria-label="Deine Serien">
        ${list.map(({ show, stats, entry }) => boxset(show, stats, entry)).join('')}
      </div>` : `<p class="muted shelf-none">In diesem Fach steht noch nichts.</p>`}
      ${pending ? `<p class="muted loading-line">${pending} ${pending === 1 ? 'Serie wird' : 'Serien werden'} noch von TVmaze geladen …</p>` : ''}
      <p class="shelf-hint muted">Volle Rücken: gesehen. Leere Hüllen: Staffeln, die dir noch fehlen.</p>
    </section>`;

  root.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
    sort = b.dataset.sort;
    try { localStorage.setItem('serienregal.sort', sort); } catch { /* ignore */ }
    render(root);
  }));
  // The clicked box carries the shared name, so it slides off the shelf into its page.
  root.querySelectorAll('a.boxset').forEach((a) => a.addEventListener('click', () => {
    root.querySelectorAll('.boxset__inner').forEach((x) => { x.style.viewTransitionName = ''; });
    a.querySelector('.boxset__inner').style.viewTransitionName = 'boxset';
  }));
  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    render(root);
  }));
}

function boxset(show, stats, entry) {
  const done = stats.seasons.filter((s) => s.complete).length;
  const label = `${show.name}: ${done} von ${stats.seasons.length} Staffeln gesehen${entry.rating ? `, Wertung ${entry.rating} von 10` : ''}`;
  const seasons = stats.seasons.length ? stats.seasons : [{ number: '–', complete: false, watched: 0, progress: 0, minCount: 0 }];
  return `<a class="boxset" role="listitem" href="#/serie/${show.id}" aria-label="${esc(label)}" title="${esc(show.name)}" style="--sh:${boxHeight(show)}">
    <span class="boxset__inner"${String(show.id) === String(window.__lastSerie) ? ' style="view-transition-name:boxset"' : ''}>${seasons.map((s) => spine(show, s)).join('')}</span>
    ${entry.rating ? `<span class="boxset__rating" aria-hidden="true">${entry.rating}</span>` : ''}
  </a>`;
}
