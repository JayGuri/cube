# Guide opt-in, site redesign, Mirror Cube — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Make the Kociemba guide opt-in, give the site a polished self-explanatory design, and add a silver shape-based 3x3 Mirror Cube that works with every existing input and the guide.

**Architecture:** The guide already lives in FreePlay; it only stops auto-starting. The redesign is presentational (Home, FreePlay layout, a first-visit "how it works" strip) and keeps every `data-testid` the E2E suite depends on. The Mirror Cube is a new puzzle plugin that reuses the 3x3's group logic (same moves, same solver) but tracks each piece's real position and rotation so its *shape* can move with it; a dedicated renderer draws silver boxes sized by where each piece started.

**Tech Stack:** React 19, three.js / react-three-fiber, cubing.js (KPuzzle), cube-solver (Kociemba), Vitest, Playwright.

**Acceptance (what "done" means):**
- A1. Scramble never shows the guide by itself. A clearly labelled **Guide me** button (and nothing else) starts it. Self-solve is the default.
- B1. Home explains in one glance what the app is and how to start; FreePlay has one clean toolbar, readable panels, and a dismissible "how to play" strip for first-time users.
- C1. Home offers "Mirror Cube"; `/play/mirror` renders a silver cube whose pieces have different thicknesses.
- C2. Every turn moves pieces' *shapes*: after any move sequence the rendered pieces sit exactly where the 3x3 logic says.
- C3. Solved ⇔ the original cuboid shape. Scramble, Solve, Undo, Reset, keyboard, mouse drag, hand signs and the guide all work on it.
- All unit + E2E tests green; build and lint clean; visual check in a browser.

---

## Mirror Cube design (decided)

A real Mirror Blocks offsets its internal cuts, so every piece has different
thicknesses. Here, the **outer faces** are offset instead and the three middle
layers stay 1.0 thick and centred. Consequences:

- Every centre is a 1×1 square on its own axis, so its rotation is never
  visible. The solved state is then exactly the 3x3's solved state ignoring
  centre orientation, which is what Kociemba solves. No extra centre-twist
  algorithms are needed.
- Outer thicknesses, all distinct and none equal to 1, make every corner and
  edge unique and its orientation visible:
  `R 1.40, L 0.60, U 1.25, D 0.75, F 1.15, B 0.85`.

Pieces are tracked as `{ home: [x,y,z], rotation: 3x3 integer matrix }`.
Current slot = `rotation · home`. A move rotates every piece whose current slot
has `coord[axis] === layer` by the same signed 90° that `parseCubeMove`
animates (already verified against the real cube). The piece's box is built
from its *home* slot's extents and drawn with the piece's rotation, so its shape
travels with it.

**Ground-truth test:** run the same tracker over the 3x3's coloured stickers and
compare with `faceletColors` from cubing.js for random scrambles. If the tracker
matches the real cube for colours, it matches for shapes.

---

### Task 1: Guide becomes opt-in (A1)
**Files:** Modify `src/components/screens/FreePlay.tsx` (`handleScramble`: drop the trailing `startGuide()`); `tests/e2e/guided-solve.spec.ts` (click `guide-me` after scramble; add "scramble does not open the guide" test).
**Verify:** `npx playwright test tests/e2e/guided-solve.spec.ts` → all pass.
**Commit:** `feat: the Kociemba guide is opt-in -- Scramble lets you solve it yourself`

### Task 2: Mirror piece tracker (C2) — pure, test-first
**Files:** Create `src/core/puzzles/mirror/pieces.ts`, `pieces.test.ts`.
- `createPieces()`, `applyMoveToPieces(pieces, notation)`, `currentSlot(piece)`.
- Test 1: R⁴, U⁴, M⁴ … return every piece to identity.
- Test 2 (ground truth): for 20 random scrambles, colour each tracked piece's stickers by its home faces rotated, and compare with cube3 `faceletColors` for the same moves → identical.
**Verify:** `npx vitest run src/core/puzzles/mirror`.
**Commit:** `feat(mirror): track each piece's real position and rotation`

### Task 3: Mirror geometry + plugin (C1, C3)
**Files:** Create `src/core/puzzles/mirror/geometry.ts` (`MIRROR_EXTENTS`, `pieceBox(home)`), `src/core/puzzles/mirror/index.ts` (`createMirrorPlugin`: cube3 logic for moves/solve/scramble; state = `{ pattern, pieces }`), tests. Modify `PuzzlePlugin.ts` (`PuzzleId` adds `'mirror'`), `registry.ts`, `registry.test.ts`.
**Verify:** unit tests: solved after scramble+solve; each piece box size matches the extents.
**Commit:** `feat(mirror): Mirror Cube plugin on the 3x3's moves and solver`

### Task 4: Mirror renderer (C1, C2)
**Files:** Create `src/components/MirrorPieces.tsx` (silver metallic boxes with dark seams; animates by rotating pieces in the moving layer about the axis, then commits); modify `PuzzleCanvas.tsx` to render it when `plugin.id === 'mirror'` and route its drag starts (current slot + world normal) into the existing `moveFromDrag` path.
**Verify:** browser screenshot solved + after `R U`; E2E `mirror.spec.ts` (loads, keyboard turn, scramble → solve → Solved).
**Commit:** `feat(mirror): silver shape-shifting renderer`

### Task 5: Redesign (B1)
**Files:** `src/components/screens/Home.tsx` (hero, two puzzle cards, three-step "how it works"); `FreePlay.tsx` (single toolbar: Scramble · Undo · Reset · Guide me · Solve, input switch, lock; first-visit tips strip, dismissal remembered in localStorage); `HandsGuide.tsx` (tidier key). Keep all existing `data-testid`s.
**Verify:** full E2E; screenshots of Home, FreePlay (mouse), FreePlay (hands), Mirror.
**Commit:** `feat(ui): cleaner, self-explanatory design`

### Task 6: Docs + final verification
**Files:** `docs/TESTING.md` (guide opt-in, mirror section), `docs/MATH.md` (mirror section).
**Verify:** `npm run build`, `npm run lint`, `npx vitest run`, `npx playwright test` all green.
**Commit:** `docs: mirror cube and opt-in guide`

**Parallelism:** Tasks 2–3 (pure mirror core, new files only) run in a background agent in an isolated worktree while Tasks 1 and 5 proceed here; Task 4 integrates after.
