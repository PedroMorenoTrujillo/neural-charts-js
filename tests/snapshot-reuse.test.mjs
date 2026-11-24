import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../dist/planning.js';

test('owned snapshots reuse equal data without trusting mutable input identity', () => {
  const input = {series: [{id: 's', data: [{id: 'a', value: 1}, {id: 'b', value: 2}]}]};
  const before = snapshot(input);
  assert.equal(snapshot(input, false, before), before);
  assert.equal(snapshot(structuredClone(input), false, before), before);
  assert.equal(snapshot(before), before);
  input.series[0].data[0].value = 3;
  const next = snapshot(input, false, before);
  assert.notEqual(next, before);
  assert.equal(next.series[0].data[1], before.series[0].data[1]);
  assert.equal(before.series[0].data[0].value, 1);
  assert.equal(next.series[0].data[0].value, 3);
});

test('reuse never skips accessors, sparse arrays, key changes or bounded validation', () => {
  const original = snapshot({a: [1, 2]});
  let reads = 0;
  const getter = Object.defineProperty({}, 'a', {enumerable: true, get() {reads++; return [1, 2];}});
  assert.throws(() => snapshot(getter, false, original)); assert.equal(reads, 0);
  assert.throws(() => snapshot({a: Array(2)}, false, original));
  assert.throws(() => snapshot({a: [1, NaN]}, false, original));
  const renamed = snapshot({b: [1, 2]}, false, original);
  assert.deepEqual(Object.keys(renamed), ['b']);
  const permitted = snapshot({a: undefined}, true);
  assert.throws(() => snapshot(permitted));
  const reordered = snapshot({b: 2, a: 1});
  assert.equal(snapshot({a: 1, b: 2}, false, reordered), reordered);
});

test('deeply frozen input is retained only after validation, shallow freezing is never trusted', () => {
  const frozen = Object.freeze({data: Object.freeze([Object.freeze({x: 1, y: 2})])});
  assert.equal(snapshot(frozen), frozen); assert.equal(snapshot(frozen), frozen);
  const child = {x: 1}, shallow = Object.freeze({child});
  const first = snapshot(shallow); assert.notEqual(first, shallow);
  child.x = 3; assert.equal(snapshot(shallow).child.x, 3); assert.equal(first.child.x, 1);
});

test('repeating owned fragments or nesting them deeper cannot bypass the original resource budget', () => {
  const fragment = snapshot(Array.from({length: 40000}, (_, i) => ({id: String(i), value: i})));
  assert.throws(() => snapshot({first: fragment, second: fragment, third: fragment}), /INPUT_LIMIT/);
  let nested = {value: 1}; for (let i = 0; i < 63; i++) nested = {nested};
  const owned = snapshot(nested);
  assert.throws(() => snapshot({a: {b: owned}}), /INPUT_LIMIT/);
});

test('dense XY snapshots preserve array order and charge reused point records', () => {
  const input = Array.from({length: 33000}, (_, x) => ({id: String(x), x, y: x}));
  const original = snapshot({input});
  const changed = [...input];
  changed[100] = {...changed[100], y: -1};
  const next = snapshot({input: changed}, false, original);
  assert.equal(next.input[100].y, -1);
  assert.equal(next.input[101], original.input[101]);
  assert.throws(() => snapshot({first: original.input, second: original.input}), /INPUT_LIMIT/);

  const reversedKeys = new Proxy(input.slice(0, 3), {ownKeys: () => ['1', '0', '2', 'length']});
  assert.deepEqual(snapshot(reversedKeys).map(point => point.x), [0, 1, 2]);
  let reads = 0;
  Object.defineProperty(changed, '32999', {enumerable: true, get() { reads++; return input[32999]; }});
  assert.throws(() => snapshot({input: changed}, false, original), /ACCESSOR_NOT_ALLOWED/);
  assert.equal(reads, 0);
});
