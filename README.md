<div align="center">

<img src="public/favicon.svg" alt="Cubit logo" width="84" />

# Cubit

**A Rubik's Cube you control with your hands.**

Raise a few fingers at your webcam and a layer of the cube turns. It runs entirely in your browser: there is no server, and your camera feed never leaves your device.

</div>

---

## Why "Cubit"

A *cubit* was one of the oldest units of length: the distance from the elbow to the tip of the middle finger. A measure taken from the hand. This is a cube taken from the hand.

## What it does

| | |
|---|---|
| **Hand signs** | Fingers up or down make a sign; the sign picks a layer. Your **right** hand turns it clockwise (yellow), your **left** hand turns it back (blue). Hold still until the ring fills. |
| **3×3 Cube** | Mouse drag, keyboard, or hands. Scramble, undo, reset, lock the view with Space or a closed fist. |
| **Mirror Cube** | A silver-blue cube with uneven blocks. There are no colours, so you solve it by *shape*. |
| **Academy** | Eight short lessons teaching the layer-by-layer method, each with practice positions and a "Show me" button that draws the moves on the cube. |
| **Guide me** | An arrow on the cube shows the next move of a short solution. Strictly opt-in: scrambling never starts it, so solving it yourself is the default. |
| **Solve for me** | Finds a short solution and plays it back with pause, step forward/back, 1×/2×/4× speed and the full move list. |

### The signs

The four fingers (index, middle, ring, pinky) are read as four bits. Counting from the index side picks **R, U, F**; counting from the pinky side picks **L, D, B**.

| Sign | Fingers up | Layer | | Sign | Fingers up | Layer |
|---|---|---|---|---|---|---|
| R | index | Right | | L | pinky | Left |
| U | index, middle | Up | | D | ring, pinky | Down |
| F | index, middle, ring | Front | | B | middle, ring, pinky | Back |
| M | index, pinky | Middle slice | | E | middle, ring | Equator slice |
| S | index, middle, pinky | Standing slice | | | | |

Open hand moving = orbit the camera. Two open hands spreading = zoom. A closed fist held still = lock the view.

## What is interesting under the hood

- **A two-phase Kociemba solver written from scratch** (`src/core/solvers/twoPhase.ts`). The library it replaced stopped at its first answer, so a cube three turns from solved came back with a 21-move solution. The new solver builds its own move and pruning tables (about a second, in a web worker), then keeps searching for strictly shorter answers from **six points of view** (the cube seen from three sides, and as its inverse). Both phases search by *cost in quarter turns*, the same count the guide shows: a random scramble averages about 25 steps after the search, against 32 for the first answer found. It is not an optimal solver and doesn't claim to be.
- **The Mirror Cube's state is shape.** Every block's position and rotation is tracked as an integer matrix and verified against the real cube engine, so the puzzle is solved exactly when the blocks line up into a clean cube again.
- **Hand tracking on the device.** MediaPipe's hand landmarker runs in the browser; landmarks become finger states, a majority vote removes flicker, and a small state machine turns a held sign into a move.
- **Everything is checked against a second engine.** Moves, solutions, Academy positions and the Mirror tracker are tested against [cubing.js](https://github.com/cubing/cubing.js) as an independent oracle.
- **The home page's cube is not WebGL.** It is 26 CSS-3D cubies, animated with the same rotation tracker, so the page stays light.

The maths, written for a curious beginner, lives in [`docs/MATH.md`](docs/MATH.md): permutation groups, quaternions, spherical camera orbit, hand landmarks, IDA\*, pruning tables, Kociemba's two phases, and the Mirror Cube's matrices.

## Getting started

```bash
npm install      # also copies MediaPipe's WASM runtime into public/
npm run dev      # http://localhost:5173
```

Needs Node 20 or newer. Hand control needs a webcam and a secure origin (`localhost` or https).

```bash
npm test                 # unit tests (Vitest)
npx playwright test      # end-to-end tests (starts the dev server itself)
npm run lint
npm run build            # type-check and production build into dist/
```

[`docs/TESTING.md`](docs/TESTING.md) is the hands-on checklist for things only a person with a webcam can judge.

## Project layout

```
src/
  App.tsx                    routes, lazy-loaded screens, solver warm-up
  components/
    screens/                 Home, FreePlay (also runs Academy lessons), Academy, Settings
    PuzzleCanvas.tsx         react-three-fiber cube: pieces, drag-to-turn, animation
    CssCube.tsx              the 26-cubie CSS cube used on the home page
    SignPlayground.tsx       the try-a-sign demo
    SolutionPlayer.tsx       play / pause / step / speed for Solve for me
    HandsGuide.tsx           sign key, hold rings, guide strip
  core/
    puzzles/                 cube3 and mirror plugins (state, moves, geometry, colours)
    solvers/                 twoPhase (search), frame (slices), kociemba (wrapper), solveGuide
    gestures/                landmarks -> signs, fist lock, hand orbit, keyboard, mouse drag
    academy/                 lesson text, and the stage checks that decide a lesson is done
  state/                     small zustand stores (puzzle, settings, Academy progress)
docs/                        MATH.md, TESTING.md
tests/e2e/                   Playwright specs
```

A puzzle is a *plugin* (`PuzzlePlugin.ts`): state, move application, "is it solved", scramble, solve, geometry and colours. The play screen only talks to that interface, which is how the Mirror Cube slots in beside the 3×3.

## Deploying

It is a static site. On Vercel, import the repository and deploy: `vercel.json` sets the Vite build, the output folder and the rewrite that lets `/play/cube3` load on refresh. The camera needs https, which Vercel provides. There is no backend and no environment variables.

The hand-tracking files (about 12 MB of WASM plus a 7.5 MB model) only download when someone switches to Hands mode, and the home page ships about 260 KB of JavaScript.

## Honest limitations

- Hand-sign timing and orbit speed are tuned by feel; they depend on lighting and camera, and live tuning values are in `src/core/gestures/signGestures.ts`.
- The solver is short, not provably shortest.
- The Mirror Cube's middle layers are equal and centred, so centre turns are invisible. Real "Mirror Blocks" cubes offset the middle layers too, so they play slightly differently.
- Browser support: a current Chromium-based browser, Firefox or Safari with WebGL and `getUserMedia`.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, three.js through react-three-fiber, cubing.js, MediaPipe Tasks Vision, zustand, Vitest, Playwright.

---

Made by [Jay Guri](https://github.com/JayGuri).
