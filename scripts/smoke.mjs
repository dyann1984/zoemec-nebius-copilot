// Manual live check against Nebius Token Factory. NOT part of `npm test`. Sends only the synthetic demo data.
// Usage: npm run smoke   (needs NEBIUS_API_KEY in .env.local). Writes evidence/REAL_CALL.json (no prompts, no keys).
import { mkdir, writeFile } from 'node:fs/promises';
import { demo } from '../server/analysis.mjs';
import { buildContext } from '../server/context.mjs';
import { createNebiusProvider } from '../server/nebiusProvider.mjs';

const { context } = buildContext({ project: demo.project, apus: demo.apus });
const start = Date.now();
try {
  const result = await createNebiusProvider().analyzeProjectContext({ context, question: 'Summarize the main risks and priorities across all unit prices.' });
  const proof = { checkedAt: new Date().toISOString(), edition: 'standalone-hackathon', provider: result.provider, model: result.model,
    providerRequestId: result.providerRequestId, usage: result.usage, latencyMs: Date.now() - start, attempts: result.attempts,
    status: 'real_call_validated', evidenceRefs: result.evidenceRefs.map(r => r.id), summaryText: result.summary.text };
  await mkdir(new URL('../evidence/', import.meta.url), { recursive: true });
  await writeFile(new URL('../evidence/REAL_CALL.json', import.meta.url), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
} catch (error) {
  console.error(error.code || 'NEBIUS_CHECK_FAILED'); process.exitCode = 1;
}
