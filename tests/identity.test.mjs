import test from 'node:test';
import assert from 'node:assert/strict';
import {pointKey, pointKeyParts} from '../dist/identity.js';

test('fast domain keys preserve canonical JSON and never merge delimiter/Unicode identities', () => {
  const values = ['', 'simple', 'a|b', 'a,b', '"', '\\', '\0', '\n', 'España', '日本語', '😀', '\ud800', '\udfff'];
  for (const seriesId of values) for (const pointId of values) {
    const expected = JSON.stringify([seriesId, pointId]);
    assert.equal(pointKey({seriesId, pointId}), expected);
    assert.equal(pointKeyParts(seriesId, pointId), expected);
  }
  assert.notEqual(pointKeyParts('a|b', 'c'), pointKeyParts('a', 'b|c'));
  let seed = 123;
  const random = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed;};
  const text = () => Array.from({length: random() % 16}, () => String.fromCharCode(random() % 65536)).join('');
  for (let i = 0; i < 2000; i++) {const s = text(), p = text(); assert.equal(pointKeyParts(s, p), JSON.stringify([s, p]));}
});
