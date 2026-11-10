# Changelog

What changed in each release of Learn Signal Chain. The newest is on top.

## 1.6.0

- **A third subject in Dive deeper: *Complex waves*** — how a real sound is built from simple sine waves. On the left a string held at both ends, and beside it each harmonic on its own: a circle turning, and the sine wave it draws. On the right, what they make together — circles riding on each other, the sum they trace, and the recipe: how big each sine is. The string vibrates in as many harmonics as have been added, so you watch it turn from a plain arc into a real string's shape.
- **The seven steps:** the first sine; a second one, twice as fast and half as big; adding them up; a third; then the 4th to the 10th, which together come close to a sawtooth wave; that shape travelling through the air from a speaker cone; and last a real guitar's low E string, measured from a recording.
- **The real guitar.** Its first three sines are almost as big as each other, which is what makes the sum a shape and not a sine — a sharp peak and a deep trough, the wave a low E really has. Ten sines rebuild the recording to within a thirtieth of its loudness.
- **The sine wave has its names** in *Acoustic propagation and perception*: amplitude, wavelength, period and frequency. The travelling wave says how fast sound goes — 343 m/s in air at 20 °C.

## 1.5.0

- **Dive deeper**, a fourth button beside the three levels. It opens a different way of learning: nothing is built there. The teacher picks a subject on the left and shows, step by step, how one thing sets the next in motion. Play the movement or stop it, pick any point of its cycle, and go forward or back a step at a time (the arrow keys and Space work too).
- **Two subjects to start with:**
  - *Acoustic propagation and perception*: a string, the air around it, the sound wave on its way to the ear and the brain, then the same movement as a pendulum, a turn of the phase circle and a sine wave;
  - *Transducer and speaker*: a sound wave moves a microphone's diaphragm and coil, the coil gives a voltage, and the voltage moves a speaker that makes sound again.
- **Your canvas is kept** while you are in Dive deeper: the button of the level you were on brings it back as you left it.
- **No more grid dots on the canvas.** *Snap to grid* works as before.
- **The header on smaller screens:** with four buttons to fit, *Snap to grid* and *Light / Dark* show only their icons on screens narrower than 1520 pixels.

## 1.2.0

- **Phase switch** (from Intermediate): press it and the signal leaves upside down. Send the same signal twice to a bus with one of them upside down, and the sound disappears.
- **Delay knob** (Advanced): holds the signal back by up to 20 milliseconds. Two copies of one signal a little apart in time stop lining up; with the phase switch, line them up again.
- **Effects processor** (Advanced): a rack unit for an aux bus to send to. Its knobs are for show: the signal passes through unchanged.
- **The On / Off switch has no input or output.** Dropped on the canvas, it has a connection point on every side; wire it any way you like — straight, reversed, up, down or round a corner — and the points you don't use disappear. Dropped onto a wire, it turns to follow it.
- **The Relay Switch can be flipped**, like the speakers: right-click it.
- **Bends on a wire:** right-click a bend to start another connection from there (*Split*), or to remove it. With *Snap to grid* on, bends land on the grid, level with the elements' connection points. A wire no longer doubles back on itself at a bend.
- **Moving around:** hold the middle mouse button to move the canvas while you draw a wire. You can zoom out until the whole chain fits, however big; far out, the meters and wires stop moving and the bends' dots hide, so the computer stays fast.
- **The File menu** says *Import*, *Export* and *Save as image*, and opens your computer's own *Save as* window straight away.
- **The Audio Interface** at Intermediate is a simple box with *To computer* and *Line out*; *Look inside* is in its right-click menu, and the DAW's.

## 1.1.1

- **No more freezing on big desks with a live stream.** On a chain with Stream / Broadcast fed a digital signal (like the *Simple digital desk* example), every change used to freeze the page for about two seconds while the app worked out the loudness reading. Now the page stays smooth, and the loudness reads exactly as before.

## 1.1.0

- **Stereo everywhere.** One wire now carries both sides of a stereo signal. An effect wired after a Master, Aux or Matrix Bus works on the whole stereo mix, the same as one wired after a Keyboard.
- **L and R only into speakers.** When you wire a stereo output to speakers, it shows an L and an R output: the first speaker gets the left side, the next one the right. Headphones take the stereo wire whole: left ear left, right ear right.
- **The main fader.** The first fader after a bus is its main fader, even with effects between them.
- **The Matrix Bus** can take a bus's mix before its main fader or after it. Each bus can feed it once.
- **Audio Interface into two monitors:** each monitor now plays its own side at a good level. Before, each got both sides added together, which was too loud.
- **Tutorial examples:**
  - every Master Bus and Aux Bus example has a fader after it;
  - two new desks: *Small mixing desk* (Intermediate) and *Simple digital desk* (Advanced, with a Matrix Bus feeding a live stream).
- Chains saved with 1.0 open with the new wiring.

## 1.0.0

The first release. See the [README](README.md) for what the app does.
