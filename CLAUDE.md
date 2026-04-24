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
  └── nodeState (all slider values)
        └── useSignalChain() hook
              └── computes dB at each stage (mic → preamp → eq → comp → fader → master)
                    └── every node component reads its own stage result and renders accordingly
```

Every slider change → updates `signalStore` → `useSignalChain` recomputes → all meters/colours/edges update simultaneously. There is no local component state for signal values.

### Key files and their single responsibility

| File | What it owns |
|---|---|
| `src/store/signalStore.ts` | All mutable state: slider positions, complexity level, active tooltip, language |
| `src/hooks/useSignalChain.ts` | Pure signal math — input dB in, output dB out for each stage. No side effects. |
| `src/hooks/useGainStaging.ts` | Maps `SignalHealth` → CSS colour, label, background. No logic. |
| `src/data/levels.ts` | `getLevelNodes(level)` — single source of truth for which nodes are visible per complexity level. |
| `src/i18n/translations.ts` | All UI text and tooltip educational content (`theory` key). Edit copy here only. |
| `src/components/SignalChain.tsx` | React Flow canvas. Owns node layout and edge colours. |
| `src/components/EQCurve.tsx` | SVG frequency response curve with draggable band handles. |
| `src/components/nodes/NodeWrapper.tsx` | Shared shell for all nodes: header, tooltip trigger, `ControlSlider` primitive. |

### Level system

The active complexity level is stored as `complexityLevel: ComplexityLevel` in `signalStore.ts`. The type is `'beginner' | 'intermediate' | 'advanced' | 'routing-madness'`, persisted to `localStorage`.

`getLevelNodes(level)` in `src/data/levels.ts` returns the node IDs visible for that level:
- **Beginner**: `mic → preamp → eq → comp → speaker` (5 nodes)
- **Intermediate / Advanced / Routing Madness**: full 7-node chain (future stages add unique content)

`SignalChain.tsx` and `SignalLevelProfile.tsx` call `getLevelNodes` to filter their displayed nodes. All visible nodes are fully interactive — there is no locked state. Level buttons in the header let the user switch; switching resets node sliders.

### Signal health zones

| Zone | dB range | Colour | Meaning |
|---|---|---|---|
| `too-quiet` | < −40 dBu | Blue | Noise floor risk |
| `good` | −40 to −12 dBu | Green | Target range |
| `hot` | −12 to 0 dBu | Yellow | Approaching limit |
| `clipping` | > 0 dBu | Red | Distortion |

### Signal math (simplified for education)

- **Preamp**: `output = input + gainSlider` (clamped to +20 dBu max)
- **EQ**: `output = input + sum(bandGains)` — additive only, no frequency weighting at the level calculation
- **Compressor**: `gainReduction = max(0, (input − threshold) × (1 − 1/ratio))`, then `output = input − gainReduction + makeupGain`
- **Fader**: `output = input + faderDb` (0 to −80)
- **Master**: `output = input + masterTrimDb` (±12)
- **EQ curve shape**: Gaussian bell in log-frequency space — `gainDb × exp(−log2(f/center)² / (2/Q)²)`

The math is intentionally simplified. It teaches the concept correctly without IIR filter biquad complexity.

### React Flow notes

- `nodeTypes` must be defined **outside** the component to avoid re-registration on every render.
- All node components use the `nodrag` CSS class on interactive elements (sliders, buttons) so React Flow does not intercept drag events.
- Edges are computed directly from health colours, not stored in React Flow state.

### Adding a new node

1. Create `src/components/nodes/YourNode.tsx` using `NodeWrapper` + `ControlSlider`
2. Add its id to `NODE_TYPE_MAP` and `nodeTypes` in `SignalChain.tsx`
3. Add a signal computation function in `useSignalChain.ts`
4. Add educational text in `theory.ts`
5. Add its id to `BEGINNER_NODES` and/or `FULL_NODES` in `levels.ts` as appropriate

### Adding a new level

Edit `src/data/levels.ts` only. No component changes needed unless the new level introduces a UI pattern that does not exist yet.
