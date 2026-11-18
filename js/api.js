// TVmaze API (https://www.tvmaze.com/api) – data licensed CC BY-SA 4.0.
// Rate limit: ~20 calls per 10 seconds per IP. Calls are serialised with a small gap.

const BASE = 'https://api.tvmaze.com';
const GAP_MS = 140;
let queue = Promise.resolve();
let lastCall = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function schedule(task) {
  const run = queue.then(async () => {
    const wait = lastCall + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    return task();
  });
  queue = run.catch(() => {});
  return run;
}

async function get(path, tries = 3) {
  // A hung request would stall the whole serial queue, so every call gets a deadline.
  const res = await schedule(() => fetch(BASE + path, { signal: AbortSignal.timeout(20000) }))
    .catch((err) => {
      if (err.name === 'TimeoutError') throw new ApiError('TVmaze antwortet nicht. Prüf deine Verbindung.', 0);
      throw err;
    });
  if (res.status === 429 && tries > 0) {
    await sleep(2000);
    return get(path, tries - 1);
  }
  if (res.status === 404) throw new ApiError('Diese Serie gibt es bei TVmaze nicht (mehr).', 404);
  if (!res.ok) throw new ApiError(`TVmaze antwortet gerade nicht (Fehler ${res.status}). Versuch es gleich nochmal.`, res.status);
  return res.json();
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

const httpsify = (url) => (url ? url.replace(/^http:\/\//, 'https://') : null);

function slim(s) {
  return {
    id: s.id,
    name: s.name,
    image: httpsify(s.image?.medium),
    premiered: s.premiered || null,
    ended: s.ended || null,
    status: s.status || null,
    network: s.network?.name || s.webChannel?.name || null,
    country: s.network?.country?.code || s.webChannel?.country?.code || null,
    genres: s.genres || [],
    runtime: s.averageRuntime || s.runtime || null,
  };
}

export async function searchShows(query) {
  const data = await get(`/search/shows?q=${encodeURIComponent(query)}`);
  return data.map((d) => slim(d.show));
}

/**
 * Which shows changed recently: { showId: unixSeconds } for since = 'day' | 'week' | 'month'.
 * One small request instead of refetching the whole library.
 */
export async function fetchUpdates(since) {
  return get(`/updates/shows?since=${since}`);
}

/**
 * Full show with seasons and episodes, normalised and compact.
 * episodes: [id, season, number, name, runtime, airdate]
 */
export async function fetchShow(id) {
  const s = await get(`/shows/${id}?embed[]=seasons&embed[]=episodes`);
  const episodes = (s._embedded?.episodes || [])
    .filter((e) => e.number != null && e.season != null)
    .map((e) => [e.id, e.season, e.number, e.name || '', e.runtime || null, e.airdate || '']);
  const withEpisodes = new Set(episodes.map((e) => e[1]));
  const seasons = (s._embedded?.seasons || [])
    .filter((se) => withEpisodes.has(se.number))
    .map((se) => ({ id: se.id, number: se.number, name: se.name || '' }));
  return {
    ...slim(s),
    summary: stripHtml(s.summary),
    url: s.url,
    seasons,
    episodes,
    fetchedAt: Date.now(),
  };
}
