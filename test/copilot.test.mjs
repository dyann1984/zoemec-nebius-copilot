// NOTE: these tests use a MOCK transport (fetchImpl). They verify request shape, validation and guards.
// They are not evidence of a real Nebius call; see evidence/REAL_CALL.json and `npm run smoke` for that.
import test from 'node:test';
import assert from 'node:assert/strict';
import { demo, runAnalysis, validateRequest } from '../server/analysis.mjs';
import { buildContext } from '../server/context.mjs';
import { calcApu, evidenceReadiness, runScenario, unverifiedExposure } from '../server/engine/costEngine.mjs';
import { createNebiusProvider, validateEngineeringResponse, nebiusConfig, DEFAULT_MODEL } from '../server/nebiusProvider.mjs';
import { route } from '../server/handler.mjs';

const rebar = demo.apus[0];
const env = { NEBIUS_API_KEY: 'test-only-secret' };
const answer = () => ({ summary: { text: 'Price evidence needs review.', evidenceRefs: ['E1'] }, confidence: 'low', facts: ['E1'],
  inferences: [], risks: [{ text: 'Some prices may be outdated.', evidenceRefs: ['E1'] }],
  recommendedActions: [{ text: 'Verify the registered sources.', evidenceRefs: ['E1'] }], missingData: ['Verified quotes are missing.'] });
const completion = raw => ({ id: 'chatcmpl-test', model: DEFAULT_MODEL, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }], usage: { total_tokens: 7 } });

test('engine: rebar unit price matches hand calculation', () => {
  // materials: 1.05*1.03*24 + 0.03*38 = 25.956 + 1.14 ; labor: 650*1.4*1/90 ; overhead 12% ; profit 10% of (direct+overhead)
  const direct = 1.05 * 1.03 * 24 + 0.03 * 38 + (650 * 1.4) / 90;
  const expected = direct * 1.12 * 1.10;
  assert.ok(Math.abs(calcApu(rebar).unitPrice - expected) < 0.02);
  assert.equal(calcApu(rebar).total, Math.round(calcApu(rebar).unitPrice * 800 * 100) / 100);
  assert.equal(calcApu(rebar).quantity, 800);
});
test('engine: evidence readiness flags missing, unverified and stale sources', () => {
  const r = evidenceReadiness(rebar);
  const byId = Object.fromEntries(r.findings.map(f => [f.resourceId, f.problems]));
  assert.deepEqual(byId.M1, ['UNVERIFIED_SOURCE', 'STALE_PRICE']);
  assert.deepEqual(byId.M2, ['MISSING_SOURCE']);
  assert.equal(r.score, 33);
  assert.ok(unverifiedExposure(rebar, r).totalAmount > 0);
});
test('engine: scenario is deterministic and rejects invalid input', () => {
  const s = runScenario(rebar, { kind: 'MATERIAL_PERCENT', value: 8 });
  assert.ok(s.unitPriceDelta > 0 && s.totalDelta > 0);
  assert.equal(runScenario(rebar, { kind: 'MATERIAL_PERCENT', value: 500 }), null);
  assert.equal(runScenario(rebar, { kind: 'HACK', value: 1 }), null);
});
test('context: builds evidence refs, strips private-looking fields, does not mutate demo data', () => {
  const before = JSON.stringify(demo);
  const apu = structuredClone(rebar); apu.ownerEmail = 'x@y.test'; apu.materials[0].description = 'Steel see https://evil.test mail a@b.co';
  const { context } = buildContext({ project: demo.project, apus: [apu] });
  const text = JSON.stringify(context);
  assert.ok(!text.includes('x@y.test') && !text.includes('evil.test') && !text.includes('a@b.co'));
  assert.ok(context.refs.some(r => r.path.includes('engines.evidenceReadiness')));
  assert.equal(JSON.stringify(demo), before);
});
test('provider: documented endpoint, server key, json_schema, model; key never in body', async () => {
  const { context } = buildContext({ project: demo.project, apus: [rebar] });
  let called = 0;
  const provider = createNebiusProvider({ env, fetchImpl: async (url, options) => {
    called++;
    assert.equal(url, 'https://api.tokenfactory.nebius.com/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-only-secret');
    const sent = JSON.parse(options.body);
    assert.equal(sent.model, DEFAULT_MODEL); assert.equal(sent.response_format.type, 'json_schema');
    assert.ok(!options.body.includes('test-only-secret'));
    return new Response(JSON.stringify(completion(answer())));
  } });
  const result = await provider.explainRisk({ context, question: 'Explain' });
  assert.equal(called, 1); assert.equal(result.model, DEFAULT_MODEL); assert.equal(result.evidenceRefs[0].id, 'E1');
});
test('provider: no key means no network call; unofficial host or non-NVIDIA model rejected', async () => {
  await assert.rejects(createNebiusProvider({ env: {}, fetchImpl: () => assert.fail('no network') }).explainRisk({}), { code: 'NEBIUS_NOT_CONFIGURED' });
  assert.throws(() => nebiusConfig({ ...env, NEBIUS_BASE_URL: 'https://evil.test/v1' }), { code: 'NEBIUS_CONFIG_ERROR' });
  assert.throws(() => nebiusConfig({ ...env, NEBIUS_MODEL: 'other/model' }), { code: 'NEBIUS_CONFIG_ERROR' });
});
test('provider: HTTP errors are sanitized; bad model output is rejected after repair attempts', async () => {
  const { context } = buildContext({ project: demo.project, apus: [rebar] });
  for (const status of [401, 429, 500]) {
    const p = createNebiusProvider({ env, fetchImpl: async () => new Response('secret prompt echo', { status }) });
    await assert.rejects(p.explainRisk({ context }), e => !e.message.includes('secret') && e.code.startsWith('NEBIUS_'));
  }
  let calls = 0;
  const bad = createNebiusProvider({ env, fetchImpl: async () => { calls++; return new Response(JSON.stringify(completion({ nope: true }))); } });
  await assert.rejects(bad.explainRisk({ context }), { code: 'INVALID_MODEL_OUTPUT' });
  assert.equal(calls, 3);
});
test('validator rejects invented evidence, digits, HTML, standards and extra keys', () => {
  const { context } = buildContext({ project: demo.project, apus: [rebar] });
  for (const mutate of [r => r.facts.push('E99999'), r => { r.summary.text = 'It costs 400 pesos'; }, r => { r.summary.text = '<script>x</script>'; },
    r => { r.summary.text = 'Complies with ISO certified'; }, r => { r.summary.evidenceRefs = []; }, r => { r.extra = true; }]) {
    const raw = answer(); mutate(raw);
    assert.throws(() => validateEngineeringResponse(raw, context), { code: 'INVALID_MODEL_OUTPUT' });
  }
});
test('request validation rejects unknown keys, unknown APU and oversized input', () => {
  assert.throws(() => validateRequest({ analysis: 'explainRisk', question: 'x', projectId: 'other' }), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateRequest({ analysis: 'explainRisk', question: 'x', apuId: 'nope' }), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateRequest({ analysis: 'explainRisk', question: 'x'.repeat(1001) }), { code: 'INVALID_REQUEST' });
  assert.throws(() => validateRequest({ analysis: 'explainRisk', question: 'x', scenario: { kind: 'MATERIAL_PERCENT', value: 1 } }), { code: 'INVALID_SCENARIO' });
});
test('runAnalysis with injected provider returns indicators computed by the engine', async () => {
  const provider = { explainConfidence: async ({ context }) => validateEngineeringResponse(answer(), context) };
  const out = await runAnalysis({ body: { analysis: 'explainConfidence', question: 'why', apuId: 'apu-rebar' }, provider, env: {} });
  assert.equal(out.indicators[0].evidenceScore, 33);
});
test('HTTP routes: demo needs no auth; analyze without key reports not configured (no fake answer)', async () => {
  const demoRes = await route({ method: 'GET', path: '/api/demo', env: {} });
  assert.equal(demoRes.status, 200); assert.equal(demoRes.body.apus.length, 2);
  const res = await route({ method: 'POST', path: '/api/analyze', body: { analysis: 'explainRisk', question: 'x', apuId: 'apu-rebar' }, env: {}, ip: 't1' });
  assert.equal(res.status, 503); assert.equal(res.body.code, 'NEBIUS_NOT_CONFIGURED'); assert.equal(res.body.answer, undefined);
});
