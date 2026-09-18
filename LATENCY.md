# LATENCY — measurement methodology

## What we measure (and what we don't)

Two numbers, both excluding STT:

1. **Parse latency (Node):** `decide()`/`decideBatch()` wall time on a set of
   representative commands, measured with `process.hrtime.bigint()` in Node.
   Run: a small script importing `src/command.js` (same module the page uses),
   timing N iterations per command, reporting median/p95. No network, no DOM.

2. **Command→DOM (headless Chromium):** page loaded with STT backend = `mock`
   and scripted transcripts injected (bypassing the microphone), measuring
   `performance.now()` from final-transcript delivery to state-applied +
   DOM-updated — the same readout the demo page shows live. STT excluded by
   construction.

**Plainly stated: iPhone STT latency is unmeasured.** The Web Speech API's
recognition time on Black's actual phone — network round-trip to the vendor's
speech service, room noise, mic-permission friction — is the largest unknown
in the "under 1 second" demo requirement and cannot be measured until the page
is opened on his device. The numbers below are browser-loopback only.

## Results — measured 2026-09-18 (deployer run)

### Parse latency (Node, same `src/` module)

`LocalClassifier.decide()` over 9 representative commands
(mute/solo/set_reverb/set_pan/set_volume/pause/confirm-band/escalate),
n=5000:

| metric | ms |
|---|---|
| p50 | 0.005 |
| p95 | 0.017 |
| mean | 0.009 |

The decision layer is effectively free — three orders of magnitude under
Jev's documented 70–500 ms, because it is a local rule matcher, not a model
call. This is the $0 v1 backend doing exactly what it claims.

### Command→DOM (headless Chromium, real page pipeline)

`/opt/meta-chromium/chrome` 152 headless, `file://` single-file bundle of the
exact page sources (`tools/make-bundle.py`; DOM/CSS/pipeline byte-identical),
driven via CDP: `window.CWI.pipeline(transcript)` → page's own
`performance.now()` readout (final transcript → decision → handover →
mixer → DOM paint). 11 transcripts × 20 rounds, n=220:

| metric | ms |
|---|---|
| p50 | 0.4 |
| p95 | 0.7 |
| mean | 0.46 |
| max | 2.9 |

Sub-millisecond end to end on loopback. The "under 1 second" demo budget is
therefore dominated entirely by STT — which is unmeasured until the page runs
on Black's iPhone (see below).

### iPhone (on-device, real mic)

| transcript | STT time | total to DOM | notes |
|---|---|---|---|
| _unmeasured_ | _unmeasured_ | _unmeasured_ | Run the page on-device; STT = browser Web Speech API round-trip |

**Kill-rule relevance:** if on-device STT consistently exceeds ~900 ms for
short mixer commands, the sub-second demo requirement fails on the STT leg —
the fix would be a different STT backend behind the STT adapter (documented
`whisper` slot), not the decision layer.
