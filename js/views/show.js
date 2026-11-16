import * as store from '../store.js';
import { showStats, raiseTo, capAt, tierOf, EP, TIERS } from '../model.js';
import { esc, icon, num, duration, years, genreDE, statusDE, dateDE, spine, toast } from '../ui.js';

let currentId = null;
let open = new Set(); // expanded seasons
let arriving = new Set(); // seasons that just changed, for the slide-in
let summaryOpen = false;
let ctx = null; // latest { show, st } for the delegated click handler

export async function render(root, route) {
  const id = Number(route.param);
  if (id !== currentId) {
    currentId = id;
    open = new Set();
    summaryOpen = false;
  }
  const have = store.cached(id);
  if (!have) {
    root.innerHTML = `<section class="page page--show"><a class="back" href="javascript:history.back()">${icon('back')}Zurück</a>
      <div class="show-loading" aria-busy="true"><span class="cover cover--lg"></span><span class="skeleton-lines"><i></i><i></i><i></i></span></div></section>`;
  }
  let show;
  try {
    show = await store.getShow(id);
  } catch (err) {
    if (currentId !== id) return;
    root.innerHTML = `<section class="page page--show"><a class="back" href="#/suche">${icon('back')}Zur Suche</a>
      <p class="notice notice--error">${esc(navigator.onLine ? err.message : 'Du bist offline, und diese Serie ist noch nicht auf dem Gerät gespeichert.')}</p></section>`;
    return;
  }
  if (currentId !== id || location.hash.indexOf(`#/serie/${id}`) !== 0) return;
  paintAll(root, show);
}

export function update(root, route, detail) {
  const id = Number(route.param);
  if (detail?.id && detail.id !== id) return;
  const show = store.cached(id);
  if (!show) return;
  if (!root.querySelector('[data-region="dynamic"]') || detail?.type === 'show') return paintAll(root, show);
  paintDynamic(root, show);
}

function paintAll(root, show) {
  const meta = [years(show), show.network, show.genres.map(genreDE).join(', '), statusDE(show.status)].filter(Boolean);
  root.innerHTML = `
    <article class="page page--show" style="--c:${show.color}">
      <a class="back" href="#/regal" data-back>${icon('back')}Zurück</a>
      <header class="show-head">
        <figure class="cover cover--lg cover--case">${show.image ? `<img src="${esc(show.image)}" alt="Poster von ${esc(show.name)}" width="210" height="295">` : `<span class="cover__blank">${esc(show.name.slice(0, 1))}</span>`}</figure>
        <div class="show-intro">
          <h1 class="title-xl">${esc(show.name)}</h1>
          <p class="show-meta">${meta.map(esc).join('<span aria-hidden="true"> · </span>')}</p>
          ${show.summary ? `<p class="summary${summaryOpen ? ' is-open' : ''}">${esc(show.summary)}</p>
            ${show.summary.length > 240 ? `<button type="button" class="link-btn" data-summary aria-expanded="${summaryOpen}">${summaryOpen ? 'Weniger' : 'Weiterlesen'}</button>` : ''}` : ''}
          <a class="source-link" href="${esc(show.url)}" target="_blank" rel="noopener">Bei TVmaze ansehen${icon('external')}</a>
        </div>
      </header>
      <div data-region="dynamic"></div>
    </article>`;
  root.querySelector('[data-back]').addEventListener('click', (e) => {
    if ((window.__navCount || 0) > 1) {
      e.preventDefault();
      history.back();
    }
  });
  root.querySelector('[data-summary]')?.addEventListener('click', () => {
    summaryOpen = !summaryOpen;
    root.querySelector('.summary').classList.toggle('is-open', summaryOpen);
    const b = root.querySelector('[data-summary]');
    b.setAttribute('aria-expanded', summaryOpen);
    b.textContent = summaryOpen ? 'Weniger' : 'Weiterlesen';
  });
  root.querySelector('[data-region="dynamic"]').addEventListener('click', onClick);
  paintDynamic(root, show);
}

function paintDynamic(root, show) {
  const host = root.querySelector('[data-region="dynamic"]');
  const entry = store.entry(show.id);
  const st = showStats(show, entry);
  const rating = entry?.rating || null;
  const tier = tierOf(rating);
  const tierInfo = TIERS.find((t) => t.key === tier);

  host.innerHTML = `
    <section class="watch" aria-label="Dein Stand">
      <dl class="specs specs--show">
        <div class="spec"><dt>Staffeln</dt><dd>${st.seasons.length}</dd></div>
        <div class="spec"><dt>Folgen</dt><dd>${num(st.aired)}${st.upcoming ? `<small> +${st.upcoming}</small>` : ''}</dd></div>
        <div class="spec"><dt>Ein Durchlauf</dt><dd>${st.estimated ? 'ca. ' : ''}${duration(st.runMinutes)}</dd></div>
        <div class="spec spec--you"><dt>Deine Zeit</dt><dd>${duration(st.watchedMinutes)}</dd></div>
      </dl>

      <div class="watch__controls">
        <div class="control">
          <span class="control__label" id="runs-label">Komplett gesehen</span>
          ${st.runs === 0 && !st.started
            ? `<button type="button" class="btn btn--watch btn--lg" data-act="all">${icon('check')}Ganze Serie gesehen</button>`
            : `<div class="stepper" role="group" aria-labelledby="runs-label">
                <button type="button" class="stepper__btn" data-act="runs-" ${st.runs === 0 ? 'disabled' : ''} aria-label="Einen Durchlauf weniger">${icon('minus')}</button>
                <output class="stepper__value" aria-live="polite">${st.runs}×</output>
                <button type="button" class="stepper__btn" data-act="runs+" aria-label="${st.runs === 0 ? 'Ganze Serie als gesehen eintragen' : 'Noch einmal komplett gesehen'}">${icon('plus')}</button>
              </div>
              <span class="control__hint">${runsHint(st)}</span>`}
        </div>

        <div class="control control--rating">
          <span class="control__label" id="rating-label">Deine Wertung</span>
          <div class="rating" role="radiogroup" aria-labelledby="rating-label">
            ${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<button type="button" role="radio" class="rating__seg${rating && n <= rating ? ' is-on' : ''}" data-rate="${n}" aria-checked="${n === rating}" aria-label="${n} von 10">${n}</button>`).join('')}
          </div>
          <span class="control__hint">${tier ? `<span class="tier-chip tier-chip--${tier}">${tier}</span> ${tierInfo.label}` : 'Tipp eine Zahl, dann landet die Serie im Ranking.'}</span>
        </div>

        ${st.complete ? '' : `<div class="control">
          <span class="control__label">Watchlist</span>
          <button type="button" class="btn btn--outline btn--mark${entry?.watchlist ? ' is-on' : ''}" data-act="watchlist" aria-pressed="${!!entry?.watchlist}">
            ${icon(entry?.watchlist ? 'bookmark-on' : 'bookmark')}${entry?.watchlist ? 'Auf der Watchlist' : 'Merken'}
          </button>
          <span class="control__hint">${entry?.watchlist ? `Noch ${duration(st.remainingMinutes)} offen` : 'Für später vormerken'}</span>
        </div>`}
      </div>
    </section>

    <section class="boxshelf" aria-label="Staffeln im Regal">
      <div class="shelf shelf--large">
        <span class="boxset boxset--static">
          <span class="boxset__inner" style="view-transition-name:boxset">
            ${st.seasons.map((s) => spine(show, s, {
              tag: 'button',
              attrs: `type="button" data-season-toggle="${s.number}" aria-pressed="${s.complete}" aria-label="Staffel ${s.number} ${s.complete ? 'als ungesehen markieren' : 'als gesehen eintragen'}"`,
              arriving: arriving.has(s.number),
            })).join('')}
          </span>
        </span>
      </div>
      <p class="muted boxshelf__hint">Tipp einen Rücken an, um die Staffel ins Regal zu stellen oder wieder herauszunehmen.</p>
    </section>

    <section class="seasons" aria-label="Staffeln und Folgen">
      <h2 class="title-md">Staffeln</h2>
      <ol class="season-list">${st.seasons.map((s) => seasonRow(show, s)).join('')}</ol>
    </section>

    ${entry ? `<div class="danger-zone">
      <button type="button" class="btn btn--quiet" data-act="remove">${icon('trash')}Aus dem Regal nehmen</button>
    </div>` : ''}
  `;
  arriving = new Set();
  ctx = { show, st };
}

function runsHint(st) {
  if (st.runs === 0) return `${num(st.watched)} von ${num(st.aired)} Folgen gesehen`;
  if (st.runs === 1) return 'Einmal komplett durch';
  return `${st.runs} Durchläufe, ${duration(st.runMinutes * st.runs)}`;
}

function seasonRow(show, s) {
  const isOpen = open.has(s.number);
  const state = s.complete ? 'is-full' : s.watched ? 'is-partial' : 'is-empty';
  return `<li class="season ${state}" style="--p:${Math.round(s.progress * 100)}%">
    <div class="season__row">
      <button type="button" class="tick${s.complete ? ' is-on' : ''}" data-season-toggle="${s.number}" aria-pressed="${s.complete}"
        aria-label="Staffel ${s.number} ${s.complete ? 'als ungesehen markieren' : 'als gesehen eintragen'}">${icon('check')}</button>
      <button type="button" class="season__open" data-open="${s.number}" aria-expanded="${isOpen}" aria-controls="eps-${s.number}">
        <span class="season__name">Staffel ${s.number}</span>
        <span class="season__meta">${s.aired} ${s.aired === 1 ? 'Folge' : 'Folgen'} · ${duration(s.minutes)}</span>
        <span class="season__progress"><span class="bar"><i></i></span>${s.watched}/${s.aired}</span>
        ${icon('chevron', 'season__chev')}
      </button>
      <div class="stepper-slot">${s.complete ? `<div class="stepper stepper--sm" role="group" aria-label="Wie oft Staffel ${s.number} gesehen">
        <button type="button" class="stepper__btn" data-season-runs="${s.number}" data-dir="-1" aria-label="Staffel ${s.number} einmal weniger">${icon('minus')}</button>
        <output class="stepper__value">${s.minCount}×</output>
        <button type="button" class="stepper__btn" data-season-runs="${s.number}" data-dir="1" aria-label="Staffel ${s.number} noch einmal gesehen">${icon('plus')}</button>
      </div>` : ''}</div>
    </div>
    <ol class="episodes" id="eps-${s.number}" ${isOpen ? '' : 'hidden'}>
      ${s.episodes.map(({ ep, aired, count, runtime }) => `<li class="episode${count ? ' is-on' : ''}${aired ? '' : ' is-future'}">
        <button type="button" class="tick tick--sm${count ? ' is-on' : ''}" data-ep="${ep[EP.id]}" aria-pressed="${count > 0}" ${aired ? '' : 'disabled'}
          aria-label="Folge ${ep[EP.number]}${count ? ' als ungesehen markieren' : ' als gesehen eintragen'}">${icon('check')}</button>
        <span class="episode__no">${s.number}×${String(ep[EP.number]).padStart(2, '0')}</span>
        <span class="episode__name">${esc(ep[EP.name] || `Folge ${ep[EP.number]}`)}</span>
        <span class="episode__meta">${aired ? dateDE(ep[EP.airdate]) : `erscheint ${dateDE(ep[EP.airdate]) || 'bald'}`}${runtime ? ` · ${runtime} Min.` : ''}${count > 1 ? ` · <strong>${count}×</strong>` : ''}</span>
      </li>`).join('')}
    </ol>
  </li>`;
}

function onClick(e) {
  if (!ctx) return;
  const { show, st } = ctx;
  const host = e.currentTarget;
  const id = show.id;
  const change = (fn, seasons) => {
    (seasons || []).forEach((n) => arriving.add(n));
    store.updateCounts(id, fn);
  };
  const allSeasons = st.seasons.map((s) => s.number);

  {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;

    if (t.dataset.act === 'all' || (t.dataset.act === 'runs+' && st.runs === 0)) {
      change((c) => raiseTo(show, c, 1), allSeasons.filter((n) => !st.seasons.find((s) => s.number === n).complete));
    } else if (t.dataset.act === 'runs+') {
      change((c) => raiseTo(show, c, st.runs + 1));
    } else if (t.dataset.act === 'runs-') {
      change((c) => capAt(show, c, st.runs - 1));
    } else if (t.dataset.act === 'watchlist') {
      store.setWatchlist(id, !store.entry(id)?.watchlist);
    } else if (t.dataset.act === 'remove') {
      const before = store.snapshot(id);
      store.removeShow(id);
      toast(`<strong>${esc(show.name)}</strong> ist nicht mehr im Regal.`, { action: 'Rückgängig', onAction: () => store.restore(id, before) });
    } else if (t.dataset.rate) {
      const n = Number(t.dataset.rate);
      store.setRating(id, n === store.entry(id)?.rating ? null : n);
    } else if (t.dataset.seasonToggle) {
      const n = Number(t.dataset.seasonToggle);
      const s = st.seasons.find((x) => x.number === n);
      if (s.complete) change((c) => capAt(show, c, 0, n));
      else change((c) => raiseTo(show, c, 1, n), [n]);
    } else if (t.dataset.seasonRuns) {
      const n = Number(t.dataset.seasonRuns);
      const s = st.seasons.find((x) => x.number === n);
      const next = s.minCount + Number(t.dataset.dir);
      if (next >= s.minCount) change((c) => raiseTo(show, c, next, n));
      else change((c) => capAt(show, c, Math.max(0, next), n));
    } else if (t.dataset.open) {
      const n = Number(t.dataset.open);
      if (open.has(n)) open.delete(n); else open.add(n);
      t.setAttribute('aria-expanded', open.has(n));
      host.querySelector(`#eps-${n}`).hidden = !open.has(n);
    } else if (t.dataset.ep) {
      const epId = Number(t.dataset.ep);
      const season = show.episodes.find((ep) => ep[EP.id] === epId)?.[EP.season];
      const before = st.seasons.find((x) => x.number === season);
      change((c) => { c[epId] = c[epId] ? 0 : 1; }, before && !before.complete ? [season] : []);
    }
  }
}
