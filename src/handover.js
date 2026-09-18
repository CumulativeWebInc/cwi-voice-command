// src/handover.js
// Command <-> conversational lane handover state machine (Pipecat-style).
// States: command | confirm | escalated
//
// route(decision) -> 'act' | 'confirm' | 'escalate'
//   confidence >= 0.85            -> act (destructive needs >= 0.85 too)
//   0.60 <= confidence < 0.85    -> confirm (destructive ALWAYS confirms here)
//   confidence < 0.60 / no_action -> escalate: the escalation adapter (default
//     local-template) produces a SPOKEN clarification via TTS; the next
//     utterance resolves in context (anaphora applies).
// routeBatch(decisions) -> 'act' | 'confirm'
//   ATOMIC: every clause must be act-eligible, else the WHOLE batch confirms.
// resolveYesNo(yes) resolves the confirm flow back to command state.

export const ACT_THRESHOLD = 0.85;
export const CONFIRM_THRESHOLD = 0.60;

export function createHandover({ escalation = null, tts = null } = {}) {
  let state = 'command';
  let pending = null;       // { decisions: [...] }
  let clarification = null; // last escalation output

  function route(d) {
    if (!d || d.action === 'no_action' || d.confidence < CONFIRM_THRESHOLD) {
      return escalate(d);
    }
    if (d.confidence >= ACT_THRESHOLD) {
      state = 'command';
      pending = null;
      return 'act';
    }
    state = 'confirm';
    pending = { decisions: [d] };
    return 'confirm';
  }

  function routeBatch(decisions) {
    const all = Array.isArray(decisions) ? decisions : [];
    const everyActs = all.length > 0 && all.every(d =>
      d && d.action !== 'no_action' && d.confidence >= ACT_THRESHOLD);
    if (everyActs) {
      state = 'command';
      pending = null;
      return 'act';
    }
    state = 'confirm';
    pending = { decisions: all };
    return 'confirm';
  }

  function escalate(d) {
    state = 'escalated';
    pending = null;
    clarification = escalation
      ? escalation.produce({ transcript: d ? d.source_text : '', lowConfidenceDecision: d })
      : { type: 'clarify', question: "Didn't catch that — say it again?", mode: 'fallback' };
    if (tts && clarification && clarification.question) {
      try { tts.speak(clarification.question); } catch (_) {}
    }
    return 'escalate';
  }

  // Resolve the confirm flow on explicit yes/no; returns to command state.
  function resolveYesNo(yes) {
    if (state !== 'confirm' || !pending) return { route: 'discard', decisions: [] };
    const decisions = pending.decisions;
    pending = null;
    state = 'command';
    return yes ? { route: 'act', decisions } : { route: 'discard', decisions: [] };
  }

  return {
    route, routeBatch, resolveYesNo, escalate,
    getState: () => state,
    getPending: () => pending,
    getClarification: () => clarification,
  };
}
