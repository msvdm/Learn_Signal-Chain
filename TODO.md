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

Found while testing, fixed after: switching a stereo Aux with a Main Fader and a Graphic EQ after
it to Mono and back to Stereo moved the Matrix send onto the Graphic EQ (`attachMainFaders` turned
the fader's `out` wire to the matrix into `out-l`, which then followed L / R to the EQ). The
"L / R into a Matrix Bus = Matrix send" rule now runs before every takeover. Also fixed: a mono
Aux → Graphic EQ / Amp → Matrix Bus switched to Stereo left the send on the EQ / Amp (which
`isMatrixSource` does not allow); it now goes back to the Aux, or its Main Fader.

## ~~3. `src/graph/` and `src/signal/`~~ — done

`src/graph/graph.ts`: `graphOf()` (node / wires-in / wires-out lookups, indexed once per change of
the store's arrays), `drivingWire`, one `walkPassthrough()` generator (`passesThrough()` in the
registry replaces the 3 copies of the test), `upstreamOf`, `fedBy` (replaces the engine's
`upstreamTypes`), one topological sort (`flowOrder`; `chainOrder` is built on it).
`src/graph/queries.ts`: `WireKind` (declared once), `outputKind`, `getPorts`, `splitsStereo`,
`mixSourceOf` / `mixBusOf`, `sourceBusOf`, `isMatrixSource`, `matrixSendKey`, `preampMicOf` — each
a few lines over the walks. The registry keeps type-level data only.
`src/signal/`: `engine.ts` (traversal; takes wire kinds from `outputKind`, works out levels only),
`process.ts` (`processSide`: one channel through each type), `levels.ts` (health, `formatDb`,
`healthColor`, `sumSignalsToDb`, `taperToDb`), `eqMath.ts` (moved from `components/controls/`, one
pink-noise integrator). `hooks/useGraphSignal.ts` is the small hook; `useGainStaging.ts`,
`useSignalChain.ts` and `utils/chainOrder.ts` are gone. `StageResult` is now
`{ in, out (WireSignal), health, domain, inDomain, gainReductionDb?, condition?, role? }` —
`inputDb`, `portSignal` (= `levelOf(wire)`), `portOutputs` (never set), `CompressorResult` /
`DeesserResult` and the components' casts are gone; `helpKeyOf` reads `stage.role` (moved to
`utils/nodeName.ts`). Settings: `param(node, key)` typed by `ParamTypes`, the type's default when
unset; cards use `useParams(id, typeKey)`.

Checked old (HEAD) against new on 6,000 random graphs (92,661 states, built through the real
connection rules and takeovers): ports, every query, takeovers, `withStereo`, help keys, chain
order and every level, health, domain, gain reduction and condition are identical. Two differences,
both in what a wire is labelled as, where the old engine disagreed with the port layout:
- A Graphic EQ / Amplifier with nothing plugged in keeps its L / R outputs (so re-plugging restores
  them). Its outputs now show L / R letters and its Mix wire a twin line, and the cards after it
  stay stereo (an Amplifier keeps its two volume knobs) — all silent. Before, they turned mono
  until it was plugged back in.
- A Fader fed one side of a two-channel Amplifier through an effect (Amp R → Pad → Fader) counts
  as a Main Fader (`mixSourceOf` walks through side wires) and shows L / R. Its L output used to be
  labelled R (both outputs carried the side it was fed); now L is L.

Found while testing, not fixed (behaviour kept): the Main Fader-through-a-side-wire case above.

Found while testing, fixed after: removing a card in a two-card loop (A → B → A) made `withoutNode`
join its wires into a wire from A to itself — A went silent, and removing A later left a wire to a
card that was gone. `withoutNode` no longer joins wires that would start and end on the same card.

## ~~4. Each node type described once~~ — done

`TypeKey` (in `data/nodeRegistry.ts`) is the union of every type; `SignalNode.typeKey` is typed by it
(`isTypeKey()` checks a string from a file or a palette drag). A type is now described in five
tables keyed by it, so a new type missing from one does not compile:
- `NODE_REGISTRY: Record<TypeKey, NodeTypeDef>` — what it is. The type sets became fields:
  `minLevel` (was `PALETTE_BY_LEVEL`; `availableAt()`), `bypass` (`NO_BYPASS_TYPES` / `canBypass`),
  `bus: 'mix' | 'matrix'` (`MULTI_WIRE_TYPES`, `MIX_BUS_TYPES`; `isBus` / `isMixBus`), `splits`
  (`SPLIT_TYPES`; `canSplit`), `linked` (`LINKED_DYNAMICS`), `dynamicInputs`
  (`DYNAMIC_INPUT_TYPES`), `freeSize` / `minSize` (`FREE_CONTROL_SIZE`, `CARD_MIN_BY_TYPE`).
  `stereo` is required. The def's own `typeKey` field is gone.
- `PROCESS: Record<TypeKey, Process>` in `signal/process.ts` — the old `switch`. Not a registry
  field: `data/` imports nothing from the app, and the maths needs `signal/`. "Analog only" and
  "a bus can't mix analog and digital" are wrappers (`analogOnly()`, `summing()`), not flags.
- `NODE_LOOK: Record<TypeKey, NodeLook>` in `components/nodes/nodeLook.ts` — icon, palette group,
  `headerSize`, `nameMax` (was `NAME_MAX_BY_TYPE`). Its order is the palette's (`ALL_ITEMS` is
  built from it). `NodeWrapper` draws the header icon itself (the `icon` prop is gone), the palette
  and the source / speaker faces use the same icons; the jack plug and HPF curve live once, in
  `icons.tsx`.
- `NODE_COMPONENTS: Record<TypeKey, …>` in `components/nodes/index.ts` — the old `nodeTypes`. A
  separate table because the cards import `NodeWrapper`, which reads `NODE_LOOK` (a cycle otherwise).
  Cards read their type from React Flow's `type` prop: `data.typeKey` is gone.
- The locales: `palette.items` and `theory` are typed `Record<TypeKey, …> & Record<string, …>`.

The Audio Interface keeps its numbered inputs (behaviour kept), but they now come from `getPorts`
like every other card's: `BusInputPorts`, `customInputs` / `customInputCount`, the plugged-wires
half of `portLayoutKey` and the engine's `inPort ? … : incoming` branch are gone (the engine works
on every wire in, the Relay on its selected input). Left: the `dynamicInputs` flag (`getPorts`,
`portAcceptsWire`) and the engine's per-side `in` for its L / R meters. Turning it into "one port,
many wires" like the buses would change what it looks like — numbered inputs are closer to a real
interface — so that is a decision for later, not a refactor.

Checked old (HEAD) against new on 1,400 random graphs (21,470 states, 4 seeds, many with several
wires into an interface, digital chains, linked stereo dynamics, mixed-domain buses): registry
fields, palette per level, initial params, sizes, ports, every query, connection rules (every
output to every card and input), takeovers, `withStereo` / `withoutNode`, chain order and every
stage and wire — identical. In the browser: palette (26 tiles, same order and icon sizes), every
card's header icon, the interface growing / reordering its inputs with real clicks, wires ending on
their ports, a drop onto a wire, overview faces.

One difference, in what was drawn: the Audio Interface's minimum height counted every wire plus
one, even when two wires share an input, so it kept room for ports it did not show; it now counts
the ports it shows (visible only with 4+ wires, some sharing an input).

Afterwards the Audio Interface was removed altogether: the app shows what happens inside the desk,
and an ADC already turns it into one. Gone with it: its card and texts, `dynamicInputs`, the
engine's per-side `in` for its meters, and inputs that depend on the wires (`getPorts` inputs never
change again; `portLayoutKey` reads outputs only). A saved chain that has one opens without it, with
the usual notice ("… elements were left out: this version of the app does not have them" — it
used to say they came from a newer version).

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
  23 identical `XData extends Record<string, unknown>` interfaces; `InlineNode` is a pass-through.
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
  hard-coded — the Aux Bus's English plural `s` param, "LIMITING" / "PASS", the curves'
  "0 dB in", port tooltips taken from the registry's English port labels; and bg.json values that were never translated — the `warnings.*` domain
  texts, `nodes.di-box` (groundLift, description), Relay "In A / In B".
