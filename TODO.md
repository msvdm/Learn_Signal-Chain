# TODO — Levels as scales (Macro → Micro)

The user's plan (2026-10-10). Levels stop being "more palette items" and become **scales**:
- **Beginner** — the macro world: *devices*, not components. Connections only, no signal maths.
- **Intermediate** — the analogue channel strip of a small desk (Yamaha MG12XU as the model), with the
  Interface and DAW present only to record and play back.
- **Advanced** — micro scale: today's full chain plus ADC/DAC thinking, Decoder, Encoder, a real Recorder.

Work through the stages **in order, one stage per session** (`/clear` between stages). This file is the
hand-off between sessions: tick the boxes, and write the stage's *Hand-off* lines before you commit.

---

## How to work on this (overrides CLAUDE.md's "one commit per step" for this upgrade only)

- **Token budget: keep each session well under 500k context.** Stop at ~350k: finish the current
  item, run the checks, commit with the boxes ticked and a Hand-off note, end the session.
- **Read only what the stage lists.** CLAUDE.md is loaded already; don't re-read it. Use Grep to find
  a function before opening a file; open big files with `offset`/`limit`. Don't re-read a file after
  editing it.
- **Locales:** never read `en.json` / `bg.json` whole (bg is 72 KB). Grep the keys you need, and add
  keys by a small Python script (`json.load` → edit → `json.dumps(indent=2, ensure_ascii=False)` +
  newline; then put `levelNames.intermediate` back on one line — see CLAUDE.md). Every new key goes
  into **both** files, in plain beginner-friendly language (The #1 Rule). Bulgarian: natural, not
  literal.
- **Tests:** while working, run only the test files you touched (`bun test src/signal/process.test.ts`).
  At the end of a stage, run `bun run lint && bun run build && bun test` once. When a locked reading
  changes on purpose, update the table with a one-line reason comment. Don't write tests for UI. Add
  pure tests only where a stage says so.
- **Browser check:** once per stage, at the end, with one headless Playwright script in the scratchpad
  (see CLAUDE.md, *Environment*): build the stage's demo chain through the store, screenshot only the
  new or changed cards, and look at them. No step-by-step screenshots.
- **Commit at the end of each stage** (and only then, unless the session must stop early). Message:
  `Levels as scales — Stage N: <title>`. **Never push or tag** unless the user says so.
- **No narration, no extra logging, no debug files committed.** Report to the user only at the
  ⛔ **ASK** points and at each stage's end (3–6 lines: what changed, choices to review, and what
  only they can check).
- New/changed help text (`theory.what/why/tip`) is short. The user revises help texts later.
- No new packages.

### Decided defaults (the user can overrule; don't stop to ask about these)
- Palette visibility becomes an explicit **list of levels per type** (`levels`), not `minLevel`,
  because some types now *leave* at harder levels (Mixer, Stage Box, Studio Monitor).
- **One TypeKey per concept**, with a level-dependent look where needed (like the EQ today): `vocal`
  is the *Human head* at Beginner and *Vocal* with Speech/Singing above, `amp` is a bare icon at
  Beginner, and so on. Ports never depend on the level (the engine and `getPorts` take no level, D5).
- **Beginner runs no engine and no render.** A small pure graph module decides *reaches an output /
  no sound*.
- Keyboard plays the **music** loop until a keys loop exists (see *Later*).
- The `amp` output may feed **only passive speakers**, at every level.

---

## Target palettes (the source of truth for `levels`)

| Type (TypeKey) | B | I | A | Notes |
|---|---|---|---|---|
| `vocal` (new) | ✓ head | ✓ Speech/Singing | ✓ | SPL source → mic only |
| `drum-kit` (new) | ✓ | ✓ | ✓ | SPL source → mic only, drums loop |
| `acoustic` (new) | — | ✓ | ✓ | SPL source → mic only, guitar loop |
| `mic` | ✓ | ✓ Dynamic/Condenser | ✓ | becomes a transducer, not a source; no meter |
| `keyboard` (was `line-in`) | ✓ | ✓ | ✓ | stereo always, no Mono/Stereo switch, keyboard icon |
| `pc` (new) | ✓ | ✓ | ✓ | stereo line source, high level, music loop |
| `instrument` (Electric Guitar) | ✓ | ✓ | ✓ | unchanged |
| `guitar-amp` | ✓ | ✓ | ✓ | unchanged logic |
| `di-box` | — | ✓ | ✓ | |
| `generator` | — | — | ✓ | hidden at Intermediate |
| `decoder` (new) | — | — | ✓ | stereo **digital** source, music loop |
| `mixer` (new) | ✓ | — | — | all-in-one desk, visual only |
| `stage-box` (new) | ✓ | — | — | many in, one snake out → mixer only |
| `interface` (new) | ✓ | ✓ rec/playback | — | see Stage 4; A has ADC / DAC, Encoder / Decoder instead (2026-10-11) |
| `daw` (new) | ✓ | ✓ rec/playback | ✓ | PC icon, dBFS meter; one two-way USB wire to the Interface, no output at I (2026-10-11) |
| `amp` | ✓ icon | ✓ | ✓ | → passive speaker only |
| `phantom` (new, 48V) | — | ✓ | ✓ | bare on/off control |
| `gain`, `hpf`, `pad`, `eq` | — | ✓ | ✓ | EQ: 3 knobs, no graph at I |
| `comp` | — | ✓ one knob | ✓ full | |
| `noise-gate`, `limiter`, `deesser` | — | — | ✓ | hidden at Intermediate |
| `graphic-eq`, `adc`, `dac`, `matrix-bus` | — | — | ✓ | unchanged |
| `fader`, `switch`, `relay`, `pan`, `master-bus`, `aux-bus` | — | ✓ | ✓ | routing unchanged |
| `encoder` (new) | — | — | ✓ | format buttons, out → Broadcast only |
| `active-speaker`, `headphones` | ✓ | ✓ | ✓ | |
| `speaker` (passive) | ✓ | ✓ | ✓ | silent without an amp before it |
| `studio-monitor` (new) | ✓ | ✓ | — | works like an active speaker |
| `stream-broadcast` (new) | ✓ | ✓ | ✓ | at A: fed only by an Encoder |
| `recorder` (new) | ✓ | ✓ | ✓ full | follows its source (mono / stereo); A: "Recorder Track", monitor out, VU or dBFS |

Palette groups: **Beginner** = Inputs · Devices (routing + processing together) · Outputs.
**Intermediate / Advanced** = today's groups.

---

## Stage 0 — Decisions and level plumbing  ☑

Read: `src/data/levels.ts`, `src/data/nodeRegistry.ts`, `src/components/nodes/nodeLook.ts`,
`src/components/ElementPalette.tsx`, `docs/decisions.md` (tail only).

- [x] `docs/decisions.md`: add **D20–D23** in full, dated 2026-10-10, plus one line each in CLAUDE.md:
  - **D20 — Levels are scales.** Beginner shows devices and connections only: no engine, no render,
    no real meters (decorative ones on Mixer/DAW only). It replaces D3/D5 *for Beginner*. Intermediate
    is the analogue desk, Advanced the full digital picture. Some elements leave at harder levels.
  - **D21 — The microphone is not the sound.** Sources that make sound in the air (Vocal, Drum Kit,
    Acoustic, Guitar Amp) feed a Microphone through its Sound input. The mic is Dynamic or Condenser.
    A Condenser without 48V switched on in its chain gives no signal.
  - **D22 — Interface and DAW at Intermediate: record and play back only** (the user's "5 · 1 · 2"):
    (5) they never sit inside a processing chain: a mix goes in to be recorded, the DAW plays back
    into the desk or the monitors; (1) the separate USB Audio Interface is the relatable hook, like
    the MG12XU's USB; (2) a **Look inside** button shows the same channel strip, digital, inside
    the box. Wire colours stay for signal health only — the digital side is not colour-coded.
  - **D23 — Advanced adds the digital picture:** Decoder (digital source), Recorder (Mono/Stereo,
    monitor out, VU on analogue, dBFS on digital), Encoder (encoding is more than A/D conversion) →
    Stream/Broadcast.
- [x] Registry: replace `minLevel` with `levels: ComplexityLevel[]`. Update `availableAt` and every
  `minLevel` reader (grep). Apply the table above **for existing types only**. New types come in
  their stages. Move `noise-gate`, `limiter`, `deesser` and `generator` out of Intermediate.
  `gain`, `fader` and `di-box` leave Beginner.
- [x] Palette: per-level grouping (Beginner: Inputs · Devices · Outputs). Keep `NODE_LOOK`'s order as
  the order inside each group (the user's palette order, *smaller calls*).
- [x] CLAUDE.md: replace the *Level system* table with "see `levels` in `NODE_REGISTRY` and TODO.md".
- [x] Checks + commit. *Hand-off:*
  - `levels` uses three constants in `nodeRegistry.ts` (`EVERY_LEVEL`, `FROM_INTERMEDIATE`,
    `ADVANCED_ONLY`); a new type that leaves at harder levels writes its list inline
    (`['beginner']` for the Mixer, `['beginner', 'intermediate']` for the Studio Monitor).
  - Sections: `PALETTE_SECTIONS` in `nodeLook.ts` (Beginner's Devices = the `processing` and
    `routing` groups). A section with nothing at a level is hidden with its tab, so Beginner shows
    no Devices tab until devices arrive (Stage 4 / 6). The Amplifier keeps its `output` group, so at
    Beginner it is under Outputs; give new devices `processing` or `routing`.
  - The mic's Sound input now shows at every level (the Guitar Amp is at Beginner): the
    hide-it-at-Beginner check in `PortStack` went, and `PortStack` / `CardFrame` lost `typeKey`.
  - Beginner has no Gain now, so a mic chain there reads Too Quiet until Stage 6 takes the engine
    away at Beginner.
  - D3, D5 and D13 in `docs/decisions.md` point to D20 / D21. README's *Learning Levels* table is
    out of date: Stage 8.

## Stage 1 — Separate the microphone from the source (engine core)  ☑

The biggest engine change. Read: `graph/queries.ts` (grep `SOUND_PORT`, `instrumentAt`, source
detection), `graph/connectionRules.ts`, `signal/process.ts` (sources, `soundOf`, `PEAKS_ABOVE`,
`NOISE_BELOW`), `audio/loops.ts`, `audio/chainAudio.ts` (sources only), `utils/chainFile.ts`
(`OLD_WORDS`), `test/chains.ts` helpers.

- [x] New SPL sources `vocal` (param `character`: speech | singing), `drum-kit` (drums loop) and
  `acoustic` (guitar loop): output on `SOUND_PORT` (the dotted wire, as the Guitar Amp's), so a mic
  is the only thing that takes them (that rule exists). One source may feed several mics (a kit with
  three mics). Each has a dB SPL meter (D13 moves from the mic to the source).
- [x] `mic` becomes a transducer: SPL in → dBu out, param `micType: 'dynamic' | 'condenser'`.
  **Calibrate so a Dynamic mic on a Vocal (speech / singing) or Drum Kit gives exactly today's
  Microphone readings**, so the locked tests keep their numbers; only their chain-building changes.
  Condenser: start at +12 dB more output and its own self-noise; measure, then write the help text.
  The mic is not a chain's source any more: the chain colour comes from the sound source. A mic with
  nothing on its Sound input says "Not connected" (D11).
- [x] Mic card: a `FaceCard`, Dynamic | Condenser buttons, **no meter**.
- [x] `line-in` → `keyboard` (TypeKey rename; `OLD_WORDS`): always stereo, no Mono/Stereo switch, no
  character buttons, keyboard icon, music loop, −10 dBu.
- [x] New `pc`: stereo line source, 0 dBu, music loop, PC icon.
- [x] `chainFile`: old files open sensibly. A `mic` with `character` becomes mic (dynamic) + a new
  `vocal` / `drum-kit` placed to its left and wired in. A mic already fed by a Guitar Amp gets no new
  source. Old `line-in` becomes `keyboard`. Extend `chainFile.test.ts` for both.
- [x] Icons for the new sources in `icons.tsx` (simple line icons in the existing style).
- [x] Locales: names + `theory` for vocal, drum-kit, acoustic, keyboard, pc, mic types.
- [x] Checks + commit. *Hand-off:*
  - **The Sound wire's scale**: its level + `SOUND_SPL_DB` (116, `signal/levels.ts`) = dB SPL at the
    mic; how loud each sound is: `SOUND_SPL` (`process.ts`: speech 86, singing 96, drums 110, acoustic
    guitar 90); `sourceLevelOf(node)` gives any source's level. The Guitar Amp was already on it.
  - **The mic** is a `processor` whose job is a gain (`MIC_GAIN_DB` in `gains.ts`: dynamic −30,
    condenser −18) — not `passesThrough` (stereo `never`), so walks stop at it. Its noise is its own
    output noise (`ownNoiseOf` → `micNoiseDbu`): the room it hears (`ROOM_SPL` 20 dB SPL: −126 dBu
    on a dynamic, −114 on a condenser) and a condenser's self-noise (`SELF_NOISE_SPL` 13 dB SPL).
    Measured (engine and render agree to 0.03 dB): a dynamic on speech −60 dBu, noise −126; a
    condenser −48, noise −113.2 — 12 dB more signal, the room 12 dB louder. Unfed it is silent and
    `unwiredSource` (D11) is true for it (no input, whatever its output).
  - Stage 2's 48V: walk down from the mic (its output) — `preampSourceOf` already finds the mic
    behind a Gain. `FaceWithChoices` (`SourceParts.tsx`) puts buttons beside a face's icon from
    `CHOICE_LEVEL` (was `CHARACTER_LEVEL`); `FaceCard` takes `meter={false}` (the mic).
  - Tests: `line(id)` in `test/chains.ts` is a mono line source (the Generator's Noise — 10 dB
    cleaner than the Line Input was; only the averages of the `expectCards` tables use it);
    `voiceInto(id)` + `heard(id)` + the `VOICE` row put a Vocal before a mic. Readings that lock a
    line's noise use the Keyboard (stereo: each side reads as the old mono line; the aux buses in
    those tests set to Stereo so nothing folds). One reading moved on purpose (the drum machine at
    +4 dBu: noise −86, the Generator's clicks).
  - Files: `CHAIN_VERSION` 2; a version 1 mic gets its Vocal / Drum Kit (`soundsForMics`), a Line
    Input becomes a Keyboard (`OLD_TYPES`), old settings are dropped (`OLD_KEYS`). An old mono Line
    Input is a stereo Keyboard now: into a one-channel card (a speaker, a mono Aux) it reads 6 dB
    hotter than it did.
  - Icons are lucide's (Speech, Drum, Guitar, KeyboardMusic, Computer — since Stage 3 the Vocal's and the Computer's are ours; `icons.tsx` holds only what
    lucide lacks); `JackPlugIcon` went. Palette order (sources): Vocal, Drum Kit, Acoustic Guitar,
    Microphone, Keyboard, Computer, Instrument, DI Box, Guitar Amp, Generator; the empty-canvas hint
    starts at the Vocal. The PC is "Computer" / "Компютър", the Keyboard "Синтезатор" in Bulgarian.
  - `paramChoices(key)` lost its type argument (every word list is one per key now).

## Stage 2 — The MG12-style channel strip (Intermediate)  ☑

Read: `components/nodes/PadNode.tsx` / `SwitchNode.tsx` (pattern for a bare control),
`components/nodes/conditions.tsx`, `signal/process.ts` (`StageCondition`, `SILENCES`),
`components/nodes/CompressorNode.tsx`, `DynamicsLayout.tsx` (grep only), `EQNode.tsx`.

- [x] New `phantom` (48V): a bare on/off control like the Switch (`FreeControl`, `freeSize`), passes
  the signal unchanged, `PASSIVE`.
- [x] Condition `no-phantom` on a **Condenser** mic: walk downstream from the mic through
  `passesThrough` cards up to and including the first Gain (Preamp). If no `phantom` there is On,
  the mic's output is silent (`SILENCES`). Its `FaceNote`: "No phantom power (48V) — a condenser mic
  needs it to work". Dynamic mics ignore 48V. Pure test in `queries.test.ts` / `engine.chains.test.ts`.
- [x] Compressor at Intermediate: **one knob** (0–10) setting threshold, ratio and makeup together,
  as the MG12XU's one-knob COMP does. Look up the MG12XU spec sheet for the ranges and use those;
  if it isn't reachable, use threshold +22 → −8 dBu, ratio 1:1 → 4:1, makeup 0 → +7 dB, attack
  ~25 ms, release ~300 ms, and say so at stage end. Same `comp` type and processor: the knob writes
  the existing params (`initialParams` / a level-dependent face, like the EQ). Advanced keeps the
  full card.
- [x] EQ at Intermediate: three knobs Low / Mid / High - as the current state - no change.
- [x] Locales for 48V, the condition, the one-knob compressor.
- [x] Browser check: Vocal → Condenser mic → 48V → Gain → HPF → EQ → Comp → Fader → Master → Active
  speaker, with 48V on and off.
- [x] Checks + commit. *Hand-off:*
  - **48V** (`phantom`): a bare button (`NamedButton`, shared with the Pad and the HPF): "48V" lit
    red while on, the same word greyed out when off (the user's calls, 2026-10-10 — the buttons'
    colours: `SquareButton` `tone`, Switch green, 48V red, HPF violet, Pad yellow);
    param `on`, **starts On** when dropped; `PASSIVE`, passes the signal on (`PROCESS` `pass`,
    `OTHERS` identity). Palette: first in Processing.
  - `phantomPowered(micId, view)` (`graph/queries.ts`): from the mic's outputs through `passesThrough`
    cards, stopping at a Gain; one branch with a 48V On is enough (a split mic), none after the
    Preamp counts. `CardPlan.unpowered` → `runChain` sets `noPhantom` and a silent wire (no hiss; the
    Preamp after it still hisses); the render silences it through `SILENCES`. The mic's note goes
    under its icon and buttons (`FaceWithChoices` takes the condition).
  - **One-knob Compressor**: `oneKnobComp(k)` / `oneKnobAt(threshold)` in `nodeRegistry.ts`, the
    MG12XU sheet's figures (confirmed on Yamaha's spec page). No new param: the knob is read back from
    `thresholdDb` and writes all five settings. Dropped below Advanced it starts at **7**. Below
    Advanced it is **no card** (the user's call): a bare 165px knob in the hot colour like the Gain's
    and Pan's (`FreeControl`, `textScale` 2), its position (0 … 10) under its name and the Turning
    down bar as its footer; no curve, no meters, no On/Off (Bypass stays in the right-click menu).
    `isBareAt(type, level)` picks the face; the registry's `bareSize` and the size memory keyed by
    shape (`usualSize(type, level)` in `layoutHelpers.ts`) keep drop previews right at each level.
    Pasting from an Advanced file at Intermediate (`raiseLevel`) turns a knob into the full card in
    place: it can overlap its neighbours. Measured on a voice at 0 dBu: it starts turning down at ~6,
    2.2–2.4 dB at 7, 7.5–8.5 at 10; the makeup leaves it ~2.5 dB louder at 7 (the meters after it read
    Hot); speech's peaks rise up to 4.4 dB at 10 (the 25 ms attack lets each word's start through) —
    all in the help text.
  - **Equalizer and HPF below Advanced** (the user's call, after the plan said "no change" for the
    EQ): bare too, so the Intermediate input chain is 48V · Preamp · HPF · EQ · Compressor · Fader,
    all bare controls. The EQ: three 165px knobs (the Gain's size) side by side (Low · Mid · High,
    band colours), its name under them; the Parametric card (Advanced) keeps its meters. The HPF:
    `NamedButton`, the high-pass sign over "HPF" (`HpfSign`, after the user's drawing), its On / Off
    is the card's bypass, 80 Hz under its name (`levelNames.intermediate.hpf`: "High-Pass Filter" /
    "Високочестотен филтър"); the Advanced card lost its zoomed-out level (`NodeWrapper`
    `showLevel={false}`). `NamedButton` moved to its own file. `isOneKnob` / `oneKnobSize` became
    `isBareAt` / `bareSize` (the three types). Zoomed out at Advanced the HPF is that button too (the
    user's call; `bareZoomedOut`, `isBareAt(type, level, overview)` — the size memory keys it as
    bare), its name spelled out under it at every level (`nodes.hpf.name`), its cutoff under that.
  - Help texts: `theory.phantom` (new), the mic's tip (48V), the compressor's `what` + `tip` (one knob),
    the HPF's `what` (the button) and `tip`.

## Stage 3 — New outputs, passive speaker and amp  ☑

Read: `SpeakerNode.tsx`, `ActiveSpeakerNode.tsx`, `AmpNode.tsx`, `connectionRules.ts`.

- [x] `studio-monitor`: works like `active-speaker` (built-in amp, SPL meter), its own icon.
- [x] `broadcast` (Stream / Broadcast): a sink, stereo, dBu meter at I. At Advanced it accepts only
  a `encoder` (rule added in Stage 7).
- [x] `recorder` (simple form, B/I): a sink with a level meter (dBu at I).
- [x] `speaker` (passive) and `amp` now also at B and I. Rule: the `amp` output feeds **only**
  `speaker`, at every level (`nodeAcceptsWire`). The existing "passive speaker needs an amp" logic
  stays, and its note at B/I reads "No sound — a passive speaker needs an amplifier before it".
  Grep the tests for amp → non-speaker wires and fix them.
- [x] Locales + icons.
- [x] Checks + commit. *Hand-off:*
  - **Studio Monitor** (`studio-monitor`, levels B + I): everywhere the Active Speaker is (`GAINS`
    `volumeDb`, `poweredSpeaker`, `AMP_NOISE_DBU`, `SPL_DB` 110, `DESK_INPUTS`, `VolumeFace`),
    `ActiveSpeakerNode` draws it; lucide's `Speaker` icon. `POWERED_SPEAKERS` (`signal/chain.ts`) is
    the set an Amplifier blows.
  - **Recorder** (`stereo: 'follow'`: records a stereo wire in two channels, a mono one in one) and
    **Stream / Broadcast** (`broadcast`, `stereo: 'always'`: a mono wire goes out on both sides):
    sinks, `PASSIVE`, `PROCESS` `pass` (analog or digital as it arrives — Stage 7 adds the Encoder
    rule), `OTHERS` identity. One card for both, `RecorderNode.tsx` (`FaceCard`, the big icon, its
    meter in dBu labelled Input — `FaceMeter` labels any sink without SPL so; notes: Bad sound, hum).
    Icons: lucide's `CassetteTape`, `RadioTower`. Stage 7's Advanced Recorder (Mono | Stereo switch,
    Monitor out) changes `stereo` to `'optional'` and adds the output for every level (ports never
    depend on the level).
  - `passesThrough` now needs an output too (the Recorder is `follow` with one input): no change
    for any existing type.
  - **The rule**: `nodeAcceptsWire` refuses any wire from an `amp` into anything but a `speaker`
    (so `wireTakesCard` refuses an Amplifier dropped onto a wire into anything else). The `blown`
    condition stays: an Amplifier taking a bus's L / R over moves the other side's wire onto itself
    (checked in the browser: Master L → Active Speaker, then Master R → Amplifier → blown), and older
    files can hold the wire. The `speakers` test keeps its amp → active / headphones wires, with a
    comment saying so; a new `the ends` test locks the three new types.
  - Texts: `nodes.speaker.label` ("Speaker / Monitor") went — the card is named "Passive Speaker"
    as in the palette, since the Studio Monitor is its own card now; `needsAmp` reworded (every
    level); the amp / active speaker / headphones help says an Amplifier's output plugs only into a
    passive speaker. Palette order (outputs): the four as before, then Studio Monitor, Recorder,
    Stream / Broadcast. Bulgarian: Студиен монитор, Рекордер, Стрийм / Излъчване.
  - After the stage (the user's calls): the **Computer is a face card** (`InstrumentNode` serves
    it, `FACE_SIZE`; only the Keyboard is a full source card now), and the Vocal and the Computer
    have **icons drawn after the user's pictures** (`VocalIcon` — a thin line, 1; 1.5 below 24 px —
    and `LaptopIcon`, `icons.tsx`). Fixed on the way: a stereo meter hidden while not connected
    showed its L / R letters (`SideLetter`).

## Stage 4 — Audio Interface and DAW: record & play back (Intermediate)  ☑

The core teaching idea of Intermediate (D22, rule 5 + hook 1). Read: `signal/chain.ts` (how outputs
map to inputs, `outputKey`), `graph/graph.ts` walks, the `adc` / `dac` entries in `process.ts` and
`chainAudio.ts`.

**Behaviour:**
- `interface` ports: `in` (line in — takes several wires, like a bus input: the channels being
  recorded), `to-pc` (USB → DAW), `from-pc` (USB ← DAW), `out` (line / monitor out).
  Internally two independent paths: `in → to-pc` is an ADC (dBu → dBFS, alignment 18), and
  `from-pc → out` is a DAC. **Per-output routing**: an output's level comes from its own input, not
  from every input. Add this to the plan generically (e.g. `routes: { 'to-pc': 'in', out: 'from-pc' }`
  in the registry) rather than special-casing the type.
- `daw` ports: `in` (records: dBFS meter), `out` (plays back). **The DAW is a source on its output**
  (the music loop at about −18 dBFS RMS); its output does not depend on its input. Graph walks must
  stop there, so Interface → DAW → Interface is not a cycle.
- **Rule 5 (connection rules):** `to-pc` → only `daw.in`; `daw.out` → only `interface.from-pc` (or
  `mixer`, Beginner). `interface.in` takes line-level wires only (not a mic before its Preamp, not
  `SOUND_PORT`). `interface.out` feeds Gain (as a line channel), Fader, buses or outputs.
  `wireTakesCard` is false for `interface` and `daw`: they are never dropped into a chain.
- At Intermediate the cards show **no** converter wording: Interface = USB box icon with an input
  meter (dBu) and a USB/return indicator; DAW = PC screen icon with a dBFS meter.
- Meters: the Interface's input meter in dBu, the DAW in dBFS (the `stage.domain` system exists).
- [x] Registry + routing + engine + render (`OTHERS`: reuse the ADC/DAC nodes' code), pure tests:
  record path level (0 dBu in → −18 dBFS at the DAW), playback path (−18 dBFS → 0 dBu out), no cycle.
- [x] Cards, icons, locales.
- [x] Browser check: Master L/R → Interface → DAW, and DAW → Interface → Studio Monitors.
- [x] Checks + commit.
- [x] ⛔ **ASK** — send the user the two screenshots and one line on how it behaves; wait for an OK
  before Stage 5 (OK: "continue with stage 5", 2026-10-11). *Hand-off:*
  - **Routes** (`NodeTypeDef.routes`, `Route` in `nodeRegistry.ts`): a card's paths that never meet,
    each `{ from, to: [...], as }` — the input it reads (null: makes its own sound), the outputs it
    sends on (empty: only takes in), the type whose job it does (`as`). Interface: `in → to-pc` as
    `adc`, `from-pc → out-l / out-r` as `dac`; DAW: `in →` as `recorder` (records), `→ playback` as
    `daw` (its own song, a digital source: `DIGITAL_SOURCES` in `process.ts`, −18 dBFS). The card
    shows its **first** route.
  - The walk is path by path (`flowPaths` in `graph.ts`; `flowOrder` = its cards): Interface →
    desk → the same Interface is no loop (tested). `planChain` makes one `CardPlan` per path:
    `key` (the card's id for its first path, `pathKey` for the others — `cards`, taps and the render's
    readings are keyed by it), `route`, `job` (the node as its maths sees it: `{ ...node, typeKey:
    route.as }` — PROCESS, GAINS, OTHERS, ownNoiseOf take it). `used[].from` is the sending plan's
    key; `domainFrom` holds wire keys; each output's domain is kept per wire (`StageResult.outDomains`,
    `outDomainOf(stage, port)` — wire colours, port rings and `withMeasured` read it).
  - **The Interface has Line out L / R** (not one stereo `out` as planned): one stereo out into two
    monitors folded L + R into each, +6 dBu, "Hot". `portSide` makes them `left` / `right` wires.
  - **The USB link** (`portAcceptsWire`): `to-pc` → only a DAW's input, and a DAW takes nothing
    else; the DAW's output is `playback` (`PLAYBACK_PORT`, a port of its own so the rule needs no
    node lookup) → only `from-pc`, which takes nothing else (Stage 6: add the Mixer here). The line
    input takes many wires (`NodePort.many`) but no mic-level (`micLevelAt`, `queries.ts`) or
    instrument-level signal (`nodeAcceptsWire`). `wireTakesCard` is false for any card with routes.
  - **Not connected** (`unwiredSource`): a card with routes only while nothing at all is plugged
    in — a DAW only playing back is connected, its meter (what it records) reads nothing.
  - **Chain colours** follow routes (`upstreamOf(id, edges, nodes)`): monitors after the playback
    show only the DAW's colour. `chainSourcesOfEdge` counts sources as chain starts even when wired in.
  - Cards (`InterfaceNode.tsx`: `InterfaceNode`, `DawNode`): `FaceCard` with `meterAt="in"` (new:
    the meter and the zoomed-out level read what arrives — `OverviewFace` `at`); a line across the
    face on each port line ("Line in ──→ To computer", "From computer ──→ Line out"; the DAW
    "Records · Plays back", no arrow), each name lit (accent) while sound passes; zoomed out the icon
    alone. Icons: lucide `Usb`, ours `DawIcon` (a screen with a waveform). Palette: Routing, after the
    buses ("Audio Interface", "DAW (Recording App)" / "Аудио интерфейс", "DAW (програма за запис)").
    Both at every level (the table): Beginner shows these Intermediate cards until Stage 6.
  - Measured (engine and render agree): Keyboard −10 dBu through the desk → Interface −9.8 dBu → DAW
    −27.8 dBFS; the DAW's song −18 dBFS → Line out 0 dBu → a Studio Monitor 110 dB SPL.
  - **Changed 2026-10-11 (the user's calls):** the USB link is **one two-way wire** (Interface's To
    computer → DAW): the store keeps its way back (`graph/usbLink.ts`: the DAW's `playback` and the
    Interface's `from-pc` are `hidden` ports, the wire is never drawn; the USB wire has no flow and a
    ⇄ halfway). One computer per Interface. The DAW has no output of its own; the Interface's line
    output is **one stereo `out`** ("From computer → Line out", row 1), into a Gain / Fader / bus /
    monitor — straight into two monitors each folds it (+6 dBu, Hot).

## Stage 5 — "Look inside" (Intermediate)  ☑

D22, explanation 2. Read: `ConfirmDialog.tsx` (portal pattern), `icons.tsx`.

- [x] A small **Look inside** button (click, not hover — D19) on the Interface and DAW cards at
  Intermediate. It opens a read-only overlay (portal, Esc closes, `lsc-overlay`):
  - Interface: `Preamp → A/D converter → USB ⇄ computer → D/A converter → Line out`
  - DAW: `Input trim → HPF → EQ → Compressor → Fader → Mix bus → Master`, drawn with the
    **same icons** as the desk's cards, greyed, with a "digital" tag
  - One sentence: *"The same channel strip as your desk — but as numbers, inside the computer. You
    can build it yourself in Advanced."* (en + bg)
- [x] Pure data for the two diagrams (an array of icon + locale key), one small component.
- [x] Checks + commit. *Hand-off:*
  - `LookInside.tsx`: `INSIDE` (per box, its steps in sound order: an icon taken from `NODE_LOOK` —
    so they stay the desk's —, an `inside.steps` key, `digital`), the button and the view. The
    button only at Intermediate (`useLookInside`, `InterfaceNode.tsx`), under the icon (`Face`'s
    `footer`); zoomed out the face is its icon alone, so no button. The view: a portal to `body`,
    `lsc-overlay`, `role="dialog"`, Esc (capture, so the canvas keeps its selection), the backdrop or
    Close shut it; React events are stopped at its root (in React's tree it sits in the card: a click
    would select it, a right-click open its menu). Checked in the pane: no selection change, Esc /
    backdrop / Close, Bulgarian and dark, unplugged (the note under it), no button at B / A / zoomed out.
  - The digital steps are greyed (muted icon, sunken box) in one dashed frame tagged "Digital"
    (`DigitalFrame`): the Interface's is only *USB ⇄ computer* between the converters; the DAW's
    holds all seven. Interface: Preamp (the Gain's icon) → A/D converter → USB ⇄ computer (the
    Interface's icon) → D/A converter → Line out (lucide `Cable`); the converters carry a caption
    (`inside.does`: "sound → numbers", "numbers → sound"). DAW: Input trim → High-pass filter →
    Equalizer → Compressor → Fader → Mix bus (the Master Bus's icon) → Master fader (the Fader's
    icon, as the desk's Main Fader is a Fader). The dialog is 820 px: Bulgarian's seven steps just
    fit one row (it wraps on a narrow window).
  - Texts (`inside.*`, en + bg): the DAW's sentence is the plan's; the Interface's ("Your sound is
    turned into numbers for the computer, and the computer's numbers back into sound. You can build
    it yourself in Advanced.") is new. Step names spell the jargon out (not "HPF", "EQ").

## Stage 6 — Beginner: the macro scale  ☑

D20. Read: `store/measuring.ts`, `hooks/useGraphSignal.ts`, `hooks/useFlowElements.ts` (edge colour),
`FaceCard.tsx`, `OverviewFace.tsx` (grep `overviewBare`), `NodeWrapper.tsx` (header only).

- [x] **No engine at Beginner:** the store does not render or run the number engine below
  `DETAIL_LEVEL`. A new pure `graph/reach.ts`: which nodes a source reaches, and each output's verdict
  (*sound* / *no sound — not connected* / *no sound — needs an amplifier*). Wires at Beginner: one
  neutral colour with the flow animation when they lead to an output (no health colours). Tests for
  `reach.ts`. **Neutral** (the user's call, 2026-10-11): D24's colours by destination
  (`graph/wireFlow.ts`) start at Intermediate; at Beginner every wire is the one neutral colour.
- [x] **Inputs are bare at every zoom** at Beginner: icon + name, no card, no meter (like
  `overviewBare` today). The mic shows no type buttons; the Vocal is a **human head**.
- [x] `mixer`: Parametric-EQ size (410 × 361). Its input takes any number of wires. Outputs: Main and
  Monitor (also feeds Recorder, DAW, Interface). Zoomed out: only the word **MIXER**. Zoomed in: a
  drawing of a small desk (an SVG, original, in the app's line style — a few channel strips with
  knobs and faders) under the title, and a **decorative dBu meter** (a fixed "good" level when a
  source reaches it, empty otherwise — not measured).
- [x] `stage-box`: icon; input takes any number of wires; one output (the snake) → `mixer` only.
- [x] Beginner faces for `amp` (icon, no knob), `interface` (like the Mixer, different drawing),
  `daw` (PC icon, decorative dBFS meter). Same ports as at Intermediate. At Beginner, `daw` may also
  connect from/to `mixer`.
- [x] Outputs at Beginner: icon + verdict note (`FaceNote`), no meters.
- [x] Locales: Beginner names and `theory` for the new devices (macro wording: "what this box does in
  the room").
- [x] Browser check: build the user's stage-plan picture — mics on drum kit and head, Keyboard →
  Stage Box → Mixer → Amp → Passive speakers, Mixer → Active wedges, PC → Mixer, Mixer → Interface ⇄
  DAW. Screenshot zoomed in and zoomed out.
- [x] Checks + commit.
- [x] ⛔ **ASK** — show the Mixer drawing and the whole stage plan; wait for the user's look-and-feel
  OK (2026-10-11: "I like the drawing" — the Mixer three times bigger, no zoomed-out name card;
  a mic straight into a speaker stays "Sound": "still a signal chain"). *Hand-off:*
  - **No engine at Beginner**: `SIGNAL_LEVEL` (`levels.ts`); `signalIn(s)` (`hooks/useGraphSignal.ts`)
    is the engine's picture from Intermediate and an empty one at Beginner — `useStage`, `useWire`,
    `useGraphSignal`, `useNodeName` and `NodePort` read it. `store/measuring.ts` renders nothing at
    Beginner (and starts when the level rises). Every type still has its engine entries (a Beginner
    card pasted at Intermediate works: the Mixer and Stage Box add their wires up, `PASSIVE`).
  - **`graph/reach.ts`** (pure, tested): `reachOf(view)` → `arriving` (`<id>:<port>` a sound reaches),
    `carrying` / `flowing` wires, `verdicts` per end point (`sink`): `sound`, `not-connected`
    (nothing plugged in), `no-source` (wires, nothing that makes sound before it — added to the
    plan's three: "not connected" read wrong on a wired speaker), `needs-amp`. Routes are followed
    (an Interface's line in never reaches its line out); a wire flows when its sound ends at an end
    point that plays it or a DAW that records. `reachIn` caches one answer per change.
  - **Wires at Beginner** (`useFlowElements`): `--lsc-wire-neutral` (`index.css`, both themes), the
    dotted sound wire too; flowing only when `reach.flowing` has them, otherwise a still solid line
    (`ChainEdgeData.still`); stereo twin lines and the ports' L / R letters from `outputKind` (the
    wiring); plugged port rings neutral. The wire preview reads `outputKind` at every level.
  - **New types** `mixer` (410 × 361, `in` many, outputs `main` / `monitor` — `MIXER_MAIN_PORT`,
    `MIXER_MONITOR_PORT`; `category: 'merge'`, stereo always; after the ASK 1230 × 728 — three times
    as wide, as tall as its drawing then is) and `stage-box` (FACE_SIZE, `in` many,
    `out`), both `levels: ['beginner']`, palette Devices before the Interface. Rules: a Stage Box's
    output only into a Mixer (`nodeAcceptsWire`); a DAW takes a Mixer's output too (`portAcceptsWire`).
  - **Mixer ⇄ DAW** (my call, to review): a wire from a Mixer's output into a DAW is a USB wire like
    the Interface's (`isUsbWire`, `graph/usbLink.ts`: its way back is the DAW's playback into the
    Mixer's input; drawn ⇄, no flow) — so the DAW connects "from/to" the Mixer with no new port.
  - **Faces** (`BeginnerFaces.tsx`, `atBeginner` in `nodes/index.ts`): inputs (Vocal — its
    `VocalIcon` is already a head —, Drum Kit, Mic, Keyboard, Computer, Instrument, Guitar Amp) bare,
    icon + name (name fitted, up to 72 px zoomed out); outputs icon + verdict (zoomed in why, zoomed
    out only "Sound" / "No sound", up to 44 px; a passive speaker without an amp crossed out, hot);
    Amplifier, Stage Box (`StageBoxIcon`), DAW (+ a dBFS `StillMeter`) an icon; Mixer (`MixerIcon`,
    `MixerDrawing`: six strips, master section) and Interface (`InterfaceDrawing`: two combo inputs,
    gains, 48V, monitor knob, USB sign, phones) a header, port lines (`PortLine`, geometry in
    `portLines.ts`) and a drawing with a dBu `StillMeter` (`SignalMeter.tsx`: both bars at −6 dB
    under unity while lit, no numbers; the Mixer's three times its size — `MIXER_SCALE`); zoomed out
    the Interface's name in capitals, the Mixer the same as zoomed in.
    Beginner faces have no meter room, so sizes are remembered apart (`shapeKey` `:beginner`).
  - Texts: `palette.items` / `theory` for `mixer`, `stage-box`; `beginner.*` (verdicts, Inputs, Main,
    Monitor). Bulgarian: Миксер, Стейдж бокс (мултикор), Основен / Монитор, „Има звук“.
  - Checked in the pane and headless (Brave over CDP): the stage plan light / dark, en / bg, zoomed
    in and out; every type on a Beginner canvas (no errors, nothing rendered); the same at
    Intermediate (the render runs). A mic straight into a speaker reads "Sound" at Beginner — kept
    (the user's call).

## Stage 7 — Advanced: Decoder, Recorder, Encoder → Broadcast  ☑

D23. Read: the domain logic (grep `domain`, `inDomain`, the mixed analogue/digital bus check),
`SignalMeter.tsx` (scales only).

- [x] `decoder`: stereo source whose signal is **digital** from the start (dBFS), music loop. The
  existing rule "analogue and digital chains can't meet in one mix bus" applies to it unchanged.
- [x] `recorder` at Advanced (named **Recorder Track** since 2026-10-11, `levelNames.advanced`): **no
  Mono | Stereo switch** — it follows its source (the user's call, 2026-10-11: `stereo: 'follow'`
  stays) — and an output that passes what it records on (its Monitor out) into **any processing or
  routing card** (the user's call, 2026-10-11: "bring it back to a channel or listen to it" — a
  Gain, a Fader, a bus …; to listen, through them to an output: headphones need their Gain). Meter: dBFS on a digital
  chain; on an analogue chain a **VU meter** (average-reading, ~300 ms, 0 VU = +4 dBu, scale −20 …
  +3 VU). A needle face, or the bar with a VU scale — pick the one that fits `SignalMeter`/`meterPaint`
  with less code, and say which at stage end.
- [x] `encoder`: a small card with format buttons (MP3 · AAC · Opus; param `format`, `PARAM_CHOICES`),
  passing the level on. Its only output → `broadcast` only. At Advanced, `broadcast` accepts only a
  `encoder`. Fed an **analogue** signal, the Encoder says "needs a digital signal — put an A/D converter
  before it" and is silent: the lesson that conversion alone isn't the whole picture.
- [x] `daw` at Advanced (the user's calls, 2026-10-11 — **"keep it simple"**): the **Audio Interface
  is not in Advanced's palette** — the ADC / DAC and the Encoder / Decoder take its place. The DAW has
  no output at Intermediate (one two-way USB wire to the Interface); at Advanced it has one — its
  song (digital, −18 dBFS) — that goes **only into a Recorder Track**: DAW → Recorder Track →
  any processing or routing card. So the DAW's ports depend on the level (the user overrules the
  decided default for this one card): the simplest way is its `playback` port shown at Advanced
  (today it is hidden, the USB wire's way back — `graph/usbLink.ts`; at Advanced there is no
  Interface, so no USB wire). Nothing plugs into the DAW at Advanced. The old plan (the DAW's output
  feeding digital processing cards — a DAW *is* a mixer) is dropped. The analogue/digital bus rule
  still holds. Studio Monitor is hidden here (Stage 0 table).
- [x] Tests: decoder domain, encoder condition, recorder meter domain.
- [x] Locales, icons, checks, commit. *Hand-off:*
  - **Ports drawn per level** (the user's call for the DAW): `NodePort.levels` — drawn (and wired)
    only at those levels; `drawnPorts(node, level, view?)` (`graph/queries.ts`) leaves out `hidden`
    ports and other levels'. The DAW: `in` at B / I, a new `out` at A (its song; the hidden
    `playback` stays the USB way back — `usbLink.ts` deletes any playback wire it did not make, so
    Advanced needed a port of its own); its playback route sends on both. The Recorder: `out`
    (Monitor out) at A only — B / I unchanged (no reach.ts or Beginner-face change). Ports in the
    engine never depend on the level: only what is drawn.
  - **The card shows the path in use** (`shownRoute`, `signal/chain.ts`): the first route with a
    wire on its input, or, making its own sound, on an output; else the first. Its id keys that path
    (render, movement, live meters unchanged). The DAW at Advanced shows its song (`meterAt="out"`
    there), at I what it records — every old reading the same.
  - **Rules** (`nodeAcceptsWire(…, level?)`, `wireTakesCard(…, level)` — every caller passes the
    store's level; `cloneGroup` takes it too): an Encoder's output only into Stream / Broadcast; at
    Advanced Stream / Broadcast only from an Encoder; a DAW's output only into a Recorder; a Recorder's
    Monitor out into anything but an end point (`category: 'sink'` — so an Amplifier, an Encoder, a
    bus, a Gain, a Fader take it; my reading of "processing or routing"). A Recorder dropped onto a
    wire at Advanced goes in mid-chain (it has an output there).
  - **Decoder** (`decoder`, sources, after the Generator; lucide `FileMusic`): a stereo source,
    −18 dBFS (`levelDb`), music loop, noise 80 dB under (`NOISE_BELOW`), `DIGITAL_SOURCES`,
    `PASSIVE`; `InstrumentNode` draws it (a face, dBFS meter). Into a bus with analog channels:
    `domainMixedBus`, unchanged (tested).
  - **Encoder** (`encoder`, processing, after the DAC; lucide `FileArchive`; 320 × 259): `format`
    (`ENCODER_FORMATS` mp3 · aac · opus, `PARAM_CHOICES`), passes the level on; fed (and only when fed)
    an analog signal → `encoderNeedsDigital` (silent, `SILENCES`; its words a converter's line in
    capitals). `EncoderNode.tsx`: the three format buttons (`ChoiceButtons`), a few words on the chosen
    one (`nodes.encoder.goodFor`), "−18.0 dBFS → MP3" (what arrives, in its units). Named "Encoder" in
    English (the user's call, 2026-10-11: the plan said "Coder"), "Енкодер" in Bulgarian (with
    "Декодер", the user's call).
  - **Recorder Track** (Advanced): a line across its face, "Records → Monitor out" (`PortLine`,
    lit while sound passes), the icon under it. On a digital signal the usual dBFS strip; on an
    analog one **a needle face** (`components/VuMeter.tsx`), not a bar: a bar would need a second
    scale threaded through `dbToPercent`, the zones, the scale marks and the painters, while a
    needle is one component the live loop turns (`.lsc-vu-needle`, a `transform`, like the bars'
    covers). One dial in mono, L and R side by side in stereo, in the face (`FaceCard`
    `meterInFace`: the meter column's room is the face's, the card keeps its size); under each its
    loop average in VU (still). Scale −20 … +3 VU, 0 VU = +4 dBu (`VU_ZERO_DBU`), swing as the
    voltage (`vuSwing`: 0 VU at 71 %), red from 0; the needle reads the meters' 300 ms RMS (D10).
    Checked: a Keyboard at −10 dBu reads −14.0 VU, its needles moving −16 … −12; the Generator's
    noise at +4 dBu +0.0 VU, steady.
  - Wire colours needed nothing: the Encoder → Stream wire and the wires before it are black (D24's
    `record`), DAW → Recorder Track green.
  - Texts (en + bg): `palette.items` decoder / encoder, `theory.decoder`, `theory.encoder`, a sentence
    each added to `theory.recorder` (what + tip: the Track, the VU), `theory.daw` (what: Advanced),
    `theory.broadcast` (tip: only an Encoder at Advanced); `nodes.encoder.*`, `nodes.recorder.records` /
    `monitorOut`, `warnings.encoderNeedsDigital`.
  - Tests: `connectionRules.test.ts` (the digital picture's rules, a Recorder / Encoder dropped onto a
    wire), `engine.chains.test.ts` (Decoder → Gain → Encoder → Stream digital all the way; an Encoder fed
    analog, an Encoder unplugged, a Decoder with analog channels in a bus; a Recorder Track's domain
    and Monitor out; the DAW at Advanced), `levels.test.ts` (the VU's maths). No reading moved.
  - Checked in the pane (light / dark, en / bg): the six chains above; Intermediate unchanged (the
    Recorder has only its input, the DAW records through the Interface); the palette at Advanced.

## Stage 8 — Finish  ☐

- [ ] Walk all three levels headless: every palette item drops, wires and shows its help (one
  script, a screenshot per level's palette + one demo chain each).
- [ ] Help texts: re-read only the new `theory` keys in en + bg for The #1 Rule.
- [ ] README *What's New* (draft for the next release — don't tag), CLAUDE.md: the *Adding a new
  node* steps mention `levels` and per-output `routes`. Keep CLAUDE.md short.
- [ ] Full checks + commit. Report to the user: summary, choices to review, and their checklist
  (their fonts and devices, how the Beginner stage plan feels, the Look-inside wording in Bulgarian).


