# Command Vocabulary Spec — cwi-voice-command v1 (mixer domain)

Derived from the command pattern Black approved in the Jev/Jamcat demo
(2026-09-18): short spoken imperatives — "mute singer", "set reverb 25%",
"pan it 50% to the left" — that must drive a UI instantly.

## Tracks (targets)
`vocals` · `drums` · `guitar` · `bass` · `keys` · `synth` · `horns` ·
`percussion` · `master`

**Aliases (canonical in parentheses):** singer (vocals), vox (vocals),
kick/snare/hats/toms (drums), keys/piano (keys), everything/all (master),
it = last referenced track (anaphora, one step back only).

## Actions
| action | params | example | destructive |
|---|---|---|---|
| `mute` | target | "mute singer" | yes |
| `unmute` | target | "unmute the drums" | no |
| `solo` | target | "solo the drums" | yes (mutes others) |
| `unsolo` | target | "un-solo the vocals" | no |
| `set_reverb` | target, value 0–100 (%) | "set reverb 25%" | no |
| `set_pan` | target, value −100..+100 (% L/R) | "pan it 50% to the left" | no |
| `set_volume` | target, value 0–100 (%) | "turn up the guitar to 80" | no |
| `play` | — | "play" / "drop it" | no |
| `stop` | — | "stop" / "cut it" | no |
| `pause` | — | "break" | no |
| `no_action` | — | anything unrecognized | — |

## Parameter grammar
- Percentages: `25%`, `25 percent`, `twenty five percent` (v1: digits + `%`/`percent`; word-numbers are a v2 extension, tested as unsupported).
- Pan direction: "to the left" = negative, "to the right" = positive; bare "pan X%" keeps current side sign; default target side = left when ambiguous and confidence allows, else confirm.
- Ranges clamp; out-of-range values clamp to bounds (never error).

## Compound commands
v1 supports single commands only. Multi-clause input ("mute singer, break, solo guitar") is split on clause boundaries and each clause is decided independently; the batch applies atomically only if EVERY clause clears the threshold — otherwise the whole batch goes to confirm. This is a deliberate safety rule, recorded here so it can't be "simplified" away later.
