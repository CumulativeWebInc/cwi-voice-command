// src/config.js
// Runtime config: selects one backend per adapter lane, hot-swappable.
// The command pipeline calls only the interfaces, never a concrete backend.

import {
  registerBackend, createDecisionAdapter, listDecisionBackends,
} from './adapters/decision-adapter.js';
import { LocalClassifier } from './adapters/local-classifier.js';
import { JevBackend } from './adapters/jev-backend.js';
import { createEscalationAdapter, ESCALATION_MODES } from './adapters/llm-escalation.js';
import { createSTT, STT_BACKENDS } from './adapters/stt-adapter.js';
import { createTTS, TTS_BACKENDS } from './adapters/tts-adapter.js';

// Register the decision backends once (local-classifier must NOT import the
// registry module, to avoid an import cycle — registration lives here).
registerBackend('local', LocalClassifier);
registerBackend('jev', JevBackend);

export const DECISION_LABELS = {
  local: 'Local $0',
  jev: 'Jev — dormant (waitlist-only, not integrated)',
};
export const STT_LABELS = {
  'web-speech': 'Web Speech',
  mock: 'Mock',
  whisper: 'Whisper — unimplemented',
};
export const TTS_LABELS = {
  browser: 'Browser',
  off: 'Off',
  'pipecat-voice': 'Pipecat voice — unimplemented',
};
export const ESCALATION_LABELS = {
  'local-template': 'Local template',
  api: 'LLM API — unconfigured',
};

export function createConfig(overrides = {}) {
  const state = {
    decision: 'local',
    stt: 'web-speech',
    tts: 'browser',
    escalation: 'local-template',
    // Jev: waitlist-only, not integrated. Dormant until enabled + key.
    jev: { enabled: false, apiKey: null, endpoint: null },
    // LLM escalation: dormant until a key exists.
    llm: { enabled: false, apiKey: null, endpoint: null },
    ...overrides,
  };

  let decisionAdapter = null;

  function assertLane(kind, name, valid) {
    if (!valid.includes(name)) throw new Error(`unknown ${kind} backend: '${name}' (valid: ${valid.join(', ')})`);
  }

  // Hot-swap a backend at runtime — no reload. Throws on unknown names or
  // on attempts to activate a dormant backend.
  function setBackend(kind, name) {
    if (kind === 'decision') {
      assertLane(kind, name, listDecisionBackends());
      if (name === 'jev' && !(state.jev.enabled && state.jev.apiKey)) {
        throw new Error("cannot activate 'jev': waitlist-only, not integrated — no access configured");
      }
      state.decision = name;
      decisionAdapter = null; // force rebuild on next get
    } else if (kind === 'stt') {
      assertLane(kind, name, STT_BACKENDS);
      if (name === 'whisper') throw new Error("cannot activate 'whisper': unimplemented in v1");
      state.stt = name;
    } else if (kind === 'tts') {
      assertLane(kind, name, TTS_BACKENDS);
      if (name === 'pipecat-voice') throw new Error("cannot activate 'pipecat-voice': unimplemented in v1");
      state.tts = name;
    } else if (kind === 'escalation') {
      assertLane(kind, name, ESCALATION_MODES);
      if (name === 'api' && !(state.llm.enabled && state.llm.apiKey)) {
        throw new Error("cannot activate LLM 'api' escalation: no key configured");
      }
      state.escalation = name;
    } else {
      throw new Error(`unknown adapter lane: '${kind}'`);
    }
    return snapshot();
  }

  function getDecisionAdapter() {
    if (!decisionAdapter) {
      const opts = state.decision === 'jev' ? state.jev : {};
      decisionAdapter = createDecisionAdapter(state.decision, opts);
      decisionAdapter._backendName = state.decision;
    }
    return decisionAdapter;
  }

  function snapshot() {
    return {
      decision: state.decision, stt: state.stt, tts: state.tts, escalation: state.escalation,
      decisionLabel: DECISION_LABELS[state.decision],
      sttLabel: STT_LABELS[state.stt],
      ttsLabel: TTS_LABELS[state.tts],
      escalationLabel: ESCALATION_LABELS[state.escalation],
      jevDormant: !(state.jev.enabled && state.jev.apiKey),
    };
  }

  return {
    state,
    setBackend,
    getDecisionAdapter,
    getSTT: () => createSTT(state.stt),
    getTTS: () => createTTS(state.tts),
    getEscalation: () => createEscalationAdapter(state.escalation, state.llm),
    snapshot,
  };
}
