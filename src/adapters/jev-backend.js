// src/adapters/jev-backend.js
// TypeSafe Jev backend — DORMANT but wired.
//
// Jev (TypeSafe AI's decision model) is WAITLIST-ONLY and NOT integrated.
// This backend is registered in the factory under 'jev' so the Jev-shaped
// interface stays real, but until an access key exists decide() returns an
// explicit dormant refusal — NEVER a fabricated decision.
//
// To enable later: new JevBackend({enabled:true, apiKey, endpoint}).
// Until then the UI shows it disabled with a "waitlist" label.

import { DecisionBackend } from './decision-adapter.js';

export class JevBackend extends DecisionBackend {
  constructor(options = {}) {
    super(options);
    this.name = 'jev';
    this.enabled = !!options.enabled;
    this.apiKey = options.apiKey || null;
    this.endpoint = options.endpoint || null;
  }

  get dormant() { return !(this.enabled && this.apiKey); }

  decide(text, _context = {}) {
    if (this.dormant) {
      return {
        error: 'dormant',
        reason: 'TypeSafe Jev is waitlist-only — no access configured',
        source_text: String(text),
        layer: 'jev',
      };
    }
    // Enabled path: a real Jev API call would happen here (server-side in v2).
    // This client build never fabricates a decision on Jev's behalf.
    return {
      error: 'dormant',
      reason: 'Jev backend enabled but has no live implementation in this client build',
      source_text: String(text),
      layer: 'jev',
    };
  }
}
