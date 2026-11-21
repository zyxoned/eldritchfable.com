import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const validator = fileURLToPath(new URL('../../.agents/skills/plan-eldritch-fable/scripts/validate.mjs', import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'eldritch-plan-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'bundle');
  mkdirSync(dir);

  function proof(path, content) {
    writeFileSync(join(dir, path), content);
    return { path, sha256: createHash('sha256').update(content).digest('hex') };
  }

  function slice(number, kind = 'gameplay') {
    const id = 'slice-' + number;
    const revision = number.toString(16).padStart(40, '0');
    const method = { gameplay: 'runtime', art: 'visual', infrastructure: 'automated', documentation: 'inspection' }[kind];
    const evidence = proof(id + '-result.txt', 'Synthetic ' + method + ' observation for ' + revision);
    const assets = [];
    if (kind === 'art') {
      const art = proof(id + '-warden.svg', '<svg>test art</svg>');
      assets.push({
        id: 'warden', ...art, source: 'Original commissioned illustration',
        preview: proof(id + '-preview.txt', 'In-game capture fixture for ' + revision),
        approval: { decision: 'approved', designer: 'Test Designer', sha256: art.sha256,
          evidence: proof(id + '-approval.txt', 'Reviewed warden ' + art.sha256) },
      });
    }
    return {
      id, kind, design: 'D-01', outcome: 'The hero can identify their equipment.',
      revision, assets, criteria: [{ id: 'visibility', expected: 'Equipment appears in the saved slot.', method }],
      results: [{ id: 'visibility', observed: 'The slot shows the item on return.', passed: true, method, revision, evidence }],
    };
  }

  function checkpoint(after, last) {
    return {
      after, decision: 'passed', sliceId: last.id, revision: last.revision,
      build: proof('build-' + after + '.txt', 'Playable build fixture at ' + last.revision),
      automation: proof('checks-' + after + '.txt', 'Automated checks for ' + last.revision),
      scenario: 'Equip the drop, leave, reconnect, and inspect the slot.',
      designer: 'Test Designer', observations: 'The slot retained the drop after reconnect.',
      blockers: [], review: proof('review-' + after + '.txt', 'Designer reviewed ' + last.revision),
    };
  }

  function run(ledger, previous, handoff) {
    const currentPath = join(dir, 'candidate.json');
    writeFileSync(currentPath, JSON.stringify(ledger));
    const args = [validator, currentPath];
    if (previous !== undefined) {
      const oldPath = join(dir, 'accepted.json');
      writeFileSync(oldPath, JSON.stringify(previous));
      args.push('--previous', oldPath);
    }
    if (handoff !== undefined) {
      const handoffPath = join(dir, 'approved-handoff.json');
      writeFileSync(handoffPath, JSON.stringify(handoff));
      args.push('--handoff', handoffPath);
    }
    const child = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10_000 });
    if (child.error) throw child.error;
    assert.equal(child.signal, null);
    return { status: child.status, output: child.stdout + child.stderr };
  }
  return { dir, slice, checkpoint, run };
}

function ledger(...slices) {
  return { version: 1, slices, checkpoints: [] };
}

function passes(run) {
  assert.equal(run.status, 0, run.output);
}

function fails(run) {
  assert.notEqual(run.status, 0, run.output);
  assert.ok(run.output.trim(), 'Rejected ledger must include a diagnostic.');
}

test('accepts a runtime observation and a separately approved shipping visual', (t) => {
  const f = fixture(t);
  passes(f.run(ledger(f.slice(1), f.slice(2, 'art'))));
});

test('requires the specified passing method, matching revision and exact criterion coverage', (t) => {
  const f = fixture(t);
  const base = ledger(f.slice(1));
  const cases = [
    (s) => { s.results = []; },
    (s) => { s.results[0].passed = false; },
    (s) => { s.results[0].revision = 'b'.repeat(40); },
    (s) => { s.results[0].method = 'automated'; },
    (s) => { s.criteria[0].method = s.results[0].method = 'automated'; },
    (s) => { s.results[0].id = 'other'; },
    (s) => { s.results.push(structuredClone(s.results[0])); },
    (s) => { s.criteria.push(structuredClone(s.criteria[0])); },
  ];
  for (const change of cases) {
    const copy = structuredClone(base);
    change(copy.slices[0]);
    fails(f.run(copy));
  }
});

test('requires readable evidence with matching bytes inside the evidence bundle', (t) => {
  const f = fixture(t);
  const base = ledger(f.slice(1));
  const evidence = base.slices[0].results[0].evidence;
  const outside = join(f.dir, '..', 'outside.txt');
  writeFileSync(outside, 'external fixture');
  const digest = createHash('sha256').update('external fixture').digest('hex');
  for (const replacement of [
    { path: 'missing.txt', sha256: digest },
    { path: evidence.path, sha256: digest },
    { path: '../outside.txt', sha256: digest },
  ]) {
    const copy = structuredClone(base);
    copy.slices[0].results[0].evidence = replacement;
    fails(f.run(copy));
  }
  if (process.platform !== 'win32') {
    symlinkSync(outside, join(f.dir, 'linked.txt'));
    base.slices[0].results[0].evidence = { path: 'linked.txt', sha256: digest };
    fails(f.run(base));
  }
});

test('rejects absent, stale and unapproved art', (t) => {
  const f = fixture(t);
  const base = ledger(f.slice(1, 'art'));
  for (const change of [
    (s) => { s.assets = []; },
    (s) => { delete s.assets[0].approval; },
    (s) => { s.assets[0].approval.decision = 'rejected'; },
    (s) => { s.assets[0].approval.sha256 = 'a'.repeat(64); },
  ]) {
    const copy = structuredClone(base);
    change(copy.slices[0]);
    fails(f.run(copy));
  }
  writeFileSync(join(f.dir, base.slices[0].assets[0].path), '<svg>changed</svg>');
  fails(f.run(base));
});

test('counts accepted game slices once, leaves documentation uncounted, and gates the fifth', (t) => {
  const f = fixture(t);
  const base = ledger(f.slice(1), f.slice(2, 'documentation'), f.slice(3, 'art'),
    f.slice(4, 'infrastructure'), f.slice(5));
  passes(f.run(base));
  const fifth = f.slice(6);
  base.slices.push(fifth);
  fails(f.run(base));
  base.slices.push(f.slice(7));
  fails(f.run(base));
  base.checkpoints.push(f.checkpoint(5, fifth));
  passes(f.run(base));
  base.slices.push(structuredClone(fifth));
  fails(f.run(base));
});

test('checkpoint must identify its exact slice, build revision and resolved designer review', (t) => {
  const f = fixture(t);
  const base = ledger(...Array.from({ length: 5 }, (_, i) => f.slice(i + 1)));
  base.checkpoints.push(f.checkpoint(5, base.slices[4]));
  passes(f.run(base));
  for (const change of [
    (c) => { c.sliceId = 'slice-4'; },
    (c) => { c.revision = 'b'.repeat(40); },
    (c) => { c.blockers = ['Critical save loss']; },
    (c) => { c.designer = ''; },
    (c) => { c.decision = 'failed'; },
    (c) => { delete c.review; },
    (c) => { c.after = 10; },
    (c) => { c.build.sha256 = 'a'.repeat(64); },
  ]) {
    const copy = structuredClone(base);
    change(copy.checkpoints[0]);
    fails(f.run(copy));
  }
  base.checkpoints.push(structuredClone(base.checkpoints[0]));
  fails(f.run(base));
});

test('requires a second designer playtest at ten counted slices', (t) => {
  const f = fixture(t);
  const base = ledger(...Array.from({ length: 10 }, (_, i) => f.slice(i + 1)));
  base.checkpoints.push(f.checkpoint(5, base.slices[4]));
  fails(f.run(base));
  base.checkpoints.push(f.checkpoint(10, base.slices[9]));
  passes(f.run(base));
});

test('trusted history supports idempotent audit and append, and rejects rewrite or truncation', (t) => {
  const f = fixture(t);
  const previous = ledger(...Array.from({ length: 5 }, (_, i) => f.slice(i + 1)));
  previous.checkpoints.push(f.checkpoint(5, previous.slices[4]));
  const next = structuredClone(previous);
  next.slices.push(f.slice(6));
  passes(f.run(previous, previous));
  passes(f.run(next, previous));
  const rewritten = structuredClone(next);
  rewritten.slices[0].outcome = 'Rewritten history';
  fails(f.run(rewritten, previous));
  const alteredReview = structuredClone(next);
  alteredReview.checkpoints[0].observations = 'Rewritten playtest';
  fails(f.run(alteredReview, previous));
  fails(f.run(ledger(...previous.slices.slice(0, 4)), previous));
});

test('acceptance mode admits exactly one append and enforces the independently approved handoff', (t) => {
  const f = fixture(t);
  const previous = ledger(f.slice(1));
  const next = structuredClone(previous);
  const art = f.slice(2, 'art');
  next.slices.push(art);
  const handoff = {
    id: art.id, kind: art.kind, design: art.design, outcome: art.outcome,
    criteria: structuredClone(art.criteria), assetIds: art.assets.map((asset) => asset.id),
  };
  passes(f.run(next, previous, handoff));
  fails(f.run(previous, previous, handoff));
  const twoNew = structuredClone(next);
  twoNew.slices.push(f.slice(3));
  fails(f.run(twoNew, previous, handoff));
  for (const change of [
    (h) => { h.id = 'different-slice'; },
    (h) => { h.kind = 'documentation'; },
    (h) => { h.design = 'different design'; },
    (h) => { h.outcome = 'different outcome'; },
    (h) => { h.criteria[0].expected = 'approved stronger result'; },
    (h) => { h.criteria[0].method = 'inspection'; },
    (h) => { h.assetIds = ['warden', 'required-portrait']; },
    (h) => { h.assetIds = []; },
  ]) {
    const approved = structuredClone(handoff);
    change(approved);
    fails(f.run(next, previous, approved));
  }
});
