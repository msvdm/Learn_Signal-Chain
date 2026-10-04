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

## 5. Break up the big components — first half done

### ~~`SignalChain.tsx`~~ — done

`SignalChain.tsx` went from 1,189 lines to 229: it puts the canvas hooks together, switches the
overview from the zoom, resets the camera on a blank canvas and holds the menus' state. The split,
adjusted where the code suggested it:
- `hooks/useWireDrawing.ts` — click-once wiring, the mouse-follow Select ↔ Connect switch,
  right-click cancel. `useSwallowClick` (same file) is the click stopped after a press the canvas
  used; the Remove tool uses it too, so it is shared, not inside the wiring.
- `hooks/useCanvasClicks.ts` (not planned) — the left-click tools: selecting (`onNodeClick`,
  `onNodeDragStart`, `selectFromBox`, `onPaneClick`) and the Remove tool, whose `pointerdown` was
  in the same capture handler as the wiring but shares only the swallowed click with it.
- `hooks/useNodeDrag.ts` (not planned) — drag ghosts and the drop of a card or a selection.
- `hooks/useGroupActions.ts` (planned as `usePlaceGroup`) — placing a copy is shared by duplicate,
  paste and an added chain, and the menus and keys take cut / copy / remove from the same place.
- `hooks/useCanvasShortcuts.ts` — Esc, the Ctrl / ⌘ keys and Delete in one listener.
- `components/ChainOpener.tsx` — the Replace / Add beside dialog, an offer onto an empty canvas,
  share links.
- `hooks/usePaletteDrop.ts` — drop preview, a tile dropped on the canvas or onto a wire, the cards
  making room once it is measured, a chain file dropped from the computer.
- `components/CanvasOverlays.tsx` — `ViewportLayer` (the one viewport-aligned `<svg>`), reshape
  handles, the wire being drawn, ghosts.
- `hooks/useFlowElements.ts` (not planned) — the React Flow nodes / edges and the measured sizes:
  100 lines that kept `SignalChain` over 400.
- Shared by them: `hooks/useCanvasLayout.ts` (`measuredNodes`, `layoutNodes`, `sizeOf`, `snap`,
  `dropOrigin`), `hooks/useFitView.ts` (`fitViewOptions` + `fitSoon`, which replaces the four
  `setTimeout(() => fitView(…), 50)`), `hooks/usePaletteWidth.ts`.

The sub-items:
- One owner for the wire being drawn: the store's `wire` (`{ source, start, waypoints }`,
  `startWire` / `addWireCorner` / `cancelWire`) replaces `wireSource`, the local `drawing`, the
  effect that mirrored it and the subscription that cancelled it — leaving Connect mode
  (`setToolMode('select')`, `NO_WIRE`) drops it in the store itself. Only the loose end (cursor,
  snap ring, crossing warning) stays in the hook. Cards read `wire.source`, the same object while
  corners are added, so they do not re-render on a corner.
- Reshape handles: their own `onPointerDown` and `lsc-overlay` (the wiring's `mousedown` skips
  overlays); no `data-*`, `elementsFromPoint` or `parseInt`. `useEdgeReshape` reads the store itself.
  The handles also stop their left-button `mousedown`, as the old document-level `stopPropagation`
  did: a header menu (File, language) left open stays open — as after a press anywhere on the canvas.
- Key guards: `typingInField` / `pressedInside` in `utils/shortcut.ts`, used by the canvas keys
  (Esc and the rest, now one listener) and the File menu. The checks stay as they were: canvas keys
  — not while typing, nor in a menu or `role="dialog"`; Esc — not while typing; File menu Ctrl / ⌘
  + S / O — not in a dialog (Ctrl+S in the palette search still saves).
- One `landing()` for both drag handlers, one `startFrom()` for starting a wire, `fitSoon()`.
- `usePaletteWidth()` with `PALETTE_WIDTH` / `PALETTE_RAIL_WIDTH`, which the palette itself uses too.
- `ChainEdge` reads `data.overview` (smaller item below).
- `SignalChain` re-renders on a zoom change (`useStore`), no longer on every pan.

Kept on purpose:
- Dropping a card onto a wire: the rule moved to `wireTakesCard()` in `utils/connectionRules.ts`,
  unchanged. Validating the two replacement wires with `nodeAcceptsWire` / `portAcceptsWire`
  instead would refuse drops accepted today. Compared on 1,600 random graphs (built through the
  connection rules and takeovers, with drops the old rule allows), every wire × every type: the
  same everywhere except, all accepted today and refused by the full check:
  - any card dropped on a Matrix send (a bus's or Main Fader's `send` → Matrix Bus): it goes in
    (send → card → Matrix Bus), a wiring the rules refuse by hand — a send feeds only Matrix Buses,
    and the card's output is no longer a mix;
  - a Relay or a Matrix Bus dropped between a mono Aux (straight or through effects) and a Matrix
    Bus — a Relay's output is not a mix (`passesThrough` is false), a Matrix Bus can't feed one;
  - any card dropped on a wire into a Matrix Bus that no longer carries a mix (left by one of the
    above, or its bus removed).
  A decision for later: refusing them is probably right (the card is then placed freely).

Found while testing, not fixed (the same in HEAD, checked side by side):
- The canvas keys (Delete, Ctrl+Z …) act while a confirm dialog has the focus — New, a level change,
  the open dialog: they are `role="alertdialog"`, which the guard does not list. Delete with
  "Start over?" open removes the selection.
- Dragging a reshape handle selects the "React Flow" attribution text (no `preventDefault`).

Checked in the browser with real clicks: wiring with corners, the snap ring, Esc / right-click
cancel, Ctrl+Z while drawing, the Select ↔ Connect switch, unplugging; dragging corners and
midpoints; dragging a card, a Ctrl+clicked selection and a card outside it; the Select tool's box
and toggle; the Remove tool on a control and a wire; drops on the canvas, onto a wire (preview and
slot, a Fader on a Master Bus's L becoming the Main Fader, a Matrix Bus refused on a mic wire and
accepted on a mono Aux's), the cards making room; copy / paste at the mouse / duplicate / cut /
Delete / select all / undo / redo, and none of them while typing in the palette search or the name
dialog; Open → Add beside / Replace, Insert a saved chain here, a file dropped on the canvas, a share
link with and without cards; overview in and out (hysteresis, wire width), show everything with the
palette open / hidden / as a rail, a reload with an autosaved canvas. The reshape handle and menu
behaviour was compared with HEAD running side by side.

### ~~Dynamics graphs~~ — done

`DynamicsCurve` / `LimiterCurve` / `GateCurve` are one `TransferCurve` (in `DynamicsLayout.tsx`),
fed by the transfer functions the engine now exports (`compressor`, `noiseGate`, `limiter` in
`signal/process.ts`, which `PROCESS` uses too): the curve and the dot come from the same maths as
the sound. The Limiter's flat-top line (`ceilingDb`) and the state word (`badge`) are props.
The leftover `tg?.… ?? 'English'` fallbacks on the Noise Gate are gone.

Checked old (HEAD) against new by rendering both to markup, 4,000 random settings per card (levels
including −∞, below −60, above 0 and exactly at the threshold): identical. Two differences, both
in what is drawn:
- The Limiter's LIMITING / PASS word is now drawn over the dot (as the Gate's word always was),
  where they meet in the top right corner (output about +16 dB and up).
- A bypassed Compressor fed above its threshold drew its dot at input + makeup, off the curve (it
  used the stage's gain reduction, 0 while bypassed); the dot is now on the curve, like the
  Limiter's and the Gate's always were when bypassed.

### ~~Card shells~~ — done

`NodeWrapper` and `FreeControl` read the same things through `useNodeChrome(id, typeKey)` (node,
ports, chain colours, selected or help open, overview, a wire that could land here) and draw
`<PortStack>` and `<WireTargetBadge>` (`components/nodes/NodeChrome.tsx`). The chain colours are
worked out in render, not in a selector joined into a string: the card re-renders on every graph
change anyway (it reads the ports from the wires), so the comment saying otherwise is gone. The
two stripes stay as they are drawn (a card's top edge; a bare control's bar under its name).
`NodePort` adds a bus input's wires with `sumSignalsToDb`. The 21 `XData` interfaces are one
`CardProps` (`components/nodes/cardProps.ts`); the canvas no longer hands cards a `color` nobody
read. `InlineNode` is gone (Line In, Pad, ADC / DAC use `NodeWrapper`).

Checked in the browser against HEAD running side by side: the same 27-element graph (every type,
stereo and mono, bypassed, selected, help open, a wire being drawn) gives the same DOM for every
element, zoomed out and in (meters caught mid-animation aside).

### ~~Geometry~~ — done

`utils/geometry.ts` holds the shapes (`Pt`, `Size`, `Box` = id + position + size, `Rect`) and the
tests (`rectOf`, `rectsOverlap` with a clearance, `segmentTouchesRect`); the other `Pt` / `Size`
copies, `Placed` and `NodeInfo` are gone. `useCanvasLayout().layoutSnapshot()` — the store's
positions with React Flow's measured sizes — replaces `measuredNodes()` (React Flow's nodes),
`layoutNodes()`, `placedNodes()` and the wiring's own card list; `resolveOverlap`, `enforceGap`,
`makeRoomForInsert`, `findEdgeAtPoint` and the copy offsets take `Box[]` (no `FlowNode`). The
crossing test walks `orthogonalRoute` (its `elbowSegments` copy is gone). `nodeDims` is the one
size fallback (the help popover and the crossing test no longer assume 160 × 120).
`useChainFile` takes its sizes from `useCanvasLayout().sizeOf`. The overlap comment that promised
MIN_NODE_GAP between cards now says what the test does: cards closer than MIN_NODE_GAP / 2 overlap.

Checked old (HEAD) against new on 3,000 random layouts (68,948 comparisons: grid and free
positions, measured and unmeasured cards, wires with and without corners, loops):
`resolveOverlap`, `enforceGap`, `makeRoomForInsert`, `findEdgeAtPoint`, the three copy offsets and
the crossing test on the same points — identical. In the browser, side by side with HEAD: a drop
onto a wire (the chain sliding right once the card is measured), Ctrl+D and a drop nudged clear of
other cards land in the same places; wiring with a corner by real clicks moves the target as before.

The bug, fixed: a committed wire's crossing warning tested the cards as 160 × 120 boxes, and only
its corners — from the first corner to the last, with a 40px exit that is not drawn there, so a
wire with one corner was never checked. It now tests the wire as it is drawn, port → corners →
port, against the real sizes: the same test as while it was being drawn. Kept: a wire without
corners never gets the warning once committed (the preview still warns while drawing it).

### Still to do


## Smaller items (fit into any step)

- ~~Persistence: six setters each `localStorage.setItem('lsc-…')`; the level key is written in
  three places and also in the autosave → one persist subscriber with a key map.~~ — done:
  `SETTING_KEYS` (store field → key) and one subscriber that writes a setting when it changes; the
  setters only set. Reading goes through `stored()`, and both sides survive a browser that keeps
  nothing (a write used to throw inside the setter, so the setting did not change either). The
  autosave keeps its own key (`lsc-canvas`, which carries the level of the chain it holds).
- ~~`activeTooltipId` + `activeTooltipTypeKey` always set / cleared together → one
  `help: { nodeId, key } | null`.~~ — done (`setHelp`, `HelpOpen`).
- ~~Outside-click + Esc dismissal hand-written in 5 places (`UnplugMenu` re-implements
  `useLatestRef`); pointer dragging in 4 controls → `useDismiss`, `usePointerDrag`.~~ — done.
  `useDismiss` closes the right-click menus, the unplug list (capture phase, Esc) and the File and
  language menus (bubble phase, no Esc — as before: Esc there would also reach the canvas keys).
  `ConfirmDialog` keeps its own: it is modal (backdrop press, Esc in the capture phase, stopped).
  `usePointerDrag` + `takePress` serve the Knob, the Fader, the Graphic EQ sliders and the EQ
  curve's dots; the latest move handler is always used (the knob and fader re-subscribed on prop
  changes, the Graphic EQ kept a latest-ref by hand). Differences: the EQ dots follow window
  listeners instead of pointer capture (so another dot under the pointer can light up while one is
  dragged — the dragged one stays on top), and every drag also ends on `pointercancel`.
  Checked with real mouse drags: knob, fader cap and track click, a Graphic EQ slider dragged
  sideways (stays on its band), an EQ dot (and its cursor after release), a right-click on a knob;
  each popup closing on an outside press / Esc; the File menu closing on a canvas press, as in HEAD.
- ~~`ChainEdge` infers overview from `strokeWidth > 3` — pass it in `data`.~~ — done (step 5)
- ~~Display names: `nodeName()` (palette name first) and `helpTitle()` in `Tooltip.tsx` (card
  label first) disagree; `nodes` locale keys mix `activeSpeaker` / `graphicEq` / `master` with
  type keys.~~ — done. One rule, `nodeName()`: its own label, else `titleOf(role or type)` = the
  card name, else the palette name. The cards take their names from it (`useNodeName`; each
  card's own expression is gone, and so is React Flow's `data`), and so do the help popover
  (title, "Next: …"), the unplug list and the Matrix Bus rows. `nodes` is keyed by help key: type
  keys plus `preamp`, `main-fader`, `balance` (`graphicEq` → `graphic-eq`, `activeSpeaker` →
  `active-speaker`, `master` → `master-bus`). Gone, unused: `theory.master` (an older Master Bus
  text; help opens `master-bus`), `pan.balanceLabel` (= `balance.label`), `mic.sensitivity` /
  `micInfo`, `eq.curvePreview` / `openCurve`, `fader.unity`, the Master Bus and Speaker status
  texts, `balance.left / right / centerLabel`, `app.settings`, `palette.elements`.
  Checked: the old per-card expressions against the new rule for every type and role, in both
  languages at every level — the same everywhere but one fix: bg "Активен Говорител" →
  "Активен говорител" (like its palette name). What changed is what the lists say, now as on the
  cards: en "High-Pass Filter" → "HPF", "Pad (−20 dB)" → "Pad", "Pan / Balance" → "Pan",
  "Speaker (passive)" → "Speaker / Monitor" (bg likewise, and "Графичен еквалайзер/ GEQ" →
  "Графичен еквалайзер", also in the popover's title).
  Found, not changed: the engine sets `digitalToAmp` / `digitalToSpeaker` (a digital signal into
  an Amplifier or speaker: silent), and `warnings.*` has their texts, but no card shows them — the
  Amplifier and the speakers just go quiet. The ADC / DAC and the buses do show theirs.
- ~~English shown to Bulgarian users~~ — done. Into the locales: the Limiter's state word
  (`limiter.limiting` / `pass`, still drawn in capitals), the curves' axis ("0 dB in",
  `meters.axisIn`), the Pad's button (`pad.on` / `off`, already there), the Switch and DI Box
  ON / OFF (`nodeControls.on` / `off`), the ADC / DAC "● Digital / Analog out"
  (`meters.digitalOut` / `analogOut`), the Relay's "In A / B" (`relay.input`), the Aux Bus count
  (`channels` / `channelsOne` instead of an English plural `s`), and every port tooltip (`ports`,
  with `byType` for the DI Box, Relay, ADC and DAC; `portName()` in `utils/nodeName.ts` — the
  registry's English port labels are gone, a port is just its id). Translated in bg.json: the
  `warnings.*` texts, the DI Box's ground lift ("Изолация на земя", as its help text calls it)
  and description. Gone: the EQ's `'Lo-Mid'` fallback and the unused `eqCurve` texts. English
  reads as before everywhere. Checked in the browser: the whole Advanced palette on one canvas
  in Bulgarian — no English text or tooltip left on the cards, header or palette (units and
  names like HPF, XLR, Aux aside) — and the longer words fit ("ИЗКЛ" on the Switch,
  "ОГРАНИЧАВА" on the curve).
  Found, not changed: the Relay's help text (`theory.relay`, both languages) describes one input
  switched between two outputs ("Output A or Output B"); the card picks one of two inputs and has
  one output. It needs rewriting, which is a teaching decision.
