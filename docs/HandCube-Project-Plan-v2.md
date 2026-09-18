# HandCube — Gesture-Controlled Multi-Puzzle Solver & Tutor
### Complete End-to-End Specification (v2) — for Claude Code implementation

This version supersedes the v1 plan. It incorporates research into existing prior art, real open-source libraries you should build on top of instead of reinventing, and a clear articulation of what makes this project genuinely novel — which is also the material you'll use to talk about it in interviews or a portfolio write-up.

---

## 0. Executive Summary (elevator pitch)

**HandCube** is a browser-based application that lets a user solve five different twisty puzzles — 3x3 Cube, Pyraminx, Skewb, Mastermorphix, and Megaminx — using nothing but their own two hands in front of a webcam, with no controllers or mouse required. A built-in "Academy" mode teaches complete beginners to solve each puzzle through guided, gesture-validated lessons.

The engineering core is two genuinely hard, under-solved problems:
1. **Continuous, two-handed, physically-realistic gesture control** of a 3D twisty puzzle (grab a layer, twist it, feel it snap) — not a fixed "gesture A = keypress B" mapping.
2. **A procedural geometry engine** that can render any Platonic-solid-based twisty puzzle, including one (Mastermorphix) that has no existing open-source renderer.

Everything else that's already been solved well by the community (permutation-group state representation, move notation, scramble generation, 3x3 optimal solving) is deliberately reused rather than reinvented, so all your engineering effort goes into the genuinely novel 20%.

---

## 1. Prior Art & Competitive Differentiation

Do this research yourself too, but here's what's already out there so you don't rebuild it and can clearly articulate what's different about HandCube.

### 1.1 Existing gesture-controlled cube projects
Several hackathon/student projects exist (e.g., a Python + MediaPipe + VPython "Air Cube" project, various OpenCV gesture-game-controller repos). Their common shape:
- **Discrete gesture-to-move mapping**: a specific static hand pose (like sign language) triggers a specific fixed move (e.g., "this pose = U turn"), not continuous manipulation.
- **3x3 only** — no other puzzle types.
- **Desktop Python apps** (Tkinter/VPython windows), not shareable web apps.
- **No teaching layer** — they're novelty controllers, not tutors.

### 1.2 `cubing.js` (the real industry-standard library)
[`cubing.js`](https://github.com/cubing/cubing.js) (npm package `cubing`), by Lucas Garron and Tom Rokicki, is the engine behind `alg.cubing.net` and used by the World Cube Association ecosystem and csTimer. It ships a `<twisty-player>` web component and already supports rendering and move-execution for 3x3/2x2/4x4...7x7, **Megaminx, Pyraminx, Skewb**, Square-1, and more, plus an `Alg` class for WCA/SiGN move notation and a `randomScrambleForEvent` scramble generator. Its underlying `PuzzleGeometry`/`KPuzzle` system builds these from a compact description: a Platonic solid (tetrahedron/cube/octahedron/dodecahedron/icosahedron) plus a set of symmetric cutting planes aligned to faces, vertices, or edges.

**What it does NOT give you**: any input/interaction beyond a scripted algorithm player, any gesture system, any tutoring layer, and no Mastermorphix (it isn't a WCA puzzle so it isn't in the library).

### 1.3 Your differentiation, stated plainly
| | Prior hackathon projects | cubing.js | **HandCube** |
|---|---|---|---|
| Puzzle count | 1 (3x3) | 15+ (view-only) | 5 (fully interactive) |
| Control | Discrete pose→keypress | Scripted/programmatic only | Continuous two-hand pinch+twist |
| Runs where | Desktop Python | Any browser | Any browser, camera-based |
| Teaches the user | No | No | Yes — structured Academy |
| Novel puzzle geometry | No | No (WCA puzzles only) | Yes — Mastermorphix via custom CSG shape-mod |

This is your one-sentence differentiation for a resume/README: *"Unlike existing gesture-cube demos, which map fixed hand poses to fixed moves on a single puzzle, HandCube supports continuous two-handed manipulation — grab, twist, release-to-snap — across five puzzle types, including a custom-built shape-modification puzzle with no existing open-source implementation, plus a structured tutoring system."*

---

## 2. Build-vs-Reuse Decision Matrix

This is the single most important architectural decision in the project. Get this right and the scope becomes achievable; get it wrong (build everything from scratch) and you risk never finishing.

| Concern | Decision | Reasoning |
|---|---|---|
| Move notation, algorithm parsing | **Reuse**: `cubing/alg` | WCA/SiGN notation parsing is a solved, finicky problem |
| Cube/Pyraminx/Skewb/Megaminx state representation & legal-move application | **Reuse**: `cubing/kpuzzle` + `cubing/puzzles` | Permutation-group correctness is easy to get subtly wrong; this is battle-tested |
| Scramble generation | **Reuse**: `cubing/scramble` | Random-state scrambling requires real group theory; don't reinvent |
| 3x3 optimal solving | **Reuse**: a JS Kociemba two-phase implementation (e.g. `cube-solver` on npm, or a modern min2phase JS port) run inside a Web Worker | Optimal/near-optimal solving is a deep, already-solved algorithmic problem |
| Pyraminx / Skewb / Megaminx *tutorial-grade* solving | **Build**: hand-authored beginner layer methods | These don't need optimal solvers — they need a fixed, teachable sequence, which off-the-shelf solvers don't provide anyway |
| 3D piece geometry & rendering | **Build**: custom CSG pipeline (`three-bvh-csg` + Three.js primitives) | You need full control of the mesh for raycasting against individual fingers/pieces, custom coloring, and — critically — Mastermorphix, which no library renders |
| Mastermorphix state logic | **Reuse + map**: drive it with the exact same `cubing/kpuzzle` 3x3 definition, and only build custom *geometry* on top | Mastermorphix is mechanically identical to a 3x3 (it's a shape-mod); reimplementing its permutation logic from scratch would be pure duplication |
| Gesture recognition & interaction | **Build**: this is the entire point of the project | No existing library does two-hand continuous twisty-puzzle manipulation |
| Tutorial/Academy engine | **Build**: this is the other entire point of the project | Nothing existing combines puzzle simulation with pedagogy |

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| App framework | React + TypeScript + Vite | |
| Puzzle logic core | `cubing` (npm) — `cubing/alg`, `cubing/kpuzzle`, `cubing/puzzles`, `cubing/scramble` | Requires ES2022 module support; install via `npm install cubing` |
| 3x3 solver | `cube-solver` (npm, Kociemba two-phase) or equivalent min2phase JS port, run in a Web Worker | Initializing pruning tables takes ~1-2s — never do this on the main thread |
| 3D rendering | Three.js + `@react-three/fiber` + `@react-three/drei` | |
| Procedural geometry / CSG | `three-bvh-csg` (by gkjohnson) using Three.js's built-in `BoxGeometry`, `TetrahedronGeometry`, `DodecahedronGeometry` as base solids | Fast BVH-accelerated boolean ops; avoids hand-deriving Platonic solid coordinates |
| Hand tracking | `@mediapipe/tasks-vision` — `HandLandmarker` task, GPU delegate, `numHands: 2` | Runs fully client-side via WASM; no server round-trip; works offline after first load |
| State management | Zustand | |
| Styling | Tailwind CSS | |
| Animation | Framer Motion (UI) + Three.js/`@react-spring/three` (puzzle turns) | |
| Persistence | IndexedDB (`idb`) for lesson progress; localStorage for settings | |
| Testing | Vitest (unit), Playwright (E2E) | |
| CI/CD | GitHub Actions → Vercel/Netlify | Camera access requires HTTPS — both provide it free |
| PWA | `vite-plugin-pwa` | Installable, works offline after first load — nice resume bullet |

---

## 4. High-Level Architecture

```
Webcam Feed
    │
    ▼
HandLandmarker (MediaPipe, WASM/GPU) ──► 21 landmarks × up to 2 hands, ~30fps
    │
    ▼
Gesture Recognizer (finite state machine, pure functions — unit-testable without a camera)
    │   emits: ORBIT(dx,dy) · ANCHOR_HOLD · GRAB(pieceId) · TWIST(angleDelta) · RELEASE · ZOOM(delta) · UNDO
    ▼
Interaction Controller
    │   snaps TWIST to nearest valid angle (90°/120°/180° depending on puzzle) → commits a Move
    ▼
Puzzle Plugin (per puzzle type)
    │             │                              │
    ▼             ▼                              ▼
KPuzzle state   CSG-generated Three.js mesh   Move history log
(cubing/kpuzzle)  (synced to state each move)  (feeds Tutorial Engine + Undo/Redo + Replay)
    │
    ▼
Tutorial Engine ──► compares live state / move stream to expected lesson step ──► Hint Overlay / feedback color
```

### 4.1 The `PuzzlePlugin` interface

Every puzzle implements this. Building it first and validating it against 3x3 is the foundation of the whole codebase.

```ts
interface PuzzlePlugin {
  id: "cube3" | "pyraminx" | "skewb" | "mastermorphix" | "megaminx";
  displayName: string;

  // Logic (backed by cubing/kpuzzle wherever possible)
  kpuzzleDefinitionId: string;         // e.g. "3x3x3", "megaminx", "pyraminx", "skewb"
                                        // mastermorphix reuses "3x3x3" here
  createInitialState(): PuzzleState;
  applyMove(state: PuzzleState, move: Move): PuzzleState;
  isSolved(state: PuzzleState): boolean;
  scramble(): Promise<Move[]>;         // cubing/scramble under the hood
  solve(state: PuzzleState): Promise<Move[]>; // Worker-hosted solver, per §6

  // Geometry (custom CSG, per §7)
  buildGeometry(): PuzzleMesh;         // pure function, cacheable
  colorScheme: FaceColorMap;
  pieceIdForFacelet(kpuzzleFaceletId: string): PieceId; // bridges logic ↔ mesh

  // Interaction (custom, per §8)
  gestureProfile: GestureProfile;      // per-puzzle tuning (see §8.5)

  // Pedagogy (custom, per §9)
  tutorial: LessonSet;
}
```

---

## 5. Repository Structure

```
handcube/
├── apps/
│   └── web/                         # Vite React app
│       ├── src/
│       │   ├── core/
│       │   │   ├── puzzles/
│       │   │   │   ├── PuzzlePlugin.ts        # shared interface (§4.1)
│       │   │   │   ├── cube3/
│       │   │   │   ├── pyraminx/
│       │   │   │   ├── skewb/
│       │   │   │   ├── mastermorphix/
│       │   │   │   └── megaminx/
│       │   │   ├── geometry/
│       │   │   │   ├── csgBuilder.ts          # shared CSG utility (§7.1)
│       │   │   │   └── shapeMod.ts            # vertex-remap for Mastermorphix (§7.4)
│       │   │   ├── solvers/
│       │   │   │   ├── kociemba.worker.ts
│       │   │   │   └── layerMethods/          # hand-authored per-puzzle methods
│       │   │   ├── gestures/
│       │   │   │   ├── HandLandmarkerService.ts
│       │   │   │   ├── GestureRecognizer.ts   # FSM, framework-agnostic, pure
│       │   │   │   └── InteractionController.ts
│       │   │   └── tutorial/
│       │   │       ├── LessonEngine.ts
│       │   │       └── lessons/               # data files, per §9.2
│       │   ├── components/
│       │   │   ├── PuzzleCanvas.tsx           # r3f scene
│       │   │   ├── CameraDebugOverlay.tsx
│       │   │   ├── HintOverlay.tsx
│       │   │   └── screens/                   # one per §10 screen
│       │   ├── state/                         # zustand stores
│       │   └── styles/
│       ├── public/models/                     # mediapipe .task model files (self-hosted, see §8.1)
│       └── tests/
│           ├── unit/
│           └── e2e/
├── .github/workflows/ci.yml
└── README.md                                   # your portfolio front door — see §14
```

---

## 6. Puzzle Logic Layer

### 6.1 Wiring up `cubing.js`

```ts
import { KPuzzle, KPuzzleDefinition } from "cubing/kpuzzle";
import { puzzles } from "cubing/puzzles";
import { Alg } from "cubing/alg";
import { randomScrambleForEvent } from "cubing/scramble";

const def: KPuzzleDefinition = await puzzles["megaminx"].def();
const kpuzzle = new KPuzzle(def);
kpuzzle.applyAlg(new Alg("R++ U D--")); // example megaminx-notation moves
```

Do this for cube3 (`"3x3x3"`), pyraminx (`"pyraminx"`), skewb (`"skewb"`), and megaminx (`"megaminx"`) directly. **Mastermorphix uses the `"3x3x3"` definition too** — see §6.3.

### 6.2 3x3 optimal solving (Web Worker)

```ts
// kociemba.worker.ts
import { solve } from "cube-solver"; // or your chosen Kociemba/min2phase port
self.onmessage = (e) => {
  const facelets = e.data.facelets;   // derived from kpuzzle state
  const solution = solve(facelets);
  self.postMessage(solution);
};
```
Initialize the worker and warm up its pruning tables at app startup (behind a loading spinner on first visit), not on first solve press — this is a small but real UX/engineering detail worth calling out in your write-up.

### 6.3 Mastermorphix: reuse, don't reinvent

Mastermorphix is a *shape modification* of the 3x3 — same 26-piece mechanism, same permutation group, different outer plastic shape. Concretely:
1. Drive its state with the `"3x3x3"` KPuzzle definition — moves, scrambling, and even the Kociemba solver all "just work" unmodified.
2. Only the **geometry layer** differs: instead of rendering the standard cube pieces, render tetrahedrally-reshaped pieces (§7.4) whose mesh is keyed to the same corner/edge/center piece IDs as the cube.
3. The tutorial explicitly teaches this transfer as a concept: *"This puzzle has the exact mechanism of a 3x3 cube — if you can solve one, you can solve the other."* That's a genuinely nice pedagogical moment that most puzzle apps never surface.

### 6.4 Beginner layer methods (Pyraminx, Skewb, Megaminx)

These are authored as static data (move sequences keyed to recognized state patterns), not searched for at runtime:
- **Pyraminx**: trivial tips (always 1 move each) → align the 3 axial centers → solve the last layer using a small fixed algorithm set (4-6 cases).
- **Skewb**: solve one layer intuitively (fixed heuristic: rotate any two adjacent corners into place) → fixed final-layer algorithm (Sarah's method has a single 6-move algorithm covering all remaining cases up to rotation).
- **Megaminx**: star (first-layer edges) → first-layer corners → second layer (F2L-equivalent, intuitive) → last-layer edges orientation → last-layer permutation, using a small fixed algorithm table analogous to 3x3 OLL/PLL but for a pentagonal last layer.

Write these as an internal DSL so the Tutorial Engine (§9) can consume the exact same data both to *narrate* the method and to *validate* the user's moves.

---

## 7. Rendering & Procedural Geometry Layer

### 7.1 Shared CSG utility

```ts
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import * as THREE from "three";

function cutSolid(base: THREE.BufferGeometry, planes: CutPlane[]): PieceMesh[] {
  // For each plane, intersect the running brush against the half-space
  // it defines, producing one piece per resulting cell. Cache the result —
  // CSG evaluation is comparatively expensive and only needs to run once
  // per puzzle type at load time (or at build time, see §12.1).
}
```

`three-bvh-csg` is an actively maintained (700+ star), BVH-accelerated CSG library built specifically for Three.js — dramatically faster than older BSP-based CSG approaches for this kind of repeated slicing.

### 7.2 Base solids — use Three.js's built-ins, don't hand-derive coordinates

| Puzzle | Base solid | Three.js constructor |
|---|---|---|
| 3x3 Cube | Cube | `new THREE.BoxGeometry(3, 3, 3)` |
| Skewb | Cube | `new THREE.BoxGeometry(3, 3, 3)` (different cut planes, see §7.3) |
| Pyraminx | Tetrahedron | `new THREE.TetrahedronGeometry(r)` |
| Mastermorphix | Tetrahedron (visual) driven by cube (logical) | `new THREE.TetrahedronGeometry(r)` + vertex remap, see §7.4 |
| Megaminx | Dodecahedron | `new THREE.DodecahedronGeometry(r)` |

### 7.3 Cutting-plane definitions per puzzle

| Puzzle | Cut rule | Result |
|---|---|---|
| 3x3 Cube | 2 axis-aligned planes per axis (x, y, z), each offset ±0.5 units from center | 27 sub-cubes (26 visible pieces + hidden core) |
| Skewb | 4 planes, each passing **through the center**, perpendicular to one of the cube's 4 body diagonals | 8 corner pieces + 6 center pieces |
| Pyraminx | For each of the tetrahedron's 4 vertex-axes (vertex → opposite face centroid): one cutting plane at 1/3 of the way along the axis (separates the trivial tip) and one at 2/3 (separates edge pieces from the axial center piece) | 4 tips + 6 edges + 4 axial centers |
| Megaminx | For each of the dodecahedron's 12 face-normal axes: one cutting plane parallel to that face, at a fixed depth from center | 20 corners + 30 edges + 12 face centers |

Feed each rule into the shared `cutSolid()` utility from §7.1 — this is precisely why building one general-purpose CSG pipeline instead of five bespoke ones is worth the upfront investment.

### 7.4 Mastermorphix: shape-mod via vertex remapping

This is the single most technically interesting piece of custom geometry work in the project — a great thing to walk through in an interview.

1. Generate the 3x3 cube's 26 pieces exactly as in §7.3.
2. Establish a correspondence between the cube's 8 corners and the tetrahedron's 4 vertices, such that 4 alternating cube corners map onto the 4 tetrahedron vertices, and the other 4 cube corners map onto the 4 face-centroids of the tetrahedron (this is the same "corner-stretch" logic real shape-mod designers use when they warp a cube into a tetrahedron).
3. Write a `remapVertex(cubeSpacePosition) → tetrahedronSpacePosition` function (a piecewise-linear or barycentric interpolation driven by which reference corner/edge/face a given piece vertex belongs to) and apply it to every piece's outer (visible) vertices, leaving each piece's internal adjacency/pivot logic completely untouched.
4. Validate visually: turning any face should still look and behave exactly like a 3x3 turn, just wrapped in tetrahedral plastic.

### 7.5 Syncing geometry to state

After every `applyMove`, walk the KPuzzle's facelet-permutation array and, via `pieceIdForFacelet`, look up which mesh piece currently occupies each logical slot; animate that piece to its new orientation/position. Keep this as one small, well-tested function (`syncMeshToState`) — it's the seam between the "reused" logic layer and the "built" geometry layer, and bugs here are the most likely source of "cube looks scrambled but claims to be solved" issues.

---

## 8. Hand-Tracking & Gesture Engine

### 8.1 Setup

```ts
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "/mediapipe/wasm" // self-host the WASM assets rather than hitting the CDN on every load
);
const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "/models/hand_landmarker.task", // self-hosted copy of Google's model
    delegate: "GPU",
  },
  runningMode: "VIDEO",
  numHands: 2,
});
```
Self-host both the WASM runtime and the `.task` model file (download once, commit to `public/`) so the app works offline after first load and isn't dependent on a third-party CDN at runtime — both a robustness win and a PWA-offline win worth mentioning in your README.

### 8.2 Key landmark math

MediaPipe returns 21 3D landmarks per hand. The ones you need:
| Landmark index | Point | Used for |
|---|---|---|
| 0 | Wrist | Anchor/fist center, orbit reference |
| 4 | Thumb tip | Pinch distance |
| 8 | Index fingertip | Pinch distance, pointing/raycast origin |
| 5, 17 | Index MCP, Pinky MCP | Palm-normal vector (cross product of MCP-to-MCP and MCP-to-wrist vectors) → used for open-palm detection and wrist roll angle |

```ts
const pinchDistance = distance(landmarks[4], landmarks[8]);
const isPinching = pinchDistance < PINCH_THRESHOLD; // calibrated per-user, §8.4

const palmNormal = cross(
  subtract(landmarks[17], landmarks[5]),
  subtract(landmarks[0], landmarks[5])
);
const wristRoll = angleAroundAxis(palmNormal, forwardCameraAxis); // drives TWIST
```

### 8.3 Gesture state machine

| State | Trigger to enter | Trigger to exit | Emits |
|---|---|---|---|
| `IDLE` | default | any hand detected | — |
| `ORBITING` | one hand open, no pinch, moving | pinch detected, or hand lost | `ORBIT(dx, dy)` continuously |
| `ANCHORED` | one hand forms a fist and holds position (variance < ε over ~300ms) | fist released | enables the other hand's `GRAB` state |
| `GRABBING` | pinch detected over a raycast-hit facelet, while the other hand is `ANCHORED` | pinch released | `GRAB(pieceId)` once, then continuous `TWIST(angleDelta)` |
| `COMMITTING` | pinch released while `GRABBING`, near a valid snap angle | animation completes | one `Move`, pushed to history |

Implement this as a **pure, framework-agnostic function** — `(prevState, landmarkFrame) → nextState + emittedEvents` — with zero Three.js or React dependencies. This lets you unit test the entire gesture vocabulary against recorded/synthetic landmark sequences with no camera, no WebGL, and no flakiness in CI (a genuinely strong engineering practice to highlight).

### 8.4 Calibration flow

First run (and re-runnable from Settings):
1. "Show an open palm" → sample palm-normal/spread over 2 seconds → set open-palm confidence threshold.
2. "Make a fist" → sample curl distances → set fist threshold.
3. "Pinch your thumb and index finger" → sample pinch distance at rest vs. pinched → set `PINCH_THRESHOLD` at the midpoint, scaled by the user's measured hand size (distance between landmarks 0 and 9 as a normalizing factor, so thresholds work regardless of distance from camera).

### 8.5 Per-puzzle gesture tuning (`GestureProfile`)

Puzzles are not geometrically equivalent, so the interaction needs small per-puzzle adjustments:
| Puzzle | Adjustment |
|---|---|
| 3x3 / Mastermorphix | Standard layer-grab; snap angle = 90° |
| Pyraminx | Snap angle = 120°; tip pieces get a larger hit-box since they're small and easy to miss |
| Skewb | Grab targets a corner piece; twist axis is the body-diagonal through that corner (not screen-relative), snap angle = 120° |
| Megaminx | 12 closely-packed pentagonal faces make direct pinch-to-grab error-prone at a glance; use a two-step **hover-to-highlight, then pinch-to-confirm** selection mode instead of instant grab; snap angle = 72° |

### 8.6 Fallback controls

Mouse drag and keyboard (arrow keys + modifiers for direction) must implement the *exact same* `Move` events as the gesture path, going through the same `InteractionController`. Treat gestures as one of several input adapters, never the only one — this is both an accessibility requirement and your safety net when lighting/camera conditions are poor.

---

## 9. Tutorial System ("HandCube Academy")

### 9.1 Pedagogical structure

1. **Gesture onboarding** (puzzle-agnostic, once): practice orbit/anchor/grab/twist on a consequence-free sandbox cube.
2. **Per-puzzle beginner track**: concept → guided step (ghost-arrow hint) → validated free step → chained guided solve → freestyle solve.
3. **Algorithm trainer** (post-beginner, optional): flashcard drilling for last-layer algorithm sets (3x3 OLL/PLL and puzzle-equivalent sets), with a lightweight **spaced-repetition scheduler** (SM-2-style interval scheduling, same family of algorithm Anki uses) so returning users get quizzed on the algorithms they're shakiest on — a nice, genuinely useful feature that most cube apps skip entirely.

### 9.2 Lesson data schema

```ts
interface LessonStep {
  instructionText: string;
  highlightPieces: PieceId[];
  hintArrow?: { axis: string; direction: 1 | -1 };
  validate: (state: PuzzleState, moveHistory: Move[]) => boolean;
}
interface LessonTrack { name: string; steps: LessonStep[]; }
interface LessonSet { puzzleId: string; tracks: LessonTrack[]; }
```
Because this is data, not hardcoded UI flow, adding a 6th puzzle later only requires new geometry + a new `LessonSet` — the Academy UI itself doesn't change.

### 9.3 Progress persistence (IndexedDB schema)

| Store | Key | Value |
|---|---|---|
| `lessonProgress` | `${puzzleId}:${trackName}` | `{ completedSteps, lastPracticed, bestMoveCount }` |
| `algoTrainerStats` | `${puzzleId}:${algoCaseId}` | `{ easeFactor, interval, dueDate, correctStreak }` (SM-2 fields) |
| `solveTimes` | auto-increment | `{ puzzleId, moves, timeMs, date, wasGestureControlled }` |

That last field (`wasGestureControlled`) is a small addition that pays off later: you can report real usage statistics (e.g., "62% of solves in testing were completed entirely via gesture control") in your portfolio write-up.

---

## 10. UI/UX Screens

1. **Home** — puzzle picker with 3D thumbnail previews, "Continue lesson" card.
2. **Free Play** — full 3D puzzle, gesture + mouse/keyboard control, scramble/reset/solve, move counter, optional timer.
3. **Academy** — lesson list per puzzle with progress bars.
4. **Lesson runner** — puzzle + instruction panel + hint button + gesture confidence indicator.
5. **Algorithm Trainer** — flashcard UI, spaced-repetition queue, streaks.
6. **Calibration** — initial + re-runnable gesture calibration.
7. **Settings** — colorblind palette toggle, camera device picker, gesture sensitivity sliders, input mode toggle (hands/mouse/keyboard), reduced-motion toggle.

---

## 11. Color System

### 11.1 Puzzle face colors (physically accurate — skills transfer to a real puzzle)

**3x3 Cube & Skewb**
| Face | Color | Hex |
|---|---|---|
| Up | White | `#FFFFFF` |
| Down | Yellow | `#FFD500` |
| Front | Green | `#009E60` |
| Back | Blue | `#0051BA` |
| Right | Red | `#C41E3A` |
| Left | Orange | `#FF5800` |

**Pyraminx** (4 solid face colors)
| `#009E60` Green | `#C41E3A` Red | `#0051BA` Blue | `#FFD500` Yellow |

**Mastermorphix** (4 solid face colors, same reasoning as Pyraminx)
| `#C41E3A` Red | `#FFD500` Yellow | `#009E60` Green | `#0051BA` Blue |

**Megaminx** (12-color standard set)
| `#FFFFFF` White | `#A0A0A0` Grey | `#C41E3A` Red | `#FFD500` Yellow |
| `#6F2DA8` Purple | `#FF5800` Orange | `#0051BA` Blue | `#4AA8D8` Light Blue |
| `#009E60` Green | `#EC008C` Magenta | `#145A32` Dark Green | `#F5DEB3` Beige |

Offer a colorblind-friendly alternate palette (pattern-fill or high-contrast set) as a toggle.

### 11.2 App UI theme (kept neutral so puzzle colors stay the focal point)

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0F1117` | App background |
| `bg-surface` | `#1A1D27` | Panels/cards |
| `bg-surface-raised` | `#242837` | Modals |
| `text-primary` | `#F5F5F7` | Main text |
| `text-secondary` | `#9A9DB0` | Captions |
| `accent` | `#00D4FF` | Primary actions, hint arrows, active-gesture indicator |
| `accent-alt` | `#6C63FF` | Secondary highlights, progress bars |
| `success` | `#22C55E` | Solved / correct move |
| `warning` | `#F5A524` | Low tracking confidence |
| `error` | `#EF4444` | Incorrect move (tutorial mode) |
| Hand-skeleton overlay | `#39FF88` lines / `#00D4FF` joints | Calibration & debug view |

Consult the `frontend-design` skill when actually implementing UI components for layout/typography execution — this section only fixes the palette.

---

## 12. Performance Engineering

### 12.1 CSG cost management
CSG boolean evaluation is not free. Run it **once per puzzle type**, cache the resulting piece geometries (in memory for the session; optionally serialize to a binary format and ship pre-baked geometry as a build step so users never pay the CSG cost at all). Never re-run CSG per move — moves only rotate/reposition existing pieces, they never re-cut geometry.

### 12.2 Hand tracking frame budget
Run `HandLandmarker.detectForVideo` on `requestAnimationFrame`, but throttle actual gesture-state updates to ~20-30Hz if the device reports lower GPU tiers; always keep the render loop itself uncapped/at display refresh rate so the puzzle stays visually smooth even if tracking updates less often.

### 12.3 Three.js
Use instancing for identical small pieces where possible (e.g., Pyraminx's 4 tips), keep draw calls low via merged static geometry for non-moving background elements, and profile with the Three.js devtools extension before optimizing blindly.

### 12.4 Solver workers
Keep the Kociemba worker warm (initialized once at app start, not per solve). For layer-method solvers (Pyraminx/Skewb/Megaminx), these are cheap lookups, not searches, so no worker is needed there.

---

## 13. Testing Strategy

| Layer | Tool | What to test |
|---|---|---|
| Puzzle logic | Vitest | `applyMove`/`isSolved`/scramble round-trips against `cubing/kpuzzle`, for all 5 plugins |
| Solver correctness | Vitest | Apply solver output to a scrambled state, assert solved, for every puzzle's solving strategy |
| Gesture recognizer | Vitest | Feed synthetic/recorded landmark sequences, assert correct event emission — no camera needed, deterministic, fast |
| Geometry | Vitest + snapshot | CSG piece counts match expected (e.g., cube3 → 26 visible pieces, skewb → 14, megaminx → 62) |
| E2E | Playwright | Full flows using mocked `getUserMedia`/synthetic landmark injection — scramble → solve button → verify solved state |
| CI | GitHub Actions | Run all of the above on every PR; block merge on failure |

---

## 14. Portfolio / Resume Packaging

This section is as important as the code — a great project poorly presented undersells itself.

### 14.1 README structure
1. 15-second GIF/video at the very top showing a real solve via hand gestures (this single asset does more work than any paragraph of text).
2. One-paragraph pitch (adapt §0).
3. Architecture diagram (adapt §4's ASCII diagram into a clean image).
4. "Why this is hard" section — briefly explain the CSG geometry pipeline and the gesture FSM, since these are the parts a reviewer will find most interesting.
5. Prior art / differentiation table (adapt §1.3) — shows research maturity, not just coding.
6. Tech stack badges, live demo link, local setup instructions.
7. Test/CI status badge.

### 14.2 Suggested resume bullets (adapt to your actual results once built)
- "Built a browser-based multi-puzzle twisty-puzzle simulator (3x3, Pyraminx, Skewb, Megaminx, and a custom shape-modification puzzle) controlled entirely by two-handed webcam gesture tracking (MediaPipe), with zero backend."
- "Designed a procedural CSG-based geometry engine (Three.js + three-bvh-csg) generating puzzle meshes from Platonic-solid cut-plane definitions, including an original vertex-remapping technique to render a non-standard shape-modification puzzle."
- "Implemented a finite-state gesture recognizer decoupled from rendering and camera input, enabling deterministic unit testing of hand-gesture logic without hardware."
- "Built an integrated tutoring system with spaced-repetition algorithm drilling, teaching complete beginners to solve five distinct puzzle types."

### 14.3 Demo video script (60-90s)
1. (5s) Puzzle picker screen — show puzzle variety.
2. (20s) Free play on 3x3: orbit with open palm, anchor with fist, pinch-grab-twist a layer, show it snap.
3. (15s) Switch to Megaminx or Mastermorphix — proves multi-puzzle generality.
4. (20s) Academy mode: a lesson step with the hint arrow, user completes it correctly, green success flash.
5. (10s) Solve button on a scrambled 3x3 — show the animated solution playing out.
6. (10s) Settings — colorblind palette toggle, calibration screen.

### 14.4 Write-up outline (for a personal blog/portfolio page)
1. The idea and why it's more than a novelty.
2. The prior-art research and the build-vs-reuse decision (§1-2) — reviewers value seeing you didn't reinvent solved problems.
3. Deep dive: the CSG shape-mod technique for Mastermorphix.
4. Deep dive: designing the two-hand anchor/actuator gesture metaphor and why discrete pose-mapping (what others do) falls short.
5. What you'd do differently / stretch goals (§16) — shows reflective engineering judgment.

---

## 15. Suggested Build Order (phased, with definition-of-done)

| Phase | Deliverable | Definition of done |
|---|---|---|
| 0 | Scaffolding | Vite/React/TS/Tailwind repo builds and deploys an empty shell to Vercel |
| 1 | 3x3 logic + mouse control | `cubing/kpuzzle` wired up; CSG-generated cube renders; mouse-drag turns work; `isSolved` correct |
| 2 | 3x3 solver | Kociemba worker returns valid, verified solutions; "Solve" button animates them |
| 3 | Hand tracking pipeline | `HandLandmarker` running, skeleton overlay visible, calibration screen functional |
| 4 | Gesture recognizer + controller | Full FSM (§8.3) implemented and unit-tested; gesture control fully replaces/augments mouse on the 3x3 |
| 5 | Tutorial engine + first lesson track | Beginner 3x3 layer-by-layer lessons playable end to end with hints and validation |
| 6 | Pyraminx + Skewb | New `PuzzlePlugin`s validate the architecture generalizes; both have working beginner lesson tracks |
| 7 | Mastermorphix | Vertex-remap CSG technique implemented; state reuses 3x3 `cubing/kpuzzle` definition; lesson explicitly teaches the transfer concept |
| 8 | Megaminx | Largest lift: 12-color scheme, hover-then-pinch gesture mode, full beginner method authored |
| 9 | Algorithm Trainer | Spaced-repetition flashcards live for at least 3x3 OLL/PLL |
| 10 | Polish & accessibility | Colorblind palette, full keyboard-only path verified, performance profiling done, PWA installable |
| 11 | Portfolio packaging | README, demo video, write-up, live deployed link — per §14 |

---

## 16. Risk Register

| Risk | Mitigation |
|---|---|
| Hand tracking unreliable in poor lighting | Confidence indicator + prompt to improve lighting; mouse/keyboard always fully functional |
| CSG numerical edge cases (non-manifold geometry) on unusual cuts (Skewb's diagonal planes, Mastermorphix's remap) | Budget explicit debugging time here; `three-bvh-csg`'s own docs flag this as a known limitation — validate piece counts/watertightness with automated geometry tests (§13) |
| Megaminx gesture precision (12 tightly packed faces) | Hover-to-highlight-then-confirm interaction mode (§8.5) instead of instant grab |
| Scope creep across 5 puzzle types | Strict phase gating (§15) — do not start Phase 7 until Phase 6's puzzles have passing tests and a working lesson track |
| MediaPipe model/WASM asset size hurting load time | Self-host, lazy-load only when the user opens a gesture-enabled screen, show a clear loading state |

---

## 17. Stretch Goals

- Additional puzzles: 2x2, 4x4, Square-1, Ivy Cube (all already representable via `cubing/kpuzzle` for logic — mostly a geometry + lesson-content exercise once the pipeline exists).
- Multiplayer race mode (shared scramble, two camera feeds, first to solve wins).
- Voice-narrated hints (Web Speech API) for accessibility.
- Solve replay export as a shareable clip.
- Mobile browser support (phone camera) — will need gesture threshold retuning for a closer, narrower field of view.
