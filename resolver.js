// Surgeon identity resolver. Pure functions, no dependencies; runs in the
// browser and in node. Decisions are deterministic and carry their evidence,
// so every merge can be explained and reversed.

// Hangul syllables are arithmetic: 0xAC00 + (initial * 21 + medial) * 28 + final.
const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const MEDIALS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const FINALS = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];

// Surnames are the one place Korean romanisation is pure convention, not rules.
const SURNAME_SPELLINGS = {
  '이': ['lee', 'yi', 'rhee', 'i', 'ri'], '김': ['kim', 'gim'], '박': ['park', 'bak', 'pak'],
  '최': ['choi', 'choe'], '정': ['jung', 'jeong', 'chung', 'chong', 'choung'], '조': ['cho', 'jo'],
  '강': ['kang', 'gang'], '윤': ['yoon', 'yun'], '장': ['jang', 'chang'], '임': ['lim', 'im', 'yim'],
  '한': ['han'], '오': ['oh', 'o'], '서': ['seo', 'suh', 'so'], '신': ['shin', 'sin'],
  '권': ['kwon', 'gwon'], '황': ['hwang'], '안': ['ahn', 'an'], '송': ['song'], '류': ['ryu', 'yoo', 'yu'],
  '유': ['yoo', 'yu', 'ryu'], '홍': ['hong'], '전': ['jeon', 'jun', 'chun'], '고': ['ko', 'koh', 'go'],
  '문': ['moon', 'mun'], '양': ['yang'], '손': ['son', 'sohn'], '배': ['bae'], '백': ['baek', 'paik', 'paek'],
  '허': ['heo', 'huh', 'hur', 'hu'], '남': ['nam'], '심': ['shim', 'sim'], '노': ['noh', 'no', 'roh'],
  '하': ['ha'], '곽': ['kwak', 'gwak'], '성': ['sung', 'seong'], '차': ['cha'], '주': ['joo', 'ju', 'chu'],
  '우': ['woo', 'u'], '구': ['koo', 'ku', 'gu'], '민': ['min'], '진': ['jin'], '나': ['na', 'ra'],
  '엄': ['um', 'eom', 'aum'], '천': ['cheon', 'chun'], '방': ['bang'], '변': ['byun', 'byeon'], '염': ['yeom', 'yum'],
};

/** Revised Romanization of a Hangul string, syllable by syllable (how names are written). */
export function romanise(hangul) {
  return [...hangul].map((ch) => {
    const code = ch.codePointAt(0);
    if (code < HANGUL_BASE || code > HANGUL_LAST) return ch;
    const offset = code - HANGUL_BASE;
    const initial = Math.floor(offset / (21 * 28));
    const medial = Math.floor((offset % (21 * 28)) / 28);
    return INITIALS[initial] + MEDIALS[medial] + FINALS[offset % 28];
  }).join('');
}

/**
 * Loose consonant key that survives the usual spelling variants
 * (Gang/Kang, Hyeong/Hyung, U/Woo, Cheol/Chul, Seop/Sup, R/L).
 */
export function skeleton(latin) {
  const folded = latin.toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ch/g, 'j').replace(/sh/g, 's')
    .replace(/[ckq]/g, 'g').replace(/t/g, 'd').replace(/p/g, 'b').replace(/r/g, 'l')
    .replace(/[aeiouwyh]/g, '');
  // Collapse runs so 'Hyuk-Kyu' (kk) and 'hyeokgyu' (kg) meet.
  return [...folded].filter((c, n, all) => c !== all[n - 1]).join('');
}

/** Source data has stray whitespace (" 홍성문"); NFC + trim before any comparison. */
export const normaliseHangul = (s) => (s ? s.normalize('NFC').trim() || null : null);

/** Split "Dr. Jeong-Hwan Sim(Shim)" into { given: 'Jeong-Hwan', family: 'sim' }. */
function splitEnglishName(romanizedName) {
  const parts = romanizedName.replace(/^dr\.?\s*/i, '').replace(/\(.*?\)/g, '').trim().split(/\s+/);
  const family = (parts.pop() || '').toLowerCase().replace(/[^a-z]/g, '');
  return { given: parts.join('-'), family };
}

/** Compare syllable by syllable when the English name is hyphenated, so "Je-Jun" cannot pass for 재은. */
function givenNameMatches(englishGiven, hangulGiven) {
  const syllables = [...hangulGiven].map(romanise);
  const parts = englishGiven.split('-').filter(Boolean);
  if (parts.length === syllables.length) {
    return parts.every((part, i) => skeleton(part) === skeleton(syllables[i]));
  }
  return skeleton(parts.join('')) === skeleton(syllables.join(''));
}

/** Does the English name plausibly spell the Hangul name? Returns { ok, reasons }. */
export function checkNameMatch(record) {
  const hangul = normaliseHangul(record.koreanName);
  if (!hangul || hangul.length < 2) return { ok: true, reasons: ['no Hangul to check against'] };
  const { given, family } = splitEnglishName(record.romanizedName);
  const surname = hangul[0];
  const reasons = [];

  const allowed = SURNAME_SPELLINGS[surname] || [romanise(surname)];
  if (!allowed.includes(family) && skeleton(family) !== skeleton(romanise(surname))) {
    reasons.push(`family name "${family}" is not a spelling of ${surname} (expected ${allowed.join('/')})`);
  }
  const expected = romanise(hangul.slice(1));
  if (!givenNameMatches(given, hangul.slice(1))) {
    reasons.push(`given name "${given}" does not match ${hangul.slice(1)} (${expected})`);
  }
  return { ok: reasons.length === 0, reasons };
}

const hasStats = (r) => r.rating != null && r.reviewCount != null && r.reviewCount > 0;

/**
 * Two profiles that share a Hangul name. Auto-merge only when two independent
 * signals agree; everything else goes to a human. A wrong merge would attach
 * one surgeon's reviews and credentials to another person.
 */
export function decidePair(a, b) {
  const evidence = [`same Hangul name ${a.koreanName}`];
  if (skeleton(a.romanizedName) !== skeleton(b.romanizedName)) {
    evidence.push(`romanised differently: "${a.romanizedName}" vs "${b.romanizedName}"`);
  }
  if (!hasStats(a) || !hasStats(b)) {
    evidence.push('no rating or review count on at least one profile, name is the only evidence');
    return { decision: 'review', evidence };
  }
  if (a.reviewCount === b.reviewCount && a.rating === b.rating) {
    evidence.push(`identical review count (${a.reviewCount})`, `identical rating (${a.rating})`);
    return { decision: 'merge', evidence };
  }
  evidence.push(
    `review counts differ (${a.reviewCount} vs ${b.reviewCount})`,
    'likely two people sharing a common name; confirm with clinic or licence number',
  );
  return { decision: 'review', evidence };
}

/** Run the full check over a directory snapshot. */
export function resolve(doctors) {
  const byHangul = new Map();
  for (const d of doctors) {
    const key = normaliseHangul(d.koreanName);
    if (!key) continue;
    byHangul.set(key, [...(byHangul.get(key) || []), d]);
  }

  const pairs = [];
  for (const group of byHangul.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        pairs.push({ a: group[i], b: group[j], ...decidePair(group[i], group[j]) });
      }
    }
  }

  const nameMismatches = doctors
    .map((d) => ({ doctor: d, ...checkNameMatch(d) }))
    .filter((r) => !r.ok);

  return {
    total: doctors.length,
    withHangul: doctors.filter((d) => d.koreanName).length,
    sharedNames: [...byHangul.values()].filter((g) => g.length > 1).length,
    merge: pairs.filter((p) => p.decision === 'merge'),
    review: pairs.filter((p) => p.decision === 'review'),
    nameMismatches,
  };
}

// ---- Review feed -------------------------------------------------------

const wordPairs = (text) => {
  const words = text.toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ');
  const pairs = new Set();
  for (let i = 0; i < words.length - 1; i += 1) pairs.add(`${words[i]} ${words[i + 1]}`);
  return pairs;
};

export function jaccard(a, b) {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

// Measured on the live feed: unrelated reviews never score above 0.11,
// paraphrased copies of one source review score 0.14 and up.
export const REVIEW_COPY_THRESHOLD = 0.14;

/**
 * Copies of one source review, re-summarised with different wording.
 * Block on (clinic, rating, date) first so only plausible pairs are compared,
 * then pair each review with at most one best match above the threshold.
 */
export function findReviewCopies(reviews) {
  const blocks = new Map();
  for (const r of reviews) {
    const key = `${r.clinicSlug}|${r.rating}|${r.date}`;
    blocks.set(key, [...(blocks.get(key) || []), r]);
  }
  const copies = [];
  for (const group of blocks.values()) {
    const candidates = [];
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        candidates.push({ a: group[i], b: group[j], score: jaccard(wordPairs(group[i].text), wordPairs(group[j].text)) });
      }
    }
    candidates.sort((x, y) => y.score - x.score);
    const used = new Set();
    for (const c of candidates) {
      if (c.score < REVIEW_COPY_THRESHOLD || used.has(c.a) || used.has(c.b)) continue;
      used.add(c.a);
      used.add(c.b);
      copies.push(c);
    }
  }
  return copies;
}

// Regulators name the legal entity (에이비성형외과의원); the site drops the suffix.
const clinicKey = (ko) => normaliseHangul(ko)?.replace(/(의원|병원)$/, '') || null;

const HAS_HANGUL = /[가-힣]/;

/**
 * Clinics: block on normalised Korean name. Also flag records whose Korean
 * name is not Korean at all, which is where editorial notes leak into data.
 */
export function findClinicIssues(clinics) {
  const byKey = new Map();
  const notes = [];
  for (const c of clinics) {
    const key = clinicKey(c.koreanName);
    if (!key || !HAS_HANGUL.test(key)) {
      notes.push({ clinic: c, reason: key ? `Korean name field holds "${key}"` : 'no Korean name' });
      continue;
    }
    byKey.set(key, [...(byKey.get(key) || []), c]);
  }
  const duplicates = [...byKey.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([koreanName, group]) => ({ koreanName, clinics: group }));
  return { duplicates, notes };
}

/** Join regulator actions to site clinics on normalised Korean name, never on English. */
export function matchSanctions(clinics, actions) {
  const byKey = new Map(clinics.map((c) => [clinicKey(c.koreanName), c]));
  return actions.flatMap((action) => action.clinics.map((target) => ({
    ...target,
    authority: action.authority,
    date: action.date,
    action: action.action,
    source: action.source,
    siteClinic: byKey.get(clinicKey(target.koreanName)) || null,
  })));
}
