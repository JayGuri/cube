import type { StageGoal } from './stages'

// The Academy teaches the layer-by-layer method: solve one layer at a time,
// bottom to top, using a handful of short algorithms. The cube is held with the
// FIRST layer on the bottom (white) and the LAST layer on top (yellow).
//
// Every lesson comes with practice positions. A position is made by running
// `setup` on a cube whose earlier layers are already solved, and `solution` is
// a way out that uses the lesson's algorithm. The tests prove both halves, so
// "Show me" never shows a move that doesn't work.

export interface LessonCase {
  setup: string
  solution: string
}

export interface Lesson {
  id: string
  title: string
  blurb: string
  /** What the learner should do, in order. Plain sentences, no jargon left unexplained. */
  steps: string[]
  /** The stage that must be reached to finish the lesson; null for a free-practice lesson. */
  goal: StageGoal | null
  /** The goal in one plain sentence, shown above the live progress. */
  goalText: string
  algorithm?: { name: string; moves: string; hint: string }
  cases: LessonCase[]
}

const repeat = (alg: string, times: number) => Array(times).fill(alg).join(' ')

/** The undo of an algorithm: reversed, each move flipped. */
export function invertMoves(alg: string): string {
  return (alg.match(/[URFDLBMES]2?'?/g) ?? [])
    .reverse()
    .map((m) => (m.includes('2') ? m.replace("'", '') : m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(' ')
}

const caseOf = (setup: string): LessonCase => ({ setup, solution: invertMoves(setup) })
const algorithmCase = (alg: string, times: number): LessonCase => ({
  setup: invertMoves(repeat(alg, times)),
  solution: repeat(alg, times),
})

const TRIGGER = "R U R' U'"
const MIDDLE_RIGHT = "U R U' R' U' F' U F"
const MIDDLE_LEFT = "U' L' U L U F U' F'"
const TOP_CROSS = "F R U R' U' F'"
const SUNE = "R U R' U R U2 R'"
const CORNERS = "R' F R' B2 R F' R' B2 R2"
const EDGES = "R U' R U R U R U' R' U' R2"

export const LESSONS: Lesson[] = [
  {
    id: 'basics',
    title: 'Meet the cube',
    blurb: 'The six faces and how a turn is written.',
    goal: null,
    goalText: 'Make four turns, any you like.',
    steps: [
      'The cube has six faces: Right, Left, Up, Down, Front and Back, written R, L, U, D, F and B. The centre piece of every face never moves, so it tells you that face’s colour.',
      'A letter means turn that face a quarter turn clockwise, as if you were looking straight at it. A letter with a ’ after it means turn it back, counter-clockwise.',
      'Try it. Drag a piece, press R, U or F on the keyboard (hold Shift for the ’ turn), or use your hands. Make four turns to continue.',
    ],
    cases: [],
  },
  {
    id: 'cross',
    title: 'The white cross',
    blurb: 'Make a plus sign on the white face.',
    goal: 'cross',
    goalText: 'A white plus sign on the bottom, each edge matching the side colour beside it.',
    steps: [
      'Look for the white edge pieces. Each has a second colour. Your job is to put every white edge on the bottom layer, with its second colour touching the centre of that colour.',
      'Bring an edge to the bottom by turning the face it is on, then turn the bottom face until the two colours line up with a centre. Think one edge at a time.',
      'There is no single formula here, only practice. Press Show me to watch one way to do it.',
    ],
    cases: [caseOf('F2'), caseOf("R F' U"), caseOf("L2 U' R2 F")],
  },
  {
    id: 'corners',
    title: 'White corners',
    blurb: 'Finish the whole white layer.',
    goal: 'firstLayer',
    goalText: 'The whole bottom layer solved: white underneath, matching colours around its sides.',
    algorithm: { name: 'The trigger', moves: TRIGGER, hint: 'Right, Up, Right back, Up back' },
    steps: [
      'Find a white corner in the top layer. Turn the top face until it sits directly above the spot where it belongs: its other two colours should match the two faces beside that spot.',
      'Hold that spot at the front-right and repeat the trigger: Right, Up, Right back, Up back. After one, three or five repeats the corner drops into place with white facing down.',
      'Do the same for the other three corners.',
    ],
    cases: [algorithmCase(TRIGGER, 1), algorithmCase(TRIGGER, 3), algorithmCase(TRIGGER, 5)],
  },
  {
    id: 'middle',
    title: 'The middle layer',
    blurb: 'Slide the four middle edges into place.',
    goal: 'secondLayer',
    goalText: 'The bottom two layers solved. Only the top layer is left.',
    algorithm: {
      name: 'Edge to the right',
      moves: MIDDLE_RIGHT,
      hint: 'The mirror image, to the left, is U’ L’ U L U F U’ F’',
    },
    steps: [
      'Find an edge in the top layer that has no yellow on it. Turn the top face until its front colour matches the front centre.',
      'Now look at its top colour. If it matches the right-hand centre, use the right algorithm. If it matches the left-hand centre, use the left one.',
      'An edge that is in the middle layer but wrong? Use an algorithm on it to pop it out to the top, then place it again.',
    ],
    cases: [algorithmCase(MIDDLE_RIGHT, 1), algorithmCase(MIDDLE_LEFT, 1)],
  },
  {
    id: 'top-cross',
    title: 'The yellow cross',
    blurb: 'Make a plus sign on the top face.',
    goal: 'topCross',
    goalText: 'A yellow plus sign on the top face.',
    algorithm: { name: 'Cross maker', moves: TOP_CROSS, hint: 'Front, Right, Up, Right back, Up back, Front back' },
    steps: [
      'Look at the yellow on top. You will see a dot, an L shape or a straight line.',
      'For a dot, just do the algorithm. For an L, hold it at the back-left. For a line, hold it left to right. Then do the algorithm.',
      'Repeat until the top shows a yellow cross. A dot needs the algorithm up to three times.',
    ],
    cases: [algorithmCase(TOP_CROSS, 1), algorithmCase(TOP_CROSS, 2)],
  },
  {
    id: 'top-face',
    title: 'The yellow face',
    blurb: 'Turn every top corner yellow.',
    goal: 'topFace',
    goalText: 'The whole top face yellow.',
    algorithm: { name: 'The Sune', moves: SUNE, hint: 'Right, Up, Right back, Up, Right, Up twice, Right back' },
    steps: [
      'If one corner already shows yellow on top, hold the cube so it is at the front-left. If none do, hold it so a yellow side faces you on the left.',
      'Do the Sune. Look again and repeat the same idea until the whole top face is yellow.',
      'The sides will look scrambled while you do this. That is normal; the next two lessons fix it.',
    ],
    cases: [algorithmCase(SUNE, 1), algorithmCase(SUNE, 2)],
  },
  {
    id: 'top-corners',
    title: 'Place the corners',
    blurb: 'Move the top corners to where they belong.',
    goal: 'topCorners',
    goalText: 'Every top corner in its right place.',
    algorithm: { name: 'Corner swap', moves: CORNERS, hint: 'Leaves the front-left corner where it is' },
    steps: [
      'A top corner is in the right place when its three colours match the three centres around it. Turn the top face to see if any corner is.',
      'Hold a correct corner at the front-left and do the corner swap. It moves the other three corners in a circle and leaves that one alone.',
      'If no corner is correct, do the swap once from anywhere, then look again.',
    ],
    cases: [algorithmCase(CORNERS, 1), algorithmCase(CORNERS, 2)],
  },
  {
    id: 'top-edges',
    title: 'Place the edges',
    blurb: 'The last step. Solve the cube.',
    goal: 'solved',
    goalText: 'The cube solved.',
    algorithm: { name: 'Edge cycle', moves: EDGES, hint: 'Leaves the back edge where it is' },
    steps: [
      'Turn the top face until at least one top edge matches its centre. If all four match, you are done.',
      'Hold a correct edge at the back and do the edge cycle. It moves the other three edges in a circle.',
      'Look again. One more go solves it for good.',
    ],
    cases: [algorithmCase(EDGES, 1), algorithmCase(EDGES, 2)],
  },
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)
export const lessonIndex = (id: string) => LESSONS.findIndex((l) => l.id === id)
