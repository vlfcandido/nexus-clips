import { useState } from 'react'
import { Film, Play, Upload, Trash2, ExternalLink, Eye, Clock, Tag } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { publishClip, deleteClip } from '../api/client'

const TOPIC_COLORS = {
  futebol: 'bg-green-500/20 text-green-400',
  política: 'bg-red-500/20 text-red-400',
  entretenimento: 'bg-blue-500/20 text-blue-400',
}

const CATEGORY_ICONS = {
  gol: '⚽',
  polêmica: '🔥',
  declaração: '🎙️',
  treta: '💥',
  breaking: '🚨',
  humor: '😂',
  análise: '📊',
}

export default function ClipsView() {
  const { state, dispatch, refresh } = useApp()
  const [filter, setFilter] = useState('all') // all, published, pending

  const filteredClips = state.clips.filter((c) => {
    if (filter === 'published') return c.published
    if (filter === 'pending') return !c.published
    return true
  })

  async function handlePublish(id) {
    try {
      await publishClip(id)
      refresh()
    } catch (err) {
      alert(`Erro: ${err.message}`)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Deletar este clip?')) return
    try {
      await deleteClip(id)
      refresh()
    } catch (err) {
      alert(`Erro: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Conteudos</h2>
          <p className="text-gray-500 text-sm mt-1">{state.clipsTotal} clips no total</p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          {['all', 'pending', 'published'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-nexus-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Publicados'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de clips */}
      <div className="space-y-3">
        {filteredClips.length === 0 && (
          <div className="text-center py-20 text-gray-600">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum clip ainda. O pipeline esta monitorando fontes...</p>
          </div>
        )}

        {filteredClips.map((clip) => (
          <div
            key={clip.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{CATEGORY_ICONS[clip.category] || '📎'}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TOPIC_COLORS[clip.topic] || 'bg-gray-800 text-gray-400'}`}>
                    {clip.topic}
                  </span>
                  <span className="text-xs text-gray-600">{clip.category}</span>
                  {clip.published && (
                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">
                      Publicado
                    </span>
                  )}
                </div>

                <p className="text-white font-medium truncate">{clip.caption || clip.moment_text}</p>

                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {clip.duration_seconds}s
                  </span>
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {clip.source_type}
                  </span>
                  {clip.views > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {clip.views.toLocaleString('pt-BR')}
                    </span>
                  )}
                  <span>{new Date(clip.created_at).toLocaleDateString('pt-BR')}</span>
                </div>

                {/* URLs de publicação */}
                {clip.published && (
                  <div className="flex gap-2 mt-2">
                    {clip.tiktok_url && (
                      <a href={clip.tiktok_url} target="_blank" className="text-xs text-nexus-400 hover:underline">TikTok</a>
                    )}
                    {clip.instagram_url && (
                      <a href={clip.instagram_url} target="_blank" className="text-xs text-pink-400 hover:underline">Instagram</a>
                    )}
                    {clip.twitter_url && (
                      <a href={clip.twitter_url} target="_blank" className="text-xs text-blue-400 hover:underline">Twitter</a>
                    )}
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 shrink-0">
                {!clip.published && (
                  <button
                    onClick={() => handlePublish(clip.id)}
                    className="p-2 rounded-lg bg-nexus-600/20 text-nexus-400 hover:bg-nexus-600/30 transition-all"
                    title="Publicar"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                )}
                {clip.source_url && (
                  <a
                    href={clip.source_url}
                    target="_blank"
                    className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-all"
                    title="Ver fonte"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(clip.id)}
                  className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-red-400 transition-all"
                  title="Deletar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {state.clipsTotal > 20 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_FILTERS', payload: { page: Math.max(1, state.filters.page - 1) } })}
            className="px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-400 hover:text-white"
            disabled={state.filters.page <= 1}
          >
            Anterior
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">
            {state.filters.page} / {Math.ceil(state.clipsTotal / 20)}
          </span>
          <button
            onClick={() => dispatch({ type: 'SET_FILTERS', payload: { page: state.filters.page + 1 } })}
            className="px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-400 hover:text-white"
            disabled={state.filters.page >= Math.ceil(state.clipsTotal / 20)}
          >
            Proximo
          </button>
        </div>
      )}
    </div>
  )
}
