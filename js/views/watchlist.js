import * as store from '../store.js';
import { showStats } from '../model.js';
import { esc, icon, num, duration, years, toast } from '../ui.js';
import { quickAdd } from '../actions.js';

export function render(root) {
  const items = store.watchlistShows().map((x) => ({ ...x, stats: showStats(x.show, x.entry) }));

  if (!items.length) {
    root.innerHTML = `<section class="page page--watchlist">
      <h1 class="title-xl">Watchlist</h1>
      <p class="lede">Hier sammelst du Serien, die du noch schauen willst. Tipp in der Suche oder auf einer Serienseite auf das Lesezeichen. Sobald du eine Serie komplett gesehen hast, wandert sie von allein ins Regal.</p>
      <a class="btn btn--primary" href="#/suche">${icon('search')}Serie suchen</a>
    </section>`;
    return;
  }

  // Already started first (that's what you'll pick up next), then most recently remembered.
  items.sort((a, b) => (b.stats.started - a.stats.started) || (b.entry.watchlist - a.entry.watchlist));
  const remaining = items.reduce((sum, x) => sum + x.stats.remainingMinutes, 0);

  root.innerHTML = `<section class="page page--watchlist">
    <h1 class="title-xl">Watchlist</h1>
    <p class="lede">${num(items.length)} ${items.length === 1 ? 'Serie wartet' : 'Serien warten'} auf dich, zusammen <strong class="lede__strong">${duration(remaining, { long: true })}</strong> Stoff.</p>
    <ol class="watchlist">
      ${items.map(({ show, stats }) => `<li class="wl">
        <a class="wl__link" href="#/serie/${show.id}">
          <span class="cover cover--wl cover--case" style="--c:${show.color}">${show.image ? `<img src="${esc(show.image)}" alt="" loading="lazy" width="80" height="112">` : `<span class="cover__blank">${esc(show.name.slice(0, 1))}</span>`}</span>
          <span class="wl__text">
            <span class="wl__name">${esc(show.name)}</span>
            <span class="wl__meta">${esc([years(show), show.network, `${stats.seasons.length} ${stats.seasons.length === 1 ? 'Staffel' : 'Staffeln'}`].filter(Boolean).join(' · '))}</span>
            ${stats.started
              ? `<span class="wl__progress" style="--p:${Math.round((stats.watched / Math.max(1, stats.aired)) * 100)}%"><span class="bar"><i></i></span>${stats.watched} von ${stats.aired} Folgen · noch ${duration(stats.remainingMinutes)}</span>`
              : `<span class="wl__time">${stats.estimated ? 'ca. ' : ''}${duration(stats.runMinutes)} für alles</span>`}
          </span>
        </a>
        <span class="wl__actions">
          <button type="button" class="icon-btn icon-btn--watch" data-done="${show.id}" aria-label="${esc(show.name)} ${stats.started ? 'zu Ende gesehen' : 'komplett gesehen'}, ins Regal stellen" title="Gesehen, ins Regal">${icon('check')}</button>
          <button type="button" class="icon-btn" data-unlist="${show.id}" aria-label="${esc(show.name)} von der Watchlist nehmen" title="Von der Watchlist nehmen">${icon('x')}</button>
        </span>
      </li>`).join('')}
    </ol>
  </section>`;

  // Watched it: every aired episode at least once; the store then drops it from the watchlist.
  root.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', () => quickAdd(Number(b.dataset.done), b)));

  root.querySelectorAll('[data-unlist]').forEach((b) => b.addEventListener('click', () => {
    const id = Number(b.dataset.unlist);
    const name = store.cached(id)?.name || 'Die Serie';
    const before = store.snapshot(id);
    store.setWatchlist(id, false);
    toast(`<strong>${esc(name)}</strong> ist nicht mehr auf der Watchlist.`, { action: 'Rückgängig', onAction: () => store.restore(id, before) });
  }));
}
