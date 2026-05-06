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

## Roadmap

Planned features and their completion status are tracked in [TODO.md](TODO.md). Check it before starting any new feature work to understand what has already been implemented and what comes next.

## Architecture

The app is a **pure client-side React SPA** — no backend, no API calls. All signal processing is arithmetic on numbers in the browser.

### Interaction model (SmartDraw-style)

The canvas works like a drawing app:
1. **Left palette** (`ElementPalette`) — drag any node type onto the blank canvas to place it
2. **Select mode** (default, key `S`) — drag nodes to reposition them
3. **Connect mode** (key `C` or `L`, or the "Connect Tool" button at the top of the left palette) — uses a **click-once pen-tool interaction, never drag**:
   - Hover over a node → source handles (right dots, purple) and target handles (left dots, grey) grow and become hittable
   - **Click once** on a source handle → wire begins; mouse is immediately released
   - **Move freely** → a dashed orthogonal (right-angle-only) preview routes live to the cursor
   - **Click in empty space** → commits a corner waypoint, locking that segment; routing continues from the waypoint
   - **Click a target handle** → completes the connection (a snap ring appears on hover to confirm the landing point)
   - **Right-click or Escape** → cancels the wire in progress; Escape when idle returns to Select mode
4. **Delete a connection** — right-click any edge → "Delete connection"

The canvas starts blank. There is no preset layout. Levels control which node types appear in the palette, not the graph structure.

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
| `src/store/signalStore.ts` | All mutable state: graph nodes/edges, complexity level, active tooltip, language, all graph mutations |
| `src/hooks/useSignalChain.ts` | `useGraphSignal()` — pure BFS signal math over the graph. No side effects. |
| `src/hooks/useGainStaging.ts` | `getHealthStyle(health)` — maps `SignalHealth` → CSS color, label, background. No logic. |
| `src/hooks/useEdgeReshape.ts` | `useEdgeReshape()` — waypoint drag state machine (mousemove/mouseup). Returns `{ reshaping, setReshaping }`. |
| `src/utils/layoutHelpers.ts` | All pure canvas placement math: `nodeDims`, `resolveOverlap`, `snapOutOfCenter`, `pushDownstream`, `pushUpstream`, `shiftNodesLeft`, `shiftNodesRight`, `enforceGap`, `findEdgeAtPoint`, `canInsertMidChain`. Also exports `GRID`, `BUS_TYPES`, `INLINE_TYPE_KEYS`, `NODE_DEFAULT_W`, `HIT_THRESHOLD`, and the `Pt` type. |
| `src/data/nodeRegistry.ts` | `NODE_REGISTRY` — single source of truth for every node type: port definitions, categories, default params. |
| `src/data/zoneConstants.ts` | `CENTER_LEFT_BOUND`, `CENTER_RIGHT_BOUND`, `MIN_NODE_GAP`, `MASTER_BUS_FLOW_POS`, `getZone()` — shared between `layoutHelpers.ts` and `SignalChain.tsx`. |
| `src/data/levels.ts` | `buildDefaultGraph(level)` — always returns empty graph (blank canvas). `BusType` type lives here. |
| `src/i18n/translations.ts` | All UI text and tooltip educational content (`theory` key). Edit copy here only. |
| `src/components/SignalChain.tsx` | React Flow canvas. Owns `nodeTypes` map, `WireDrawing` state machine, drag-drop handlers, `onNodeDrag/Stop`, edge color computation, and all SVG overlays (zone dividers, reshape handles, wire preview, ghost preview). Imports layout math from `layoutHelpers.ts` and reshape state from `useEdgeReshape`. |
| `src/components/ElementPalette.tsx` | Left sidebar with draggable node type items and the Connect Tool toggle button at the top. Level-gated visibility via `PALETTE_BY_LEVEL`. Accepts `toolMode`/`onToolModeChange` props from `App.tsx`. |
| `src/components/ToolBar.tsx` | **Unused** — the Connect Tool was moved into `ElementPalette`. File kept but not rendered. |
| `src/components/nodes/NodeWrapper.tsx` | Card-style shell for complex nodes (208px wide): handles, bypass/remove/help buttons, tooltip. |
| `src/components/nodes/InlineNode.tsx` | Compact shell for simple nodes (100px wide): health-colored border, bypass/remove/help buttons. |
| `src/components/nodes/ControlSlider.tsx` | `ControlSlider` primitive used by card nodes. |

### Node visual groups

**Card nodes** (`NodeWrapper`) — complex modules with multiple parameters and signal meters:
`gain`, `amp`, `eq`, `comp`, `hpf`, `graphic-eq`, `master-bus`, `bus`

**Compact inline nodes** (`InlineNode`) — simple control points, icon-first, no card chrome:
`mic`, `line-in`, `instrument`, `fader`, `switch`, `potentiometer`, `speaker`

Compact nodes show signal health via border color instead of SignalMeter bars. Fader/switch/potentiometer have no bypass button — the control itself is the state.

### Level system

The active complexity level is stored as `complexityLevel: ComplexityLevel` in `signalStore.ts`. The type is `'beginner' | 'intermediate' | 'advanced'`, persisted to `localStorage`.

Levels control **palette visibility only** — they do not auto-populate the graph:

| Level | Visible palette items |
|---|---|
| Beginner | mic, line-in, instrument, speaker, gain, fader |
| Intermediate | + hpf, eq, comp, switch |
| Advanced | + potentiometer, amp, graphic-eq, master-bus, bus |

Switching level clears the canvas (with confirmation). `buildDefaultGraph` always returns `{ nodes: [], edges: [] }`.

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
- **Master Bus / Bus**: `output = 20 × log10(Σ 10^(inputN/20))` (linear power sum of all inputs)

The math is intentionally simplified. It teaches the concept correctly without IIR filter biquad complexity.

### React Flow notes

- `nodeTypes` must be defined **outside** the component to avoid re-registration on every render.
- All interactive elements inside nodes (sliders, buttons) carry `nodrag nopan` CSS classes so the canvas does not intercept their pointer events.
- Edges are colored from health values computed by `useGraphSignal`, not stored in React Flow state.
- The edge delete context menu uses `createPortal` to `document.body` — React Flow's CSS `transform` on the viewport breaks `position: fixed` inside its DOM tree.
- `nodesDraggable` and `elementsSelectable` are toggled by `toolMode`. `nodesConnectable` is always `false` — connections are handled entirely by the custom click system, not React Flow's drag mechanism.
- **`Node` name collision**: ReactFlow exports `Node`; the DOM also has `Node`. Import ReactFlow's as `type Node as FlowNode` to avoid conflicts.
- `MasterBusNode` renders N+1 input handles (one per connected edge, plus one empty slot) and is reused for the `bus` node type — it reads `typeKey` from `data` to get the correct label and registry entry.
- **Handle pointer-events**: React Flow sets `pointer-events: none` on handles by default. The `.lsc-connect-mode` CSS class (added to the canvas wrapper) overrides this to `all`, making handles hittable by `document.elementsFromPoint`. Handle type (source vs target) is detected via `classList.contains('source'/'target')` — there is no `data-handletype` attribute.
- The wire preview SVG is rendered as an absolutely-positioned sibling of the ReactFlow div. It uses `useViewport()` to apply the same `translate/scale` transform as the flow canvas, so the preview stays aligned during pan and zoom.

### Adding a new node

1. Add the type definition to `NODE_REGISTRY` in `src/data/nodeRegistry.ts` (ports, category, defaultParams)
2. Create `src/components/nodes/YourNode.tsx`:
   - Complex node with multiple params → use `NodeWrapper`
   - Simple single-purpose node → use `InlineNode`
3. Register it in the `nodeTypes` map in `src/components/SignalChain.tsx`
4. Add a computation case in `computeGraphNode()` in `src/hooks/useSignalChain.ts`
5. Add educational text in `src/i18n/translations.ts` under the `theory` key
6. Add it to `ALL_ITEMS` in `src/components/ElementPalette.tsx` and include its `typeKey` in the appropriate `PALETTE_BY_LEVEL` entries

### Adding a new level

Edit `src/data/levels.ts` — add a new branch to the `ComplexityLevel` union in `signalStore.ts`, update `PALETTE_BY_LEVEL` in `ElementPalette.tsx`. `buildDefaultGraph` does not need changes (always returns empty).
