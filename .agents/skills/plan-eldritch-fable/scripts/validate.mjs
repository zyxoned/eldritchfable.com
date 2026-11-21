import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const kinds = new Set(['gameplay', 'art', 'infrastructure', 'documentation']);
const methods = new Set(['runtime', 'visual', 'automated', 'inspection']);
const commit = /^[0-9a-f]{40}$/;
const digest = /^[0-9a-f]{64}$/;

function requireThat(value, message) {
  if (!value) throw new Error(message);
}

function record(value, label) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value),
    label + ' must be an object');
}

function list(value, label) {
  requireThat(Array.isArray(value), label + ' must be an array');
  return value;
}

function words(value, label) {
  requireThat(typeof value === 'string' && value.trim().length > 0,
    label + ' must be a nonblank string');
}

function uniqueId(row, seen, label) {
  record(row, label);
  words(row.id, label + '.id');
  requireThat(row.id === row.id.trim(), label + '.id must have no surrounding whitespace');
  requireThat(!seen.has(row.id), label + ': duplicate id ' + row.id);
  seen.add(row.id);
}

function revision(value, label) {
  requireThat(typeof value === 'string' && commit.test(value),
    label + ' must be a full lowercase Git commit SHA');
}

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

function evidenceReader(root) {
  const cache = new Map();
  return async function checkEvidence(ref, label) {
    record(ref, label);
    words(ref.path, label + '.path');
    requireThat(!path.isAbsolute(ref.path) && !path.win32.isAbsolute(ref.path),
      label + '.path must be relative to the ledger');
    requireThat(typeof ref.sha256 === 'string' && digest.test(ref.sha256),
      label + '.sha256 must be a lowercase SHA-256 digest');
    const candidate = path.resolve(root, ref.path);
    requireThat(inside(root, candidate), label + '.path leaves the ledger directory');
    let resolved;
    let hash;
    try {
      resolved = await realpath(candidate);
      requireThat(inside(root, resolved), 'resolved path leaves the ledger directory');
      hash = cache.get(resolved);
      if (hash === undefined) {
        const info = await stat(resolved);
        requireThat(info.isFile() && info.size > 0, 'expected a nonempty regular file');
        const sum = createHash('sha256');
        for await (const chunk of createReadStream(resolved)) sum.update(chunk);
        hash = sum.digest('hex');
        cache.set(resolved, hash);
      }
    } catch (error) {
      throw new Error(label + ' (' + ref.path + '): ' + error.message);
    }
    requireThat(hash === ref.sha256, label + ': SHA-256 mismatch for ' + ref.path);
  };
}

async function checkSlice(slice, label, evidence) {
  requireThat(kinds.has(slice.kind), label + '.kind must be gameplay, art, infrastructure, or documentation');
  words(slice.design, label + '.design');
  words(slice.outcome, label + '.outcome');
  revision(slice.revision, label + '.revision');

  const criteria = list(slice.criteria, label + '.criteria');
  requireThat(criteria.length > 0, label + ' needs at least one acceptance criterion');
  const criterionIds = new Set();
  const expectedMethods = new Map();
  for (const criterion of criteria) {
    uniqueId(criterion, criterionIds, label + '.criteria');
    const key = label + '.criteria[' + criterion.id + ']';
    words(criterion.expected, key + '.expected');
    requireThat(methods.has(criterion.method), key + '.method is unknown');
    expectedMethods.set(criterion.id, criterion.method);
  }
  for (const [kind, method] of [['gameplay', 'runtime'], ['art', 'visual']]) {
    if (slice.kind === kind) {
      requireThat(criteria.some(criterion => criterion.method === method),
        label + ' requires a ' + method + ' acceptance criterion');
    }
  }

  const resultIds = new Set();
  for (const result of list(slice.results, label + '.results')) {
    uniqueId(result, resultIds, label + '.results');
    const key = label + '.results[' + result.id + ']';
    requireThat(expectedMethods.has(result.id), key + ' has no matching criterion');
    requireThat(result.method === expectedMethods.get(result.id), key + '.method must match its criterion');
    requireThat(result.revision === slice.revision, key + '.revision must match the slice revision');
    words(result.observed, key + '.observed');
    requireThat(result.passed === true, key + '.passed must be true');
    await evidence(result.evidence, key + '.evidence');
  }
  for (const id of criterionIds) {
    requireThat(resultIds.has(id), label + ' is missing the result for ' + id);
  }

  const assets = list(slice.assets, label + '.assets');
  requireThat(slice.kind !== 'art' || assets.length > 0, label + ' must identify its shipping art assets');
  const assetIds = new Set();
  for (const asset of assets) {
    uniqueId(asset, assetIds, label + '.assets');
    const key = label + '.assets[' + asset.id + ']';
    words(asset.source, key + '.source');
    await evidence(asset, key);
    await evidence(asset.preview, key + '.preview');
    record(asset.approval, key + '.approval');
    words(asset.approval.designer, key + '.approval.designer');
    requireThat(asset.approval.decision === 'approved', key + ' requires a designer decision of approved');
    requireThat(asset.approval.sha256 === asset.sha256,
      key + ' approval must reference this exact asset version');
    await evidence(asset.approval.evidence, key + '.approval.evidence');
  }
}

function ledgerShape(ledger, label) {
  record(ledger, label);
  requireThat(ledger.version === 1, label + '.version must be 1');
  list(ledger.slices, label + '.slices');
  list(ledger.checkpoints, label + '.checkpoints');
}

function checkPrefix(current, previous) {
  ledgerShape(previous, 'previous ledger');
  for (const field of ['slices', 'checkpoints']) {
    requireThat(current[field].length >= previous[field].length, 'cannot remove accepted ' + field);
    for (const [i, accepted] of previous[field].entries()) {
      requireThat(isDeepStrictEqual(current[field][i], accepted),
        'cannot replace or reorder accepted ' + field + '[' + i + ']');
    }
  }
}

function checkHandoff(ledger, previous, handoff) {
  record(handoff, 'approved handoff');
  requireThat(ledger.slices.length === previous.slices.length + 1,
    'acceptance against a handoff requires exactly one appended slice');
  const slice = ledger.slices.at(-1);
  record(slice, 'appended slice');
  for (const field of ['id', 'kind', 'design', 'outcome', 'criteria']) {
    requireThat(isDeepStrictEqual(handoff[field], slice[field]),
      'appended slice ' + field + ' differs from its approved handoff');
  }
  const expectedIds = list(handoff.assetIds, 'handoff.assetIds');
  const actualIds = list(slice.assets, 'appended slice.assets').map((asset, index) => {
    record(asset, 'appended slice.assets[' + index + ']');
    return asset.id;
  });
  for (const id of expectedIds) words(id, 'handoff.assetIds entry');
  requireThat(new Set(expectedIds).size === expectedIds.length, 'handoff.assetIds must be unique');
  requireThat(isDeepStrictEqual([...expectedIds].sort(), actualIds.sort()),
    'appended slice asset IDs differ from its approved handoff');
}

async function jsonFile(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error('could not read JSON file ' + file + ': ' + error.message);
  }
}

export async function validateLedger(file, previousFile, handoffFile) {
  const canonicalFile = await realpath(file);
  const ledger = await jsonFile(canonicalFile);
  ledgerShape(ledger, 'ledger');
  requireThat(handoffFile === undefined || previousFile !== undefined,
    'acceptance against a handoff requires a trusted previous ledger');
  if (previousFile !== undefined) {
    const previous = await jsonFile(previousFile);
    checkPrefix(ledger, previous);
    if (handoffFile !== undefined) checkHandoff(ledger, previous, await jsonFile(handoffFile));
  }

  const evidence = evidenceReader(path.dirname(canonicalFile));
  const ids = new Set();
  const counted = [];
  for (const [index, slice] of ledger.slices.entries()) {
    uniqueId(slice, ids, 'slices[' + index + ']');
    await checkSlice(slice, 'slice ' + slice.id, evidence);
    if (slice.kind !== 'documentation') counted.push(slice);
  }

  const due = Math.floor(counted.length / 5);
  requireThat(ledger.checkpoints.length <= due, 'unexpected or duplicate playtest checkpoint');
  for (let index = 0; index < due; index += 1) {
    const after = (index + 1) * 5;
    const fifth = counted[after - 1];
    const point = ledger.checkpoints[index];
    const label = 'playtest after slice ' + after + ' (' + fifth.id + ')';
    requireThat(point !== undefined, label + ' is due: attach the designer playtest');
    record(point, label);
    requireThat(point.after === after && point.sliceId === fifth.id,
      label + ' must name this counted slice and ordinal');
    requireThat(point.revision === fifth.revision, label + ' must use the accepted build revision');
    requireThat(point.decision === 'passed', label + ' requires an explicit designer decision of passed');
    for (const field of ['scenario', 'designer', 'observations']) words(point[field], label + '.' + field);
    requireThat(list(point.blockers, label + '.blockers').length === 0, label + ' has unresolved blocking findings');
    for (const field of ['build', 'automation', 'review']) await evidence(point[field], label + '.' + field);
  }
  return { slices: ledger.slices.length, counted: counted.length, playtests: due };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  try {
    const audit = args.length === 1 || (args.length === 3 && args[1] === '--previous');
    const accept = args.length === 5 && args[1] === '--previous' && args[3] === '--handoff';
    requireThat(audit || accept,
      'usage: node validate.mjs LEDGER.json [--previous TRUSTED_LEDGER.json [--handoff APPROVED.json]]');
    const result = await validateLedger(args[0], args[2], args[4]);
    const operation = accept ? 'Accepted one new slice. Ledger contains ' : 'Verified ';
    console.log(operation + result.counted + ' game slices and ' + result.playtests +
      ' designer playtests (' + result.slices + ' total records).');
  } catch (error) {
    console.error('Acceptance failed: ' + error.message);
    process.exitCode = 1;
  }
}
