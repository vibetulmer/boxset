// Builds data/popular.json: the most popular TV shows on TVmaze, most popular first.
// Run again any time to refresh or extend the list:  node scripts/build-popular.mjs [count]
// Data: TVmaze (https://www.tvmaze.com), licensed CC BY-SA 4.0. The output file is a derived
// database and therefore also CC BY-SA 4.0 with attribution to TVmaze.
import { writeFile, mkdir, readFile } from 'node:fs/promises';

const COUNT = Number(process.argv[2]) || 3000;
const RAW = new URL('../data/.tvmaze-index.json', import.meta.url);
const OUT = new URL('../data/popular.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchIndex() {
  const all = [];
  for (let page = 0; ; page++) {
    let res;
    for (let tries = 0; tries < 6; tries++) {
      try {
        res = await fetch(`https://api.tvmaze.com/shows?page=${page}`);
        if (res.status !== 429) break;
      } catch (err) {
        console.log(`page ${page}: ${err.cause?.code || err.message}, retrying`);
        res = null;
      }
      await sleep(3000 * (tries + 1));
    }
    if (!res) throw new Error(`page ${page}: network failed repeatedly`);
    if (res.status === 404) break; // past the last page
    if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
    const shows = await res.json();
    for (const s of shows) {
      all.push({
        id: s.id, name: s.name, type: s.type, language: s.language, genres: s.genres,
        status: s.status, premiered: s.premiered, ended: s.ended,
        network: s.network?.name || s.webChannel?.name || null,
        country: s.network?.country?.code || s.webChannel?.country?.code || null,
        weight: s.weight || 0, rating: s.rating?.average || null,
        image: s.image?.medium?.replace(/^http:/, 'https:') || null,
      });
    }
    if (page % 25 === 0) console.log(`page ${page}: ${all.length} shows`);
    await sleep(550); // stay under ~20 calls / 10 s
  }
  await writeFile(RAW, JSON.stringify(all));
  return all;
}

// TVmaze "weight" saturates at 100 for hundreds of shows, so on its own it cannot tell a
// household name from a well-rated niche show. A hand-picked canon of shows nearly everyone
// has heard of leads the deck, in this order; everything after follows the score below.
// Edit freely: names must match TVmaze exactly (the most popular match wins).
const CANON = [
  'Friends', 'How I Met Your Mother', 'Breaking Bad', 'Game of Thrones', 'The Big Bang Theory', 'The Office',
  'Stranger Things', 'The Simpsons', 'Two and a Half Men', 'Prison Break', 'House', 'Grey\'s Anatomy',
  'The Walking Dead', 'Dexter', 'Lost', 'Scrubs', 'Sherlock', 'Peaky Blinders', 'La Casa de Papel', 'Squid Game',
  'The Sopranos', 'The Wire', 'Better Call Saul', 'Dark', 'The Crown', 'Narcos', 'Black Mirror', 'The Witcher',
  'Vikings', 'Suits', 'Modern Family', 'Brooklyn Nine-Nine', 'Desperate Housewives', 'Sex and the City',
  'Gilmore Girls', 'Malcolm in the Middle', 'The Mandalorian', 'The Boys', 'Wednesday', 'Bridgerton',
  'Supernatural', 'Family Guy', 'South Park', 'Rick and Morty', 'Futurama', 'The Last of Us', 'House of the Dragon',
  'Westworld', 'True Detective', 'Fargo', 'Mad Men', 'Homeland', '24', 'Lucifer', 'Orange Is the New Black',
  'House of Cards', 'The Big Bang Theory', 'Riverdale', 'Gossip Girl', 'One Tree Hill', 'Pretty Little Liars',
  'The Vampire Diaries', 'Glee', 'Community', 'Parks and Recreation', 'New Girl', 'Ted Lasso', 'Succession',
  'Severance', 'The Bear', 'Euphoria', 'Ozark', 'MINDHUNTER', 'Chernobyl', 'Band of Brothers', 'The Office',
  'Seinfeld', 'The Fresh Prince of Bel-Air', 'That \'70s Show', 'The King of Queens', 'Everybody Loves Raymond',
  'Charmed', 'Buffy the Vampire Slayer', 'The X-Files', 'Twin Peaks', 'Doctor Who', 'Downton Abbey',
  'The Handmaid\'s Tale', 'Mr. Robot', 'Fleabag', 'Killing Eve', 'Atlanta', 'Arrested Development',
  'Babylon Berlin', 'Stromberg', 'Der Tatortreiniger', 'How to Sell Drugs Online (Fast)', 'Dogs of Berlin',
  'Charité', 'Der Schwarm', 'Die Discounter', 'jerks.', 'Pastewka', 'Türkisch für Anfänger',
  'Berlin, Berlin', 'Der letzte Bulle', 'Club der roten Bänder', 'Tatort', 'Polizeiruf 110', 'Alarm für Cobra 11',
  'The Good Doctor', 'Chicago Fire', 'NCIS', 'CSI: Crime Scene Investigation', 'Criminal Minds', 'Bones',
  'Castle', 'The Mentalist', 'Person of Interest', 'Star Trek: The Next Generation', 'Shōgun', 'The Lord of the Rings: The Rings of Power',
  'Loki', 'WandaVision', 'Andor', 'Reacher', 'Yellowstone', 'Sons of Anarchy', 'Boardwalk Empire', 'Spartacus',
];

// Popularity after the canon: TVmaze "weight" (0–100, driven by followers and activity) first,
// then the community rating, then recency, so the household names lead.
function score(s) {
  return s.weight * 1000 + (s.rating || 0) * 20 + Number((s.premiered || '1900').slice(0, 4)) / 1000;
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
const useCache = process.argv.includes('--cached');
const all = useCache ? JSON.parse(await readFile(RAW, 'utf8')) : await fetchIndex();
const pool = all
  .filter((s) => s.image && ['Scripted', 'Animation', 'Reality', 'Documentary'].includes(s.type))
  .sort((a, b) => score(b) - score(a));
const head = [];
const missing = [];
for (const name of [...new Set(CANON)]) {
  const hit = pool.find((s) => s.name === name); // pool is sorted, so the most popular match wins
  if (hit) head.push(hit); else missing.push(name);
}
if (missing.length) console.log('canon names not found on TVmaze:', missing.join(', '));
const headIds = new Set(head.map((s) => s.id));
const list = [...head, ...pool.filter((s) => !headIds.has(s.id))]
  .slice(0, COUNT)
  .map((s) => [s.id, s.name, s.image, s.premiered?.slice(0, 4) || '', s.ended?.slice(0, 4) || '',
    s.status === 'Running' ? 1 : 0, s.network || '', s.genres.slice(0, 3), s.rating || 0]);

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
// Leave the file untouched when the list itself is the same, so a scheduled run commits nothing.
const previous = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => null);
if (previous && JSON.stringify(previous.shows) === JSON.stringify(list)) {
  console.log(`unchanged: ${list.length} shows, file left as it was`);
  process.exit(0);
}
await writeFile(OUT, JSON.stringify({
  source: 'TVmaze (https://www.tvmaze.com), CC BY-SA 4.0',
  built: new Date().toISOString().slice(0, 10),
  fields: ['id', 'name', 'image', 'from', 'to', 'running', 'network', 'genres', 'rating'],
  shows: list,
}));
console.log(`wrote ${list.length} shows; top 15:`, list.slice(0, 15).map((s) => s[1]).join(', '));
