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
- [x] Source and sink nodes are draggable (position stored in `SignalNode.position`)

---

## Phase 3 — New Node Types + Migrate Existing Nodes (Session 2b)

*New elements available for insertion; all nodes read from `data.params`.*

- [ ] `src/components/nodes/SwitchNode.tsx` (NEW) — on/off signal break
- [ ] `src/components/nodes/SplitterNode.tsx` (NEW) — 1 in, 2 out
- [ ] `src/components/nodes/PotentiometerNode.tsx` (NEW) — attenuation knob
- [ ] `src/components/nodes/AmpNode.tsx` (NEW) — gain boost (used in intermediate default)
- [ ] `src/components/nodes/FaderNode.tsx` — generalized (replaces FaderNode + MasterFaderNode)
- [ ] `src/components/nodes/SpeakerNode.tsx` — input only; hide trim control in beginner mode
- [ ] Migrate all existing node components from `channels.find()` to `data.params`
- [ ] `src/components/AddSourcePanel.tsx` — call `addInputChannel()` instead of `addChannel()`
- [ ] `src/components/InsertBusPanel.tsx` — call `addBusNode()` instead of `addBus()`

---

## Phase 4 — Polish (Session 3)

- [ ] Translations for 4 new node types (en + bg)
- [ ] `GainStagingBanner` warnings: traverse by `typeKey` not `channelId:typeKey`
- [ ] `SignalLevelProfile` — topological sort for ordered stage display
- [ ] Bus layout: master-bus fixed center, aux/FX below, matrix above
- [ ] Auto-scaling: `fitView` triggers after node insertion
- [ ] Remove all backward-compat shims from store + hooks

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
- Inserting a node on an edge: shift all nodes at `x >= targetNode.x` rightward by H_SPACING (draggable bus nodes exempt — user repositions manually)
- No connection filters — everything connects to everything
- Signal computed by topological sort → BFS from source to sink
- Merge nodes (master-bus, bus): `sumSignalsToDb(allInputs)` — existing function unchanged
- Split nodes (splitter): signal duplicated to both outputs
