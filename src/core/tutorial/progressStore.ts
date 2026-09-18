import { openDB, type IDBPDatabase } from 'idb'

// spec 9.3 IndexedDB schema. Three stores: lessonProgress, algoTrainerStats
// (Phase 9), solveTimes. Kept in one module/DB since they're all small,
// low-write-frequency records for one user with no need for separate
// connections.

export interface LessonProgressRecord {
  puzzleId: string
  trackName: string
  completedSteps: number
  lastPracticed: number // epoch ms
  bestMoveCount: number | null
}

export interface AlgoTrainerStatsRecord {
  puzzleId: string
  algoCaseId: string
  easeFactor: number
  interval: number // days
  dueDate: number // epoch ms
  correctStreak: number
}

export interface SolveTimeRecord {
  id?: number
  puzzleId: string
  moves: number
  timeMs: number
  date: number // epoch ms
  wasGestureControlled: boolean
}

const DB_NAME = 'handcube'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment'))
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('lessonProgress')) {
          db.createObjectStore('lessonProgress') // key: `${puzzleId}:${trackName}`
        }
        if (!db.objectStoreNames.contains('algoTrainerStats')) {
          db.createObjectStore('algoTrainerStats') // key: `${puzzleId}:${algoCaseId}`
        }
        if (!db.objectStoreNames.contains('solveTimes')) {
          db.createObjectStore('solveTimes', { keyPath: 'id', autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}

const lessonKey = (puzzleId: string, trackName: string) => `${puzzleId}:${trackName}`
const algoKey = (puzzleId: string, algoCaseId: string) => `${puzzleId}:${algoCaseId}`

export async function getLessonProgress(
  puzzleId: string,
  trackName: string,
): Promise<LessonProgressRecord | undefined> {
  const db = await getDb()
  return db.get('lessonProgress', lessonKey(puzzleId, trackName))
}

export async function setLessonProgress(record: LessonProgressRecord): Promise<void> {
  const db = await getDb()
  await db.put('lessonProgress', record, lessonKey(record.puzzleId, record.trackName))
}

export async function getAllLessonProgress(): Promise<LessonProgressRecord[]> {
  const db = await getDb()
  return db.getAll('lessonProgress')
}

export async function getAlgoStats(
  puzzleId: string,
  algoCaseId: string,
): Promise<AlgoTrainerStatsRecord | undefined> {
  const db = await getDb()
  return db.get('algoTrainerStats', algoKey(puzzleId, algoCaseId))
}

export async function setAlgoStats(record: AlgoTrainerStatsRecord): Promise<void> {
  const db = await getDb()
  await db.put('algoTrainerStats', record, algoKey(record.puzzleId, record.algoCaseId))
}

export async function getDueAlgoStats(puzzleId: string, now = Date.now()): Promise<AlgoTrainerStatsRecord[]> {
  const db = await getDb()
  const all: AlgoTrainerStatsRecord[] = await db.getAll('algoTrainerStats')
  return all.filter((r) => r.puzzleId === puzzleId && r.dueDate <= now)
}

export async function recordSolveTime(record: Omit<SolveTimeRecord, 'id'>): Promise<void> {
  const db = await getDb()
  await db.add('solveTimes', record)
}

export async function getSolveTimes(puzzleId?: string): Promise<SolveTimeRecord[]> {
  const db = await getDb()
  const all: SolveTimeRecord[] = await db.getAll('solveTimes')
  return puzzleId ? all.filter((r) => r.puzzleId === puzzleId) : all
}

// Test-only: forces a fresh DB connection (fake-indexeddb resets between test
// files, but the cached promise here would otherwise point at a closed DB).
export function __resetDbConnectionForTests(): void {
  dbPromise = null
}
