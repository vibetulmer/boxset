import * as store from '../store.js';
import { showStats, libraryStats } from '../model.js';
import { esc, num, duration, hoursOf, spine, boxHeight, icon } from '../ui.js';

const SORTS = {
  // Shows with new episodes come first: that's what you'll want to pick up next.
  added: { label: 'Zuletzt', fn: (a, b) => (b.stats.fresh > 0) - (a.stats.fresh > 0) || b.entry.updatedAt - a.entry.updatedAt },
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
          <div class="swipe-entry"><p><strong>Schnellstart: Entdecken</strong>Die beliebtesten Serien nacheinander: rechts gesehen, links nie gesehen, hoch auf die Watchlist.</p><a class="btn btn--primary" href="#/entdecken">${icon('compass')}Los geht's</a></div>
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
      ${backupNudge(items)}
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

const DAY = 24 * 60 * 60 * 1000;

/** Everything lives in this browser only: nudge towards a backup now and then, never on day one. */
function backupNudge(items) {
  if (items.length < 5) return '';
  const last = store.lastExport();
  const oldest = Math.min(...items.map((x) => x.entry.addedAt || Date.now()));
  const due = last ? Date.now() - last > 30 * DAY : Date.now() - oldest > 7 * DAY;
  if (!due) return '';
  return `<p class="notice backup-nudge"><span>${last ? `Deine letzte Sicherung ist ${Math.floor((Date.now() - last) / DAY)} Tage alt.` : 'Dein Regal ist noch nirgends gesichert.'} Es liegt nur in diesem Browser.</span><a class="btn btn--outline btn--sm" href="#/daten">${icon('download')}Sichern</a></p>`;
}

function boxset(show, stats, entry) {
  const done = stats.seasons.filter((s) => s.complete).length;
  const label = `${show.name}: ${done} von ${stats.seasons.length} Staffeln gesehen${entry.rating ? `, Wertung ${entry.rating} von 10` : ''}${stats.fresh ? `, ${stats.fresh} neue ${stats.fresh === 1 ? 'Folge' : 'Folgen'}` : ''}`;
  const seasons = stats.seasons.length ? stats.seasons : [{ number: '–', complete: false, watched: 0, progress: 0, minCount: 0 }];
  return `<a class="boxset" role="listitem" href="#/serie/${show.id}" aria-label="${esc(label)}" title="${esc(show.name)}" style="--sh:${boxHeight(show)}">
    <span class="boxset__inner"${String(show.id) === String(window.__lastSerie) ? ' style="view-transition-name:boxset"' : ''}>${seasons.map((s) => spine(show, s)).join('')}</span>
    ${entry.rating ? `<span class="boxset__rating" aria-hidden="true">${entry.rating}</span>` : ''}
    ${stats.fresh ? `<span class="boxset__new" aria-hidden="true">+${stats.fresh} neu</span>` : ''}
  </a>`;
}
