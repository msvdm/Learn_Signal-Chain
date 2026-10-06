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
- Sounds: short generated audio loops (made for the app, no recordings of real people or
  copyrighted music) — see D7. Not heard until Step C.
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

## ~~6. Meters show peak and noise~~ — done (2026-10-05)

From Intermediate up (D3); Beginner looks as before (checked: no mark, fog, readings or tag;
Microphone and Active Speaker still 280 × 210).
- **Meters**: a mark in the bar's colour at the peaks, and the noise as a grey fog from the left
  once it reaches the scale (above −60 dBu) — card meters, the L / R rows, the Main Fader's upright
  pair, the overview faces. The stereo bars (`ChannelRow` in `SignalMeter`, `VerticalMeterPair`)
  now colour each side from its own peaks, at every level (D5).
- **Readings** at the bottom of every card that shows a level, the signal leaving it
  (`signal/readings.ts`, `SignalReadings`): "Peaks 12 dB above the average", "Room before
  clipping: 18 dB — fine" (careful at 6 dB or less, "it distorts" at 0), "Hiss: 60 dB below the
  signal — clean" ("you can hear it" under 45 dB, "very noisy" under 20). Whole dB; the verdict is
  taken from the number shown. Plain text when all is well, the hot / red colours when not. The
  hiss leaves the hum out (it has its own tag). Silence (−∞ on the meters) has nothing to read.
  Tooltips explain each line. The lesson reads card by card: well set, the hiss goes 66 → 64 → 63
  … → 60 dB; the Preamp 30 dB too low, 66 → 64 → **40 at the EQ** → 37 to the end.
- **"You can hear hiss here"**: a grey tag on the bottom edge of the element where the hiss
  becomes audible (clean arriving, audible leaving — `hissStartsAt`), beside the hum tag when both;
  bare controls too (Mic → Preamp +20 → Fader +10: on the Fader). No extra note on speakers — their
  readings say it.
- **Room for the readings** (cards must stay landscape): a card with readings is at least 320 wide
  (the longest line, Bulgarian's "Запас преди изкривяване…", is 273 px); the two-column cards have
  190 px columns (438 wide — the DI Box too, at every level) so the Compressor and the Noise Gate
  come out 438 × 428; the Amplifier moved to two columns (it would have been 280 × 346). The DI
  Box shows no readings: its two outputs send different signals and it already shows both levels.
  Every type checked at Advanced: all cards landscape.
- Tests: 32 new (313, Node and Bun): the readings at every card of both gain-staging chains (the
  hiss starts at the EQ only), room verdicts (a sine at +10: 7 dB fine; clicks: 0; +4 dBu keys:
  4 careful; through an ADC: 6 careful, against 0 dBFS), no Preamp (20 dB at the fader, 17 very
  noisy at the bus), silence (a fader at −100, a passive speaker without an amp), the hum left
  out of the hiss; `crestOf`, `hissOf`.

Checked in the browser (Intermediate, light and dark, English and Bulgarian): peak marks on the
meters (a clipping Generator's at the end of the bar), the fog on a Master / Aux Bus after the
classic mistake, the Main Fader's L / R marks, readings on every card and face, the hiss tag on
the EQ (and beside a hum tag), on a Fader; overview hides the readings and the faces grow back.
No card changes size while values change (10 knob / switch changes over 12 cards), Bulgarian sizes
equal English.

Choices made here, to review: the thresholds (6 dB of room, 45 and 20 dB of hiss); the readings
at the bottom of the card rather than under the Output meter (one place on every card, faces too);
"fine" while a card is "Hot" (a sine at +10 dBu has 7 dB of room — the average is hot, the peaks
still fit).

Original plan:

- Every meter gets a peak mark over the average bar, and the noise as a grey "fog" from the left
  when it is loud enough to reach the scale.
- Left from step 4: the stereo bars inside `SignalMeter` (`ChannelRow` without `peak`) and the
  Main Fader's `VerticalMeterPair` still colour each bar by its average alone — a side clipping on
  its peaks shows yellow there while the health word says "Clipping". Give them the peaks.
- Plain-language readings, never a bare number (the #1 rule): "Peaks 14 dB above the average",
  "Room before clipping: 6 dB — careful", "Hiss: 58 dB below the signal — clean".
- These readings carry the gain-staging lesson on their own (no level map, step 8 dropped): card
  by card along a chain, "Room before clipping" and "Hiss below the signal" show where the gain
  was made well or badly — the Preamp 30 dB too low ends 37 dB above its hiss instead of 60.
- Intermediate and up only (decision D3): Beginner meters look as they do today. Cards keep their
  size while values change (`StableText`, reserved space).
- A new note on a card when the noise becomes audible ("You can hear hiss here"), like the
  hum note today.

## ~~7. Dynamics show what they do to peaks and noise~~ — done (2026-10-05)

- **Three marks on the curve** (Compressor, Noise Gate, Limiter — the De-esser has no curve): the
  Peaks ▲, the Average ○ (the card's colour, as before: green open / grey closed, hot limiting) and
  the Noise ● (grey) of what goes in, each where the curve sends it. A mark the card moves (2 px or
  more) keeps a faint copy on the dashed diagonal — where it would be untouched — with a thin line
  to it: a compressor's peaks come down further than its average (12 dB apart in, 3 out at 4:1),
  its makeup gain lifts the noise above the diagonal, a gate drops the noise to the floor, a
  limiter flattens the peaks. A legend (Peaks / Average / Noise) in the top-left corner, where no
  curve can reach; the SVG's tooltip says how to read the graph.
- **A wider scale**: both axes 120 dB, up to the clip level — −100…+20 dBu (−120…0 dBFS after an
  ADC; the right-hand "0" is left out there, it would sit beside OPEN). The old −60…0 had no room
  for the noise (a well-set chain's sits near −74), and with −80 at the bottom a gate's closing did
  not show: the noise was already on the floor. The curve is as before, a little flatter.
- **The marks agree with the meters**: the engine keeps what a dynamics card's curve works on
  (`curveIn`: the louder side, its own −80 dBu hiss included — `withOwnHiss`), and the card puts
  it through the same `throughCurve` the engine uses. Without the hiss a gate set at −85 would show
  the noise dropping while the engine (rightly) lets it through. Bypassed: the marks show what
  arrives on the curve, dimmed with the body, as the one dot did.
- Help (en + bg): the gate's tip now says "set the threshold between the noise and the quietest
  part of the signal: put the dashed Threshold line between the Noise dot and the Average dot",
  and what too high (the Average drops: it chops the music) and too low look like. The compressor's
  tip explains the peaks moving closer and the noise coming up by the gain reduction; the
  limiter's, the peaks stopping at the ceiling.
- Tests: 10 new (323 in all): what goes in (with the hiss), the marks equal what leaves for a
  compressor, a gate between noise and music / above the average, a limiter with makeup, a peak
  flattened at the clip level, bypassed, linked stereo, a gate set under its own hiss. Checked that
  they bite: without the hiss in `curveIn`, 8 fail.

Checked in the browser (Intermediate and Advanced, light and dark, English and Bulgarian): a real
drag of the gate's Threshold to 0 dB — CLOSED, all three marks drop (the peaks too, −8 dBu); at
−40 only the noise drops; compressor with makeup +12; limiter flattening the peaks and the average;
a compressor after an ADC (dBFS scale); a stereo gate after Balance; a bypassed limiter. Card sizes
unchanged (438 × 428, the Limiter 438 × 372). No console errors.

Choices made here, to review: the scale (120 dB, so the music's part of the curve is flatter
than before); marks as shapes (triangle / ring / dot) rather than colours, which already mean
health; the faint copy on the diagonal instead of arrows.

**Found on the way, then fixed** (older than this step): a Compressor or Noise Gate fed a stereo
wire was taller than wide — 438 × 462 — because its In / Out meters show two bars each (84 px
instead of 50, and these cards had 10 px to spare). A stereo meter now puts its health word beside
the label (the row under the bars only held that word in stereo) and its L / R rows closer (16 px
lines, 2 apart): 56 px. Stereo Compressor / Noise Gate 438 × 434, Limiter 378, De-esser 322, DI Box
339, Intermediate Equalizer 300, Amplifier 338, Graphic EQ and Parametric Equalizer 682 × 611 (the
Parametric 627 in Bulgarian); mono sizes unchanged. Checked at Beginner, Intermediate and Advanced, English and Bulgarian (the longest
health word, "Изкривяване!", fits beside "Вход"), Too Quiet → Good → Clipping! with no size change,
and switching the Line Input between Mono and Stereo.

Original plan:

- Transfer curves show three dots: peak, average, noise. A compressor's dots move closer; a gate's
  noise dot drops when the threshold is set between noise and signal.
- Gate help text: "set the threshold between the noise and the quietest part of the signal".

## ~~8. The level map~~ — dropped (user, 2026-10-05)

No panel under the canvas: the app is crowded enough and a chain can get complicated. The cards'
meters (step 6) and the moving meters (step 11) show the peaks, the average and the noise. Whether
any more monitoring is needed is decided once this TODO is done and the readings all work.

## ~~9. Words and docs~~ — done (2026-10-05)

- **Watch the readings**: a new section in the help popover (right-click → What is this?), from
  Intermediate up — Beginner's popover is as before (D3) — between *Why is it here?* and *Pro tip*:
  `theory.<key>.readings` (optional, en + bg). It points at the card's own readings, with the
  numbers the engine gives there, so each idea is taught where it shows:
  - **noise floor** — Microphone (Hiss 66 dB: the cleanest this signal will ever be; every powered
    card after it can only shrink the gap), Line Input (80), Instrument (70), Generator (90: any
    hiss further along was added by the chain);
  - **peaks vs average** — Microphone / Line Input (12, Percussive 18: 6 dB less room while the bar
    does not move), Instrument (15), Generator (3 / 12 / 18: at 0 dBu, 17 / 8 / 2 dB of room),
    Compressor (12 in, about 6 out; the room it makes is what makeup gain fills), Limiter;
  - **why gain early** — Preamp (at +50 the hiss stays clean to the end, 55 dB or more; at +20 made
    up later it ends at 40 or less and the card after the Preamp gets the hiss tag), Gain, Fader,
    HPF, EQ (the classic place for the tag), Pad (no hiss of its own, but 64 → 48 dB after the
    Preamp);
  - **headroom** — Master Bus (every wire makes the mix louder, at 0 the bus distorts and nothing
    after it brings the peaks back), Main Fader (cannot undo a clipping bus), ADC (2 dB less room
    against 0 dBFS; digital cards add no hiss);
  - **signal-to-noise** — Speaker / Active Speaker (what the audience hears: 50–60 dB well set,
    40 or less after the classic mistake; the Volume knob cannot clean up a noisy chain), Noise Gate
    (the Hiss reading jumps up while the peaks and the room stay — if they move, it cuts the music).

  None where a card shows no readings (DI Box, the switches, Pan / Balance) or has nothing of its
  own to add (Aux / Matrix Bus, De-esser, Graphic EQ, Amplifier, DAC, Guitar Amp).
- The readings' tooltips name the terms (headroom, signal-to-noise ratio); the peaks tip says the
  average is how loud it sounds, the peaks what clips first.
- Old texts brought in line with D4 and step 6: the Preamp's tip now aims "well inside the green —
  about −20 to −10 dBu for a voice" (at −40, the bottom of the green, the next card's hiss is
  audible); the Master Bus's tip says its loudest moments clip at +20 dBu. Two Bulgarian typos fixed
  on the way.
- **Fixed on the way** (older): the help popover opened under the palette, cut off, for a card near
  the left edge — it now stays right of it (`usePaletteWidth`), and "bring into view" centres the
  card in the part of the canvas the palette leaves free.
- CLAUDE.md (locales, help popover, adding a new node) and README: *What's New*; the levels table
  (it listed a "potentiometer" and missed most elements); the translation snippet (`satisfies
  LocaleStrings`); help is right-click → *What is this?*, not a tooltip.

Every number in the texts checked against the engine (a script over chains: Beginner's default, the
full channel strip with Preamp +40 / +50 / +20 made up later, a Pad, an ADC, a compressor fed hot) —
ranges where the chain changes the result. Checked in the browser: the tour Microphone → Preamp →
EQ → Fader → Active Speaker (the classic mistake) in English and Bulgarian, the popover clear of the
palette, Beginner without the section; no console errors.

Choices made here, to review: the section's name ("Watch the readings" / "Следи показанията") and
place (before the Pro tip); which elements got one; "noise floor" taught as the Microphone's Hiss
reading (the grey fog on the meters is the same noise).

Original plan:

- Help texts (`theory`) for peak vs average, noise floor, headroom, signal-to-noise, why gain
  early — en + bg. They point at what is on the cards (step 6's readings, the meters), e.g. "set
  the Preamp low and make it up later: watch the Hiss reading on the last card drop".
- CLAUDE.md: signal maths, health zones, the new readings. README: what's new.

## Step B — the signal moves

### D7 — Step B is real audio (user, 2026-10-05) — replaces the plan below steps 10 / 10b

Steps 10 and 10b built a homemade imitation of audio processing: hand-drawn loudness shapes at
1 kHz, hand-written Attack / Release, and a measuring + caching system to keep the moving numbers
in line with the still ones (~1,600 lines). The browser already has real audio processing (Web
Audio API), so Step B is rebuilt on it:

- **Sound material**: five generated audio loops, 10–15 s each, shipped with the app — soft lounge
  music, a drum beat, a guitar string, a speaking voice, a singing voice. "Generated" = made for the
  app (synthesis / generation tools), not recordings of real people or copyrighted music. Mono,
  compressed (Opus or MP3), small: the one-file offline copy must inline them (check the size —
  aim under ~1 MB for all five). The Generator keeps sine / noise / click, generated in code.
  Which loop each source plays: Microphone → speech or singing, Line Input → lounge music or drum
  beat, Instrument / Guitar Amp → guitar (the Melodic / Percussive switch maps onto these; decide in step 10c).
- **Every card is a real audio stage**: gain / fader / preamp = gain, HPF / EQ / Graphic EQ = biquad
  filters, Pan / Balance = panner, buses = summing, ADC / DAC = level shift, clipping = a waveshaper
  at the clip level. Compressor, limiter, noise gate, de-esser: small processors of our own (a few
  dozen lines each), written as plain functions on a buffer of samples so Bun can test them, run in
  the browser through an AudioWorklet (or the offline render). Not the built-in DynamicsCompressor:
  it adds its own makeup gain and has a fixed knee.
- **Hiss and hum stay real too**: each powered card adds a quiet noise source at its hiss level, a
  DI ground loop a 50 Hz hum — the noise floor is then measured, not computed.
- **Measuring**: an OfflineAudioContext renders one loop of the chain (off the main thread, faster
  than real time, no sound, no user click needed) and measures what leaves each card — peak,
  average, noise (the noise from a render with the music muted). The cards' readings after a
  dynamics card come from there (D6 = b, kept), later the live meters too. The Step A number
  engine stays for the instant readings everywhere else (it agrees exactly where there are no
  dynamics; keep the agreement test against the renders).
- **dBu ↔ digital**: one fixed mapping (e.g. the +20 dBu clip level = 1.0 in the render, so a
  −60 dBu microphone is 0.0001 and the −128 dBu preamp hiss still well inside float precision).
- Tests: the processors and the mapping as plain functions in Bun; the rendering checked in the
  browser (Web Audio does not run in Bun).

## ~~10c. Replace the homemade time engine with real audio~~ — done (2026-10-06)

### D8, D9 — decided (user, 2026-10-05, at the start of 10c)

- **D8 — the loops onto the sources.** Microphone: **Speech · Singing · Drums** (three buttons; it was
  Melodic / Percussive). Line Input: **Music · Drums**. Instrument and Guitar Amp: the guitar. Beginner
  shows no buttons: Speech / Music. Older files: `melodic` opens as Speech / Music, `percussive` as Drums.
- **D9 — every card's readings come from the render**, not only from a dynamics card on (as D7 said).
  Real filters do not change a voice's level the way the number engine guesses (pink noise: an 80 Hz
  HPF −1.0 dB; a real voice −0.4), so the level would have jumped along the wire from a filter into a
  compressor. The number engine stays as the instant picture: between a change and the render, the
  last render's readings move by the number engine's step (a fader is exact at once).

### What it is now

- **Five loops** (`scripts/make-loops.py` → `src/audio/loops/*.mp3`, all made here: synthesis, and
  flite's speech synthesizer for the speaking voice): a speaking voice ("Good evening, and welcome to
  the show. This is a quick sound check. One, two, three. Can everyone hear me?", pauses between —
  31 % near silence), a singing voice (formants on a sung tone, "la / ah / ooh", two phrases with a
  breath), lounge music (FM electric piano, bass, a shaker, a little room), a drum beat, a guitar
  (plucked strings, fingerpicked). One piece of music: 4 bars of | Dmaj7 | Bm7 | Em7 | A7 | at 96 BPM,
  10 s — on a bus they play together (Step C). Each tuned to `PEAKS_ABOVE` as decoded again (speech
  11.86, singing 12.02, music 12.02, drums 18.01, guitar 14.98), 96 kbps mono 48 kHz, 124 kB each
  (620 kB; 64 kbps rounding added ~2 dB to a voice's loudest moments). Each file holds a little of its
  own end before the loop and of its start after it, so a decoder's delay never cuts the loop.
- **The render** (`src/audio/`): the number engine's plan built as Web Audio nodes (`chainAudio.ts`) —
  gains, real biquad filters, Pan / Balance, bus sums, a white hiss on every powered card, a 50 Hz
  oscillator for a ground loop, clippers where the peaks could reach the ceiling — and our processors
  in an AudioWorklet (`processors.ts`: compressor on the level of the moment, gate on its peaks with
  Hold, limiter with no sample past its ceiling, a **split-band de-esser** that turns down only what
  is above its Frequency; the meter). `measure.ts`: two OfflineAudioContexts at 48 kHz at once — the
  music (one loop, after the dynamics have settled) and the quiet (2 s of noise and hum) — one meter
  node taking every tap. The Generator's sounds and the hiss are made in code (`sounds.ts`).
- **When**: `store/measuring.ts` renders once a change has been quiet for 100 ms (nothing while a knob
  is being turned), one at a time; `signal/measured.ts` puts the readings in (`withMeasured`).
- **The number engine** goes back to putting each reading through a dynamics card's curve (the `D6`
  test lines → `D9`, the pre-10b values); its de-esser now leaves the signal as a whole alone (only
  the sibilance's reduction is guessed). Gone: `signal/time.ts`, `signal/sounds.ts`, `time.test.ts`
  and chain.ts's `Moment` / `GivenLevels` (~1,000 lines); new: ~1,200 lines of `src/audio/` (the
  processors 410, the chain 410, the measuring 200), the merge 90, the scheduler 80, the loop script
  510, ~400 of tests.
- **Offline**: the one-file copy holds the loops as data: URLs (1.74 MB; was 0.89); the AudioWorklet's
  code is in the script as text (`vite-worklet.ts`, a Blob URL at run time). The service worker keeps
  the loops with the rest.
- Tests: 360 (Bun; 356 before) — the processors 19, the Generator's sounds and the hiss 7, the merge 7,
  old files' words 3 (the time engine's 33 went); the render itself is checked in the browser (no
  Web Audio in Bun).

### What real sound says (measured, now in the help texts, en + bg)

- Linear chains read as the number engine to ~0.05 dB (Mic −60 → Preamp −10, the noise −126 →
  −73.88 → −72.94; the ground-loop hum −80 → −40 → −50 exactly).
- **Compressor** (default 2:1 at −20, a speaking voice at −10 dBu): 6.8 dB down on average; the peaks
  12 dB above it in, **17 out** with Attack 10 ms (the start of each word gets through), 16 with 1 ms.
  A singing voice (notes start softly): 12 → 12, **10 at 1 ms**. Drums 18 → 22. So the help now says a
  quick Attack catches *more* of the start, the peaks come closer only on soft starts, and a
  **limiter** after it stops the loudest moments. (A faster detector — 1 ms, or peak-sensing — changes
  this by under 1 dB: compressing loudness raises the crest unless the attack is instant.)
- **De-esser** (default −20, 6 kHz): a speaking voice's "s" down 5.7 dB, the voice as a whole 0.07; a
  singing voice: nothing. A new *Watch the readings* for it.
- **Limiter** (default −3) on a voice peaking at +2: peaks exactly at −3, the average 3.5 dB down.
- **Gain staging**: Beginner's default 56 dB at the speaker; well set 62 (53 with the default
  Compressor in the strip — the Preamp's text now says "50 dB or more", it said 55); the Preamp 30 dB
  too low and made up later 38 (34 with HPF and Compressor), the hiss tag on the card after the Preamp;
  the Pad 64 → 48; the ADC 2 dB less room. All as the texts said.
- Different sounds on one bus add up to less than the number engine's voltage sum (the stress chain's
  8 channels: 2.3 dB less); clicks clipped at +10 dBu lose 4 dB of average.

Checked in the browser (dev and the production build): the cards switch to the render's readings a
moment after a change (a Threshold drag: the number engine's step at once, the render 200 ms after
the knob stops); Speech / Singing / Drums and Music / Drums in English and Bulgarian (every word fits,
the card sizes equal); the De-esser's "Sibilance reduction −5.7 dB", the gate's hiss 142 dB below;
stereo bus with Pan / Balance / Main Fader, DI ground loop, ADC → DAC → amp → passive speaker, a speaker
without an amp, a blown one, Pre / Post, Aux and Matrix Bus, the Generator, a bus fed analog and
digital — no NaN, no console errors. The production page fetches only the loops a chain needs; the
one-file copy (opened over http) measures with **zero network requests**. Render times (desktop, dev
build, the hidden browser pane): 30 ms for 4 cards, 130 for a channel strip, 1.4 s for the 75-card
stress chain (24 dynamics cards) — step 13.

Choices made here, to review:
- The loops' sound: synthetic and simple — flite's voice is robotic, the guitar bright (−7 dB above
  6 kHz). Fine to measure; worth a better pass before Step C makes them heard.
- The compressor hears the level of the moment over 3 ms (an RMS detector), so its marks sit on the
  drawn curve for a steady sound; the Attack lesson changed with real sound (above).
- The de-esser is split-band (only the band above its Frequency comes down) and its readout is that
  band's reduction; the number engine's first guess puts a speaking voice's "s" 6 dB under its average.
- The limiter has no look-ahead: it turns a peak down on the very sample (fine for measuring; for
  listening, Step C may want a millisecond of look-ahead).
- The noise is measured over 2 s (steady: ±0.02 dB), the music over the whole loop.
- Several sources set to the same sound play the same loop: two "singers" add up to exactly +6 dB, as
  the number engine says — and as two identical recordings would.

**Left for the user:** double-click `dist/learn-signal-chain.html` (Chrome / Edge, Firefox if at
hand) with Wi-Fi off, build Mic → Preamp +50 → Compressor 4:1: a moment after the chain is built the
Compressor's "Turning down" goes from −7.5 to about −10 dB and its Peaks reading from 3 to 19 — that is
the AudioWorklet running from a file (the browser pane cannot open files). Listening to the loops is
up to you (`src/audio/loops/*.mp3`): the app does not play them until Step C.

## ~~10. The time engine~~ — done (2026-10-05), to be replaced by real audio (D7, step 10c)

- **The engine split in two** (`signal/engine.ts`): `planChain` — what the wiring makes of each card,
  once per change (its mode, the wires it adds up, what its outputs carry, Preamp, role …) — and
  `runChain` — the levels at one moment. The still picture is `runChain` once; the time engine runs
  it every millisecond with a `Moment` that changes only two things: what the sources play and how
  the dynamics react. Every other card is the same code, so the two pictures cannot drift apart.
  The 323 old tests pass unchanged (one rule moved without changing a number: an active speaker
  after an amplifier blows as soon as anything reaches it — its noise in a pause too).
- **The sounds** (`signal/sounds.ts`): one loop of 4 s (two bars at 120 BPM) per sound, a level and
  its peaks every millisecond, built from a fixed list of hits — a voice (two phrases of syllables,
  pauses after each), keys (chords and a melody, never silent), drums (kick, snare, hi-hats),
  a guitar (a pluck a beat), and the Generator's sine (steady), noise (wandering, from a seeded
  random generator) and clicks (a 10 ms burst a beat, silence between). Each is tuned: average 0 dB
  over the loop, its loudest moment exactly the still picture's peaks (12 / 18 / 15 / 3 / 12 / 18),
  and every sound's loudest moment on the first beat, so on a bus the peaks meet as the still
  picture adds them. Repeatable: the same chain plays the same every time.
- **The time engine** (`signal/time.ts`): `startTime(nodes, edges)` → `tick()` (the next millisecond),
  `dynamicsOf(id)` (a compressor's reduction, a gate open / holding), `update(nodes, edges)` (a knob
  turned while it plays: the sound and the dynamics carry on). Dynamics react over time: a compressor
  moves toward its curve with its Attack / Release, a gate opens while over the threshold and for
  Hold after (opening takes Attack, closing Release), a limiter catches peaks at once and lets go
  over 50 ms, a de-esser like a quick compressor (1 / 50 ms). `measureChain()` measures what leaves
  each card over a loop; the noise comes from a second run with the music silent — "what you hear
  when the music stops", as the still picture means it.
- **Agreement** (`time.test.ts`, 33 tests): over a loop, every card of 12 reference chains has the
  still picture's peak, average, noise and hum to 0.005 dB — channel strip, the Preamp too low and
  made up later, stereo bus with Pan / Balance / Main Fader, a DI ground loop (the hum), a mic on a
  Guitar Amp, ADC / DAC / amp / passive speakers, Pre / Post, Aux and Matrix Bus, the Generator,
  drums, two voices on a bus. Only close: different sounds on one bus (they do not rise and fall
  together — the peaks exact, the average up to 1 dB lower, 0.55 dB for voice + keys + guitar + sine),
  clipping (moments above the clip level lose power: the peaks as the still picture, the average
  lower), a gate between the noise and the music (exact noise, the music within 0.1 dB).
- **Attack, Release and Hold finally do something** (tests): a compressor gets 63 % of the way in its
  Attack time and lets go to 37 % in its Release time; a slow Attack lets the start of each drum hit
  through (6 dB and more higher peaks than 1 ms); a gate stays open for exactly its Hold, then closes
  over its Release, and opens within its Attack; a limiter's peaks never pass its ceiling, not for
  one millisecond. The tests bite: an engine ignoring Attack fails 4, sounds 0.05 dB off fail 19.
- **Speed**: 0.67 µs per card per millisecond — the 75-card stress chain of step 1 takes 5 % of one
  core here (Bun). Two cheap fixes on the way, for the still picture too: the filters' level
  changes (a pink-noise sweep) are worked out once per setting (`levelChange`), and the level sums
  use plain loops. Weak devices: step 13.

Checked in the browser: the app works as before on the split engine (an Advanced chain with
compressor, gate, stereo Line In and Pan: the same readings; an HPF knob change moves the level and
back), no console errors. The time engine is not drawn yet (step 11).

**D6 — decided (b), 2026-10-05, done the same day:** the cards' readings after a dynamics card come
from the moving picture. See *10b* below.

**D6 — the question as it was put.** The still picture puts each reading through a dynamics
card's curve on its own; no real compressor can do that — it gives one gain to the whole moment. So
after a compressor or de-esser the moving peaks come out higher than the still ones (voice, default
2:1 at −20, Attack 10 ms: +9.7 dB; 4:1 at −30: +21 dB; drums: +19 dB; even with a 1 ms Attack:
+6 dB) and the average 1–2 dB lower; a limiter's peaks agree but its average drops (a voice it
catches: −6 dB). Step 11 would show it: after a compressor the peak-hold mark well above "Peaks …
above the average". Options:
  - (a) Keep both: the still picture is the curve "as if it reacted at once", the moving one the
    real thing — and say so on the card (Attack lets the start of each hit through).
  - (b) The cards' readings after a dynamics card come from the moving picture (measured over a
    loop): they never disagree, and Attack / Release change the readings too. Costs: ~0.1 s per
    change for a 10-card chain (needs speeding up or a worker); step 7's marks and step 9's
    texts ("12 in, about 6 out") change with it.
  - (c) The moving picture copies the still one (each reading its own gain with its own Attack /
    Release): not how a compressor works, and the average still 1–5 dB off on drums.

Original plan:

- Pure, testable, no drawing: every source plays its sound as a level that changes over time
  (sine = steady, click = short pulses on a beat, drums = sharp attack and decay, voice = phrases with
  pauses, guitar = plucks). Repeatable (same start → same pictures every time).
- Runs the chain about 1000 times a second in small steps (cheap: 100 cards × 1000 = nothing for a
  browser), so a compressor's Attack / Release and a gate's Attack / Hold / Release finally do
  something.
- Over a few seconds its peak, average and noise agree with Step A's numbers (a test), so the
  still picture and the moving picture never disagree.

## ~~10b. The still picture measures the dynamics (D6 = b)~~ — done (2026-10-05); the decision stays, the homemade engine goes (D7)

- **From a dynamics card at work on** (Compressor, Noise Gate, Limiter, De-esser, not bypassed — and
  every card after one), the still picture takes the peaks and the average of what arrives, leaves
  and goes down each wire from a loop of the moving picture (`measureMusic`, after the dynamics have
  settled: seven times each one's slowest time). The noise stays the still picture's: what you hear
  when the music stops is the curve with the gain settled on the noise — the two agree exactly.
  Now every card of every test chain matches the moving picture to 0.005 dB, dynamics included;
  only different sounds on one bus (average ≤ 1 dB) and clipping still differ, as before.
- **Fast enough to turn a knob** (desktop, Bun): the measurement keeps every output millisecond by
  millisecond (Float32), so a change plays again only the cards it reaches — the rest is played back
  — and cards the measured ones do not hear are not played. A compressor knob: ~20 ms for one strip,
  ~30 for four channels, ~50 for the 75-card stress chain (it was 39 / 119 / 343 measuring all).
  A card dragged across the canvas measures nothing. Weak devices: step 13.
- **The engine split again**: `chain.ts` (the plan and one moment), `engine.ts` (the still picture),
  `time.ts` (the moving one) — the still picture now needs the moving one, without a loop between them.
- **What changes for the learner** (measured, then written into the help, en + bg):
  - Compressor: the average comes down by the gain reduction; the **Attack decides the peaks** — a
    voice at −10 dBu through 2:1 at −20: 12 dB above the average in, about 14 out with the starting
    10 ms (the start of each syllable gets through), about 10 with 1 ms. On the curve the Peaks mark
    sits above it with a slow Attack. Before, the still picture said "12 in, 6 out" whatever the Attack.
  - Noise gate: opens on the **peaks** (a real gate opens at once on a hit): set between the noise and
    the music it drops only the noise, exactly as before; set above the average, its peaks open it and
    the rest of the music is turned down (average −15.8 instead of −90 before).
  - Limiter: no peak passes its ceiling, and each caught peak turns that moment down: the average
    drops a little (1.3 dB on keys peaking 5 dB over it) — before, it stayed untouched.
  - A compressor still costs as much signal-to-noise as it turns the average down (the lesson holds,
    with the measured gain reduction: 8.56 dB on keys at 4:1 from −20, not the 7.5 a steady sound gives).
- **Fixed on the way**: a note rising just before the loop's end (the voice's first syllable) lost
  its rise and jumped from silence to full level at 0 ms — no Attack could catch it; drum hits, keys
  and plucks now rise over 1–2 ms (a stick, a hammer, a pick). A stereo dynamics card gave its
  quieter side the louder side's share of its hiss (−84 instead of −80 dBu on a side 8 dB quieter);
  each side now gets its own, as the moving picture does.
- Tests: 21 old lines changed, each marked `D6` with its reason (the channel strip's compressor
  10.18 dB instead of 8.43; a gate opening on a voice's peaks; a limiter turning the moments down;
  the curve marks now `curveOut`); a quick Attack bringing the peaks closer; the time tests now
  demand exact agreement after dynamics too (356 in all).

Checked in the browser (Intermediate): Mic → Preamp +50 → Compressor → speaker: "Turning down
−6.3 dB", "Peaks 14 dB above the average", the Peaks mark above the curve; Attack to 1 ms: "Peaks
10 dB" — as the help says; a knob step 20 ms (dev build); no console errors.

## ~~11. The fast lane: live meters~~ — done (2026-10-06)

### D10 — decided (user, 2026-10-06, at the start of step 11)

- **The meters replay the render** — not a live AudioContext. Every sound is one loop long, so after
  its dynamics settle a chain repeats exactly every 10 s: the music render (10c) records that loop slice
  by slice and the meters play it back in time with the clock. Asked because the plan's live context
  would not move before the learner's first click (browsers keep audio suspended until then), would run
  every card in real time while playing, and needed a second way of building the chain to take knob
  changes. The real AudioContext waits for Step C, where the sound is heard.
- **No Play / Pause**: "when a source is connected — play the loop on repeat. Simple and straight forward!"
- **Nothing moves at Beginner** (D3 holds).
- **DAW meter maths**: "look up real sound meters on real DAW software to get the math right and show
  Peak, RMS and Noise floor in the same meter" — a light bar for the peak, the mark the peak hold.
- **Meters upright at the card's sides**, In on the left, Out on the right; the 4:3 rule goes ("the
  dynamic processing cards have enough room on the left and right to grow"). **The Parametric EQ keeps
  its size** ("waaay oversized"): its content shrinks, its sliders become knobs.

### What it is now

- **The meter maths** (`src/audio/meters.ts`, what DAWs and the standards do — Logic, Reaper and
  Ableton Live can draw Peak and RMS in one meter): **RMS** over the last 300 ms (a VU meter's
  integration time and the DAWs' RMS window; plain RMS — a sine reads 3 dB under its peaks, as the cards'
  readings say — not the AES17 +3 dB of K-meters), **peak** — the loudest sample at once, falling back
  20 dB in 1.7 s (IEC 60268-18, the EBU digital peak meter) — and its **hold**, 3 s (Pro Tools, the EBU;
  Logic 2–6 s), then falling like the peak. The **noise floor** is the grey fog, as before: measured with
  the music stopped, it does not move. The loop runs into itself (worked out twice round).
- **Recorded by the render** (`audio/processors.ts` `Meter` with `slice`, `audio/measure.ts`): the music
  render keeps every tap's loudest sample and power per 10 ms slice, from a slice boundary of the loop;
  `measureChain` turns them round to the loop's start and hands over each card's movement (in / out, side
  by side; a dynamics card's curve in / out and its turning down) with the same in / out mapping as the
  readings. `signal/moving.ts` moves it by the number engine's step between a change and the next render,
  as D9 moves the readings: a fader moves the meters at once.
- **Played back outside React** (`hooks/useLiveMeter.ts`): one `requestAnimationFrame` loop, 30 pictures
  a second, writes each moving part's own `transform` (`components/meterPaint.ts`) — only meters on screen
  (an IntersectionObserver), not hidden ones (a card's body zoomed out, a face zoomed in), only what
  changed. It plays from Intermediate for every card a wired source reaches (an unwired source stays
  still), unless the system asks for reduced motion; a hidden tab gets no frames; stopping puts the still
  picture back. React still draws the still picture (the loop's average and loudest peak — what Beginner
  and reduced motion see) and the numbers, health words and colours, which stay the render's: the bar
  moves around its number, its colour never flickers.
- **What moves**: every meter — the cards' upright strips, the overview faces (and the Microphone's,
  Instrument's, Guitar Amp's and speakers' faces), Pan's L / R rows, the Main Fader's pair; a dynamics
  card's turning-down bar (in against out over 30 ms — the gain of the moment), its curve's Peaks and
  Average marks with their faint copies (the Noise mark stays), and the Gate's OPEN / CLOSED and the
  Limiter's LIMITING / PASS word and ring (a gate is open while it turns down under 3 dB, a limiter
  limiting over 0.5 dB), so the word never contradicts the moving dot.
- **Meters at the sides** (`components/nodes/MeterSides.tsx`, `MeterStrip`): an upright strip, 76 px in
  every language — its name, the bar (L and R in stereo, each with its letter), the level (mono: number
  and unit; stereo: an L and an R line) and the health word, the same height mono or stereo. Sizes (en):

  | Card (English, mono; measured before and after) | Before | Now |
  |---|---|---|
  | Compressor, Noise Gate | 438 × 428 | 618 × 366 |
  | Limiter | 438 × 372 | 618 × 344 |
  | De-esser (one column: knobs, then its reading) | 438 × 316 | 412 × 344 |
  | Amplifier | 438 × 292 | 412 × 344 |
  | Intermediate Equalizer | 438 × 294 | 425 × 344 |
  | Parametric Equalizer (knobs: Gain, Freq on a log scale, Width) | 682 × 604 | 682 × 540 |
  | Graphic EQ (sliders as they were) | 682 × 605 | 862 × 545 |
  | DI Box (In only; its outputs stay level rows) | 438 × 333 | 432 × 309 |
  | Master / Aux / Matrix Bus (Out only) | 398 × 298 | 398 × 344 (Aux 380: its Mono / Stereo switch) |

  No card changes size between mono and stereo any more (before: 6 px taller in stereo; checked: every
  card with meters, both languages, both levels). Bulgarian is up to 14 px taller where the meters set the
  height ("Прекалено тихо" takes two lines), the DI Box 70 (its description); the Parametric Equalizer
  569 (was 620).
- Words (en + bg): each meter's tooltip (`meters.tip`, Beginner `meters.tipBeginner`: what the solid
  bar, the light bar, the mark and the fog are); the curve's tooltip (its marks move with the sound, the
  Noise is the music stopped) and the Peaks reading's (the light bar).
- Stale comments fixed on the way: the Compressor's and the Gate's Attack / Release "not part of the
  sound yet" (true before 10c).
- Tests: 379 (360 before): the meter maths 10, the moving picture 7, the meter's slices 2.

### Measured (headless Chromium in the cloud container: Inter and DejaVu fonts, software painting, ~2× slower than the desktop of 10c)

- **The recording agrees with the readings**: a voice's moving RMS averages (as power) to the still
  reading exactly (−10.000 dBu), its loudest moving peak is the still peak (+1.855 dBu); two renders of
  different chains give the same card the same frames (0 dB apart — the loop's start lines up); a panned
  bus keeps its sides 9.76 dB apart, as the still readings. Speech at −10 dBu: the peak 7 / 10 / 18 dB
  above the RMS (10 / 50 / 90 % of the time); the Generator's clicks over 14; a sine 3 — "visibly split
  on drums, almost touching on a sine".
- **Render time**, before → after (three runs, twice): a 9-card strip 245–318 → 282–358 ms (+10 %), the
  75-card stress chain 2.1–2.6 s either way.
- **The moving meters' cost on the main thread** (stress chain, a second of it): all 75 cards on screen
  (zoomed out) 552 ms (451 of it painting), one channel strip on screen 182 ms (143), reduced motion 0.
  First tries: CSS variables on each meter's box, 1,039 ms (852 restyling everything in the boxes);
  `will-change: transform` on the moving parts made it worse (947: masked layers). A GPU paints this far
  more cheaply — step 13 checks a real weak device.
- Checked in the dev app, the production build and the one-file copy (opened over http: one request, the
  page itself): the meters move at Intermediate and Advanced, light and dark, English and Bulgarian, mono
  and stereo; a 20 dB Preamp turn moves the Compressor's input meter at once (−30 shown, −10 measured,
  before the next render); an unwired Microphone stays still; Beginner and reduced motion stand still.
- **Smaller bundle**: the meters were framer-motion's only user — the script 859 → 750 kB (gzip 270 →
  235), the one-file copy 1.74 → 1.64 MB.

### Choices made here, to review

- The numbers: RMS 300 ms (plain), peak falling 20 dB in 1.7 s, hold 3 s then falling, 30 pictures a
  second; the light peak bar at 38 % of the bar's colour.
- "When a source is connected and mode is selected": a source plays once it is wired to something, and
  every card it reaches moves; "mode" read as the level (Intermediate and up) — a source always has a
  sound selected.
- Reduced motion keeps the meters still (the loop's picture): with no Pause, it is the only way to stop
  them, for those who asked their system for less motion.
- The moving bar keeps the loop's colour, and the level number and health word under it stay the loop's.
- The Gate's and the Limiter's word and ring follow the moment while it plays (the "Turning down" number
  stays the loop's, its bar moves).
- Upright meters on: the dynamics cards, both Equalizers, the Graphic EQ, the Amplifier, the DI Box (In)
  and the buses (Out). As they were (horizontal): the overview faces — so the Microphone's, Instrument's,
  Guitar Amp's and speakers' faces — and Pan's L / R rows; the Main Fader's upright pair. Should the
  face-only cards' meters stand upright too?
- The Graphic EQ grew sideways (862) rather than squeeze its 31 sliders; only the Parametric EQ kept its
  width (it came out shorter: 540).
- The Parametric EQ's bands as one table (the row names once, a column per band), 28 px knobs; a shelf's
  Width greyed in place. The De-esser in one column; the DI Box's text 300 px wide.
- framer-motion is no longer used but still in `package.json` (removing it changes `bun.lock`: your call).

### Left for the user

1. `bun dev`, Intermediate: Microphone → Gain (the Preamp, +50) → Compressor → Active Speaker. Half a second
   after the chain is built the meters move: on the Compressor, the In meter on its left and the Out meter on
   its right — the solid bar jumping with the words, a lighter bar above it falling back slowly, a thin mark
   (the loudest of the last 3 s); the Average ring and the Peaks triangle ride the curve; the "Turning down"
   bar moves while its number stays. The Microphone's and the speaker's faces move too.
2. Turn the Preamp from +50 to +30: every meter after it drops a quarter of its scale at once, and half a
   second after you let go it carries on without a jump.
3. Drop a second Microphone, unwired: its meter stands still. Wire it into anything: it moves.
4. Advanced: Generator (Click) → Noise Gate: OPEN / CLOSED flips with the clicks, the ring jumps between the
   curve and its floor; on the Generator's meter the light bar stands far above the solid one. Switch it to
   Sine: the two almost touch (3 dB).
5. Line Input set to Stereo → Compressor: two bars on each side, L and R; the card is the same size as in mono.
6. The Parametric Equalizer: as wide as before, shorter; its Gain, Freq and Width knobs turn (Freq: each
   octave the same turn); the curve's dots still drag. The Graphic EQ: wider, its sliders as before.
7. Beginner: nothing moves; the DI Box's meter stands upright, a bar alone.
8. Ask your system for less motion (macOS: Accessibility → Display → Reduce motion; Windows: Accessibility
   → Visual effects → Animation effects off): the meters stand still, showing the loop's average and loudest
   peak. Turn it back: they move again.
9. Bulgarian, light and dark: the meters' words fit ("Изкривяване!" in its 76 px).
10. With your own fonts: does every meter's health word fit? (Checked here with Inter.)
11. The one-file copy from disk (double-click `dist/learn-signal-chain.html`, Wi-Fi off): the meters move
    there too (checked here over http only).
12. A phone or an old laptop: the 75-card stress chain zoomed out cost half of a slow core here, painting in
    software — how does it feel on a real one? (Step 13.)

Original plan:

- The chain plays in a real AudioContext (silent — no output to the speakers until Step C): the same
  graph as the measuring render (`audio/chainAudio.ts` `buildChain` into an AudioContext instead of
  an OfflineAudioContext), the meter worklet sending each card's level as it plays. One animation loop outside React
  writes the moving values straight into the meters, gain reduction bars and transfer-curve dots —
  no card redraws for movement (step 1 makes this possible).
- Real meter behaviour: a fast peak with a peak-hold mark, a slower average (like a VU meter) —
  the two visibly split on drums and almost touch on a sine. That is "peak vs RMS".
- Play / Pause in the header (a teacher freezes the picture to explain). Starts paused when the
  system asks for reduced motion. Stops by itself in a hidden tab.
- Facts from 10c to plan with (not decisions): a browser starts an AudioContext suspended until a
  click or key press, so nothing can play before the first Play; `buildChain` builds into any
  `BaseAudioContext` and returns every card's taps; the meter worklet (`METER_PROCESSOR`) reports once,
  at the end of its stretch — live meters need it to report as it plays (or an AnalyserNode per tap);
  the chain changes while it plays (a knob, a wire), and the measuring render already rebuilds the
  whole graph per change in ~30–130 ms for a typical chain; the cards' readings stay the render's —
  only the meters, bars and curve dots move.

## 12. Wires move with the signal

- Wires brighten and pulse with the level they carry; the flow animation already there keeps the
  direction. A clipped peak flashes red on the wire where it happens.
- From 11: the render's movement is kept per card (in / out); `measure.ts` already works it out per
  output on the way (`movingWires`) — keep it for the wires, and paint them through `useLiveMeter`.

## 13. Check on a weak device

- Chrome dev tools: CPU 6× slower, phone screen size, the stress chain from step 1. Must stay
  smooth (drop to 30 updates a second on slow devices if needed). Battery: nothing runs while
  paused, hidden, or with an empty canvas.
- Real audio for 75 cards at 48 kHz in the offline renders (nothing plays live until Step C — D10): check
  the cost on a slow device; if needed render at a lower sample rate for measuring, or measure only what a
  change reaches.
- The moving meters (step 11): in the cloud container (software painting) the 75-card chain zoomed out cost
  552 ms of main thread a second, one strip on screen 182 — mostly painting. If a weak device struggles:
  fewer pictures a second zoomed out, or the faces' meters without their peak bar.
  From 10c (desktop, dev build): 30 ms for 4 cards, 130 for a channel strip, 1.4 s for the 75-card
  stress chain — a render is mostly nodes (~0.75 ms per node per loop) and the dynamics worklets.

---

## Later — Step C: hear it (not planned yet)

The same audio graph as Step B, routed to the speakers (laptop or phone). Muted until switched
on, low volume by default, a safety limiter on the output. A "listen here" point on any card.
