// User library (localStorage) + cached show data (IndexedDB).
import { fetchShow } from './api.js';
import { extractColor, hashColor } from './color.js';
import { showStats } from './model.js';

const LIB_KEY = 'serienregal.library.v1';
const DB_NAME = 'serienregal';
const STORE = 'shows';
const REFRESH_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

let library = { version: 1, shows: {} };
const cache = new Map(); // shows in the library, persisted
const transient = new Map(); // shows only browsed, not persisted
const listeners = new Set();
const inflight = new Map();

// ---------- IndexedDB ----------
let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  });
}
const idbAll = () => tx('readonly', (s) => s.getAll());
const idbPut = (v) => tx('readwrite', (s) => s.put(v)).catch(() => {});
const idbDel = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {});
const idbClear = () => tx('readwrite', (s) => s.clear()).catch(() => {});

// ---------- library ----------
function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.shows) return parsed;
    }
  } catch { /* storage unavailable */ }
  return { version: 1, shows: {} };
}
function saveLibrary() {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(library));
  } catch {
    // keep working in memory; the data view tells the user to export
  }
}

function emit(detail) {
  for (const fn of listeners) fn(detail);
}
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export async function init() {
  library = loadLibrary();
  try {
    const all = await idbAll();
    for (const s of all) cache.set(s.id, s);
  } catch { /* private mode: shows are refetched on demand */ }
  // Fetch any library show whose data is missing (e.g. after an import).
  const missing = Object.keys(library.shows).map(Number).filter((id) => !cache.has(id));
  if (missing.length) loadMany(missing);
  if ([...cache.values()].some((s) => s.colorV !== COLOR_V)) recolorOld();
}

export const entries = () => library.shows;
export const entry = (id) => library.shows[id] || null;
export const cached = (id) => cache.get(Number(id)) || transient.get(Number(id)) || null;
export const libraryShows = () =>
  Object.values(library.shows)
    .map((e) => ({ entry: e, show: cache.get(e.id) }))
    .filter((x) => x.show);
export const pendingCount = () => Object.keys(library.shows).filter((id) => !cache.has(Number(id))).length;

const COLOR_V = 3; // bump when the spine colour band changes

async function withColor(show) {
  const prev = cached(show.id);
  show.color = (prev?.colorV === COLOR_V && prev.color) || (await extractColor(show.image)) || hashColor(show.name);
  show.colorV = COLOR_V;
  return show;
}

async function recolorOld() {
  for (const show of cache.values()) {
    if (show.colorV === COLOR_V) continue;
    show.color = (await extractColor(show.image)) || hashColor(show.name);
    show.colorV = COLOR_V;
    idbPut(show);
  }
  emit({ type: 'recolor' });
}

/** Get full show data: cache first, refresh in background when stale. */
export async function getShow(id, { force = false } = {}) {
  id = Number(id);
  const have = cached(id);
  const stale = !have || force || Date.now() - (have.fetchedAt || 0) > REFRESH_AFTER_MS;
  if (have && !stale) return have;
  if (have && stale && !force) {
    refresh(id).catch(() => {});
    return have;
  }
  return refresh(id);
}

function refresh(id) {
  if (inflight.has(id)) return inflight.get(id);
  const p = fetchShow(id)
    .then(withColor)
    .then((show) => {
      if (library.shows[id]) {
        cache.set(id, show);
        idbPut(show);
      } else {
        transient.set(id, show);
      }
      emit({ type: 'show', id });
      return show;
    })
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

async function loadMany(ids, onProgress) {
  let done = 0;
  for (const id of ids) {
    try { await refresh(id); } catch { /* skip, retried next start */ }
    onProgress?.(++done, ids.length);
  }
}

function ensureEntry(id) {
  id = Number(id);
  if (!library.shows[id]) {
    library.shows[id] = { id, addedAt: Date.now(), updatedAt: Date.now(), rating: null, counts: {} };
    const show = transient.get(id);
    if (show) {
      transient.delete(id);
      cache.set(id, show);
      idbPut(show);
    }
  }
  return library.shows[id];
}

/** Mutate the watch counts of a show: fn(counts) edits {episodeId: n}. */
export function updateCounts(id, fn, meta = {}) {
  const e = ensureEntry(id);
  fn(e.counts);
  for (const k of Object.keys(e.counts)) if (!e.counts[k]) delete e.counts[k];
  e.updatedAt = Date.now();
  // Fully watched shows leave the watchlist on their own.
  const show = cache.get(Number(id));
  if (e.watchlist && show && showStats(show, e).complete) e.watchlist = null;
  saveLibrary();
  emit({ type: 'counts', id: Number(id), ...meta });
}

export function setRating(id, rating) {
  const e = ensureEntry(id);
  e.rating = rating;
  e.updatedAt = Date.now();
  saveLibrary();
  emit({ type: 'rating', id: Number(id) });
}

/** Put a show on the watchlist (timestamp) or take it off (null). */
export function setWatchlist(id, on) {
  id = Number(id);
  const e = ensureEntry(id);
  e.watchlist = on ? Date.now() : null;
  e.updatedAt = Date.now();
  // A show that was only remembered and is now forgotten leaves the library entirely.
  if (!on && !e.rating && !Object.keys(e.counts).length) return removeShow(id, { silent: false });
  saveLibrary();
  emit({ type: 'watchlist', id });
}

export const watchlistShows = () =>
  Object.values(library.shows)
    .filter((e) => e.watchlist)
    .map((e) => ({ entry: e, show: cache.get(e.id) }))
    .filter((x) => x.show);

export function snapshot(id) {
  const e = library.shows[id];
  return e ? structuredClone(e) : null;
}
export function restore(id, snap) {
  id = Number(id);
  if (snap) library.shows[id] = snap;
  else removeShow(id, { silent: true });
  saveLibrary();
  emit({ type: 'counts', id });
}

export function removeShow(id, { silent = false } = {}) {
  id = Number(id);
  const show = cache.get(id);
  delete library.shows[id];
  if (show) {
    cache.delete(id);
    transient.set(id, show);
    idbDel(id);
  }
  saveLibrary();
  if (!silent) emit({ type: 'remove', id });
}

// ---------- backup ----------
export function exportData() {
  return {
    app: 'serienregal',
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'Seriendaten: TVmaze (CC BY-SA 4.0). Diese Datei enthält nur deine Einträge.',
    shows: Object.values(library.shows),
    dismissed: Object.keys(library.dismissed || {}).map(Number),
  };
}

export async function importData(data, onProgress) {
  if (!data || data.app !== 'serienregal' || !Array.isArray(data.shows)) {
    throw new Error('Das ist keine Boxset-Sicherung.');
  }
  const shows = {};
  for (const s of data.shows) {
    if (!Number.isInteger(s.id)) continue;
    shows[s.id] = {
      id: s.id,
      addedAt: s.addedAt || Date.now(),
      updatedAt: s.updatedAt || Date.now(),
      rating: Number.isInteger(s.rating) && s.rating >= 1 && s.rating <= 10 ? s.rating : null,
      watchlist: Number.isFinite(s.watchlist) ? s.watchlist : null,
      counts: Object.fromEntries(
        Object.entries(s.counts || {}).filter(([, n]) => Number.isFinite(n) && n > 0 && Number.isInteger(n * 2))
      ),
    };
  }
  const dismissed = {};
  for (const id of Array.isArray(data.dismissed) ? data.dismissed : []) if (Number.isInteger(id)) dismissed[id] = 1;
  library = { version: 1, shows, dismissed };
  saveLibrary();
  for (const id of [...cache.keys()]) if (!shows[id]) { cache.delete(id); idbDel(id); }
  emit({ type: 'import' });
  const missing = Object.keys(shows).map(Number).filter((id) => !cache.has(id));
  await loadMany(missing, onProgress);
  return Object.keys(shows).length;
}

export async function refreshAll(onProgress) {
  await loadMany(Object.keys(library.shows).map(Number), onProgress);
}

export async function wipe() {
  library = { version: 1, shows: {} };
  saveLibrary();
  cache.clear();
  await idbClear();
  emit({ type: 'import' });
}

// ---------- swipe: shows the user has never seen ----------
export const isDismissed = (id) => !!library.dismissed?.[id];
export function dismiss(id) {
  library.dismissed ??= {};
  library.dismissed[id] = 1;
  saveLibrary();
  emit({ type: 'dismiss', id: Number(id) });
}
export function undismiss(id) {
  if (library.dismissed) delete library.dismissed[id];
  saveLibrary();
  emit({ type: 'dismiss', id: Number(id) });
}
export const dismissedCount = () => Object.keys(library.dismissed || {}).length;
