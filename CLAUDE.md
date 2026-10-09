# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The #1 Rule

**This app is for beginners in sound engineering.** Every label, warning message, and UI element must be understandable by someone who has never touched a mixing desk. Avoid jargon without explanation. Prefer plain English over technical accuracy when both are possible. If a concept needs a number (e.g. dB), always follow it with a plain-language consequence ("−60 dBu — very weak, too quiet to use").

## Commands

```bash
bun dev          # Start local dev server at localhost:5173
bun run build    # Type-check + production build → dist/
bun run lint     # ESLint check
bun test         # The tests (CI runs them on every push)
npm run test:node  # The same tests without Bun (Node 22.18 or newer)
bun run preview  # Preview the production build locally
```

**Tests** (written for `bun:test`) cover the pure code and lock today's levels: a change to the engine that moves an old chain's average fails them; a reading changed on purpose is updated in the table, with the reason in a comment. The render on real sound (`audio/measure.ts`), the moving meters and the UI have no tests (Web Audio does not run in Bun): check them in the browser. `npm run test:node` runs the same files with Node: `test/node-hooks.ts` resolves extensionless imports and swaps `bun:test` for `test/bun-test.ts` (a stand-in with only the matchers the tests use — add one there before using it). `tsconfig.test.json` type-checks the tests (part of `bun run build`); the app's build leaves them out.

- `src/signal/levels.test.ts` — the dB scale, a meter's colours and numbers, health with peaks, sums, dB SPL
- `src/signal/process.test.ts` — each card on one channel, the dynamics curves, the sources' peaks and noise
- `src/signal/engine.test.ts` — reference chains: every card's level, health, domain, condition, role and hum (`expectCards`); peak, average and noise (`expectReadings`: gain staging — D18 —, peaks, noise, the hum); the marks on a dynamics card's curve (`expectMarksLeave`). Lines marked `D9` put each reading through the curve
- `src/signal/measured.test.ts`, `moving.test.ts` — a render's readings and movement in the number engine's picture
- `src/audio/processors.test.ts` — the AudioWorklet's processors on plain blocks of samples
- `src/audio/meters.test.ts`, `sounds.test.ts` — the meters' movement (D10); the Generator's sounds and the hiss
- `src/utils/chainFile.test.ts` — what a source picks up, from today's files and older ones
- `src/graph/mainFader.test.ts`, `queries.test.ts` — L / R takeovers; `unwiredSource` (D11), `faderBusOf`

## Working on this project

**How the work goes** (the user's way of working):
- Work happens on `master`: the user is the only developer, so no branch for a piece of work (2026-10-06, the user's call) — only when they ask for one. Start with `git fetch` and check `master` is the remote's latest (a reused cloud container once started a session on a stale local branch); a session that finds itself on another branch (a cloud session's own) says so at the start, so its work doesn't end up off `master`. A piece of work: build it, `bun run lint` + `bun run build` + `bun test`, check it in the browser, update this file where it changed, commit — and tell the user what was done, the numbers measured, the choices made (to review) and what only they can check. One commit per step.
- **Push only when the user says so.** "Push" = push `master`: GitHub runs `.github/workflows/build-check.yml` (lint, test, build) and deploys nothing. "Push and release" = push, then the next version tag (`git tag v0.2.0 && git push origin v0.2.0` — see `git tag`, propose the number: v0.x.0 for features, v0.x.y for fixes; the first was v0.1.0): only a `v*` tag, or *Run workflow* in the Actions tab, runs `deploy.yml` to GitHub Pages (its `github-pages` environment allows `master`, `gh-pages` and `v*` tags). `package.json`'s version stays 0.0.0. Never tag on your own.
- **The user decides what the app teaches and how it looks.** When a decision is theirs — or real behaviour breaks the premise of one they made — ask, with a recommendation, before building around it (D8, D9 and D10 were asked that way, D11 with mock-ups). Their decisions are in `docs/decisions.md`: D1 … D19 in full (one line each below — the code cites them by number; a new one goes there in full, with its date) and *The user's smaller calls* (choices of look and feel: change one only when they ask).
- **Prefer what the browser already does** (Web Audio and the like) over homemade simulations, and say so up front; flag it early when a step's code grows far beyond its plan (decision D7 came from a 1,600-line homemade time engine).
- **Real sound can change a lesson**: measure, then rewrite the help text (en + bg) — never tune a processor to fit an old sentence. Every number a text quotes is checked against the number engine or a render (see below).
- **No new packages so far** (the Vite plugins are written here). CI installs with `bun install --frozen-lockfile`, so a package needs `bun.lock` updated in the same commit — ask the user first.
- **Keep this file short** (trimmed on 2026-10-09 at the user's ask — "a whole novel"): rules and pointers. What a file does belongs in its header comment, the numbers in the tests. The last long version, every card described, is `git show f24004a:CLAUDE.md`.

**Environment**:
- The dev app is at `http://localhost:5173/Learn_Signal-Chain/` (Vite's `base`, for GitHub Pages; `localhost:5173/` alone shows nothing). `bun run preview` serves the production build on port 4173 — the service worker and the one-file copy (`/Learn_Signal-Chain/learn-signal-chain.html`) exist only there.
- Remaking the loops (`python3 scripts/make-loops.py`, ~1.5 min) needs Python 3 with numpy and scipy, and ffmpeg with libmp3lame and the flite filter. Nothing else uses Python.
- **In a cloud session** (Claude Code on the web: Ubuntu 24.04, Node 22 on `PATH`, Bun installed but known to fail fetching packages through the cloud's proxy): install with `bun install --frozen-lockfile` (it has worked, and `bun remove` rewrites `bun.lock`); if that fails, `npm install --no-package-lock` (leave `bun.lock` alone, commit no `package-lock.json`). `bun test`, `bun run lint` and `bun run build` then need no network (`npm run test:node` needs Node 22.18 or newer — `node --version`). There is no browser pane, but a headless one works: Playwright and Chromium are installed globally (`createRequire('/opt/node22/lib/node_modules/')('playwright')`, `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`), so a script in the scratchpad can drive `bun dev` — build a chain through the store (the console tricks below), screenshot cards (`locator(…).screenshot()`, `deviceScaleFactor: 2` for close-ups), sample the moving meters, and run the render on real sound (OfflineAudioContext and AudioWorklet work headless). `reducedMotion: 'reduce'` on the page emulates the system setting; CDP's `Performance.getMetrics` gives the main thread's script / style / layout / task time. Its fonts (Inter, DejaVu Sans Mono) are close to, not the same as, the user's, and it paints in software. Keep the browser-only code thin, test what is pure, and leave the user an exact list of what only they can check (the step's *Left for the user*: their devices and fonts, how it feels), with what they should see.

**Checking in the browser** (the console tricks work in any browser):
- `await import('/Learn_Signal-Chain/src/store/signalStore.ts')` gives the live store: `useSignalStore.setState({ nodes, edges })` builds a chain (a node: `{ id, typeKey, position, params: initialParams(typeKey, level), bypassed: false }` — `initialParams` from `src/data/nodeRegistry.ts`; a wire: `{ id, source, sourceHandle: 'out', target, targetHandle: 'in' }`). After a hot reload the app runs `signalStore.ts?t=<time>`: import the URL it loaded (`performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('signalStore.ts'))`), or you get a second, empty store. `setState({ nodes, edges })` skips `commitGraph`: where a Main Fader, a Graphic EQ or an Amplifier must take L / R over, add the elements with the store's `addNode` / `addEdge` instead.
- Real sound from the console: `stillPicture(nodes, edges)` (`src/signal/engine.ts`) → `measureChain(still.plans, still.levels)` (`src/audio/measure.ts`) → `withMeasured(still.result, { at: still.result, ...m })` (`src/signal/measured.ts`) is what the cards show. Time a render with `performance.now()` around `measureChain` (desktop, dev build: ~30 ms for a 4-card chain, ~130 for a channel strip, ~1.4 s for a 75-card chain).
- Wiring needs real mouse events (mousedown → mouseup → click: a dispatched event misses the bug class "the click after the press undoes it"); hover a port ~0.4 s first — Connect mode comes on hover. A palette drop can be dispatched: `dragover` + `drop` events with a `DataTransfer` holding `application/lsc-node-type`.
- The production build and the one-file copy cannot import modules: open a chain there with a share link made in the dev app (`encodeChain(toChainFile({ nodes, edges, outEdges: [], sizes: {} }, name, level))` from `src/utils/chainFile.ts` → `…#chain=<encoded>`) and read the cards' text.
- To try a processor idea outside the browser, decode a loop (`ffmpeg -i src/audio/loops/speech.mp3 -f f32le -ac 1 -ar 48000 speech.f32`), skip 12000 samples (`PAD_S`), take 480000 (one loop), and run a copy of the processor on it with Bun.
- Editing the locales by script: `json.load` + `json.dumps(indent=2, ensure_ascii=False)` + a final newline round-trips both files except `levelNames.intermediate`, written on one line — put it back (or replace the text in place).
- A refactor that must change nothing: snapshot HEAD's `src` (`git archive HEAD src | tar -x -C <dir>`) and compare old and new engine results over many random graphs built through the connection rules; tag graphs with wires the app forbids — they explain most differences.

## Architecture

The app is a **pure client-side React SPA** — no backend, no API calls. The signal is worked out in the browser twice: at once by the number engine (arithmetic on levels, `src/signal/`), and a moment later by a silent render of the chain on real sound (Web Audio in an OfflineAudioContext, `src/audio/`), whose readings the cards show (D9). The render also records how every card's signal moves over its loop, and from Intermediate the meters play that back (D10).

Layers: `data/` (types, registry) ← `graph/` (pure queries, edits and wiring rules) ← `signal/` (pure maths) ← `audio/` (Web Audio: the render on real sound; its processors and the sounds made in code are pure) ← `hooks/`, `store/`, `components/`. Nothing in `graph/`, `signal/` or `audio/` imports React or the store; `utils/` (layout, files, text helpers) never imports the store.

### Data flow (read this first)

```
signalStore (Zustand)
  ├── nodes[] + edges[]  (graph model — user-built, freely positioned)
  │     ├── src/graph/   what the wiring makes of it: ports, what each wire carries, Main Faders, Preamps …
  │     └── src/signal/  the number engine: walks the graph in signal order, the levels at every card / wire
  │           ├── chain.ts      planChain(): what the wiring makes of each card (once per change); runChain(): its levels
  │           └── engine.ts     stillPicture(): plan + levels at once, on every change · graphSignal(): that picture with
  │                 │           the last render's readings put in (signal/measured.ts) — shared by every card
  │                 └── useStage(id) / useWire(key): each card reads only its own result
  └── measured  ← store/measuring.ts: once a change has settled, the chain is rendered on real sound
                  (src/audio/: the same plan as Web Audio nodes, our processors in an AudioWorklet, the loops)
                  and every card measured — peak, average, noise, hum — and how it moved over the loop
                    └── hooks/useLiveMeter.ts: one animation loop, outside React, plays that movement back
                          into the meters, the turning-down bars and the curves' marks (30 pictures a second)
```

Every slider change → updates `signalStore` → the number engine recomputes at once and the readings move by its step from the last render → 100 ms after the last change a render starts; when its readings arrive (~30–500 ms on desktop) they replace the step → the cards and wires whose own reading changed redraw; the rest are left alone. There is no local component state for signal values.

**Redraw only what changed** (the canvas must stay smooth at 100+ cards, and later at 60 updates a second):
- The engine hands back last time's stage / wire object when a result came out the same (`keepUnchanged`, `utils/sameShape.ts`), so "did my reading change?" is one comparison.
- Cards never read the whole graph: `useStage(id)`, `useWire(key)`, `useParams`, `useNodeName`, `useNodeChrome` and `NodePort` each select only their own piece from the store (zustand selectors; `useShallow` for small arrays). A new hook for cards must do the same — a selector over `s.nodes` / `s.edges` as a whole redraws every card on every change.
- `useFlowElements` hands React Flow last time's node / wire object when nothing about it changed (`keepSame`), and everything `SignalChain` passes to `<ReactFlow>` is stable (`useStableHandlers`, module constants): React Flow passes its node handlers on to every card, so one new function per render redraws them all.
- **Movement never goes through React.** The live loop (`hooks/useLiveMeter.ts`) calls each meter's painter 30 times a second, only while the meter is on screen (an IntersectionObserver) and not hidden (a card body zoomed out, a face zoomed in); a painter writes the moving part's own `transform` / `opacity` (one element: nothing else is styled again), and only a change (`paintStyle`, `components/meterPaint.ts`). Writing CSS variables on a meter's box instead cost ten times as much (each restyles everything in it).

### Key files

- `data/nodeRegistry.ts` — `TypeKey` and `NODE_REGISTRY`, the one source of truth for what a type is; `param(node, key)` reads a setting typed, its default when unset (never write `(params.x as number) ?? …`). Type-level only: what reads the wires is in `graph/`
- `data/levels.ts` — the levels, `atLeast`, `DETAIL_LEVEL` (D3)
- `graph/graph.ts` — the graph with lookups (`graphOf`, built once per change) and its walks
- `graph/queries.ts` — what the wiring makes of a card: `outputKind`, `getPorts` (pass the graph: ports are read from the wires), the Preamp, guitars and DI Boxes, `unwiredSource` (D11), `faderBusOf`
- `graph/edits.ts` — pure graph edits (`newEdge`: the one way to make a wire)
- `graph/mainFader.ts` — the L / R takeovers and the Matrix send
- `graph/connectionRules.ts` — which inputs may take a wire; `wireTakesCard` (a card dropped onto a wire)
- `signal/chain.ts` — `planChain` (what the wiring makes of each card, in signal order: the render works from it too) and `runChain` (their levels)
- `signal/engine.ts` — `stillPicture` (plan + levels) and `graphSignal` (with the last render's readings in); `StageResult`
- `signal/process.ts` — one card on one channel (`PROCESS`), a card's own noise (`ownNoiseOf`, D18), the sources' sounds, the dynamics curves, `StageCondition`
- `signal/levels.ts` — the dB scale, health, the meters' zones and numbers, `SideLevels`
- `signal/measured.ts`, `signal/moving.ts` — a render's readings and movement in the number engine's picture (D9, D10)
- `audio/chainAudio.ts` — the plan as Web Audio nodes; `processed()` is each card on real sound
- `audio/measure.ts` — `measureChain`: two renders (the music; the quiet: noise and hum), every card measured, its movement recorded
- `audio/processors.ts` — the AudioWorklet's dynamics and meter as plain functions (it imports nothing: its text goes to the worklet)
- `store/signalStore.ts` — all mutable state. **Every graph change goes through `commitGraph`**: it settles the L / R takeovers and drops what points at what is gone; undo / redo restore a snapshot as it was
- `store/measuring.ts` — when the chain is rendered (once nothing has changed for 100 ms; one render at a time)
- `hooks/useGraphSignal.ts` — `useStage(id)` / `useWire(key)` for cards; `useGraphSignal()` (the whole result) only for one-off components; every caller passes `measured`
- `hooks/useLiveMeter.ts` — the one animation loop playing the meters' movement
- `hooks/useFlowElements.ts` — the graph as React Flow's nodes and edges
- `hooks/useWireDrawing.ts`, `useCanvasClicks.ts` — wiring and the mouse-follow Select ↔ Connect switch; what a left-click does
- `hooks/useStableHandlers.ts` — handlers that never change identity (for React Flow); `useLatestRef.ts` — the latest value for listeners (synced in a layout effect: never assign `ref.current` during render)
- `components/SignalChain.tsx` — the React Flow canvas; `CanvasOverlays.tsx` — what is drawn over it (`ViewportLayer`)
- `components/nodes/index.ts` — `NODE_COMPONENTS` (each type's card); `nodeLook.ts` — `NODE_LOOK` (icon, palette group; its order is the palette's)
- `components/nodes/NodeWrapper.tsx` — the card shell; `FreeControl.tsx` — the bare controls' shell; `OverviewFace.tsx` — the zoomed-out face; `MeterSides.tsx` — meters at a card's sides
- `components/SignalMeter.tsx` — the meters; `meterPaint.ts` — their painters
- `components/controls/StableText.tsx` — a reading that keeps the width of its widest value
- `utils/layoutHelpers.ts` — canvas placement maths on `Box`es (`cardMinSize`, `PORT_TOP`, `PORT_GAP`, `PORT_REACH`)
- `utils/chainFile.ts` — the saved-chain format; `utils/nodeName.ts` — an element's name and help key wherever it is shown
- `i18n/locales/en.json`, `bg.json` — all text, and the help popover's (`theory`: `what`, `why`, `tip`); `i18n/translations.ts` types it from `en.json`, so `bg.json` must have every key (the build fails otherwise)
- `vite-offline.ts` (below), `vite-worklet.ts` (`?worklet`: a file's code as a string — the file must import nothing), `scripts/make-loops.py` (the loops; deterministic: run it again after a change)

### Offline (no extra packages)

`vite-offline.ts` (a Vite plugin, build only) adds `sw.js` (a service worker keeping every file of the build: after one visit the site opens with no internet, and browsers offer to install it — `public/manifest.webmanifest`) and `learn-signal-chain.html` (`OFFLINE_FILE`: the whole app in one file, the loops inlined as data: URLs; File → *Download the app…* saves it; double-clicked, it runs from disk). The build fails if the bundle ever has more than one script chunk, a stylesheet loads a file (`url(…)`) or the script loads a file of `assets/` it does not hold — the one-file copy could not have them. A copy running from disk hides *Download the app* and makes share links point to `ONLINE_URL`. The dev server registers no service worker: test the offline parts with the `preview` launch config.

### Interaction model (SmartDraw-style)

The canvas works like a drawing app and **follows the mouse** — there is no mode toolbar and no mode keys:
1. **Palette** (`ElementPalette`): slides **over** the canvas, so nothing on it moves when it opens. A tile lands where it is dropped (cursor on its port line), nudged only to avoid overlap; dropped onto a wire, it goes in mid-chain when both new wires could be drawn by hand (`wireTakesCard`), and the rest of that chain slides right.
2. **Select mode** (`toolMode: 'select'`): a left-click follows the left-click tools (`CanvasTools`: Drag — the default —, Select, Remove). **Selecting is ours, not React Flow's** (`useCanvasClicks`): a press that started on a control or port (`INTERACTIVE`, judged at `pointerdown`) or that moved never selects, and dragging never selects.
3. **Connect mode** (`toolMode: 'connect'`): on while the cursor is over a port, off as soon as it leaves all ports — never while a wire is being drawn or a mouse button is held. Wiring is **click-once, pen-tool style, never drag** (`useWireDrawing`): click an output, click empty space for corners, click a highlighted input; right-click or Esc cancels.
4. **Unplug**: a connected **input** turns into a red × on hover; click it. Outputs never do: clicking an output always starts a new wire, so one signal can feed several inputs.
5. **Esc** cancels a wire in progress, otherwise closes the help popover, otherwise drops the selection.
6. **Overview**: zoomed out below 42% (back above 50%), cards show their name and the level leaving them; wiring, dragging and unplugging work as usual.
7. **Right-click menus** (`NodeMenu`, `CanvasMenu`) hold help, bypass, cut / copy / paste, duplicate and remove — there are no ? or × buttons on the elements. Keys (`useCanvasShortcuts`) never act while typing in a field (`typingInField`) or in an open menu or `role="dialog"`.

Every level starts from a **blank canvas** at 100% zoom (also after New, a level change or removing the last node): no preset layout, no fixed Master Bus, no position restrictions. The header (level stepper, Snap to grid, theme, language, the File menu) fits from 1024px up in English and Bulgarian.

**Save / Open**: one format everywhere, `ChainFile` (`utils/chainFile.ts`) — the autosave (`localStorage` `lsc-canvas`), `.json` files, pictures (the chain inside the PNG), share links (`#chain=…`). `parseChainFile` keeps only what the app can show: unknown types left out (and counted), saved params over `initialParams()`, a wrong value back to the default, older words read as today's (`OLD_WORDS`).

### Cards

- Every card uses `NodeWrapper`. **Gain, Pan, Fader, Switch and Pad are not cards**: bare controls with their ports (`FreeControl`, a `freeSize` in the registry), the same at every zoom.
- **One size per card, at every level**: the registry's `minSize` (`cardMinSize()`); the content grows into it, in Bulgarian too. **A card never changes size while values change** (no flicker): wrap every changing reading in `StableText`, which reserves the width of its widest value (`LEVEL_SAMPLE`, `widestFormat()` in `utils/readout.ts`); text that only sometimes shows keeps its space (`visibility: hidden`). `KnobControl`, `VerticalFader`, `ControlSlider` and the meters already do this.
- **Wires between cards stay straight**: a fixed 56 px header, the first port line at `PORT_TOP`, stacked ports `PORT_GAP` apart (a later line: `row` in the registry). A free-standing control's port line is at `PORT_TOP` too — one lower than that reaches above its box rather than taking a negative padding.
- The header is icon · title · On/Off (none where the control itself is the state: `bypass: false`). Help and Remove are in the right-click menu; no status chip.
- **Face-only cards** (`faceOnly`: Instrument, Guitar Amp, Speakers, Headphones; the Relay Switch draws its own face, `ownFace`): a big icon with its buttons or knob and its meter (D13); what is wrong is said under the icon (`FaceNote`).
- Only types with `stereo: 'optional'` get a **Mono | Stereo** switch.
- **Overview** (`overview` in the store — cards read this flag, never the zoom): the header and body stay mounted with `visibility: hidden`, so the card keeps exactly its size and its ports stay put; `OverviewFace` is drawn over them.
- Only the left button moves a knob or fader (a right-click opens the menu and changes nothing).

### Mono / Stereo

**One wire carries a whole stereo signal.** Cards have one input and one output; only a bus splits its mix into separate **L and R outputs** (one per speaker). The registry's `stereo`: `follow` (every processor: passes on what it gets), `optional` (a switch: Line In, Generator, Aux Bus), `always` (Master Bus, Matrix Bus), `never` (one channel: mic, instrument, guitar amp, speakers — a stereo wire arriving is folded, L + R). A wire carries `mono`, `stereo`, or `left` / `right` — one side of a mix, which keeps its side through effects (`outputKind()` reads it from the wiring). A stereo bus adds every wire's `l` to Left and `r` to Right: a mono wire lands on both sides at full level — that is why Pan is needed (one channel in: Pan; a stereo wire in: Balance — `stage.role`). Compressor, limiter, de-esser and gate run **linked** in stereo. A stereo wire is drawn as a twin line; an output carrying one side shows an L / R letter.

**Taking L / R over** (`graph/mainFader.ts`, run on every change by `commitGraph`): a Fader wired to a stereo bus's L or R becomes its **Main Fader** — that wire becomes the bus's **Mix** wire (the whole stereo mix) and the bus's L / R wires move onto the Fader. A Graphic EQ, Amplifier or Limiter (the Limiter only from a bus's mix) on the L / R of whatever holds them takes them over the same way, so the chain carries one stereo wire up to the last of them. A stereo bus's L or R wired to a Matrix Bus becomes its **Matrix send** (post-fader, one stereo wire). Unplugging or deleting the card that took them hands them back. Port layout is read from the wires, never stored.

### Level system

The level is `complexityLevel` in the store (persisted). Levels control **palette visibility only** — they do not auto-populate the graph:

| Level | Visible palette items |
|---|---|
| Beginner | mic, line-in, instrument, di-box, active-speaker, headphones, gain, fader |
| Intermediate | + guitar-amp, generator, hpf, eq, comp, pad, noise-gate, limiter, deesser, switch, relay (Relay Switch), pan (Pan / Balance), master-bus, aux-bus |
| Advanced | + speaker, amp, graphic-eq, adc, dac, matrix-bus |

Each type's `minLevel` in `NODE_REGISTRY` is the source of truth for this table. A level can also change a card's layout, name and starting params: the EQ is the three-knob **Equalizer** in Intermediate and the **Parametric Equalizer** in Advanced (`initialParams()`; names in the locales' `levelNames`). From Intermediate (`DETAIL_LEVEL`, D3) the meters show their peaks, noise, numbers and movement, and the sources their sound buttons. Switching level clears the canvas (with confirmation); no level pre-places anything.

### Signal health zones

| Zone | dB range | Color | Meaning |
|---|---|---|---|
| `too-quiet` | < −40 dBu | Blue | Noise floor risk |
| `good` | −40 to 0 dBu (unity) | Green | Target range |
| `hot` | above unity, below +20 dBu | Yellow | Less headroom left |
| `clipping` | **peaks** ≥ +20 dBu (clip level — where every gain stops) | Red | Distortion |

The first three zones come from the average; **clipping comes from the peaks** (D4, at every level — D5; the engine takes no level): `getHealth(db, domain, peakDb)`, `healthOf(wire, domain)`. Everything that judges a signal — a stage's `health`, wires, port rings, the meters' health words and clip lines, the overview face — gives the loop's verdict, not the moment's. Digital levels (dBFS, after an ADC) use the same zones moved down by `ALIGNMENT_DB` (18: 0 dBu ↔ −18 dBFS) and clip at 0 dBFS (`ceilingOf(domain)`); meters, ports, wires and `formatDb` take the stage's domain (`stage.domain`, `stage.inDomain`).

**Meters** (`SignalMeter.tsx`; D16, D17): one bar per side — solid RMS, pale peaks, a thin hold line. Their **colours belong to the scale** (`meterZones`: blue up to the measured noise, green to unity, yellow, red in the top 2 dB), not to the verdict; the health word says the verdict. The scale runs evenly over 80 dB up to the ceiling, then a tail down to −∞ (`dbToPercent`). From Intermediate the Peak / RMS / Noise numbers, each in the colour of its place on the scale (`zoneAt`), and the movement (D10, D15); Beginner sees the bar and the loop's average (D3).

### The number engine and real sound

Every side of every wire carries four readings (`SideLevels`): **peak**, **rms** (the average — what the meters show), **noise** (what you hear when the music stops: hiss and hum together) and **hum** (the hum part, kept apart for its red glow). The number engine (`signal/process.ts` for one card, `signal/chain.ts` for the walk) is intentionally simplified, to teach the idea at once without filter maths: a gain moves every reading by the same dB, the peaks are flattened at the ceiling after every card, a dynamics card puts each reading through its curve, buses add signals as voltages and noise as powers, and every powered card adds its own noise as a real desk's (D18). It is the instant picture: it moves the last render's readings by its step until the next render arrives (D9).

The render (`store/measuring.ts` → `audio/measure.ts`) builds the same plan as Web Audio nodes (`audio/chainAudio.ts`), plays the sources' loops (`audio/loops.ts`, made by `scripts/make-loops.py`; D7, D8) or the Generator's sounds, and measures every card twice: with the music (peaks, average, and the movement slice by slice) and with it stopped (noise, hum). Every sound is one loop long, so the meters can replay that one loop on the clock (D10). Where real sound differs from the number engine, it is real.

### Design decisions

In full in `docs/decisions.md`; the code cites them by number:
- **D1** — A hum follows the signal, like all noise; only fixing the cause (Ground Lift) removes it.
- **D3** — Beginner shows nothing new: peaks, noise, the numbers, the sound buttons and the movement start at Intermediate.
- **D4 / D5** — Clipping is judged on the peaks, at every level.
- **D7** — Real audio (Web Audio) on short loops made for the app; the dynamics are our own AudioWorklet processors.
- **D8** — The loops on the sources: Microphone Speech · Singing · Drums, Line Input Music · Drums, Instrument and Guitar Amp a guitar.
- **D9** — Every card's readings come from the render; the number engine is the instant picture.
- **D10** — The meters replay the render on the clock (no live AudioContext, no Play / Pause); nothing moves at Beginner.
- **D11** — Meters only where a meter belongs; no connection, no signal ("Not connected"); numbers, words and colours stay the loop's.
- **D12** — Reduced motion stops neither the meters nor the wires' flow.
- **D13** — Sources and speakers have a level meter, in dB SPL where sound meets the air.
- **D14** — A clip is heard at the end ("Bad sound"), however green the meters after it.
- **D15** — A meter's numbers are its Peak and RMS, and they move (twice a second).
- **D16** — Meters in Sound Forge's style: the colours belong to the scale.
- **D17** — The meter measures the noise (the blue part, a Noise number); one size per card.
- **D18** — Noise as on a real analogue desk.
- **D19** — No hover messages: explanations go in the help popover (`theory`).

(D2 and D6 were replaced by D8 and D9.)

### React Flow notes

- `nodeTypes` is `NODE_COMPONENTS`, defined **outside** any component (no re-registration on every render). Components read their type from React Flow's `type` prop, nothing from `data`.
- Interactive elements inside nodes carry `nodrag nopan`, so the canvas does not take their pointer events.
- Edges are coloured from the engine's health (`useFlowElements`), not stored in React Flow state.
- Every prop of `<ReactFlow>` is stable between renders: no inline arrow functions, arrays or objects — `useStableHandlers`, hoisted constants.
- **`nodeOrigin` is `[0, 0]`**: a node's `position` is its top-left corner. All layout helpers assume this.
- What must escape the transformed viewport (`ConfirmDialog`, menus) is a `createPortal` to `document.body` — the viewport's `transform` breaks `position: fixed`. Overlays that must not start a wire or a waypoint carry `lsc-overlay`.
- `nodesConnectable` is always `false`: wiring is the custom click system (`useWireDrawing`, capture-phase `mousedown` on `document`). `nodesDraggable`, `elementsSelectable` and `panOnDrag` follow `toolMode`.
- Wiring acts on `mousedown`, so the `click` after a wiring press on a port is swallowed (`useSwallowClick`) — otherwise it lands on the input just plugged in, whose click unplugs it. A plain unplug click is never swallowed.
- Import React Flow's `Node` as `type Node as FlowNode` (the DOM has a `Node` too).
- `MasterBusNode` serves `master-bus`, `aux-bus` and `matrix-bus`.
- **Handle hit-testing**: custom `<Handle>`s default to `isConnectable`, so React Flow gives them `connectionindicator` and `pointer-events: all` even in Select mode — that is what lets the mouse-follow switch find them with `document.elementsFromPoint` (`.lsc-connect-mode` forces it too). A handle's type is `classList.contains('source' / 'target')`: there is no `data-handletype`.
- **Display nodes carry `measured`.** A node without it is new to React Flow, which hides it until re-measured on the next frame — a click in that gap lands on the pane. `useFlowElements` hands React Flow's sizes back (`keepSizes`), except for a card whose ports changed (`portLayoutKey`), left unmeasured on purpose so its ports are re-read. `NodePort` re-reads its ring on `transitionend` so wires end at its edge.
- The overlay SVGs (`CanvasOverlays`) are siblings of the React Flow div; each `ViewportLayer` applies the canvas's `translate / scale` (`useViewport()`) to stay aligned.
- Zoom control labels are translated through `ariaLabelConfig` (`toolbar.zoom*` keys).

### Adding a new node

Add the type's key to `TypeKey` in `src/data/nodeRegistry.ts`: every table keyed by it then fails to compile until the type is in it.

1. `NODE_REGISTRY` (`src/data/nodeRegistry.ts`): ports, category, `stereo` (a processor gets `'follow'`: it passes on stereo by itself, and reads its meters through `useStereoLevels`), `defaultParams`, `minLevel` (the easiest level whose palette shows it), `bypass` (false where the control itself is the state). Flags when they apply: `bus`, `splits`, `linked`, `freeSize` (a bare control), `minSize`
2. `PROCESS` in `src/signal/process.ts`: what it does to one channel — to every reading (`shifted` for a gain, `dynamics` for a curve; read settings with `param(node, key)`; add new keys to `ParamTypes`). A card with no power of its own goes in `PASSIVE` (no hiss); a source gets its noise in `NOISE_BELOW` and its peaks in `soundOf` / `PEAKS_ABOVE` (and a loop or a sound in `audio/`); a setting that takes one of a few words goes in `PARAM_CHOICES` (or `paramChoices` when types differ)
   - And what it does to real sound: its case in `processed()` in `src/audio/chainAudio.ts` (Web Audio nodes; a dynamics card a processor in `audio/processors.ts` with its tests, and its knobs in `settingsOf`). A card left out passes the sound on unchanged — the render then disagrees with the number engine
3. Create `src/components/nodes/YourNode.tsx` (props: `CardProps`):
   - A card → use `NodeWrapper` (`align="center"` centres a single control); its In / Out meters → `MeterSides` around its controls (they move by themselves)
   - A bare control, not a card (like Gain / Pan / Fader / Switch / Pad) → use `FreeControl`, and give it a `freeSize` in the registry
4. `NODE_COMPONENTS` in `src/components/nodes/index.ts` (its card) and `NODE_LOOK` in `src/components/nodes/nodeLook.ts` (icon, palette group — its place in that table is its place in the palette)
5. Its palette name (`palette.items`) and educational text (`theory`: `what`, `why`, `tip`) in **both** `src/i18n/locales/en.json` and `bg.json` (the build fails without them). No English in the components: even ON / OFF and "0 dB in" come from the locales

### Adding a new level

Add it to `ComplexityLevel` and `LEVELS` in `src/data/levels.ts`, set the `minLevel` of the types it brings in `NODE_REGISTRY`, and add its `levels.<id>` text to every locale.
