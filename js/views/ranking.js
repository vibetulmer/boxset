import * as store from '../store.js';
import { TIERS, tierOf, showStats } from '../model.js';
import { esc, icon } from '../ui.js';

export function render(root) {
  const items = store.libraryShows();
  const rated = items.filter((x) => x.entry.rating);
  const unrated = items.filter((x) => !x.entry.rating && showStats(x.show, x.entry).started);
  const byName = (a, b) => a.show.name.localeCompare(b.show.name, 'de');
  const byRating = (a, b) => b.entry.rating - a.entry.rating || byName(a, b);

  if (!rated.length) {
    root.innerHTML = `<section class="page page--ranking">
      <h1 class="title-xl">Dein Ranking</h1>
      <p class="lede">Hier sortierst du deine Serien in fünf Regalböden, von S bis D. Gib einer Serie eine Wertung von 1 bis 10, dann rückt sie auf den passenden Boden.</p>
      ${unrated.length ? `<h2 class="title-md">Warten auf deine Wertung</h2>${covers(unrated.sort(byName))}` : `<a class="btn btn--primary" href="#/suche">${icon('search')}Erste Serie suchen</a>`}
    </section>`;
    return;
  }

  root.innerHTML = `<section class="page page--ranking">
    <h1 class="title-xl">Dein Ranking</h1>
    <p class="lede">${rated.length} ${rated.length === 1 ? 'Serie' : 'Serien'} bewertet. Ganz oben steht, was du jedem empfehlen würdest.</p>
    <ol class="tiers">
      ${TIERS.map((t) => {
        const list = rated.filter((x) => tierOf(x.entry.rating) === t.key).sort(byRating);
        return `<li class="tier tier--${t.key}">
          <div class="tier__divider">
            <span class="tier__key">${t.key}</span>
            <span class="tier__label">${t.label}<small>${t.range} Punkte</small></span>
          </div>
          <div class="tier__board">${list.length ? covers(list) : '<p class="tier__empty">Noch nichts auf diesem Boden.</p>'}</div>
        </li>`;
      }).join('')}
    </ol>
    ${unrated.length ? `<section class="unrated"><h2 class="title-md">Noch ohne Wertung</h2>${covers(unrated.sort(byName))}</section>` : ''}
  </section>`;
}

function covers(list) {
  return `<ul class="covers">${list.map(({ show, entry }) => `<li>
    <a class="cover-link" href="#/serie/${show.id}" aria-label="${esc(show.name)}${entry.rating ? `, ${entry.rating} von 10` : ''}">
      <span class="cover cover--md cover--case" style="--c:${show.color}">${show.image ? `<img src="${esc(show.image)}" crossorigin="anonymous" alt="" loading="lazy" width="96" height="135">` : `<span class="cover__blank">${esc(show.name.slice(0, 1))}</span>`}</span>
      ${entry.rating ? `<span class="sticker" aria-hidden="true">${entry.rating}</span>` : ''}
      <span class="cover-link__name">${esc(show.name)}</span>
    </a>
  </li>`).join('')}</ul>`;
}
