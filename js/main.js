import * as store from './store.js';
import * as shelf from './views/shelf.js';
import * as search from './views/search.js';
import * as showView from './views/show.js';
import * as ranking from './views/ranking.js';
import * as stats from './views/stats.js';
import * as data from './views/data.js';
import * as watchlist from './views/watchlist.js';
import * as swipe from './views/swipe.js';
import { toast, esc } from './ui.js';
import { showStats } from './model.js';

const routes = { regal: shelf, suche: search, entdecken: swipe, zappen: swipe, swipen: swipe, watchlist, serie: showView, ranking, statistik: stats, daten: data };
const root = document.getElementById('view');
let current = null;
window.__navCount = 0;

function parse() {
  const raw = location.hash.replace(/^#\/?/, '') || 'regal';
  const [path, query = ''] = raw.split('?');
  const [name, param] = path.split('/');
  return { name: routes[name] ? name : 'regal', param, query: new URLSearchParams(query) };
}

async function route() {
  const r = parse();
  const sameView = current && current.r.name === r.name && current.r.param === r.param;
  current = { view: routes[r.name], r };
  window.__navCount++;
  document.querySelectorAll('[data-tab]').forEach((a) => {
    const active = a.dataset.tab === r.name || (r.name === 'serie' && a.dataset.tab === 'regal') || (['zappen', 'swipen'].includes(r.name) && a.dataset.tab === 'entdecken');
    a.toggleAttribute('aria-current', active);
    if (active) a.setAttribute('aria-current', 'page');
  });
  document.title = { regal: 'Series Tracker', suche: 'Suchen · Series Tracker', entdecken: 'Entdecken · Series Tracker', zappen: 'Entdecken · Series Tracker', swipen: 'Entdecken · Series Tracker', watchlist: 'Watchlist · Series Tracker', ranking: 'Ranking · Series Tracker', statistik: 'Statistik · Series Tracker', daten: 'Daten · Series Tracker', serie: 'Series Tracker' }[r.name];
  const prevName = window.__prevRoute;
  window.__prevRoute = r.name;
  const boxMove = (prevName === 'regal' && r.name === 'serie') || (prevName === 'serie' && r.name === 'regal');
  if (r.name === 'serie') window.__lastSerie = r.param;
  if (boxMove && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Shared element: the box set slides off the shelf into its page and back.
    const vt = document.startViewTransition(async () => {
      await current.view.render(root, r);
      if (!sameView) window.scrollTo({ top: 0 });
    });
    await vt.updateCallbackDone.catch(() => {});
  } else {
    await current.view.render(root, r);
  }
  if (r.name === 'serie') {
    const h = root.querySelector('h1');
    if (h) document.title = `${h.textContent} · Series Tracker`;
  }
  if (!sameView) {
    window.scrollTo({ top: 0 });
    if (r.name !== 'suche') root.focus({ preventScroll: true });
  }
}

store.subscribe((detail) => {
  if (detail?.type === 'save-error') {
    toast('<strong>Speichern klappt gerade nicht.</strong> Deine letzten Änderungen gehen beim Neuladen verloren. Lade jetzt eine Sicherung herunter.', {
      action: 'Zur Sicherung', onAction: () => { location.hash = '#/daten'; }, duration: 15000,
    });
  }
  if (detail?.type === 'updates') {
    const fresh = detail.ids.map((id) => store.cached(id)).filter((show) => show && showStats(show, store.entry(show.id)).fresh > 0);
    if (fresh.length) {
      const names = fresh.slice(0, 3).map((s) => `<strong>${esc(s.name)}</strong>`).join(', ');
      toast(`Neue Folgen: ${names}${fresh.length > 3 ? ` und ${fresh.length - 3} weitere` : ''}.`, {
        action: fresh.length === 1 ? 'Ansehen' : 'Zum Regal',
        onAction: () => { location.hash = fresh.length === 1 ? `#/serie/${fresh[0].id}` : '#/regal'; },
        duration: 9000,
      });
    }
  }
  if (!current) return;
  if (detail?.type === 'save-ok' && current.r.name !== 'daten') return;
  if (current.view.update) current.view.update(root, current.r, detail);
  else current.view.render(root, current.r);
});

window.addEventListener('hashchange', route);

await store.init();
route();

// New seasons and episodes: one small TVmaze request at start (at most every 12 h), and again
// when the installed app comes back to the foreground after a while.
setTimeout(() => store.checkUpdates(), 1500);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') store.checkUpdates();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
