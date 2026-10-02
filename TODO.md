# TODO

Roadmap for Learn Signal Chain. Work top to bottom; tick items off as they land.

---

## Stage 1 — Finish the "Studio Canvas" redesign (session of 2026-10-02)

The redesign from the Claude Design handoff (`design_handoff_studio_canvas/README.md`) is
committed on branch `studio-canvas` (e3bb697). Type-check is clean; `eslint .` reports 9 problems,
all the existing "ref written during render" / "setState in effect" pattern (master had 13).

What is in it:

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

- [ ] **Manual test with a real mouse** — see "Finish" under Stage 2 (one pass covers both).
- [x] Review the diff and commit — branch `studio-canvas`, commit e3bb697.
- [x] Update `CLAUDE.md` — done after Stage 2 (interaction model, header, card shell, level
      table, key files, React Flow notes).
- [ ] Optional cleanup — not imported / not used anywhere:
      `src/components/SignalLevelProfile.tsx`, `src/data/theory.ts` (help text now lives in the
      locale JSON files), CSS classes `.lsc-value` / `.lsc-value-sm` in `index.css`.

---

## Stage 2 — Simplify the canvas (requested 2026-10-02) — done, second commit on `studio-canvas`

### 1. Always start from a clean canvas — remove the ghost "start here" cards

- [x] Delete the empty-state guide: `src/components/EmptyState.tsx` (`EmptyStateGuide`,
      `ShortcutsCard`) and `src/utils/emptyStateLayout.ts`.
- [x] `SignalChain.tsx`: remove the `emptyLayout` / `masterRect` / `waitingForMaster` block, the
      framing effect, `<EmptyStateGuide>` and `<ShortcutsCard>`. Default view: an empty canvas
      resets to `{ x: 0, y: 0, zoom: 1 }` (start, Reset, level change, last node removed).
- [x] Remove the `emptyState` block from `en.json`, `bg.json` and the `Translations` type
      (incl. `fixed` / `fixedHint`).
- [x] ~~Ask whether the palette's "Start here" badge should also go~~ — **keep it** (user
      decision). `useChainEmpty` stays and now means `nodes.length === 0`.

### 2. Remove the Move / Connect / Snap / Zoom toolbar — modes switch automatically again

The app follows the mouse: hovering a port switches to connect mode; moving away (after ~200ms,
and only when no wire is being drawn) switches back.

- [x] Delete `src/components/CanvasToolbar.tsx`; `ConnectingToast` moved to
      `src/components/ConnectingToast.tsx`.
- [x] Restore the proximity auto-switch (from `a7a2bc2`), merged into the `onMove` effect.
      Also: no switching while a mouse button is held (node drag, slider, pan).
- [x] Keyboard: V / C removed. **Esc** cancels a wire, otherwise closes help.
- [x] Zoom: mouse wheel / trackpad, plus **React Flow `<Controls>`** (user choice) — zoom in /
      out / fit, bottom-left, themed, labels translated via `ariaLabelConfig`.
- [x] i18n: removed `toolbar.move`, `toolbar.connect`, `toolbar.moveHint`, `toolbar.connectHint`,
      `toolbar.zoomReset`. Kept `zoomIn` / `zoomOut` for `<Controls>`; added `toolbar.zoom` and
      `toolbar.zoomFit`.
- [x] `index.css`: `.lsc-overlay` still needed (help popover); nothing else orphaned by this.
- [x] Fixes found while restoring auto-switch (both were already broken at `a7a2bc2`):
  - A port's × (remove its wires) only showed in Move mode, but hovering a port switches to
    Connect — so it never appeared. It now shows whenever no wire is being drawn.
  - Wire reshape handles only rendered in Connect mode, so they were unreachable. They now
    render in either mode (Intermediate / Advanced) and are grabbed before the mode check.

### 3. Move the Snap to grid switch into the header, left of the theme button

- [x] `App.tsx`: switch (`Grid3x3` icon, label, 30×18 pill, `role="switch"`) first in the
      right-hand group, before Light / Dark. State: `snapToGrid` / `setSnapToGrid`.
- [x] Behaviour unchanged: on = snap to `GRID` + dotted background; off = free placement, no dots.
- [x] The text label hides below 1200px (`WIDE_HEADER_QUERY`) — with it the header overflowed at
      tablet width (Bulgarian needs ~1165px). Icon, switch and tooltip stay.

### 4. Remove the "Master Bus in the middle" rule — blank canvas, no position restrictions

- [x] `src/data/levels.ts`: `buildDefaultGraph()` returns `{ nodes: [], edges: [] }` for every
      level (no level argument any more); `MASTER_BUS_DEFAULT_ID` gone.
- [x] Deleted `src/data/zoneConstants.ts`; `MIN_NODE_GAP` moved into `layoutHelpers.ts`.
- [x] `layoutHelpers.ts`: removed `snapOutOfCenter`, `shiftNodesLeft`, `shiftNodesRight`,
      `pushUpstream` and `BUS_TYPES` (`pushDownstream` now moves buses like any other node).
- [x] `SignalChain.tsx`: drag-over / drop / node drag use the plain `dropOrigin` → `resolveOverlap`
      path (fixes cards overlapping in Intermediate / Advanced); mid-chain insertion keeps only
      "right of source, push downstream"; zone divider `<svg>` and the `draggable: false` rule
      for `master-bus` removed.
- [x] `NodeWrapper.tsx`: `isFixed`, the Lock "Fixed" chip and the `Lock` import removed; Master
      Bus is removable (still no bypass).
- [x] `signalStore.ts` → `removeNode`: Master Bus guard removed.
- [x] `ElementPalette.tsx`: `'master-bus'` added to Intermediate and Advanced.

### Finish

- [x] `npx tsc -b` and `npx eslint .` — no new problems (same 9 as Stage 1); `vite build` OK.
- [ ] **Manual test with a real mouse** in all three levels, light and dark, English and
      Bulgarian, and at tablet width (≤ 1024px): drop, drag a node, draw a wire with bends,
      right-click / Esc to cancel, delete a wire from a port's ×, drag a bend handle, Bypass /
      Remove from the mini-toolbar, help Previous / Next, zoom controls.
      Already checked with synthetic events: drop without overlap, Master Bus drop + remove,
      hover-port auto-switch and revert, wire with a bend, port ×, reshape in Move mode,
      mid-chain insert, Esc, Reset → 100%, Snap switch, Bulgarian zoom labels, header widths
      1024 / 1040 / 1199 / 1200 / 1280.
- [x] Update `CLAUDE.md` — interaction model, level system (no fixed Master Bus), card shell,
      header controls.

---

## Follow-ups noticed (not started)

- [ ] Drops onto a crowded spot drift diagonally: `resolveOverlap` alternates +36px down /
      +36px right until clear, so a node can land well away from the cursor. A nearest-free-slot
      search (rings around the drop point) would feel better.
- [ ] `displayNodes` in `SignalChain.tsx` is rebuilt without `measured` on every store change, so
      React Flow re-measures (and briefly hides) every card on each slider move. Passing the last
      measured size through (or applying `dimensions` changes) would avoid the extra work.
