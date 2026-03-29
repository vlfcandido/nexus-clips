import { LayoutDashboard, Film, Radio, TrendingUp, Settings, Sparkles, Pause, Play } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { pausePipeline, resumePipeline } from '../api/client'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clips', label: 'Conteudos', icon: Film },
  { id: 'sources', label: 'Fontes', icon: Radio },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'settings', label: 'Config', icon: Settings },
]

export default function Sidebar() {
  const { state, dispatch, refresh } = useApp()
  const pl = state.pipeline || {}
  const running = pl.running
  const stats = pl.stats || {}

  async function togglePipeline() {
    if (running) await pausePipeline()
    else await resumePipeline()
    refresh()
  }

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

      {/* Pipeline control */}
      <div className="p-3 mx-2 mb-2 bg-surface-2 rounded-xl border border-stroke-1">
        {/* Toggle button */}
        <button
          onClick={togglePipeline}
          className={`w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-medium mb-2.5 transition-all ${
            running
              ? 'bg-success-muted text-success border border-success/20 hover:bg-success/20'
              : 'bg-danger-muted text-danger border border-danger/20 hover:bg-danger/20'
          }`}
        >
          {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {running ? 'Pausar pipeline' : 'Iniciar pipeline'}
        </button>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1">
          {[
            { n: stats.queue_size || 0, l: 'Fila', c: 'text-content-3' },
            { n: stats.relevant || 0, l: 'OK', c: 'text-success' },
            { n: stats.errors || 0, l: 'Erros', c: 'text-danger' },
          ].map(({ n, l, c }) => (
            <div key={l} className="text-center">
              <div className={`text-xs font-bold font-mono ${c}`}>{n}</div>
              <div className="text-[8px] text-content-4 uppercase tracking-wider">{l}</div>
            </div>
          ))}
        </div>

        <div className="mt-2 pt-2 border-t border-stroke-1 flex items-center justify-between">
          <span className="text-[9px] text-content-4">Processados</span>
          <span className="text-[10px] font-mono text-content-3">{stats.processed || 0}</span>
        </div>
      </div>
    </aside>
  )
}
