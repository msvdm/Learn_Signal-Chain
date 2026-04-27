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

### Data flow (read this first)

```
signalStore (Zustand)
  └── nodes[] + edges[]  (graph model)
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
| `src/data/nodeRegistry.ts` | `NODE_REGISTRY` — single source of truth for every node type: port definitions, categories, default params. |
| `src/data/levels.ts` | `buildDefaultGraph(level)` — returns the default `nodes[]` + `edges[]` for each complexity level. |
| `src/i18n/translations.ts` | All UI text and tooltip educational content (`theory` key). Edit copy here only. |
| `src/components/SignalChain.tsx` | React Flow canvas. Owns the `nodeTypes` map and edge color computation. |
| `src/components/nodes/NodeWrapper.tsx` | Card-style shell for complex nodes (208px wide): handles, insertion menu, bypass/remove/help buttons, tooltip. |
| `src/components/nodes/InlineNode.tsx` | Compact shell for simple nodes (100px wide): health-colored border, same insertion menu, no bypass on control-point types. |
| `src/components/nodes/ControlSlider.tsx` | Contains only the `ControlSlider` primitive used by card nodes. |

### Node visual groups

**Card nodes** (`NodeWrapper`) — complex modules with multiple parameters and signal meters:
`gain`, `amp`, `eq`, `comp`, `hpf`, `graphic-eq`, `master-bus`, `bus`

**Compact inline nodes** (`InlineNode`) — simple control points, icon-first, no card chrome:
`mic`, `line-in`, `instrument`, `fader`, `switch`, `potentiometer`, `splitter`, `speaker`

Compact nodes show signal health via border color instead of SignalMeter bars. Fader/switch/potentiometer have no bypass button — the control itself is the state.

### Level system

The active complexity level is stored as `complexityLevel: ComplexityLevel` in `signalStore.ts`. The type is `'beginner' | 'intermediate' | 'advanced' | 'routing-madness'`, persisted to `localStorage`.

`buildDefaultGraph(level)` in `src/data/levels.ts` returns the initial `nodes[]` + `edges[]`:
- **Beginner**: `mic → speaker` (2 nodes)
- **Intermediate / Advanced / Routing Madness**: `mic → gain → fader → master-bus → amp → speaker`

Switching level resets the entire graph to the default for that level. All visible nodes are fully interactive — there is no locked state.

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
- **Fader / Potentiometer**: `output = input + faderDb` / `output = input − attenuationDb`
- **Switch**: `output = on ? input : −∞`
- **Splitter**: signal duplicated to both outputs unchanged
- **Master Bus / Bus**: `output = 20 × log10(Σ 10^(inputN/20))` (linear power sum of all inputs)

The math is intentionally simplified. It teaches the concept correctly without IIR filter biquad complexity.

### React Flow notes

- `nodeTypes` must be defined **outside** the component to avoid re-registration on every render.
- All interactive elements inside nodes (sliders, buttons) carry React Flow's drag/pan-suppression CSS classes so the canvas does not intercept their pointer events.
- Edges are colored from health values computed by `useGraphSignal`, not stored in React Flow state.
- Insertion menus use `createPortal` to `document.body` — React Flow's CSS `transform` on the viewport breaks `position: fixed` inside its DOM tree.

### Adding a new node

1. Add the type definition to `NODE_REGISTRY` in `src/data/nodeRegistry.ts` (ports, category, defaultParams)
2. Create `src/components/nodes/GraphYourNode.tsx`:
   - Complex node with multiple params → use `GraphNodeWrapper`
   - Simple single-purpose node → use `GraphInlineNode`
3. Register it in the `nodeTypes` map in `src/components/SignalChain.tsx`
4. Add a computation case in `computeGraphNode()` in `src/hooks/useSignalChain.ts`
5. Add educational text in `src/i18n/translations.ts` under the `theory` key
6. Optionally add it to `INSERTABLE_TYPES` in both `GraphNodeWrapper.tsx` and `GraphInlineNode.tsx`

### Adding a new level

Edit `src/data/levels.ts` only — update `buildDefaultGraph()` with a new branch. No component changes needed unless the level introduces a UI pattern that does not exist yet.
