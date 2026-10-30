import { aiError } from './errors.mjs';
import { analyzeApu, runScenario } from './engine/costEngine.mjs';

export function cleanText(value, max = 400) {
  return String(value ?? '').replace(/https?:\/\/\S+/gi, '[link omitted]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email omitted]')
    .replace(/(?:Bearer\s+|sk-)[\w.-]+/gi, '[secret omitted]').slice(0, max);
}
// Leaves become immutable evidence values. The model selects references; it never writes FACT values.
function flatten(value, path, add, depth = 0) {
  if (depth > 7 || value === undefined) return;
  if (value === null || ['number', 'boolean', 'string'].includes(typeof value)) { add(path, typeof value === 'string' ? cleanText(value) : value); return; }
  if (Array.isArray(value)) value.slice(0, 80).forEach((v, i) => flatten(v, `${path}.${i}`, add, depth + 1));
  else Object.entries(value).forEach(([k, v]) => { if (!/email|owner|user|token|secret|url/i.test(k)) flatten(v, `${path}.${k}`, add, depth + 1); });
}

export function buildContext({ project, apus, scenario }) {
  if (!Array.isArray(apus) || apus.length > 20) throw aiError('CONTEXT_LIMIT', 413);
  const refs = [];
  const add = (path, value) => { if (refs.length >= 3500) throw aiError('CONTEXT_LIMIT', 413); refs.push({ id: `E${refs.length + 1}`, path, value }); };
  const indicators = [];
  add('project.name', cleanText(project.name));
  const missingData = ['Price sources are registered declarations; their external authenticity is not verified.',
    'Only the saved project data is analyzed; files and drawings are not sent.'];
  for (const apu of apus) {
    const prefix = `apu.${apu.id}`;
    const engine = analyzeApu(apu);
    indicators.push({ apuId: apu.id, concept: cleanText(apu.concept), unitPrice: engine.calculated.unitPrice, total: engine.calculated.total,
      evidenceScore: engine.readiness.score, band: engine.readiness.band, unverifiedExposure: engine.exposure.totalAmount });
    add(`${prefix}.concept`, cleanText(apu.concept));
    add(`${prefix}.unit`, cleanText(apu.unit));
    add(`${prefix}.quantity`, apu.quantity ?? null);
    flatten({ ...engine.calculated, lines: undefined }, `${prefix}.calculated`, add);
    flatten(engine.readiness, `${prefix}.engines.evidenceReadiness`, add);
    flatten(engine.concentration, `${prefix}.engines.concentration`, add);
    flatten(engine.exposure, `${prefix}.engines.unverifiedExposure`, add);
    for (const kind of ['materials', 'labor', 'equipment']) {
      (apu[kind] || []).forEach((row, i) => {
        const selected = {};
        for (const key of ['description', 'unit', 'consumption', 'unitPrice', 'dailyWage', 'hourlyRate', 'yieldPerDay', 'yieldPerHour']) if (row[key] !== undefined) selected[key] = row[key];
        selected.source = Object.fromEntries(['supplier', 'date', 'status'].filter(k => row.source?.[k] !== undefined).map(k => [k, row.source[k]]));
        flatten(selected, `${prefix}.resource.${kind}.${i}`, add);
      });
    }
    if (scenario) {
      if (apus.length !== 1) throw aiError('SCENARIO_REQUIRES_APU');
      const result = runScenario(apu, scenario);
      if (!result) throw aiError('INVALID_SCENARIO');
      flatten(result, `${prefix}.scenario`, add);
    }
  }
  if (!apus.length) missingData.push('ZOEMEC does not have enough evidence to answer with confidence. There are no saved unit prices.');
  const context = { project: { name: cleanText(project.name), demo: true }, refs, missingData };
  if (JSON.stringify(context).length > 130000) throw aiError('CONTEXT_LIMIT', 413);
  return { context, indicators };
}
