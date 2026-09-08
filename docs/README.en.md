<p align="center"><img src="../logo.png" width="128" height="128" alt="DreamRO" /></p>

<h1 align="center">DreamRO</h1>

<p align="center">Create a character and explore an RO-inspired single-player adventure in your browser.</p>

<p align="center">
  <a href="https://dreamro.hexly.ai">Website</a> ·
  <a href="../README.md">简体中文</a>
</p>

<p align="center">
  <img src="../preview.jpg" width="720" alt="A traveler and Porings in DreamRO's Dawnlight Valley" />
</p>

## What it does

DreamRO is a single-player browser RPG inspired by Ragnarok Online. Choose a profession and appearance, travel from Dawnlight Valley through Whispering Woods to Starfall Sanctuary, complete guide quests, and challenge the Poring Queen.

Three.js builds the 3D scenes, characters, and equipment, alongside a window-based interface, fantasy illustrations, and Web Audio synthesis. Game logic and progress run in the browser. There are currently no cloud accounts, save synchronization, or multiplayer features.

## Features

- Create a novice, base profession, or advanced profession directly, with four skills per class covering melee, ranged attacks, healing, shields, damage over time, area spells, and summons.
- Explore three connected maps, navigate by clicking the ground or large map, and complete sequential quests to earn a permanent Poring companion.
- Gain levels through combat, collect loot automatically, buy potions, open chests, collect health cards, and upgrade weapons. Defeat preserves levels, inventory, and quest progress.
- Track progress through status and skill bars, inventory, character attributes, a quest journal, and a minimap.
- Use keyboard and mouse or a touch joystick, rotate and zoom the camera, choose between two quality presets, and adjust music, sound effects, and volume separately.

Code drives character breathing, walking, and attacks, Poring jumps, hits and disappearance, and spell circles and particles. See the [credits](../CREDITS.md) for artwork, fonts, and design references.

## Usage

Open the [game](https://dreamro.hexly.ai) in a modern browser with WebGL 2 and hardware acceleration enabled. Enter a name, choose a profession and appearance, then press the start-adventure button. Base and advanced professions are available immediately, without a job-change quest.

Each character has separate progress in the current origin's localStorage. On a later visit, choose a character from the continue-adventure list. The game saves automatically, with manual saving also available in settings. Domains, browsers, and devices do not share saves; clearing site data removes local progress.

| Action | Keys or gesture |
| --- | --- |
| Walk | WASD / arrow keys / touch joystick |
| Navigate automatically | Click the ground or a destination on the large map |
| Select a monster and attack automatically | Click a monster / Space / touch attack button |
| Profession skills | 1–4 / click the skill bar |
| Red potion / blue potion | Q / E |
| Talk or open a chest | Approach and press F / click the interaction prompt |
| Cycle targets | Tab |
| Rotate, zoom, and reset the camera | Right-drag / wheel / R |
| Inventory, character, journal, map | I / C / J / M |
| Settings or close a window | Esc |

Opening an in-game window pauses combat. Movement cancels automatic attacks so you can evade the Queen's ground warnings. Select the balanced quality preset if the device heats up or frame rate drops. See the [gameplay guide](gameplay.md) for quests and progression rules.

## Development

Use Node.js 22.12 or newer and npm, with a WebGL 2 browser.

```bash
git clone https://github.com/nocoo/dreamro.git
cd dreamro
npm ci
npm run dev
```

Vite defaults to port 5173 and chooses the next available port if occupied. Open the URL printed in the terminal, or specify one with `npm run dev -- --port 5174`. Different ports also use separate browser saves.

```bash
npm run typecheck
npm run build
npm run preview
```

Build output goes to `dist/`, including current version and commit metadata. The app requires no server credentials or database. Cloudflare Workers Static Assets hosting is configured in [wrangler.jsonc](../wrangler.jsonc); see the [deployment guide](deployment.md) for self-hosting steps.

| Path | Contents |
| --- | --- |
| `src/data/jobs.ts` | Professions, attributes, and skill configuration |
| `src/game` | 3D characters, maps, combat, A* navigation, audio, and saves |
| `src/main.ts`, `src/ui` | Character creation, application lifecycle, windows, and touch controls |
| `public` | Illustrations, local fonts, and cache configuration |
| `tests` | Browser adventure flows, professions, Boss behavior, and rendering regressions |

## Tests

```bash
npx playwright install chromium
npm test
```

Playwright starts a separate development server at `127.0.0.1:5188` and uses isolated browser saves. Keep that port free to avoid reusing an unrelated server. On Linux, `npx playwright install --with-deps chromium` also installs browser dependencies.

Current tests cover character creation, profession skills, map quests, the Queen encounter, saving, revival, and touch controls. The configuration uses Metal on macOS and Chromium software rendering on Linux, retaining screenshots and traces on failure. There are no separate unit or server API test commands. Use the development commands for type checking and builds.

## Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?logo=threedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)

| Area | Implementation |
| --- | --- |
| Game and interface | TypeScript, DOM, CSS, SVG |
| 3D rendering | Three.js, WebGL 2, Canvas textures |
| Audio and progress | Web Audio, localStorage |
| Build and hosting | Vite, Cloudflare Workers Static Assets |
| Browser tests | Playwright |

## Documentation

- [Gameplay guide](gameplay.md)
- [Deployment guide](deployment.md)
- [Credits](../CREDITS.md)
- [Changelog](../CHANGELOG.md)

## License

[MIT](../LICENSE) © 2026 Zheng Li. Bundled Cinzel and Cormorant Garamond fonts use the SIL Open Font License; see the [credits](../CREDITS.md). DreamRO is an independent tribute. Ragnarok Online / RO names and related marks belong to their respective rights holders.
