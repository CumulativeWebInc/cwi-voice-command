# Decision-Layer Interface — Jev-shaped, $0 now, swappable later

TypeSafe AI's Jev (decision model, launched 2026-09-15) is **waitlist-only
and NOT integrated**. This interface is modeled on Jev's documented shape —
typed decision + confidence — so a real Jev backend can be slotted in later
without touching the app. Nothing here claims a Jev integration exists.

## Decision object (the contract)
```js
{
  action:      string,   // one of the vocabulary actions, or 'no_action'
  target:      string|null,
  value:       number|null,
  confidence:  number,   // 0..1
  destructive: boolean,   // true for mute/solo (state-destroying if wrong)
  source_text: string,   // the exact transcript this came from
  layer:       string    // 'local-classifier-v1' | 'jev' (future) | ...
}
```

## Threshold policy (the escalation ladder)
- `confidence >= 0.85` → **act** immediately. (Destructive actions need
  >= 0.85 too; there is no destructive fast-lane.)
- `0.60 <= confidence < 0.85` → **confirm**: show the parsed command
  ("Mute *singer*?") and act only on explicit yes. Destructive actions
  in this band ALWAYS confirm.
- `confidence < 0.60` → **escalate**: hand to the conversational lane
  ("Didn't catch that — say it again?"). Never act, never guess.

Why 0.85: it is the threshold TypeSafe documents for Jev; matching it keeps
the local layer behaviorally compatible with the future Jev backend.

## v1 implementation: `local-classifier-v1` ($0, deterministic, zero-dep)
Rule-based: normalize → verb match → track alias match → parameter regex.
Confidence is computed from match quality, NOT from vibes:
- base 0.50 for recognizing a known verb
- +0.20 if the target is an exact track/alias match
- +0.15 if a required parameter parsed cleanly (or none required)
- +0.10 if the full input is consumed by the grammar (no leftover words)
- −0.20 if any word is unrecognized (unknown tokens are suspicion, not noise)
- clamp to [0.05, 0.99] — the local layer never claims 1.0

Deterministic: same input → same decision, always. Testable in Node with
zero dependencies. The browser demo imports the same module the tests run.

## Future: `jev` backend
Implements `decide(text) → Decision` against TypeSafe's API. The app selects
the layer by a single flag; the UI labels which layer is active. Until the
waitlist opens and a key exists, `jev` is a documented stub — labeled as
such in the UI and README, never implied to work.
