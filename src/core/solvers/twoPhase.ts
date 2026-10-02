// Kociemba's two-phase algorithm, written from scratch for Cubit.
//
// WHY OUR OWN: the off-the-shelf solver we started with stops at the first
// answer it finds, so a position three turns from solved could come back as a
// 21-move solution. This one keeps searching until its time budget runs out and
// only ever replaces its answer with a strictly shorter one.
//
// THE IDEA. A cube has 43 quintillion states, far too many to search. Kociemba
// splits the problem in two:
//
//   Phase 1  get into the subgroup G1 = <U, D, R2, L2, F2, B2>. A cube is in G1
//            when every corner and edge is oriented correctly and the four
//            "slice" edges (FR FL BL BR) sit in the middle layer. That needs
//            only three small coordinates:  corner twist (3^7 = 2187),
//            edge flip (2^11 = 2048)  and  slice position (C(12,4) = 495).
//   Phase 2  inside G1, finish using only G1's ten moves. The state is again
//            three small coordinates: corner permutation (8! = 40320), the eight
//            non-slice edges' permutation (8! = 40320) and slice permutation (4! = 24).
//
// Each phase is an IDA* search (iterative-deepening depth-first search) guided
// by pruning tables: for every pair of coordinates, the exact number of moves
// needed to reach the goal, found once by breadth-first search. A table value
// never over-estimates, so cutting a branch whose table value exceeds the
// remaining depth never loses a solution.
//
// To improve on the first solution we keep going: phase 1 is deepened one move
// at a time, and every phase-1 ending is offered to phase 2 with a tighter and
// tighter limit on the total.
//
// The measure of "short" is the one the on-screen guide uses: quarter turns,
// where R2 costs two steps because a person makes it with two turns.

/** Moves are numbered face * 3 + (0: clockwise, 1: half turn, 2: counter-clockwise). */
const FACE_LETTERS = 'URFDLB'
const N_MOVES = 18

// ---- Cubie model ---------------------------------------------------------
// Corners: URF UFL ULB UBR DFR DLF DBL DRB.  Edges: UR UF UL UB DR DF DL DB FR FL BL BR.
interface Cubie {
  cp: number[] // which corner sits in each corner slot
  co: number[] // its twist, 0..2
  ep: number[] // which edge sits in each edge slot
  eo: number[] // its flip, 0..1
}

const [URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB] = [0, 1, 2, 3, 4, 5, 6, 7]
const [UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const zeros = (n: number) => new Array<number>(n).fill(0)

// The six clockwise quarter turns, as permutations plus orientation changes.
const BASIC_MOVES: Cubie[] = [
  // U
  { cp: [UBR, URF, UFL, ULB, DFR, DLF, DBL, DRB], co: zeros(8), ep: [UB, UR, UF, UL, DR, DF, DL, DB, FR, FL, BL, BR], eo: zeros(12) },
  // R
  { cp: [DFR, UFL, ULB, URF, DRB, DLF, DBL, UBR], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [FR, UF, UL, UB, BR, DF, DL, DB, DR, FL, BL, UR], eo: zeros(12) },
  // F
  { cp: [UFL, DLF, ULB, UBR, URF, DFR, DBL, DRB], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [UR, FL, UL, UB, DR, FR, DL, DB, UF, DF, BL, BR], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
  // D
  { cp: [URF, UFL, ULB, UBR, DLF, DBL, DRB, DFR], co: zeros(8), ep: [UR, UF, UL, UB, DF, DL, DB, DR, FR, FL, BL, BR], eo: zeros(12) },
  // L
  { cp: [URF, ULB, DBL, UBR, DFR, UFL, DLF, DRB], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [UR, UF, BL, UB, DR, DF, FL, DB, FR, UL, DL, BR], eo: zeros(12) },
  // B
  { cp: [URF, UFL, UBR, DRB, DFR, DLF, ULB, DBL], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [UR, UF, UL, BR, DR, DF, DL, BL, FR, FL, UB, DB], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
]

const SOLVED: Cubie = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: zeros(8),
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: zeros(12),
}

/** `a` then `b`. */
function multiply(a: Cubie, b: Cubie): Cubie {
  const cp: number[] = []
  const co: number[] = []
  const ep: number[] = []
  const eo: number[] = []
  for (let c = 0; c < 8; c++) {
    cp[c] = a.cp[b.cp[c]]
    co[c] = (a.co[b.cp[c]] + b.co[c]) % 3
  }
  for (let e = 0; e < 12; e++) {
    ep[e] = a.ep[b.ep[e]]
    eo[e] = (a.eo[b.ep[e]] + b.eo[e]) % 2
  }
  return { cp, co, ep, eo }
}

// All 18 moves: each face turned once, twice and three times.
const MOVES: Cubie[] = []
for (let f = 0; f < 6; f++) {
  let m = BASIC_MOVES[f]
  for (let p = 0; p < 3; p++) {
    MOVES.push(m)
    m = multiply(m, BASIC_MOVES[f])
  }
}

/** Phase 2 may only use U D (any turn) and half turns of R L F B. */
const PHASE2_MOVES = [0, 1, 2, 9, 10, 11, 4, 7, 13, 16]
const isPhase2Move = (m: number) => {
  const face = (m / 3) | 0
  return face === 0 || face === 3 || m % 3 === 1
}

const quarterCost = (m: number) => (m % 3 === 1 ? 2 : 1)

// ---- Coordinates ---------------------------------------------------------
const N_TWIST = 2187
const N_FLIP = 2048
const N_SLICE = 495
const N_PERM8 = 40320
const N_PERM4 = 24

const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320]
const choose = (n: number, k: number) => {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

const twistOf = (co: number[]) => co.slice(0, 7).reduce((t, v) => t * 3 + v, 0)
const flipOf = (eo: number[]) => eo.slice(0, 11).reduce((t, v) => t * 2 + v, 0)

function twistToCo(t: number): number[] {
  const co = zeros(8)
  let sum = 0
  for (let i = 6; i >= 0; i--) {
    co[i] = t % 3
    sum += co[i]
    t = (t / 3) | 0
  }
  co[7] = (3 - (sum % 3)) % 3
  return co
}

function flipToEo(t: number): number[] {
  const eo = zeros(12)
  let sum = 0
  for (let i = 10; i >= 0; i--) {
    eo[i] = t % 2
    sum += eo[i]
    t = (t / 2) | 0
  }
  eo[11] = sum % 2
  return eo
}

/** Which 4 of the 12 edge slots hold slice edges (values 8..11): a number 0..494. */
function slicePositionOf(ep: number[]): number {
  let rank = 0
  let k = 1
  for (let slot = 0; slot < 12; slot++) {
    if (ep[slot] >= 8) rank += choose(slot, k++)
  }
  return rank
}

/** A representative edge arrangement for a slice position (slice slots hold 8, the rest 0). */
function sliceToEp(rank: number): number[] {
  const ep = zeros(12)
  for (let k = 4; k >= 1; k--) {
    let slot = 11
    while (choose(slot, k) > rank) slot--
    rank -= choose(slot, k)
    ep[slot] = 8
  }
  return ep
}

/** Position of a permutation among all n! permutations (Lehmer code). */
function permRank(p: number[], n: number): number {
  let rank = 0
  for (let i = 0; i < n - 1; i++) {
    let smaller = 0
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) smaller++
    rank += smaller * FACTORIAL[n - 1 - i]
  }
  return rank
}

function permUnrank(rank: number, n: number): number[] {
  const free = Array.from({ length: n }, (_, i) => i)
  const p: number[] = []
  for (let i = 0; i < n; i++) {
    const f = FACTORIAL[n - 1 - i]
    const idx = (rank / f) | 0
    rank -= idx * f
    p.push(free.splice(idx, 1)[0])
  }
  return p
}

// ---- Tables --------------------------------------------------------------
interface Tables {
  twistMove: Uint16Array
  flipMove: Uint16Array
  sliceMove: Uint16Array
  cpermMove: Uint16Array
  uedgeMove: Uint16Array
  spermMove: Uint8Array
  prune1Twist: Int8Array // slice x twist  -> moves to reach G1
  prune1Flip: Int8Array // slice x flip
  prune2Corner: Int8Array // slice perm x corner perm -> moves to solved
  prune2Edge: Int8Array // slice perm x edge perm
}

let tables: Tables | null = null

function buildMoveTable<T extends Uint8Array | Uint16Array>(
  out: T,
  size: number,
  moves: number[],
  step: (coord: number, move: Cubie) => number,
): T {
  for (let c = 0; c < size; c++) for (const m of moves) out[c * N_MOVES + m] = step(c, MOVES[m])
  return out
}

/**
 * Breadth-first search outward from the goal over combined coordinates. Moves
 * can be undone, so the distance from the goal equals the distance to it.
 */
function buildPrune(
  n1: number,
  n2: number,
  move1: Uint8Array | Uint16Array,
  move2: Uint8Array | Uint16Array,
  moves: number[],
  goal1: number,
  goal2: number,
): Int8Array {
  const dist = new Int8Array(n1 * n2).fill(-1)
  dist[goal1 * n2 + goal2] = 0
  for (let depth = 0; ; depth++) {
    let added = 0
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] !== depth) continue
      const a = (i / n2) | 0
      const b = i - a * n2
      for (const m of moves) {
        const next = move1[a * N_MOVES + m] * n2 + move2[b * N_MOVES + m]
        if (dist[next] < 0) {
          dist[next] = depth + 1
          added++
        }
      }
    }
    if (!added) return dist
  }
}

/** Builds the move and pruning tables once (about a second). Safe to call repeatedly. */
export function initTwoPhase(): void {
  if (tables) return
  const ALL = Array.from({ length: N_MOVES }, (_, i) => i)

  const twistMove = buildMoveTable(new Uint16Array(N_TWIST * N_MOVES), N_TWIST, ALL, (t, mv) => {
    const co = twistToCo(t)
    return twistOf(co.map((_, c) => (co[mv.cp[c]] + mv.co[c]) % 3))
  })
  const flipMove = buildMoveTable(new Uint16Array(N_FLIP * N_MOVES), N_FLIP, ALL, (t, mv) => {
    const eo = flipToEo(t)
    return flipOf(eo.map((_, e) => (eo[mv.ep[e]] + mv.eo[e]) % 2))
  })
  const sliceMove = buildMoveTable(new Uint16Array(N_SLICE * N_MOVES), N_SLICE, ALL, (r, mv) => {
    const ep = sliceToEp(r)
    return slicePositionOf(ep.map((_, e) => ep[mv.ep[e]]))
  })
  const cpermMove = buildMoveTable(new Uint16Array(N_PERM8 * N_MOVES), N_PERM8, PHASE2_MOVES, (r, mv) => {
    const cp = permUnrank(r, 8)
    return permRank(cp.map((_, c) => cp[mv.cp[c]]), 8)
  })
  const uedgeMove = buildMoveTable(new Uint16Array(N_PERM8 * N_MOVES), N_PERM8, PHASE2_MOVES, (r, mv) => {
    const ep = permUnrank(r, 8)
    return permRank(ep.map((_, e) => ep[mv.ep[e]]), 8)
  })
  const spermMove = buildMoveTable(new Uint8Array(N_PERM4 * N_MOVES), N_PERM4, PHASE2_MOVES, (r, mv) => {
    const sp = permUnrank(r, 4)
    return permRank([0, 1, 2, 3].map((e) => sp[mv.ep[8 + e] - 8]), 4)
  })

  const sliceGoal = slicePositionOf(SOLVED.ep)
  tables = {
    twistMove,
    flipMove,
    sliceMove,
    cpermMove,
    uedgeMove,
    spermMove,
    prune1Twist: buildPrune(N_SLICE, N_TWIST, sliceMove, twistMove, ALL, sliceGoal, 0),
    prune1Flip: buildPrune(N_SLICE, N_FLIP, sliceMove, flipMove, ALL, sliceGoal, 0),
    prune2Corner: buildPrune(N_PERM4, N_PERM8, spermMove, cpermMove, PHASE2_MOVES, 0, 0),
    prune2Edge: buildPrune(N_PERM4, N_PERM8, spermMove, uedgeMove, PHASE2_MOVES, 0, 0),
  }
}

export function isTwoPhaseReady(): boolean {
  return tables !== null
}

// ---- Search --------------------------------------------------------------
export interface SolveOptions {
  /** After the first solution, keep looking for a shorter one for up to this long. Default 800 ms. */
  timeMs?: number
}

interface SearchOptions {
  timeMs: number
  /** Only accept solutions costing strictly fewer quarter turns than this. */
  bound?: number
}

/** Face turns only: letters U R F D L B, each optionally followed by ' or 2. */
export function cubieFromFaceTurns(scramble: string): Cubie {
  let state = SOLVED
  for (const [, letter, suffix] of scramble.matchAll(/([URFDLB])(2'?|')?/g)) {
    const f = FACE_LETTERS.indexOf(letter)
    const power = !suffix ? 0 : suffix === "'" ? 2 : 1
    state = multiply(state, MOVES[f * 3 + power])
  }
  return state
}

const moveName = (m: number) => FACE_LETTERS[(m / 3) | 0] + ['', '2', "'"][m % 3]

/**
 * One search from one point of view. Returns the best solution found, or null
 * when `bound` was given and nothing beat it in time.
 */
function searchOnce(scramble: string, { timeMs, bound }: SearchOptions): string | null {
  const t = tables!
  const start = cubieFromFaceTurns(scramble)
  const deadline = performance.now() + timeMs

  let best: number[] | null = null
  let bestCost = bound ?? Infinity
  let nodes = 0
  let timeUp = false
  // Without a bound the first solution must always be found, however long it
  // takes; with one, running out of time simply means nothing better turned up.
  const tick = () => {
    if ((++nodes & 1023) === 0 && (best || bound !== undefined) && performance.now() > deadline) timeUp = true
  }

  // A move may not repeat a face, and for opposite faces only U-before-D style
  // order is allowed: R L and L R reach the same place, so try just one.
  const allowed = (m: number, last: number) => {
    if (last < 0) return true
    const f = (m / 3) | 0
    const lf = (last / 3) | 0
    return f !== lf && f + 3 !== lf
  }

  const path: number[] = []

  // Phase 2: finish inside G1. Returns true once it has recorded a better solution.
  function phase2(cp: number, ue: number, sp: number, depthLeft: number, last: number, cost: number): boolean {
    tick()
    if (timeUp) return false
    const h = Math.max(t.prune2Corner[sp * N_PERM8 + cp], t.prune2Edge[sp * N_PERM8 + ue])
    if (h > depthLeft || cost + h >= bestCost) return false
    if (depthLeft === 0) {
      best = [...path]
      bestCost = cost
      return true
    }
    for (const m of PHASE2_MOVES) {
      if (!allowed(m, last)) continue
      path.push(m)
      const found = phase2(
        t.cpermMove[cp * N_MOVES + m],
        t.uedgeMove[ue * N_MOVES + m],
        t.spermMove[sp * N_MOVES + m],
        depthLeft - 1,
        m,
        cost + quarterCost(m),
      )
      path.pop()
      if (found) return true
    }
    return false
  }

  // Hand a phase-1 ending to phase 2.
  function finishWithPhase2(cost: number): void {
    // Replay the phase-1 moves to learn the permutation coordinates.
    let cube = start
    for (const m of path) cube = multiply(cube, MOVES[m])
    const cp = permRank(cube.cp, 8)
    const ue = permRank(cube.ep.slice(0, 8), 8)
    const sp = permRank(cube.ep.slice(8).map((e) => e - 8), 4)
    const last = path.length ? path[path.length - 1] : -1
    const maxDepth = Math.min(18, bestCost - cost - 1)
    for (let d = 0; d <= maxDepth && !timeUp; d++) {
      if (phase2(cp, ue, sp, d, last, cost)) return
    }
  }

  // Phase 1: reach G1 in exactly `depthLeft` more moves.
  function phase1(tw: number, fl: number, sl: number, depthLeft: number, last: number, cost: number): void {
    tick()
    if (timeUp) return
    const h = Math.max(t.prune1Twist[sl * N_TWIST + tw], t.prune1Flip[sl * N_FLIP + fl])
    if (h > depthLeft || cost + h >= bestCost) return
    if (depthLeft === 0) {
      // Ending on a phase-2 move would just be a shorter phase 1 plus that move.
      if (last >= 0 && isPhase2Move(last)) return
      finishWithPhase2(cost)
      return
    }
    for (let m = 0; m < N_MOVES; m++) {
      if (!allowed(m, last)) continue
      path.push(m)
      phase1(
        t.twistMove[tw * N_MOVES + m],
        t.flipMove[fl * N_MOVES + m],
        t.sliceMove[sl * N_MOVES + m],
        depthLeft - 1,
        m,
        cost + quarterCost(m),
      )
      path.pop()
    }
  }

  const tw0 = twistOf(start.co)
  const fl0 = flipOf(start.eo)
  const sl0 = slicePositionOf(start.ep)
  for (let depth = 0; depth <= 12 && depth < bestCost && !timeUp; depth++) {
    path.length = 0
    phase1(tw0, fl0, sl0, depth, -1, 0)
  }

  const solution = best as number[] | null
  if (!solution) {
    if (bound !== undefined) return null
    throw new Error('two-phase search found no solution (is the cube state valid?)')
  }
  return solution.map(moveName).join(' ')
}

// ---- Six points of view ----------------------------------------------------
// A cube and its mirror-image-free relabelings are equally hard to solve, but
// the search walks different paths through each, so each is a fresh chance at a
// shorter answer:
//   * relabel the faces by a 3-fold turn about the URF corner (U>R>F>U, D>L>B>D),
//     done 0, 1 or 2 times -- the same cube seen from three sides;
//   * solve the INVERSE scramble and invert the answer: if S undoes the inverse
//     of the scramble, S's inverse undoes the scramble.
const CORNER_TURN: Record<string, string> = { U: 'R', R: 'F', F: 'U', D: 'L', L: 'B', B: 'D' }
const CORNER_TURN_BACK: Record<string, string> = Object.fromEntries(Object.entries(CORNER_TURN).map(([a, b]) => [b, a]))
const relabel = (alg: string, map: Record<string, string>) => alg.replace(/[URFDLB]/g, (f) => map[f])

function invertAlg(alg: string): string {
  const flip = (m: string) => (m.endsWith('2') || m.endsWith("2'") ? m.replace("'", '') : m.endsWith("'") ? m[0] : m + "'")
  return (alg.match(/[URFDLB](?:2'?|')?/g) ?? []).reverse().map(flip).join(' ')
}

const quarterTurnsOf = (alg: string) => (alg.match(/[URFDLB](?:2'?|')?/g) ?? []).reduce((n, m) => n + (m.includes('2') ? 2 : 1), 0)

/**
 * A short solution (as face turns) for the cube reached by `scramble`, an
 * algorithm of face turns. Returns "" when the cube is already solved. The
 * time budget is shared between the six points of view.
 */
export function solveTwoPhase(scramble: string, options: SolveOptions = {}): string {
  initTwoPhase()
  const perView = (options.timeMs ?? 800) / 6
  let best: string | null = null
  let bestCost = Infinity

  for (const inverse of [false, true]) {
    const base = inverse ? invertAlg(scramble) : scramble
    let view = base
    for (let turns = 0; turns < 3; turns++) {
      const found = searchOnce(view, { timeMs: perView, bound: best === null ? undefined : bestCost })
      if (found !== null) {
        // Undo the relabelling (and the inversion) so the answer fits the real cube.
        let answer = found
        for (let i = 0; i < turns; i++) answer = relabel(answer, CORNER_TURN_BACK)
        if (inverse) answer = invertAlg(answer)
        best = answer
        bestCost = quarterTurnsOf(answer)
        if (bestCost === 0) return ''
      }
      view = relabel(view, CORNER_TURN)
    }
  }
  return best!
}
