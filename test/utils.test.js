const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const path = require('path');

const { parseBody } = require('../src/utils/body');
const { applyPromoCode } = require('../src/utils/promo');
const { sendJson, resolvePublicPath } = require('../src/utils/response');
const { generateTimeSlots } = require('../src/utils/timeSlots');
const { PUBLIC_DIR } = require('../src/config');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('generateTimeSlots returns the expected daily schedule', () => {
  const slots = generateTimeSlots();

  assert.equal(slots.length, 15);
  assert.deepEqual(slots[0], { time: '08:00', period: 'morning' });
  assert.deepEqual(slots[7], { time: '11:30', period: 'morning' });
  assert.deepEqual(slots[8], { time: '12:00', period: 'afternoon' });
  assert.deepEqual(slots[14], { time: '15:00', period: 'afternoon' });
});

test('applyPromoCode normalizes valid codes and calculates discount', () => {
  const result = applyPromoCode(' save10 ', 220);

  assert.deepEqual(result, { code: 'SAVE10', discount: 22 });
});

test('applyPromoCode preserves invalid codes with no discount', () => {
  const result = applyPromoCode('badcode', 220);

  assert.deepEqual(result, { code: 'BADCODE', discount: 0 });
});

test('parseBody resolves parsed JSON request bodies', async () => {
  const req = new EventEmitter();
  req.connection = { destroy() {} };
  const promise = parseBody(req);

  req.emit('data', '{"firstName":"Ada"}');
  req.emit('end');

  await assert.doesNotReject(promise);
  assert.deepEqual(await promise, { firstName: 'Ada' });
});

test('parseBody rejects invalid JSON', async () => {
  const req = new EventEmitter();
  req.connection = { destroy() {} };
  const promise = parseBody(req);

  req.emit('data', '{"firstName":');
  req.emit('end');

  await assert.rejects(promise);
});

test('sendJson writes a JSON response with the expected headers', () => {
  const response = {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };

  sendJson(response, 201, { ok: true });

  assert.equal(response.status, 201);
  assert.deepEqual(response.headers, { 'Content-Type': 'application/json' });
  assert.equal(response.body, '{"ok":true}');
});

test('resolvePublicPath serves index for the root route', () => {
  const resolved = resolvePublicPath('/');

  assert.equal(resolved, path.join(PUBLIC_DIR, 'index.html'));
});

test('resolvePublicPath falls back to index for missing files', () => {
  const resolved = resolvePublicPath('/missing-page');

  assert.equal(resolved, path.join(PUBLIC_DIR, 'index.html'));
});

test('resolvePublicPath returns a static file inside the public directory', () => {
  const resolved = resolvePublicPath('/styles.css');

  assert.equal(resolved, path.join(PUBLIC_DIR, 'styles.css'));
});

async function main() {
  let failures = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(`Passed ${tests.length} tests.`);
}

main();
