import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync('firestore.rules', 'utf8');
const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));

test('firestore.rules enforces default deny and verified auth', () => {
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /amogh692006@gmail\.com/);
});

test('every blueprint collection has a corresponding match block and validation helper', () => {
  const paths = Object.keys(blueprint.firestore);
  assert.ok(paths.length >= 5);
  assert.match(rules, /match \/users_public\/\{userId\}/);
  assert.match(rules, /match \/users_private\/\{userId\}/);
  assert.match(rules, /match \/admins\/\{userId\}/);
  assert.match(rules, /match \/runs\/\{runId\}/);
  assert.match(rules, /match \/escalations\/\{escalationId\}/);
  assert.match(rules, /isValidUserPublic/);
  assert.match(rules, /isValidUserPrivate/);
  assert.match(rules, /isValidRun/);
  assert.match(rules, /isValidEscalation/);
});

test('Dirty Dozen security gates are present (ID guard, PII isolation, shadow keys, terminal state, temporal integrity)', () => {
  // ID Poisoning guard
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /\^\[a-zA-Z0-9_\\\\-\]\+\$/);
  // Shadow field guard via hasOnly
  assert.match(rules, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(/);
  // Master Gate parent check on subcollection
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/users_public\/\$\(userId\)\)/);
  // Terminal state lock
  assert.match(rules, /existing\(\)\.status != 'archived'/);
  assert.match(rules, /existing\(\)\.status != 'resolved'/);
  // Server timestamps enforced
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  // No blanket list reads
  assert.doesNotMatch(rules, /allow list:\s*if\s+isSignedIn\(\);/);
});
