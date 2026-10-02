import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes, useParams } from 'react-router-dom'
import { Home } from './components/screens/Home'
import { lessonById } from './core/academy/lessons'

// The play screen pulls in three.js, the puzzle engine and MediaPipe glue
// (~1.5 MB); the home page needs none of it, so each screen loads on demand.
const FreePlay = lazy(() => import('./components/screens/FreePlay').then((m) => ({ default: m.FreePlay })))
const Academy = lazy(() => import('./components/screens/Academy').then((m) => ({ default: m.Academy })))
const Settings = lazy(() => import('./components/screens/Settings').then((m) => ({ default: m.Settings })))

function LessonRoute() {
  const { lessonId = '' } = useParams<{ lessonId: string }>()
  return lessonById(lessonId) ? <FreePlay key={lessonId} lessonId={lessonId} /> : <Navigate to="/learn" replace />
}

function App() {
  const [solverReady, setSolverReady] = useState(false)

  // Building the solver's pruning tables costs ~0.9s. Warm it once at startup in
  // a worker rather than on the first Solve press (spec 12.4). A failure here is
  // not fatal -- everything except Solve still works -- so it is not surfaced as
  // a blocking error.
  useEffect(() => {
    let cancelled = false
    import('./core/solvers/kociemba')
      .then((m) => m.initSolver())
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSolverReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Router>
      <div data-testid="app" data-solver-ready={solverReady ? 'true' : 'false'}>
        <Suspense fallback={<div className="min-h-dvh bg-[#16171B]" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:puzzleId" element={<FreePlay />} />
          <Route path="/learn" element={<Academy />} />
          <Route path="/learn/:lessonId" element={<LessonRoute />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </div>
    </Router>
  )
}

export default App
