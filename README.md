# Dynamic QR

Animated QR codes rendered in the browser with WebGPU. Every frame stays scannable.

**Live:** [qr.fluffyspire.com](https://qr.fluffyspire.com)

![demo](img/demo.gif)

## Animations

| Animation | What happens |
|---|---|
| Snake, Duel | One or two snakes crawl over the code and hunt apples |
| Maze | Dark modules become corridors: a chomper collects pellets and runs from glitches |
| Flipping | Random modules flash in the accent colour |
| Breath | Modules pulse as soft dots |
| Beat | A ring of dots pulses out from the centre |
| Waves | Coloured ripples run across the code |
| Matrix | Dim digits in dark modules and falling streams of digital rain |
| Static | Plain code, for comparison |

The editor lets you pick a palette or your own colours, invert the code (light on dark), make the code bigger, change seed and speed, and export MP4 or GIF up to 2048 px and 60 s. Settings are kept in the browser.

## How a code stays readable

A QR code is split into Reed–Solomon blocks, and each block can repair a fixed number of damaged codewords. Animations spend **at most half** of that per frame; the other half is left for camera blur and glare. Details and pictures: [research/qr-layout](research/qr-layout/README.md).

- **Snake and maze** decide which modules to change every frame and check the budget per block before changing them ([`snake-game.ts`](src/animation/snake-game.ts), [`maze-game.ts`](src/animation/maze-game.ts)).
- **All shaders** keep each module on its side of the light/dark threshold: the module core is never lighter than 0.28 when dark and never darker than 0.72 when light ([`luma.wgsl`](src/shaders/luma.wgsl)). Any colour works, it only gets darker or lighter.
- **Finder and timing patterns** are never changed.
- **User colours** are corrected the same way before use ([`palette.ts`](src/animation/palette.ts)).
- **Inverted codes** are readable by most phone cameras, but not by every scanner app.

## Running

Needs Node.js 22+ and a browser with WebGPU (recent Chrome or Edge, Safari 26). Without WebGPU the site shows a static code and a hint.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Checks

```sh
npm test               # unit tests
npm run check:render   # renders every animation and scans the frames
```

- `npm test` checks the QR layout and error budget against the zxing decoder, and plays snake and maze for 600 ticks on every error correction level: each frame must fit the budget and sampled frames must decode.
- `npm run check:render` starts Vite and headless Chrome, renders every animation at 4 sizes, 2 seeds, 2 moments, plain and inverted, and decodes each image. It fails if any image does not scan. Set `CHROME_PATH` if Chrome is not in the default place. The same table is at `/check.html` on the dev server.

## Project structure

```
src/
  qr/            encoding, decoding, layout and error budget
  animation/     animations, game logic for snake and maze, palettes, registry
  shaders/       WGSL; luma.wgsl and common.wgsl are shared
  screens/       input, gallery and editor screens
  export.ts      MP4 (WebCodecs + mp4-muxer) and GIF export
  check.ts       render readability check, used by check.html
research/        how QR error correction limits what an animation may change
```

## Adding an animation

1. Implement `QrAnimation` ([`utils.ts`](src/animation/utils.ts)): `init`, `createState` and `frame`. `createState` gets the palette and the inversion flag in `options`.
2. Add it to [`registry.ts`](src/animation/registry.ts) and give it a title and description in [`catalog.ts`](src/animation/catalog.ts).
3. Run `npm run check:render`.
