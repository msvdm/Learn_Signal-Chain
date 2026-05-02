# Learn Signal Chain

An interactive, free, open-source web app for teachers and students to explore and understand audio signal chains — from microphone to speaker. Built for people who have never touched a mixing desk.

## Try It Online

No installation needed:

**[https://msvdm.github.io/Learn_Signal-Chain/](https://msvdm.github.io/Learn_Signal-Chain/)**

Runs entirely in your browser. No account, no backend, no cost.

## What is it?

Learn Signal Chain lets you drag and connect audio elements on a canvas and watch the signal flow in real time. Every element you add or adjust changes the signal path immediately, with colour-coded feedback showing whether your gain staging is healthy (green), hot (yellow), or clipping (red).

Build chains like:

**Microphone → Preamp → EQ → Compressor → Fader → Master Bus → Speaker**

Each element has a tooltip that explains what it does, why it exists in the chain, and what to watch out for — in plain language, without jargon.

## Learning Levels

| Level | What's available |
|---|---|
| Beginner | Microphone, preamp, fader, active speaker |
| Intermediate | + high-pass filter, EQ, compressor, switch |
| Advanced | Full toolkit — graphic EQ, bus routing, amplifier, passive speaker, potentiometer |

Switch levels from the header at any time.

## Run Locally

```bash
bun install
bun dev        # dev server at http://localhost:5173
bun run build  # production build → dist/
```

(npm/yarn work too if you don't have Bun installed.)

## Tech Stack

- **React + TypeScript** via Vite
- **React Flow** — node-based canvas
- **Zustand** — state management
- **Tailwind CSS v4**
- **Lucide React** — icons

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
   import frJson from './fr.json'
   // then in LOCALES:
   fr: { nativeName: 'Français', translations: frJson as unknown as Translations },
   ```
4. Open a pull request.

The app already has English and Bulgarian. All other languages are open and very welcome.

**Improving an existing translation:**  
Edit the relevant `.json` file directly and open a PR. If you spot something unnatural or technically wrong, please fix it — native speakers know best.

### Other Ways to Contribute

- **Fix a bug** — open an issue or a PR
- **Improve an explanation** — the tooltip texts in `en.json` under `"theory"` are the educational core of the app; clearer wording is always valuable
- **Report a confusing UI** — especially welcome since the app targets complete beginners
- **Suggest a feature** — open an issue; ideas for future additions include a frequency spectrum analyser, reverb/delay nodes, and exporting a chain as a diagram

### About This Project

This app was built with [Claude Code](https://claude.ai/code) by Anthropic. All help — translations, fixes, ideas, feedback — is more than welcome.

## License

MIT — see [LICENSE](LICENSE).
