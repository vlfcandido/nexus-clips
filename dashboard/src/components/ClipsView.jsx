import { useState } from 'react'
import { Film, Upload, Trash2, ExternalLink, Eye, Clock, Play, MoreHorizontal } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { publishClip, deleteClip } from '../api/client'

const TOPIC_STYLES = {
  guerra: 'bg-red-500/10 text-red-400 border-red-500/20',
  futebol: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  política: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  entretenimento: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
}

const CATEGORY_EMOJI = {
  gol: '⚽', polêmica: '🔥', declaração: '🎙️', treta: '💥',
  breaking: '🚨', humor: '😂', análise: '📊',
}

export default function ClipsView() {
  const { state, dispatch, refresh } = useApp()
  const [filter, setFilter] = useState('all')

  const clips = state.clips.filter((c) => {
    if (filter === 'published') return c.published
    if (filter === 'pending') return !c.published
    return true
  })

  async function handlePublish(id) {
    try { await publishClip(id); refresh() }
    catch (e) { alert(e.message) }
  }

  async function handleDelete(id) {
    if (!confirm('Deletar este conteudo?')) return
    try { await deleteClip(id); refresh() }
    catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between anim-fade">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Conteudos</h1>
          <p className="text-sm text-zinc-500 mt-1">{state.clipsTotal} conteudos gerados</p>
        </div>
        <div className="flex bg-zinc-800/60 rounded-lg p-0.5">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendentes' },
            { key: 'published', label: 'Publicados' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === key ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2 stagger">
        {clips.length === 0 && (
          <div className="text-center py-24 anim-fade">
            <Film className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-600">Nenhum conteudo ainda</p>
            <p className="text-xs text-zinc-700 mt-1">O pipeline esta monitorando fontes...</p>
          </div>
        )}

        {clips.map((clip) => (
          <div
            key={clip.id}
            className="anim-fade-up group bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 hover:border-zinc-700/60 transition-all"
          >
            <div className="flex items-start gap-4">
              {/* Thumbnail placeholder */}
              <div className="w-20 h-14 rounded-lg bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {clip.thumbnail_path ? (
                  <img src={clip.thumbnail_path} className="w-full h-full object-cover" />
                ) : (
                  <Play className="w-5 h-5 text-zinc-700" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">{CATEGORY_EMOJI[clip.category] || '📎'}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${TOPIC_STYLES[clip.topic] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                    {clip.topic}
                  </span>
                  <span className="text-[10px] text-zinc-600">{clip.category}</span>
                  {clip.published && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Publicado
                    </span>
                  )}
                </div>

                <p className="text-sm text-zinc-200 font-medium truncate">{clip.caption || clip.moment_text}</p>

                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-600">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{clip.duration_seconds}s</span>
                  <span>{clip.source_type}</span>
                  {clip.views > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{clip.views.toLocaleString('pt-BR')}</span>}
                  <span>{new Date(clip.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!clip.published && (
                  <button onClick={() => handlePublish(clip.id)} className="p-2 rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors" title="Publicar">
                    <Upload className="w-4 h-4" />
                  </button>
                )}
                {clip.source_url && (
                  <a href={clip.source_url} target="_blank" className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors" title="Fonte">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => handleDelete(clip.id)} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Deletar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {state.clipsTotal > 20 && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => dispatch({ type: 'SET_FILTERS', payload: { page: Math.max(1, state.filters.page - 1) } })}
            className="px-4 py-2 bg-zinc-800/60 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
            disabled={state.filters.page <= 1}
          >
            Anterior
          </button>
          <span className="px-3 py-2 text-xs text-zinc-600 font-mono">
            {state.filters.page} / {Math.ceil(state.clipsTotal / 20)}
          </span>
          <button
            onClick={() => dispatch({ type: 'SET_FILTERS', payload: { page: state.filters.page + 1 } })}
            className="px-4 py-2 bg-zinc-800/60 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Proximo
          </button>
        </div>
      )}
    </div>
  )
}
