// test/handover.test.js — threshold policy + confirm/escalate state machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandover, ACT_THRESHOLD, CONFIRM_THRESHOLD } from '../src/handover.js';
import { decide, decideBatch } from '../src/command.js';
import { createEscalationAdapter } from '../src/adapters/llm-escalation.js';

test('threshold constants match the documented policy', () => {
  assert.equal(ACT_THRESHOLD, 0.85);
  assert.equal(CONFIRM_THRESHOLD, 0.60);
});

test('>= 0.85 -> act, state stays command', () => {
  const h = createHandover();
  assert.equal(h.route(decide('mute singer')), 'act');
  assert.equal(h.getState(), 'command');
});

test('confirm band -> confirm, pending holds the decision', () => {
  const h = createHandover();
  const d = decide('mute singer please');
  assert.equal(h.route(d), 'confirm');
  assert.equal(h.getState(), 'confirm');
  assert.deepEqual(h.getPending().decisions, [d]);
});

test('destructive in confirm band always confirms (no destructive fast-lane)', () => {
  const h = createHandover();
  const d = decide('solo the drums please'); // destructive, 0.65
  assert.ok(d.destructive);
  assert.ok(d.confidence < 0.85 && d.confidence >= 0.60);
  assert.equal(h.route(d), 'confirm');
});

test('< 0.60 / no_action -> escalate, clarification produced, TTS spoken', () => {
  let spoken = null;
  const tts = { speak: (t) => { spoken = t; return { spoken: true }; }, cancel() {}, isSupported: () => true };
  const h = createHandover({ escalation: createEscalationAdapter('local-template'), tts });
  assert.equal(h.route(decide('blarg wobble zzz')), 'escalate');
  assert.equal(h.getState(), 'escalated');
  const c = h.getClarification();
  assert.equal(c.type, 'clarify');
  assert.ok(c.question.length > 0);
  assert.ok(spoken !== null, 'TTS should speak the clarification');
});

test('escalation clarification names the ambiguous target (template-based)', () => {
  const h = createHandover({ escalation: createEscalationAdapter('local-template') });
  h.route(decide('mute zynth')); // low-confidence mute, no target
  const c = h.getClarification();
  assert.equal(c.templateBased, true);
  assert.match(c.label, /not an LLM/);
});

test('confirm flow: yes -> act with the pending decision; no -> discard', () => {
  const h = createHandover();
  h.route(decide('mute singer please'));
  const yes = h.resolveYesNo(true);
  assert.equal(yes.route, 'act');
  assert.equal(yes.decisions.length, 1);
  assert.equal(h.getState(), 'command');
  h.route(decide('mute singer please'));
  const no = h.resolveYesNo(false);
  assert.equal(no.route, 'discard');
  assert.equal(h.getState(), 'command');
});

test('resolveYesNo outside confirm state discards', () => {
  const h = createHandover();
  assert.equal(h.resolveYesNo(true).route, 'discard');
});

test('routeBatch: mixed bands -> whole batch confirms (atomic)', () => {
  const h = createHandover();
  const batch = decideBatch('mute singer, break'); // 0.95 + 0.75
  assert.equal(h.routeBatch(batch), 'confirm');
  assert.equal(h.getPending().decisions.length, 2);
  const yes = h.resolveYesNo(true);
  assert.equal(yes.route, 'act');
  assert.equal(yes.decisions.length, 2);
});

test('routeBatch: all act-eligible -> act; empty batch -> confirm', () => {
  const h = createHandover();
  assert.equal(h.routeBatch(decideBatch('mute singer, solo guitar')), 'act');
  assert.equal(h.routeBatch([]), 'confirm');
});
