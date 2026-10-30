# Scope of this public edition

Public (MIT) and included here: Nebius/NVIDIA provider and validator, context builder, a small original cost engine, demo UI, synthetic data, tests, deployment adapter.

Kept private and not included: the commercial ZOEMEC web application, its APU/Confidence/Bid Risk/Scenario engines, Firebase authentication and multi-tenant data model, CAD/takeoff, price library and market intelligence, PDF/Excel deliverable generators, client and project data, brand assets, and production configuration.

The live hackathon demo is the private commercial product's Judge Mode (https://zoemecia.com/?demo=1) with a new stage 11 that calls the same Nebius/Nemotron integration against the commercial engines. See [JUDGE_MODE_INTEGRATION.md](JUDGE_MODE_INTEGRATION.md) for exactly what is shared and what is not.

The public engine is an independent implementation written for this edition. It shares the *idea* of an evidence-readiness score and a scenario what-if with the commercial product but none of its code, formulas or data.
