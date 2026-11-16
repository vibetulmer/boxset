// Pure calculations over show data + user entries.
// Episode tuple: [id, season, number, name, runtime, airdate]

export const EP = { id: 0, season: 1, number: 2, name: 3, runtime: 4, airdate: 5 };

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function isAired(show, ep, today = todayIso()) {
  const date = ep[EP.airdate];
  if (!date) return show.status === 'Ended';
  return date <= today;
}

export const runtimeOf = (show, ep) => ep[EP.runtime] || show.runtime || 0;

export function airedEpisodes(show, today = todayIso()) {
  return show.episodes.filter((ep) => isAired(show, ep, today));
}

/** Detailed stats for one show. */
export function showStats(show, entry) {
  const counts = entry?.counts || {};
  const today = todayIso();
  const bySeason = new Map(show.seasons.map((s) => [s.number, {
    number: s.number, id: s.id, episodes: [], aired: 0, watched: 0, minCount: Infinity,
    minutes: 0, watchedMinutes: 0,
  }]));
  let aired = 0, watched = 0, views = 0, runMinutes = 0, watchedMinutes = 0, runs = Infinity, remainingMinutes = 0;
  let estimated = false;

  for (const ep of show.episodes) {
    const s = bySeason.get(ep[EP.season]);
    if (!s) continue;
    const isOut = isAired(show, ep, today);
    const n = counts[ep[EP.id]] || 0;
    const rt = runtimeOf(show, ep);
    if (!ep[EP.runtime]) estimated = true;
    s.episodes.push({ ep, aired: isOut, count: n, runtime: rt });
    if (isOut) {
      aired++; s.aired++;
      runMinutes += rt; s.minutes += rt;
      runs = Math.min(runs, n);
      s.minCount = Math.min(s.minCount, n);
      if (n === 0) remainingMinutes += rt;
    }
    if (n > 0) { watched++; s.watched++; views += n; }
    watchedMinutes += n * rt; s.watchedMinutes += n * rt;
  }
  const seasons = [...bySeason.values()].map((s) => ({
    ...s,
    minCount: s.aired ? s.minCount : 0,
    complete: s.aired > 0 && s.minCount >= 1 && s.minCount !== Infinity,
    progress: s.aired ? Math.min(1, s.watched / s.aired) : 0,
  }));
  if (!aired) runs = 0;
  return {
    seasons,
    aired,
    upcoming: show.episodes.length - aired,
    watched,
    views,
    runs,
    runMinutes,
    watchedMinutes,
    remainingMinutes,
    estimated,
    started: watched > 0,
    complete: aired > 0 && runs >= 1,
    newEpisodes: runs === 0 && watched > 0 ? aired - watched : 0,
  };
}

// ---------- mutations as count transforms ----------

export function setAllAired(show, counts, n, filter = () => true) {
  for (const ep of airedEpisodes(show)) {
    if (!filter(ep)) continue;
    counts[ep[EP.id]] = n;
  }
}

/** Raise every aired episode (optionally of one season) to at least n views. */
export function raiseTo(show, counts, n, season = null) {
  for (const ep of airedEpisodes(show)) {
    if (season != null && ep[EP.season] !== season) continue;
    const id = ep[EP.id];
    counts[id] = Math.max(counts[id] || 0, n);
  }
}

/** Cap every episode (optionally of one season) at n views. */
export function capAt(show, counts, n, season = null) {
  for (const ep of show.episodes) {
    if (season != null && ep[EP.season] !== season) continue;
    const id = ep[EP.id];
    if ((counts[id] || 0) > n) counts[id] = n;
  }
}

// ---------- tiers ----------

export const TIERS = [
  { key: 'S', min: 10, label: 'Meisterwerk', range: '10' },
  { key: 'A', min: 9, label: 'Großartig', range: '9' },
  { key: 'B', min: 7, label: 'Richtig gut', range: '7–8' },
  { key: 'C', min: 5, label: 'Ganz okay', range: '5–6' },
  { key: 'D', min: 1, label: 'Hätte nicht sein müssen', range: '1–4' },
];
export const tierOf = (rating) => (rating ? TIERS.find((t) => rating >= t.min)?.key : null);

// ---------- library aggregate ----------

export function libraryStats(items) {
  let minutes = 0, episodes = 0, views = 0, seasonsWatched = 0, complete = 0, started = 0;
  let rated = 0, ratingSum = 0, estimated = false;
  const genres = new Map();
  const perShow = [];
  for (const { show, entry } of items) {
    const st = showStats(show, entry);
    if (!st.started && !entry.rating) continue;
    if (st.started) started++;
    if (st.complete) complete++;
    minutes += st.watchedMinutes;
    episodes += st.watched;
    views += st.views;
    seasonsWatched += st.seasons.filter((s) => s.complete).length;
    if (st.estimated && st.watched) estimated = true;
    if (entry.rating) { rated++; ratingSum += entry.rating; }
    for (const g of show.genres || []) genres.set(g, (genres.get(g) || 0) + st.watchedMinutes);
    perShow.push({ show, entry, stats: st });
  }
  return {
    minutes, episodes, views, rewatches: views - episodes, seasonsWatched, complete, started,
    rated, avgRating: rated ? ratingSum / rated : null, estimated,
    genres: [...genres.entries()].filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]),
    perShow,
  };
}
