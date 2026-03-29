import { useState } from 'react'
import { Radio, Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { addSource, removeSource, toggleSource } from '../api/client'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Card from './ui/Card'
import { Input, Select } from './ui/Input'
import EmptyState from './ui/EmptyState'

const TYPE_VARIANT = { twitter: 'info', youtube: 'danger', rss: 'warning' }

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
    <div className="space-y-5">
      <div className="flex items-end justify-between animate-fade">
        <div>
          <h1 className="text-xl font-bold text-content-1 tracking-tight">Fontes</h1>
          <p className="text-xs text-content-3 mt-1">Gerencie as fontes que o pipeline monitora</p>
        </div>
        <Button icon={Plus} onClick={() => setShowForm(!showForm)}>Nova fonte</Button>
      </div>

      {showForm && (
        <Card className="animate-in-fast">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-content-1">Adicionar fonte</h3>
            <button onClick={() => setShowForm(false)} className="text-content-4 hover:text-content-2"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Tipo" value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value })}>
              <option value="twitter">Twitter/X</option>
              <option value="youtube">YouTube</option>
              <option value="rss">RSS Feed</option>
            </Select>
            <Input label="Identificador" placeholder={form.source_type === 'rss' ? 'https://...' : '@handle'}
              value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} />
            <Select label="Topico" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}>
              <option value="guerra">Guerra</option>
              <option value="futebol">Futebol</option>
              <option value="política">Politica</option>
              <option value="entretenimento">Entretenimento</option>
            </Select>
          </div>
          <div className="mt-4"><Button onClick={handleAdd}>Adicionar</Button></div>
        </Card>
      )}

      <div className="space-y-1.5 stagger">
        {state.sources.length === 0 && (
          <EmptyState icon={Radio} title="Nenhuma fonte" description="Adicione fontes pra o pipeline monitorar" />
        )}
        {state.sources.map(s => (
          <div key={s.id} className={`flex items-center gap-3 p-3 bg-surface-2 border border-stroke-1 rounded-xl hover:border-stroke-2 transition-all ${!s.active ? 'opacity-40' : ''}`}>
            <Badge variant={TYPE_VARIANT[s.source_type] || 'default'} dot>{s.source_type}</Badge>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-content-1 truncate">{s.identifier}</p>
              <p className="text-[10px] text-content-4">{s.topic}</p>
            </div>
            <button onClick={async () => { await toggleSource(s.id); refresh() }} className="p-1.5 rounded-lg hover:bg-surface-3 transition-colors">
              {s.active ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5 text-content-4" />}
            </button>
            <button onClick={() => handleRemove(s.id)} className="p-1.5 rounded-lg text-content-4 hover:text-danger hover:bg-danger-muted transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
