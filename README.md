# Surgeon identity check

Finds duplicate and mislabelled surgeon profiles in the public Gangnam Beauty Guide doctor directory, and explains every decision.

Live: https://shreepatil19.github.io/surgeon-identity-check/

## Result on the 4 Oct 2026 snapshot

- 467 profiles, 407 with a Hangul name, 23 Hangul names on more than one profile
- 17 pairs safe to merge (same Hangul, identical review count and rating), e.g. `dr-60` Gang-Woo Lee and `dr-136` Kang-Woo Lee, both 이강우
- 8 pairs that need a human (name-only evidence, or different stats)
- 9 profiles whose English name does not spell the Hangul, e.g. `dr-10` "Chan-Eol Seo" is 이정환 (Lee Jung-Hwan)

## How it decides

1. Block on normalised Hangul, because romanisation is many-to-one.
2. Auto-merge only when review count and rating both match.
3. Send everything else to review with the reason attached.
4. Name check: romanise the Hangul by Unicode syllable arithmetic (Revised Romanization), then compare a consonant key that tolerates common variants, syllable by syllable.

There is no language model in the loop; identity decisions in a medical directory should be explainable and reversible.

## Run

```
node extract.mjs   # refresh data/doctors.json from the live directory (one GET)
node --test        # 9 tests built from real records
```

Then serve the folder statically and open `index.html`.

## Next

- Key surgeons on medical licence number, with clinic in the blocking key
- Upsert on the source platform's doctor ID at ingestion so duplicates are never created; run this check nightly in CI
- The same block-then-compare approach for reviews: the review feed shows each review twice (Korean and Japanese editions of the same source review)
