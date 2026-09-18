// src/adapters/local-classifier.js
// The $0 rule-based decision backend. Deterministic, zero-dep, DOM-free.
// Same module runs in Node tests and the browser demo.
//
// Confidence math (EXACT per docs/decision-interface.md):
//   base 0.50 for recognizing a known verb
//   +0.20 if the target is an exact track/alias match
//   +0.15 if a required parameter parsed cleanly (or none required)
//   +0.10 if the full input is consumed by the grammar (no leftover words)
//   -0.20 if any word is unrecognized (unknown tokens are suspicion, not noise)
//   clamp to [0.05, 0.99] — the local layer never claims 1.0

import { DecisionBackend } from './decision-adapter.js';

export const LAYER = 'local-classifier-v1';

export const TRACKS = [
  'vocals', 'drums', 'guitar', 'bass', 'keys', 'synth', 'horns', 'percussion', 'master',
];

const ALIASES = {
  singer: 'vocals', vox: 'vocals',
  kick: 'drums', snare: 'drums', hat: 'drums', hats: 'drums', tom: 'drums', toms: 'drums',
  piano: 'keys', keyboard: 'keys', keyboards: 'keys',
  horn: 'horns',
  everything: 'master', all: 'master', mix: 'master',
};

// Function words: grammatical glue, never counted as unknown tokens.
const STOP = new Set([
  'the', 'a', 'an', 'to', 'on', 'for', 'my', 'it', 'up', 'down',
  'now', 'just', 'kindly', 'of', 'with', 'at', 'me', 'some', 'bit', 'way',
  'over', 'here', 'left', 'right', 'percent',
]);

// Verb table: patterns are token arrays, matched longest-first.
const VERBS = [
  { action: 'unmute', destructive: false, patterns: [['unmute']] },
  { action: 'unsolo', destructive: false, patterns: [['unsolo']] },
  { action: 'mute', destructive: true, patterns: [['mute']] },
  { action: 'solo', destructive: true, patterns: [['solo']] },
  { action: 'set_reverb', destructive: false, patterns: [['set', 'reverb'], ['add', 'reverb'], ['reverb']] },
  { action: 'set_pan', destructive: false, patterns: [['set', 'pan'], ['pan']] },
  { action: 'set_volume', destructive: false, patterns: [['turn', 'up'], ['turn', 'down'], ['set', 'volume'], ['volume'], ['louder'], ['quieter'], ['boost']] },
  { action: 'play', destructive: false, patterns: [['drop', 'it'], ['play'], ['start']] },
  { action: 'stop', destructive: false, patterns: [['cut', 'it'], ['cut'], ['stop']] },
  { action: 'pause', destructive: false, patterns: [['pause'], ['break'], ['hold']] },
];

const NEEDS_PARAM = new Set(['set_reverb', 'set_pan', 'set_volume']);

function tokenize(text) {
  return String(text).toLowerCase()
    .replace(/-/g, '')              // un-solo -> unsolo
    .replace(/[^a-z0-9%\s]/g, ' ')  // keep % for "25%"
    .split(/\s+/)
    .filter(Boolean);
}

function matchVerb(tokens) {
  const pats = [];
  for (const v of VERBS) for (const p of v.patterns) pats.push({ v, p });
  pats.sort((a, b) => b.p.length - a.p.length); // longest first
  for (const { v, p } of pats) {
    for (let i = 0; i <= tokens.length - p.length; i++) {
      if (p.every((t, j) => tokens[i + j] === t)) return { verb: v, start: i, end: i + p.length };
    }
  }
  return null;
}

function resolveTarget(tokens, context) {
  for (const t of tokens) {
    if (TRACKS.includes(t)) return { target: t, exact: true, word: t };
    if (ALIASES[t]) return { target: ALIASES[t], exact: true, word: t };
  }
  // anaphora: "it" = last referenced track, one step back only
  if (tokens.includes('it') && context.lastTarget && TRACKS.includes(context.lastTarget)) {
    return { target: context.lastTarget, exact: true, word: 'it', anaphora: true };
  }
  return { target: null, exact: false, word: null };
}

function parseNumber(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const m = tokens[i].match(/^(\d{1,3})(%?)$/);
    if (m) {
      const consumed = [i];
      if (m[2] !== '%' && tokens[i + 1] === 'percent') consumed.push(i + 1);
      return { value: parseInt(m[1], 10), consumed };
    }
  }
  return { value: null, consumed: [] };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function splitClauses(text) {
  // clause boundaries: comma / semicolon / "then" / "and then" / "and"
  return String(text).split(/[,;]|\band then\b|\bthen\b|\band\b/i)
    .map(s => s.trim())
    .filter(Boolean);
}

export class LocalClassifier extends DecisionBackend {
  constructor(options = {}) {
    super(options);
    this.name = 'local';
  }

  decide(text, context = {}) {
    const source_text = String(text);
    const tokens = tokenize(source_text);

    const vm = matchVerb(tokens);
    if (!vm) {
      // No known verb: no_action, low confidence — escalate, never guess.
      return {
        action: 'no_action', target: null, value: null,
        confidence: 0.10, destructive: false,
        source_text, layer: LAYER,
      };
    }

    const { verb, start, end } = vm;
    const consumed = new Set();
    for (let i = start; i < end; i++) consumed.add(i);

    // target
    const rest = tokens.filter((_, i) => !consumed.has(i));
    const ti = resolveTarget(rest, context);
    if (ti.word) {
      const idx = tokens.indexOf(ti.word);
      if (idx >= 0) consumed.add(idx);
    }

    // parameter (number)
    const num = parseNumber(tokens.filter((_, i) => !consumed.has(i)));
    // map num.consumed back onto absolute token indices
    const remaining = tokens.map((t, i) => i).filter(i => !consumed.has(i));
    let value = null;
    let paramClean = false;
    if (NEEDS_PARAM.has(verb.action)) {
      if (num.value !== null) {
        paramClean = true;
        value = num.value;
        for (const c of num.consumed) consumed.add(remaining[c]);
        if (verb.action === 'set_pan') {
          const left = tokens.includes('left');
          const right = tokens.includes('right');
          const sign = left ? -1 : right ? 1 : (context.lastPanSign ?? -1); // default left when ambiguous
          value = sign * value;
          const di = tokens.findIndex(t => t === 'left' || t === 'right');
          if (di >= 0) consumed.add(di);
        }
      }
    }

    // unknown tokens: anything left over that isn't grammatical glue
    const unknown = tokens.filter((t, i) => !consumed.has(i) && !STOP.has(t));

    // confidence: verb 0.50 + exact target 0.20 + clean param 0.15
    //           + full consumption 0.10 - unknown tokens 0.20, clamp [0.05, 0.99]
    let c = 0.50;
    if (ti.exact) c += 0.20;
    if (!NEEDS_PARAM.has(verb.action) || paramClean) c += 0.15;
    if (unknown.length === 0) c += 0.10;
    if (unknown.length > 0) c -= 0.20;
    c = clamp(c, 0.05, 0.99);

    return {
      action: verb.action,
      target: ti.target,
      value,
      confidence: Math.round(c * 100) / 100,
      destructive: verb.destructive,
      source_text,
      layer: LAYER,
    };
  }

  // Compound input: split on clause boundaries, decide each clause.
  // Anaphora context flows clause-to-clause (lastTarget / lastPanSign).
  // Atomicity is enforced by the handover layer, not here.
  decideBatch(text, context = {}) {
    const clauses = splitClauses(text);
    const ctx = { ...context };
    return clauses.map(clause => {
      const d = this.decide(clause, ctx);
      if (d.target) ctx.lastTarget = d.target;
      if (d.action === 'set_pan' && typeof d.value === 'number' && d.value !== 0) {
        ctx.lastPanSign = Math.sign(d.value);
      }
      return d;
    });
  }
}
