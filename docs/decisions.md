# Design decisions

Made with the user (the code cites them by number). Moved here word for word from CLAUDE.md on
2026-10-09, when CLAUDE.md was trimmed; CLAUDE.md keeps one line each. A new decision goes here in
full and into CLAUDE.md as one line. Where a decision quotes a number or a file, the code and the
tests are what is true today.

## D1 – D19

- **D1 — A hum follows the signal**, like all noise: a fader turns the hum down with the music and the gap stays. Only fixing the cause (Ground Lift) removes it.
- **D3 — Beginner shows nothing new**: the meters' peaks and noise (the blue part), their Peak / RMS / Noise numbers, the sources' sound buttons and the moving meters start at Intermediate (`DETAIL_LEVEL`, `CHARACTER_LEVEL`); at Beginner a Microphone plays Speech, a Line Input Music.
- **D4 — Clipping is judged on the peaks**: a card is red as soon as its peaks reach the clip level, whatever its average (since D16 the bar's colours belong to its scale; the red clip line says it). **D5** — at every level, Beginner too; the engine takes no level.
- **D7 — Real audio** (Web Audio) instead of homemade simulations: the chain is played on short loops made for the app (no recordings of real people, no copyrighted music); the dynamics are our own processors in an AudioWorklet.
- **D8 — The loops on the sources**: Microphone Speech · Singing · Drums, Line Input Music · Drums, Instrument and Guitar Amp a guitar. Older files' `melodic` opens as Speech / Music, `percussive` as Drums.
- **D9 — Every card's readings come from the render** on real sound; the number engine is the instant picture, moving the last render's readings by its step until the next one.
- **D10 — The meters replay the render**, not a live AudioContext: every sound is one loop long, so the render records the loop slice by slice and the meters play it back on the clock. No Play / Pause; DAW meter maths (RMS 300 ms, peak and hold, the noise floor as the fog — since D17 the blue part); meters upright at the cards' sides (In left, Out right), the 4:3 rule gone; nothing moves at Beginner (D3). Nothing more on the wires than the flow animation that shows the direction (steps 12 and 13 of the plan were dropped).
- **D11 — Meters only where a meter belongs**: face-only cards show their icon, buttons or knob and notes, no level (since D13 they have one); Pan a dot on an L–R track; the Pad a bare button; zoomed out the other cards keep their meter; a source with nothing wired shows "Not connected" — no connection, no signal. The numbers, health words and colours stay the whole loop's while the meters move.
- **D12 — Reduced motion does not stop the meters** (2026-10-06): with it they stood still on the user's computer, in every mode. Nor the wires' flow animation (`.signal-line-animated`), which shows the direction.
- **D13 — Sources and speakers have a level meter** (2026-10-06, the user's call, replacing D11 for the face-only cards): Microphone, Instrument, Guitar Amp, Speaker, Active Speaker, Headphones — upright beside the face zoomed in, horizontal under it zoomed out (the Microphone a full card since 2026-10-08: its meter at its side, zoomed out the bar alone); dB SPL where sound meets the air (a Microphone by what it picks up, speakers up to 130, the Guitar Amp 100 … 115 — it goes to 11), the Instrument in dBu.
- **D15 — A meter's numbers are its Peak and its RMS, and they move** (2026-10-06, the user's call, replacing D11's still numbers): from Intermediate, under every meter, "Peak" (the peak hold, the mark's value) and "RMS" (the solid bar's, the last 0.3 s), moving with the sound, changing twice a second (same day: 8 times a second was too fast for learners); the colours and the health word stay the loop's. Beginner keeps one number, the average (D3). The bars are twice as thick as before, in today's style.
- **D14 — A clip is heard at the end, however green the meters after it** (2026-10-06): a speaker or headphones fed a signal clipped anywhere before it says "Bad sound"; the colours along the chain stay as they are — clipping can't be seen where it doesn't happen, but it is always heard.
- **D16 — Meters in Sound Forge's style** (2026-10-08, the user's choices from animated mock-ups, after Sound Forge Pro's "PPM + VU-14" meter): one bar per side as before (solid RMS, pale peaks, a thin hold line — not Sound Forge's separate peak and VU bars); its colours belong to the scale, at the health edges (blue below unity − 40, green to unity, yellow above, red in the top 2 dB); an even scale down to −60 dBu / −80 dBFS, then a squeezed tail to −∞; dB numbers beside the bars (between L and R), dBFS on a digital meter; Peak and RMS numbers stay under the bars (D15); a red line across the top, twice as thick as the hold line, lit while it clips; the horizontal overview bars look and scale the same, with only −∞ 0 +20 (dBFS −∞ −18 0) under them. Its fixed blue zone (below −40 dBu) was replaced by D17.

- **D17 — The meter measures the noise** (2026-10-08, the user's call): the readings under each card (Peaks / Room before clipping / Hiss), their help sections and the hiss tag are gone, and every card keeps one size at every level, its content grown into the room. The blue part of a bar is the noise measured with the music stopped — blue from the bottom up to it, green above up to unity —, a Noise number joins Peak and RMS, and every number takes the colour of its place on the scale; the health word stays the loop's verdict. From Intermediate (D3).
- **D18 — Noise as on a real analogue desk** (2026-10-08, the user's call, after research on real gear): a Gain's input noise lifted by its gain (Preamp EIN −128 dBu; a trim the preamp behind a 20 dB pad), every powered card's own noise after its job, never turned down by its own controls (a Gain's floor −100, a line stage −95, a bus −90, an amp −85, converters 112 dB under full scale); silence moved to −140 so real noise floors read as numbers. The lessons, measured: a Preamp 30 dB low costs about 10 dB of signal-to-noise; made up digitally after the ADC, 5 dB more; the desk low into an amp wide open, about 1 dB. Later the user may add real recordings with their own noise.

- **D19 — No hover messages** (2026-10-08, the user's call: "I don't like them at all"): no `title` tooltips, no SVG `<title>`, no pop-ups on hover — on cards, ports, meters, buttons, the header or the palette; explanations belong in the help popover (`theory`), which the user will revise. Only the bottom-left toolbar keeps its labels: React Flow's zoom buttons (`title`) and the left-click tools' name / shortcut / help (`CanvasTools`). Icon-only buttons keep an `aria-label` (screen readers; it never shows on hover). Hover may still change how something looks (a port turning into ×, a row lighting up its chain).

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
  name in the header, their buttons on the left and their meter on the right.
- **Zoomed out, the Microphone, Line Input and Instrument are bare** (`overviewBare`): their icon
  over a horizontal level bar and its scale, no numbers, no card around them (a selection still
  draws its ring) — like the Gain knob.
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
- **Stereo music later** (the user's plan): `music.mp3` may be replaced by a stereo file, and users
  may upload their own sounds later.
