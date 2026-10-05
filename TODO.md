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
- Sounds (later, Step C) are generated only: sine, noise, pads, hits. No samples, no recording.

**How to work a step:** one step per session, on branch `signal-upgrade`. Run `bun run lint` +
`bun run build` (+ `bun test` once it exists), check the app in the browser, commit, tick the step
here. Update CLAUDE.md when a step changes what it describes.

---

## Decisions for Step A — decided 2026-10-05

- **D1 — Hum follows the signal**, like all noise: a fader turns signal and hum down together and
  the gap between them stays. Only fixing the cause (Ground Lift) removes it. (Today it "grows
  with every boost and never drops" — that rule goes.)
- **D2 — Sources.** A new **Generator** element (Sine / Noise / Pad / Hits). **Microphone and Line
  Input get a Melodic / Percussive switch** (melodic: a voice, keys — a smaller gap between peak
  and average; percussive: drums — a big gap). **Instrument and Guitar Amp are guitars**: a fixed
  character, no switch.
- **D3 — Beginner shows nothing new.** No peak marks, noise or extra readings at Beginner; they
  start at Intermediate. So the Generator and the Melodic / Percussive switch are Intermediate
  too (at Beginner, Microphone and Line Input are melodic).
- **D4 — Clipping is judged on the peaks**: the bar (average) keeps today's colours, but a card
  clips as soon as its peaks reach the clip level. A drum sound at +10 dBu average now clips,
  where today it is only "hot". That is the lesson.
- **D5 — open (follows from D3 + D4):** at Beginner nobody sees the peaks, but D4 still makes a
  card red when they clip — so a voice turns red about 12 dB earlier than today, with no mark
  explaining why. Proposed: keep it (a red bar means "too loud", which is true, and the help text
  can say "the loudest moments are clipping"). The alternative is judging Beginner on the
  average as today, which makes the engine depend on the level.

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

## 3. Lock today's numbers with tests

- Add `bun test` (built into Bun, no new dependency) and tests for `src/signal/`: a handful of
  reference chains (mic → preamp → EQ → comp → fader → bus → speaker, stereo bus with pan, DI with
  ground loop, ADC / DAC, gate, limiter) and the level at every card.
- These must keep passing in step 4 for the average level, so Step A cannot change old chains by
  accident. CLAUDE.md: "No test suite exists yet" → how to run the tests.

## 4. Three readings per wire: peak, average, noise

The engine (`signal/engine.ts`, `process.ts`) carries, per side, `{ peak, rms, noise }` instead
of one number. Today's number becomes `rms` (the average) — the tests from step 3 still pass.

- **Peak** = average + the sound's peak-to-average gap (sine 3 dB, pad ~6, voice ~12, noise ~12,
  hits ~18). Analog stages flatten peaks at the clip level (the gap shrinks = distortion).
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
- Health (decision D4): clipping from the peaks; the rest from the average as today.
- Signal-to-noise = average − noise. Headroom = clip level − peak.
- Pick the noise numbers so that a well-set chain ends near 60 dB signal-to-noise and the
  classic mistake (preamp 30 dB too low, made up later with a fader / gain) loses at least 20 dB.
  Tests for both.

## 5. Sources: the Generator and the Melodic / Percussive switch

- Decision D2 / D3. A Generator element (Sine / Noise / Pad / Hits, a level knob), Intermediate
  and up. Microphone and Line Input get a Melodic / Percussive switch (Intermediate and up;
  melodic at Beginner). Instrument and Guitar Amp keep a fixed guitar character.
- Palette, registry, `NODE_LOOK`, card, both locales, help text (`theory`).

## 6. Meters show peak and noise

- Every meter gets a peak mark over the average bar, and the noise as a grey "fog" from the left
  when it is loud enough to reach the scale.
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

## 8. The level map

The textbook gain-staging drawing, live from the user's own chain: a panel under the canvas, one
column per card in signal order, lines for peak, average and noise, the clip level at the top and
the noise zone at the bottom. Opens for the chain of the selected card. The distance between the
lines *is* the headroom and the signal-to-noise — the picture teachers draw on the board today.

## 9. Words and docs

- Help texts (`theory`) for peak vs average, noise floor, headroom, signal-to-noise, why gain
  early — en + bg.
- CLAUDE.md: signal maths, health zones, the new readings. README: what's new.

## Step B — the signal moves

## 10. The time engine

- Pure, testable, no drawing: every source plays its sound as a level that changes over time
  (sine = steady, hits = sharp attack and decay on a beat, pad = slow swells, voice = phrases with
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

Generated sounds only (sine, noise, pad, hits) through the browser's built-in audio, on laptop or
phone speakers. Muted until switched on, low volume by default, a safety limiter on the output.
Built on Step B's time engine.
