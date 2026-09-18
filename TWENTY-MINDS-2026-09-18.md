# Twenty Minds — Voice-Command Mixer Prototype: (A) client-side-only static web app vs (B) Pipecat-style server pipeline

Decision question: Should CWI build the voice-command mixer prototype as (A) a client-side-only static web app — browser Web Speech API for mic speech-to-text + a local Jev-shaped decision layer (typed decision + confidence + threshold escalation) in zero-dependency JS, hosted on GitHub Pages — or (B) a Pipecat-style server pipeline with STT/decisions on a server over WebRTC/websocket?

Pre-run lean: (A) client-side-only — the fastest $0 path to the 7-day phone-demo kill rule, matching every house shipping precedent.

Facts (max 5):
1. Black approved "do all of it": a working end-to-end phone demo (speak command → UI updates in under 1 second) must be live by 2026-09-25 or the lane is killed — he wants to open a live demo on his phone and talk to it within ~1 minute.
2. Hard constraints: $0 paths only, no spending, no wallet signing; Jev (TypeSafe AI's decision model) is waitlist-only and NOT integrated — the decision layer must have a Jev-shaped interface (typed decision + confidence score + threshold escalation) with a working $0 implementation now, slottable later.
3. CWI already owns carrier-side voice plumbing (cwi-voice-bridge: Twilio playout pacing, 25/25 tests green, public repo live) — the prototype documents the bridge as the downstream telephony path, it does not re-verify it.
4. House precedent: zero-dependency UMD/vanilla JS engines, static GitHub Pages hosting, all tests green before deploy, byte-identical served files, honest labels (LIVE vs SAMPLE), receipts for everything, never ship simulations as products.
5. The demo domain is a music mixer (Black is a producer): commands like "mute singer", "set reverb 25%", "pan it 50% to the left" driving a mixer UI instantly; a destructive-command mistake (e.g. muting the wrong track live) is the key failure mode the design must handle via confidence thresholds and escalation.

### Verdicts (one sentence + one risk each)

1. Skeptic — Pick A, because the entire decision collapses on the kill rule: a server STT pipeline cannot be built, tested green, and demoed on his phone in 7 days at $0, while the Web Speech API path ships this week — the only thing that could falsify this is recognition quality too poor for short mixer commands, and short commands are exactly what it does best.
   Risk: the demo works in rehearsal and chokes on mic permissions or room noise the moment Black actually talks to it on his phone.
2. Data scientist — Pick A, because the kill rule is binary and measured (live by 2026-09-25, sub-second response), and A is the only option with a timeline that fits the constraint at all — B has no estimated delivery date, only architecture.
   Risk: we have no measured latency baseline for Web Speech API on his actual device, so "under 1 second" is currently an assumption dressed as a plan.
3. User advocate — Pick A, because Black asked to open a demo on his phone and talk to it within a minute — A is a URL he taps; B is infrastructure he can neither see nor show anyone.
   Risk: a browser page that feels like a toy erodes trust in the lane even when the underlying tech works.
4. Contrarian — Pick B, because the whole point is a Jev-shaped decision layer, and a real decision engine deserves real server-side intelligence — a client-side pattern matcher risks being exactly the simulation Black forbids shipping.
   Risk: B blows the 7-day clock, the kill rule fires, and the lane dies — process theater at full speed.
5. Engineer — Pick A, because zero-dependency vanilla JS on Pages is the exact stack the house already ships, tests, and debugs — one repo, no server to fall over at demo time, no deploy pipeline to babysit.
   Risk: the Web Speech API is a browser dependency we cannot version-pin, so a Chrome or iOS update can break recognition with zero warning.
6. Economist — Pick A, because at a $0 budget A's marginal cost per demo is zero and scales free, while B compounds hosting, TURN relay, and STT costs the moment anyone actually uses it.
   Risk: the $0 ceiling makes us skip the server learning we may need later, raising the future rebuild cost when demand arrives.
7. Security reviewer — Pick A, because its attack surface is a static page with no backend to compromise, while B exposes a WebRTC/websocket endpoint and an audio pipeline to the open internet.
   Risk: A trusts the browser's mic-permissions model entirely — any permission-prompt confusion on his phone becomes a failure staged in front of the founder.
8. Child-of-five explainer — Pick A, because "talk to the page and the mixer moves" is a sentence a five-year-old understands, while "your voice goes to our server farm and comes back" is a bedtime story nobody believes.
   Risk: if the choice can't be explained simply, the explanation isn't the problem — the architecture is.
9. 10-year historian — Pick A, because in 2036 the record will read that CWI shipped the voice mixer on a static page in days and proved demand before ever renting a server.
   Risk: the historian's narrative rewards shipping speed and buries the server work that may have made it a real product later.
10. Devil's accountant — Pick A, because B's true cost is never the prototype — it is the server someone babysits forever, the uptime burden, and the bandwidth bill that starts the day the demo gets shared.
    Risk: A's hidden cost is the demo that works so well nobody funds v2, and the lane stalls on its own success.
11. Field operator — Pick A, because my worst Tuesday is "demo day and the server is down" — A has no server, so demo day is just a URL that already worked yesterday.
    Risk: on A's worst Tuesday the mic stops recognizing speech in a noisy room and there is no server log to read — just silence and a shrug.
12. Systems thinker — Pick A, because it decouples the demo from the plumbing CWI already owns: the cwi-voice-bridge telephony path stays downstream documentation, not a blocker, so nothing breaks elsewhere.
    Risk: success creates a fork — the client demo and the telephony pipeline evolve separately until someone must reconcile two architectures.
13. Risk underwriter — Pick A, because the tail risk that kills this lane is missing the 7-day deadline, and B prices that tail at near-certainty while A prices it at near-zero.
    Risk: A underwrites the wrong tail — a destructive-command mistake (muting the wrong track live) shipped with decorative confidence thresholds could do the actual damage the kill rule never measured.
14. Open-source maintainer — Pick A, because strangers can read, fork, and run a static page in seconds — a server-pipeline repo is a README full of "deploy your own infra" that nobody trusts.
    Risk: forking a demo that only works with one browser's speech service makes the "open source" label only half honest.
15. Negotiator — Pick A, because the other side — the deadline — does not negotiate: 7 days is the walk-away, A is the only bid that meets it, and B has no leverage.
    Risk: negotiating only with the clock concedes quality terms we will pay for later.
16. Time traveler (2036) — Pick A, because looking back, the voice mixer that mattered started as the phone demo Black showed people — the server came after demand, not before it.
    Risk: the traveler remembers the demo and forgets that the server version was the one that actually shipped as a product.
17. First-principles physicist — Pick A, because what must be true is the physics of time: 7 days and $0 admit exactly one architecture — code that runs where the microphone already is, with no wire in between.
    Risk: physics also says on-device recognition is the accuracy ceiling, and the decision layer deserves better input than the browser's guesses.
18. Ethicist — Pick A, because keeping voice audio on the device is the privacy-respecting default — no recordings leave his phone for a server we operate.
    Risk: "on-device" is only as private as the browser vendor's speech service, which may send the audio to their cloud anyway.
19. Competitor analyst — Pick A, because the strongest competitor's demo is a video — ours is a URL Black opens on his phone and talks to, the one thing they cannot match without infrastructure.
    Risk: they watch our demo, copy it in an afternoon, and out-spend us on the server version we skipped.
20. Black's chair — Pick A, because results only, $0 first, fire always: a phone demo in days with receipts beats a pipeline architecture that misses the deadline and gets the lane killed.
    Risk: "fire always" fires the demo, but the destructive-command handling must be real engineering — a threshold knob set to pass the demo is a simulation, and he will check.

### Synthesis
- Decision: Build (A) the client-side-only static web app — browser Web Speech API plus a genuine local Jev-shaped decision layer (typed decision + confidence + threshold escalation) in zero-dependency JS on GitHub Pages — with destructive commands gated by confidence thresholds and escalation, and the cwi-voice-bridge documented as the downstream telephony path.
- Why: the engineer's precedent fit (the exact stack the house ships and debugs), the field operator's demo-day read (no server to be down), and Black's chair's results-only ruling (the kill rule is binary and only A fits it) converged — speed-to-verified-demo is the decision's only non-negotiable term.
- Dissent recorded: the contrarian's strongest minority — a client-side matcher risks being the simulation Black forbids, so the decision layer must be real (parsed intent, scored confidence, low-confidence escalation on destructive commands) with the Jev slot genuine, and the server pipeline stays the documented v2 once the demo proves demand.
- Confidence: high — fact that would change it: if the Web Speech API fails to deliver sub-second command recognition on Black's actual phone in real testing, flip to B.
- Changed the pre-run lean? no
