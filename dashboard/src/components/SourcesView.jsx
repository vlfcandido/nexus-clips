import { useState } from 'react'
import { Radio, Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { addSource, removeSource, toggleSource } from '../api/client'

const TYPE_DOT = { twitter: 'bg-sky-400', youtube: 'bg-red-400', rss: 'bg-amber-400' }

export default function SourcesView() {
  const { state, refresh } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ source_type: 'twitter', identifier: '', topic: 'guerra' })

  async function handleAdd() {
    if (!form.identifier.trim()) return
    await addSource(form)
    setForm({ source_type: 'twitter', identifier: '', topic: 'guerra' })
    setShowForm(false)
    refresh()
  }

  async function handleRemove(id) {
    if (!confirm('Remover fonte?')) return
    await removeSource(id)
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between anim-fade">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Fontes</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie as fontes monitoradas</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova fonte
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="anim-fade-up bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-200">Adicionar fonte</h3>
            <button onClick={() => setShowForm(false)} className="text-zinc-600 hover:text-zinc-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1.5 font-medium">Tipo</label>
              <select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50">
                <option value="twitter">Twitter/X</option>
                <option value="youtube">YouTube</option>
                <option value="rss">RSS Feed</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1.5 font-medium">Identificador</label>
              <input type="text" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                placeholder={form.source_type === 'rss' ? 'https://...' : '@handle'}
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1.5 font-medium">Topico</label>
              <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/50">
                <option value="guerra">Guerra</option>
                <option value="futebol">Futebol</option>
                <option value="política">Politica</option>
                <option value="entretenimento">Entretenimento</option>
                <option value="economia">Economia</option>
              </select>
            </div>
          </div>
          <button onClick={handleAdd} className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-colors">
            Adicionar
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-1.5 stagger">
        {state.sources.length === 0 && (
          <div className="text-center py-20 anim-fade">
            <Radio className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-600">Nenhuma fonte configurada</p>
            <p className="text-xs text-zinc-700 mt-1">Adicione fontes pra o agente monitorar</p>
          </div>
        )}

        {state.sources.map((s) => (
          <div
            key={s.id}
            className={`anim-fade-up flex items-center gap-4 p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/60 hover:border-zinc-700/60 transition-all ${!s.active ? 'opacity-40' : ''}`}
          >
            <div className={`w-2 h-2 rounded-full ${TYPE_DOT[s.source_type] || 'bg-zinc-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{s.identifier}</p>
              <p className="text-[11px] text-zinc-600">{s.source_type} · {s.topic}</p>
            </div>
            <button onClick={async () => { await toggleSource(s.id); refresh() }}
              className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
              {s.active
                ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                : <ToggleLeft className="w-5 h-5 text-zinc-600" />
              }
            </button>
            <button onClick={() => handleRemove(s.id)}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
