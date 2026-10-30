import { demo, runAnalysis } from './analysis.mjs';
import { analyzeApu } from './engine/costEngine.mjs';
import { nebiusConfig } from './nebiusProvider.mjs';
import { aiError } from './errors.mjs';

const MESSAGES = {
  NEBIUS_NOT_CONFIGURED: 'Nebius is not configured on this server. The operator must set NEBIUS_API_KEY.',
  NEBIUS_CONFIG_ERROR: 'The Nebius configuration needs operator review.',
  INVALID_MODEL_OUTPUT: 'The model answer did not pass evidence validation. Try rephrasing the question.',
  NEBIUS_API_ERROR: 'Nebius could not complete the analysis. Try again.',
  NEBIUS_TIMEOUT: 'Nebius took too long. Try again.',
  NEBIUS_RATE_LIMIT: 'Nebius rate limit reached. Try again later.',
  RATE_LIMITED: 'Demo request limit reached. Try again later.',
  CONTEXT_LIMIT: 'The project exceeds the context limit.',
  INVALID_REQUEST: 'Check the question and selection.', INVALID_SCENARIO: 'Check the scenario parameters.'
};

// Public demo guard: small per-IP window plus a global daily cap, so an open endpoint cannot drain the server key.
const hits = new Map(); let day = { key: '', count: 0 };
export function makeLimiter({ perHour = Number(process.env.DEMO_REQUESTS_PER_HOUR || 20), perDay = Number(process.env.DEMO_REQUESTS_PER_DAY || 300) } = {}) {
  return ip => () => {
    const now = Date.now(); const key = new Date(now).toISOString().slice(0, 10);
    if (day.key !== key) day = { key, count: 0 };
    const recent = (hits.get(ip) || []).filter(t => now - t < 3600000);
    if (recent.length >= perHour || day.count >= perDay) throw aiError('RATE_LIMITED', 429);
    recent.push(now); hits.set(ip, recent); day.count++;
  };
}
const limiter = makeLimiter();

export async function route({ method, path, body, ip = 'local', provider, env = process.env }) {
  try {
    if (method === 'GET' && path === '/api/demo') {
      return { status: 200, body: { project: demo.project, apus: demo.apus.map(a => ({ ...a, analysis: analyzeApu(a) })) } };
    }
    if (method === 'GET' && path === '/api/status') {
      const config = nebiusConfig(env);
      return { status: 200, body: { provider: 'Nebius Token Factory', model: config.model, configured: !!config.apiKey } };
    }
    if (method === 'POST' && path === '/api/analyze') {
      return { status: 200, body: await runAnalysis({ body, provider, env, consumeRateLimit: limiter(ip) }) };
    }
    return { status: 404, body: { ok: false, error: 'Not found.' } };
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    const code = MESSAGES[error.code] ? error.code : 'INTERNAL_ERROR';
    return { status, body: { ok: false, code, error: MESSAGES[code] || 'The analysis could not be completed. Try again.' } };
  }
}
