// src/adapters/stt-adapter.js
// Speech-to-text adapter. Interface: { start(onFinal, onInterim), stop(), isSupported() }
//
// Backends:
//   'web-speech' — browser Web Speech API (v1 active). Audio may leave the
//                   device for the browser vendor's speech service — that is
//                   the browser's service, not ours.
//   'mock'       — scripted transcripts, for tests and latency measurement.
//   'whisper'    — DORMANT stub: documented future, labeled unimplemented.

export const STT_BACKENDS = ['web-speech', 'mock', 'whisper'];

function webSpeechBackend() {
  let recognition = null;
  const supported = () =>
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  return {
    name: 'web-speech',
    isSupported: supported,
    start(onFinal, onInterim, onError) {
      if (!supported()) return { ok: false, error: 'unsupported', reason: 'Web Speech API not available in this environment' };
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SR();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (e) => {
        const res = e.results[e.results.length - 1];
        const text = res[0].transcript;
        if (res.isFinal) onFinal && onFinal(text);
        else onInterim && onInterim(text);
      };
      recognition.onerror = (e) => onError && onError(e);
      recognition.onend = () => { recognition = null; };
      recognition.start();
      return { ok: true };
    },
    stop() { if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; } },
  };
}

function mockBackend() {
  const queue = [];
  return {
    name: 'mock',
    isSupported: () => true,
    // script a transcript for the next start() — deterministic, synchronous
    queueTranscript(t) { queue.push(String(t)); },
    start(onFinal, onInterim) {
      const t = queue.length ? queue.shift() : '';
      if (onInterim) onInterim(t);
      if (onFinal) onFinal(t);
      return { ok: true, backend: 'mock' };
    },
    stop() {},
  };
}

function dormantSTTBackend(name, reason) {
  return {
    name,
    isSupported: () => false,
    start() { return { ok: false, error: 'dormant', reason }; },
    stop() {},
  };
}

export function createSTT(name = 'web-speech', _options = {}) {
  if (name === 'web-speech') return webSpeechBackend();
  if (name === 'mock') return mockBackend();
  if (name === 'whisper') {
    return dormantSTTBackend('whisper', 'Whisper STT backend is unimplemented in v1 — documented future only');
  }
  throw new Error(`unknown STT backend: '${name}'`);
}

export function checkSTTShape(b) {
  const errors = [];
  if (!b || typeof b !== 'object') return ['not an object'];
  if (typeof b.start !== 'function') errors.push('start() missing');
  if (typeof b.stop !== 'function') errors.push('stop() missing');
  if (typeof b.isSupported !== 'function') errors.push('isSupported() missing');
  return errors;
}
