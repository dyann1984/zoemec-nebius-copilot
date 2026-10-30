// ZOEMEC Lite cost engine: a small, transparent, deterministic unit-price (APU) calculator.
// Every number the copilot explains comes from here, never from the language model.
// This is an independent public implementation; it is not the commercial ZOEMEC engine.

const round = (n, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function resourceCost(kind, r) {
  if (kind === 'materials') return num(r.consumption) * (1 + num(r.wastePct) / 100) * num(r.unitPrice);
  if (kind === 'labor') return num(r.yieldPerDay) > 0 ? (num(r.dailyWage) * num(r.burdenFactor || 1) * num(r.crewSize || 1)) / num(r.yieldPerDay) : 0;
  if (kind === 'equipment') return num(r.yieldPerHour) > 0 ? num(r.hourlyRate) / num(r.yieldPerHour) : 0;
  return 0;
}

export function calcApu(apu) {
  const kinds = ['materials', 'labor', 'equipment'];
  const lines = [];
  for (const kind of kinds) for (const r of apu[kind] || []) lines.push({ kind, id: r.id, description: r.description, unitCost: round(resourceCost(kind, r), 4) });
  const sums = Object.fromEntries(kinds.map(k => [k, lines.filter(l => l.kind === k).reduce((s, l) => s + l.unitCost, 0)]));
  const direct = sums.materials + sums.labor + sums.equipment;
  const f = apu.factors || {};
  const overhead = direct * num(f.overheadPct) / 100;
  const profit = (direct + overhead) * num(f.profitPct) / 100;
  const unitPrice = direct + overhead + profit;
  return {
    materialsCost: round(sums.materials), laborCost: round(sums.labor), equipmentCost: round(sums.equipment),
    directCost: round(direct), overhead: round(overhead), profit: round(profit),
    // The total is the rounded unit price times quantity, so the printed price and total always reconcile.
    unitPrice: round(unitPrice), quantity: num(apu.quantity), total: round(round(unitPrice) * num(apu.quantity)),
    lines
  };
}

const DAY = 86400000;
// Evidence readiness: share of resources whose price has a registered, VERIFIED and recent source.
export function evidenceReadiness(apu) {
  const base = Date.parse(apu.baseDate);
  const all = ['materials', 'labor', 'equipment'].flatMap(k => (apu[k] || []).map(r => ({ kind: k, r })));
  const findings = [];
  let good = 0;
  for (const { kind, r } of all) {
    const src = r.source || {};
    const problems = [];
    if (!src.supplier) problems.push('MISSING_SOURCE');
    else if (src.status !== 'VERIFIED') problems.push('UNVERIFIED_SOURCE');
    if (src.date && Number.isFinite(base) && base - Date.parse(src.date) > 180 * DAY) problems.push('STALE_PRICE');
    if (!problems.length) good++;
    else findings.push({ resourceId: r.id, kind, problems });
  }
  const score = all.length ? Math.round((good / all.length) * 100) : 0;
  return { resources: all.length, wellSupported: good, score, band: score >= 80 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW', findings };
}

// Cost concentration: share of unit direct cost per resource; flags any single resource above 50%.
export function concentration(apu, calc = calcApu(apu)) {
  const direct = calc.directCost || 1;
  const shares = calc.lines.map(l => ({ resourceId: l.id, description: l.description, kind: l.kind, sharePct: round((l.unitCost / direct) * 100, 1) }))
    .sort((a, b) => b.sharePct - a.sharePct);
  return { top: shares.slice(0, 3), dominantResource: shares[0]?.sharePct > 50 ? shares[0].resourceId : null };
}

// Exposure: total cost of the resources that lack a verified source (an upper bound on price risk, not a forecast).
export function unverifiedExposure(apu, readiness = evidenceReadiness(apu)) {
  const flagged = new Set(readiness.findings.map(f => f.resourceId));
  let amount = 0;
  for (const kind of ['materials', 'labor', 'equipment']) for (const r of apu[kind] || []) if (flagged.has(r.id)) amount += resourceCost(kind, r);
  const factor = 1 + num(apu.factors?.overheadPct) / 100;
  const profit = 1 + num(apu.factors?.profitPct) / 100;
  return { unitAmount: round(amount * factor * profit), totalAmount: round(amount * factor * profit * num(apu.quantity)) };
}

const SCENARIO_KINDS = { MATERIAL_PERCENT: 'materials', LABOR_PERCENT: 'labor', EQUIPMENT_PERCENT: 'equipment' };
export function runScenario(apu, { kind, value }) {
  const group = SCENARIO_KINDS[kind];
  if (!group || !Number.isFinite(value) || Math.abs(value) > 100) return null;
  const changed = structuredClone(apu);
  for (const r of changed[group] || []) {
    if (group === 'materials') r.unitPrice = num(r.unitPrice) * (1 + value / 100);
    else if (group === 'labor') r.dailyWage = num(r.dailyWage) * (1 + value / 100);
    else r.hourlyRate = num(r.hourlyRate) * (1 + value / 100);
  }
  const before = calcApu(apu); const after = calcApu(changed);
  return { kind, percent: value, unitPriceBefore: before.unitPrice, unitPriceAfter: after.unitPrice,
    unitPriceDelta: round(after.unitPrice - before.unitPrice), totalDelta: round(after.total - before.total) };
}

export function analyzeApu(apu) {
  const calculated = calcApu(apu);
  const readiness = evidenceReadiness(apu);
  return { calculated, readiness, concentration: concentration(apu, calculated), exposure: unverifiedExposure(apu, readiness) };
}
