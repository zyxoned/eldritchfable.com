import test from 'node:test';
import assert from 'node:assert/strict';
import { sendWithTravelRetry } from '../src/game/travel-retry.js';
const cooldown = () => Object.assign(new Error('Move a little more slowly.'), { status:429, code:'MOVE_COOLDOWN' });

test('travel retries one known cooldown after server cadence under the existing operation', async () => {
  let calls = 0;
  const waits = [];
  const reply = { data:{ notice:'Entered Amber Reach.' } };
  assert.equal(await sendWithTravelRetry('travel', async () => { if (++calls === 1) throw cooldown(); return reply; }, () => true, async ms => { waits.push(ms); }), reply);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [180]);
});

test('travel cancellation during pacing prevents retry and cannot resume later', async () => {
  let calls = 0, current = true;
  const result = await sendWithTravelRetry('travel', async () => { calls++; throw cooldown(); }, () => current, async () => { current = false; });
  assert.equal(result, null);
  current = true;
  await Promise.resolve();
  assert.equal(calls, 1);
});

test('another travel rejection is surfaced without a third attempt', async () => {
  let calls = 0;
  await assert.rejects(sendWithTravelRetry('travel', async () => { calls++; throw cooldown(); }, () => true, async () => {}), { code:'MOVE_COOLDOWN' });
  assert.equal(calls, 2);
});

test('movement, other actions, network uncertainty and nonmatching errors are never retried', async () => {
  for (const [kind, error] of [['move',cooldown()],['attack',cooldown()],['configure',cooldown()],['travel',new Error('Network interrupted')],['travel',{ status:500, code:'MOVE_COOLDOWN' }],['travel',{ status:429, code:'OTHER' }]]) {
    let calls = 0;
    await assert.rejects(sendWithTravelRetry(kind, async () => { calls++; throw error; }, () => true, async () => { assert.fail('must not wait'); }));
    assert.equal(calls, 1);
  }
});

test('successful travel has no pacing or duplicate request', async () => {
  let calls = 0;
  assert.equal(await sendWithTravelRetry('travel', async () => { calls++; return 'done'; }, () => true, async () => { assert.fail('must not wait'); }), 'done');
  assert.equal(calls, 1);
});
