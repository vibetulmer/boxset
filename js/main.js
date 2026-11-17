import * as store from './store.js';
import * as shelf from './views/shelf.js';
import * as search from './views/search.js';
import * as showView from './views/show.js';
import * as ranking from './views/ranking.js';
import * as stats from './views/stats.js';
import * as data from './views/data.js';
import * as watchlist from './views/watchlist.js';
import * as swipe from './views/swipe.js';

const routes = { regal: shelf, suche: search, zappen: swipe, swipen: swipe, watchlist, serie: showView, ranking, statistik: stats, daten: data };
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
    const active = a.dataset.tab === r.name || (r.name === 'serie' && a.dataset.tab === 'regal') || (r.name === 'swipen' && a.dataset.tab === 'zappen');
    a.toggleAttribute('aria-current', active);
    if (active) a.setAttribute('aria-current', 'page');
  });
  document.title = { regal: 'Boxset', suche: 'Suchen · Boxset', zappen: 'Zappen · Boxset', swipen: 'Zappen · Boxset', watchlist: 'Watchlist · Boxset', ranking: 'Ranking · Boxset', statistik: 'Statistik · Boxset', daten: 'Daten · Boxset', serie: 'Boxset' }[r.name];
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
    if (h) document.title = `${h.textContent} · Boxset`;
  }
  if (!sameView) {
    window.scrollTo({ top: 0 });
    if (r.name !== 'suche') root.focus({ preventScroll: true });
  }
}

store.subscribe((detail) => {
  if (!current) return;
  if (current.view.update) current.view.update(root, current.r, detail);
  else current.view.render(root, current.r);
});

window.addEventListener('hashchange', route);

await store.init();
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
