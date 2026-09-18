import { Alg } from 'cubing/alg'

// Task 9.2: starter 3x3 OLL/PLL flashcard deck. Scoped to a useful starter
// subset (4 PLL + 3 OLL cases) per the plan's own Review Note 5 -- the full
// 21-PLL/57-OLL set is real content-authoring work, not an engineering
// unknown. Add more cards here against this same schema.
//
// Each card's setupAlg is derived as the inverse of its solutionAlg, rather
// than an independently-sourced scramble for that case: applying a
// well-known solutionAlg backwards is guaranteed, by construction, to leave
// the cube in exactly the state that alg solves -- the standard way cubing
// flashcard apps generate practice scrambles, and it sidesteps needing a
// second, independently-verified algorithm per case.

export interface AlgoCard {
  id: string
  caseName: string
  category: 'OLL' | 'PLL'
  setupAlg: string
  solutionAlg: string
}

const SOLUTIONS: Array<{ id: string; caseName: string; category: 'OLL' | 'PLL'; solutionAlg: string }> = [
  { id: 'PLL-Ua', caseName: 'Ua perm', category: 'PLL', solutionAlg: "M2 U' M U2 M' U' M2" },
  { id: 'PLL-Ub', caseName: 'Ub perm', category: 'PLL', solutionAlg: "M2 U M U2 M' U M2" },
  { id: 'PLL-H', caseName: 'H perm', category: 'PLL', solutionAlg: 'M2 U M2 U2 M2 U M2' },
  { id: 'PLL-Z', caseName: 'Z perm', category: 'PLL', solutionAlg: "M2 U M2 U M' U2 M2 U2 M'" },
  { id: 'OLL-Sune', caseName: 'Sune', category: 'OLL', solutionAlg: "R U R' U R U2 R'" },
  { id: 'OLL-AntiSune', caseName: 'Anti-Sune', category: 'OLL', solutionAlg: "L' U' L U' L' U2 L" },
  { id: 'OLL-Cross', caseName: 'Bar (dot) OLL', category: 'OLL', solutionAlg: "F R U R' U' F'" },
]

export const CUBE3_ALGO_DECK: AlgoCard[] = SOLUTIONS.map((s) => ({
  ...s,
  setupAlg: new Alg(s.solutionAlg).invert().toString(),
}))
