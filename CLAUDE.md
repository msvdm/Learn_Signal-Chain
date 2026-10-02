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
1. **Left palette** (`ElementPalette`) — search, category tabs, 2-column tiles (an icon rail at tablet width ≤ 1024px). Drag any tile onto the canvas; the node lands where it is dropped (cursor on its port line), nudged only to avoid overlapping another node. Dropping a node with an input and an output onto an existing wire inserts it mid-chain and pushes everything downstream to the right.
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

Every level starts from a **blank canvas** at 100% zoom (also after Reset, a level change or removing the last node). There is no preset layout, no fixed Master Bus and no position restrictions. Levels control which node types appear in the palette, not the graph structure.

### Header

Brand · level stepper (Beginner / Intermediate / Advanced, with an in-app `ConfirmDialog` before clearing the canvas) · **Snap to grid** switch (on = snap to `GRID` + dotted background; off = free placement, no dots; text label hidden below 1200px so the header fits) · Light / Dark · language menu · Reset.

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
| `src/store/signalStore.ts` | All mutable state: graph nodes/edges, complexity level, language, `theme` and `snapToGrid` (both persisted), `toolMode`, `selectedNodeId`, `wireSource` (lets cards highlight valid inputs while a wire is drawn), active help popover, `highlightEdgeId` (chain lit up from the unplug list), all graph mutations incl. `setNodeStereo` |
| `src/hooks/useSignalChain.ts` | `useGraphSignal()` — pure BFS signal math over the graph, shared by all callers (computed once). No side effects. |
| `src/hooks/useStereoLevels.ts` | `useStereoLevels(id)` — a card's input / output levels for its meters: one value each in mono, L + R in stereo, plus `inPeak` (louder input side). |
| `src/hooks/useGainStaging.ts` | `getHealthStyle(health)` — maps `SignalHealth` → CSS color, label, background. No logic. |
| `src/hooks/useEdgeReshape.ts` | `useEdgeReshape()` — waypoint drag state machine (mousemove/mouseup). Returns `{ reshaping, setReshaping }`. |
| `src/hooks/useLatestRef.ts` | `useLatestRef(value)` — a ref holding the latest committed value, for document/window listeners. Synced in a layout effect: never assign `ref.current` during render (react-hooks lint). |
| `src/hooks/useChainEmpty.ts` | `useChainEmpty()` — true when no node is on the canvas (drives the palette's "Start here" badge and the camera reset). |
| `src/hooks/useMediaQuery.ts` | `useMediaQuery()`, `TABLET_QUERY` (≤ 1024px: palette icon rail, no tagline), `WIDE_HEADER_QUERY` (≥ 1200px: all header labels fit). |
| `src/utils/layoutHelpers.ts` | All pure canvas placement math: `nodeDims` / `recordMeasuredSize` (cards size to content; the last measured size per type is reused for drop previews), `resolveOverlap`, `pushDownstream`, `enforceGap`, `findEdgeAtPoint`, `canInsertMidChain`. Also exports `GRID`, `MIN_NODE_GAP`, `HEADER_H`, `PORT_TOP`, `PORT_GAP`, `HIT_THRESHOLD` and the `Pt` type. |
| `src/utils/connectionRules.ts` | `nodeAcceptsWire()` / `portAcceptsWire()` — which inputs may take a wire (one wire per input; Master / Aux bus inputs take any number). |
| `src/utils/chainColors.ts` | Chain colours (one per source, picked on `addNode`), `upstreamOf` / `chainOfEdge` / `chainColorsOf` / `chainSourcesOfEdge` for the card stripe, unplug list and highlight. |
| `src/utils/wirePath.ts` | `buildWirePath()` — orthogonal route with rounded corners, shared by the live preview and committed edges. |
| `src/utils/wireValidation.ts` | `wirePassesThroughNode()` — orange warning when a wire crosses another card. |
| `src/utils/chainOrder.ts` | `chainOrder()` — nodes in signal-flow order, for the help popover's Previous / Next. |
| `src/data/nodeRegistry.ts` | `NODE_REGISTRY` — single source of truth for every node type: port definitions, categories, default params, mono / stereo support. `getPorts(node)` gives a node's ports for its current mode; also `isNodeStereo`, `portSide`, `basePortId`, `helpKeyOf`, `MULTI_WIRE_TYPES`. |
| `src/data/levels.ts` | `buildDefaultGraph()` — always returns an empty graph (blank canvas). `BusType` type lives here. |
| `src/i18n/locales/en.json`, `bg.json` | All UI text and help-popover educational content (`theory` key). Edit copy here; add every new key to both files. |
| `src/i18n/translations.ts` | The `Translations` type (add new keys here too) and `fmt()` for `{placeholder}` strings. |
| `src/App.tsx` | Header (see above) and the `ConfirmDialog` for Reset / level change. |
| `src/components/SignalChain.tsx` | React Flow canvas. Owns `nodeTypes` map, `WireDrawing` state machine, the mouse-follow mode switch, drag-drop handlers, `onNodeDrag/Stop`, edge color, zoom `<Controls>`, and the SVG overlays (reshape handles, wire preview, ghost preview). |
| `src/components/ElementPalette.tsx` | Left sidebar: search, tabs, draggable tiles. Level-gated visibility via `PALETTE_BY_LEVEL`. |
| `src/components/ChainEdge.tsx` | Custom edge: orthogonal path through waypoints (no level badge — levels are shown on the cards). |
| `src/components/Tooltip.tsx` | `HelpPopover` — anchored under the node whose "?" was clicked, Previous / Next in signal order. |
| `src/components/ConnectingToast.tsx` | Bottom-centre "Connecting from …" status while a wire is drawn. |
| `src/components/UnplugMenu.tsx` | List of the wires on a bus input that holds several: hover = light up that chain, × = unplug one wire. Portal to `document.body`. |
| `src/components/ConfirmDialog.tsx` | In-app `window.confirm` replacement, rendered with `createPortal` to `document.body`. |
| `src/components/nodes/NodeWrapper.tsx` | The single card shell every node uses (see below). |
| `src/components/nodes/NodePort.tsx` | One input / output port: health-coloured ring, valid-target pulse, a connected input turns into × on hover (click = unplug; 2+ wires open `UnplugMenu`), L / R letter on stereo ports. `BusInputPorts` for the audio interface's dynamic inputs. |
| `src/components/nodes/InlineNode.tsx` | Thin wrapper over `NodeWrapper` for single-control nodes (centres one big reading / control). |
| `src/components/nodes/ControlSlider.tsx` | `ControlSlider` primitive used by card nodes. |
| `src/components/controls/StableText.tsx` | `StableText` — a reading that keeps the width of its widest value. Helpers `LEVEL_SAMPLE` / `widestFormat()` live in `src/utils/readout.ts`. |
| `src/components/controls/EQGraph.tsx` | Interactive EQ curve drawn at exact pixel size (never stretched): drag a band dot, double-click = 0 dB, scroll = width (Q). Response math in `controls/eqMath.ts`. |

### Node card shell

Every node uses `NodeWrapper`:
- **Width follows content** (no fixed widths; `minWidth: 160`), text wraps to fit.
- A fixed **56px header** (icon, title, "?" help) keeps the first port line at `PORT_TOP` (28px) on every card, so wires between cards stay straight; stacked ports are `PORT_GAP` (24px) apart.
- The header row is **icon · title · ? (help) · On/Off (bypass) · × (remove)**. Types in `NO_BYPASS_TYPES` (sources, outputs, faders, switches, `master-bus` …) have no On/Off — the control itself is the state. Every node, including Master Bus, can be removed.
- **A card never changes size while values change** (no flicker). Wrap every changing reading in `StableText` (`components/controls/StableText.tsx`), which reserves the width of the widest value it can show: `LEVEL_SAMPLE` for signal levels, `widestFormat()` for a control's readout (both in `utils/readout.ts`). `KnobControl`, `VerticalFader`, `ControlSlider` and `SignalMeter` already do this. Text that only sometimes shows keeps its space (`visibility: hidden`) instead of being removed. The "Bypassed" tag sits on the header's bottom line, outside the layout. Wide cards (Parametric EQ) use a fixed body width.
- Controls and In/Out meters stay on the cards; there is **no status chip**.
- Types with `stereo: 'optional'` get a **Mono | Stereo** switch under the header (not dimmed by bypass). Meters take `dbR` to show L / R bars.
- A thin **chain-colour stripe** on the card's top edge shows which sources (chains) pass through it.

### Mono / Stereo

Instead of separate mono and stereo node types, elements carry a switch (`params.stereo`, registry field `stereo: 'never' | 'optional' | 'always'`):
- **Mono only**: mic, instrument, gain, hpf, pad, speakers, audio-interface. **Always stereo**: master-bus. Everything else is switchable; new nodes start in Mono.
- **Ports**: in stereo every mono port splits into an L / R pair (`in` → `in-l` + `in-r`, `direct` → `direct-l` + `direct-r`, `in-a` → `in-a-l` + `in-a-r`) unless the type lists `stereoInputs` / `stereoOutputs`. `setNodeStereo` moves wires: mono → stereo puts them on the L port; stereo → mono moves L back and drops R (bus inputs keep both, they are added).
- **Pan node** = Pan knob in Mono (1 in → L/R out, equal-power, −3 dB each side at centre) and Balance knob in Stereo (L/R in → L/R out, centre = unity). Help text follows (`helpKeyOf`).
- **Aux bus** (mono or stereo) and **Master bus** (stereo) have fixed inputs that accept **any number of wires**, added together. A bus input with 2+ wires opens `UnplugMenu`.
- **How a wire feeds a stereo input**: a wire from a stereo output (`…-l` / `…-r`) feeds only the side it lands on; a wire from a mono output feeds **both** sides at full level — that is why a Pan knob is needed. Bus cards explain it (`busNotes`: `foldedStereo` = L+R into a mono bus, about +6 dB; `monoOnStereo` = mono wire on a stereo bus).
- **Maths**: `useGraphSignal` runs `computeGraphNode` once per side and writes `${port}-l` / `${port}-r`; stages get `outL/outR/inL/inR`. Comp, limiter, de-esser and gate run **linked** in stereo: the louder side sets the gain change, both sides get it.

### Level system

The active complexity level is stored as `complexityLevel: ComplexityLevel` in `signalStore.ts`. The type is `'beginner' | 'intermediate' | 'advanced'`, persisted to `localStorage`.

Levels control **palette visibility only** — they do not auto-populate the graph:

| Level | Visible palette items |
|---|---|
| Beginner | mic, line-in, instrument, di-box, active-speaker, gain, fader |
| Intermediate | + hpf, eq, comp, pad, noise-gate, limiter, deesser, switch, relay, pan (Pan / Balance), master-bus, aux-bus, audio-interface |
| Advanced | + speaker, potentiometer, amp, graphic-eq, adc, dac |

`PALETTE_BY_LEVEL` in `ElementPalette.tsx` is the source of truth for this table. Switching level clears the canvas (with confirmation). `buildDefaultGraph` always returns `{ nodes: [], edges: [] }` — no level pre-places anything.

### Signal health zones

| Zone | dB range | Color | Meaning |
|---|---|---|---|
| `too-quiet` | < −40 dBu | Blue | Noise floor risk |
| `good` | −40 to −12 dBu | Green | Target range |
| `hot` | −12 to 0 dBu | Yellow | Approaching limit |
| `clipping` | > 0 dBu | Red | Distortion |

### Signal math (simplified for education)

- **Gain / Amp**: `output = clamp(input + gainDb, −∞, +20)`
- **HPF**: passthrough placeholder (no frequency weighting at this level)
- **EQ**: `output = input + sum(bandGains)` — additive only
- **Compressor**: `gainReduction = max(0, (input − threshold) × (1 − 1/ratio))`, then `output = input − gainReduction + makeupGain`
- **Fader / Potentiometer**: `output = input + faderDb` / audio-taper curve, unity at 75% position
- **Switch**: `output = on ? input : −∞`
- **Master Bus / Aux Bus**: `output = 20 × log10(Σ 10^(inputN/20))` (voltage sum of all wires — two identical signals give +6 dB), per side in stereo
- **Pan**: equal-power, `L = in + 20·log10(cos(p·π/2))`, `R = in + 20·log10(sin(p·π/2))`. **Balance**: fades only the opposite side, linearly, centre = unity

The math is intentionally simplified. It teaches the concept correctly without IIR filter biquad complexity.

### React Flow notes

- `nodeTypes` must be defined **outside** the component to avoid re-registration on every render.
- All interactive elements inside nodes (sliders, buttons) carry `nodrag nopan` CSS classes so the canvas does not intercept their pointer events.
- Edges are colored from health values computed by `useGraphSignal`, not stored in React Flow state.
- **`nodeOrigin` is `[0, 0]`**: a node's `position` is its top-left corner. All layout helpers assume this.
- Anything that must escape React Flow's transformed viewport (e.g. `ConfirmDialog`) uses `createPortal` to `document.body` — the viewport's CSS `transform` breaks `position: fixed` inside its DOM tree. Canvas overlays that must not start a wire or a waypoint (the help popover) carry the `lsc-overlay` class.
- `nodesDraggable`, `elementsSelectable` and `panOnDrag` follow `toolMode`. `nodesConnectable` is always `false` — connections are handled entirely by the custom click system (capture-phase `mousedown` on `document`), not React Flow's drag mechanism.
- **`Node` name collision**: ReactFlow exports `Node`; the DOM also has `Node`. Import ReactFlow's as `type Node as FlowNode` to avoid conflicts.
- `MasterBusNode` serves `master-bus` and `aux-bus` (reads `typeKey` from `data`). Its inputs come from the registry (`in-l` / `in-r`, or `in` for a mono Aux) and accept many wires. Only `AudioInterfaceNode` still renders N+1 dynamic inputs (`BusInputPorts`).
- While `highlightEdgeId` is set, `SignalChain` gives nodes outside that wire's chain the `lsc-dimmed` class and fades their edges.
- **Handle hit-testing**: custom `<Handle>`s default to `isConnectable`, so React Flow gives them the `connectionindicator` class and `pointer-events: all` even in Select mode — that is what lets the mouse-follow switch find them with `document.elementsFromPoint`. `.lsc-connect-mode` (on the canvas wrapper) also forces it. Handle type (source vs target) is detected via `classList.contains('source'/'target')` — there is no `data-handletype` attribute.
- Display nodes are rebuilt from the store on every change without `measured`, so React Flow briefly hides each card (`visibility: hidden`) until its ResizeObserver re-measures it. In a visible tab this happens before paint; in a background / hidden tab (e.g. an automated browser pane) cards stay hidden and unclickable until a frame renders.
- The wire preview, reshape-handle and ghost SVGs are absolutely-positioned siblings of the ReactFlow div. They use `useViewport()` to apply the same `translate/scale` transform as the flow canvas, so they stay aligned during pan and zoom.
- Zoom control labels are translated through ReactFlow's `ariaLabelConfig` prop (`toolbar.zoom*` keys).

### Adding a new node

1. Add the type definition to `NODE_REGISTRY` in `src/data/nodeRegistry.ts` (ports, category, defaultParams). If it can be stereo, add `stereo: 'optional'` and `stereo: false` to its defaultParams, and read meters through `useStereoLevels`
2. Create `src/components/nodes/YourNode.tsx`:
   - Node with several params / meters → use `NodeWrapper` directly
   - Simple single-control node → use `InlineNode` (same shell, centred body)
   - Bypass makes no sense for it → add its type to `NO_BYPASS_TYPES` in `NodeWrapper.tsx`
3. Register it in the `nodeTypes` map in `src/components/SignalChain.tsx`
4. Add a computation case in `computeGraphNode()` in `src/hooks/useSignalChain.ts`
5. Add its palette name (`palette.items`) and educational text (`theory`) to **both** `src/i18n/locales/en.json` and `bg.json`
6. Add it to `ALL_ITEMS` in `src/components/ElementPalette.tsx` and include its `typeKey` in the appropriate `PALETTE_BY_LEVEL` entries

### Adding a new level

Edit `src/data/levels.ts` — add a new branch to the `ComplexityLevel` union in `signalStore.ts`, update `PALETTE_BY_LEVEL` in `ElementPalette.tsx`. `buildDefaultGraph` does not need changes (always returns empty).
