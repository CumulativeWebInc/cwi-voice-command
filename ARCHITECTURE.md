# ARCHITECTURE — cwi-voice-command v1

## The split: command agent (does) vs conversational agent (talks)

Two lanes, one handoff:

- **Command lane** — short spoken imperatives ("mute singer", "pan it 50% to the left").
  Fast path: STT final transcript → decision backend → threshold policy →
  mixer applies instantly. Target: sub-second, on-device, $0.
- **Conversational lane** — everything below threshold. The escalation adapter
  produces a clarification ("Did you mean mute the *singer*?"), spoken aloud via
  browser TTS; the user's next utterance resolves **in context** (anaphora —
  "it" = last track — carries across turns). v1 clarification is
  template-based and labeled as such: it clarifies only, no generation.

## The Adapter Layer (the foundation)

Every lane is behind an explicit first-class adapter. Each adapter exposes a
fixed interface; each lane has swappable backends selected by `src/config.js`
and hot-swappable at runtime with no reload. The pipeline calls only the
interfaces, never a concrete backend.

| Lane | Interface module | Backends (v1) |
|---|---|---|
| Decision | `src/adapters/decision-adapter.js` — `decide(text, context) -> Decision`, backend registry, `createDecisionAdapter(name)`, shape-conformance suite | `local` ($0 rule-based, active) · `jev` (dormant, waitlist-only) |
| Escalation | `src/adapters/llm-escalation.js` — `produce({transcript, lowConfidenceDecision})` | `local-template` ($0, active, honestly labeled template-based) · `api` (dormant until a key exists) |
| STT | `src/adapters/stt-adapter.js` — `{start(onFinal,onInterim), stop(), isSupported()}` | `web-speech` (browser Web Speech API, active) · `mock` (scripted transcripts, tests/latency) · `whisper` (dormant stub) |
| TTS | `src/adapters/tts-adapter.js` — `{speak(text), cancel(), isSupported()}` | `browser` (speechSynthesis, active) · `off` (silent) · `pipecat-voice` (dormant stub, v2 server voice) |

**Dormant-backend policy (hard rule):** a backend that cannot operate — no
credentials, waitlist-only, unimplemented — returns an explicit dormant
refusal (`{error:'dormant', reason}`), NEVER a fabricated decision. Dormant
options render disabled in the UI with "waitlist"/"unconfigured" labels.

## Pipecat-style handover (`src/handover.js`)

States: `command` → `confirm` → `command`, or `command` → `escalated` →
`command`. `route(decision)` returns `act | confirm | escalate`; `routeBatch`
enforces atomicity (ALL clauses must clear 0.85 or the whole batch confirms);
`resolveYesNo(yes)` closes the confirm flow. Escalation calls the escalation
adapter and speaks the clarification — the conversational lane is real in v1,
not a dead stub.

## Threshold policy (per docs/decision-interface.md)

- `confidence >= 0.85` → **act** (destructive actions need ≥ 0.85 too — no fast lane)
- `0.60 <= confidence < 0.85` → **confirm** (destructive ALWAYS confirms here)
- `confidence < 0.60` → **escalate** (never act, never guess)

0.85 matches the threshold TypeSafe documents for Jev, keeping the local layer
behaviorally compatible with the future Jev backend.

## The Jev slot (waitlist-only, NOT integrated)

TypeSafe AI's Jev is waitlist-only and NOT integrated with this prototype.
`src/adapters/jev-backend.js` is registered under `'jev'` with the identical
Decision interface, but `decide()` without enablement + key returns an explicit
dormant refusal. The UI shows it disabled as "dormant (waitlist)". When waitlist
access arrives, a real Jev backend implements `decide(text, context)` and the
app selects it with one config flag — nothing else changes.

## Downstream telephony path: cwi-voice-bridge

This prototype is a **local demo, not PSTN/telephony**. The carrier-side voice
plumbing already exists and stays downstream:
https://github.com/CumulativeWebInc/cwi-voice-bridge (Twilio playout pacing,
25/25 tests green, public repo live). This prototype documents the bridge as
the telephony path; it does not re-verify it and makes no PSTN claims.

## v2 = server pipeline after the demo proves demand

The Twenty Minds dissent stands: the server pipeline (Pipecat-style,
Whisper-class STT, real LLM escalation, `pipecat-voice` TTS, Jev backend live)
is the documented v2 — built only after the v1 phone demo proves demand, per
the 2026-09-25 kill rule. The adapter layer is what makes v2 a backend swap
instead of a rewrite.
