// Cases are real records from the public directory snapshot (data/doctors.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { romanise, skeleton, checkNameMatch, decidePair, resolve, findReviewCopies, matchSanctions } from './resolver.js';

test('finds a re-summarised copy of one review and ignores a different review in the same block', () => {
  const block = { clinicSlug: 'g-clinic', rating: 5, date: '2026-04-12' };
  const copies = findReviewCopies([
    { ...block, id: 1, text: 'The reviewer had treatment for fine facial spots and redness. The spots reacted and turned dark like moles for several days, but the visit was smooth.' },
    { ...block, id: 2, text: 'The reviewer had treatment for fine facial spots and redness. The spots reacted and turned black like moles for several days, but the visit was smooth.' },
    { ...block, id: 3, text: 'The patient had shoulder Botox to slim the shoulders and was happy with the quick appointment and friendly nurses.' },
  ]);
  assert.equal(copies.length, 1);
  assert.deepEqual([copies[0].a.id, copies[0].b.id], [1, 2]);
});

test('joins a regulator action to a clinic on Korean name, ignoring the legal-entity suffix', () => {
  const [hit] = matchSanctions(
    [{ slug: 'ab-ps', name: 'AB Plastic Surgery', koreanName: '에이비성형외과' }],
    [{ authority: 'KFTC', date: '2026-07-12', action: 'x', source: 'y', clinics: [{ koreanName: '에이비성형외과의원', remedy: 'z' }] }],
  );
  assert.equal(hit.siteClinic.slug, 'ab-ps');
});

const doc = (slug, romanizedName, koreanName, rating, reviewCount) => ({ slug, romanizedName, koreanName, rating, reviewCount });

test('romanises Hangul by syllable arithmetic', () => {
  assert.equal(romanise('이강우'), 'igangu');
  assert.equal(romanise('김형택'), 'gimhyeongtaek');
});

test('skeleton folds common spelling variants together', () => {
  assert.equal(skeleton('Gang-Woo'), skeleton('Kang-Woo'));
  assert.equal(skeleton('Hyeong-Taek'), skeleton('Hyung-Taek'));
  assert.equal(skeleton('Jun-U'), skeleton('Jun-Woo'));
});

test('merges the Gang-Woo / Kang-Woo Lee duplicate (same Hangul, count and rating)', () => {
  const r = decidePair(doc('dr-60', 'Gang-Woo Lee', '이강우', 4.6, 999), doc('dr-136', 'Kang-Woo Lee', '이강우', 4.6, 999));
  assert.equal(r.decision, 'merge');
});

test('does not merge two Se-Young Kims with different review counts', () => {
  const r = decidePair(doc('dr-155', 'Se-Yeong Kim', '김세영', 4.8, 161), doc('dr-324', 'Se-Young Kim', '김세영', 4.75, 128));
  assert.equal(r.decision, 'review');
});

test('sends name-only matches to a human', () => {
  const r = decidePair(doc('dr-62', 'Chan Kwon', '권찬', null, null), doc('dr-134', 'Chan Kwon', '권찬', null, null));
  assert.equal(r.decision, 'review');
});

test('flags a profile whose English name is a different person', () => {
  assert.equal(checkNameMatch(doc('dr-10', 'Chan-Eol Seo', '이정환', 4.7, 118)).ok, false);
  assert.equal(checkNameMatch(doc('dr-11', 'Jung-Hwan Lee', '이정환', 4.7, 118)).ok, true);
});

test('accepts legitimate spelling variants and dirty Hangul', () => {
  assert.equal(checkNameMatch(doc('dr-110', 'Hyuk-Kyu Choi', '최혁규')).ok, true);
  assert.equal(checkNameMatch(doc('dr-310', 'Jeong-Hwan Sim(Shim)', '심정환')).ok, true);
  assert.equal(checkNameMatch(doc('dr-322', 'Jae-Jin Ock', '옥재진')).ok, true);
  assert.equal(checkNameMatch(doc('dr-198', 'Sung-Moon Hong', ' 홍성문')).ok, true);
});

test('catches a one-syllable mismatch that a whole-name comparison would miss', () => {
  assert.equal(checkNameMatch(doc('dr-57', 'Je-Jun Lee', '이재은')).ok, false);
});

test('groups by normalised Hangul across the whole directory', () => {
  const r = resolve([
    doc('a', 'Gang-Woo Lee', '이강우', 4.6, 999),
    doc('b', 'Kang-Woo Lee', ' 이강우', 4.6, 999),
    doc('c', 'Ji-Won Lee', '이지원', 4.7, 880),
  ]);
  assert.equal(r.merge.length, 1);
  assert.equal(r.sharedNames, 1);
});
