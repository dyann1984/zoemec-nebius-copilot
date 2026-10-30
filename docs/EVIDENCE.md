# Evidence of the real Nebius/NVIDIA integration

## What is proven

`evidence/REAL_CALL.json` was written by `scripts/smoke.mjs` from this repository's code, with the synthetic demo data, against `https://api.tokenfactory.nebius.com/v1` and model `nvidia/nemotron-3-super-120b-a12b`. The file stores the provider's response ID, model echoed by the provider, token usage, latency, number of attempts and the evidence references used. It stores no prompt and no key. The request ID can be matched against Nebius Token Factory usage logs.

Check it yourself: run `npm run smoke` with your own key.

## Observed reliability (honest numbers)

Before the retry limit was raised from 2 to 3 attempts, the first `npm run smoke` run failed with `INVALID_MODEL_OUTPUT` (both attempts rejected by the grounding validator), and in a following series of 3 runs, 2 passed and 1 failed. Several diagnostic runs showed the model's first answer is sometimes rejected and sometimes accepted, with identical input (temperature 0 does not make it deterministic). After the change, the recorded run in `evidence/REAL_CALL.json` passed on its second attempt. These are a handful of runs, not a benchmark; expect occasional "answer did not pass evidence validation" errors in the UI, which a retry normally resolves.

## What is NOT proven

- `npm test` never calls Nebius (mock transport).
- Semantic correctness of explanations is not automatically verified.
- Nebius billing/cost is not tracked in the app.

## Relationship to the commercial platform

The private commercial ZOEMEC repository contains an earlier integration of the same provider design with its own larger engines and its own real-call records. Its design document there was written before a key was available and still says that no real call was made; the later JSON records in that repository supersede that sentence. Those records and that code are not part of this public edition, and this edition does not rely on them: its proof is only `evidence/REAL_CALL.json`.
