import { useEffect, useState } from 'react'
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { Academy } from './components/screens/Academy'
import { Calibration } from './components/screens/Calibration'
import { FreePlay } from './components/screens/FreePlay'
import { Home } from './components/screens/Home'
import { LessonRunner } from './components/screens/LessonRunner'
import { Settings } from './components/screens/Settings'
import { initSolver } from './core/solvers/kociemba'

function App() {
  const [solverReady, setSolverReady] = useState(false)

  // Building the solver's pruning tables costs ~0.9s. Warm it once at startup in
  // a worker rather than on the first Solve press (spec 12.4). A failure here is
  // not fatal -- everything except Solve still works -- so it is not surfaced as
  // a blocking error.
  useEffect(() => {
    let cancelled = false
    initSolver()
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:puzzleId" element={<FreePlay />} />
          <Route path="/academy/:puzzleId" element={<Academy />} />
          <Route path="/academy/:puzzleId/:trackName" element={<LessonRunner />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
