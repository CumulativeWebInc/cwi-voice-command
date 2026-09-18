// src/adapters/tts-adapter.js
// Text-to-speech adapter. Interface: { speak(text), cancel(), isSupported() }
//
// Backends:
//   'browser'      — window.speechSynthesis (v1 active). The escalation lane
//                    genuinely TALKS its clarification questions at $0.
//   'off'          — silent.
//   'pipecat-voice'— DORMANT stub: documented v2 server voice path.

export const TTS_BACKENDS = ['browser', 'off', 'pipecat-voice'];

function browserBackend() {
  const supported = () =>
    typeof window !== 'undefined' && !!window.speechSynthesis;
  return {
    name: 'browser',
    isSupported: supported,
    speak(text) {
      if (!supported() || !text) return { spoken: false, error: 'unsupported' };
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text).replace(/\*/g, ''));
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
        return { spoken: true };
      } catch (e) {
        return { spoken: false, error: String(e && e.message || e) };
      }
    },
    cancel() { if (supported()) { try { window.speechSynthesis.cancel(); } catch (_) {} } },
  };
}

function offBackend() {
  return {
    name: 'off',
    isSupported: () => true,
    speak(_text) { return { spoken: false, backend: 'off' }; },
    cancel() {},
  };
}

function dormantTTSBackend(name, reason) {
  return {
    name,
    isSupported: () => false,
    speak(_text) { return { spoken: false, error: 'dormant', reason }; },
    cancel() {},
  };
}

export function createTTS(name = 'browser', _options = {}) {
  if (name === 'browser') return browserBackend();
  if (name === 'off') return offBackend();
  if (name === 'pipecat-voice') {
    return dormantTTSBackend('pipecat-voice', 'Pipecat voice backend is the v2 server path — unimplemented in v1');
  }
  throw new Error(`unknown TTS backend: '${name}'`);
}

export function checkTTSShape(b) {
  const errors = [];
  if (!b || typeof b !== 'object') return ['not an object'];
  if (typeof b.speak !== 'function') errors.push('speak() missing');
  if (typeof b.cancel !== 'function') errors.push('cancel() missing');
  if (typeof b.isSupported !== 'function') errors.push('isSupported() missing');
  return errors;
}
