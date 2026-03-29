import { useApp } from './context/AppContext'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ClipsView from './components/ClipsView'
import SourcesView from './components/SourcesView'
import TrendingView from './components/TrendingView'
import SettingsView from './components/SettingsView'

const PAGES = {
  dashboard: Dashboard,
  clips: ClipsView,
  sources: SourcesView,
  trending: TrendingView,
  settings: SettingsView,
}

export default function App() {
  const { state } = useApp()
  const Page = PAGES[state.currentPage] || Dashboard

  return (
    <div className="flex h-screen bg-surface-0 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-6 lg:py-8">
          <Page />
        </div>
      </main>
    </div>
  )
}
