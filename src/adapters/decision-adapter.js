// src/adapters/decision-adapter.js
// DecisionAdapter interface — the first-class foundation of cwi-voice-command.
//
// Every decision backend emits the IDENTICAL typed Decision + confidence shape,
// selected by config, hot-swappable at runtime (no reload). The command pipeline
// calls only this interface, never a concrete backend.
//
// Contract: decide(text, context) -> Decision
//
// Decision shape (per docs/decision-interface.md):
//   {
//     action:      string,   // vocabulary action, or 'no_action'
//     target:      string|null,
//     value:       number|null,
//     confidence:  number,   // 0..1
//     destructive: boolean,  // true for mute/solo (state-destroying if wrong)
//     source_text: string,   // the exact transcript this came from
//     layer:       string    // 'local-classifier-v1' | 'jev' (future) | ...
//   }
//
// Dormant-backend policy: a backend that cannot operate (no credentials,
// waitlist-only, unimplemented) MUST return an explicit dormant refusal
// ({error:'dormant', reason}) — it must NEVER fabricate a Decision.

export const DECISION_ACTIONS = [
  'mute', 'unmute', 'solo', 'unsolo',
  'set_reverb', 'set_pan', 'set_volume',
  'play', 'stop', 'pause',
  'no_action',
];

export class DecisionBackend {
  constructor(options = {}) {
    this.options = options;
    this.name = 'base';
  }
  /** @returns {Decision} or {error:'dormant', reason:string} */
  decide(_text, _context = {}) {
    throw new Error('DecisionBackend.decide() not implemented');
  }
  /** true if this backend is dormant (refuses instead of deciding) */
  get dormant() { return false; }
}

const registry = new Map();

export function registerBackend(name, BackendClass) {
  if (typeof BackendClass !== 'function') throw new Error('BackendClass must be a constructor');
  registry.set(name, BackendClass);
}

export function listDecisionBackends() { return [...registry.keys()]; }

export function createDecisionAdapter(name, options = {}) {
  const Cls = registry.get(name);
  if (!Cls) throw new Error(`unknown decision backend: '${name}'`);
  return new Cls(options);
}

// --- interface conformance: every real decision must pass this ---
export function checkDecisionShape(d) {
  const errors = [];
  if (!d || typeof d !== 'object') return ['not an object'];
  if (!DECISION_ACTIONS.includes(d.action)) errors.push(`bad action: ${d.action}`);
  if (!(d.target === null || typeof d.target === 'string')) errors.push('target must be string|null');
  if (!(d.value === null || typeof d.value === 'number')) errors.push('value must be number|null');
  if (typeof d.confidence !== 'number' || d.confidence < 0 || d.confidence > 1)
    errors.push('confidence must be a number in [0,1]');
  if (typeof d.destructive !== 'boolean') errors.push('destructive must be boolean');
  if (typeof d.source_text !== 'string' || d.source_text.length === 0)
    errors.push('source_text must be a non-empty string');
  if (typeof d.layer !== 'string' || d.layer.length === 0) errors.push('layer must be a non-empty string');
  const mustDestructive = d.action === 'mute' || d.action === 'solo';
  if (mustDestructive && d.destructive !== true) errors.push(`${d.action} must be destructive`);
  return errors;
}

export function assertDecisionShape(d) {
  const errors = checkDecisionShape(d);
  if (errors.length) throw new Error('Decision shape violation: ' + errors.join('; '));
  return true;
}

export function isDormantRefusal(r) {
  return !!r && typeof r === 'object' && r.error === 'dormant' && typeof r.reason === 'string';
}
