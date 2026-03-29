import { useState, useEffect } from 'react'
import { Settings, Save, Plus, X } from 'lucide-react'
import { getSettings, updateSettings } from '../api/client'

export default function SettingsView() {
  const [config, setConfig] = useState(null)
  const [newTopic, setNewTopic] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then(setConfig).catch(console.error)
  }, [])

  async function handleSave() {
    try {
      await updateSettings({
        auto_publish: config.auto_publish,
        monitor_topics: config.monitor_topics,
        moment_confidence_threshold: config.moment_confidence_threshold,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert(`Erro: ${err.message}`)
    }
  }

  function addTopic() {
    if (!newTopic.trim() || config.monitor_topics.includes(newTopic.trim())) return
    setConfig({ ...config, monitor_topics: [...config.monitor_topics, newTopic.trim()] })
    setNewTopic('')
  }

  function removeTopic(topic) {
    setConfig({ ...config, monitor_topics: config.monitor_topics.filter((t) => t !== topic) })
  }

  if (!config) {
    return <div className="text-gray-500">Carregando configuracoes...</div>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Configuracoes</h2>
        <p className="text-gray-500 text-sm mt-1">Ajuste o comportamento do agente</p>
      </div>

      {/* Auto publish */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-400">Publicacao</h3>

        <label className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Publicacao automatica</p>
            <p className="text-gray-500 text-xs">Publica clips automaticamente sem aprovacao manual</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, auto_publish: !config.auto_publish })}
            className={`w-12 h-6 rounded-full transition-all ${
              config.auto_publish ? 'bg-nexus-600' : 'bg-gray-700'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-all ${
              config.auto_publish ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </label>
      </div>

      {/* Confidence threshold */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-400">Deteccao</h3>

        <div>
          <label className="flex items-center justify-between mb-2">
            <p className="text-white text-sm font-medium">Confianca minima</p>
            <span className="text-nexus-400 font-mono text-sm">{config.moment_confidence_threshold}</span>
          </label>
          <input
            type="range"
            min="0.3"
            max="0.95"
            step="0.05"
            value={config.moment_confidence_threshold}
            onChange={(e) => setConfig({ ...config, moment_confidence_threshold: parseFloat(e.target.value) })}
            className="w-full accent-nexus-600"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>Mais clips (menos preciso)</span>
            <span>Menos clips (mais preciso)</span>
          </div>
        </div>
      </div>

      {/* Tópicos monitorados */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-400">Topicos Monitorados</h3>

        <div className="flex flex-wrap gap-2">
          {config.monitor_topics.map((topic) => (
            <span
              key={topic}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-full text-sm text-white"
            >
              {topic}
              <button onClick={() => removeTopic(topic)} className="text-gray-500 hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTopic()}
            placeholder="Novo topico (ex: guerra, economia, copa)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
          />
          <button
            onClick={addTopic}
            className="p-2 bg-nexus-600/20 text-nexus-400 rounded-lg hover:bg-nexus-600/30"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Salvar */}
      <button
        onClick={handleSave}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${
          saved
            ? 'bg-green-600 text-white'
            : 'bg-nexus-600 text-white hover:bg-nexus-700'
        }`}
      >
        <Save className="w-4 h-4" />
        {saved ? 'Salvo!' : 'Salvar Configuracoes'}
      </button>
    </div>
  )
}
