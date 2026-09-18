// test/adapters.test.js — adapter layer: conformance, hot-swap, dormant backends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDecisionAdapter, listDecisionBackends,
  assertDecisionShape, isDormantRefusal,
} from '../src/adapters/decision-adapter.js';
import { createConfig } from '../src/config.js';
import { createEscalationAdapter, templateClarify } from '../src/adapters/llm-escalation.js';
import { createSTT, checkSTTShape } from '../src/adapters/stt-adapter.js';
import { createTTS, checkTTSShape } from '../src/adapters/tts-adapter.js';

test('registry lists the local + jev backends', () => {
  const names = listDecisionBackends();
  assert.ok(names.includes('local'));
  assert.ok(names.includes('jev'));
});

test('conformance: local classifier decisions pass the Decision shape', () => {
  const b = createDecisionAdapter('local');
  for (const t of ['mute singer', 'pan it 50% to the left', 'blarg wobble', 'set reverb 25 percent']) {
    assertDecisionShape(b.decide(t, { lastTarget: 'guitar' }));
  }
});

test('config default selects local; hot-swap keeps the interface shape', () => {
  const cfg = createConfig();
  assert.equal(cfg.snapshot().decision, 'local');
  const before = cfg.getDecisionAdapter().decide('mute singer');
  assertDecisionShape(before);
  // hot-swap local -> local re-instantiates without reload; shape identical
  cfg.setBackend('decision', 'local');
  const after = cfg.getDecisionAdapter().decide('mute singer');
  assert.deepEqual(after, before);
});

test('jev without credentials: explicit dormant refusal, never fabricated', () => {
  const b = createDecisionAdapter('jev');
  const r = b.decide('mute singer');
  assert.ok(isDormantRefusal(r));
  assert.match(r.reason, /waitlist-only/);
  assert.ok(!('confidence' in r) || r.error === 'dormant', 'must not fabricate a decision');
  assert.notEqual(r.layer, undefined);
  assert.equal(r.layer, 'jev');
});

test('config refuses to activate jev without a key', () => {
  const cfg = createConfig();
  assert.throws(() => cfg.setBackend('decision', 'jev'), /waitlist-only/);
  assert.equal(cfg.snapshot().jevDormant, true);
});

test('llm-escalation local-template: clarification question, honestly labeled', () => {
  const esc = createEscalationAdapter('local-template');
  const low = { action: 'mute', target: null, value: null, confidence: 0.45, destructive: true, source_text: 'mute zynth', layer: 'local-classifier-v1' };
  const out = esc.produce({ transcript: 'mute zynth', lowConfidenceDecision: low });
  assert.equal(out.type, 'clarify');
  assert.ok(out.question.includes('mute'));
  assert.equal(out.templateBased, true);
  assert.match(out.label, /not an LLM/);
  assert.equal(out.mode, 'local-template');
});

test('llm-escalation local-template on no_action asks to repeat', () => {
  const out = templateClarify('blarg wobble', { action: 'no_action' });
  assert.equal(out.type, 'clarify');
  assert.match(out.question, /say it again/);
});

test('llm-escalation api without key: dormant refusal, never faked', () => {
  const esc = createEscalationAdapter('api', {});
  const out = esc.produce({ transcript: 'mute singer', lowConfidenceDecision: null });
  assert.equal(out.type, 'dormant');
  assert.match(out.reason, /unconfigured/);
});

test('STT mock: interface conformance + scripted transcripts', () => {
  const stt = createSTT('mock');
  assert.deepEqual(checkSTTShape(stt), []);
  assert.equal(stt.isSupported(), true);
  stt.queueTranscript('mute singer');
  let final = null, interim = null;
  const r = stt.start((t) => { final = t; }, (t) => { interim = t; });
  assert.equal(r.ok, true);
  assert.equal(final, 'mute singer');
  assert.equal(interim, 'mute singer');
});

test('STT whisper: dormant stub refuses explicitly', () => {
  const stt = createSTT('whisper');
  assert.equal(stt.isSupported(), false);
  const r = stt.start(() => {});
  assert.equal(r.error, 'dormant');
});

test('TTS off: interface conformance, silent', () => {
  const tts = createTTS('off');
  assert.deepEqual(checkTTSShape(tts), []);
  assert.equal(tts.speak('hello').spoken, false);
});

test('TTS pipecat-voice: dormant stub', () => {
  const tts = createTTS('pipecat-voice');
  assert.equal(tts.isSupported(), false);
  assert.equal(tts.speak('hello').error, 'dormant');
});

test('config refuses to activate unimplemented backends', () => {
  const cfg = createConfig();
  assert.throws(() => cfg.setBackend('stt', 'whisper'), /unimplemented/);
  assert.throws(() => cfg.setBackend('tts', 'pipecat-voice'), /unimplemented/);
  assert.throws(() => cfg.setBackend('decision', 'nope'), /unknown/);
});
