import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  base64ToInt16,
  buildLiveWsUrl,
  calculateNextPlayTime,
  float32ToInt16Base64,
  int16ToFloat32,
} from '../src/utils/liveAudio.ts';
import {
  buildEscalationPayloads,
  buildFirestoreRunPayload,
  sanitizeDocId,
} from '../src/utils/grounding.ts';
import {
  normalizeLang,
  tr,
  trAdvice,
  trBand,
  trCategory,
  trHazard,
} from '../src/i18n.ts';

test('liveAudio converts Float32 <-> Int16 base64 cleanly without clipping overflow', () => {
  const samples = new Float32Array([-1.5, -0.5, 0, 0.5, 1.5]);
  const b64 = float32ToInt16Base64(samples);
  const pcm16 = base64ToInt16(b64);
  assert.equal(pcm16.length, samples.length);
  assert.equal(pcm16[0], -32768);
  assert.equal(pcm16[2], 0);
  assert.equal(pcm16[4], 32767);

  const restored = int16ToFloat32(pcm16);
  assert.ok(Math.abs(restored[1] - -0.5) < 0.001);
  assert.ok(Math.abs(restored[3] - 0.5) < 0.001);
});

test('calculateNextPlayTime schedules gapless sequential audio buffers', () => {
  const first = calculateNextPlayTime(10.0, 0, 0.25);
  assert.ok(first.startTime >= 10.015);
  assert.ok(Math.abs(first.nextStartTime - (first.startTime + 0.25)) < 1e-6);

  const second = calculateNextPlayTime(10.05, first.nextStartTime, 0.5);
  assert.equal(second.startTime, first.nextStartTime);
  assert.ok(Math.abs(second.nextStartTime - (first.nextStartTime + 0.5)) < 1e-6);
});

test('buildLiveWsUrl chooses wss on https and ws on http', () => {
  assert.equal(buildLiveWsUrl({ protocol: 'https:', host: 'example.run.app' }), 'wss://example.run.app/live');
  assert.equal(buildLiveWsUrl({ protocol: 'http:', host: 'localhost:3000' }), 'ws://localhost:3000/live');
});

test('Firestore/SQL payload builders sanitize IDs and enforce bounds matching firestore.rules', () => {
  assert.equal(sanitizeDocId('run!@# 2026/01'), 'run_2026_01');
  const run = buildFirestoreRunPayload({
    runId: 'run $ 1',
    ownerId: 'user:abc',
    profile: 'X'.repeat(80),
    baseCapacityMW: 99999,
    fairnessWeight: 3,
    negotiatedDamage: -5,
    uncoordinatedDamage: 42.125,
    jainsFairness: -0.2,
  });
  assert.match(run.runId, /^[a-zA-Z0-9_-]+$/);
  assert.equal(run.profile.length, 48);
  assert.equal(run.baseCapacityMW, 5000);
  assert.equal(run.fairnessWeight, 1);
  assert.equal(run.negotiatedDamage, 0);
  assert.equal(run.jainsFairness, 0);
  assert.equal(run.status, 'active');

  const esc = buildEscalationPayloads({
    escalationId: 'esc/1',
    authorId: 'uid/1',
    category: 'power',
    areaName: 'Koramangala',
    severity: 'INVALID_SEV',
    summary: 'Feeder outage near hospital',
    lat: 120,
    lon: -220,
  });
  assert.equal(esc.firestore.severity, 'high');
  assert.equal(esc.firestore.lat, 90);
  assert.equal(esc.firestore.lon, -180);
  assert.equal(esc.firestore.status, 'open');
});

test('i18n normalizes language codes and translates UI strings, categories, bands, hazards, and advice for Kannada and Hindi', () => {
  assert.equal(normalizeLang('kn'), 'kn-IN');
  assert.equal(normalizeLang('kn-IN'), 'kn-IN');
  assert.equal(normalizeLang('hi'), 'hi-IN');
  assert.equal(normalizeLang('hi-IN'), 'hi-IN');
  assert.equal(normalizeLang('unknown'), 'en-IN');

  const knScript = /[\u0C80-\u0CFF]/;
  assert.match(tr('kn-IN', 'tab.alerts'), knScript);
  assert.match(trCategory('kn-IN', 'flood', ''), knScript);
  assert.match(trBand('kn-IN', 'critical', ''), knScript);
  assert.match(trHazard('kn-IN', 'high', ''), knScript);
  assert.match(trAdvice('kn-IN', 'pothole', ''), knScript);

  const hiScript = /[\u0900-\u097F]/;
  assert.match(tr('hi-IN', 'tab.alerts'), hiScript);
  assert.match(trCategory('hi-IN', 'flood', ''), hiScript);
  assert.match(trBand('hi-IN', 'critical', ''), hiScript);
  assert.match(trHazard('hi-IN', 'high', ''), hiScript);
  assert.match(trAdvice('hi-IN', 'pothole', ''), hiScript);

  assert.equal(tr('en-IN', 'alerts.manyAlertsCity', { n: 4 }), '4 alerts across the city');
  assert.ok(tr('kn-IN', 'alerts.manyAlertsCity', { n: 4 }).includes('4'));
  assert.ok(tr('hi-IN', 'alerts.manyAlertsCity', { n: 4 }).includes('4'));
});
