# TODO — Levels as scales (Macro → Micro)

The user's plan (2026-10-10). Levels stop being "more palette items" and become **scales**:
- **Beginner** — the macro world: *devices*, not components. Connections only, no signal maths.
- **Intermediate** — the analogue channel strip of a small desk (Yamaha MG12XU as the model), with the
  Interface and DAW present only to record and play back.
- **Advanced** — micro scale: today's full chain plus ADC/DAC thinking, Decoder, Coder, a real Recorder.

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
| `interface` (new) | ✓ | ✓ rec/playback | ✓ | see Stage 4 / 7 |
| `daw` (new) | ✓ | ✓ rec/playback | ✓ | PC icon, dBFS meter |
| `amp` | ✓ icon | ✓ | ✓ | → passive speaker only |
| `phantom` (new, 48V) | — | ✓ | ✓ | bare on/off control |
| `gain`, `hpf`, `pad`, `eq` | — | ✓ | ✓ | EQ: 3 knobs, no graph at I |
| `comp` | — | ✓ one knob | ✓ full | |
| `noise-gate`, `limiter`, `deesser` | — | — | ✓ | hidden at Intermediate |
| `graphic-eq`, `adc`, `dac`, `matrix-bus` | — | — | ✓ | unchanged |
| `fader`, `switch`, `relay`, `pan`, `master-bus`, `aux-bus` | — | ✓ | ✓ | routing unchanged |
| `coder` (new) | — | — | ✓ | format buttons, out → Broadcast only |
| `active-speaker`, `headphones` | ✓ | ✓ | ✓ | |
| `speaker` (passive) | ✓ | ✓ | ✓ | silent without an amp before it |
| `studio-monitor` (new) | ✓ | ✓ | — | works like an active speaker |
| `stream-broadcast` (new) | ✓ | ✓ | ✓ | at A: fed only by a Coder |
| `recorder` (new) | ✓ | ✓ | ✓ full | A: Mono/Stereo, monitor out, VU or dBFS |

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
    monitor out, VU on analogue, dBFS on digital), Coder (encoding is more than A/D conversion) →
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

## Stage 1 — Separate the microphone from the source (engine core)  ☐

The biggest engine change. Read: `graph/queries.ts` (grep `SOUND_PORT`, `instrumentAt`, source
detection), `graph/connectionRules.ts`, `signal/process.ts` (sources, `soundOf`, `PEAKS_ABOVE`,
`NOISE_BELOW`), `audio/loops.ts`, `audio/chainAudio.ts` (sources only), `utils/chainFile.ts`
(`OLD_WORDS`), `test/chains.ts` helpers.

- [ ] New SPL sources `vocal` (param `character`: speech | singing), `drum-kit` (drums loop) and
  `acoustic` (guitar loop): output on `SOUND_PORT` (the dotted wire, as the Guitar Amp's), so a mic
  is the only thing that takes them (that rule exists). One source may feed several mics (a kit with
  three mics). Each has a dB SPL meter (D13 moves from the mic to the source).
- [ ] `mic` becomes a transducer: SPL in → dBu out, param `micType: 'dynamic' | 'condenser'`.
  **Calibrate so a Dynamic mic on a Vocal (speech / singing) or Drum Kit gives exactly today's
  Microphone readings**, so the locked tests keep their numbers; only their chain-building changes.
  Condenser: start at +12 dB more output and its own self-noise; measure, then write the help text.
  The mic is not a chain's source any more: the chain colour comes from the sound source. A mic with
  nothing on its Sound input says "Not connected" (D11).
- [ ] Mic card: a `FaceCard`, Dynamic | Condenser buttons, **no meter**.
- [ ] `line-in` → `keyboard` (TypeKey rename; `OLD_WORDS`): always stereo, no Mono/Stereo switch, no
  character buttons, keyboard icon, music loop, −10 dBu.
- [ ] New `pc`: stereo line source, 0 dBu, music loop, PC icon.
- [ ] `chainFile`: old files open sensibly. A `mic` with `character` becomes mic (dynamic) + a new
  `vocal` / `drum-kit` placed to its left and wired in. A mic already fed by a Guitar Amp gets no new
  source. Old `line-in` becomes `keyboard`. Extend `chainFile.test.ts` for both.
- [ ] Icons for the new sources in `icons.tsx` (simple line icons in the existing style).
- [ ] Locales: names + `theory` for vocal, drum-kit, acoustic, keyboard, pc, mic types.
- [ ] Checks + commit. *Hand-off:* …

## Stage 2 — The MG12-style channel strip (Intermediate)  ☐

Read: `components/nodes/PadNode.tsx` / `SwitchNode.tsx` (pattern for a bare control),
`components/nodes/conditions.tsx`, `signal/process.ts` (`StageCondition`, `SILENCES`),
`components/nodes/CompressorNode.tsx`, `DynamicsLayout.tsx` (grep only), `EQNode.tsx`.

- [ ] New `phantom` (48V): a bare on/off control like the Switch (`FreeControl`, `freeSize`), passes
  the signal unchanged, `PASSIVE`.
- [ ] Condition `no-phantom` on a **Condenser** mic: walk downstream from the mic through
  `passesThrough` cards up to and including the first Gain (Preamp). If no `phantom` there is On,
  the mic's output is silent (`SILENCES`). Its `FaceNote`: "No phantom power (48V) — a condenser mic
  needs it to work". Dynamic mics ignore 48V. Pure test in `queries.test.ts` / `engine.chains.test.ts`.
- [ ] Compressor at Intermediate: **one knob** (0–10) setting threshold, ratio and makeup together,
  as the MG12XU's one-knob COMP does. Look up the MG12XU spec sheet for the ranges and use those;
  if it isn't reachable, use threshold +22 → −8 dBu, ratio 1:1 → 4:1, makeup 0 → +7 dB, attack
  ~25 ms, release ~300 ms, and say so at stage end. Same `comp` type and processor: the knob writes
  the existing params (`initialParams` / a level-dependent face, like the EQ). Advanced keeps the
  full card.
- [ ] EQ at Intermediate: three knobs Low / Mid / High - as the current state - no change.
- [ ] Locales for 48V, the condition, the one-knob compressor.
- [ ] Browser check: Vocal → Condenser mic → 48V → Gain → HPF → EQ → Comp → Fader → Master → Active
  speaker, with 48V on and off.
- [ ] Checks + commit. *Hand-off:* …

## Stage 3 — New outputs, passive speaker and amp  ☐

Read: `SpeakerNode.tsx`, `ActiveSpeakerNode.tsx`, `AmpNode.tsx`, `connectionRules.ts`.

- [ ] `studio-monitor`: works like `active-speaker` (built-in amp, SPL meter), its own icon.
- [ ] `broadcast` (Stream / Broadcast): a sink, stereo, dBu meter at I. At Advanced it accepts only
  a `coder` (rule added in Stage 7).
- [ ] `recorder` (simple form, B/I): a sink with a level meter (dBu at I).
- [ ] `speaker` (passive) and `amp` now also at B and I. Rule: the `amp` output feeds **only**
  `speaker`, at every level (`nodeAcceptsWire`). The existing "passive speaker needs an amp" logic
  stays, and its note at B/I reads "No sound — a passive speaker needs an amplifier before it".
  Grep the tests for amp → non-speaker wires and fix them.
- [ ] Locales + icons.
- [ ] Checks + commit. *Hand-off:* …

## Stage 4 — Audio Interface and DAW: record & play back (Intermediate)  ☐

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
- [ ] Registry + routing + engine + render (`OTHERS`: reuse the ADC/DAC nodes' code), pure tests:
  record path level (0 dBu in → −18 dBFS at the DAW), playback path (−18 dBFS → 0 dBu out), no cycle.
- [ ] Cards, icons, locales.
- [ ] Browser check: Master L/R → Interface → DAW, and DAW → Interface → Studio Monitors.
- [ ] Checks + commit.
- [ ] ⛔ **ASK** — send the user the two screenshots and one line on how it behaves; wait for an OK
  before Stage 5. *Hand-off:* …

## Stage 5 — "Look inside" (Intermediate)  ☐

D22, explanation 2. Read: `ConfirmDialog.tsx` (portal pattern), `icons.tsx`.

- [ ] A small **Look inside** button (click, not hover — D19) on the Interface and DAW cards at
  Intermediate. It opens a read-only overlay (portal, Esc closes, `lsc-overlay`):
  - Interface: `Preamp → A/D converter → USB ⇄ computer → D/A converter → Line out`
  - DAW: `Input trim → HPF → EQ → Compressor → Fader → Mix bus → Master`, drawn with the
    **same icons** as the desk's cards, greyed, with a "digital" tag
  - One sentence: *"The same channel strip as your desk — but as numbers, inside the computer. You
    can build it yourself in Advanced."* (en + bg)
- [ ] Pure data for the two diagrams (an array of icon + locale key), one small component.
- [ ] Checks + commit. *Hand-off:* …

## Stage 6 — Beginner: the macro scale  ☐

D20. Read: `store/measuring.ts`, `hooks/useGraphSignal.ts`, `hooks/useFlowElements.ts` (edge colour),
`FaceCard.tsx`, `OverviewFace.tsx` (grep `overviewBare`), `NodeWrapper.tsx` (header only).

- [ ] **No engine at Beginner:** the store does not render or run the number engine below
  `DETAIL_LEVEL`. A new pure `graph/reach.ts`: which nodes a source reaches, and each output's verdict
  (*sound* / *no sound — not connected* / *no sound — needs an amplifier*). Wires at Beginner: one
  neutral colour with the flow animation when they lead to an output (no health colours). Tests for
  `reach.ts`.
- [ ] **Inputs are bare at every zoom** at Beginner: icon + name, no card, no meter (like
  `overviewBare` today). The mic shows no type buttons; the Vocal is a **human head**.
- [ ] `mixer`: Parametric-EQ size (410 × 361). Its input takes any number of wires. Outputs: Main and
  Monitor (also feeds Recorder, DAW, Interface). Zoomed out: only the word **MIXER**. Zoomed in: a
  drawing of a small desk (an SVG, original, in the app's line style — a few channel strips with
  knobs and faders) under the title, and a **decorative dBu meter** (a fixed "good" level when a
  source reaches it, empty otherwise — not measured).
- [ ] `stage-box`: icon; input takes any number of wires; one output (the snake) → `mixer` only.
- [ ] Beginner faces for `amp` (icon, no knob), `interface` (like the Mixer, different drawing),
  `daw` (PC icon, decorative dBFS meter). Same ports as at Intermediate. At Beginner, `daw` may also
  connect from/to `mixer`.
- [ ] Outputs at Beginner: icon + verdict note (`FaceNote`), no meters.
- [ ] Locales: Beginner names and `theory` for the new devices (macro wording: "what this box does in
  the room").
- [ ] Browser check: build the user's stage-plan picture — mics on drum kit and head, Keyboard →
  Stage Box → Mixer → Amp → Passive speakers, Mixer → Active wedges, PC → Mixer, Mixer → Interface ⇄
  DAW. Screenshot zoomed in and zoomed out.
- [ ] Checks + commit.
- [ ] ⛔ **ASK** — show the Mixer drawing and the whole stage plan; wait for the user's look-and-feel
  OK. *Hand-off:* …

## Stage 7 — Advanced: Decoder, Recorder, Coder → Broadcast  ☐

D23. Read: the domain logic (grep `domain`, `inDomain`, the mixed analogue/digital bus check),
`SignalMeter.tsx` (scales only).

- [ ] `decoder`: stereo source whose signal is **digital** from the start (dBFS), music loop. The
  existing rule "analogue and digital chains can't meet in one mix bus" applies to it unchanged.
- [ ] `recorder` at Advanced: a Mono | Stereo switch (`stereo: 'optional'`) on its input and a
  **Monitor out** (passes the signal on, for headphones or monitors). Meter: dBFS on a digital
  chain; on an analogue chain a **VU meter** (average-reading, ~300 ms, 0 VU = +4 dBu, scale −20 …
  +3 VU). A needle face, or the bar with a VU scale — pick the one that fits `SignalMeter`/`meterPaint`
  with less code, and say which at stage end.
- [ ] `coder`: a small card with format buttons (MP3 · AAC · Opus; param `format`, `PARAM_CHOICES`),
  passing the level on. Its only output → `broadcast` only. At Advanced, `broadcast` accepts only a
  `coder`. Fed an **analogue** signal, the Coder says "needs a digital signal — put an A/D converter
  before it" and is silent: the lesson that conversion alone isn't the whole picture.
- [ ] `interface` / `daw` at Advanced: the cards show their converters (ADC in, DAC out wording), and
  rule 5 is lifted for the digital side: `daw.out` may feed digital processing cards (EQ,
  Compressor … → DAC), showing that a DAW *is* a mixer. The analogue/digital bus rule still holds.
  Studio Monitor is hidden here (Stage 0 table).
- [ ] Tests: decoder domain, coder condition, recorder meter domain.
- [ ] Locales, icons, checks, commit. *Hand-off:* …

## Stage 8 — Finish  ☐

- [ ] Walk all three levels headless: every palette item drops, wires and shows its help (one
  script, a screenshot per level's palette + one demo chain each).
- [ ] Help texts: re-read only the new `theory` keys in en + bg for The #1 Rule.
- [ ] README *What's New* (draft for the next release — don't tag), CLAUDE.md: the *Adding a new
  node* steps mention `levels` and per-output `routes`. Keep CLAUDE.md short.
- [ ] Full checks + commit. Report to the user: summary, choices to review, and their checklist
  (their fonts and devices, how the Beginner stage plan feels, the Look-inside wording in Bulgarian).


