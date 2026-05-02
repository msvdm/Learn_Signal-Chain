# Learn Signal Chain

An interactive, free, open-source web app for teachers and students to explore and understand an audio signal chain — from microphone to speaker.

## What is this?

Learn Signal Chain lets you visualise and interact with a standard audio signal path:

**Microphone → Preamp/Gain → EQ → Compressor → Fader → Master Bus → Speaker**

The signal is your hero — represented as a flowing line with a dB value. Every element you add or adjust changes the signal in real time, with colour-coded feedback showing whether your gain staging is healthy (green), hot (yellow), or clipping (red).

## Learning Levels

| Level | What you can do |
|---|---|
| Beginner | Core elements only: microphone, preamp, fader, speaker |
| Intermediate | Adds filters, EQ, compressor, and switch |
| Advanced | Full toolkit — all processing stages including graphic EQ, bus routing, and amplifier |

Switch levels at any time from the header. Switching clears the canvas (with confirmation).

## Signal Theory

All signal processing is based on standard professional audio practice:

- **Microphone** output: approx. −60 dBu (dynamic mic)
- **Preamp**: +20 to +60 dB gain, converts mic level to line level (+4 dBu pro standard)
- **EQ**: ±12 dB per frequency band; Gaussian bell curve approximation in log-frequency space
- **Compressor**: threshold/ratio-based gain reduction; `gainReduction = (input - threshold) × (1 - 1/ratio)`
- **Fader**: 0 dB (unity) to −∞ (muted)
- **Master Bus**: ±12 dB output trim
- **Signal health zones**: too-quiet (< −40 dBu), good (−40 to −12 dBu), hot (−12 to 0 dBu), clipping (> 0 dBu)

Sources: Warm Audio, Berklee Online, LibreTexts Humanities, Sweetwater, Audio University.

## Run Locally

```bash
# Install dependencies
npm install

# Start the dev server
npx vite dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for Production

```bash
npx vite build
# Output is in the dist/ folder — deploy anywhere static hosting is available
```

## Tech Stack

- **React + TypeScript** via Vite
- **React Flow** (@xyflow/react) — visual node-based signal chain canvas
- **Zustand** — state management
- **Tailwind CSS v4** — styling
- **Framer Motion** — animations
- **Lucide React** — icons

## Contributing

Contributions are welcome! Feel free to open issues or pull requests.

Ideas for future features:
- Live frequency spectrum analyser
- Reverb/delay effects chain
- Export signal chain as a diagram

## License

MIT — see [LICENSE](LICENSE).
