# How this repository relates to the live ZOEMEC demo

**Live demo submitted to the hackathon:** https://zoemecia.com/?demo=1 (ZOEMEC "Judge Mode", no login required).
**This repository:** the open-source part of the same Nebius Token Factory / NVIDIA Nemotron integration, plus a small standalone app that lets you run and test it yourself.

## What the live demo does (stage 11, "NVIDIA Copilot")

ZOEMEC is a commercial construction cost-intelligence platform that existed before the hackathon. Its Judge Mode is a public, no-login walkthrough with 10 stages (project, element, quantity, APU, cost, Confidence, Bid Risk, audit, schedule, export), all computed in the browser from synthetic data. **During the hackathon we added stage 11, the NVIDIA Nemotron Engineering Copilot**, plus a welcome callout and an extra tour step:

1. The visitor picks one of four synthetic unit prices (APU) and presses a button or asks a short question.
2. The browser sends only: APU id, analysis type, question (max 300 characters) and an optional bounded percent scenario. It never sends figures or context.
3. The server rebuilds the same synthetic demo with the commercial engines (cost, Confidence, Bid Risk, audit, Challenge, scenario), turns the results into numbered evidence references (`E1..En`) and calls `nvidia/nemotron-3-super-120b-a12b` on Nebius Token Factory with a strict JSON schema.
4. The answer is validated (schema, existing evidence references only, no digits/links/HTML/standards). Failed answers are retried and then rejected; there is no fallback model and no canned answer.
5. The UI shows summary, inferences, risks and recommended actions with expandable evidence whose values come from the engines, plus the provider request ID, token count and latency.
6. Abuse protection for the public endpoint: a persistent per-IP-per-hour limit, a global daily cap (charged before the model is called, fail-closed) and an edge rate-limit rule.

## What is in this repository

| Part | Here | In the live demo |
|---|---|---|
| Nebius Token Factory client, JSON schema, grounding validator, retry logic (`server/nebiusProvider.mjs`) | Yes | Same design; the commercial copy keeps its Spanish base prompt plus an English override and 2 attempts, this copy has an English prompt and 3 attempts |
| Evidence-reference context builder (`server/context.mjs`) | Yes (generic) | Commercial builder over commercial engines |
| Deterministic cost engine | Small original engine (`server/engine/costEngine.mjs`) | Commercial engines (private) |
| UI | Standalone copilot page | Stage 11 inside Judge Mode (private) |
| Public-endpoint limits | In-memory per-IP and daily limits plus an edge rule | Firestore-backed limits plus an edge rule |
| Real-call evidence | `evidence/REAL_CALL.json`, `evidence/JUDGE_MODE_REAL_CALL.json` | Same endpoint |

## Honest limits of reproducibility

The commercial engines, Judge Mode UI and database are **not** open source, so the live demo cannot be reproduced from this repository alone. What you can reproduce and test here is the Nebius/Nemotron integration and the grounding method on a small, original engine. `evidence/JUDGE_MODE_REAL_CALL.json` records real calls made by the live demo's backend code (request IDs, models, token counts); it contains no prompts or keys.
