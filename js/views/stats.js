import * as store from '../store.js';
import { libraryStats } from '../model.js';
import { esc, num, num1, duration, hoursOf, genreDE, icon } from '../ui.js';

const CASE_MM = 14; // a standard keep case is 14 mm thick

export function render(root) {
  const items = store.libraryShows();
  const lib = libraryStats(items);

  if (!lib.started) {
    root.innerHTML = `<section class="page page--stats">
      <h1 class="title-xl">Statistik</h1>
      <p class="lede">Sobald du die erste Folge einträgst, rechnet Boxset hier mit: Stunden, Tage, Lieblingsgenres und deine längsten Serien.</p>
      <a class="btn btn--primary" href="#/suche">${icon('search')}Serie suchen</a>
    </section>`;
    return;
  }

  const top = [...lib.perShow].filter((x) => x.stats.watchedMinutes > 0)
    .sort((a, b) => b.stats.watchedMinutes - a.stats.watchedMinutes).slice(0, 12);
  const max = top[0]?.stats.watchedMinutes || 1;
  const genres = lib.genres.slice(0, 8);
  const gMax = genres[0]?.[1] || 1;
  const meters = (lib.seasonsWatched * CASE_MM) / 1000;
  const oldest = [...lib.perShow].filter((x) => x.show.premiered && x.stats.started)
    .sort((a, b) => a.show.premiered.localeCompare(b.show.premiered))[0];
  const yearShare = (lib.minutes / 60 / 24 / 365) * 100;

  root.innerHTML = `<section class="page page--stats">
    <header class="stats-head">
      <h1><span>${duration(lib.minutes, { long: true })}</span> vor dem Bildschirm.</h1>
      <p class="lede">${lib.estimated ? 'Rund ' : ''}${hoursOf(lib.minutes)} Stunden aus ${num(lib.episodes)} Folgen${lib.rewatches ? ` und ${num(lib.rewatches)} Wiederholungen` : ''}. Im Stapel liegen die größten Brocken unten.</p>
    </header>

    <section aria-label="Zeit pro Serie">
      <ol class="stack">
        ${top.map(({ show, stats }, i) => `<li style="--i:${top.length - i}">
          <a class="stack__case" href="#/serie/${show.id}" style="--c:${show.color};--w:${Math.max(8, (stats.watchedMinutes / max) * 100)}%">
            <span class="stack__bar"><span class="stack__name">${esc(show.name)}</span></span>
            <span class="stack__time">${duration(stats.watchedMinutes)}${stats.runs > 1 ? ` · ${stats.runs}×` : ''}</span>
          </a>
        </li>`).join('')}
      </ol>
      <div class="stack-base" aria-hidden="true"></div>
    </section>

    ${genres.length ? `<section>
      <h2 class="title-md">Genres nach Zeit</h2>
      <ul class="genres">
        ${genres.map(([g, m]) => `<li><span class="genres__name">${esc(genreDE(g))}</span><span class="genres__bar"><i style="width:${(m / gMax) * 100}%"></i></span><span class="genres__val">${hoursOf(m)} Std.</span></li>`).join('')}
      </ul>
      <p class="muted small">Eine Serie mit mehreren Genres zählt in jedem davon.</p>
    </section>` : ''}

    <section>
      <h2 class="title-md">Nebenbei</h2>
      <ul class="facts">
        ${lib.seasonsWatched ? `<li><strong>${num1(meters)} m Regal</strong>So breit stünden deine ${num(lib.seasonsWatched)} gesehenen Staffeln als Boxen, bei ${CASE_MM} mm pro Hülle.</li>` : ''}
        <li><strong>${num1(yearShare)} % eines Jahres</strong>Rund um die Uhr geschaut, ohne Schlaf.</li>
        <li><strong>${num(lib.complete)} von ${num(lib.started)}</strong>Serien hast du komplett gesehen.</li>
        ${lib.avgRating ? `<li><strong>Ø ${num1(lib.avgRating)} Punkte</strong>vergibst du im Schnitt, über ${num(lib.rated)} Wertungen.</li>` : ''}
        ${oldest ? `<li><strong>${oldest.show.premiered.slice(0, 4)}</strong>Die älteste Serie im Regal: <a href="#/serie/${oldest.show.id}">${esc(oldest.show.name)}</a>.</li>` : ''}
        ${lib.views ? `<li><strong>${Math.round(lib.minutes / lib.views)} Minuten</strong>dauert eine deiner Folgen im Schnitt.</li>` : ''}
      </ul>
    </section>
  </section>`;
}
