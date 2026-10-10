import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeCode,
  codeHash,
  seal,
  unseal,
  invitationPassword,
  publishRows,
  norm,
} from '../src/crypto.js';

const guest = (over) => ({
  id: crypto.randomUUID(),
  name: 'Ali Khan',
  code: makeCode(),
  nikkah: true,
  barat: true,
  walima: true,
  ...over,
});

// Mirrors what GuestPortal does with the published file.
async function unlock(published, name, code) {
  const id = await codeHash(code);
  const row = published.guests.find((r) => r.id === id);
  if (!row) return null;
  const found = await unseal(row, invitationPassword(name, code));
  return norm(found.name) === norm(name) ? found : null;
}

test('makeCode gives 16 characters from the unambiguous alphabet', () => {
  for (let i = 0; i < 50; i++) assert.match(makeCode(), /^[A-HJ-NP-Z2-9]{16}$/);
});

test('published file holds no plaintext name or code', async () => {
  const g = guest();
  const raw = JSON.stringify(await publishRows([g]));
  for (const secret of [g.name, g.code]) assert.ok(!raw.includes(secret));
});

test('guest unlocks exactly the events they were assigned', async () => {
  const list = [
    guest({ name: 'Nikkah Only', barat: false, walima: false }),
    guest({ name: 'Barat Only', nikkah: false, walima: false }),
    guest({ name: 'Walima Only', nikkah: false, barat: false }),
    guest({ name: 'All Events' }),
  ];
  const published = await publishRows(list);
  for (const g of list) {
    const found = await unlock(published, g.name, g.code);
    assert.equal(found.nikkah, g.nikkah);
    assert.equal(found.barat, g.barat);
    assert.equal(found.walima, g.walima);
  }
});

test('name and code are forgiving about case, spacing and Unicode form', async () => {
  const g = guest({ name: 'Zoë  Müller ' });
  const published = await publishRows([g]);
  const typed = ' zoë müller'.normalize('NFD');
  const code = g.code.toLowerCase().replace(/(.{4})/g, '$1 ');
  assert.ok(await unlock(published, typed, code));
});

test('wrong name, unknown code and another guest’s code are rejected', async () => {
  const a = guest({ name: 'Ali Khan' });
  const b = guest({ name: 'Sara Ahmed' });
  const published = await publishRows([a, b]);
  await assert.rejects(unlock(published, 'Ali Khaan', a.code), {
    name: 'OperationError',
  });
  await assert.rejects(unlock(published, a.name, b.code), {
    name: 'OperationError',
  });
  assert.equal(await unlock(published, a.name, makeCode()), null);
});

test('rows without a name or code are not published', async () => {
  const published = await publishRows([
    guest({ name: '' }),
    guest({ code: '' }),
    guest(),
  ]);
  assert.equal(published.guests.length, 1);
});

test('admin vault round-trips a very large guest list', async () => {
  const list = Array.from({ length: 5000 }, (_, i) =>
    guest({ name: `Guest Number ${i}` }),
  );
  const back = await unseal(
    await seal(list, 'correct horse battery'),
    'correct horse battery',
  );
  assert.deepEqual(back, list);
});

test('admin vault rejects the wrong password', async () => {
  const sealed = await seal([guest()], 'correct horse battery');
  await assert.rejects(unseal(sealed, 'wrong password'), {
    name: 'OperationError',
  });
});
