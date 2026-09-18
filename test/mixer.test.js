// test/mixer.test.js — mixer state transitions, clamping, destructive gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMixer } from '../src/mixer.js';
import { decide } from '../src/command.js';

test('mute/unmute transitions', () => {
  const m = createMixer();
  const r = m.apply(decide('mute singer'));
  assert.ok(r.applied && r.ok);
  assert.equal(m.getTrack('vocals').mute, true);
  m.apply(decide('unmute the singer'));
  assert.equal(m.getTrack('vocals').mute, false);
});

test('solo mutes the other tracks; unsolo restores', () => {
  const m = createMixer();
  m.apply(decide('solo the drums'));
  assert.equal(m.getTrack('drums').solo, true);
  assert.equal(m.getTrack('vocals').mute, true);
  assert.equal(m.getTrack('drums').mute, false);
  m.apply(decide('un-solo the drums'));
  assert.ok(Object.values(m.tracks).every(t => !t.solo && !t.mute));
});

test('set_reverb clamps 0..100', () => {
  const m = createMixer();
  const d = decide('set reverb on guitar to 150');
  d.target = 'guitar'; d.confidence = 0.9; // fully specified test decision
  const r = m.apply({ ...d, value: 150 });
  assert.ok(r.applied);
  assert.equal(m.getTrack('guitar').reverb, 100);
  const r2 = m.apply({ ...d, value: -20 });
  assert.equal(m.getTrack('guitar').reverb, 0);
});

test('set_pan clamps -100..100 and keeps sign', () => {
  const m = createMixer();
  m.apply({ action: 'set_pan', target: 'bass', value: -140, confidence: 0.95, destructive: false, source_text: 't', layer: 't' });
  assert.equal(m.getTrack('bass').pan, -100);
});

test('set_volume clamps 0..100', () => {
  const m = createMixer();
  const d = { action: 'set_volume', target: 'keys', value: 120, confidence: 0.95, destructive: false, source_text: 't', layer: 't' };
  m.apply(d);
  assert.equal(m.getTrack('keys').volume, 100);
});

test('destructive below 0.85 is refused by the mixer gate', () => {
  const m = createMixer();
  const d = decide('mute singer please'); // 0.65 destructive
  const r = m.apply(d);
  assert.equal(r.applied, false);
  assert.equal(r.reason, 'destructive-below-threshold');
  assert.equal(m.getTrack('vocals').mute, false);
});

test('transport: play / pause / stop', () => {
  const m = createMixer();
  m.apply({ action: 'play', target: null, value: null, confidence: 0.95, destructive: false, source_text: 'play', layer: 't' });
  assert.equal(m.transport, 'playing');
  m.apply({ action: 'pause', target: null, value: null, confidence: 0.95, destructive: false, source_text: 'break', layer: 't' });
  assert.equal(m.transport, 'paused');
  m.apply({ action: 'stop', target: null, value: null, confidence: 0.95, destructive: false, source_text: 'stop', layer: 't' });
  assert.equal(m.transport, 'stopped');
});

test('no_action and missing value/target are safe no-ops', () => {
  const m = createMixer();
  const r1 = m.apply(decide('blarg wobble'));
  assert.equal(r1.applied, false);
  assert.equal(r1.reason, 'no_action');
  const r2 = m.apply({ action: 'set_reverb', target: null, value: 25, confidence: 0.95, destructive: false, source_text: 't', layer: 't' });
  assert.equal(r2.reason, 'missing-target');
  const r3 = m.apply({ action: 'set_reverb', target: 'guitar', value: null, confidence: 0.95, destructive: false, source_text: 't', layer: 't' });
  assert.equal(r3.reason, 'missing-value');
});

test('applyAll executes a batch and returns per-clause records', () => {
  const m = createMixer();
  const ds = [
    { action: 'mute', target: 'vocals', value: null, confidence: 0.95, destructive: true, source_text: 'a', layer: 't' },
    { action: 'set_volume', target: 'guitar', value: 80, confidence: 0.95, destructive: false, source_text: 'b', layer: 't' },
  ];
  const rs = m.applyAll(ds);
  assert.equal(rs.length, 2);
  assert.ok(rs.every(r => r.applied));
  assert.equal(m.getTrack('vocals').mute, true);
  assert.equal(m.getTrack('guitar').volume, 80);
});

test('result records carry before/after state', () => {
  const m = createMixer();
  const r = m.apply({ action: 'set_volume', target: 'guitar', value: 80, confidence: 0.95, destructive: false, source_text: 't', layer: 't' });
  assert.equal(r.before.volume, 80);
  assert.equal(r.after.volume, 80);
  const r2 = m.apply({ action: 'set_volume', target: 'guitar', value: 40, confidence: 0.95, destructive: false, source_text: 't', layer: 't' });
  assert.equal(r2.before.volume, 80);
  assert.equal(r2.after.volume, 40);
});
