import { useState, useEffect } from 'react'
import { Save, Plus, X, Check } from 'lucide-react'
import { getSettings, updateSettings } from '../api/client'

export default function SettingsView() {
  const [config, setConfig] = useState(null)
  const [newTopic, setNewTopic] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { getSettings().then(setConfig) }, [])

  async function handleSave() {
    await updateSettings({
      auto_publish: config.auto_publish,
      monitor_topics: config.monitor_topics,
      moment_confidence_threshold: config.moment_confidence_threshold,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addTopic() {
    if (!newTopic.trim() || config.monitor_topics.includes(newTopic.trim())) return
    setConfig({ ...config, monitor_topics: [...config.monitor_topics, newTopic.trim()] })
    setNewTopic('')
  }

  if (!config) return <p className="text-zinc-600 text-sm">Carregando...</p>

  return (
    <div className="space-y-6 max-w-xl">
      <div className="anim-fade">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Configuracoes</h1>
        <p className="text-sm text-zinc-500 mt-1">Ajuste o comportamento do agente</p>
      </div>

      {/* Auto publish */}
      <div className="anim-fade-up bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5" style={{ animationDelay: '100ms' }}>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Publicacao</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-200">Publicacao automatica</p>
            <p className="text-xs text-zinc-600 mt-0.5">Publica sem aprovacao manual</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, auto_publish: !config.auto_publish })}
            className={`w-11 h-6 rounded-full transition-colors relative ${config.auto_publish ? 'bg-violet-600' : 'bg-zinc-700'}`}
          >
            <div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${config.auto_publish ? 'left-[22px]' : 'left-0.5'}`}
                 style={{ width: 20, height: 20 }} />
          </button>
        </div>
      </div>

      {/* Threshold */}
      <div className="anim-fade-up bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5" style={{ animationDelay: '200ms' }}>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Deteccao</h3>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-zinc-200">Confianca minima</p>
          <span className="text-sm font-mono text-violet-400">{config.moment_confidence_threshold}</span>
        </div>
        <input type="range" min="0.3" max="0.95" step="0.05"
          value={config.moment_confidence_threshold}
          onChange={(e) => setConfig({ ...config, moment_confidence_threshold: parseFloat(e.target.value) })}
          className="w-full" />
        <div className="flex justify-between text-[10px] text-zinc-600 mt-2">
          <span>Mais clips</span>
          <span>Mais preciso</span>
        </div>
      </div>

      {/* Topics */}
      <div className="anim-fade-up bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5" style={{ animationDelay: '300ms' }}>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Topicos monitorados</h3>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {config.monitor_topics.map((t) => (
            <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800/80 rounded-md text-xs text-zinc-300 border border-zinc-700/50">
              {t}
              <button onClick={() => setConfig({ ...config, monitor_topics: config.monitor_topics.filter(x => x !== t) })}
                className="text-zinc-600 hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTopic()}
            placeholder="Novo topico..."
            className="flex-1 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50" />
          <button onClick={addTopic} className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-violet-400 transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Save */}
      <button onClick={handleSave}
        className={`anim-fade-up flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
          saved ? 'bg-emerald-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'
        }`} style={{ animationDelay: '400ms' }}>
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Salvo!' : 'Salvar'}
      </button>
    </div>
  )
}
