import assert from 'node:assert/strict';
import test from 'node:test';
import { gestureIntent } from '../dist/gestures.js';
import { horizontalViewportScroll, viewportZoomLevel } from '../dist/viewport-scroll.js';

const box = { left: 10, top: 30, width: 100, height: 200 };
const state = (axes, reversed = {}) => ({ axes, reversed: { x: false, y: false, ...reversed } });

test('Gesture intents transpose horizontal bars and preserve the direction of reversed axes', () => {
  const intent = (viewport, bar) => gestureIntent(viewport, bar, box, 30, 80, 10, -50, 2);
  assert.deepEqual(intent(state('xy'), false), {
    type: 'transform', factor: 2, anchor: { x: .2, y: .75 }, delta: { x: -.1, y: -.25 },
  });
  assert.deepEqual(intent(state('xy', { x: true, y: true }), false), {
    type: 'transform', factor: 2, anchor: { x: .8, y: .25 }, delta: { x: .1, y: .25 },
  });
  assert.deepEqual(intent(state('xy'), true), {
    type: 'transform', factor: 2, anchor: { x: .25, y: .2 }, delta: { x: .25, y: -.1 },
  });
  assert.deepEqual(intent(state('x', { x: true }), true).anchor, { x: .75 });
  assert.deepEqual(intent(state('y', { y: true }), true).delta, { y: .1 });
  assert.deepEqual(gestureIntent(state('xy'), true, box, -10, 250, 0, 0, 1).anchor, { x: 1, y: 0 });
});

test('Viewport scroll retains numeric and logarithmic windows in their own coordinate spaces', () => {
  const viewport = {
    ...state('xy'),
    bounds: { x: { type: 'linear', domain: [0, 100] }, y: { type: 'log', domain: [1, 10000] } },
    displayed: { x: [20, 60], y: [10, 1000] },
    value: { x: [20, 60], y: [10, 1000] },
  };
  const numeric = horizontalViewportScroll(viewport, false);
  assert.equal(numeric.axis, 'x');
  assert.equal(numeric.position, 333);
  assert.equal(numeric.visible, .4);
  assert.equal(numeric.delta(0), -.5);
  const logarithmic = horizontalViewportScroll({ ...viewport, reversed: { x: false, y: true } }, true);
  assert.equal(logarithmic.axis, 'y');
  assert.equal(logarithmic.position, 500);
  assert.ok(Math.abs(logarithmic.visible - .5) < 1e-12);
  assert.ok(Math.abs(logarithmic.delta(1000) + .5) < 1e-12);
  assert.equal(viewportZoomLevel(viewport), 2.5);
  assert.equal(horizontalViewportScroll({ ...viewport, axes: 'y' }, false), undefined);
  assert.equal(horizontalViewportScroll({ ...viewport, displayed: { x: [0, 100] } }, false), undefined);
  assert.equal(horizontalViewportScroll({ ...viewport, displayed: {} }, true), undefined);
});
