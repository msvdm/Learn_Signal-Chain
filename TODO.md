# TODO — code clean-up

From a full code-quality review on 2026-10-09. Work top to bottom: the steps are ordered so each one
makes the next smaller. Line numbers are as they were on 2026-10-09; they drift as steps land.

## Rules for every step

- Work on `master` (CLAUDE.md → *Working on this project*). **One commit per step.** Tick the step's box in
  this file in the same commit.
- Before each commit: `bun run lint`, `bun run build`, `bun test` (bun lives in `~/.bun/bin`).
- **Behaviour stays the same** unless the step says otherwise. The test tables lock today's levels: an engine
  step that changes a number in them is wrong, unless the step names that change. Then measure it and report it.
- Engine steps (5–8): also run CLAUDE.md's *A refactor that must change nothing* check (HEAD's `src`
  against the new one over many random graphs). Then compare a render on real sound (`measureChain`) for a
  channel strip and a stereo bus, before and after.
- UI steps (9–14): screenshot the cards before and after (light and dark, English and Bulgarian, each level).
  Every card keeps its size.
- Update CLAUDE.md where a step changes what it describes.
- After each **phase**, stop and report to the user:
  - what was done;
  - the numbers measured;
  - the choices made (to review);
  - what only they can check.
- Push only when the user says so.

## Decisions already made (2026-10-09, the user)

1. A card fed a digital signal it can't take (Amplifier, Speaker, Active Speaker, Headphones, Guitar Amp)
   shows **a simple red label on the card** that says what is wrong.
2. **CLAUDE.md gets trimmed**: "it has become a whole novel". Keep the rules, cut the descriptions.
3. **Tailwind gets removed** (step 14). That changes `bun.lock`, which the user has approved.

## Not doing

- One generic engine for both the numbers and Web Audio. The two walks really differ: the numbers put each
  reading through the curve separately, use a linked detector, and the render adds clippers only near the
  ceiling. Step 7 removes the duplicated *knowledge*, which is the part that drifts.
- `snrOf`, `headroomOf`, `crestOf` and `hissOf` are used only by the tests. That's fine: they name what the
  tests check.

---

## Phase A — hygiene

- [x] **1. Stale comments and leftovers**
  - Comments that are no longer true:
    - `src/data/nodeRegistry.ts:217` (Compressor: "Attack / Release … do not change the sound yet") and
      `:223` (Noise Gate: "Hold / Attack / Release are shown, not simulated"). `audio/processors.ts`
      simulates them.
    - `:98` ("Phase 2+ rendering").
    - `src/utils/layoutHelpers.ts:49` (the "landscape" rule, gone with D10).
    - `src/signal/moving.ts:10` (points at `components/meters/live.ts`; it's `hooks/useLiveMeter.ts`).
  - `READINGS` in `src/signal/levels.ts` is unused. Make `Reading` simply `keyof SideLevels`.
  - Remove unused locale keys from **both** `en.json` and `bg.json`. Candidates: `banner.gainStaging`,
    `tooltip.help`, `tooltip.next`, `nodes.comp.gainReduction`, `nodes.preamp.gain`.
    - Verify each one first, and look for others with a small script. Components alias parts of `t`
      (`const tg = t.nodes['noise-gate']`) and some keys are read dynamically (`t.theory[key]`,
      `t.health[h]`, `t.palette.items[k]`, `t.warnings`), so a plain grep lies.
    - Mind the one-line `levelNames.intermediate` (CLAUDE.md → *Editing the locales by script*).
  - `raiseLevel` in `src/store/signalStore.ts:311` re-implements `atLeast` (`data/levels.ts`). Use it.
  - Rename `soundOf` in `src/store/measuring.ts:17`, e.g. to `soundFingerprint`. It's a JSON fingerprint
    of the chain and clashes with `soundOf` in `signal/process.ts`, which means something else.

- [x] **2. Layers: lower layers never import the store; graph logic lives in `graph/`**
  - `src/utils/connectionRules.ts:5` imports the type `WireSource` from the store. Move `WireSource` to
    `graph/` (the store imports it from there).
  - `src/utils/layoutHelpers.ts:1` imports `SignalEdge` from the store. Import it from `data/nodeRegistry`.
  - Move these files from `utils/` to `graph/`:
    - `utils/mainFader.ts` (and its test);
    - `utils/connectionRules.ts`;
    - `utils/chainColors.ts` (`graph/edits.ts` imports it, so graph currently depends on utils).
  - They are pure graph queries and edits. Update the imports and CLAUDE.md's file table.

## Phase B — documentation and tests first (smaller files for the engine work)

- [x] **3. Trim CLAUDE.md** (135 KB today; aim for about a fifth)
  - First write `docs/decisions.md` holding D1–D19 **in full**, word for word. The code cites them by
    number, so the full text must stay findable.
  - CLAUDE.md keeps:
    - the #1 rule;
    - Commands;
    - *Working on this project* (workflow, environment, *Checking in the browser*), lightly tightened;
    - the architecture: layers, the data-flow diagram, *Redraw only what changed*;
    - one line per key file;
    - the level table and the health-zone table;
    - the interaction model, condensed;
    - the decisions, one line each, pointing to `docs/decisions.md`.
  - Remove:
    - per-file detail the file's own header comment already says;
    - the exact numbers the tests and code comments already lock;
    - the 2,000-character *Tests* paragraph. Replace it with a short list: one line per test file.
  - Nothing the user instructed may be lost. Diff the rules section before and after.

- [x] **4. Split `src/signal/engine.test.ts`** (1,149 lines: over the 1,000 limit)
  - Move the shared helpers (`card`, `wire`, `expectCards`, `expectReadings`, `expectMarksLeave`, … — the
    first ~140 lines and those near lines 689, 1019 and 1029) to `test/chains.ts`.
    `tsconfig.test.json` includes `test/`; the app build leaves it out.
  - Then make three files:
    - `engine.chains.test.ts`: the reference chains, levels at every card;
    - `engine.readings.test.ts`: gain staging, peaks, noise, the hum;
    - `engine.curve.test.ts`: the marks on a dynamics card's curve.
  - The test count and every expectation stay identical. Check `npm run test:node` still finds them.

## Phase C — the engine: one source of truth per card

- [x] **5. Wire keys: built in one place, never parsed**
  - `` `${nodeId}:${portId}` `` is built in 9 places and split back with `lastIndexOf(':')` in 4:
    - `signal/engine.ts:132`;
    - `signal/measured.ts:87`;
    - `audio/measure.ts:96`;
    - `audio/chainAudio.ts:99`.
  - Add one `outputKey(nodeId, portId)` (in `graph/graph.ts`) and use it everywhere it's built (chain.ts,
    useFlowElements, NodePort ×3, UnplugMenu, CanvasOverlays, DIBoxNode, useGraphSignal's doc).
  - `CardPlan.used` items become `{ key, nodeId, sendDb }`, so engine.ts, measure.ts and chainAudio.ts stop
    parsing. Where a key must still be taken apart (`withMeasured`'s wires), use one `nodeOfOutput()` beside
    `outputKey`.
  - Rename `CardPlan.from` (card ids). It clashes with `used[].from` (wire keys), e.g. `sources`.
  - Add `CardPlan.domainFrom: string[]`: the Relay's selected input's card, for any other card every card
    plugged in. Then `runChain` (`chain.ts:242-246`) loses its Relay special case and `drivingFrom` goes.

- [x] **6. Dynamics: an honest flag; `curveIn` / `curveOut` become derived**
  - The registry's `linked: true` is used to mean "a dynamics card" in `engine.ts:171`, `measure.ts:79`,
    `measure.ts:263` and `chainAudio.ts:98`. Replace it with `dynamics: true` (all four dynamics cards are
    linked in stereo, nothing else is) and an `isDynamics(typeKey)` helper. `chain.ts:154`'s linked mode
    reads it too.
  - Gather what each dynamics type knows into one table, e.g. `audio/dynamics.ts`, keyed by
    `DynamicsSettings['type']`:
    - `settingsOf` (`chainAudio.ts:410`);
    - `settleOf` (`measure.ts:77`);
    - `makeupOf` (`measure.ts:157`).
  - **`curveIn` is a leftover.** Since D18, only a Gain adds input noise (`ownNoiseOf`), so `withInputNoise`
    does nothing to a dynamics card. That makes `curveIn` = louder side of `in`, and `curveOut` = louder
    side of `out`.
    - Remove `StageResult.curveIn` / `curveOut`, `MeasuredStage.curveIn` and `curveInputOf`.
    - Remove the `withInputNoise` calls in `chain.ts`'s linked branch (`detector`, `own`), in
      `engine.ts:182` and in `measure.ts:269`.
    - Remove `withMeasured`'s separate move-on of `curveIn`, and the `contextOf` export.
  - Then:
    - Compressor, Noise Gate and Limiter pass `louder(in)` / `louder(out)` to `TransferCurve`. When
      bypassed, `leaving` is undefined: through the curve, as today.
    - `liveStageOf` (`moving.ts`) decides on `moving.curveIn` / `curveOut` and shifts from the louder sides.
  - Update the tests that read `curveIn` (28 lines) to the derived values. The numbers stay the same,
    with one possible exception: stereo linked dynamics whose two sides differ. There the "in" mark used
    to be moved on as one value and is now the louder of two moved sides, so it may move by a hair.
    Measure it and report it.

- [x] **7. One table of card gains** (the biggest duplication)
  - `PROCESS` (`signal/process.ts:364`) and `processed()` (`audio/chainAudio.ts:322`) each describe every
    card. These rules are written in both:
    - the Gain's preamp / `GAIN_OFF_DB` logic;
    - the Amp's "only turns down; channel B follows A until turned";
    - the Graphic EQ's "right sliders follow the left";
    - the Pad's bare `-20` (`process.ts:414`, `chainAudio`);
    - fader, buses, speakers, converters, Guitar Amp, DI Box.
  - The Amp and Graphic EQ rules are copied a third time in `AmpNode.tsx:26,31` and
    `GraphicEQNode.tsx:35,59`.
  - Add one module (e.g. `signal/gains.ts`) with:
    - `gainDbOf(node, { preamp, side })`: dB (−∞ = off) for every card whose job is a gain, undefined for
      the rest (sources, filters, dynamics, Pan);
    - `PAD_DB`;
    - `ampVolumeDb(node, side)` and `geqBandDb(node, side, i)` for the follow-the-other-side rules.
  - `PROCESS`, `processed()` and the two cards all read from it. `processed()` must handle every type:
    an exhaustive switch or a `Record<TypeKey, …>`, so a new type fails to compile instead of
    `default: return x` (`chainAudio.ts:372`) passing it on silently. Drop the matching caveat in
    CLAUDE.md → *Adding a new node*.
  - In `processed()`, a gain card is one gain node when both sides agree, a gain per side otherwise.
  - Add `isGeneratorSound(kind)` (beside `GENERATOR_SOUNDS`) for the three
    `kind === 'sine' || … 'click'` checks (`chainAudio.ts:108`, `:309`, `measure.ts:65`).
  - Type `SILENCED` (`chainAudio.ts:68`) as `Set<StageCondition>`, or better, say in `process.ts` beside
    `StageCondition` which conditions silence a card.

- [ ] **8. One generic "sided" signal**
  - Add `Sided<T> = { kind: WireKind; l: T; r: T }`. Then `WireSignal = Sided<SideLevels>` and
    `MovingSlices = Sided<ChannelSlices>`.
  - Write one generic `onPort` and one generic `asKind`. They replace `onPort` (`chain.ts:58`) and
    `asKind` / `slicesAsKind` / `slicesOnPort` (`measure.ts:150`, `:174`, `:181`). `chainAudio`'s
    `onPort` works on audio nodes and stays.
  - If `runChain`'s if / else over `card.mode` is still long, make it a `Record<CardMode, …>`.

## Phase D — the cards

- [ ] **9. Conditions in one place, and the missing red labels** (decision 1)
  - The engine silences cards fed a digital signal (`digitalToAmp`: the Amplifier; `digitalToSpeaker`:
    Speaker, Active Speaker, Headphones, Guitar Amp), but **no card says so**. The texts already exist
    (`warnings.digitalToAmp`, `warnings.digitalToSpeaker`).
  - Today each card checks its own condition in its own way, in 5 files:
    - SpeakerNode (`needsAmp`);
    - ActiveSpeakerNode (`blown`);
    - MicNode (`needsDi`);
    - MasterBusNode (`domainMixedBus`);
    - AdcDacNode (the ADC / DAC ones).
  - Make one table from each `StageCondition` to its text and look.
  - New: a simple red label on the card for `digitalToAmp` / `digitalToSpeaker`. The existing ones keep
    their look but take their text from the table.
  - Check the wording against the #1 rule (say what a DAC is), in both languages. The label must fit
    without resizing the card, in Bulgarian too.

- [ ] **10. `ParamKnob`**
  - There are 29 hand-written `value={p('x')}` / `onChange={(v) => updateNodeParams(id, { x: v })}` pairs
    in 17 cards.
  - Add `components/controls/ParamKnob.tsx`, taking `nodeId`, `typeKey`, `param` and KnobControl's display
    props. It reads `useParams` and writes `updateNodeParams`.
  - Keep the special writers as they are: the Amp's first turn of A writing B, the Gain's preamp / gain
    mode.
  - Add a shared Attack / Release block for the Compressor and Noise Gate (their ranges differ: pass them in).

- [ ] **11. Split `MicNode`**
  - `components/nodes/MicNode.tsx` draws the Microphone, Line Input and Instrument, with 7 type checks.
  - Make `MicNode`, `LineInNode` and `InstrumentNode`, sharing the face art (with the needs-DI note) and
    `CharacterButtons`.
  - Update `NODE_COMPONENTS`.

- [ ] **12. Split `NodeWrapper`**
  - It switches modes through five flags (`faceOnly`, `ownFace`, `overviewBare`, `overviewLevel`,
    `overviewArt`).
  - Make a shared frame: border, selection ring, chain stripe, ports, edge tags, wire-target badge, the
    overview layer.
  - On top of it, a full card (header, Mono | Stereo, body) and a face card (face + its meter). Fewer flags.
  - No pixel may change: screenshots.

- [ ] **13. Stable selectors without text round-trips; smaller hooks**
  - `getPorts` (`graph/queries.ts:98`) makes a new array only for the Matrix-send case. Keep that variant
    per base array (a WeakMap), so the same layout is always the same arrays. Then:
    - `useNodeChrome` reads `useShallow((s) => getPorts(…))`, and `portText` / `toPorts` go;
    - `useFlowElements`' `portLayoutKey` compares the outputs array itself.
  - `OverviewFace.tsx:79` packs its size into `"WxH"` and splits it. Use React Flow's `useStore(selector,
    shallow)` instead.
  - Move the layout maths in its `useMemo` into a pure `overviewLayout()` function, with a test.
  - `useStereoLevels`: drop `in`, `inR`, `out`, `outR` and `inHealth`. Only `AdcDacNode.tsx:64-66` reads
    the first four; give it `input` / `output`.

## Phase E — Tailwind (decision 3)

- [ ] **14. Remove Tailwind**
  - Where it is:
    - `@import "tailwindcss";` in `src/index.css:1`;
    - `tailwindcss()` in `vite.config.ts`;
    - `tailwindcss` and `@tailwindcss/vite` in `package.json`.
  - It gives:
    - about 25 different utility classes, used about 40 times (find them all, e.g. `grep -rhoE
      'className=("[^"]*"|\{`[^`]*`\})' src`);
    - its reset ("preflight").
  - It adds ~9.5 KB to the 41 KB stylesheet.
  1. **Keep the cascade.** Copy Tailwind v4's preflight (`node_modules/tailwindcss/preflight.css`, keep its
     MIT notice) into `index.css` **inside `@layer base { … }`**, as it is now. Unlayered rules (the app's,
     React Flow's) must keep beating it.
     - Replace its theme variables (`--default-font-family` …) with the app's.
     - Then trim only the rules the app clearly doesn't need. Leave `* { border: 0 solid }` and
       `svg { display: block }` unless screenshots show they're unused: the inline borders and icons may
       rely on them.
  2. **Replace each utility class.** Use the app's own CSS classes or inline styles, matching what the
     class did.
     - Utilities lived in `@layer utilities`, *under* unlayered CSS. Where `index.css` also styles that
       element, check which wins after the change.
     - The `text-[var(--node-text-sm)]`-style classes become `fontSize: 'var(--node-text-sm)'`.
  3. Run `bun remove tailwindcss @tailwindcss/vite` (it rewrites `bun.lock`, which goes in the same
     commit: CI installs with `--frozen-lockfile`).
  4. Check the result:
     - Screenshot every card, the header, the palette, the menus and the dialogs, before and after (light
       and dark, English and Bulgarian), and compare.
     - Check `bun run preview`: the one-file copy still builds and runs.
  - Update CLAUDE.md (Architecture, Commands if needed).

- [ ] **15. Done**: delete this file, and make sure CLAUDE.md describes the final code.
