# Dynamic QR

Animated QR-code generator rendered in the browser with WebGPU.

Generate a custom QR code and breathe life into it with a variety of
animated effects — a crawling snake, wave ripples, flipping
cells, pulsing breath, maze transitions and more. Export the result as a
GIF or MP4, or verify that your animated code is still scannable right in
the browser.

![qr-snake demo](qr-snake-720.gif)

## Features

- Procedural WebGPU shader animations (snake, wave, flipping, breath, maze, static)
- Live scannability check via `zxing-wasm`
- Export animated QR to GIF and MP4
- Editor with animation catalog and gallery

## Dev Dependencies

Requires `npm` utility.

## How to run dev server

At first launch

```sh
npm install 
```

Then:

```sh
npm run dev
```

## Tests

```sh
npm test
```