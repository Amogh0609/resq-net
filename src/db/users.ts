import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  chatMessages,
  fieldEscalations,
  negotiationRuns,
  users,
} from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName = 'Operator',
  role = 'citizen'
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
        role,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed (getOrCreateUser):', error);
    throw new Error('Failed to synchronize operator profile.', { cause: error });
  }
}

export async function saveNegotiationRun(
  uid: string,
  email: string,
  displayName: string,
  input: {
    profile: string;
    horizonH: number;
    baseCapacityMW: number;
    fairnessWeight: number;
    negotiatedDamage: number;
    uncoordinatedDamage: number;
    jainsFairness: number;
    notes?: string;
  }
) {
  try {
    const user = await getOrCreateUser(uid, email, displayName);
    const [inserted] = await db
      .insert(negotiationRuns)
      .values({
        userId: user.id,
        profile: input.profile.slice(0, 48),
        horizonH: Math.round(input.horizonH),
        baseCapacityMW: input.baseCapacityMW,
        fairnessWeight: input.fairnessWeight,
        negotiatedDamage: input.negotiatedDamage,
        uncoordinatedDamage: input.uncoordinatedDamage,
        jainsFairness: input.jainsFairness,
        notes: (input.notes || '').slice(0, 300),
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Database query failed (saveNegotiationRun):', error);
    throw new Error('Failed to save negotiation run.', { cause: error });
  }
}

export async function listNegotiationRuns(uid: string) {
  try {
    return await db
      .select({
        id: negotiationRuns.id,
        profile: negotiationRuns.profile,
        horizonH: negotiationRuns.horizonH,
        baseCapacityMW: negotiationRuns.baseCapacityMW,
        fairnessWeight: negotiationRuns.fairnessWeight,
        negotiatedDamage: negotiationRuns.negotiatedDamage,
        uncoordinatedDamage: negotiationRuns.uncoordinatedDamage,
        jainsFairness: negotiationRuns.jainsFairness,
        notes: negotiationRuns.notes,
        createdAt: negotiationRuns.createdAt,
      })
      .from(negotiationRuns)
      .innerJoin(users, eq(negotiationRuns.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(negotiationRuns.createdAt))
      .limit(20);
  } catch (error) {
    console.error('Database query failed (listNegotiationRuns):', error);
    throw new Error('Failed to retrieve negotiation runs.', { cause: error });
  }
}

export async function saveFieldEscalation(
  uid: string,
  email: string,
  displayName: string,
  input: {
    category: string;
    areaName: string;
    severity: string;
    summary: string;
    lat: number;
    lon: number;
  }
) {
  try {
    const user = await getOrCreateUser(uid, email, displayName);
    const [inserted] = await db
      .insert(fieldEscalations)
      .values({
        userId: user.id,
        category: input.category.slice(0, 48),
        areaName: input.areaName.slice(0, 64),
        severity: input.severity.slice(0, 16),
        summary: input.summary.slice(0, 500),
        lat: input.lat,
        lon: input.lon,
        status: 'open',
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Database query failed (saveFieldEscalation):', error);
    throw new Error('Failed to record field escalation.', { cause: error });
  }
}

export async function listFieldEscalations(uid: string) {
  try {
    return await db
      .select({
        id: fieldEscalations.id,
        category: fieldEscalations.category,
        areaName: fieldEscalations.areaName,
        severity: fieldEscalations.severity,
        summary: fieldEscalations.summary,
        lat: fieldEscalations.lat,
        lon: fieldEscalations.lon,
        status: fieldEscalations.status,
        createdAt: fieldEscalations.createdAt,
      })
      .from(fieldEscalations)
      .innerJoin(users, eq(fieldEscalations.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(fieldEscalations.createdAt))
      .limit(25);
  } catch (error) {
    console.error('Database query failed (listFieldEscalations):', error);
    throw new Error('Failed to retrieve field escalations.', { cause: error });
  }
}

export async function saveChatExchange(
  uid: string,
  email: string,
  displayName: string,
  userMsg: string,
  assistantMsg: string
) {
  try {
    const user = await getOrCreateUser(uid, email, displayName);
    await db.insert(chatMessages).values([
      { userId: user.id, role: 'user', content: userMsg.slice(0, 2000) },
      { userId: user.id, role: 'assistant', content: assistantMsg.slice(0, 4000) },
    ]);
  } catch (error) {
    console.error('Database query failed (saveChatExchange):', error);
    throw new Error('Failed to archive chat exchange.', { cause: error });
  }
}
