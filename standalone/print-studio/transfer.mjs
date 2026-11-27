import { createWriteStream, openAsBlob } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fail } from './provider.mjs';

// Stage bounded bytes privately so fetch can calculate the signed multipart POST length.
export async function transferUpload(req, row, otto, send = fetch) {
  const length = req.headers['content-length'];
  if (length !== undefined && Number(length) !== row.bytes) fail(400, 'The selected file size changed. Select it again.');
  const dir = await mkdtemp(join(tmpdir(), 'ef-print-'));
  try {
    const path = join(dir, 'model');
    let received = 0;
    const measure = new Transform({
      transform(chunk, encoding, done) {
        received += chunk.length;
        if (received > row.bytes) return done(Object.assign(Error('The file exceeds its registered size.'), {status: 413}));
        done(null, chunk);
      }
    });
    await pipeline(req, measure, createWriteStream(path, {flags: 'wx', mode: 0o600}));
    if (received !== row.bytes) fail(400, 'The upload was interrupted. Submit the same file again.');
    const slot = Math.floor(Date.now() / 1_800_000);
    const file = await otto('/files', {filename: row.filename, size_bytes: received}, row.id + '-file-' + slot);
    const upload = file.upload;
    if (!/^file_[0-9a-f]{32}$/.test(file.id) || upload?.method !== 'POST' || !upload.fields ||
        typeof upload.fields !== 'object' || Array.isArray(upload.fields) || !URL.canParse(upload.url) ||
        new URL(upload.url).protocol !== 'https:') fail(502, 'OTTO returned incomplete file transfer details. Please try again.');
    const form = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
    form.append('file', await openAsBlob(path), row.filename);
    let response;
    try {
      response = await send(upload.url, {method: 'POST', body: form, redirect: 'error', signal: AbortSignal.timeout(120_000)});
    } catch {
      fail(502, 'OTTO storage could not be reached. Submit the same file again.');
    }
    await response.body?.cancel();
    if (!response.ok) fail(502, 'OTTO storage did not accept the file. Submit the same file again.');
    return file.id;
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
}

export async function finishUpload(db, otto, owner, id) {
  const row = db.prepare('SELECT * FROM uploads WHERE id=? AND owner=?').get(id, owner);
  if (!row) fail(404, 'Upload not found.');
  if (row.model_id) return {id: row.model_id};
  if (!row.file_id) fail(409, 'Upload the file before submitting it for inspection.');
  if (Date.now() - row.created > 86_400_000) fail(409, 'Upload expired. Select the file again.');
  const model = await otto('/models', {name: row.name, source: {file_id: row.file_id},
    longest_dimension_mm: row.mm, external_id: 'ef-custom-' + row.id}, row.id + '-model');
  if (!/^MD-[0-9A-HJKMNP-TV-Z]{8}$/.test(model.id)) fail(502, 'Model registration failed.');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR IGNORE INTO models(id,owner,name,mm) VALUES(?,?,?,?)').run(model.id,owner,row.name,row.mm);
    if (db.prepare('SELECT owner FROM models WHERE id=?').get(model.id)?.owner !== owner) fail(409, 'Model ownership conflict.');
    db.prepare('UPDATE uploads SET model_id=? WHERE id=?').run(model.id,id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return {id: model.id};
}
