// Pure client synchronization helpers bridging Firebase Auth + Firestore with Cloud SQL PostgreSQL.
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { OperationType, auth, db, googleAuthProvider, handleFirestoreError } from './firebase.ts';
import {
  buildEscalationPayloads,
  buildFirestoreRunPayload,
  clampString,
  sanitizeDocId,
} from '../utils/grounding.ts';

export interface CloudAppUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: 'citizen' | 'officer' | 'admin';
  agency: string | null;
  isFirebase: true;
}

const BOOTSTRAPPED_ADMIN_EMAIL = 'amogh692006@gmail.com';

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleAuthProvider);
  const fbUser = cred.user;
  if (!fbUser.emailVerified) {
    throw new Error('Your Google account email must be verified to sync with ResQ-Net.');
  }
  const appUser = await syncCloudUserProfile(fbUser);
  return { firebaseUser: fbUser, appUser };
}

export async function signOutCloud() {
  await signOut(auth);
}

export async function getBearerHeaders(fbUser: User | null): Promise<Record<string, string>> {
  const user = fbUser || auth.currentUser;
  if (!user) throw new Error('Sign in with Google first to sync with Cloud SQL.');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function syncCloudUserProfile(
  fbUser: User,
  preferredRole?: 'citizen' | 'officer' | 'admin',
  agencyName?: string | null
): Promise<CloudAppUser> {
  const uid = fbUser.uid;
  const email = clampString(fbUser.email || 'operator@resqnet.local', 'operator@resqnet.local', 160);
  const displayName = clampString(fbUser.displayName || email.split('@')[0], 'ResQ-Net Operator', 100);
  const isBootstrappedAdmin = email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

  const pubPath = `users_public/${uid}`;
  const privPath = `users_private/${uid}`;
  const pubRef = doc(db, 'users_public', uid);
  const privRef = doc(db, 'users_private', uid);

  let resolvedRole: 'citizen' | 'officer' | 'admin' = isBootstrappedAdmin
    ? 'admin'
    : preferredRole === 'officer'
      ? 'officer'
      : 'citizen';
  let resolvedAgency: string | null = agencyName ? clampString(agencyName, '', 40) : null;

  try {
    const snap = await getDoc(pubRef);
    if (!snap.exists()) {
      await setDoc(pubRef, {
        uid,
        displayName,
        role: resolvedRole,
        ...(resolvedAgency ? { agency: resolvedAgency } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = snap.data();
      if (existing?.role === 'admin' || existing?.role === 'officer' || existing?.role === 'citizen') {
        resolvedRole = existing.role;
      }
      if (!resolvedAgency && typeof existing?.agency === 'string' && existing.agency.trim()) {
        resolvedAgency = existing.agency.trim().slice(0, 40);
      }
      await updateDoc(pubRef, {
        displayName,
        ...(resolvedAgency ? { agency: resolvedAgency } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, pubPath);
  }

  try {
    const privSnap = await getDoc(privRef);
    if (!privSnap.exists()) {
      await setDoc(privRef, {
        uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privRef, {
        email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privPath);
  }

  // Best-effort sync with Cloud SQL PostgreSQL
  try {
    const headers = await getBearerHeaders(fbUser);
    await fetch('/api/sql/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ displayName, role: resolvedRole }),
    });
  } catch (err) {
    console.warn('Cloud SQL profile sync warning:', err);
  }

  return {
    id: uid,
    uid,
    name: displayName,
    email,
    role: resolvedRole,
    agency: resolvedAgency,
    isFirebase: true,
  };
}

export async function saveSimulationRunToCloud(input: {
  firebaseUser?: User | null;
  profile: string;
  horizonH?: number;
  baseCapacityMW?: number;
  fairnessWeight?: number;
  negotiatedDamage: number;
  uncoordinatedDamage?: number;
  jainsFairness?: number;
  notes?: string;
}) {
  const fbUser = input.firebaseUser || auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) {
    throw new Error('Sign in with Google to save simulation runs to Firestore & Cloud SQL.');
  }
  await syncCloudUserProfile(fbUser);

  const runId = sanitizeDocId(`run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, 64);
  const fsPayload = buildFirestoreRunPayload({
    runId,
    ownerId: fbUser.uid,
    profile: input.profile,
    baseCapacityMW: input.baseCapacityMW,
    fairnessWeight: input.fairnessWeight,
    negotiatedDamage: input.negotiatedDamage,
    uncoordinatedDamage: input.uncoordinatedDamage,
    jainsFairness: input.jainsFairness,
    status: 'active',
  });

  const runPath = `users_public/${fbUser.uid}/runs/${runId}`;
  try {
    await setDoc(doc(db, 'users_public', fbUser.uid, 'runs', runId), {
      ...fsPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, runPath);
  }

  let sqlRun = null;
  const headers = await getBearerHeaders(fbUser);
  const res = await fetch('/api/sql/runs', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      profile: fsPayload.profile,
      horizonH: Math.round(Number(input.horizonH || 72)),
      baseCapacityMW: fsPayload.baseCapacityMW,
      fairnessWeight: fsPayload.fairnessWeight,
      negotiatedDamage: fsPayload.negotiatedDamage,
      uncoordinatedDamage: fsPayload.uncoordinatedDamage,
      jainsFairness: fsPayload.jainsFairness,
      notes: input.notes || '',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to save simulation run to Cloud SQL.');
  }
  sqlRun = body.run;

  return { firestoreRun: fsPayload, sqlRun };
}

export async function loadCloudHistory(fbUser?: User | null) {
  const user = fbUser || auth.currentUser;
  if (!user || !user.emailVerified) {
    return { firestoreRuns: [], sqlRuns: [] };
  }
  const uid = user.uid;
  const runsPath = `users_public/${uid}/runs`;
  let firestoreRuns: Array<Record<string, unknown>> = [];
  try {
    const q = query(collection(db, 'users_public', uid, 'runs'), where('ownerId', '==', uid), limit(15));
    const snap = await getDocs(q);
    firestoreRuns = snap.docs.map((d) => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, runsPath);
  }

  let sqlRuns: Array<Record<string, unknown>> = [];
  try {
    const headers = await getBearerHeaders(user);
    const res = await fetch('/api/sql/runs', { headers });
    if (res.ok) {
      const data = await res.json();
      sqlRuns = Array.isArray(data.runs) ? data.runs : [];
    }
  } catch {
    // Non-fatal if Cloud SQL unavailable locally
  }

  return { firestoreRuns, sqlRuns };
}

export async function saveEscalationToCloud(input: {
  firebaseUser?: User | null;
  category: string;
  areaName: string;
  severity?: string;
  summary: string;
  lat: number;
  lon: number;
}) {
  const fbUser = input.firebaseUser || auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) {
    throw new Error('Sign in with Google to sync reports to Firestore & Cloud SQL.');
  }
  await syncCloudUserProfile(fbUser);

  const escalationId = sanitizeDocId(`esc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, 64);
  const { firestore, sql } = buildEscalationPayloads({
    escalationId,
    authorId: fbUser.uid,
    category: input.category,
    areaName: input.areaName,
    severity: input.severity,
    summary: input.summary,
    lat: input.lat,
    lon: input.lon,
  });

  const escPath = `escalations/${escalationId}`;
  try {
    await setDoc(doc(db, 'escalations', escalationId), {
      ...firestore,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, escPath);
  }

  const headers = await getBearerHeaders(fbUser);
  const res = await fetch('/api/sql/escalations', {
    method: 'POST',
    headers,
    body: JSON.stringify(sql),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to save escalation to Cloud SQL.');
  }

  return { firestoreEscalation: firestore, sqlEscalation: body.escalation };
}

export async function loadCloudEscalations(fbUser?: User | null) {
  const user = fbUser || auth.currentUser;
  if (!user || !user.emailVerified) {
    return { firestoreEscalations: [], sqlEscalations: [] };
  }
  let firestoreEscalations: Array<Record<string, unknown>> = [];
  try {
    const q = query(collection(db, 'escalations'), where('authorId', '==', user.uid), limit(20));
    const snap = await getDocs(q);
    firestoreEscalations = snap.docs.map((d) => d.data());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'escalations');
  }

  let sqlEscalations: Array<Record<string, unknown>> = [];
  try {
    const headers = await getBearerHeaders(user);
    const res = await fetch('/api/sql/escalations', { headers });
    if (res.ok) {
      const data = await res.json();
      sqlEscalations = Array.isArray(data.escalations) ? data.escalations : [];
    }
  } catch {
    // Optional SQL fallback
  }

  return { firestoreEscalations, sqlEscalations };
}
