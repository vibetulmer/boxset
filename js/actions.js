// User actions shared across views.
import * as store from './store.js';
import { raiseTo, showStats } from './model.js';
import { toast, esc, duration } from './ui.js';

/** Bookmark toggle: needs the full show cached so it can live in the library. */
export async function toggleWatchlist(id, button) {
  button?.setAttribute('aria-busy', 'true');
  try {
    const show = await store.getShow(id);
    const on = !store.entry(id)?.watchlist;
    const before = store.snapshot(id);
    store.setWatchlist(id, on);
    toast(on
      ? `<strong>${esc(show.name)}</strong> steht auf deiner Watchlist.`
      : `<strong>${esc(show.name)}</strong> ist nicht mehr auf der Watchlist.`, {
      action: 'Rückgängig',
      onAction: () => store.restore(id, before),
    });
  } catch (err) {
    toast(esc(err.message || 'Das hat nicht geklappt. Prüf deine Verbindung.'));
  } finally {
    button?.removeAttribute('aria-busy');
  }
}

/** "Komplett gesehen" from a search result: fetch, mark every aired episode once, offer undo. */
export async function quickAdd(id, button) {
  button?.setAttribute('aria-busy', 'true');
  try {
    const show = await store.getShow(id);
    const before = store.snapshot(id);
    store.updateCounts(id, (counts) => raiseTo(show, counts, 1), { arriving: 'all' });
    const st = showStats(show, store.entry(id));
    toast(`<strong>${esc(show.name)}</strong> steht im Regal: ${st.aired} Folgen, ${duration(st.watchedMinutes)}.`, {
      action: 'Rückgängig',
      onAction: () => store.restore(id, before),
    });
  } catch (err) {
    toast(esc(err.message || 'Das hat nicht geklappt. Prüf deine Verbindung.'));
  } finally {
    button?.removeAttribute('aria-busy');
  }
}
