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

This is a standalone public edition. The commercial ZOEMEC platform (separate, private) existed before the hackathon; its engines, UI, database and exports are **not part of this repository**. Built for the Submission Period and included here: the Nebius/Nemotron provider and response validator, the evidence-grounded context builder, a new public deterministic cost engine (`server/engine/costEngine.mjs`), the copilot UI, the demo data and tests. See [docs/SCOPE.md](docs/SCOPE.md).

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
