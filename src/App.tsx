import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { FreePlay } from './components/screens/FreePlay'
import { Home } from './components/screens/Home'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play/:puzzleId" element={<FreePlay />} />
      </Routes>
    </Router>
  )
}

export default App
