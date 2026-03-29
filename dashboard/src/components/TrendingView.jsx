import { TrendingUp, Flame, Plus, RefreshCw, ArrowUpRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { addSource } from '../api/client'
import Button from './ui/Button'
import Badge from './ui/Badge'
import EmptyState from './ui/EmptyState'

const CAT_VARIANT = { guerra: 'danger', futebol: 'success', política: 'info', outro: 'default' }

export default function TrendingView() {
  const { state, refresh } = useApp()

  async function handleMonitor(t) {
    await addSource({ source_type: 'twitter', identifier: t.name, topic: t.category === 'outro' ? 'entretenimento' : t.category })
    refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between animate-fade">
        <div>
          <h1 className="text-xl font-bold text-content-1 tracking-tight">Trending</h1>
          <p className="text-xs text-content-3 mt-1">Topicos em alta no Brasil — clique + pra monitorar</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={refresh}>Atualizar</Button>
      </div>

      <div className="space-y-1.5 stagger">
        {(!state.trending || !state.trending.length) && (
          <EmptyState icon={TrendingUp} title="Carregando trends..." description="Aguardando dados do Twitter e Google Trends" />
        )}
        {(state.trending || []).map((t, i) => (
          <div key={i} className="flex items-center gap-4 p-3.5 bg-surface-2 border border-stroke-1 rounded-xl hover:border-stroke-2 transition-all group">
            <span className={`text-xs font-bold font-mono w-5 text-center ${i < 3 ? 'text-accent-light' : 'text-content-4'}`}>
              {String(i + 1).padStart(2, '0')}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-content-1">{t.name}</span>
                {t.should_monitor && <Flame className="w-3 h-3 text-warning" />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={CAT_VARIANT[t.category] || 'default'}>{t.category}</Badge>
                <span className="text-[10px] text-content-4">{t.source}</span>
                {t.volume > 0 && <span className="text-[10px] text-content-4">{t.volume.toLocaleString('pt-BR')}</span>}
              </div>
            </div>

            {/* Virality score */}
            <div className="text-center">
              <div className={`text-sm font-bold font-mono ${t.virality >= 7 ? 'text-success' : t.virality >= 4 ? 'text-warning' : 'text-content-4'}`}>
                {t.virality.toFixed(1)}
              </div>
              <p className="text-[8px] text-content-4 uppercase tracking-widest">viral</p>
            </div>

            <button onClick={() => handleMonitor(t)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-content-4 hover:text-accent-light hover:bg-accent-muted transition-colors opacity-0 group-hover:opacity-100">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
