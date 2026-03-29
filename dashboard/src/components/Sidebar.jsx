import { LayoutDashboard, Film, Radio, TrendingUp, Settings, Sparkles, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clips', label: 'Conteudos', icon: Film },
  { id: 'sources', label: 'Fontes', icon: Radio },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'settings', label: 'Configuracoes', icon: Settings },
]

export default function Sidebar() {
  const { state, dispatch } = useApp()

  return (
    <aside className="w-56 bg-zinc-950 border-r border-zinc-800/60 flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="leading-none">
            <span className="text-sm font-semibold text-zinc-100">Nexus Clips</span>
            <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">v0.1.0 beta</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 stagger">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = state.currentPage === id
          return (
            <button
              key={id}
              onClick={() => dispatch({ type: 'SET_PAGE', payload: id })}
              className={`anim-fade-up w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
                active
                  ? 'bg-zinc-800/80 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] ${active ? 'text-violet-400' : ''}`} />
              {label}
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-zinc-600" />}
            </button>
          )
        })}
      </nav>

      {/* Pipeline status */}
      <div className="px-5 py-4 border-t border-zinc-800/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-40" />
          </div>
          <span className="text-xs text-zinc-400">Pipeline ativo</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-base font-semibold text-zinc-200">0</div>
            <div className="text-[9px] text-zinc-600 font-mono">FILA</div>
          </div>
          <div>
            <div className="text-base font-semibold text-emerald-400">0</div>
            <div className="text-[9px] text-zinc-600 font-mono">FEITOS</div>
          </div>
          <div>
            <div className="text-base font-semibold text-red-400">0</div>
            <div className="text-[9px] text-zinc-600 font-mono">ERROS</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
