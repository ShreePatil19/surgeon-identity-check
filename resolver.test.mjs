// Cases are real records from the public directory snapshot (data/doctors.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { romanise, skeleton, checkNameMatch, decidePair, resolve } from './resolver.js';

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
