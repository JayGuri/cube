# HandCube

Solve a Rubik's cube in the browser with your hands. Your webcam reads finger
signs, and each sign turns a layer. A mouse and keyboard work too.

- **3x3 Cube** and a blue **Mirror Cube** (one colour, solved by shape)
- **Hand signs**: the finger pattern picks the layer, the right hand turns it
  clockwise, the left hand turns it back
- **Guide me**: an arrow on the cube shows the next move of a Kociemba solution
- **Solve for me**: plays the whole solution

Everything runs in the browser. There is no backend: hand tracking
(MediaPipe), the solver and the 3D view all run on the user's machine, and the
camera feed never leaves it.

## Run it

```bash
npm install      # also copies MediaPipe's WASM runtime into public/
npm run dev      # http://localhost:5173
```

## Test it

```bash
npm test                 # unit tests (Vitest)
npx playwright test      # end-to-end tests
npm run lint
```

`docs/TESTING.md` is the hands-on checklist; `docs/MATH.md` explains the maths
behind the cube, the gestures and the solver.

## Deploy

It is a static site. On Vercel, import the repo; `vercel.json` sets the build
(`npm run build`), the output folder (`dist`) and the rewrite that lets
`/play/cube3` load on refresh. The camera needs HTTPS, which Vercel provides.

## Stack

React 19, three.js via react-three-fiber, cubing.js, cube-solver (Kociemba),
MediaPipe Hand Landmarker, Tailwind CSS v4, Vite.
