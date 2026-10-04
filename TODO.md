# Code-quality TODO

From a whole-codebase review (2026-10-04). Behaviour must not change: each step is a
restructuring. Work one step per session, run `bun run lint` + `bun run build`, check the app in
the browser (see the dev-environment notes in memory), commit, then tick the step here.

Line numbers are from the review and will drift — search for the names.

## ~~1. Delete dead code, derive `Translations` from en.json~~ — done

`Translations` is now typed from `en.json` (`bg.json` is checked with `satisfies LocaleStrings`),
the `?.` / English fallbacks are gone, and so are: the engine's unused warnings / overall health
(it no longer takes `t`), `GenericNode`, `App.css`, `buildDefaultGraph` / `BusType`
(`ComplexityLevel` + `LEVELS` now live in `data/levels.ts`), the `accentColor` prop, the
registry's type labels and port `side`, the unused health-style fields (`healthColor()`), and
bg.json's stale `bus` keys.

## ~~2. One way into the graph: `commitGraph` + atomic layout actions~~ — done

Every store graph action goes through `commitGraph(s, graph)`: `reconcileMainFaders` (now also
skips handing L / R back to a bus switched to Mono, so `setNodeStereo` behaves as before) and
`pruneRefs` (selection, help, highlighted wires, a wire being drawn). A new canvas (New, level
change, `loadChain`) commits `{ newCanvas: true }`; undo / redo only prune. `updateNodeParams`
now settles too — fixes the Relay → Graphic EQ / Amp stale `out-l` / `out-r` wires. Pure edits
live in `src/graph/edits.ts` (`newEdge`, `withNodes`, `withoutNode(s)`, `withNodeOnWire`,
`withPositions`, `withStereo`); `replaceEdge` / `updateNodePosition` are gone (`insertOnWire`,
`setPositions`), `enforceGap` returns its moves, `attachMainFaders` is internal.

Left as it was, on purpose: a level change keeps the clipboard (it is a snapshot, and the only way
to carry elements to another level). The cards that slide aside after a drop onto a wire are still
a second change (they wait for the card to be measured), joined to the drop by the 400 ms merge.

Found while testing, not fixed (old behaviour): switching a stereo Aux with a Main Fader and a
Graphic EQ after it to Mono and back to Stereo moves the Matrix send from the Main Fader onto the
Graphic EQ (`attachMainFaders` turns the fader's `out` wire to the matrix into `out-l`, which then
follows the L / R to the EQ).

## 3. `src/graph/` and `src/signal/`

- `nodeRegistry.ts` is half graph queries: five upstream walkers (`findUpstream`, `sourceBusOf`,
  `isMatrixSource`, `outputKind`, `mixBusOf`), the pass-through test
  `def.stereo !== 'follow' || def.inputs.length !== 1` copied 3×. Plus `upstreamOf`
  (`chainColors.ts`), the engine's `upstreamTypes`, two topological sorts (`topoSort`,
  `chainOrder`). → `src/graph/`: an indexed graph (byId / incoming / outgoing, built once per
  change), one `walkPassthrough()` generator, each query a few lines over it.
- What a wire carries is computed twice: `outputKind` (registry) and `WireSignal.kind` (engine);
  `WireKind` is declared in both files. The engine should take kinds from the graph module and
  compute only levels.
- Engine (`hooks/useSignalChain.ts`) → `src/signal/` (engine, health + `formatDb` /
  `healthColor` from `hooks/useGainStaging.ts`, which holds no hook; `utils/readout.ts` imports
  `taperToDb` from `hooks/` — layering inverted). `useGraphSignal` stays a small hook.
- 28 `(p.x as number) ?? default` reads repeat registry defaults and disagree (comp threshold
  `?? 0` vs −20, instrument `?? -10` vs −30). Params are always filled (`initialParams`,
  `parseChainFile`) → one typed `param(node, key)` reading the registry default. Same casts in
  the node components.
- `CompressorResult` ≡ `DeesserResult`; limiter / gate cast to `CompressorResult`; components cast
  `(result as { warning?: string })` / `{ domain?: string }` for fields already on the type.
  `StageResult` has 13 optionals. Target shape:
  `{ in: WireSignal, out: WireSignal, domain, inDomain, gainReductionDb?, condition? }` — also
  removes `inputDb` and simplifies `useStereoLevels`.
- Three copy-pasted pink-noise loops (EQ, graphic EQ, HPF) → one integrator in `eqMath.ts`.

## 4. Each node type described once

Today a type lives in ~15 places: `NODE_REGISTRY`, `nodeTypes` (`SignalChain.tsx`), `ALL_ITEMS`
+ `PALETTE_BY_LEVEL` (`ElementPalette.tsx`; its categories differ from the registry's; the level
lists are supersets → `minLevel`), `NO_BYPASS_TYPES`, `MULTI_WIRE_TYPES`, `MIX_BUS_TYPES`,
`SPLIT_TYPES`, `DYNAMIC_INPUT_TYPES` (`connectionRules.ts`), `LINKED_DYNAMICS` (engine),
`FREE_CONTROL_SIZE` + `CARD_MIN_BY_TYPE` (`layoutHelpers.ts`), `NAME_MAX_BY_TYPE`
(`OverviewFace.tsx`), the `computeGraphNode` switch and ~39 `typeKey === '…'` checks.

- `TypeKey` string-literal union instead of `string`.
- `NODE_TYPES: Record<TypeKey, NodeTypeDef>` — pure data + behaviour: ports, `minLevel`, `bypass`,
  `multiWire`, `splits`, `linked`, `analogOnly`, `process(ctx)`.
- `NODE_UI: Record<TypeKey, { component, icon, paletteGroup, freeSize? }>` — the type-checker
  then lists every table a new type still needs. Icons are chosen twice today (palette and each
  card); the jack-plug SVG is copy-pasted in `MicNode.tsx` and `ElementPalette.tsx`.
- Audio Interface's dynamic `in-1, in-2 …` ports are a second multi-input model
  (`BusInputPorts`, `DYNAMIC_INPUT_TYPES`, `customInputs` / `customInputCount` on `NodeWrapper`,
  the plugged-wires half of `portLayoutKey`, the engine's
  `ports.inputs.length > 0 ? … : Object.values(portInputs)` branch). Buses already do "one port,
  many wires".
- Update CLAUDE.md's "Adding a new node" checklist to match.

## 5. Break up the big components

- `SignalChain.tsx` (1,248 lines) → `useWireDrawing`, `useCanvasShortcuts`, `usePlaceGroup`,
  `ChainOpener`, `usePaletteDrop`, `CanvasOverlays`; target < 400 lines.
  - Wire state is local, mirrored into the store by an effect (`setWireSource`) and cancelled back
    by a store subscription → keep source + waypoints in the store, cursor local.
  - Reshape handles pass data through `data-*` attributes read back with `elementsFromPoint` +
    `parseInt` → give the circles their own `onPointerDown` (+ `lsc-overlay`).
  - Two `keydown` listeners with copy-pasted typing guards (a third in `FileMenu.tsx`).
  - Three identical viewport-aligned overlay `<svg>` wrappers → one `<ViewportLayer>`.
  - `onNodeDrag` / `onNodeDragStop` duplicate the overlap resolve; the start-wire object is built
    twice; `setTimeout(() => fitView(…), 50)` ×4.
  - `insertSlot` hard-codes the Matrix Bus rule → validate the two replacement wires with
    `nodeAcceptsWire` / `portAcceptsWire`.
  - `paletteWidth = paletteOpen ? (isTablet ? 64 : 240) : 0` duplicated in `App.tsx`.
- Dynamics graphs: `DynamicsCurve` / `LimiterCurve` / `GateCurve` (~100 lines each, same frame,
  axes, grid, operating point) → one `<TransferCurve transfer={…}>`, fed by transfer functions
  exported from the engine.
- Card shells: `NodeWrapper` and `FreeControl` repeat seven store subscriptions, ports, the
  "{node} input" badge and the chain stripe → `useNodeChrome()` + `<PortStack>` +
  `<WireTargetBadge>`. The "only re-renders when its chains change" comment is false (the same
  component subscribes to all `nodes` / `edges`). `NodePort` re-does the bus voltage sum.
  23 identical `XData extends Record<string, unknown>` interfaces; `data.typeKey` duplicates
  React Flow's `type`; `InlineNode` is a pass-through.
- Geometry: four `Pt` types, three rect shapes (`FlowNode` + `measured`, `Placed`, `NodeInfo`),
  three overlap tests, two routers (`elbowSegments` in `wireValidation.ts` re-implements
  `orthogonalRoute`), three unmeasured-size defaults (`nodeDims` ≥ 280×210 vs 160×120 in
  `wireValidation.ts` and `Tooltip.tsx`). Bug from it: `displayEdges` passes no sizes, so the
  crossing warning on committed wires tests 160×120 boxes. → `geometry.ts` + one
  `layoutSnapshot()`; layout helpers stop taking React Flow's `FlowNode`.

## Smaller items (fit into any step)

- Persistence: six setters each `localStorage.setItem('lsc-…')`; the level key is written in
  three places and also in the autosave → one persist subscriber with a key map.
- `activeTooltipId` + `activeTooltipTypeKey` always set / cleared together → one
  `help: { nodeId, key } | null`.
- Outside-click + Esc dismissal hand-written in 5 places (`UnplugMenu` re-implements
  `useLatestRef`); pointer dragging in 4 controls → `useDismiss`, `usePointerDrag`.
- `ChainEdge` infers overview from `strokeWidth > 3` — pass it in `data`.
- Display names: `nodeName()` (palette name first) and `helpTitle()` in `Tooltip.tsx` (card
  label first) disagree; `nodes` locale keys mix `activeSpeaker` / `graphicEq` / `master` with
  type keys.
- English shown to Bulgarian users (a separate suggestion may cover it — check `git log`):
  hard-coded — Audio Interface "N channels received" (and the Aux Bus's English plural `s`
  param), "LIMITING" / "PASS", the curves' "0 dB in", port tooltips taken from the registry's
  English port labels; and bg.json values that were never translated — the `warnings.*` domain
  texts, `nodes.di-box` (groundLift, description), Relay "In A / In B".
