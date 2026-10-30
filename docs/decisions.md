# Design decisions

Made with the user (the code cites them by number). Moved here word for word from CLAUDE.md on
2026-10-09, when CLAUDE.md was trimmed; CLAUDE.md keeps one line each. A new decision goes here in
full and into CLAUDE.md as one line. Where a decision quotes a number or a file, the code and the
tests are what is true today.

## D1 – D27

- **D1 — A hum follows the signal**, like all noise: a fader turns the hum down with the music and the gap stays. Only fixing the cause (Ground Lift) removes it.
- **D3 — Beginner shows nothing new**: the meters' peaks and noise (the blue part), their Peak / RMS / Noise numbers, the sources' sound buttons and the moving meters start at Intermediate (`DETAIL_LEVEL`, `CHOICE_LEVEL`); at Beginner a Microphone plays Speech, a Line Input Music (since D21 a Vocal speaks). Replaced at Beginner by D20.
- **D4 — Clipping is judged on the peaks**: a card is red as soon as its peaks reach the clip level, whatever its average (since D16 the bar's colours belong to its scale; the red clip line says it). **D5** — at every level, Beginner too; the engine takes no level. Since D20 Beginner judges no levels at all.
- **D7 — Real audio** (Web Audio) instead of homemade simulations: the chain is played on short loops made for the app (no recordings of real people, no copyrighted music); the dynamics are our own processors in an AudioWorklet.
- **D8 — The loops on the sources**: Microphone Speech · Singing · Drums, Line Input Music · Drums, Instrument and Guitar Amp a guitar. Older files' `melodic` opens as Speech / Music, `percussive` as Drums. Since D21 (2026-10-10): Vocal Speech · Singing, Drum Kit drums, Acoustic Guitar a guitar, Keyboard and PC music (the Line Input became the Keyboard; its Drums went).
- **D9 — Every card's readings come from the render** on real sound; the number engine is the instant picture, moving the last render's readings by its step until the next one.
- **D10 — The meters replay the render**, not a live AudioContext: every sound is one loop long, so the render records the loop slice by slice and the meters play it back on the clock. No Play / Pause; DAW meter maths (RMS 300 ms, peak and hold, the noise floor as the fog — since D17 the blue part); meters upright at the cards' sides (In left, Out right), the 4:3 rule gone; nothing moves at Beginner (D3). Nothing more on the wires than the flow animation that shows the direction (steps 12 and 13 of the plan were dropped).
- **D11 — Meters only where a meter belongs**: face-only cards show their icon, buttons or knob and notes, no level (since D13 they have one); Pan a dot on an L–R track; the Pad a bare button; zoomed out the other cards keep their meter; a source with nothing wired shows "Not connected" — no connection, no signal. The numbers, health words and colours stay the whole loop's while the meters move.
- **D12 — Reduced motion does not stop the meters** (2026-10-06): with it they stood still on the user's computer, in every mode. Nor the wires' flow animation (`.signal-line-animated`), which shows the direction.
- **D13 — Sources and speakers have a level meter** (2026-10-06, the user's call, replacing D11 for the face-only cards): Microphone, Instrument, Guitar Amp, Speaker, Active Speaker, Headphones — upright beside the face zoomed in, horizontal under it zoomed out (the Microphone a full card since 2026-10-08: its meter at its side, zoomed out the bar alone); dB SPL where sound meets the air (a Microphone by what it picks up, speakers up to 130, the Guitar Amp 100 … 115 — it goes to 11), the Instrument in dBu. The Microphone's meter moves to the sound it hears (D21).
- **D15 — A meter's numbers are its Peak and its RMS, and they move** (2026-10-06, the user's call, replacing D11's still numbers): from Intermediate, under every meter, "Peak" (the peak hold, the mark's value) and "RMS" (the solid bar's, the last 0.3 s), moving with the sound, changing twice a second (same day: 8 times a second was too fast for learners); the colours and the health word stay the loop's. Beginner keeps one number, the average (D3). The bars are twice as thick as before, in today's style.
- **D14 — A clip is heard at the end, however green the meters after it** (2026-10-06): a speaker or headphones fed a signal clipped anywhere before it says "Bad sound"; the colours along the chain stay as they are — clipping can't be seen where it doesn't happen, but it is always heard.
- **D16 — Meters in Sound Forge's style** (2026-10-08, the user's choices from animated mock-ups, after Sound Forge Pro's "PPM + VU-14" meter): one bar per side as before (solid RMS, pale peaks, a thin hold line — not Sound Forge's separate peak and VU bars); its colours belong to the scale, at the health edges (blue below unity − 40, green to unity, yellow above, red in the top 2 dB); an even scale down to −60 dBu / −80 dBFS, then a squeezed tail to −∞; dB numbers beside the bars (between L and R), dBFS on a digital meter; Peak and RMS numbers stay under the bars (D15); a red line across the top, twice as thick as the hold line, lit while it clips; the horizontal overview bars look and scale the same, with only −∞ 0 +20 (dBFS −∞ −18 0) under them. Its fixed blue zone (below −40 dBu) was replaced by D17.

- **D17 — The meter measures the noise** (2026-10-08, the user's call): the readings under each card (Peaks / Room before clipping / Hiss), their help sections and the hiss tag are gone, and every card keeps one size at every level, its content grown into the room. The blue part of a bar is the noise measured with the music stopped — blue from the bottom up to it, green above up to unity —, a Noise number joins Peak and RMS, and every number takes the colour of its place on the scale; the health word stays the loop's verdict. From Intermediate (D3).
- **D18 — Noise as on a real analogue desk** (2026-10-08, the user's call, after research on real gear): a Gain's input noise lifted by its gain (Preamp EIN −128 dBu; a trim the preamp behind a 20 dB pad), every powered card's own noise after its job, never turned down by its own controls (a Gain's floor −100, a line stage −95, a bus −90, an amp −85, converters 112 dB under full scale); silence moved to −140 so real noise floors read as numbers. The lessons, measured: a Preamp 30 dB low costs about 10 dB of signal-to-noise; made up digitally after the ADC, 5 dB more; the desk low into an amp wide open, about 1 dB. Later the user may add real recordings with their own noise.

- **D19 — No hover messages** (2026-10-08, the user's call: "I don't like them at all"): no `title` tooltips, no SVG `<title>`, no pop-ups on hover — on cards, ports, meters, buttons, the header or the palette; explanations belonged in the help popover (gone since D25: the app explains no element). Only the bottom-left toolbar keeps its labels: React Flow's zoom buttons (`title`) and the left-click tools' name / shortcut / help (`CanvasTools`). Icon-only buttons keep an `aria-label` (screen readers; it never shows on hover). Hover may still change how something looks (a port turning into ×, a row lighting up its chain).

- **D20 — Levels are scales** (2026-10-10, the user's plan): each level shows the sound system at its own scale, from the room down to the parts. **Beginner** is the macro world — devices, not their parts: what is wired to what and which outputs get sound, no signal maths. No number engine, no render and no real meters there (only decorative ones, on the Mixer and the DAW); a small check of the wiring says *sound* or *no sound* at each output. This replaces D3 and D5 at Beginner; they hold from Intermediate. **Intermediate** is the analogue channel strip of a small desk (the Yamaha MG12XU as the model), with an Audio Interface and a DAW there only to record and play back (D22). **Advanced** is the micro scale: the full chain with the digital picture (D23). Each type lists the levels whose palette shows it (`levels` in `NODE_REGISTRY`), so some elements leave at harder levels (Mixer, Stage Box, Studio Monitor). One type per idea: where a level needs another look (the Vocal a human head at Beginner, the Equalizer three knobs at Intermediate), the card changes, never its ports. Beginner's palette has three sections: Inputs · Devices · Outputs.
- **D21 — The microphone is not the sound** (2026-10-10): what makes sound in the air — a Vocal, a Drum Kit, an Acoustic Guitar, a Guitar Amp — feeds a Microphone through its Sound input (drawn as waves spreading straight to the microphone since 2026-10-29, a dotted wire before); one source may feed several microphones (a kit with three mics). The source has the dB SPL meter (D13), the Microphone none. A Microphone is Dynamic or Condenser; a Condenser gives no signal unless a 48V (phantom power) switch is on in its chain, before its Preamp.
- **D22 — Interface and DAW at Intermediate: record and play back only** (2026-10-10, the user's "5 · 1 · 2"): (5) they never sit inside a processing chain — a mix goes in to be recorded, and the DAW plays back into the desk or the monitors; (1) the separate USB Audio Interface is the relatable hook, like the MG12XU's USB; (2) a *Look inside* button shows the same channel strip, digital, inside the box. Wire colours stay for signal health only: the digital side is not colour-coded (wire colours: D24 since 2026-10-11).
- **D23 — Advanced adds the digital picture** (2026-10-10): a Decoder (a source that is digital from the start), a Recorder (Mono / Stereo, a monitor out, a VU meter on an analogue signal and dBFS on a digital one) and an Encoder (encoding is more than A/D conversion) feeding Stream / Broadcast. The Interface and the DAW show their converters there, and the DAW may feed digital processing: a DAW is a mixer. Since 2026-10-11 (the user's calls, "keep it simple"): the Recorder is the Recorder Track and follows its source (no Mono / Stereo switch); the DAW at Advanced plays its song only into a Recorder Track, whose output feeds any processing or routing card (back into a channel, or on to listen); the Audio Interface is not in Advanced's palette. So the DAW draws other ports at Advanced (its song out), and the Recorder its Monitor out only there (NodePort `levels`): the one exception to D20's "never its ports". Since 2026-10-11 (the user's second call, "keep it simple"): at Advanced the DAW is a **digital summing bus** — digital signals in, as many as you like, added up in stereo (an analog one it records nothing of: "a computer records only numbers"), and what it records out, into a Recorder Track only; nothing in, it is silent (no song of its own there). No feedback maths: a loop of wires is left out, as any loop. Stream / Broadcast at Advanced takes only an Encoder; an Encoder fed an analog signal is silent. The VU meter is a needle on a dial, in the Recorder Track's face.
- **D24 — Wires are coloured by where their sound goes** (2026-10-11, the user's call: "unfortunately we need to add some colours to the lines"): green — the main flow, to the Master Bus; blue — to an Aux Bus; magenta — to a Matrix Bus; yellow — to the PFL Bus; black (white on the dark theme) — into an Audio Interface (and along its USB wire) or to Stream / Broadcast. Red stays for clipping and problems: a wire whose sound clips, a ground-loop hum's glow, and the "wire runs through a card" warning (red dashes, it was yellow). A wire takes the colour of where its sound ends up; one feeding several of those places stays green; a wire ending at a speaker or anything else takes the colour of the bus it comes from (an Aux into a wedge: blue), green when none (the Recorder is not on the list: green). A wire that carries nothing stays grey. The wire of a sound in the air stayed grey (dotted) until 2026-10-29; since then it takes its colour like any wire (the user's call: "I don't like the current dark dotted line" — see *How a wire is drawn*). It replaces D22's "wire colours stay for signal health only": a wire no longer shows Too Quiet (blue) or Hot (yellow) — the meters, the port rings and the health words still do. `graph/wireFlow.ts`. At Beginner every wire is one neutral colour (the user's call, 2026-10-11: the colours start at Intermediate).
- **D25 — The app explains no element** (2026-10-25, the user's call: "Let the teachers explain what everything is. We only need to focus on the truth of the chain itself."): no help texts, no *What is this?*, no sentence on a card saying what it is or what it is for (the DI Box's line and *Look inside*'s went too). A paragraph about an element is always missing something and misleads a beginner; what an element is, the teacher says. The app shows what the chain does, and that must never be wrong: no teacher should ever have to tell a class "don't look at that, it's wrong". Notes stating the chain's condition stay ("Needs 48V", "No DI Box: the high notes get lost", a speaker's "Bad sound"). A **?** button next to the language button opens a tutorial: how the app works, and example chains to open. Replaces D19's "explanations belong in the help popover".
- **D26 — The Guitar Amp has a DI Out** (2026-10-29, the user's call: "it should get a line out and it should be called DI-Out, because in most amps it does that job. Look it up before designing"; their three picks from the research below). Real amps' DI outs (Fender Rumble, Ampeg B2RE, Laney IRT, Hughes & Kettner Red Box, Mesa Subway, MXR M81): a balanced XLR, almost always at mic level for the desk's mic preamp (some switch to line); taken after everything on some (Rumble 500, Laney), before the master on others (Rumble 800), or with a level of its own (Blackstar); a guitar amp's often through a speaker simulation; nearly always with a ground lift, the amp and the desk both being earthed through the mains. In the app: a second output, **DI Out** (its name beside its ring — since D27 printed on its panel), on the first port line above the Sound (mid-card); **mic level** — the guitar as strong as a dynamic microphone in front of the amp at its default Volume (−40 dBu for a guitar at −30), so the Gain after it is a Preamp; **before the Volume** — the desk gets the same level however loud the amp plays (only its Sound follows the knob); a **Ground Lift** under the knob, off by default: while it is off and the DI Out is wired, a hum starts on the DI Out (D1; not on its Sound) and the button lights red. No speaker simulation (the app shapes no tone, the amp's Sound neither). `AMP_DI_PORT`, `signal/gains.ts` AMP_DI_DB, `signal/chain.ts` OutputTap, `graph/queries.ts` groundLoop.

- **D27 — The two amps are drawings with their controls, and they switch on and off** (2026-10-30, the user's call: "make the guitar amp and speakers amp more fun … frameless elements like Gain and HPF and 48V … in case of amplifiers there is no bypass — only on/off and level"; picked from three rounds of sketches). No card around either, the same at every zoom and every level (`FreeControl`). The **Guitar Amp** a square combo, no handle, a grille (no speaker cone): on its top panel, on the port line, the input jack, its Volume knob 0 … 11 (the 11 lit red at the top), a power toggle with a red jewel light, the DI Out jack (D26) with its Ground Lift under it — red while the DI Out hums; its name on a plate on the grille; its dB SPL meter under it from Intermediate (D3; its room kept at Beginner, so one size). The **Amplifier** a 2U rack panel, drawn twice the size of the first build (692 × 348 px, B's line four port lines below A's — the user's call the same day: "make the amp twice as large"): an I / O rocker with a power light, its name printed on it, channel A and B rows, each a Volume knob and a meter window built into the panel (the scale between them). Two inputs, **A** and **B**, outputs **L** and **R** on their lines: a mono wire plays on the channel it is plugged into (A out of L, B out of R); **one stereo wire goes into both** — drawn as one twin wire splitting just before the inputs (the user's drawing: "it is not logical for one of the inputs to be grayed out — this is not how it is in the real world"); so a stereo wire needs both inputs free, and while one is in, the other holds it too. A bus's L / R taken over as before: no second wire from the Master. B's Volume follows A's until it is turned. **Off** (both amps, Beginner too): nothing out, not even hiss (`switchedOff`, which silences); the Guitar Amp's DI Out neither, nor its hum; the amp goes dark; at Beginner an end point it stops says "No sound — an amplifier before it is switched off". No warm-up glow. At Beginner the knobs are part of the picture and do not turn, no values; the rack's windows lit, still, while a sound reaches their channel. Its palette icon from the user's photo (a wide box, two knobs, a display, a small light); the Guitar Amp's icon unchanged. `AMP_B_PORT`, `graph/queries.ts` ampSplit, `CardPlan.used` channel, `components/nodes/GuitarAmpNode.tsx`, `AmpNode.tsx`, `ChainEdge` split.

(D2 and D6 were replaced by D8 and D9.)

## The user's smaller calls

Recorded in CLAUDE.md's descriptions of the cards until 2026-10-09 (the trim kept the rules and cut
the descriptions). Each is what the user asked for; change one only when they ask.

- **The palette's order** (2026-10-06): the user's layout, row by row, in the order a signal meets
  them (`NODE_LOOK`) — Processing runs Gain, Analog to Digital Converter, HPF, Pad, Gate, EQ,
  Compressor, Limiter, De-esser, Graphic EQ, Digital to Analog Converter.
- **Connect mode ends at once** (2026-10-08): it switches back to Select as soon as the cursor
  leaves all ports — a delay showed a cross between the unplug × and the wire it sits on.
- **A port is found twice as far out** (2026-10-08, the user's ask, for the overview): `PORT_REACH`,
  28 px from its centre.
- **One size per card, at every level** (2026-10-08): the registry's `minSize`; the readings that
  used to sit under the cards went (D17), their room went to the content.
- **Long card titles** (2026-10-08): a name that would take more than two rows at 132 px gets just
  the width two rows need — Bulgarian's Допълнителна смесителна шина (Aux) on two rows: the header
  stays 56 px, the card its size.
- **Microphone and Line Input are full cards of one size** (2026-10-08): 320 × 350, the icon and
  name in the header, their buttons on the left and their meter on the right. Since D21 the Keyboard
  (the Line Input's heir); the Microphone is a face card, its buttons beside its icon, and so is the
  Computer since 2026-10-10 ("does not need a zoomed-in form": its icon and its meter, as the
  Instrument's).
- **The Vocal's and the Computer's icons** (2026-10-10): drawn after the user's pictures — a head in
  profile speaking, in a thinner line than the other icons (heavier when drawn small); a laptop, its
  base flaring out under the screen, with a touchpad. The head had three waves from its mouth until
  2026-10-29 (the user's call: "The new connection form is a wave, so we don't need two waves. Let
  it be just a head"); since then it is the head alone, in the middle of the icon.
- **The Guitar Amp's Volume knob turns like a real amp's** (2026-10-29, the user's call: "fix the knob level … right now it is not working correctly"): every step was 1.5 dB — 100 dB SPL at 1, 115 at 11, and nothing at 0 —, so the knob hardly changed the level and jumped to silence at the bottom. Now an audio taper: silent at 0, each halving of the knob about 8 dB quieter (88 dB SPL at 1), 106 at 5 and 115 at 11 as before. `signal/gains.ts` guitarAmpGainDb.
- **The inputs** (2026-10-29, the user's list): the Vocal a low to mid level acoustic source, its
  peaks and character Speech or Singing; the Drum Kit a loud, percussive acoustic source; the
  Acoustic Guitar became the **Acoustic Instrument** — a quiet, melodic acoustic source, a saxophone
  on its icon (after the user's picture; since 2026-10-30 a trumpet in simple thin lines, after their
  second picture: "simplify the acoustic instrument symbol"), at every level (Beginner too); it still plays the guitar
  loop at 90 dB SPL. The Instrument became the **Hi-Z Instrument** (its icon kept): a weak signal
  from a high-impedance output. The Keyboard (a stereo line) and the Computer (a stereo line,
  compressed music) as they were. The Guitar Amp a loud acoustic source, or a mono mic-level one from its DI Out (D26).
- **Card outlines and empty port rings stand out from the canvas** (2026-10-30, the user's call:
  they "blend in with the canvas in both light and dark themes"): their own colour, `--lsc-card-edge`
  — a warm grey on the light theme, near white on the dark one ("closer to white", after a cool grey
  was too dark). The other borders (knobs, menus, the header) keep `--lsc-border`.
- **Zoomed out, the Microphone, Line Input and Instrument are bare** (`overviewBare`): their icon
  over a horizontal level bar and its scale, no numbers, no card around them (a selection still
  draws its ring) — like the Gain knob. Since D21 the Keyboard, the PC, the sounds in the air and
  the Microphone too (no meter: its icon alone).
- **The overview's level bar is one thickness on every card** (2026-10-08): `BAR_H` 24 px, stereo
  17 each.
- **The meters' bars are twice as thick** (2026-10-06): 32 px, L and R 22 px each, each with its
  letter.
- **The moving numbers change twice a second** (2026-10-06, part of D15): `TEXT_EVERY_MS` 500 —
  8 times a second, a DAW's pace, was too fast to teach with.
- **The Relay Switch** (2026-10-08, the user's design; it was the Pre / Post switch; Bulgarian
  Реле): face-only, no level and no name on it, a relay's symbol with A / B buttons above it; the
  card and its buttons stay at every zoom.
- **The converters' icons** (`AdcIcon`, `DacIcon`) follow the user's picture: a box cut by a
  diagonal, a wave and the digital mark (a line over a dashed line), what comes in top left.
- **Speakers in dB SPL** (the user's ask, after JBL's PRX412M): −10 dBu plays 100 dB SPL, the clip
  level 130, a powerful PA speaker's most.
- **The Guitar Amp goes to 11** (2026-10-06, the user's wink): its Volume 0 … 11.
- **Gain and Pan knobs are one size** (2026-10-08): 165 px.
- **Pan reads like a DAW's** (2026-10-08): L100 … L1, C, R1 … R100.
- **Fader caps by the bus they set** (2026-10-08): plain black (white on the dark theme), red on
  the Main Fader, blue on an Aux Bus's fader (mono or stereo), magenta on a Matrix Bus's.
- **A fader at the bottom of its travel mutes** (2026-10-08): −∞, like the bottom of a meter; the
  top stays +10.
- **The Graphic EQ draws no line through its sliders** (2026-10-08): their caps show the curve.
- **48V says 48V, on or off** (2026-10-10): lit while on, the same word greyed out when off (no
  "OFF"); it starts On.
- **The push buttons' colours** (2026-10-10): the On Off Switch green, 48V red, the HPF violet (the
  accent, as the Pan's knob), the Pad yellow (the hot colour).
- **The Compressor below Advanced is one bare knob** (2026-10-10): no card, no curve — a big knob
  like the Gain's and Pan's, yellow (the hot colour), readable zoomed out.
- **The Equalizer below Advanced is three bare knobs** (2026-10-10): Low · Mid · High side by side,
  the Gain's size, their names big, no card, no meters — an analogue desk's EQ and compressor have
  none; the next card shows the level.
- **The HPF shows no level** (2026-10-10): no meter or level at any zoom, at every level (the next
  card shows it). Below Advanced it is one button, "HPF" under the high-pass sign (a slope into a
  flat line, as on a desk), lit or greyed out (its bypass), at a fixed 80 Hz; Advanced keeps the
  cutoff to choose zoomed in, and zoomed out shows that same button (its click its On / Off).
- **A wire never moves a card** (2026-10-11): drawing a wire leaves both cards where they are (it
  used to push the card it feeds, and its chain, right of its source — a monitor under its channel
  or a loopback into the desk was thrown across the canvas). A card dropped onto a wire still makes
  room for itself.
- **The converters zoomed out are their name alone** (2026-10-11): no level block, as the HPF.
- **The Recorder at Advanced is the Recorder Track** (2026-10-11): it follows its source — a stereo
  wire in two channels, a mono one in one — with no Mono / Stereo switch (D23's switch dropped).
- **Headphones have no knob** (2026-10-11): a Gain right before them sets their level (the desk's
  Phones knob); fed by anything else they are silent, crossed out, and say why — as a passive speaker
  without an amplifier. After an Amplifier they still blow.
- **The USB link is one two-way wire** (2026-10-11, part of D22): drawn from the Interface's To
  computer into the DAW, it carries what is recorded there and the DAW's playback back (no flow on
  it, a ⇄ halfway). The DAW has no output of its own at Intermediate; the computer's sound comes out
  of the Interface's one stereo line output ("From computer"), into a Gain or Fader on the desk, a
  bus or the monitors.
- **The PFL Bus** (2026-10-11): a listening bus (Pre-Fade Listen), at Intermediate and Advanced —
  always stereo, a mono wire on both sides at full level (no Pan); one stereo output, no fader and no
  Main Fader takeover (the Gain before the headphones sets the level); it never feeds a Matrix Bus.
- **The PFL button** (2026-10-11): an On Off Switch wired into a PFL Bus is that channel's PFL
  button (role `pfl`: named PFL) — "PFL" on it, on or off, lit solid bright yellow;
  it works as any On Off Switch.
- **The Stage Box is bare** (2026-10-11): at Beginner its icon and name, no card, like the inputs —
  the icon in a thinner line, the snake leaving it straight.
- **The Mixer's name across its top** (2026-10-11): "Mixing desk" (Смесителен пулт), big, where the
  port lines' names were (too small to read: dropped); its outputs are Main (upper) and Monitor.
- **The Audio Interface at Beginner takes microphones and guitars** (2026-10-11): like the Mixer
  (no levels there); from Intermediate a microphone still goes through a Preamp first. Its input is
  called "Inputs" at Beginner.
- **Flips** (2026-10-11, `FLIPS`): right-click → Flip horizontal / Flip vertical. The Gain and the On
  Off Switch both ways — horizontal: the sound flows right to left; vertical: on its side, in on top,
  out at the bottom (both: flowing up); a PFL button can stand under its channel. The Active Speaker
  and the Headphones horizontally: the picture and the input turn to face the other way — an Active
  Speaker flipped is a **Stage Monitor** (its name). A wire into a port facing away
  goes over its card.
- **A card dropped anywhere on a wire goes into it** (2026-10-11): the wire is found along its route
  as drawn (a branch turning down to a PFL Bus too); dropped past its first run, the card stays where
  it was dropped.
- **Stream / Broadcast and the Encoder take the whole mix** (2026-10-11): a bus's (or Main Fader's)
  L or R wired into them is its send, both sides on one wire ("L+R", magenta only into a Matrix
  Bus); the Encoder is always stereo.
- **The Decoder's peaks at −18 dBFS** (2026-10-11): EBU's level; its music averages −30 dBFS.
- **The Pan knob fills from the centre** (2026-10-11): toward L or R, not from L like a gain.
- **Zoomed out, the Microphone is its icon alone** (2026-10-11): no "Needs 48V" note there.
- **How a wire is drawn** (2026-10-29, the user's pick from four mock-ups): its look says what it
  carries, its colour where the sound goes (D24). An analog cable: dashes, as before. Sound in the
  air into a microphone: ripples spreading from the source straight to the microphone, with no line
  and no corners (the user's pick from three more mock-ups the same day, option C "Ripples, no
  line" — the first look, small arcs travelling along the wire's route over a faint line, turned
  its corners: "this is strange"). Each ripple grows round the source, then travels on at that size
  (circles still round the source made a ladder of flat lines on a long throw); at least three, like
  the waves on the sources' icons. Corners saved on such a connection before are not drawn; a click
  in empty space while drawing one adds none; it leaves from halfway down its source's card (the
  user's call: "place the handle of all acoustic instruments in the middle of their respective
  cards" — the Guitar Amp's too), not its first port line. `utils/soundRipples.ts`. Digital — an output the engine says sends numbers,
  or a USB wire (at Beginner too): dashes and dots like Morse code (option C, "it looks like a morse
  code to me"; tweaked from bunched and spread dots to a dash, two dots, a dash, a dot), drawn as
  outlines on a stereo wire. `utils/wireLook.ts`, `components/SoundWaves.tsx`.
- **No feedback maths** (2026-10-11): a loop of wires is left out by the engine, as before — "teachers
  can explain that".
- **Stereo music later** (the user's plan): `music.mp3` may be replaced by a stereo file, and users
  may upload their own sounds later.
