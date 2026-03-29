import { useState, useEffect } from 'react'
import { Save, Plus, X, Check } from 'lucide-react'
import { getSettings, updateSettings } from '../api/client'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Card, { CardHeader } from './ui/Card'
import { Input, Toggle } from './ui/Input'

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

  if (!config) return <p className="text-content-4 text-sm p-8">Carregando configuracoes...</p>

  return (
    <div className="space-y-5 max-w-xl">
      <div className="animate-fade">
        <h1 className="text-xl font-bold text-content-1 tracking-tight">Configuracoes</h1>
        <p className="text-xs text-content-3 mt-1">Ajuste o comportamento do pipeline</p>
      </div>

      <Card className="animate-in" style={{ animationDelay: '80ms' }}>
        <CardHeader title="Publicacao" subtitle="controle" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-content-2">Publicacao automatica</p>
            <p className="text-[11px] text-content-4 mt-0.5">Publica clips sem aprovacao manual</p>
          </div>
          <Toggle checked={config.auto_publish} onChange={() => setConfig({ ...config, auto_publish: !config.auto_publish })} />
        </div>
      </Card>

      <Card className="animate-in" style={{ animationDelay: '160ms' }}>
        <CardHeader title="Confianca minima" subtitle="deteccao" />
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-content-2">Threshold</p>
          <span className="text-sm font-mono text-accent-light">{config.moment_confidence_threshold}</span>
        </div>
        <input type="range" min="0.3" max="0.95" step="0.05"
          value={config.moment_confidence_threshold}
          onChange={e => setConfig({ ...config, moment_confidence_threshold: parseFloat(e.target.value) })}
          className="w-full" />
        <div className="flex justify-between text-[10px] text-content-4 mt-2">
          <span>Mais clips (menos preciso)</span>
          <span>Menos clips (mais preciso)</span>
        </div>
      </Card>

      <Card className="animate-in" style={{ animationDelay: '240ms' }}>
        <CardHeader title="Topicos monitorados" subtitle="keywords" />
        <div className="flex flex-wrap gap-1.5 mb-4">
          {config.monitor_topics.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-1 bg-surface-3 border border-stroke-2 rounded-lg text-xs text-content-2">
              {t}
              <button onClick={() => setConfig({ ...config, monitor_topics: config.monitor_topics.filter(x => x !== t) })}
                className="text-content-4 hover:text-danger transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Novo topico..." value={newTopic} onChange={e => setNewTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTopic()} />
          <Button variant="secondary" icon={Plus} onClick={addTopic} className="flex-shrink-0">Add</Button>
        </div>
      </Card>

      <Button icon={saved ? Check : Save} onClick={handleSave}
        className={`animate-in ${saved ? '!bg-success' : ''}`} style={{ animationDelay: '320ms' }}>
        {saved ? 'Salvo!' : 'Salvar configuracoes'}
      </Button>
    </div>
  )
}
