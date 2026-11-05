import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { readHiddenPassword } from '../server/read-hidden-password.mjs';

function terminal() {
  const input = new PassThrough(), output = new PassThrough();
  input.isTTY = output.isTTY = true;
  input.setRawMode = value => { input.isRaw = value; };
  let text = '';
  output.on('data', chunk => { text += chunk; });
  return { input, output, text: () => text };
}
test('password input is hidden and terminal mode is restored', async () => {
  const t = terminal();
  const pending = readHiddenPassword('Password: ', t);
  t.input.write('fixture-only-passphrase\r');
  assert.equal(await pending, 'fixture-only-passphrase');
  assert.equal(t.text(), 'Password: \n');
  assert.equal(t.input.isRaw, false);
});
test('backspace edits hidden input without exposing it', async ctx => {
  const term = process.env.TERM;
  process.env.TERM = 'xterm';
  ctx.after(() => { if (term === undefined) delete process.env.TERM; else process.env.TERM = term; });
  const t = terminal();
  const pending = readHiddenPassword('Password: ', t);
  t.input.write('fixture-only-passphrass');
  t.input.write('\x7f');
  t.input.write('e\r');
  assert.equal(await pending, 'fixture-only-passphrase');
  assert.equal(t.text(), 'Password: \n');
});
test('Ctrl-C cancels and restores terminal mode', async () => {
  const t = terminal();
  const pending = readHiddenPassword('Password: ', t);
  t.input.write('fixture-only\x03');
  await assert.rejects(pending, /cancelled/);
  assert.equal(t.input.isRaw, false);
  assert.equal(t.text(), 'Password: \n');
});
test('closed input cancels without leaving a pending prompt', async () => {
  const t = terminal();
  const pending = readHiddenPassword('Password: ', t);
  t.input.end();
  await assert.rejects(pending, /cancelled/);
  assert.equal(t.input.isRaw, false);
});
test('non-TTY input or output is refused before prompting', async () => {
  for (const target of ['input', 'output']) {
    const t = terminal(); t[target].isTTY = false;
    await assert.rejects(readHiddenPassword('Password: ', t), /interactive terminal/);
    assert.equal(t.text(), '');
  }
});
