# Signal Chain — Graph Architecture Roadmap

## Goal
Replace the implicit linear-chain model (`channels[].chainOrder[]`) with an explicit
graph where every node has visible input/output connection pins, elements are inserted
by clicking those pins, and the signal path is computed by BFS graph traversal.

The guiding principle: **fewer rules, more possibilities**. A small set of simple,
connectable elements compose naturally into complex rigs.

---

## Phase 1 — Data Model Foundation ✅ (Session 1)

*App looks identical after this phase; new model coexists with old.*

- [x] `src/data/nodeRegistry.ts` — node-type registry with port definitions
- [x] `src/data/levels.ts` — `buildDefaultGraph(level)` returns default `nodes[]` + `edges[]`
- [x] `src/store/signalStore.ts` — add `nodes[]`, `edges[]`, and graph actions alongside old model
- [x] `src/hooks/useSignalChain.ts` — add `useGraphSignal()` (BFS traversal); old hooks unchanged

**Default chains defined:**
- Beginner: `mic-1 → speaker-1`
- Intermediate+: `mic-1 → gain-1 → fader-ch → master-bus → fader-master → amp-1 → speaker-1`

---

## Phase 2 — Layout + Visible Handles + Insertion UI (Session 2a) ✅

*Switch rendering to the new model; handles become clickable.*

- [x] `src/components/SignalChain.tsx` — render from `nodes[]`/`edges[]` instead of `channels[]`
- [x] `src/components/nodes/GraphNodeWrapper.tsx` (NEW) — visible handle circles driven by `NODE_REGISTRY`; insertion menu on handle click
- [x] `src/components/nodes/Graph*Node.tsx` (NEW) — Mic, Gain, Fader, MasterBus, Amp, Speaker, Generic — read from `data.params` via `updateNodeParams`
- [x] `src/components/ChainEdge.tsx` — stripped to plain colored edge (no `+` button)
- [x] Beginner canvas: mic → speaker rendered from graph model
- [x] Handle-click insertion: clicking an output or input dot opens a picker; `insertNodeOnEdge` shifts downstream nodes
- [x] Fixed-distance layout: inserting a node between A–C keeps A–B and B–C equal to the original A–C gap; all nodes shift uniformly

---

## Phase 3 — New Node Types + Migrate Existing Nodes (Session 2b) ✅

*New elements available for insertion; all nodes read from `data.params`.*

- [x] `src/components/nodes/GraphSwitchNode.tsx` (NEW) — on/off toggle with plain-English label
- [x] `src/components/nodes/GraphSplitterNode.tsx` (NEW) — 1 in, 2 out with split visualization
- [x] `src/components/nodes/GraphPotentiometerNode.tsx` (NEW) — attenuation knob (0–80 dB)
- [x] `src/components/nodes/GraphAmpNode.tsx` (NEW) — gain boost (used in intermediate default)
- [x] `src/components/nodes/GraphFaderNode.tsx` — generalized fader (channel + master)
- [x] `src/components/nodes/GraphSpeakerNode.tsx` — input only, waveform animation
- [x] All node components read from `data.params` via `updateNodeParams`
- [x] `src/components/AddSourcePanel.tsx` — calls `addInputChannel()` + reads from `nodes[]`
- [x] `src/components/InsertBusPanel.tsx` — calls `addBusNode()` + reads from `nodes[]`
- [x] Both panels surfaced inside `SignalChain.tsx` React Flow canvas

---

## Phase 4 — Polish + Cleanup (Session 3) ✅

- [ ] Translations for 4 new node types (en + bg) — copy exists; wired to GraphNodeWrapper tooltip
- [x] `GainStagingBanner` — removed (unmounted, dead code deleted)
- [x] `SignalLevelProfile` — rewired to `useGraphSignal()`; primary path via x-position grouping
- [x] Bus layout: master-bus fixed center, aux/FX below, matrix above (`addBusNode` V_SPACING offset)
- [x] Auto-scaling: `fitView` triggers after bus node insertion (`FitOnBusAdd` in SignalChain)
- [x] Remove all backward-compat shims from store + hooks — complete

### Codebase cleanup (Session 3)
- [x] Deleted 15 legacy node components (old channel-model, never rendered)
- [x] Deleted 3 legacy controls (CompressorCurve, EQInlineGraph, eqMath — only used by dead nodes)
- [x] Deleted EQCurve, GainStagingBanner (unreferenced)
- [x] `NodeWrapper.tsx` stripped to `ControlSlider` only
- [x] `useSignalChain.ts`: removed 250+ lines of old-model code (`useMultiChannelSignal`, `useSignalChain` compat wrapper, all channel/master compute functions)
- [x] `signalStore.ts`: removed 350+ lines of old-model state + mutations (channels, masterState, buses/sends, all old actions)

---

## Node Port Reference

| typeKey | Inputs | Outputs | Category |
|---------|--------|---------|----------|
| `mic` | — | `out` | source |
| `line-in` | — | `out` | source |
| `instrument` | — | `out` | source |
| `gain` | `in` | `out` | processor |
| `hpf` | `in` | `out` | processor |
| `eq` | `in` | `out` | processor |
| `comp` | `in` | `out` | processor |
| `fader` | `in` | `out` | processor |
| `switch` | `in` | `out` | processor |
| `splitter` | `in` | `out-1`, `out-2` | split |
| `potentiometer` | `in` | `out` | processor |
| `amp` | `in` | `out` | processor |
| `master-bus` | dynamic | `out` | merge |
| `bus` | dynamic | `out` | merge |
| `graphic-eq` | `in` | `out` | processor |
| `speaker` | `in` | — | sink |

---

## Key Design Decisions

- H_SPACING = 420px between nodes horizontally
- V_SPACING = 400px between channels vertically
- Inserting a node on an edge: all nodes at `x >= newNode.x` shift rightward by H_SPACING — no exceptions
- Bus nodes (aux/FX/PFL/matrix) sit at the master-bus x position, offset vertically; adding one triggers `fitView`
- No connection filters — everything connects to everything
- Signal computed by topological sort → BFS from source to sink
- Merge nodes (master-bus, bus): ontinue on the roadmap and `sumSignalsToDb(allInputs)` — existing function unchanged
- Split nodes (splitter): signal duplicated to both outputs
