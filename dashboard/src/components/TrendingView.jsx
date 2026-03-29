import { TrendingUp, Flame, Plus, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { addSource } from '../api/client'

export default function TrendingView() {
  const { state, refresh } = useApp()

  async function handleMonitor(trend) {
    await addSource({
      source_type: 'twitter',
      identifier: trend.name,
      topic: trend.category === 'outro' ? 'entretenimento' : trend.category,
    })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between anim-fade">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Trending</h1>
          <p className="text-sm text-zinc-500 mt-1">Topicos em alta no Brasil agora</p>
        </div>
        <button onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800/60 text-zinc-400 rounded-lg text-xs hover:text-white transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      <div className="space-y-1.5 stagger">
        {(state.trending || []).map((t, i) => (
          <div key={i}
            className="anim-fade-up flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/60 hover:border-zinc-700/60 transition-all group"
          >
            <span className={`text-sm font-bold font-mono w-6 text-center ${i < 3 ? 'text-violet-400' : 'text-zinc-700'}`}>
              {String(i + 1).padStart(2, '0')}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">{t.name}</span>
                {t.should_monitor && <Flame className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                  t.category === 'guerra' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  t.category === 'futebol' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  t.category === 'política' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                  'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}>{t.category}</span>
                <span className="text-[10px] text-zinc-600">{t.source}</span>
                {t.volume > 0 && <span className="text-[10px] text-zinc-600">{t.volume.toLocaleString('pt-BR')} mencoes</span>}
              </div>
            </div>

            <div className="text-right mr-2">
              <span className={`text-sm font-bold font-mono ${
                t.virality >= 7 ? 'text-emerald-400' : t.virality >= 4 ? 'text-amber-400' : 'text-zinc-600'
              }`}>{t.virality.toFixed(1)}</span>
              <p className="text-[9px] text-zinc-600">viral</p>
            </div>

            <button onClick={() => handleMonitor(t)}
              className="p-2 rounded-lg text-zinc-600 hover:text-violet-400 hover:bg-violet-500/10 transition-colors opacity-0 group-hover:opacity-100">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ))}

        {(!state.trending || !state.trending.length) && (
          <div className="text-center py-20 anim-fade">
            <TrendingUp className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-600">Carregando trending topics...</p>
          </div>
        )}
      </div>
    </div>
  )
}
