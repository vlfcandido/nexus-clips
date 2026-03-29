import { TrendingUp, Flame, Plus, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { addSource } from '../api/client'

const CATEGORY_COLORS = {
  futebol: 'bg-green-500/20 text-green-400 border-green-500/30',
  política: 'bg-red-500/20 text-red-400 border-red-500/30',
  outro: 'bg-gray-700/20 text-gray-400 border-gray-700/30',
}

export default function TrendingView() {
  const { state, refresh } = useApp()

  async function handleMonitor(trend) {
    try {
      await addSource({
        source_type: 'twitter',
        identifier: trend.name,
        topic: trend.category === 'outro' ? 'entretenimento' : trend.category,
      })
      refresh()
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Trending</h2>
          <p className="text-gray-500 text-sm mt-1">Topicos em alta no Brasil agora</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm hover:text-white transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Grid de trends */}
      <div className="space-y-2">
        {(state.trending || []).map((trend, i) => (
          <div
            key={i}
            className={`bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition-all`}
          >
            <div className="flex items-center gap-4">
              {/* Rank */}
              <span className={`text-lg font-bold w-8 text-center ${
                i < 3 ? 'text-nexus-400' : 'text-gray-600'
              }`}>
                {i + 1}
              </span>

              {/* Info */}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium">{trend.name}</p>
                  {trend.should_monitor && (
                    <Flame className="w-4 h-4 text-orange-400" />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                    CATEGORY_COLORS[trend.category] || CATEGORY_COLORS.outro
                  }`}>
                    {trend.category}
                  </span>
                  <span className="text-xs text-gray-500">{trend.source}</span>
                  {trend.volume > 0 && (
                    <span className="text-xs text-gray-500">
                      {trend.volume.toLocaleString('pt-BR')} menções
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Viralidade */}
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-gray-500" />
                  <span className={`text-sm font-bold ${
                    trend.virality >= 7 ? 'text-green-400' :
                    trend.virality >= 4 ? 'text-yellow-400' : 'text-gray-500'
                  }`}>
                    {trend.virality.toFixed(1)}
                  </span>
                </div>
                <span className="text-xs text-gray-600">viralidade</span>
              </div>

              {/* Monitorar */}
              <button
                onClick={() => handleMonitor(trend)}
                className="p-2 rounded-lg bg-nexus-600/20 text-nexus-400 hover:bg-nexus-600/30 transition-all"
                title="Adicionar como fonte"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {(!state.trending || state.trending.length === 0) && (
          <div className="text-center py-16 text-gray-600">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Carregando trending topics...</p>
          </div>
        )}
      </div>
    </div>
  )
}
