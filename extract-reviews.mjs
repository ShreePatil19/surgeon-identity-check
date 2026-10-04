// Snapshot the public review feed and clinic list into data/reviews.json.
// Review copies are found here, at extract time, so the published file holds
// only metadata and short snippets, not the full review text. Run: node extract-reviews.mjs
import { writeFile } from 'node:fs/promises';
import { findReviewCopies } from './resolver.js';

const ORIGIN = 'https://gangnambeautyguide.com';
const REVIEW = /\{"initial":"[^"]*","rating":([\d.]+),"clinicName":"([^"]*)","clinicSlug":"([^"]*)","source":"([^"]*)","date":"([^"]*)","summary":("(?:[^"\\]|\\.)*")\}/g;
const CLINIC = /\{"slug":"([a-z0-9-]+)","name":"([^"]*)","tier":"(gold|silver)"/g;
const SNIPPET_WORDS = 14;

async function flight(path) {
  const res = await fetch(ORIGIN + path, { headers: { 'user-agent': 'Mozilla/5.0 (surgeon-identity-check)' } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  const html = await res.text();
  return [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1])).join('');
}

const reviewFlight = await flight('/en/reviews/');
const reviews = [...reviewFlight.matchAll(REVIEW)].map((m, i) => ({
  id: i + 1,
  rating: Number(m[1]),
  clinicName: m[2],
  clinicSlug: m[3],
  source: m[4],
  date: m[5],
  text: JSON.parse(m[6]),
}));
if (reviews.length === 0) throw new Error('No reviews found; the page structure may have changed.');

const clinicFlight = await flight('/en/clinics/');
const clinics = [];
for (const m of clinicFlight.matchAll(CLINIC)) {
  const next = clinicFlight.indexOf('{"slug"', m.index + 1);
  const body = clinicFlight.slice(m.index, next === -1 ? undefined : next);
  const ko = body.match(/"koreanName":"([^"]*)"/);
  const rating = body.match(/"rating":([\d.]+)/);
  const count = body.match(/"reviewCount":(\d+)/);
  clinics.push({
    slug: m[1],
    name: m[2],
    tier: m[3],
    koreanName: ko ? ko[1] : null,
    rating: rating ? Number(rating[1]) : null,
    reviewCount: count ? Number(count[1]) : null,
  });
}

const copies = findReviewCopies(reviews);
const snippet = (text) => text.split(/\s+/).slice(0, SNIPPET_WORDS).join(' ') + '...';

const snapshot = {
  source: `${ORIGIN}/en/reviews/`,
  fetchedAt: new Date().toISOString(),
  reviews: reviews.map(({ text, ...meta }) => ({ ...meta, snippet: snippet(text) })),
  copies: copies.map((c) => ({ a: c.a.id, b: c.b.id, score: Number(c.score.toFixed(2)) })),
  clinics,
};
await writeFile(new URL('./data/reviews.json', import.meta.url), JSON.stringify(snapshot, null, 1));
console.log(`Saved ${reviews.length} reviews, ${copies.length} likely copies, ${clinics.length} clinics.`);
