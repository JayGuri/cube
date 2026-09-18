import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePuzzleStore } from '../../state/puzzleStore'
import { getLessonProgress, type LessonProgressRecord } from '../../core/tutorial/progressStore'
import type { PuzzleId } from '../../core/puzzles/PuzzlePlugin'

export function Academy() {
  const { puzzleId = 'cube3' } = useParams<{ puzzleId: string }>()
  const { plugin, status, load } = usePuzzleStore()
  const [progress, setProgress] = useState<Record<string, LessonProgressRecord | undefined>>({})

  useEffect(() => {
    void load(puzzleId as PuzzleId)
  }, [load, puzzleId])

  useEffect(() => {
    if (!plugin) return
    let cancelled = false
    async function loadProgress() {
      const entries = await Promise.all(
        plugin!.tutorial.tracks.map(async (track) => [track.name, await getLessonProgress(plugin!.id, track.name).catch(() => undefined)] as const),
      )
      if (!cancelled) setProgress(Object.fromEntries(entries))
    }
    void loadProgress()
    return () => {
      cancelled = true
    }
  }, [plugin])

  return (
    <main className="min-h-dvh bg-[#0F1117] px-6 py-12 text-[#F5F5F7]">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
          ← All puzzles
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">{plugin?.displayName ?? puzzleId} Academy</h1>

        {status === 'loading' && <p className="mt-6 text-[#9A9DB0]">Loading…</p>}

        {status === 'ready' && plugin && (
          <ul className="mt-8 space-y-3">
            {plugin.tutorial.tracks.length === 0 && (
              <li className="rounded-xl border border-white/10 bg-[#1A1D27] p-5 text-[#9A9DB0]">
                No lessons yet for this puzzle.
              </li>
            )}
            {plugin.tutorial.tracks.map((track) => {
              const record = progress[track.name]
              const pct = record ? Math.round((record.completedSteps / Math.max(1, track.steps.length)) * 100) : 0
              return (
                <li key={track.name}>
                  <Link
                    to={`/academy/${plugin.id}/${encodeURIComponent(track.name)}`}
                    className="block rounded-xl border border-white/10 bg-[#1A1D27] p-5 transition hover:border-[#00D4FF]/60"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium">{track.name}</h2>
                      <span className="text-sm text-[#9A9DB0]">{track.steps.length} steps</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-[#6C63FF]" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
