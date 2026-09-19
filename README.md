# HandCube

Solve twisty puzzles with nothing but your hands. HandCube is a browser-based
simulator for five twisty puzzles — 3x3 Cube, Pyraminx, Skewb, Mastermorphix,
and Megaminx — controlled by two-handed webcam gestures (pinch to grab a
layer, twist your wrist, release to snap it into place), with mouse and full
keyboard control always available as a fallback. A built-in Academy mode and
a spaced-repetition algorithm trainer teach beginners to actually solve each
puzzle, not just scramble it.

> **Status:** all five puzzles are playable end-to-end (scramble, solve,
> mouse/keyboard/gesture control). The gesture pipeline is implemented and
> unit-tested down to the last frame of synthetic hand-landmark data; verifying
> it against a real webcam and a real hand is the one piece of this project
> that needs a physical device rather than a test runner. See
> [What's real vs. what's aspirational](#whats-real-vs-whats-aspirational) below.

## Why this is hard

Two subsystems in this project are genuinely under-solved problems, not
plumbing:

**Continuous two-handed gesture control.** Existing gesture-cube demos map a
fixed hand pose to a fixed move (this pose = a U turn) — discrete,
sign-language-style control. HandCube instead implements a real interaction
metaphor: one hand anchors the puzzle (a held fist), the other pinches a
layer and twists it, and releasing near a valid angle snaps the move home —
the same two-handed choreography a person uses on a real puzzle. The whole
recognizer is a **pure state machine** — `(prevState, landmarkFrame) →
(nextState, events)` — with zero dependencies on Three.js, React, or
MediaPipe itself, so the entire gesture vocabulary (anchor-hold timing,
pinch-flicker rejection, snap-angle tolerance, double-tap undo) is unit
tested against synthetic landmark sequences with no camera and no
flakiness. It's also why the mouse-drag path exists as a first-class input
adapter, not an afterthought: it feeds the identical `Move` shape into the
identical `InteractionController`, so CI can exercise the exact commit logic
gestures use without ever touching a webcam.

**A procedural CSG geometry engine.** Rather than hand-authoring five
different puzzle meshes, HandCube builds all of them from one shared
primitive: cut a Platonic solid with a small set of planes
(`three-bvh-csg`), classify the resulting pieces by which cut-planes they
sit beyond, and color them by which piece currently occupies each slot. The
same ~130-line CSG utility produces the cube's 26 pieces, the pyraminx's 14,
the skewb's 14, and the megaminx's 62. Mastermorphix — a shape-mod with no
existing open-source implementation — reuses the 3x3's entire logic engine
unmodified and only reshapes its geometry, via a fraction-preserving radial
remap that provably sends the cube's 4 alternating corners onto a
tetrahedron's 4 vertices and its other 4 corners onto the tetrahedron's 4
face centroids (a real invariant, verified by a unit test, not eyeballed).

## Architecture

```
Webcam Feed
    │
    ▼
HandLandmarker (MediaPipe, WASM/GPU)  ──►  21 landmarks x up to 2 hands
    │
    ▼
Gesture Recognizer (pure FSM, unit-testable with zero hardware)
    │  emits: ORBIT · ANCHOR_HOLD · GRAB · TWIST · RELEASE · COMMIT · UNDO
    ▼
Interaction Controller  ◄── Mouse Drag Adapter  ◄── mouse/touch
    │                   ◄── Keyboard Adapter    ◄── keyboard
    │  (all three input paths commit through the identical Move shape)
    ▼
PuzzlePlugin  (one per puzzle: cube3 / pyraminx / skewb / mastermorphix / megaminx)
    │             │                             │
    ▼             ▼                             ▼
cubing/kpuzzle  CSG-built Three.js mesh    Move history
(state, moves,  (per-piece slot + colour)  (feeds Tutorial Engine,
 scrambling)                                Undo, Algorithm Trainer)
    │
    ▼
Tutorial Engine  ──►  validates live state against the current lesson step  ──►  hint overlay / success-error pulse
```

Every puzzle implements one `PuzzlePlugin` interface
(`src/core/puzzles/PuzzlePlugin.ts`), so the 2nd through 5th puzzle were
additions to a registry, not rewrites of the first.

## Prior art and what's actually different here

| | Existing gesture-cube demos | `cubing.js` | **HandCube** |
|---|---|---|---|
| Puzzle count | 1 (always 3x3) | 15+ (view/scripted-play only) | 5, fully interactive |
| Control | Fixed pose → fixed move | Scripted algorithm playback | Continuous two-hand pinch + twist |
| Runs where | Desktop Python app | Any browser | Any browser, camera-based |
| Teaches the user | No | No | Yes — Academy + spaced-repetition trainer |
| Novel geometry | No | No (WCA puzzles only) | Yes — Mastermorphix via a custom CSG shape-mod |

[`cubing.js`](https://github.com/cubing/cubing.js) is the real industry-standard
library behind `alg.cubing.net` and csTimer, and HandCube deliberately builds
on top of it rather than reinventing permutation-group state, scrambling, or
move notation — `cubing/kpuzzle`, `cubing/alg`, and `cubing/scramble` all
carry real algorithmic weight that would be easy to get subtly wrong from
scratch. The 20% that's genuinely novel — two-handed continuous gesture
control, and the CSG-based multi-puzzle geometry pipeline — is where all the
custom engineering went.

## Tech stack

React 19 + TypeScript + Vite · `cubing` (kpuzzle/alg/scramble) ·
`cube-solver` (Kociemba, in a Web Worker) · Three.js + `@react-three/fiber` +
`@react-three/drei` · `three-bvh-csg` · `@mediapipe/tasks-vision`
(HandLandmarker, self-hosted WASM + model) · Zustand · Tailwind CSS v4 ·
`idb` (IndexedDB) · Vitest + Playwright · `vite-plugin-pwa`

## Running it locally

```bash
npm install       # also copies the MediaPipe WASM runtime into public/
npm run dev       # http://localhost:5173
npm test          # unit tests (Vitest)
npx playwright test   # end-to-end tests (Playwright)
npm run build     # production build + PWA manifest/service worker
```

Camera access (for the "Hands" input mode) requires HTTPS or `localhost` —
this is a browser platform requirement, not something the app can work
around.

## What's real vs. what's aspirational

Being direct about scope, since a project like this invites the question:

- **Solve buttons undo, they don't re-derive.** The 3x3 (and Mastermorphix,
  which reuses its engine) run a real Kociemba two-phase solver in a Web
  Worker and produce genuinely independent, near-optimal solutions. Pyraminx,
  Skewb, and Megaminx's Solve buttons invert the tracked scramble/move
  history instead of running a from-scratch beginner-method solver — this was
  a deliberate, disclosed trade (see the comments in each puzzle's
  `solve.ts`) made after a bounded search solver worked for some scrambles
  but not others without a real pattern-database heuristic, and hand-deriving
  verified WCA-style algorithms without a physical puzzle to test against was
  a larger undertaking than the rest of this build's scope allowed. The
  puzzle still returns to solved; it's an undo, not an independently-solved
  answer.
- **Academy lesson tracks are a proven pattern, not a finished curriculum.**
  Each puzzle has one real, validated lesson stage (cube3's full cross;
  pyraminx's tips; skewb's first corner; megaminx's centres) built against a
  schema designed so a complete OLL/PLL-equivalent curriculum can be authored
  against it directly. That authoring is real content work, not an
  engineering unknown.
- **The gesture pipeline hasn't been tested against a real camera in this
  environment.** Every piece of it that can be tested without hardware is:
  the recognizer FSM (20 unit tests against synthetic landmark sequences),
  the controller that turns FSM events into moves (18 tests, including one
  asserting mouse and gesture input produce byte-identical results), and the
  raycast bridge that connects a gesture cursor to the 3D scene. What can't
  be unit tested — MediaPipe actually running against a live feed, real
  human hand poses crossing the calibrated thresholds — needs a physical
  device and a person in front of it.
- **Deployment is a deliberate no-op for now.** Pushing to a GitHub remote
  and standing up a live Vercel/Netlify URL are both one-way, externally
  visible actions; they're scoped into this plan but held behind an explicit
  go-ahead rather than done automatically.

## License

Not yet decided — add one before treating this as reusable by others.
