// Unit tests for the ResQ-Net AI chat context builder and payload formatting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../src/core.js';
import { buildAlerts } from '../src/alerts.js';
import { buildLinks, hospitalCounts, linkCounts } from '../src/mapkit.js';
import { buildSimulationContext, buildSuggestedQuestions, formatChatPayload } from '../src/chatContext.js';

const data = JSON.parse(readFileSync(new URL('../public/data/resqnet.json', import.meta.url)));
core.init(data);

const nodesById = new Map(data.graph.nodes.map((n) => [n.id, n]));
const depsOf = new Map(Object.entries(data.graph.deps));
const dependentsOf = new Map();
for (const [to, groups] of depsOf) {
  for (const g of groups) {
    for (const p of g.providers) {
      if (!dependentsOf.has(p)) dependentsOf.set(p, []);
      dependentsOf.get(p).push(to);
    }
  }
}
const defaults = Object.fromEntries(Object.entries(data.meta.params).map(([k, v]) => [k, v.value]));
const linkTally = linkCounts(buildLinks(nodesById, depsOf, hospitalCounts(nodesById, dependentsOf), defaults));

test('buildSimulationContext reports idle baseline accurately when no scenario is active', () => {
  const ctx = buildSimulationContext({
    page: 'cascade',
    user: { role: 'admin' },
    data,
    params: defaults,
    linkTally,
  });
  assert.equal(ctx.status, 'idle');
  assert.equal(ctx.activeScenario, null);
  assert.equal(ctx.metrics, null);
  assert.equal(ctx.cityBaseline.hospitals, data.meta.info.counts.hospital);
  assert.equal(ctx.cityBaseline.weakLinksPct, linkTally.weakPct);
  assert.equal(ctx.assumptions.hospitalDieselBackupHours, defaults.hospital_diesel_h);
});

test('buildSimulationContext summarizes an active Heavy rain simulation', () => {
  const result = core.simulate({
    scenario: 'orr_flood',
    failures: [{ id: 'feeder_cauvery_tk_halli', repair_h: 12, reason: 'rain damaged the power line' }],
  });
  const alerts = buildAlerts(result, nodesById, dependentsOf, depsOf, defaults);
  const nowMap = new Map();
  for (const ev of result.timeline) {
    if (ev.t > 4) break;
    nowMap.set(ev.id, ev);
  }
  const ctx = buildSimulationContext({
    page: 'cascade',
    user: { role: 'admin' },
    data,
    scenario: { label: 'Heavy rain night', note: 'Flooded ORR + TK Halli feeder' },
    result,
    shown: result,
    alerts,
    t: 4,
    horizon: 72,
    params: defaults,
    linkTally,
    nowMap,
    hospitalsNow: { down: 0, backup: 1080 },
  });
  assert.equal(ctx.status, 'running');
  assert.equal(ctx.activeScenario.label, 'Heavy rain night');
  assert.equal(ctx.activeScenario.currentHour, 4);
  assert.ok(ctx.metrics.resilienceIndex > 0 && ctx.metrics.resilienceIndex < 100);
  assert.equal(ctx.metrics.hospitalsOnBackupAtCurrentHour, 1080);
  assert.ok(ctx.alertsSummary.total > 0);
  assert.ok(ctx.topAffectedHospitals.length > 0);
  assert.ok(ctx.cauverySupplyChain['TK Halli']);
});

test('buildSuggestedQuestions adapts to simulation mode and page', () => {
  const idleQ = buildSuggestedQuestions({ page: 'cascade', mode: 'idle', activeScenario: null });
  assert.match(idleQ[0], /Heavy rain/);
  const activeQ = buildSuggestedQuestions({ page: 'cascade', mode: 'idle', activeScenario: { label: 'ORR flood' } });
  assert.match(activeQ[0], /hospitals fail first/);
  const weakQ = buildSuggestedQuestions({ page: 'cascade', mode: 'weak', weakestLinksTop5: [{ name: 'Sub' }] });
  assert.match(weakQ[0], /weakest link/);
  const citizenQ = buildSuggestedQuestions({ page: 'citizen' });
  assert.equal(citizenQ.length, 3);
});

test('formatChatPayload trims messages and filters invalid history items', () => {
  const p = formatChatPayload({
    message: '  Which hospitals fail?  ',
    history: [
      { role: 'user', content: 'Hi' },
      { role: 'system', content: 'Ignored' },
      { role: 'assistant', content: '   ' },
      { role: 'assistant', content: 'Hello operator' },
    ],
    context: { status: 'running' },
  });
  assert.equal(p.message, 'Which hospitals fail?');
  assert.deepEqual(p.history, [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello operator' },
  ]);
  assert.deepEqual(p.context, { status: 'running' });
});
