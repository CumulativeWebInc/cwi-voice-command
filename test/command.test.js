// test/command.test.js — decision layer: vocabulary, aliases, params, confidence bands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, decideBatch, splitClauses } from '../src/command.js';
import { createHandover } from '../src/handover.js';

test('mute singer: action/target/destructive/layer/shape', () => {
  const d = decide('mute singer');
  assert.equal(d.action, 'mute');
  assert.equal(d.target, 'vocals'); // alias resolution
  assert.equal(d.destructive, true);
  assert.equal(d.layer, 'local-classifier-v1');
  assert.equal(d.source_text, 'mute singer');
  assert.ok(d.confidence >= 0.85, `exact command should clear 0.85, got ${d.confidence}`);
});

test('alias resolution: vox/kick/piano/everything', () => {
  assert.equal(decide('solo the vox').target, 'vocals');
  assert.equal(decide('mute kick').target, 'drums');
  assert.equal(decide('unmute the piano').target, 'keys');
  assert.equal(decide('solo everything').target, 'master');
});

test('percent parsing: "25%" and "25 percent"', () => {
  const a = decide('set reverb 25%', {});
  const b = decide('set reverb 25 percent', {});
  assert.equal(a.value, 25);
  assert.equal(b.value, 25);
  assert.equal(a.action, 'set_reverb');
  assert.equal(b.action, 'set_reverb');
});

test('pan direction: "to the left" is negative, "to the right" is positive', () => {
  const l = decide('pan drums 50 to the left');
  const r = decide('pan drums 50 to the right');
  assert.equal(l.value, -50);
  assert.equal(r.value, 50);
  assert.equal(l.action, 'set_pan');
});

test('bare pan keeps sign from context; defaults left when ambiguous', () => {
  const withCtx = decide('pan guitar 30', { lastPanSign: 1 });
  assert.equal(withCtx.value, 30);
  const bare = decide('pan guitar 30');
  assert.equal(bare.value, -30); // default left per vocabulary spec
});

test('anaphora: "it" = last referenced track', () => {
  const ctx = {};
  const first = decide('solo guitar', ctx);
  ctx.lastTarget = first.target;
  const second = decide('pan it 50% to the left', ctx);
  assert.equal(second.target, 'guitar');
  assert.equal(second.value, -50);
});

test('exact targeted command clears 0.85 (act band)', () => {
  for (const t of ['solo the drums', 'mute singer', 'unmute the bass']) {
    const d = decide(t);
    assert.ok(d.confidence >= 0.85, `${t} -> ${d.confidence}`);
  }
});

test('partial/ambiguous input lands in confirm band [0.60, 0.85)', () => {
  const d = decide('mute singer please'); // unknown token "please"
  assert.ok(d.confidence >= 0.60 && d.confidence < 0.85, `got ${d.confidence}`);
  assert.equal(d.action, 'mute');
});

test('garbage -> no_action with confidence < 0.60', () => {
  const d = decide('blarg wobble zzz');
  assert.equal(d.action, 'no_action');
  assert.ok(d.confidence < 0.60, `got ${d.confidence}`);
  assert.equal(d.destructive, false);
});

test('unknown track word pays the suspicion penalty (< 0.60)', () => {
  const d = decide('mute zynth');
  assert.equal(d.action, 'mute');
  assert.equal(d.target, null);
  assert.ok(d.confidence < 0.60, `got ${d.confidence}`);
});

test('transport verbs: play / drop it / break / cut it', () => {
  assert.equal(decide('play').action, 'play');
  assert.equal(decide('drop it').action, 'play');
  assert.equal(decide('break').action, 'pause');
  assert.equal(decide('cut it').action, 'stop');
});

test('un-solo / unmute are non-destructive', () => {
  const a = decide('un-solo the vocals');
  const b = decide('unmute the drums');
  assert.equal(a.action, 'unsolo');
  assert.equal(b.action, 'unmute');
  assert.equal(a.destructive, false);
  assert.equal(b.destructive, false);
});

test('set reverb without target: params clean, confirm band', () => {
  const d = decide('set reverb 25%');
  assert.equal(d.action, 'set_reverb');
  assert.equal(d.value, 25);
  assert.equal(d.target, null);
  assert.ok(d.confidence >= 0.60 && d.confidence < 0.85, `got ${d.confidence}`);
});

test('compound: split on comma/"then", decide each clause', () => {
  assert.deepEqual(splitClauses('mute singer, break, solo guitar'), ['mute singer', 'break', 'solo guitar']);
  assert.deepEqual(splitClauses('mute singer and then solo guitar'), ['mute singer', 'solo guitar']);
  const batch = decideBatch('mute singer, break, solo guitar');
  assert.equal(batch.length, 3);
  assert.equal(batch[0].action, 'mute');
  assert.equal(batch[1].action, 'pause');
  assert.equal(batch[2].action, 'solo');
  for (const d of batch) assert.equal(d.layer, 'local-classifier-v1');
});

test('compound atomicity: one weak clause -> whole batch confirms', () => {
  const h = createHandover();
  const batch = decideBatch('mute singer, solo zzz'); // 'zzz' unknown -> weak clause
  assert.ok(batch.some(d => d.confidence < 0.85));
  assert.equal(h.routeBatch(batch), 'confirm');
  assert.equal(h.getState(), 'confirm');
});

test('compound atomicity: all strong -> whole batch acts', () => {
  const h = createHandover();
  const batch = decideBatch('mute singer, solo guitar');
  assert.ok(batch.every(d => d.confidence >= 0.85));
  assert.equal(h.routeBatch(batch), 'act');
});

test('destructive in confirm band always confirms (never acts)', () => {
  const h = createHandover();
  const d = decide('mute singer please'); // 0.65, destructive
  assert.ok(d.destructive);
  assert.equal(h.route(d), 'confirm');
});

test('decide is deterministic: same input, same output', () => {
  const a = decide('pan it 50% to the left', { lastTarget: 'vocals' });
  const b = decide('pan it 50% to the left', { lastTarget: 'vocals' });
  assert.deepEqual(a, b);
});
