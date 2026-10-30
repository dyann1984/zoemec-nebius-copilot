# ZOEMEC Cost Copilot — NVIDIA Nemotron on Nebius Token Factory

Hackathon edition for the **Nebius × NVIDIA Global AI Hackathon**, track **Best Apps and Agents**.

Construction estimators price work with unit price analyses (APU): materials, labor and equipment, plus overhead and profit. The weak point is rarely the arithmetic; it is whether each price has a verifiable, recent source. This app computes unit prices with a **deterministic engine** and then asks **NVIDIA Nemotron, served by Nebius Token Factory**, to explain risks and next steps **strictly in terms of evidence the engine produced**.

## How Nebius and NVIDIA are used

- Every analysis makes a runtime call to `POST https://api.tokenfactory.nebius.com/v1/chat/completions` with model `nvidia/nemotron-3-super-120b-a12b` and a strict `json_schema` response format (`server/nebiusProvider.mjs`).
- Token Factory gave us one OpenAI-compatible endpoint with structured output and open NVIDIA weights, so the validation layer below is the only integration code we needed.
- The model never writes numbers. It selects evidence references (`E1`, `E2`, ...). Output is rejected if it has digits, links, HTML, standard names, unknown references or schema violations. On rejection the request is retried with a repair prompt (up to 3 attempts), then fails with an explicit error. There is **no fallback provider and no canned answer**.
- Only Nemotron models and the two official Token Factory hosts are accepted; redirects are refused so the key cannot be sent elsewhere.
- Not used: Nebius AI Cloud compute, Tavily.

## What was built during the hackathon

The commercial ZOEMEC platform (private) existed before the hackathon: React/Vite UI, Firebase, APU generation and calculation, Confidence, Bid Risk, audit, Challenge, scenarios, CAD takeoff, schedules, PDF/Excel deliverables and the Judge Mode walkthrough. None of that is claimed as hackathon work and its engines and UI are **not part of this repository**.

Built during the Submission Period: the Nebius Token Factory / NVIDIA Nemotron provider with strict JSON-schema output and a grounding validator; the evidence-reference context builder; the public-endpoint protections (per-IP and daily quotas charged before the model call, edge rate limit); Judge Mode **stage 11 (NVIDIA Nemotron Engineering Copilot)** with a welcome callout and a new tour step, in the private product; and, in this repository, a standalone copilot app with an original small cost engine, synthetic data, tests and evidence of real calls. See [docs/SCOPE.md](docs/SCOPE.md) and [docs/JUDGE_MODE_INTEGRATION.md](docs/JUDGE_MODE_INTEGRATION.md).

## Live demo: ZOEMEC Judge Mode (stage 11)

The hackathon demo is the full ZOEMEC product in public, no-login "Judge Mode": **https://zoemecia.com/?demo=1**. Its new stage 11, *NVIDIA Nemotron Engineering Copilot*, calls Nebius Token Factory live and explains the results of ZOEMEC's commercial engines with verifiable evidence references. The commercial engines and UI are private; this repository is the open-source integration layer and a runnable standalone app. Exactly what is shared, what differs and what cannot be reproduced from this repository is spelled out in [docs/JUDGE_MODE_INTEGRATION.md](docs/JUDGE_MODE_INTEGRATION.md). A standalone copy of this repository's app is also deployed at https://zoemec-nebius-copilot.vercel.app.

## Quick start

Requires Node.js 22+.

```sh
npm install
cp .env.example .env.local     # add your NEBIUS_API_KEY; never commit this file
npm start                      # builds the UI and serves everything on http://localhost:8787
```

Open http://localhost:8787. No login is required; the demo data is synthetic. Without `NEBIUS_API_KEY` the UI and engine work and the copilot reports "not configured" (it does not fabricate answers).

Development with hot reload: `npm run server` in one terminal and `npm run dev` in another.

## Tests

```sh
npm test         # 11 tests: engine math, context redaction, provider request shape, validator, error sanitizing, routes
npm run build    # production UI build
npm run smoke    # ONE live call to Nebius with the synthetic data; writes evidence/REAL_CALL.json
```

`npm test` uses a **mock transport** for the provider; it checks our code, not Nebius. The live proof is `npm run smoke` and [evidence/REAL_CALL.json](evidence/REAL_CALL.json) (provider request ID, model, tokens, latency; no prompts or keys). See [docs/EVIDENCE.md](docs/EVIDENCE.md).

## Architecture

```
Browser -> /api/analyze -> request validation + per-IP/day limits
        -> cost engine (deterministic) -> evidence references E1..En
        -> Nebius Token Factory -> NVIDIA Nemotron (JSON schema)
        -> grounding validator -> UI (summary, risks, actions, expandable evidence)
```

Deploy: the same handler runs locally (`server/index.mjs`) and as a Vercel function (`api/[...route].mjs`); set `NEBIUS_API_KEY` as a server-side secret. The public demo is rate-limited (20 requests/hour per IP, 300/day overall; configurable) so an open endpoint cannot drain the key.

## Known limits

- Validation proves structure and grounding, not full semantic correctness; a human should review recommendations.
- In live runs the model's first answer is sometimes rejected by the validator and fixed on a repair attempt (see EVIDENCE.md).
- The audit log is in memory and the engine covers a deliberately small APU model (no taxes, financing or productivity databases). Prices in `data/demo.json` are fictional.

## License

MIT, see [LICENSE](LICENSE).
