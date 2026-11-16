import * as store from '../store.js';
import { searchShows } from '../api.js';
import { showStats } from '../model.js';
import { quickAdd, toggleWatchlist } from '../actions.js';
import { esc, icon, years, genreDE } from '../ui.js';

let lastQuery = '';
let results = null;
let error = null;
let loading = false;
let timer;
let seq = 0;

const SUGGESTIONS = ['Breaking Bad', 'Game of Thrones', 'Dark', 'The Wire', 'Fleabag', 'Babylon Berlin', 'Succession', 'Stromberg'];

export function render(root, route) {
  const q = route.query.get('q');
  if (q != null && q !== lastQuery) {
    lastQuery = q;
    run(q);
  }
  root.innerHTML = `
    <section class="page page--search">
      <h1 class="visually-hidden">Serie suchen</h1>
      <form class="searchbar" role="search" action="#/suche">
        <label class="visually-hidden" for="q">Serientitel</label>
        ${icon('search', 'searchbar__icon')}
        <input id="q" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search"
          placeholder="Welche Serie hast du gesehen?" value="${esc(lastQuery)}">
      </form>
      <div class="results" aria-live="polite"></div>
    </section>`;

  const input = root.querySelector('#q');
  const form = root.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(timer);
    commit(input.value);
    input.blur();
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => commit(input.value), 320);
  });
  if (!matchMedia('(pointer: coarse)').matches || !lastQuery) input.focus({ preventScroll: true });
  paint(root);
}

function commit(value) {
  const q = value.trim();
  history.replaceState(null, '', q ? `#/suche?q=${encodeURIComponent(q)}` : '#/suche');
  lastQuery = q;
  run(q);
}

async function run(q) {
  const id = ++seq;
  error = null;
  if (!q) {
    results = null; loading = false;
    return paint();
  }
  loading = true;
  paint();
  try {
    const found = await searchShows(q);
    if (id !== seq) return;
    results = found;
  } catch (err) {
    if (id !== seq) return;
    error = navigator.onLine ? err.message : 'Du bist offline. Die Suche braucht eine Internetverbindung, dein Regal funktioniert trotzdem.';
    results = null;
  } finally {
    if (id === seq) { loading = false; paint(); }
  }
}

export function update(root) {
  paint(root);
}

function paint(root = document) {
  const host = root.querySelector?.('.results') || document.querySelector('.results');
  if (!host) return;
  if (error) {
    host.innerHTML = `<p class="notice notice--error">${esc(error)}</p>`;
    return;
  }
  if (!lastQuery) {
    host.innerHTML = `
      <div class="search-start">
        <p class="muted">Tipp den Titel ein, auf Deutsch oder im Original. Ein paar Ideen:</p>
        <ul class="chips">${SUGGESTIONS.map((n) => `<li><a class="chip" href="#/suche?q=${encodeURIComponent(n)}">${esc(n)}</a></li>`).join('')}</ul>
      </div>`;
    return;
  }
  if (loading && !results) {
    host.innerHTML = `<ol class="result-list is-loading" aria-label="Wird gesucht">${'<li class="result result--skeleton"><span class="cover cover--sm"></span><span class="skeleton-lines"><i></i><i></i></span></li>'.repeat(4)}</ol>`;
    return;
  }
  if (results && !results.length) {
    host.innerHTML = `<p class="notice">Zu „${esc(lastQuery)}“ kennt TVmaze keine Serie. Probier den Originaltitel oder weniger Wörter.</p>`;
    return;
  }
  if (!results) return;
  host.innerHTML = `<ol class="result-list${loading ? ' is-refreshing' : ''}">${results.map(row).join('')}</ol>`;
  host.querySelectorAll('[data-quick]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault();
      quickAdd(Number(b.dataset.quick), b);
    })
  );
  host.querySelectorAll('[data-wl]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault();
      toggleWatchlist(Number(b.dataset.wl), b);
    })
  );
}

function row(s) {
  const entry = store.entry(s.id);
  const show = store.cached(s.id);
  const st = entry && show ? showStats(show, entry) : null;
  const meta = [years(s), s.network, s.genres.slice(0, 2).map(genreDE).join(', ')].filter(Boolean).join(' · ');
  const listed = !!entry?.watchlist;
  const mark = `<button type="button" class="icon-btn${listed ? ' is-on' : ''}" data-wl="${s.id}" aria-pressed="${listed}"
    aria-label="${esc(s.name)} ${listed ? 'von der Watchlist nehmen' : 'auf die Watchlist setzen'}" title="${listed ? 'Auf der Watchlist' : 'Merken'}">${icon(listed ? 'bookmark-on' : 'bookmark')}</button>`;
  let action;
  if (st?.complete) action = `<span class="badge badge--done">${icon('check')}Im Regal</span>`;
  else if (st?.started) action = `${mark}<span class="badge">Angefangen</span>`;
  else action = `${mark}<button type="button" class="btn btn--watch btn--sm" data-quick="${s.id}" aria-label="${esc(s.name)} komplett als gesehen eintragen">${icon('check')}Komplett gesehen</button>`;
  return `<li class="result">
    <a class="result__link" href="#/serie/${s.id}">
      <span class="cover cover--sm">${s.image ? `<img src="${esc(s.image)}" alt="" loading="lazy" width="56" height="80">` : `<span class="cover__blank">${esc(s.name.slice(0, 1))}</span>`}</span>
      <span class="result__text">
        <span class="result__name">${esc(s.name)}</span>
        <span class="result__meta">${esc(meta)}</span>
      </span>
    </a>
    <span class="result__action">${action}</span>
  </li>`;
}
