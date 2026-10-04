// Snapshot the public doctor directory into data/doctors.json.
// The page is server-rendered by Next.js; the doctor records sit in the
// self.__next_f flight payload, so one GET is enough. Run: node extract.mjs
import { writeFile } from 'node:fs/promises';

const SOURCE = 'https://gangnambeautyguide.com/en/doctors/';
const RECORD = /\{"slug":"(dr-\d+)","romanizedName":"([^"]*)","koreanName":(null|"[^"]*"),"photoUrl":(?:null|"[^"]*"),"specialtyEn":(null|"[^"]*"),"classification":(null|"[^"]*"),"rating":(null|[\d.]+),"reviewCount":(null|\d+)/g;

const parseOrNull = (raw) => (raw === 'null' ? null : JSON.parse(raw));

const res = await fetch(SOURCE, { headers: { 'user-agent': 'Mozilla/5.0 (surgeon-identity-check)' } });
if (!res.ok) throw new Error(`GET ${SOURCE} failed: ${res.status}`);
const html = await res.text();

const flight = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
  .map((m) => JSON.parse(m[1]))
  .join('');

const bySlug = new Map();
for (const m of flight.matchAll(RECORD)) {
  bySlug.set(m[1], {
    slug: m[1],
    romanizedName: m[2],
    koreanName: parseOrNull(m[3]),
    specialty: parseOrNull(m[4]),
    classification: parseOrNull(m[5]),
    rating: parseOrNull(m[6]),
    reviewCount: parseOrNull(m[7]),
  });
}

if (bySlug.size === 0) throw new Error('No doctor records found; the page structure may have changed.');

const snapshot = {
  source: SOURCE,
  fetchedAt: new Date().toISOString(),
  doctors: [...bySlug.values()],
};
await writeFile(new URL('./data/doctors.json', import.meta.url), JSON.stringify(snapshot, null, 1));
console.log(`Saved ${snapshot.doctors.length} doctors (${snapshot.doctors.filter((d) => d.koreanName).length} with Hangul).`);
