# Learn Signal Chain

An interactive, free, open-source web app for teachers and students to explore and understand audio signal chains — from microphone to speaker. Built for people who have never touched a mixing desk.

## Try It Online

No installation needed:

**[https://msvdm.github.io/Learn_Signal-Chain/](https://msvdm.github.io/Learn_Signal-Chain/)**

Runs entirely in your browser. No account, no backend, no cost.

## Use It Offline

- **Download it:** File → *Download the app…* saves the whole app as one `.html` file. Double-click it and it opens in your web browser — no internet, nothing to install. Put it on a USB stick or a shared drive for a class.
- **Or just visit once:** after your first visit, your browser keeps a copy, so the link above opens without internet too. Most browsers also offer to install it as an app (an icon on your desktop or home screen).

## What is it?

Learn Signal Chain lets you drag and connect audio elements on a canvas and watch the signal flow in real time. Every element you add or adjust changes the signal path immediately, with colour-coded feedback showing whether your gain staging is healthy (green), hot (yellow), or clipping (red).

Build chains like:

**Microphone → Preamp → EQ → Compressor → Fader → Master Bus → Speaker**

Right-click any element and choose *What is this?*: it explains what the element does, why it is in the chain and what to watch out for — in plain language, without jargon. *Next* walks you along the chain, element by element.

## What's New

- **Noise like a real mixing desk.** Every powered element adds a little noise of its own, at the levels real gear has (see *Sources* below). A preamp's noise grows as you turn it up, and a fader pulled down still leaves the noise of its own stage. Set the preamp 30 dB too low and make it up later, and the speaker ends up about 10 dB noisier. Make it up digitally after the converter, and you lose 5 dB more. That is why the gain is made at the preamp, before the converter.
- **The meter shows the noise.** From Intermediate on, the blue part at the bottom of every meter is the noise — what you hear when the music stops — and it grows when the noise does. Under each meter, *Peak*, *RMS* and *Noise* give the numbers, each in the colour of where it sits on the scale.
- **Meters like a recording program's.** Every meter is coloured along its scale: green, yellow as it gets hot, red at the very top, with the dB numbers written beside it, down to −∞ (silence). A red line lights up across the top while the signal clips. Zoomed out, the meters look the same.
- **Bigger controls.** Every element keeps one size at every level, and its knobs, curves and meters fill it. The equalizer's knobs stand one above another, High on top, as on a desk.
- **Meters that move.** From Intermediate on, as soon as a source is wired the chain plays its loop over and over, silently, and every meter follows it: the solid bar is the average over the last moment, a pale part above it the peaks falling back slowly, a thin line the loudest peak of the last few seconds. On drums the peaks leap far above the average; on a steady tone they almost touch. A compressor's dots ride its curve, a noise gate flips between open and closed. The meters stand upright at the sides of each card: what comes in on the left, what goes out on the right.
- **Sound in the air.** Microphones, instruments, guitar amps, speakers and headphones show a big picture with their buttons or Volume knob, and a meter of how loud the sound is in the air, in dB SPL. A source with nothing plugged into its output says *Not connected*: no connection, no signal.
- **The numbers come from real sound.** Every source plays a short loop made for the app — a speaking voice, a singing voice, lounge music, a drum beat, a guitar, all parts of one little song — and the whole chain is played silently in your browser and measured element by element: real filters, a real compressor, noise gate, limiter and de-esser. An 80 Hz high-pass barely touches a voice but cuts a hum; a compressor with a slow attack lets the start of each word through; the de-esser turns down only the "s". Nothing is heard yet, and nothing leaves your computer.
- **Clipping comes from the peaks.** A drum hit reaches the clip level long before its average does, so an element turns red as soon as its loudest moments distort — and a speaker after it says *Bad sound*, however green the meters in between.
- **A signal generator** (Sine, Noise or Click), and buttons for what the microphone picks up (**Speech, Singing or Drums**) and what the line input plays (**Music or Drums**): the same level, very different peaks.
- **Dynamics you can read:** the compressor's, noise gate's and limiter's curves show what they do to the peaks, the average and the noise — measured on the sound.
- **Works offline** (see above).

## Learning Levels

| Level | What's available |
|---|---|
| Beginner | Microphone, line input, instrument, DI box, gain (it becomes the preamp after a microphone), fader, active speaker |
| Intermediate | + guitar amp, signal generator, high-pass filter, equalizer, compressor, pad, noise gate, limiter, de-esser, on / off and pre / post switches, pan / balance, master bus, aux bus — and on every meter the peaks, the noise and the Peak / RMS / Noise numbers, moving with the sound |
| Advanced | + parametric equalizer, graphic EQ, amplifier, passive speaker, ADC / DAC, matrix bus |

Switch levels from the header at any time.

## Run Locally

```bash
bun install
bun dev        # dev server at http://localhost:5173
bun run build  # production build → dist/
bun test       # tests of the signal maths and the audio processors (without Bun: npm run test:node)
```

(npm/yarn work too if you don't have Bun installed.)

## Tech Stack

- **React + TypeScript** via Vite
- **React Flow** — node-based canvas
- **Zustand** — state management
- **Plain CSS** — the themes as CSS variables in `src/index.css`, inline styles in the components
- **Lucide React** — icons
- **Web Audio API** — the chain played on real sound, measured in an OfflineAudioContext (the sound loops are made by `scripts/make-loops.py`)

## Sources

The noise each element adds — a preamp's noise rising with its gain, every stage's own noise floor, the converters' — follows the published figures of real gear.

Sources for the noise figures:

* [Yamaha MG10XU specs](https://nl.yamaha.com/files/download/other_assets/2/1507032/MG10XU_technical_specifications_En_B0.pdf)
* [Behringer MX1604A specs](https://cf3.zzounds.com/media/MX1604A_B_Specs-3705148b1ccedb25a17d465301e37686.pdf)
* [Sound On Sound: what makes a good mic preamp](https://www.soundonsound.com/sound-advice/q-what-makes-good-mic-preamp)
* [Elliott Sound Products: noise figure](https://sound-au.com/noisefigure.htm)
* [Rane converter specs](https://www.rane.com/jp/seventy-jp)
* [Focusrite Scarlett 8i6 specs](https://userguides.focusrite.com/hc/en-gb/articles/23031453082258-Scarlett-8i6-3rd-Gen-specifications)

## Contributing

Contributions of all kinds are welcome — whether that's fixing a bug, improving an explanation, adding a new language, or suggesting a feature. There is no "right" level of experience required.

### Adding a Translation

Translations live in `src/i18n/locales/`. Each language is a single JSON file with no TypeScript required.

**To add a new language:**

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/{lang-code}.json`  
   (e.g. `fr.json`, `de.json`, `es.json` — use [BCP 47](https://en.wikipedia.org/wiki/IETF_language_tag) codes)
2. Translate all the string values. Keep the keys exactly as they are.
3. Open `src/i18n/locales/index.ts` and add one line:
   ```ts
   import fr from './fr.json'
   // then in LOCALES (the build fails if a key is missing):
   fr: { nativeName: 'Français', translations: fr satisfies LocaleStrings },
   ```
4. Open a pull request.

The app already has English and Bulgarian. All other languages are open and very welcome.

**Improving an existing translation:**  
Edit the relevant `.json` file directly and open a PR. If you spot something unnatural or technically wrong, please fix it — native speakers know best.

### Other Ways to Contribute

- **Fix a bug** — open an issue or a PR
- **Improve an explanation** — the help texts in `en.json` under `"theory"` are the educational core of the app; clearer wording is always valuable
- **Report a confusing UI** — especially welcome since the app targets complete beginners
- **Suggest a feature** — open an issue; ideas for future additions include a frequency spectrum analyser and reverb/delay nodes

### About This Project

This app was built with [Claude Code](https://claude.ai/code) by Anthropic. All help — translations, fixes, ideas, feedback — is more than welcome.

## License

MIT — see [LICENSE](LICENSE).
