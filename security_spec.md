# ResQ-Net Security Specification

## 1. Data Invariants
1. **Default Deny**: All unmatched paths are denied read/write (`match /{document=**} { allow read, write: if false; }`).
2. **Email Verification & ID Hardening**: All writes require `request.auth != null && request.auth.token.email_verified == true`. All document IDs match `^[a-zA-Z0-9_\-]+$` and `.size() <= 128`.
3. **PII Isolation**: User email is isolated in `/users_private/{userId}` and strictly restricted to `isOwner(userId)` or `isAdmin()`.
4. **No Self-Assigned Privilege**: Users creating `/users_public/{userId}` cannot self-assign `role: 'admin'` unless `isBootstrappedAdmin()`.
5. **Master Gate & Global Consistency**: `/users_public/{userId}/runs/{runId}` requires parent `/users_public/{userId}` to exist with matching `uid == request.auth.uid`, and `incoming().ownerId == request.auth.uid`.
6. **Immutable Ownership & Timestamps**: `ownerId`, `authorId`, `uid`, and `createdAt` cannot change on update; `createdAt == request.time` on create, `updatedAt == request.time` on update.
7. **Terminal State Locking**: Archived `runs` (`status == 'archived'`) and resolved `escalations` (`status == 'resolved'`) cannot be modified except by `isAdmin()`.
8. **Query Enforcer**: `allow list` never uses blanket `isSignedIn()` and never runs `get()`/`exists()` inside `list`; instead evaluates `resource.data.ownerId == request.auth.uid` or `resource.data.authorId == request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `{ auth: null }` reading `/users_private/u1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `{ auth: { uid: 'a1', token: { email: 'amogh692006@gmail.com', email_verified: false } } }` writing `/admins/a1` -> `PERMISSION_DENIED`.
3. **Self-Assigned Admin Role**: Non-admin creating `/users_public/u2` with `{ uid: 'u2', displayName: 'Eve', role: 'admin', ... }` -> `PERMISSION_DENIED`.
4. **Cross-User PII Read**: Authenticated `u2` reading `/users_private/u1` -> `PERMISSION_DENIED`.
5. **Shadow Ghost Field Injection**: Creating `/escalations/e1` with `{ ..., isVerified: true }` -> `PERMISSION_DENIED` (`hasOnly` rejects unknown key).
6. **Identity Spoofing on Create**: `u2` creating `/escalations/e2` with `authorId: 'u1'` -> `PERMISSION_DENIED`.
7. **Orphaned Run Creation**: Creating `/users_public/u2/runs/r1` before `/users_public/u2` exists -> `PERMISSION_DENIED`.
8. **ID Poisoning (Oversized/Invalid ID)**: Creating `/escalations/bad$id!` or 200-char ID -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Creating `/escalations/e3` with `createdAt` != `request.time` -> `PERMISSION_DENIED`.
10. **Immutable Field Mutation**: Updating `/escalations/e1` to mutate `authorId` or `createdAt` -> `PERMISSION_DENIED`.
11. **Terminal State Bypass**: Non-admin updating `/escalations/e1` when `existing().status == 'resolved'` -> `PERMISSION_DENIED`.
12. **Blanket List Scraping**: Listing `/escalations` without ownership constraint (`where('authorId', '==', uid)`) -> `PERMISSION_DENIED`.
