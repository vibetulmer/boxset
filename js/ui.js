// Small UI helpers: escaping, German formatting, icons, spines, toasts.
import { hash01 } from './color.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
export const num = (n) => nf.format(Math.round(n));
export const num1 = (n) => nf1.format(n);
/** Watch multiplier, e.g. "2×" or "1,5×". */
export const times = (n) => `${nf1.format(n)}×`;

export function duration(min, { long = false } = {}) {
  min = Math.round(min);
  if (min <= 0) return '0 Min.';
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m} Min.`;
  if (h < 48) return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
  const H = Math.round(min / 60); // same rounding as hoursOf()
  const d = Math.floor(H / 24), rh = H % 24;
  if (long) return `${nf.format(d)} Tage${rh ? `, ${rh} Stunden` : ''}`;
  return `${nf.format(d)} Tage${rh ? ` ${rh} Std.` : ''}`;
}

export const hoursOf = (min) => nf.format(Math.round(min / 60));

export function dateDE(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function years(show) {
  const a = show.premiered?.slice(0, 4);
  if (!a) return '';
  const b = show.ended?.slice(0, 4);
  if (show.status === 'Running') return `seit ${a}`;
  if (b && b !== a) return `${a}–${b}`;
  return a;
}

const GENRES = {
  Drama: 'Drama', Comedy: 'Komödie', Crime: 'Krimi', Thriller: 'Thriller', 'Science-Fiction': 'Science-Fiction',
  Fantasy: 'Fantasy', Horror: 'Horror', Romance: 'Romantik', Action: 'Action', Adventure: 'Abenteuer',
  Mystery: 'Mystery', Family: 'Familie', Children: 'Kinder', Anime: 'Anime', History: 'Geschichte', War: 'Krieg',
  Western: 'Western', Music: 'Musik', Sports: 'Sport', Medical: 'Medizin', Legal: 'Justiz',
  Supernatural: 'Übernatürlich', Espionage: 'Spionage', Food: 'Essen', Travel: 'Reisen', Nature: 'Natur',
};
export const genreDE = (g) => GENRES[g] || g;

const STATUS = { Ended: 'Beendet', Running: 'Läuft noch', 'To Be Determined': 'Zukunft offen', 'In Development': 'In Entwicklung' };
export const statusDE = (s) => STATUS[s] || s || '';

export const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** Markup for one season spine. */
export function spine(show, season, { tag = 'span', attrs = '', arriving = false } = {}) {
  const state = season.complete ? 'is-full' : season.watched ? 'is-partial' : 'is-empty';
  const pct = Math.round(season.progress * 100);
  const count = season.minCount > 1 ? `<span class="spine__count">${times(season.minCount)}</span>` : '';
  // Empty and partly watched seasons are empty cases: no printed title, the gap is the data.
  // A season seen "about half" (every episode at 0.5) shows its multiplier instead of x/y.
  const half = season.watched === season.aired && season.minCount > 0 && season.minCount < 1;
  const body = season.complete
    ? `<span class="spine__title">${esc(show.name)}</span>${count}`
    : season.watched
      ? `<span class="spine__gap"></span><span class="spine__part">${half ? times(season.minCount) : `${season.watched}/${season.aired}`}</span>`
      : '<span class="spine__gap"></span>';
  return `<${tag} class="spine ${state}${arriving ? ' is-arriving' : ''}" style="--c:${show.color};--p:${pct}%" ${attrs}>
    <span class="spine__num">${season.number}</span>
    ${body}
  </${tag}>`;
}

/** Box set height varies a little per show, like real shelves. */
export const boxHeight = (show) => `${Math.round(86 + hash01(show.name) * 14)}%`;

let toastTimer;
export function toast(message, { action, onAction, duration: ms = 5200 } = {}) {
  const host = document.querySelector('.toasts');
  clearTimeout(toastTimer);
  host.innerHTML = `<div class="toast"><span>${message}</span>${
    action ? `<button type="button" class="toast__action">${esc(action)}</button>` : ''
  }</div>`;
  const el = host.firstElementChild;
  el.querySelector('.toast__action')?.addEventListener('click', () => {
    onAction?.();
    el.remove();
  });
  toastTimer = setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
