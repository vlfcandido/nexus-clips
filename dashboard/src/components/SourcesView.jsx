import { useState } from 'react'
import { Radio, Plus, Trash2, ToggleLeft, ToggleRight, Twitter, Youtube, Rss } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { addSource, removeSource, toggleSource } from '../api/client'

const SOURCE_ICONS = {
  twitter: Twitter,
  youtube: Youtube,
  rss: Rss,
}

const SOURCE_COLORS = {
  twitter: 'text-blue-400',
  youtube: 'text-red-400',
  rss: 'text-orange-400',
}

export default function SourcesView() {
  const { state, refresh } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ source_type: 'twitter', identifier: '', topic: 'futebol' })

  async function handleAdd() {
    if (!form.identifier.trim()) return
    try {
      await addSource(form)
      setForm({ source_type: 'twitter', identifier: '', topic: 'futebol' })
      setShowForm(false)
      refresh()
    } catch (err) {
      alert(`Erro: ${err.message}`)
    }
  }

  async function handleRemove(id) {
    if (!confirm('Remover esta fonte?')) return
    try {
      await removeSource(id)
      refresh()
    } catch (err) {
      alert(`Erro: ${err.message}`)
    }
  }

  async function handleToggle(id) {
    try {
      await toggleSource(id)
      refresh()
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Fontes</h2>
          <p className="text-gray-500 text-sm mt-1">Gerencie as fontes monitoradas pelo agente</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-nexus-600 text-white rounded-lg text-sm font-medium hover:bg-nexus-700 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nova Fonte
        </button>
      </div>

      {/* Form nova fonte */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-400">Adicionar Fonte</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select
                value={form.source_type}
                onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="twitter">Twitter/X</option>
                <option value="youtube">YouTube</option>
                <option value="rss">RSS Feed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {form.source_type === 'twitter' ? '@handle' : form.source_type === 'youtube' ? 'Channel ID' : 'Feed URL'}
              </label>
              <input
                type="text"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                placeholder={form.source_type === 'twitter' ? '@ge_globo' : form.source_type === 'rss' ? 'https://...' : 'UCxxxxxx'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Topico</label>
              <select
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="futebol">Futebol</option>
                <option value="política">Politica</option>
                <option value="entretenimento">Entretenimento</option>
                <option value="guerra">Guerra</option>
                <option value="economia">Economia</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-nexus-600 text-white rounded-lg text-sm font-medium hover:bg-nexus-700"
            >
              Adicionar
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de fontes */}
      <div className="space-y-2">
        {state.sources.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma fonte configurada. Adicione fontes pra o agente monitorar.</p>
          </div>
        )}

        {state.sources.map((source) => {
          const Icon = SOURCE_ICONS[source.source_type] || Radio
          return (
            <div
              key={source.id}
              className={`bg-gray-900 border rounded-xl p-4 flex items-center justify-between transition-all ${
                source.active ? 'border-gray-800' : 'border-gray-800/50 opacity-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <Icon className={`w-5 h-5 ${SOURCE_COLORS[source.source_type] || 'text-gray-400'}`} />
                <div>
                  <p className="text-white font-medium text-sm">{source.identifier}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{source.source_type}</span>
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-500">{source.topic}</span>
                    {source.last_checked && (
                      <>
                        <span className="text-xs text-gray-600">·</span>
                        <span className="text-xs text-gray-600">
                          Ultimo check: {new Date(source.last_checked).toLocaleTimeString('pt-BR')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(source.id)}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-all"
                  title={source.active ? 'Desativar' : 'Ativar'}
                >
                  {source.active ? (
                    <ToggleRight className="w-5 h-5 text-green-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                <button
                  onClick={() => handleRemove(source.id)}
                  className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-red-400 transition-all"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
