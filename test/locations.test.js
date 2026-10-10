import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeLocations,
  withEvents,
  whatsappNumber,
} from '../src/locations.js';

test('older venue files gain the new fields and a Nikkah entry', () => {
  const merged = mergeLocations({
    barat: { venue: 'Hall', address: '1 Road', mapsUrl: '' },
    walima: { venue: '', address: '', mapsUrl: '' },
  });
  assert.equal(merged.barat.venue, 'Hall');
  assert.equal(merged.barat.time, '6:00 PM');
  assert.equal(merged.nikkah.time, '4:30 PM');
  assert.equal(merged.nikkah.venue, 'Hall');
  assert.equal(merged.nikkah.address, '1 Road');
  assert.equal(merged.walima.time, '');
  for (const id of ['nikkah', 'barat', 'walima'])
    assert.deepEqual(merged[id].contacts, [
      { name: '', phone: '' },
      { name: '', phone: '' },
    ]);
});

test('saved times and contacts are kept', () => {
  const merged = mergeLocations({
    walima: { time: '7:30 PM', contacts: [{ name: 'Ali', phone: '+92300' }] },
  });
  assert.equal(merged.walima.time, '7:30 PM');
  assert.deepEqual(merged.walima.contacts, [
    { name: 'Ali', phone: '+92300' },
    { name: '', phone: '' },
  ]);
});

test('guests saved before the split keep Nikkah with Barat', () => {
  assert.deepEqual(withEvents({ barat: true, walima: false }), {
    nikkah: true,
    barat: true,
    walima: false,
  });
  assert.deepEqual(withEvents({ nikkah: false, barat: true, walima: true }), {
    nikkah: false,
    barat: true,
    walima: true,
  });
});

test('contact numbers become international WhatsApp numbers', () => {
  assert.equal(whatsappNumber('+92 300 1234567'), '923001234567');
  assert.equal(whatsappNumber('0321-7654321'), '923217654321');
  assert.equal(whatsappNumber('0049 151 2345678'), '491512345678');
  assert.equal(whatsappNumber('+49 (151) 2345678'), '491512345678');
  assert.equal(whatsappNumber(''), '');
});
