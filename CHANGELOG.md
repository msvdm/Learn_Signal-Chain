# Changelog

What changed in each release of Learn Signal Chain. The newest is on top.

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
