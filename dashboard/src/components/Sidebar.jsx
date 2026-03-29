import { LayoutDashboard, Film, Radio, TrendingUp, Settings, Sparkles } from 'lucide-react'
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
    <aside className="w-[200px] flex-shrink-0 bg-surface-1 border-r border-stroke-1 flex flex-col">
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-stroke-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-indigo-400 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[13px] font-semibold text-content-1 tracking-tight">Nexus Clips</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 mt-1">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = state.currentPage === id
          return (
            <button
              key={id}
              onClick={() => dispatch({ type: 'SET_PAGE', payload: id })}
              className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[12.5px] mb-px transition-all duration-100 ${
                active
                  ? 'bg-accent-muted text-accent-light font-medium'
                  : 'text-content-3 hover:text-content-2 hover:bg-surface-2'
              }`}
            >
              <Icon className={`w-[15px] h-[15px] ${active ? 'text-accent-light' : 'text-content-4'}`} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Status footer */}
      <div className="p-3 mx-2 mb-2 bg-surface-2 rounded-xl border border-stroke-1">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-[10px] font-medium text-success">Pipeline ativo</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {[
            { n: '0', l: 'Fila', c: 'text-content-3' },
            { n: '0', l: 'OK', c: 'text-success' },
            { n: '0', l: 'Erros', c: 'text-danger' },
          ].map(({ n, l, c }) => (
            <div key={l} className="text-center">
              <div className={`text-xs font-bold font-mono ${c}`}>{n}</div>
              <div className="text-[8px] text-content-4 uppercase tracking-wider">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
