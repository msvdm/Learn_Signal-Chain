# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The #1 Rule

**This app is for beginners in sound engineering.** Every label, tooltip, warning message, and UI element must be understandable by someone who has never touched a mixing desk. Avoid jargon without explanation. Prefer plain English over technical accuracy when both are possible. If a concept needs a number (e.g. dB), always follow it with a plain-language consequence ("−60 dBu — very weak, too quiet to use").

## Commands

```bash
bun dev          # Start local dev server at localhost:5173
bun run build    # Type-check + production build → dist/
bun run lint     # ESLint check
bun run preview  # Preview the production build locally
```

No test suite exists yet. Manual browser testing is the current approach.

## Architecture

The app is a **pure client-side React SPA** — no backend, no API calls. All signal processing is arithmetic on numbers in the browser.

### Interaction model (SmartDraw-style)

The canvas works like a drawing app and **follows the mouse** — there is no mode toolbar and no mode keys:
1. **Left palette** (`ElementPalette`) — search, category tabs, 2-column tiles (an icon rail at tablet width ≤ 1024px). Drag any tile onto the canvas; the node lands where it is dropped (cursor on its port line), nudged only to avoid overlapping another node. Dropping a node with an input and an output onto an existing wire inserts it mid-chain (the drop preview snaps to that slot): once the new card is measured, the rest of that chain slides right — other chains stay put — and if the card is tall, everything under it (cards, and wires running there) moves down as one block.
2. **Select mode** (`toolMode: 'select'`, the default) — drag nodes, pan the canvas, click a card to select it.
3. **Connect mode** (`toolMode: 'connect'`) — entered automatically when the cursor is over a port; it switches back to Select ~200ms after the cursor leaves all ports, never while a wire is being drawn and never while a mouse button is held. Wiring uses a **click-once pen-tool interaction, never drag**:
   - **Click once** on an output port → wire begins; a "Connecting from …" toast appears and valid free inputs pulse
   - **Move freely** → a dashed orthogonal (right-angle-only, rounded corners) preview routes live to the cursor
   - **Click in empty space** → commits a corner waypoint, locking that segment; routing continues from the waypoint
   - **Click a highlighted input** → completes the connection (a snap ring appears on hover to confirm the landing point)
   - **Right-click or Esc** → cancels the wire in progress
4. **Delete a connection** — hover a connected **input** port → the port itself turns into a red × (whenever no wire is being drawn) → click it. Outputs never turn into ×: clicking an output always starts a new wire, so one signal can feed several inputs.
5. **Reshape a wire** (Intermediate / Advanced) — wires with bends show drag handles on their corners and segment midpoints, in either mode.
6. **Esc** cancels a wire in progress, otherwise closes the help popover.
7. **Zoom** — mouse wheel / trackpad, or the React Flow `<Controls>` (zoom in / out / fit) at the bottom-left of the canvas.
8. **Overview** — zoomed out below 42% (back above 50%: hysteresis, `OVERVIEW_ENTER_ZOOM` / `OVERVIEW_LEAVE_ZOOM` in `SignalChain.tsx`), every card swaps its controls for its name (sources and speakers: a big icon), as big as it fits, and the level leaving it (see Node card shell). Free-standing controls stay as they are. Wires are drawn thicker. Wiring, dragging and unplugging work as usual.
9. **Right-click menu** (`NodeMenu`) on any element: What is this? (help popover) · Bypass / Turn back on (types that can be bypassed) · Remove. There are no ? or × buttons on the elements; a tip at the bottom of the palette points to the menu. A right-click while a wire is drawn only cancels the wire (the capture-phase handler stops the event).

Every level starts from a **blank canvas** at 100% zoom (also after Reset, a level change or removing the last node). There is no preset layout, no fixed Master Bus and no position restrictions. Levels control which node types appear in the palette, not the graph structure.

### Header

Palette toggle (collapses the left palette to zero width, like a sidebar; persisted) · brand · level stepper (Beginner / Intermediate / Advanced, with an in-app `ConfirmDialog` before clearing the canvas) · **Snap to grid** switch (on = snap to `GRID` + dotted background; off = free placement, no dots; text label hidden below 1200px so the header fits) · Light / Dark · language menu · Reset.

### Data flow (read this first)

```
signalStore (Zustand)
  └── nodes[] + edges[]  (graph model — user-built, freely positioned)
        └── useGraphSignal() hook  (topological sort → BFS traversal)
              └── computes dB at each node, keyed by node id
                    └── every node component reads its own stage result and renders accordingly
```

Every slider change → updates `signalStore` → `useGraphSignal` recomputes → all meters/colors/edges update simultaneously. There is no local component state for signal values.

### Key files and their single responsibility

| File | What it owns |
|---|---|
| `src/store/signalStore.ts` | All mutable state: graph nodes/edges, complexity level, language, `theme`, `snapToGrid` and `paletteOpen` (all persisted), `overview` (zoomed out — set only by `SignalChain` from the zoom, not persisted; cards read this flag, never the zoom), `toolMode`, `selectedNodeId`, `wireSource` (lets cards highlight valid inputs while a wire is drawn), active help popover, `highlightEdgeIds` (chains lit up from the unplug list or a Matrix Bus row), all graph mutations incl. `setNodeStereo` and `replaceEdge` (a card dropped onto a wire, in one step) |
| `src/hooks/useSignalChain.ts` | `useGraphSignal()` — pure BFS signal math over the graph, shared by all callers (computed once). No side effects. |
| `src/hooks/useStereoLevels.ts` | `useStereoLevels(id)` — a card's input / output levels for its meters: one value each in mono, L + R when a stereo wire comes in / goes out (`stage.stereoIn` / `stereoOut`), plus `inPeak` (louder input side). |
| `src/hooks/useGainStaging.ts` | `getHealthStyle(health)` — maps `SignalHealth` → CSS color, label, background; `formatDb()` — a level reading, real down to −99.9 dBu (a microphone sits at −60), `-∞` below. No logic. |
| `src/hooks/useEdgeReshape.ts` | `useEdgeReshape()` — waypoint drag state machine (mousemove/mouseup). Returns `{ reshaping, setReshaping }`. |
| `src/hooks/useLatestRef.ts` | `useLatestRef(value)` — a ref holding the latest committed value, for document/window listeners. Synced in a layout effect: never assign `ref.current` during render (react-hooks lint). |
| `src/hooks/useChainEmpty.ts` | `useChainEmpty()` — true when no node is on the canvas (drives the palette's "Start here" badge and the camera reset). |
| `src/hooks/useMediaQuery.ts` | `useMediaQuery()`, `TABLET_QUERY` (≤ 1024px: palette icon rail, no tagline), `WIDE_HEADER_QUERY` (≥ 1200px: all header labels fit). |
| `src/utils/layoutHelpers.ts` | All pure canvas placement math: `nodeDims` / `recordMeasuredSize` (cards size to content; the last measured size per type is reused for drop previews, a type never measured counts as its `FREE_CONTROL_SIZE` or `cardMinSize()`), `cardMinSize()` (280 × 210, buses 398 × 298), `resolveOverlap`, `enforceGap` (room for a new wire), `makeRoomForInsert` (room for a card dropped onto a wire), `findEdgeAtPoint`, `canInsertMidChain`. Also exports `GRID`, `MIN_NODE_GAP`, `HEADER_H`, `PORT_TOP`, `PORT_GAP`, `CARD_MIN_W` / `CARD_MIN_H` (280 × 210), `HIT_THRESHOLD` and the `Pt` type. |
| `src/utils/fitText.ts` | `fitText()` — the largest font size at which a text fits a box, on one line or two (broken at a space), measured on a cached canvas; `textWidth()`, `cssVar()`. Used by the overview face. |
| `src/utils/twoColumns.ts` | `twoColumns` (two 170px columns: In meter \| Out meter, then controls \| graph) and `twoColumnCard` (min height so a 398px card is never wider than 3:2). |
| `src/utils/connectionRules.ts` | `nodeAcceptsWire()` / `portAcceptsWire()` — which inputs may take a wire (one wire per input; Master / Aux / Matrix bus inputs take any number; a Matrix Bus takes finished mixes only, after their fader — `isMatrixSource`; a Matrix send feeds only Matrix Buses). |
| `src/utils/chainColors.ts` | Chain colours (one per source, picked on `addNode`), `upstreamOf` / `chainOfEdge` / `chainColorsOf` / `chainSourcesOfEdge` for the card stripe, unplug list and highlight. |
| `src/utils/faderTaper.ts` | `faderPosition()` / `faderDbAt()` — a desk fader's uneven dB scale (points along the travel, straight lines between, rounded to 0.5 / 1 / 2 dB) and `FADER_MARKS` (numbered marks + short ticks). |
| `src/utils/wirePath.ts` | `buildWirePath()` — orthogonal route with rounded corners, shared by the live preview and committed edges. |
| `src/utils/wireValidation.ts` | `wirePassesThroughNode()` — orange warning when a wire crosses another card. |
| `src/utils/mainFader.ts` | Main Fader and Matrix send wiring rules: `attachMainFaders()` (a Fader on a stereo bus's L / R takes them over, with the Matrix send; L / R into a Matrix Bus becomes the Matrix send), `reconcileMainFaders()` (hand L / R and the send back when the Main Fader is unplugged or deleted). Used by every store graph mutation. |
| `src/utils/nodeName.ts` | `nodeName()` — a node's display name (unplug list, Matrix Bus send rows); `sideLetter()` — 'L' / 'R' for a wire carrying one side. |
| `src/utils/chainOrder.ts` | `chainOrder()` — nodes in signal-flow order, for the help popover's Previous / Next. |
| `src/data/nodeRegistry.ts` | `NODE_REGISTRY` — single source of truth for every node type: port definitions, categories, default params, mono / stereo support. `canBypass()` (which types get On / Off). `getPorts(node, { nodes, edges })` gives a node's ports (a stereo Aux splits into L / R; a bus with a Main Fader shows one `mix` output; a Main Fader shows L / R; a `send` output below R while a Matrix send uses it — read from the wires, so pass the graph); `mixBusOf()` finds a Main Fader's bus; also `isNodeStereo` (the node's own Mono / Stereo setting), `portSide`, `helpKeyOf(node, stage)`, `MULTI_WIRE_TYPES`, `MATRIX_PORT`, `isMatrixSource()` (may this output feed a Matrix Bus), `sourceBusOf()` (the Master / Aux Bus whose mix leaves a card), `matrixSendKey()` / `matrixSendParam()` (one Matrix Bus send knob per bus). |
| `src/data/levels.ts` | `buildDefaultGraph()` — always returns an empty graph (blank canvas). `BusType` type lives here. |
| `src/i18n/locales/en.json`, `bg.json` | All UI text and help-popover educational content (`theory` key). Edit copy here; add every new key to both files. |
| `src/i18n/translations.ts` | The `Translations` type (add new keys here too), `fmt()` for `{placeholder}` strings and `withLevelNames()` (names that change with the level). |
| `src/App.tsx` | Header (see above) and the `ConfirmDialog` for Reset / level change. |
| `src/components/SignalChain.tsx` | React Flow canvas. Owns `nodeTypes` map, `WireDrawing` state machine, the mouse-follow mode switch, drag-drop handlers, `onNodeDrag/Stop`, edge color, zoom `<Controls>`, and the SVG overlays (reshape handles, wire preview, ghost preview). |
| `src/components/ElementPalette.tsx` | Left sidebar: search, tabs, draggable tiles. Level-gated visibility via `PALETTE_BY_LEVEL`. |
| `src/components/ChainEdge.tsx` | Custom edge: orthogonal path through waypoints (no level badge — levels are shown on the cards). A stereo wire is drawn as a twin line (a canvas-coloured stroke down the middle). The twin line and the dashes scale with the stroke width (thicker in overview). Wires into a Matrix Bus are drawn in `--lsc-matrix-send` instead of their health colour. |
| `src/components/Tooltip.tsx` | `HelpPopover` — anchored under the element whose help was opened (right-click → What is this?), Previous / Next in signal order. |
| `src/components/NodeMenu.tsx` | Right-click menu of an element: help, bypass, remove. Portal to `document.body`; closes on outside click, Esc, wheel, resize; arrow keys move between items. |
| `src/components/ConnectingToast.tsx` | Bottom-centre "Connecting from …" status while a wire is drawn. |
| `src/components/UnplugMenu.tsx` | List of the wires on a bus input that holds several: hover = light up that chain, × = unplug one wire. Portal to `document.body`. |
| `src/components/ConfirmDialog.tsx` | In-app `window.confirm` replacement, rendered with `createPortal` to `document.body`. |
| `src/components/nodes/NodeWrapper.tsx` | The single card shell every node uses (see below). |
| `src/components/nodes/OverviewFace.tsx` | The card's overview face (zoomed out): fitted name + output level meter, reading and health word. A layer over the hidden controls. |
| `src/components/nodes/DynamicsLayout.tsx` | `KnobStack` and `ReductionReadout` ("Turning down −4.5 dB" bar) for the two-column dynamics cards (Compressor, Limiter, Noise Gate, De-esser). |
| `src/components/nodes/NodePort.tsx` | One input / output port: health-coloured ring, valid-target pulse, a connected input turns into × on hover (click = unplug; 2+ wires open `UnplugMenu`), L / R letter on an output whose wire carries one side, "L+R" on a Matrix send. `BusInputPorts` for the audio interface's dynamic inputs. |
| `src/components/nodes/FreeControl.tsx` | Shell of the free-standing controls (Gain, Pan, Fader, Switch — see below): ports, name + reading under the control, chain stripe, dashed outline on hover / selection. |
| `src/components/nodes/InlineNode.tsx` | Thin wrapper over `NodeWrapper` for single-control nodes (centres one big reading / control). |
| `src/components/nodes/ControlSlider.tsx` | `ControlSlider` primitive used by card nodes. |
| `src/components/controls/KnobControl.tsx` | Rotary knob (drag up / down). `layout="side"` puts the value and label beside the knob (label may wrap to two lines) instead of under it; strokes grow with a big knob. |
| `src/components/controls/StableText.tsx` | `StableText` — a reading that keeps the width of its widest value. Helpers `LEVEL_SAMPLE` / `widestFormat()` live in `src/utils/readout.ts`. |
| `src/components/controls/EQGraph.tsx` | Interactive EQ curve drawn at exact pixel size (never stretched): drag a band dot, double-click = 0 dB, scroll = width (Q). Response math in `controls/eqMath.ts`. |

### Node card shell

Every card uses `NodeWrapper` (the free-standing controls below use `FreeControl`):
- **Face-only cards** (`faceOnly`): Microphone, Instrument, Speaker and Active Speaker show only their face — a big icon and the level they send out / play — at every zoom, with no header or body; the name shows on hover. The Active Speaker keeps its Volume knob beside the icon. A passive Speaker with no Amplifier before it is silent (`stage.needsAmp`): crossed-out icon and a note. Line Input keeps a full card (it has the Mono / Stereo switch).
- **At least 280 × 210** (`cardMinSize()` in `layoutHelpers.ts`; the mixing buses at least 398 × 298, the Compressor's size, so their long names stay big in overview) and **landscape**: never taller than wide (aim 4:3, anything 1:1 to about 3:2). The only exception is height from stacked ports or per-wire rows (Audio Interface, Matrix Bus sends). Small cards centre their content. A card whose content would come out portrait is rearranged into two columns (`utils/twoColumns.ts`: In meter | Out meter on top, knobs (`KnobControl layout="side"`) | graph below) — Compressor (the reference, 398 × 298 in English), Limiter, Noise Gate, De-esser, DI Box, Active Speaker, Intermediate Equalizer.
- **Width follows content** above that minimum, text wraps to fit.
- A fixed **56px header** (icon, title, On/Off) keeps the first port line at `PORT_TOP` (80px — just below the header's divider, clear of the header buttons) on every card, so wires between cards stay straight; stacked ports are `PORT_GAP` (36px) apart. Port rings are 28px (40px while showing the unplug ×) so they are easy to see and hit.
- The header row is **icon · title · On/Off (bypass)**; Help and Remove are in the right-click menu. Types for which `canBypass()` (`nodeRegistry.ts`) is false (sources, outputs, faders, switches, `master-bus` …) have no On/Off — the control itself is the state. Every node, including Master Bus, can be removed.
- **A card never changes size while values change** (no flicker). Wrap every changing reading in `StableText` (`components/controls/StableText.tsx`), which reserves the width of the widest value it can show: `LEVEL_SAMPLE` for signal levels, `widestFormat()` for a control's readout (both in `utils/readout.ts`). `KnobControl`, `VerticalFader`, `ControlSlider` and `SignalMeter` already do this. Text that only sometimes shows keeps its space (`visibility: hidden`) instead of being removed. The "Bypassed" tag sits on the header's bottom line, outside the layout. Wide cards (Parametric EQ) use a fixed body width.
- Controls and In/Out meters stay on the cards; there is **no status chip**.
- Only types with `stereo: 'optional'` (Line In, Aux Bus) get a **Mono | Stereo** switch under the header (not dimmed by bypass). Meters take `dbR` to show L / R bars.
- A thin **chain-colour stripe** on the card's top edge shows which sources (chains) pass through it.
- **Overview** (`overview` in the store, zoomed out): the header, Mono / Stereo switch and body stay mounted with `visibility: hidden`, so the card keeps **exactly** the same size and its ports stay put; `OverviewFace` is drawn over them (`inset: 0`, `pointer-events: none`, under the port rings). It shows the header's label (dynamic names included) fitted by `fitText` (weight 600, up to 96px — HPF up to 70px, capitals look bigger: `NAME_MAX_BY_TYPE` — a second line only if that makes it bigger), or the card's `overviewArt` instead (sources and speakers: their icon, `OverviewIcon`), and at the bottom the level **leaving** the card (louder of L / R; a speaker shows the level it plays — silent without an amp): a meter, the reading (`formatDb`) and the health word in `--signal-*-text` (darker shades in the light theme, ≥ 4.5:1). Sizes follow the card width; the health word has one size per language (the longest word fits), so a health change never moves anything. Bypassed: the face at 50% with the "Bypassed" tag. Crossfade 120ms (`.lsc-fade`), none under `prefers-reduced-motion`.

### Free-standing controls

**Gain (Preamp), Pan (Balance), Fader (Main Fader) and Switch are not cards**: each is the bare control with its connection points (`FreeControl`) — a 110px knob, a 440px fader (`VerticalFader scale={2.4}`, −100…+10 dB on a desk-style uneven scale: `utils/faderTaper.ts`) with a solid desk-style cap (`FaderCap`: black, red on the Main Fader; its white line marks the value) and a desk-style print: numbers on the left, a tick each side of the track (the cap slides over them), a dotted high-resolution zone around unity (+5…−5 dB, one dot row per 0.5 dB, in two columns beside the cap so it is never hidden) and half-way ticks below (`FADER_MARKS`), a 110px square On / Off button with rounded corners. Large, and the same at every zoom (no overview face). Under the control: its name (follows the wiring, wraps at 200px) and its reading (`StableText`). Pan has a slim L / R meter under it, the Main Fader upright L / R meters beside it (`VerticalMeterPair`). The control sits so that its port line is at `PORT_TOP`, level with the cards' first port, so wires stay straight. Grab the name or the space around the control to move it; the control itself carries `nodrag nopan`. Only the left button moves a knob or fader (a right-click opens the menu and changes nothing); grabbing the fader cap drags it from where it is held, a click on the track jumps there. Their drop-preview sizes are in `FREE_CONTROL_SIZE` (`layoutHelpers.ts`).

### Mono / Stereo

**One wire carries a whole stereo signal.** Cards have one input and one output; only a bus splits its mix into separate **L and R outputs** (one per speaker). Registry field `stereo: 'never' | 'follow' | 'optional' | 'always'`:
- **follow** (every processor, incl. gain, hpf, pad, relay, di-box, adc / dac, pan): no switch — passes on what it gets. A stereo wire in → a stereo wire out; the Relay follows its selected input.
- **optional** (switch, `params.stereo`): **Line In** (Stereo = the same level on both sides of one wire) and **Aux Bus** (Stereo = `out-l` / `out-r` outputs from `stereoOutputs`). `setNodeStereo` only moves the Aux outputs: `out` ↔ `out-l` (+ `out-r` back to `out`). Inputs never change.
- **always**: Master Bus and Matrix Bus — one input (any number of wires), outputs `out-l` / `out-r`.
- **never** (one channel): mic, instrument, speakers, audio interface. A stereo wire arriving here is folded (L + R, about +6 dB when both sides match).
- **What a wire carries** (`WireSignal` in `useSignalChain.ts`: `kind` + `l` / `r`): `mono`, `stereo`, or `left` / `right` — one side of a mix, from a bus's L / R output. A side wire **keeps its side through effects** (Aux L → Comp → Master lands on the left only). A stereo bus adds every wire's `l` to Left and `r` to Right: a mono wire lands on both sides at full level (that is why Pan is needed), a side wire on its side.
- **Pan**: always sends a stereo wire. Mono / side wire in = Pan knob (equal-power, −3 dB each side at centre); stereo wire in = Balance knob (centre = unity). Label and help follow (`helpKeyOf(node, stage)`).
- **Maths**: `useGraphSignal` writes `wires` (what each output carries) and `portSignal` (its louder side, for colours). Stereo nodes run `computeGraphNode` once per side; stages get `outL/outR/inL/inR` and `stereoIn` / `stereoOut`. Comp, limiter, de-esser and gate run **linked** in stereo: the louder side sets the gain change, both sides get it.
- A stereo wire is drawn as a **twin line** (also the live preview from a stereo output); an output carrying one side shows an **L / R letter**.
- **Main Fader** (`utils/mainFader.ts`): wiring a Fader to a stereo bus's L or R output turns that wire into the **Mix** wire (`mix` port, the whole stereo mix), the Fader gets **L / R outputs** and every wire on the bus's L / R moves onto it (dropping a Fader onto a bus's L / R wire does the same). Effects may sit between the Mix output and the fader. Unplugging or deleting the Main Fader hands L / R back to the bus (other Mix wires fall back to L); deleting the bus leaves a plain fader. Extra wires from the Mix output are the **pre-fader** point (PFL is built by the user from switches, wires and buses). Port layout is read from the wires, never stored.
- **Matrix send** (same method): wiring a stereo bus's (or its Main Fader's) L or R output to a Matrix Bus turns that wire into the **Matrix send** (`send` port below R, one stereo wire, "L+R"). It is post-fader: a Main Fader takes the bus's send with its L / R, and the pre-fader Mix output cannot feed a matrix. A mono Aux Bus feeds a matrix from its `out` or from the Fader after it (effects may sit between) — a mono wire, landing on both sides.

### Level system

The active complexity level is stored as `complexityLevel: ComplexityLevel` in `signalStore.ts`. The type is `'beginner' | 'intermediate' | 'advanced'`, persisted to `localStorage`.

Levels control **palette visibility only** — they do not auto-populate the graph:

| Level | Visible palette items |
|---|---|
| Beginner | mic, line-in, instrument, di-box, active-speaker, gain, fader |
| Intermediate | + hpf, eq, comp, pad, noise-gate, limiter, deesser, switch, relay, pan (Pan / Balance), master-bus, aux-bus, audio-interface |
| Advanced | + speaker, amp, graphic-eq, adc, dac, matrix-bus |

`PALETTE_BY_LEVEL` in `ElementPalette.tsx` is the source of truth for this table. A level can also change a card's layout, name and starting params: the EQ (`EQNode`) is the **Equalizer** in Intermediate — three knobs (Low / Mid / High, no curve), Low and High fixed as shelves (`initialParams()` in `nodeRegistry.ts`) — and the **Parametric Equalizer** in Advanced, with a draggable curve and a Bell / Shelf switch on Low and High. Level-dependent names live in the locales' `levelNames`; `useTranslation` applies them to `palette.items` and `nodes.<type>.label`. Switching level clears the canvas (with confirmation). `buildDefaultGraph` always returns `{ nodes: [], edges: [] }` — no level pre-places anything.

### Signal health zones

| Zone | dB range | Color | Meaning |
|---|---|---|---|
| `too-quiet` | < −40 dBu | Blue | Noise floor risk |
| `good` | −40 to −12 dBu | Green | Target range |
| `hot` | −12 to 0 dBu | Yellow | Approaching limit |
| `clipping` | > 0 dBu | Red | Distortion |

### Signal math (simplified for education)

- **Gain**: the first Gain after a Mic (effects such as a Pad may sit in between, `preampMicOf()`) is its **Preamp**: `clamp(input + preampDb, +20)`, 0…+60 dB. Anywhere else it is a plain gain stage: `clamp(input + gainDb, +20)`, −∞…+20 dB (fully left = off). Each mode keeps its own param; the card title, knob and help follow the wiring (`stage.preamp`).
- **Amp**: `output = clamp(input + gainDb, −∞, +20)`
- **HPF**: passthrough placeholder (no frequency weighting at this level)
- **EQ**: `output = input + sum(bandGains)` — additive only
- **Graphic EQ**: 31 one-third-octave bands, 20 Hz … 20 kHz (`GEQ_CENTERS` in `controls/eqMath.ts`, params `b0`…`b30`, ±12 dB in 0.5 dB steps); the level change is the pink-noise-weighted sum of the band bells (Q ≈ 4.3). The card is the Parametric EQ's size: In | Out meters, a readout of the band being touched, a Flat button, and the 31 sliders with a curve through their caps (double-click = 0 dB; a drag stays on the slider it started on)
- **Compressor**: `gainReduction = max(0, (input − threshold) × (1 − 1/ratio))`, then `output = input − gainReduction + makeupGain`. Attack and Release (`attackMs`, `releaseMs`) are on the card but do not change the sound yet
- **Noise Gate**: open (`input ≥ threshold`) → `output = input`; closed → `output = input + range` (Range −80…0 dB, −80 ≈ silence). Hold, Attack and Release (`holdMs`, `attackMs`, `releaseMs`) are on the card but do not change the sound yet. Same card layout and size as the Compressor
- **Fader**: `output = input + faderDb`, −100…+10 dB. The fader's travel is uneven like a desk's (`faderTaper.ts`): unity at 85% of the travel, 0.5 dB steps above −20 dB, the quiet end squeezed together
- **Switch**: `output = on ? input : −∞`
- **Master Bus / Aux Bus**: `output = 20 × log10(Σ 10^(inputN/20))` (voltage sum of all wires — two identical signals give +6 dB), per side in stereo
- **Matrix Bus** (always stereo): a bus of buses — only finished mixes go in, after their fader (a stereo bus's Matrix send, a mono Aux's output). Each wire first gets its bus's send knob (`params[send-<busId>]`, one per bus; audio taper `taperToDb`: 0 = off, 75 = 0 dB), then the usual stereo bus sum (a mono bus lands on both sides at full level). Its overall level is a Fader after it (its Main Fader)
- **Pan**: equal-power, `L = in + 20·log10(cos(p·π/2))`, `R = in + 20·log10(sin(p·π/2))`. **Balance**: fades only the opposite side, linearly, centre = unity

The math is intentionally simplified. It teaches the concept correctly without IIR filter biquad complexity.

### React Flow notes

- `nodeTypes` must be defined **outside** the component to avoid re-registration on every render.
- All interactive elements inside nodes (sliders, buttons) carry `nodrag nopan` CSS classes so the canvas does not intercept their pointer events.
- Edges are colored from health values computed by `useGraphSignal`, not stored in React Flow state.
- **`nodeOrigin` is `[0, 0]`**: a node's `position` is its top-left corner. All layout helpers assume this.
- Anything that must escape React Flow's transformed viewport (e.g. `ConfirmDialog`) uses `createPortal` to `document.body` — the viewport's CSS `transform` breaks `position: fixed` inside its DOM tree. Canvas overlays that must not start a wire or a waypoint (the help popover) carry the `lsc-overlay` class.
- `nodesDraggable`, `elementsSelectable` and `panOnDrag` follow `toolMode`. `nodesConnectable` is always `false` — connections are handled entirely by the custom click system (capture-phase `mousedown` on `document`), not React Flow's drag mechanism.
- Wiring acts on `mousedown`, so the `click` that follows a wiring press on a port is swallowed (capture-phase `click` listener, `swallowClickRef`). Otherwise it lands on the input that was just plugged in — by then a connected input, whose click unplugs it — and the new wire vanishes. A plain unplug click (no wire being drawn) is never swallowed.
- **`Node` name collision**: ReactFlow exports `Node`; the DOM also has `Node`. Import ReactFlow's as `type Node as FlowNode` to avoid conflicts.
- `MasterBusNode` serves `master-bus`, `aux-bus` and `matrix-bus` (reads `typeKey` from `data`; the Matrix Bus adds one send-knob row per bus). Its one input (`in`) comes from the registry and accepts many wires. Only `AudioInterfaceNode` still renders N+1 dynamic inputs (`BusInputPorts`).
- While `highlightEdgeIds` is not empty, `SignalChain` gives nodes outside those wires' chains the `lsc-dimmed` class and fades their edges.
- **Handle hit-testing**: custom `<Handle>`s default to `isConnectable`, so React Flow gives them the `connectionindicator` class and `pointer-events: all` even in Select mode — that is what lets the mouse-follow switch find them with `document.elementsFromPoint`. `.lsc-connect-mode` (on the canvas wrapper) also forces it. Handle type (source vs target) is detected via `classList.contains('source'/'target')` — there is no `data-handletype` attribute.
- **Display nodes carry `measured`.** They are rebuilt from the store on every change; a node without `measured` is new to React Flow, which hides it (`visibility: hidden`) until re-measured on the next frame — a click in that gap lands on the pane (a knob drag used to pan the canvas). `SignalChain` keeps React Flow's sizes from `onNodesChange` (`dimensions`) and hands them back, except for a card whose ports changed (`portLayoutKey`: port layout — a stereo Aux's L / R outputs — + plugged wires), which is left unmeasured on purpose so its ports are re-read. A port's ring changes size on hover / while wiring; `NodePort` re-reads it on `transitionend` so wires end at the ring's edge.
- The wire preview, reshape-handle and ghost SVGs are absolutely-positioned siblings of the ReactFlow div. They use `useViewport()` to apply the same `translate/scale` transform as the flow canvas, so they stay aligned during pan and zoom.
- Zoom control labels are translated through ReactFlow's `ariaLabelConfig` prop (`toolbar.zoom*` keys).

### Adding a new node

1. Add the type definition to `NODE_REGISTRY` in `src/data/nodeRegistry.ts` (ports, category, defaultParams). A processor gets `stereo: 'follow'` (it passes on stereo by itself) and reads its meters through `useStereoLevels`
2. Create `src/components/nodes/YourNode.tsx`:
   - Node with several params / meters → use `NodeWrapper` directly
   - Simple single-control node → use `InlineNode` (same shell, centred body)
   - A bare control, not a card (like Gain / Pan / Fader / Switch) → use `FreeControl`, and add its size to `FREE_CONTROL_SIZE`
   - Bypass makes no sense for it → add its type to `NO_BYPASS_TYPES` in `nodeRegistry.ts`
3. Register it in the `nodeTypes` map in `src/components/SignalChain.tsx`
4. Add a computation case in `computeGraphNode()` in `src/hooks/useSignalChain.ts`
5. Add its palette name (`palette.items`) and educational text (`theory`) to **both** `src/i18n/locales/en.json` and `bg.json`
6. Add it to `ALL_ITEMS` in `src/components/ElementPalette.tsx` and include its `typeKey` in the appropriate `PALETTE_BY_LEVEL` entries

### Adding a new level

Edit `src/data/levels.ts` — add a new branch to the `ComplexityLevel` union in `signalStore.ts`, update `PALETTE_BY_LEVEL` in `ElementPalette.tsx`. `buildDefaultGraph` does not need changes (always returns empty).
