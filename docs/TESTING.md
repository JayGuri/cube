# HandCube manual test checklist

Run `npm run dev`, open the URL it prints, then **Start solving**. Tick each
box; for anything that fails, note *what you did* and *what happened instead*.

## 1. Basics (mouse + keyboard)
- [ ] Home page shows only the 3x3 card; clicking it opens the cube.
- [ ] Left-drag on a piece turns a layer, and the animation matches the final result.
- [ ] Left-drag on empty space or right-drag anywhere orbits the camera; scroll zooms.
- [ ] Keys `R U F L D B` turn clockwise; `Shift`+key turns counter-clockwise.
- [ ] Undo steps back one move. Reset returns to solved.
- [ ] Orange and red look clearly different.

## 2. View lock
- [ ] **Lock view** button: orbit and zoom stop working, layer turns still work.
- [ ] `Space` toggles the lock on and off.
- [ ] (Hands mode) Hold a closed fist still for about 1 s: the ring fills and the lock toggles.
- [ ] Keep holding the fist: it does **not** flicker on/off. Open your hand and repeat to unlock.

## 3. Hand signs (switch to **Hands**)
Check the tracking indicator says "Tracking well" before each test.
- [ ] Right hand, index finger up, held still: ring fills, **R** turns clockwise.
- [ ] Left hand, same sign: **R'** (counter-clockwise).
- [ ] Each of the 9 signs in the key, on **both** hands (18 moves total):

  | Sign | Right hand | Left hand |
  |---|---|---|
  | index | [ ] R | [ ] R' |
  | index + middle | [ ] U | [ ] U' |
  | index + middle + ring | [ ] F | [ ] F' |
  | pinky | [ ] L | [ ] L' |
  | ring + pinky | [ ] D | [ ] D' |
  | middle + ring + pinky | [ ] B | [ ] B' |
  | index + pinky | [ ] M | [ ] M' |
  | middle + ring | [ ] E | [ ] E' |
  | index + middle + pinky | [ ] S | [ ] S' |
- [ ] The HUD at the bottom shows the right letter and hand **before** the turn happens.
- [ ] While a sign is held, the rest of the cube dims and the chosen layer keeps its true colours.
- [ ] Holding a sign for a long time turns it **once**. Relax, sign again: it turns again.
- [ ] Flashing a sign briefly, or dropping your hand mid-hold, turns **nothing**.
- [ ] Moving between signs (e.g. index, then index + middle) causes no accidental turns.
- [ ] Both hands signing at once: both layers turn.
- [ ] If right-hand signs come out as left-hand moves: Settings › **Swap left and right hand** fixes it.

## 4. Camera control by hand
- [ ] Open hand, no sign: moving it orbits the camera.
- [ ] Holding a 3-finger sign does **not** drift the camera.
- [ ] Two open hands: spreading apart / together zooms.
- [ ] With the view locked, neither of these moves the camera.

## 5. Guided solve
- [ ] Press **Scramble**: the cube scrambles, then the Guided solve panel appears.
- [ ] The gold arrow wraps the layer named in the panel, pointing the way it turns.
- [ ] Doing the shown move (sign, key, or drag) advances to the next step.
- [ ] Doing a **different** move: the panel shows "Finding the shortest solution…", then new steps from where the cube is now.
- [ ] Undo during the guide also re-solves.
- [ ] Following every step ends with "Solved!" and the cube shows Solved.
- [ ] **Stop** hides the guide; **Guide me** brings it back.
- [ ] **Reset** and **Solve** both end the guide.

## 6. Feel and tuning (no right answer — just tell me)
- [ ] Is the hold before a sign turns too long or too short?
- [ ] Are any signs hard to make or often misread? Which ones?
- [ ] Is hand-orbit too fast or too slow?

Tuning values live in `src/core/gestures/signGestures.ts` (`DEFAULT_SIGN_OPTIONS`)
and are listed with file and line in the session notes.
