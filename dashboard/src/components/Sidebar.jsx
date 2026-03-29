import {
  LayoutDashboard, Film, Radio, TrendingUp, Settings, Sparkles, Pause, Play,
  Users, BarChart3, MessageSquare, Wand2, ChevronRight, Layout,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { pausePipeline, resumePipeline } from '../api/client'

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'studio', label: 'Studio', icon: Wand2 },
    ],
  },
  {
    label: 'Conteudo',
    items: [
      { id: 'clips', label: 'Videos', icon: Film },
      { id: 'sources', label: 'Fontes', icon: Radio },
      { id: 'trending', label: 'Trending', icon: TrendingUp },
    ],
  },
  {
    label: 'Distribuicao',
    items: [
      { id: 'accounts', label: 'Contas', icon: Users },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'templates', label: 'Templates', icon: Layout },
      { id: 'prompts', label: 'Prompts IA', icon: MessageSquare },
      { id: 'settings', label: 'Config', icon: Settings },
    ],
  },
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
    <aside className="w-[210px] flex-shrink-0 bg-surface-1 border-r border-stroke-1 flex flex-col">
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-stroke-1">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent via-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-accent/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="leading-none">
          <span className="text-[13px] font-bold text-content-1 tracking-tight">Nexus Clips</span>
          <span className="block text-[9px] text-content-4 font-mono">v0.1 beta</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-3' : ''}>
            {group.label && (
              <p className="text-[9px] font-semibold text-content-4 uppercase tracking-[0.15em] px-3 mb-1">{group.label}</p>
            )}
            {group.items.map(({ id, label, icon: Icon }) => {
              const active = state.currentPage === id
              return (
                <button
                  key={id}
                  onClick={() => dispatch({ type: 'SET_PAGE', payload: id })}
                  className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[12px] mb-px transition-all duration-100 group ${
                    active
                      ? 'bg-accent-muted text-accent-light font-medium'
                      : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
                  }`}
                >
                  <Icon className={`w-[15px] h-[15px] transition-colors ${active ? 'text-accent-light' : 'text-content-4 group-hover:text-content-3'}`} />
                  <span className="flex-1 text-left">{label}</span>
                  {active && <ChevronRight className="w-3 h-3 text-accent-light/50" />}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Pipeline control */}
      <div className="p-2">
        <div className="p-3 bg-surface-2 rounded-xl border border-stroke-1">
          <button
            onClick={togglePipeline}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-semibold mb-3 transition-all hover-lift ${
              running
                ? 'bg-success/10 text-success border border-success/20 hover:bg-success/20'
                : 'bg-surface-4 text-content-3 border border-stroke-2 hover:text-content-1'
            }`}
          >
            {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {running ? 'Pipeline ativo' : 'Pipeline pausado'}
          </button>

          <div className="grid grid-cols-3 gap-1">
            {[
              { n: stats.queue_size || 0, l: 'Fila', c: 'text-content-3' },
              { n: (stats.relevant || 0) + (stats.skipped || 0), l: 'Total', c: 'text-accent-light' },
              { n: stats.errors || 0, l: 'Erros', c: stats.errors > 0 ? 'text-danger' : 'text-content-4' },
            ].map(({ n, l, c }) => (
              <div key={l} className="text-center py-1">
                <div className={`text-sm font-bold font-mono ${c}`}>{n}</div>
                <div className="text-[8px] text-content-4 uppercase tracking-wider">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
