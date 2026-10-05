# Signal upgrade TODO

Started 2026-10-05. Goal: the app shows **why** a chain has gain at almost every step — the
signal has peaks above its average, every stage adds a little noise, and you must keep the signal
between the noise and the clip level. First as numbers (Step A), then moving (Step B). Faster
drawing and an offline version come first, because Step B needs the first and the second is quick.

**Rules for every step** (from the user, 2026-10-05):
- Beginners first. If a realistic option makes the screen harder to read, pick the simpler one.
- Runs on anything that opens a web page — phone, tablet, cheap school laptop. No headphones,
  audio interface or pro gear may ever be needed.
- No server, no accounts, no user data. Chains are shared as files and links, as today.
- Sounds (later, Step C) are generated only: sine, noise, clicks. No samples, no recording.
- No new panels or modules around the canvas: the readings live on the cards and wires.

**How to work a step:** one step per session, on branch `signal-upgrade`. Run `bun run lint` +
`bun run build` (+ `bun test` once it exists), check the app in the browser, commit, tick the step
here. Update CLAUDE.md when a step changes what it describes.

---

## Decisions for Step A — decided 2026-10-05

- **D1 — Hum follows the signal**, like all noise: a fader turns signal and hum down together and
  the gap between them stays. Only fixing the cause (Ground Lift) removes it. (Today it "grows
  with every boost and never drops" — that rule goes.)
- **D2 — Sources.** A new **Generator** element (Sine / Noise / Click — changed after step 5, see there). **Microphone and Line
  Input get a Melodic / Percussive switch** (melodic: a voice, keys — a smaller gap between peak
  and average; percussive: drums — a big gap). **Instrument and Guitar Amp are guitars**: a fixed
  character, no switch.
- **D3 — Beginner shows nothing new.** No peak marks, noise or extra readings at Beginner; they
  start at Intermediate. So the Generator and the Melodic / Percussive switch are Intermediate
  too (at Beginner, Microphone and Line Input are melodic).
- **D4 — Clipping is judged on the peaks**: the bar (average) keeps today's colours, but a card
  clips as soon as its peaks reach the clip level. A drum sound at +10 dBu average now clips,
  where today it is only "hot". That is the lesson.
- **D5 — Beginner clips on the peaks too** (decided 2026-10-05, after step 3): at Beginner nobody
  sees the peaks, but D4 still makes a card red when they clip — a voice turns red at about
  +8 dBu average instead of +20, with no peak mark. Kept: red means "this distorts", which is
  true; the card's note / help text says "the loudest moments are clipping — turn it down". The
  engine works the same at every level (no level in the maths). Rejected: judging Beginner on the
  average as today — it calls a distorting signal fine, and the engine would depend on the level.

---

## ~~1. Draw only what changed~~ — done (2026-10-05)

Every card (through `useGraphSignal`, `useNodeChrome`, `NodePort`) listened to the whole `nodes`
and `edges` arrays, and `SignalChain` handed React Flow new handler functions and a new
`nodeOrigin={[0, 0]}` on every render — which React Flow passes on to every card. So every change,
even selecting a card, redrew the whole canvas, twice.

Now: the engine keeps last time's stage / wire object when a result comes out the same
(`keepUnchanged`, `utils/sameShape.ts`); cards read only their own piece (`useStage`, `useWire`,
narrow selectors in `useNodeChrome`, `useNodeName`, `useParams`, `NodePort`, `MasterBusNode`);
`useFlowElements` hands React Flow last time's node / wire object when nothing changed
(`keepSame`); `<ReactFlow>` gets only stable props (`useStableHandlers`, module constants).
CLAUDE.md → *Redraw only what changed* has the rules for new code.

Measured on a stress chain (8 channels × Mic → Preamp → HPF → EQ → Comp → Gate → De-esser → Fader
→ Pan into a Master Bus and two speakers: 75 cards, 74 wires), React work per change, dev mode
(StrictMode renders twice, so absolute times are several times what the real build does):

| Change | Card renders before → after | Time before → after |
|---|---|---|
| Compressor attack (no level changes) | 300 → 2 | 92 → 13 ms |
| Fader on one channel | 300 → 10 | 73 → 11 ms |
| Select a card | 300 → 7 | 89 → 5 ms |
| Preamp on one channel (10 cards downstream change) | 300 → 20 | 104 → 66 ms |

Wires: only those whose colour or shape changed redraw. The Preamp case is legitimately ~10 cards
(their readings change); what is left is each card's own drawing cost — EQ ~7 ms, Fader /
Compressor / Gate ~5 ms per render in dev mode — spread over knobs, curves and meters. Swapping the
animated meter bars for CSS made only 76 → 70 ms, so it was left; step 11 redraws the meters
outside React anyway.

How it was measured (for later steps): a temporary `<Profiler>` around `<App/>` summing
`actualDuration`, render counters in `useNodeChrome` / `NodePort` / `ChainEdge`, and store calls
from the browser console (`await import('/Learn_Signal-Chain/src/store/signalStore.ts')`).
Note: a hidden browser tab never measures the cards, so wires do not draw there.

Checked in the browser: knob drags, card drag (with snapping), right-click menu, drawing a wire
(only free inputs that can take it light up; a click in empty space adds a corner), landing it on
a bus (two −20 dBu wires → −14 dBu), unplugging from an input's ×, a Fader on a bus's L output
taking over L / R as Main Fader, undo. No console warnings; lint and build clean.

## ~~2. Use it offline~~ — done (2026-10-05), one check left for the user

No new packages (CI installs with `bun install --frozen-lockfile`, and `bun.lock` cannot be
updated on this machine): a small build plugin, `vite-offline.ts`, writes both files.
- **Keeps a copy** (`sw.js` + `public/manifest.webmanifest`): every file of the build is kept on
  the first visit; the page comes from the network first (so a new release shows at once — no
  "new version" note needed), the copy when offline. Browsers offer to install it.
- **One-file download** (`dist/learn-signal-chain.html`, ~820 kB, ~250 kB zipped): script, styles
  and icon inlined. File → *Download the app…* explains it in a dialog, then saves it as
  "Learn Signal Chain.html". In that copy the item is hidden and share links point to the site
  online (`ONLINE_URL`, `src/data/site.ts`).
- App icon: the header's green radio-waves tile (`public/icon.svg`, PNGs for phones). The old
  `favicon.svg` was Vite's default logo and is gone.

Checked with the production build (`preview` launch config): the service worker keeps all 10
files; **with the server shut down the app still opens fully**. (First try failed: the page asks
for its script and styles as cross-origin requests and the preview server answers
`Vary: Origin`, so the kept copies never matched — fixed with `ignoreVary`.) The one-file copy
renders with zero network requests. File menu item and dialog in place.

**Left for the user:** the browser pane cannot open files from disk, so double-click
`dist/learn-signal-chain.html` once (Chrome / Edge, and Firefox if at hand) and check that it opens
and works with Wi-Fi off.

## Step A — the signal carries peak, average and noise

## ~~3. Lock today's numbers with tests~~ — done (2026-10-05)

`bun test` (built into Bun, no new package) runs `src/signal/*.test.ts` — 201 tests, all passing
on the engine as it was:
- `engine.test.ts`: 19 reference chains with the level (in and out, both sides), health, domain,
  condition, role, gain reduction and hum at **every card** — channel strip (Mic → Preamp → EQ →
  Compressor → Fader → Master Bus → speakers, and the same bypassed), stereo Master Bus with Pan,
  Balance and Main Fader, a mono wire / a side wire on a stereo bus, DI ground loop / Ground Lift /
  hum through an ADC / guitar without a DI, ADC → DAC, digital near 0 dBFS, every wrong-domain
  condition, noise gate (closed, Range, at the threshold, open), limiter, linked stereo compressor,
  bus sums (+6 dB), Matrix Bus with send knobs, Pre / Post aux send, passive / active speakers;
  plus loops and "same result, same object" (step 1's redraw rule).
- `process.test.ts` (each card on one channel, the dynamics curves, Pan / Balance) and
  `levels.test.ts` (zones, readings, sums, taper).
- Readings that Step A changes **on purpose** are marked in the tables: `D1` (hum through a fader:
  2 lines) and `D4` (hot averages whose peaks would clip: 3 lines). Everything else must stay.
  Step 4 changes one line to read the average: `average()` in `engine.test.ts`, `run()` in
  `process.test.ts`.

Bun is not installed on this machine, so `npm run test:node` runs the same files with Node 22.18
(it strips the types itself): `test/node-hooks.ts` resolves extensionless imports and swaps
`bun:test` for `test/bun-test.ts`, a ~60-line stand-in on `node:test` with only the matchers the
tests use (Bun's meaning: `toEqual` skips undefined fields, `toBeCloseTo` to 2 decimals). CI runs
the real `bun test` (build-check.yml). `tsconfig.test.json` type-checks the tests in `tsc -b`.
Checked once with real Bun too (`npx bun@1.4.2 test`, an 86 MB download into npm's cache): 201
pass, 0 fail — the stand-in and Bun agree.

Checked that the tests bite: adding signals as power instead of voltage fails 14 of them. Writing
the tables found two stale lines in CLAUDE.md (HPF and EQ were described as a placeholder / a plain
sum; both are pink-noise level changes) — fixed.

## ~~4. Three readings per wire: peak, average, noise~~ — done (2026-10-05)

Every side of every wire carries `SideLevels` (`signal/levels.ts`): `peak`, `rms` (the old
number), `noise` — and `hum`, the hum part of the noise, kept apart for its glow (agreed with the
user: without it a gate or a fader would treat the hum unlike the noise). The numbers, agreed
before writing code:

| | Peaks above the average | Noise below the average |
|---|---|---|
| Microphone (a voice) | 12 dB | 66 dB (−126 dBu: the room and its own hiss) |
| Line Input (keys) | 12 dB | 80 dB |
| Instrument (a guitar) | 15 dB | 70 dB |

- Hiss added by each powered card to what arrives, before it does its job: −80 dBu, a Preamp
  −128 dBu. None from passive cards (DI Box, Pad, the switches, Pan, passive Speaker), digital
  stages, bypassed or unplugged cards; ADC / DAC on their analog side.
- Gains, faders, filters move all readings alike; dynamics put each reading through their curve;
  buses add the music as voltages, the noise as powers; peaks are flattened at +20 dBu / 0 dBFS.
- Well set (Mic → Preamp +50 → EQ → Gain → Fader → Master Bus → speaker): **60.4 dB**
  signal-to-noise, 18 dB headroom. Preamp 30 dB too low, made up with Gain +20 and Fader +10:
  **37.0 dB** — 23.4 dB lost. Beginner's default chain: 56 dB.
- D1: the hum follows the signal (−40 after the Preamp, −50 after a fader at −10). D4 / D5:
  `health` clips from the peaks — `getHealth(db, domain, peakDb)`, `healthOf(wire)` — at every
  level. Only the 5 marked test lines changed (2 × D1, 3 × D4); 62 new tests (263 in all, Node
  and real Bun).
- So the two ends of a wire agree, the UI judges health the same way: wire colours, port rings,
  input meters (`useStereoLevels`: `inHealth` / `outHealth`; `inPeak` → `inLevel`, the louder
  side's average), the overview face, the Master Bus / Pan L / R rows (`ChannelRow peak`).
  Nothing else on the cards changed.

Checked in the browser (an Advanced chain: guitar through a DI in a ground loop, voice through a
compressor and Pan, a line pushed to +10 dBu, Master Bus → Main Fader → speakers and Matrix
Bus): Pan knob drag, hum tags −80 → −40 → −50 → −53 with the glow, Ground Lift clears them all,
the +10 dBu line and the Master Bus red (peaks), the Main Fader hot, a limiter's input meter
"Clipping!" after the clipping Gain, overview faces; no console errors.

Original plan:

The engine (`signal/engine.ts`, `process.ts`) carries, per side, `{ peak, rms, noise }` instead
of one number. Today's number becomes `rms` (the average) — the tests from step 3 still pass.

- **Peak** = average + the sound's peak-to-average gap (sine 3 dB, voice ~12, noise ~12,
  clicks / drums ~18). Analog stages flatten peaks at the clip level (the gap shrinks = distortion).
- **Noise** = everything you hear when the music stops: hiss and hum together. Each source has
  its own; every analog stage adds its own small hiss (a preamp adds it before its gain, so a
  low preamp setting followed by a big boost later is clearly worse). Gain, faders, EQ move the
  noise together with the signal. Buses add the noise of every wire (+3 dB per doubling). Digital
  stages add none.
- Hum (decision D1) becomes part of the noise; the separate hum reading stays for the red glow.
- **Dynamics** work on each reading: a compressor turns down the peaks more than the average
  (the gap shrinks) and its makeup gain lifts the noise; a gate closes in the pauses, so the
  noise drops by its Range when the threshold sits between the noise and the signal; a limiter
  caps the peaks.
- Health (decision D4): clipping from the peaks; the rest from the average as today — at every
  level, Beginner too (D5).
- Signal-to-noise = average − noise. Headroom = clip level − peak.
- Pick the noise numbers so that a well-set chain ends near 60 dB signal-to-noise and the
  classic mistake (preamp 30 dB too low, made up later with a fader / gain) loses at least 20 dB.
  Tests for both.

## ~~5. Sources: the Generator and the Melodic / Percussive switch~~ — done (2026-10-05)

- **Generator** (Intermediate and up, `generator`): a full card — its Sound as three stacked
  buttons, each with a picture of the sound (a sine wave, noise, short pulses), and a Level knob,
  −60 … +20 dBu, default 0 dBu (unity). Peaks above the average: Sine 3 dB, Noise 12, Click 18;
  its own noise 90 dB below (cleaner than any player). Zoomed out: its icon, a circle with a sine
  in it (the circuit-drawing symbol of a generator).
- **Melodic / Percussive** (`character`) on Microphone and Line Input, from Intermediate
  (`CHARACTER_LEVEL`): two buttons, ♪ and a drum. Percussive = drums, peaks 18 dB above the
  average instead of 12; the average and the noise stay. The Microphone (face-only) shows them
  beside its icon, the Line Input in its body under Mono / Stereo. At Beginner nothing shows and
  both stay melodic (D3). Instrument and Guitar Amp keep the guitar (15 dB).
- **Sounds changed from D2 (user, 2026-10-05):** Pad is gone — for the chain it does what Noise
  does. Hits became **Click** ("Клик"): short pulses, 18 dB of peaks (`click`). A file saved
  with `pad` / `hits` (only from the first version of this step, never pushed) opens as Sine.
- Engine: `soundOf(typeKey, params)` — peaks by what it plays (`PEAKS_ABOVE`), noise by source
  (`NOISE_BELOW`) — replaces `SOURCE_SOUND`. Old files get `melodic` / `sine`; a saved word
  the app does not know falls back to the default (`PARAM_CHOICES`, also for the Pre / Post
  switch's `selectedInput`).
- Help texts (en + bg): the Generator's own ("Try this: Sine at +10 dBu is yellow, Click at the
  same level red"), and a sentence on the switch for Microphone and Line Input. Fixed on the way:
  the hum tag's tooltip still said "nothing later takes it away" (wrong since D1).
- Tests: 18 new (281 in all, Bun and Node) — each sound's peaks, Percussive on both sources, a
  percussive mic in front of a Guitar Amp (the amp decides), and a reference chain where the same
  +10 dBu average is hot as a sine and clipping as clicks, +4 dBu keys hot and a drum machine
  clipping. No old reading changed.

Checked in the browser (Intermediate): a Generator dragged from the palette (default Sine, 0 dBu,
its chain colour); real clicks on the sounds turn its +10 dBu wire red (18 dB of peaks) / back to yellow; the Level
knob drags (canvas does not pan); the Microphone's and Line Input's buttons (a +4 dBu Line Input
turns red on Percussive); overview faces; Bulgarian (every word fits its button); help popover;
Beginner shows no switch and no Generator in the palette; a file with `sound: "trumpet"` opens
as Sine. No console errors from the new cards (only the first load in the hidden browser pane logs React
Flow's zero-size warnings and NaN background dots, as before any of this).

## 6. Meters show peak and noise

- Every meter gets a peak mark over the average bar, and the noise as a grey "fog" from the left
  when it is loud enough to reach the scale.
- Left from step 4: the stereo bars inside `SignalMeter` (`ChannelRow` without `peak`) and the
  Main Fader's `VerticalMeterPair` still colour each bar by its average alone — a side clipping on
  its peaks shows yellow there while the health word says "Clipping". Give them the peaks.
- Plain-language readings, never a bare number (the #1 rule): "Peaks 14 dB above the average",
  "Room before clipping: 6 dB — careful", "Hiss: 58 dB below the signal — clean".
- Intermediate and up only (decision D3): Beginner meters look as they do today. Cards keep their
  size while values change (`StableText`, reserved space).
- A new note on a card when the noise becomes audible ("You can hear hiss here"), like the
  hum note today.

## 7. Dynamics show what they do to peaks and noise

- Transfer curves show three dots: peak, average, noise. A compressor's dots move closer; a gate's
  noise dot drops when the threshold is set between noise and signal.
- Gate help text: "set the threshold between the noise and the quietest part of the signal".

## ~~8. The level map~~ — dropped (user, 2026-10-05)

No panel under the canvas: the app is crowded enough and a chain can get complicated. The cards'
meters (step 6) and the moving meters (step 11) show the peaks, the average and the noise. Whether
any more monitoring is needed is decided once this TODO is done and the readings all work.

## 9. Words and docs

- Help texts (`theory`) for peak vs average, noise floor, headroom, signal-to-noise, why gain
  early — en + bg.
- CLAUDE.md: signal maths, health zones, the new readings. README: what's new.

## Step B — the signal moves

## 10. The time engine

- Pure, testable, no drawing: every source plays its sound as a level that changes over time
  (sine = steady, click = short pulses on a beat, drums = sharp attack and decay, voice = phrases with
  pauses, guitar = plucks). Repeatable (same start → same pictures every time).
- Runs the chain about 1000 times a second in small steps (cheap: 100 cards × 1000 = nothing for a
  browser), so a compressor's Attack / Release and a gate's Attack / Hold / Release finally do
  something.
- Over a few seconds its peak, average and noise agree with Step A's numbers (a test), so the
  still picture and the moving picture never disagree.

## 11. The fast lane: live meters

- One animation loop outside React writes the moving values straight into the meters, gain
  reduction bars and transfer-curve dots — no card redraws for movement (step 1 makes this
  possible).
- Real meter behaviour: a fast peak with a peak-hold mark, a slower average (like a VU meter) —
  the two visibly split on drums and almost touch on a sine. That is "peak vs RMS".
- Play / Pause in the header (a teacher freezes the picture to explain). Starts paused when the
  system asks for reduced motion. Stops by itself in a hidden tab.

## 12. Wires move with the signal

- Wires brighten and pulse with the level they carry; the flow animation already there keeps the
  direction. A clipped peak flashes red on the wire where it happens.

## 13. Check on a weak device

- Chrome dev tools: CPU 6× slower, phone screen size, the stress chain from step 1. Must stay
  smooth (drop to 30 updates a second on slow devices if needed). Battery: nothing runs while
  paused, hidden, or with an empty canvas.

---

## Later — Step C: hear it (not planned yet)

Generated sounds only (sine, noise, clicks) through the browser's built-in audio, on laptop or
phone speakers. Muted until switched on, low volume by default, a safety limiter on the output.
Built on Step B's time engine.
