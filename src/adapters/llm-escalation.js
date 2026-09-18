// src/adapters/llm-escalation.js
// Escalation backend for below-threshold decisions — the conversational lane.
//
// Input:  { transcript, lowConfidenceDecision }
// Output: { type:'clarify', question, ... } | { type:'resolved', decision } | { type:'dormant', reason }
//
// Modes:
//   'local-template' ($0 v1 default): deterministic clarification-question
//     generator built from the low-confidence decision. Honestly labeled as
//     template-based — it is NOT an LLM and never claims to be one.
//   'api': OpenAI-compatible endpoint + key. DORMANT until configured:
//     refuses cleanly without credentials, never fakes a response.

export const ESCALATION_MODES = ['local-template', 'api'];

const ACTION_PHRASE = {
  mute: 'mute', unmute: 'unmute', solo: 'solo', unsolo: 'un-solo',
  set_reverb: 'set reverb', set_pan: 'pan', set_volume: 'set volume',
  play: 'play', stop: 'stop', pause: 'pause', no_action: 'do',
};

export function templateClarify(transcript, d) {
  if (!d || d.action === 'no_action') {
    return {
      type: 'clarify',
      question: "Didn't catch that — say it again?",
      transcript: transcript || '',
      mode: 'local-template',
      templateBased: true,
      label: 'template-based clarification (not an LLM)',
    };
  }
  const verb = ACTION_PHRASE[d.action] || d.action;
  const targetPart = d.target ? ` the *${d.target}*` : '';
  let valuePart = '';
  if (d.value !== null && d.value !== undefined) {
    valuePart = d.action === 'set_pan'
      ? ` ${Math.abs(d.value)}% to the ${d.value < 0 ? 'left' : 'right'}`
      : ` to ${d.value}%`;
  }
  return {
    type: 'clarify',
    question: `Did you mean ${verb}${targetPart}${valuePart}?`,
    transcript: transcript || '',
    lowConfidenceDecision: d,
    mode: 'local-template',
    templateBased: true,
    label: 'template-based clarification (not an LLM)',
  };
}

export function createEscalationAdapter(mode = 'local-template', options = {}) {
  if (!ESCALATION_MODES.includes(mode)) throw new Error(`unknown escalation mode: '${mode}'`);
  return {
    mode,
    produce({ transcript = '', lowConfidenceDecision = null } = {}) {
      if (mode === 'local-template') {
        return templateClarify(transcript, lowConfidenceDecision);
      }
      // 'api' mode — dormant until a key exists
      if (!options.enabled || !options.apiKey) {
        return {
          type: 'dormant',
          reason: 'LLM escalation API is unconfigured — no key set. Enable with apiKey to use a real LLM.',
          mode: 'api',
        };
      }
      // A real implementation would POST to options.endpoint here (v2, server-side).
      return {
        type: 'dormant',
        reason: 'LLM escalation API mode has no live implementation in this client build.',
        mode: 'api',
      };
    },
  };
}
