// src/command.js
// Command pipeline entry point (backwards-compatible surface).
// Delegates to the local classifier — the default decision backend.
// For hot-swappable backends use src/config.js instead.

import { LocalClassifier, splitClauses, LAYER } from './adapters/local-classifier.js';

export { LAYER, splitClauses };

const defaultClassifier = new LocalClassifier();

/** decide a single-clause command: text -> Decision */
export function decide(text, context = {}) {
  return defaultClassifier.decide(text, context);
}

/** decide compound input: splits on clause boundaries, decides each clause */
export function decideBatch(text, context = {}) {
  return defaultClassifier.decideBatch(text, context);
}
