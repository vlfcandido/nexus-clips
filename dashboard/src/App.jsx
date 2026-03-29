import { useApp } from './context/AppContext'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ClipsView from './components/ClipsView'
import SourcesView from './components/SourcesView'
import TrendingView from './components/TrendingView'
import SettingsView from './components/SettingsView'

export default function App() {
  const { state } = useApp()

  const pages = {
    dashboard: Dashboard,
    clips: ClipsView,
    sources: SourcesView,
    trending: TrendingView,
    settings: SettingsView,
  }

  const Page = pages[state.currentPage] || Dashboard

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-zinc-950">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <Page />
        </div>
      </main>
    </div>
  )
}
