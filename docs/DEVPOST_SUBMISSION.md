# Devpost submission text (ready to paste)

## Field values
- **Track:** Best Apps and Agents
- **Working demo URL:** https://zoemecia.com/?demo=1 (no login; open "NVIDIA Copilot", stage 11, or press "Analyze with NVIDIA" in the welcome dialog)
- **Code repository:** https://github.com/dyann1984/zoemec-nebius-copilot (MIT)
- **Backup demo (standalone open-source app):** https://zoemec-nebius-copilot.vercel.app
- **Video:** (add the public YouTube link, under 3 minutes)

## Project description

**ZOEMEC: a construction cost copilot that can show its evidence.**

Construction estimators price work with unit price analyses (APUs): materials, labor, equipment, overheads and profit. The arithmetic is rarely the problem; the risk is bidding on prices that have no verifiable, recent source. Generic chatbots are a bad fit here: they invent numbers and cannot be audited.

**What we built for the hackathon.** We added an *Engineering Copilot* powered by **NVIDIA Nemotron (`nvidia/nemotron-3-super-120b-a12b`) served through Nebius Token Factory**. ZOEMEC's deterministic engines (cost, Confidence, Bid Risk, audit, Challenge, scenario what-if) compute every number. The model is only allowed to *explain*: the server turns engine results into numbered evidence references, the model answers in a strict JSON schema, and a validator rejects any answer that contains figures, links, HTML, standards or references that do not exist. Failed answers are retried and then refused; there is no fallback model and no canned text. The user sees the summary, inferences, risks and recommended actions with expandable evidence whose values come from the engines, plus the provider request ID, token count and latency.

**How to try it.** Open https://zoemecia.com/?demo=1, no account needed. The welcome dialog has an "Analyze with NVIDIA" button that jumps to stage 11, the new NVIDIA Nemotron Engineering Copilot. Pick one of four synthetic unit prices, press "Explain Confidence", "Explain Bid Risk" or "What should I fix?", ask your own question, or add a what-if material price change that the scenario engine computes and the model explains. The page shows that the server and your browser compute the same Confidence score.

**How we use Nebius and NVIDIA.** Every analysis is a live call to `https://api.tokenfactory.nebius.com/v1/chat/completions` with Nemotron and JSON-schema structured output. Token Factory gave us a single OpenAI-compatible endpoint for an open NVIDIA model, so we could put our effort into grounding and validation instead of infrastructure.

**What existed before vs. what is new.**
- *Before the hackathon (commercial product, not claimed as hackathon work):* the ZOEMEC platform (React/Vite, Firebase, APU generation and calculation, Confidence, Bid Risk, audit, Challenge, scenarios, CAD takeoff, schedules, PDF/Excel deliverables) and the 10-stage public Judge Mode walkthrough.
- *Built during the hackathon:* the Nebius/Nemotron provider with strict schema and grounding validator; the evidence-reference context builder; the public-endpoint protections (per-IP/hour and daily quotas charged before the model call, fail-closed, plus an edge rate limit); Judge Mode stage 11 with the welcome callout and an extra tour step in English and Spanish; real-call evidence and tests; and a standalone open-source copilot app.

**Open source.** The repository contains the Nebius/Nemotron integration, the grounding validator, a small original cost engine, synthetic data, tests and evidence of real calls. ZOEMEC's commercial engines and UI stay private, so the live Judge Mode demo cannot be rebuilt from the repository alone; `docs/JUDGE_MODE_INTEGRATION.md` states exactly what is shared and what differs.

**Limits.** Validation proves structure and grounding, not semantic correctness, so a human should review recommendations. Occasionally the model's first answer is rejected and a retry is needed. The public demo is rate limited to protect credits.

## Feedback on Nebius Token Factory and NVIDIA tools (draft)
- Strict `json_schema` output with Nemotron worked well once the schema forbade free-form numbers; a rejected first answer happened on roughly one in three first attempts in our runs.
- Latency for large evidence contexts is 10 to 30 seconds with about 15,000 to 22,000 prompt tokens; a streaming option for structured output would improve perceived speed.
- A usage/credit dashboard exposed through the API would help public demos enforce budgets.

## Video script (target 2:30)
1. (0:00 to 0:20) Open https://zoemecia.com/?demo=1. Say: "ZOEMEC prices construction work and tells you how much to trust the price. New for this hackathon: an NVIDIA Nemotron copilot on Nebius Token Factory."
2. (0:20 to 0:50) Click "Analyze with NVIDIA". Show the engine numbers (Confidence, Bid Risk, audit) computed in the browser. Say these come from the deterministic engines, not the AI.
3. (0:50 to 1:40) Press "Explain Bid Risk" (live call, show the loading state). Show the summary, risks and actions, click a reference and open the evidence table to show values set by the engines. Show the request ID, model name and token count.
4. (1:40 to 2:10) Ask a free question; add a +8% material scenario and run again; point out the "server and browser compute the same Confidence" line.
5. (2:10 to 2:30) Show the GitHub repository (MIT license in the About box), README and the evidence file. Close with the limits and the rate-limit note.
Do not show any credentials, the Vercel dashboard or internal data. No music.
