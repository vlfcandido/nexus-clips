import { LayoutDashboard, Film, Radio, TrendingUp, Settings, Zap } from 'lucide-react'
import { useApp } from '../context/AppContext'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clips', label: 'Conteudos', icon: Film },
  { id: 'sources', label: 'Fontes', icon: Radio },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'settings', label: 'Config', icon: Settings },
]

export default function Sidebar() {
  const { state, dispatch } = useApp()

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-nexus-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Nexus Clips</h1>
            <span className="text-xs text-gray-500">v0.1.0</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => dispatch({ type: 'SET_PAGE', payload: id })}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              state.currentPage === id
                ? 'bg-nexus-600/20 text-nexus-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </nav>

      {/* Status */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-500">Pipeline ativo</span>
        </div>
      </div>
    </aside>
  )
}
