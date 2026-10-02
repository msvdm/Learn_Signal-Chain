# TODO

Roadmap for Learn Signal Chain. Work top to bottom; tick items off as they land.

---

## Stage 1 — Finish the "Studio Canvas" redesign (session of 2026-10-02)

The redesign from the Claude Design handoff (`design_handoff_studio_canvas/README.md`) is
implemented but **not committed**. Type-check is clean; `eslint .` reports 9 problems, all the
existing "ref written during render" / "setState in effect" pattern (master had 13).

What is in the working tree:

- `src/index.css` — dark + light token sets (`[data-theme]`), `--lsc-fg*`, `--lsc-track-2/3`,
  11px minimum node text, port / card / toolbar CSS.
- Store (`src/store/signalStore.ts`) — `theme`, `snapToGrid` (both persisted), `selectedNodeId`,
  `wireSource` (lets cards highlight valid inputs while a wire is drawn).
- Header (`src/App.tsx`) — level stepper, theme / language / Reset buttons, in-app
  `ConfirmDialog` instead of `window.confirm`. Bottom help drawer removed.
- Palette (`src/components/ElementPalette.tsx`) — search, tabs, 2-column tiles, tablet icon rail.
  "Structural" merged into "Routing".
- Unified card shell: `NodeWrapper.tsx` (+ `NodePort.tsx`, `InlineNode.tsx` is now a thin wrapper).
  Width follows content (no fixed widths), 56px header, ports at 28px, mini-toolbar for
  Bypass / Remove. Controls and In/Out meters kept; **no status chip** (user decision).
- Edges show a dB badge (`ChainEdge.tsx`); wire preview has rounded corners (`utils/wirePath.ts`).
- Help popover anchored under the node with Previous / Next in signal order (`Tooltip.tsx`,
  `utils/chainOrder.ts`). Title bug for `gain` fixed.
- `nodeOrigin` is now `[0, 0]` (top-left) everywhere; layout helpers updated.
- `useGraphSignal()` shares one computation across all callers (was recomputed per component).

### To do

- [ ] **Manual test with a real mouse** (palette drag-and-drop was only tested with synthetic
      events): drop, drag a node, draw a wire with bends, right-click / Esc to cancel, delete a
      wire from a port's ×, Bypass / Remove from the mini-toolbar, help Previous / Next,
      language switch, light / dark, tablet width (≤ 1024px).
- [ ] Review the diff and commit (branch first if preferred).
- [ ] Update `CLAUDE.md` — **after Stage 2**, so it describes the final behaviour. It still
      mentions the S / L shortcuts, 100px / 208px cards, `--node-text-md: 22px`, the help drawer,
      the Connect Tool and the `nodeOrigin [0, 0.5]` rule.
- [ ] Optional cleanup: `src/components/SignalLevelProfile.tsx` is not imported anywhere.

---

## Stage 2 — Simplify the canvas (requested 2026-10-02)

Do these in order — 4 removes most of the code that 1 and 2 touch.

### 1. Always start from a clean canvas — remove the ghost "start here" cards

- [ ] Delete the empty-state guide: `src/components/EmptyState.tsx` (`EmptyStateGuide`,
      `ShortcutsCard`) and `src/utils/emptyStateLayout.ts`.
- [ ] `SignalChain.tsx`: remove the `emptyLayout` / `masterRect` / `waitingForMaster` block and the
      effect that frames the outline with `setViewport`, plus `<EmptyStateGuide>` and
      `<ShortcutsCard>`. Give the canvas a sensible default view instead (e.g. `defaultViewport`
      at zoom 1, or `fitView` with `maxZoom: 1` once nodes exist).
- [ ] Remove the `emptyState` block from `en.json`, `bg.json` and the `Translations` type
      (check `fixed` / `fixedHint` are gone too — see item 4).
- [ ] **Ask the user** whether the palette's "Start here" badge on Microphone should also go
      (it is the same kind of hint). If yes: remove `START_ITEM`, the badge markup,
      `palette.startHere`, and delete `src/hooks/useChainEmpty.ts` if nothing else uses it.

### 2. Remove the Move / Connect / Snap / Zoom toolbar — modes switch automatically again

The user prefers the old behaviour: the app follows the mouse. Hovering a port switches to
connect mode; moving away (after ~200ms, and only when no wire is being drawn) switches back.

- [ ] Delete `<CanvasToolbar />` from `SignalChain.tsx` and the toolbar part of
      `src/components/CanvasToolbar.tsx`. **Keep `ConnectingToast`** (the "Connecting from …"
      message) — move it to its own file, e.g. `src/components/ConnectingToast.tsx`.
- [ ] Restore the proximity auto-switch effect that was deleted from `SignalChain.tsx`. The
      original is in git at `a7a2bc2:src/components/SignalChain.tsx` (the "Live cursor tracking +
      auto mode switching based on handle proximity" effect, with `revertTimerRef`). Merge it
      into the current `onMove` effect, which today only tracks the cursor while drawing.
- [ ] Keyboard: remove V / C (no modes to pick). Keep **Esc** to cancel a wire and close help.
- [ ] Zoom stays available via mouse wheel / trackpad. Decide with the user whether a small
      zoom control is still wanted anywhere (React Flow `<Controls>` would be the cheap option).
- [ ] i18n: remove `toolbar.move`, `toolbar.connect`, `toolbar.moveHint`, `toolbar.connectHint`,
      `toolbar.zoomIn`, `toolbar.zoomOut`, `toolbar.zoomReset` from both locales and the type.
      Keep `toolbar.snap` / `toolbar.snapHint` for item 3.
- [ ] `index.css`: `.lsc-overlay` is still needed (help popover); check nothing else is orphaned.

### 3. Move the Snap to grid switch into the header, left of the theme button

- [ ] `App.tsx`: add the switch (same look — `Grid3x3` icon, label, 30×18 pill switch,
      `role="switch"`) as the first button in the right-hand group, before Light / Dark.
      State is already in the store: `snapToGrid` / `setSnapToGrid`.
- [ ] Behaviour is unchanged: on = snap to `GRID` + dotted background; off = free placement,
      no dots.

### 4. Remove the "Master Bus in the middle" rule — blank canvas, no position restrictions

All levels start empty and every element can go anywhere.

- [ ] `src/data/levels.ts`: `buildDefaultGraph` returns `{ nodes: [], edges: [] }` for every
      level; drop `MASTER_BUS_DEFAULT_ID` and the `zoneConstants` import.
- [ ] Delete `src/data/zoneConstants.ts` (`MASTER_BUS_FLOW_POS`, `CENTER_LEFT_BOUND`,
      `CENTER_RIGHT_BOUND`, `getZone`). Keep `MIN_NODE_GAP` — move it into `layoutHelpers.ts`.
- [ ] `src/utils/layoutHelpers.ts`: remove `snapOutOfCenter`, `shiftNodesLeft`,
      `shiftNodesRight`, `pushUpstream`; check whether `BUS_TYPES` is still needed.
      Keep `resolveOverlap`, `enforceGap`, `pushDownstream`, `findEdgeAtPoint`.
- [ ] `SignalChain.tsx`:
  - `onDragOver` / `onDrop` / `onNodeDrag` / `onNodeDragStop`: drop all zone and bus special
    cases. Use the plain path everywhere: `dropOrigin` → `resolveOverlap`. This also fixes the
    known bug where cards dropped in the same column in Intermediate / Advanced overlap
    (the zone code only pushed nodes sideways).
  - Mid-chain insertion: remove the left / center / right `dropZone` branches; keep the
    "right of source, push downstream" behaviour.
  - Remove the zone divider `<svg>` and the `draggable: false` rule for `master-bus`.
- [ ] `NodeWrapper.tsx`: remove `isFixed`, the Lock "Fixed" chip and the `Lock` import;
      Master Bus becomes removable (no bypass — it stays in `NO_BYPASS_TYPES`).
- [ ] `signalStore.ts` → `removeNode`: remove the "master-bus can't be removed outside
      Beginner" guard.
- [ ] `ElementPalette.tsx`: add `'master-bus'` to the Intermediate and Advanced lists in
      `PALETTE_BY_LEVEL` and delete the "pre-placed, not shown in palette" comments.
- [ ] `useChainEmpty` (if kept after item 1) becomes `nodes.length === 0`.
- [ ] i18n: remove `emptyState.fixed` / `emptyState.fixedHint` (if not already gone with item 1).

### Finish

- [ ] `npx tsc -b` and `npx eslint .` — no new problems.
- [ ] Manual test in all three levels, light and dark, English and Bulgarian.
- [ ] Update `CLAUDE.md` (see Stage 1) — interaction model, level system (no fixed Master Bus),
      card shell, header controls.
