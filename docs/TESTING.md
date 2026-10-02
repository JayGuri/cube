# Cubit manual test checklist

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
- [ ] Press **Scramble**: the cube scrambles and **no guide appears** — you solve it yourself.
- [ ] Press **Guide me**: the Guided solve panel appears.
- [ ] Make 2–3 turns from solved, then **Guide me**: it shows just those turns undone (not a long solution).
- [ ] The gold arrow wraps the layer named in the panel, pointing the way it turns.
- [ ] Doing the shown move (sign, key, or drag) advances to the next step.
- [ ] Doing a **different** move: the panel shows "Finding the shortest solution…", then new steps from where the cube is now.
- [ ] Undo during the guide also re-solves.
- [ ] Following every step ends with "Solved!" and the cube shows Solved.
- [ ] **Stop** hides the guide; **Guide me** brings it back.
- [ ] **Reset** and **Solve** both end the guide.

## 6. Mirror Cube (Home › Mirror Cube)
- [ ] It's silver, and a solved cube is a clean block whose layers have different thicknesses.
- [ ] Any turn changes the outline — pieces of different sizes stick out.
- [ ] A turn then its opposite (e.g. `R` then `Shift+R`) returns the clean block and shows Solved.
- [ ] Dragging a piece turns a layer, also after several turns.
- [ ] Scramble, Solve for me, Guide me (with the arrow) and hand signs all work as on the 3x3.

## 7. Solve for me (both cubes)
- [ ] After Scramble, **Solve for me** shows "Finding the shortest solution…", then a player at the top of the cube.
- [ ] It starts playing on its own. The pause button stops it between moves; play resumes.
- [ ] While paused, the next and previous arrows step one move forward or back, and the cube follows.
- [ ] 2x and 4x make the turns faster. "show moves" lists every move with the current one highlighted.
- [ ] The step count (quarter turns) matches what the Guide would show.
- [ ] Making your own move, Reset or Scramble closes the player.

## 8. Academy (Home › Academy)
- [ ] The list shows eight lessons, and "Start lesson 1" opens the first.
- [ ] The cube is shown with white at the bottom and yellow on top.
- [ ] Lesson 1 completes after four turns. "Next lesson" appears.
- [ ] In each later lesson **Show me** restarts the practice position and the guide shows the algorithm; following it completes the lesson.
- [ ] **New position** cycles through the practice positions; **Restart position** resets the current one.
- [ ] A wrong move during Show me says so (no re-solve) and **Undo** takes it back.
- [ ] Finished lessons show a tick on the list and the dots on Home's Academy tile fill in. "Clear my progress" empties them.
- [ ] Hand signs and keys work inside lessons too.

## 9. Look and feel
- [ ] Home: the hero cube scrambles and solves itself, and leans toward the mouse.
- [ ] "Raise fingers. Turn a layer.": clicking fingers selects a sign, holding it fills the ring and turns that layer. Right hand turns clockwise, left hand the other way.
- [ ] The left hand's icon puts the pinky on the left (ring + pinky lights the two leftmost bars). Right hand is yellow, left hand is blue everywhere.
- [ ] The three puzzle tiles lead to the 3x3, the Mirror Cube and the Academy.
- [ ] The "How to turn the cube" card appears on first visit and stays hidden after you close it.
- [ ] The tab shows the Cubit cube icon, not the default Vite one.

## 10. Feel and tuning (no right answer — just tell me)
- [ ] Is the hold before a sign turns too long or too short?
- [ ] Are any signs hard to make or often misread? Which ones?
- [ ] Is hand-orbit too fast or too slow?

Tuning values live in `src/core/gestures/signGestures.ts` (`DEFAULT_SIGN_OPTIONS`)
and are listed with file and line in the session notes.
