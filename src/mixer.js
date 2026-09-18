// src/mixer.js
// DOM-free mixer state. createMixer() -> mixer.
// apply(decision) executes non-destructive and high-confidence destructive
// actions, returns a result record. Values clamp, never error.

import { TRACKS } from './adapters/local-classifier.js';

const clampNum = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function createMixer() {
  const tracks = {};
  for (const t of TRACKS) {
    tracks[t] = { mute: false, solo: false, reverb: 0, pan: 0, volume: 80 };
  }
  let transport = 'stopped'; // playing | stopped | paused

  function getTrack(name) { return TRACKS.includes(name) ? tracks[name] : null; }

  function apply(d) {
    const rec = {
      ok: false, applied: false, action: d.action, target: d.target,
      value: d.value, reason: null, before: null, after: null,
    };
    if (!d || d.action === 'no_action') { rec.reason = 'no_action'; return rec; }

    // Destructive gate: mute/solo act only at high confidence (>= 0.85).
    if (d.destructive && !(d.confidence >= 0.85)) {
      rec.reason = 'destructive-below-threshold';
      return rec;
    }

    const needsTarget = ['mute', 'unmute', 'solo', 'unsolo', 'set_reverb', 'set_pan', 'set_volume'].includes(d.action);
    if (needsTarget && !getTrack(d.target)) { rec.reason = 'missing-target'; return rec; }

    const t = d.target ? tracks[d.target] : null;
    rec.before = t ? { ...t } : { transport };

    switch (d.action) {
      case 'mute': t.mute = true; break;
      case 'unmute': t.mute = false; break;
      case 'solo':
        for (const name of TRACKS) {
          tracks[name].solo = name === d.target;
          tracks[name].mute = name !== d.target; // solo mutes the others
        }
        break;
      case 'unsolo':
        for (const name of TRACKS) { tracks[name].solo = false; tracks[name].mute = false; }
        break;
      case 'set_reverb':
        if (d.value === null || d.value === undefined) { rec.reason = 'missing-value'; return rec; }
        t.reverb = clampNum(Math.round(d.value), 0, 100);
        break;
      case 'set_pan':
        if (d.value === null || d.value === undefined) { rec.reason = 'missing-value'; return rec; }
        t.pan = clampNum(Math.round(d.value), -100, 100);
        break;
      case 'set_volume':
        if (d.value === null || d.value === undefined) { rec.reason = 'missing-value'; return rec; }
        t.volume = clampNum(Math.round(d.value), 0, 100);
        break;
      case 'play': transport = 'playing'; break;
      case 'stop': transport = 'stopped'; break;
      case 'pause': transport = 'paused'; break;
      default: rec.reason = 'unknown-action'; return rec;
    }

    rec.after = t ? { ...t } : { transport };
    rec.ok = true;
    rec.applied = true;
    return rec;
  }

  function applyAll(decisions) { return decisions.map(apply); }

  return {
    tracks,
    get transport() { return transport; },
    getTrack,
    apply,
    applyAll,
    snapshot() {
      const s = {};
      for (const t of TRACKS) s[t] = { ...tracks[t] };
      s.transport = transport;
      return s;
    },
  };
}
