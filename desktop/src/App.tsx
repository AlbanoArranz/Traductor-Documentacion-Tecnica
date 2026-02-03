import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ProjectPage from './pages/ProjectPage'
import GlossaryPage from './pages/GlossaryPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="project/:projectId" element={<ProjectPage />} />
          <Route path="project/:projectId/glossary" element={<GlossaryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
