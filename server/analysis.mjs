import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { aiError } from './errors.mjs';
import { buildContext, cleanText } from './context.mjs';
import { ANALYSES, createNebiusProvider, nebiusConfig } from './nebiusProvider.mjs';

export const demo = JSON.parse(readFileSync(new URL('../data/demo.json', import.meta.url), 'utf8'));

// In-memory audit trail (no prompts, no keys). Resets on restart; good enough for a demo, not for billing.
export const auditLog = [];

export function validateRequest(body) {
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > 5000) throw aiError('INVALID_REQUEST');
  if (Object.keys(body).some(k => !['apuId', 'question', 'analysis', 'scenario'].includes(k))) throw aiError('INVALID_REQUEST');
  if (!ANALYSES.includes(body.analysis)) throw aiError('INVALID_REQUEST');
  if (body.apuId != null && !demo.apus.some(a => a.id === body.apuId)) throw aiError('INVALID_REQUEST');
  if (typeof body.question !== 'string' || !body.question.trim() || body.question.length > 1000) throw aiError('INVALID_REQUEST');
  if (body.scenario && (!body.apuId || typeof body.scenario !== 'object' || Object.keys(body.scenario).some(k => !['kind', 'value'].includes(k)))) throw aiError('INVALID_SCENARIO');
  return { ...body, question: cleanText(body.question, 1000) };
}

export async function runAnalysis({ body, provider, env = process.env, consumeRateLimit = () => {} }) {
  const input = validateRequest(body);
  const apus = input.apuId ? demo.apus.filter(a => a.id === input.apuId) : demo.apus;
  const { context, indicators } = buildContext({ project: demo.project, apus, scenario: input.scenario });
  const config = nebiusConfig(env);
  if (!config.apiKey && !provider) throw aiError('NEBIUS_NOT_CONFIGURED', 503);
  consumeRateLimit();
  const requestId = randomUUID(); const started = Date.now();
  const record = { requestId, timestamp: new Date().toISOString(), analysis: input.analysis, provider: 'Nebius', model: config.model,
    contextHash: createHash('sha256').update(JSON.stringify(context)).digest('hex'), status: 'started' };
  auditLog.unshift(record); auditLog.length = Math.min(auditLog.length, 100);
  try {
    const answer = await (provider || createNebiusProvider({ env }))[input.analysis]({ context, question: input.question });
    Object.assign(record, { status: 'success', latencyMs: Date.now() - started, providerRequestId: answer.providerRequestId, usage: answer.usage });
    return { ok: true, answer, requestId, indicators, missingData: context.missingData, project: context.project, contextHash: record.contextHash };
  } catch (error) {
    Object.assign(record, { status: 'error', errorCode: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'INTERNAL_ERROR', latencyMs: Date.now() - started });
    throw error;
  }
}
