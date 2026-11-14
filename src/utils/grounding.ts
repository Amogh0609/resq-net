// Pure schema-safe Firestore and Cloud SQL payload helpers.

export function sanitizeDocId(raw: string, maxLen = 64): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const trimmed = cleaned.slice(0, Math.max(1, maxLen));
  return trimmed || 'item';
}

export function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function clampString(val: unknown, fallback: string, maxLen: number): string {
  const s = String(val ?? '').trim();
  if (!s) return fallback.slice(0, maxLen);
  return s.slice(0, maxLen);
}

export function buildFirestoreRunPayload(input: {
  runId: string;
  ownerId: string;
  profile: string;
  baseCapacityMW?: number;
  fairnessWeight?: number;
  negotiatedDamage: number;
  uncoordinatedDamage?: number;
  jainsFairness?: number;
  status?: 'active' | 'archived';
}) {
  const negotiatedDamage = Math.max(0, Number.isFinite(Number(input.negotiatedDamage)) ? Number(input.negotiatedDamage) : 0);
  const rawUncoord = Number(input.uncoordinatedDamage);
  const uncoordinatedDamage = Math.max(0, Number.isFinite(rawUncoord) ? rawUncoord : negotiatedDamage);
  return {
    runId: sanitizeDocId(input.runId, 64),
    ownerId: sanitizeDocId(input.ownerId, 128),
    profile: clampString(input.profile, 'Heavy rain night', 48),
    baseCapacityMW: clampNum(input.baseCapacityMW, 10, 5000, 120),
    fairnessWeight: clampNum(input.fairnessWeight, 0, 1, 0.5),
    negotiatedDamage: Math.round(negotiatedDamage * 100) / 100,
    uncoordinatedDamage: Math.round(uncoordinatedDamage * 100) / 100,
    jainsFairness: clampNum(input.jainsFairness, 0, 1, 0.85),
    status: input.status === 'archived' ? ('archived' as const) : ('active' as const),
  };
}

export function buildEscalationPayloads(input: {
  escalationId: string;
  authorId: string;
  category: string;
  areaName: string;
  severity?: string;
  summary: string;
  lat: number;
  lon: number;
}) {
  const allowedSeverity = new Set(['low', 'medium', 'high', 'critical']);
  const sev = allowedSeverity.has(String(input.severity || '').toLowerCase())
    ? String(input.severity).toLowerCase()
    : 'high';
  const category = clampString(input.category, 'infrastructure', 48);
  const areaName = clampString(input.areaName, 'Bengaluru', 64);
  const summary = clampString(input.summary, 'Citizen field report', 500);
  const lat = clampNum(input.lat, -90, 90, 12.9716);
  const lon = clampNum(input.lon, -180, 180, 77.5946);

  return {
    firestore: {
      escalationId: sanitizeDocId(input.escalationId, 64),
      authorId: sanitizeDocId(input.authorId, 128),
      category,
      areaName,
      severity: sev as 'low' | 'medium' | 'high' | 'critical',
      summary,
      lat,
      lon,
      status: 'open' as const,
    },
    sql: {
      category,
      areaName,
      severity: sev,
      summary,
      lat,
      lon,
    },
  };
}
