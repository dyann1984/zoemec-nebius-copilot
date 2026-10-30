import React, { useEffect, useState } from 'react';

const money = (n, c) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c || 'MXN' }).format(n);
const ACTIONS = [
  ['explainConfidence', 'Explain evidence readiness', 'Why is the evidence readiness score what it is?'],
  ['explainRisk', 'Explain price risk', 'Which price risks should I understand before bidding?'],
  ['suggestReviewActions', 'What should I fix?', 'What should be reviewed or corrected first?'],
  ['analyzeProjectContext', 'Analyze whole project', 'Summarize the main risks and priorities across all unit prices.']
];

function Statement({ s, refs }) {
  return (
    <li>{s.text} <span className="refs">{s.evidenceRefs.map(id => refs.has(id) ? <code key={id} title={`${refs.get(id).path} = ${refs.get(id).value}`}>{id}</code> : null)}</span></li>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [apuId, setApuId] = useState('');
  const [question, setQuestion] = useState('What should I review before presenting this bid?');
  const [scenario, setScenario] = useState({ on: false, kind: 'MATERIAL_PERCENT', value: 8 });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/demo').then(r => r.json()).then(d => { setData(d); setApuId(d.apus[0].id); }).catch(() => setError('Could not load the demo data.'));
    fetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  async function ask(analysis, q) {
    setBusy(true); setError(''); setResult(null);
    const body = { analysis, question: q || question, apuId: analysis === 'analyzeProjectContext' ? undefined : apuId };
    if (scenario.on && body.apuId) body.scenario = { kind: scenario.kind, value: Number(scenario.value) };
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Analysis failed.');
      setResult(j);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!data) return <main><p>{error || 'Loading…'}</p></main>;
  const apu = data.apus.find(a => a.id === apuId);
  const refs = result ? new Map(result.answer.evidenceRefs.map(r => [r.id, r])) : new Map();

  return (
    <main>
      <header>
        <h1>ZOEMEC Cost Copilot</h1>
        <p className="sub">Deterministic unit-price engine + evidence-grounded explanations from NVIDIA Nemotron on Nebius Token Factory.</p>
        <p className="badge" role="status">
          {status ? (status.configured ? `Model: ${status.model}` : 'Nebius is not configured on this server (analysis disabled)') : '…'}
        </p>
        <p className="note">{data.project.name} — {data.project.note}</p>
      </header>

      <section aria-label="Unit prices">
        <label>Unit price (APU){' '}
          <select value={apuId} onChange={e => { setApuId(e.target.value); setResult(null); }}>
            {data.apus.map(a => <option key={a.id} value={a.id}>{a.concept}</option>)}
          </select>
        </label>
        <div className="cards">
          <div className="card"><span>Unit price</span><strong>{money(apu.analysis.calculated.unitPrice, data.project.currency)} / {apu.unit}</strong></div>
          <div className="card"><span>Total ({apu.quantity} {apu.unit})</span><strong>{money(apu.analysis.calculated.total, data.project.currency)}</strong></div>
          <div className="card"><span>Evidence readiness</span><strong>{apu.analysis.readiness.score}/100 ({apu.analysis.readiness.band})</strong></div>
          <div className="card"><span>Unverified exposure</span><strong>{money(apu.analysis.exposure.totalAmount, data.project.currency)}</strong></div>
        </div>
        <table>
          <caption>Cost lines (computed by the engine, not by the model)</caption>
          <thead><tr><th>Resource</th><th>Type</th><th>Unit cost</th></tr></thead>
          <tbody>{apu.analysis.calculated.lines.map(l => <tr key={l.kind + l.id}><td>{l.description}</td><td>{l.kind}</td><td>{money(l.unitCost, data.project.currency)}</td></tr>)}</tbody>
        </table>
      </section>

      <section aria-label="Copilot">
        <h2>Ask the copilot</h2>
        <div className="actions">
          {ACTIONS.map(([k, label, q]) => <button key={k} disabled={busy} onClick={() => ask(k, q)}>{label}</button>)}
        </div>
        <form onSubmit={e => { e.preventDefault(); ask('answerEngineeringQuestion'); }}>
          <label>Free question <input value={question} maxLength={1000} onChange={e => setQuestion(e.target.value)} /></label>
          <button disabled={busy || !question.trim()}>Ask</button>
        </form>
        <details>
          <summary>What-if scenario (computed deterministically, explained by the model)</summary>
          <label><input type="checkbox" checked={scenario.on} onChange={e => setScenario({ ...scenario, on: e.target.checked })} /> Include scenario</label>{' '}
          <select value={scenario.kind} onChange={e => setScenario({ ...scenario, kind: e.target.value })}>
            <option value="MATERIAL_PERCENT">Materials %</option><option value="LABOR_PERCENT">Labor %</option><option value="EQUIPMENT_PERCENT">Equipment %</option>
          </select>{' '}
          <input type="number" min="-100" max="100" value={scenario.value} onChange={e => setScenario({ ...scenario, value: e.target.value })} aria-label="Percent change" />
        </details>
        {busy && <p role="status">Calling Nemotron on Nebius…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {result && (
          <article>
            <h3>Summary <small>(inference, explanation confidence: {result.answer.confidence})</small></h3>
            <ul><Statement s={result.answer.summary} refs={refs} /></ul>
            {['inferences', 'risks', 'recommendedActions'].map(k => result.answer[k].length > 0 && (
              <div key={k}><h3>{{ inferences: 'Inferences', risks: 'Risks', recommendedActions: 'Recommended actions' }[k]}</h3>
                <ul>{result.answer[k].map((s, i) => <Statement key={i} s={s} refs={refs} />)}</ul></div>
            ))}
            {result.answer.missingData.length > 0 && <div><h3>Missing data</h3><ul>{result.answer.missingData.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
            <details>
              <summary>Evidence ({result.answer.evidenceRefs.length} references, values set by the engine)</summary>
              <table><tbody>{result.answer.evidenceRefs.map(r => <tr key={r.id}><td><code>{r.id}</code></td><td>{r.path}</td><td>{String(r.value)}</td></tr>)}</tbody></table>
            </details>
            <p className="meta">Provider {result.answer.provider} · model {result.answer.model} · request {result.answer.providerRequestId || 'n/a'} · tokens {result.answer.usage?.total_tokens ?? 'n/a'}</p>
          </article>
        )}
      </section>
    </main>
  );
}
