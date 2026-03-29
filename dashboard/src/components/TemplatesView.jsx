import { useState, useEffect } from 'react'
import { Palette, Plus, Check, Star, Loader2, Wand2, Eye, Save, X, Layout } from 'lucide-react'
import { getTemplates, updateTemplate, createTemplateFromNatural } from '../api/client'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Card, { CardHeader } from './ui/Card'

// Preview visual do template (mini canvas)
function TemplatePreview({ layoutJson, selected }) {
  let elements = []
  try { elements = JSON.parse(layoutJson)?.elements || [] } catch {}

  return (
    <div className={`relative w-full aspect-[9/16] bg-surface-4 rounded-xl overflow-hidden border-2 transition-all ${
      selected ? 'border-accent shadow-lg shadow-accent/20' : 'border-stroke-1'
    }`}>
      {/* Mini preview dos elementos */}
      {elements.map((el, i) => {
        const scale = 1 / 12 // 1080→~90px
        if (el.type === 'bar') {
          const top = el.position === 'top' ? 0 : undefined
          const bottom = el.position === 'bottom' ? 0 : undefined
          return <div key={i} className="absolute left-0 right-0" style={{ top, bottom, height: Math.max(2, el.height * scale), backgroundColor: el.color }} />
        }
        if (el.type === 'overlay') {
          const yPos = el.position === 'top' ? 0 : el.position === 'bottom' ? undefined : (el.y || 0) * scale
          const bottom = el.position === 'bottom' ? 0 : undefined
          return <div key={i} className="absolute left-0 right-0" style={{ top: yPos, bottom, height: (el.height || 100) * scale, backgroundColor: el.color || 'black', opacity: el.opacity || 0.5 }} />
        }
        if (el.type === 'badge') {
          return <div key={i} className="absolute rounded-sm" style={{ left: (el.x || 0) * scale, top: (el.y || 0) * scale, fontSize: 4, padding: '1px 3px', backgroundColor: el.color || '#ef4444', color: 'white' }}>{el.text}</div>
        }
        if (el.type === 'title') {
          return <div key={i} className="absolute left-1 right-1" style={{ top: (el.y || 0) * scale }}>
            <div className="h-1.5 bg-white/80 rounded-full w-3/4 mb-0.5" />
            <div className="h-1.5 bg-white/50 rounded-full w-1/2" />
          </div>
        }
        if (el.type === 'summary') {
          return <div key={i} className="absolute left-1 right-1 space-y-0.5" style={{ top: (el.y || 0) * scale }}>
            <div className="h-1 bg-white/30 rounded-full w-full" />
            <div className="h-1 bg-white/30 rounded-full w-4/5" />
            <div className="h-1 bg-white/30 rounded-full w-3/5" />
          </div>
        }
        if (el.type === 'progress_bar') {
          return <div key={i} className="absolute left-0 bottom-0 right-0" style={{ height: Math.max(1, (el.height || 4) * scale), backgroundColor: el.color || '#6366f1' }}>
            <div className="h-full w-2/3 rounded-r" style={{ backgroundColor: el.color || '#6366f1' }} />
          </div>
        }
        if (el.type === 'letterbox') {
          return <div key={i}><div className="absolute left-0 right-0 top-0" style={{ height: (el.height || 120) * scale, backgroundColor: 'black' }} /><div className="absolute left-0 right-0 bottom-0" style={{ height: (el.height || 120) * scale, backgroundColor: 'black' }} /></div>
        }
        return null
      })}

      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}
    </div>
  )
}

function TemplateCard({ template, isSelected, onSelect, onEdit }) {
  return (
    <div className={`cursor-pointer transition-all hover-lift ${isSelected ? '' : 'opacity-80 hover:opacity-100'}`} onClick={onSelect}>
      <TemplatePreview layoutJson={template.layout_json} selected={isSelected} />
      <div className="mt-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-content-1">{template.name}</span>
          {template.is_default && <Star className="w-3 h-3 text-warning fill-warning" />}
        </div>
        <p className="text-[9px] text-content-4 mt-0.5 line-clamp-2">{template.description}</p>
      </div>
    </div>
  )
}

export default function TemplatesView() {
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState(null)
  const [naturalInput, setNaturalInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editJson, setEditJson] = useState('')

  async function load() {
    try {
      const d = await getTemplates()
      setTemplates(d.templates)
      const def = d.templates.find(t => t.is_default)
      if (def && !selected) setSelected(def.id)
    } catch {}
  }
  useEffect(() => { load() }, [])

  async function handleSetDefault(id) {
    await updateTemplate(id, { is_default: true })
    load()
  }

  async function handleNatural() {
    if (!naturalInput.trim()) return
    setGenerating(true)
    setGenResult(null)
    try {
      const r = await createTemplateFromNatural(naturalInput, selected)
      setGenResult(r)
      if (r.status === 'ok') {
        setNaturalInput('')
        load()
        setSelected(r.template_id)
      }
    } catch (e) { setGenResult({ status: 'error', error: e.message }) }
    setGenerating(false)
  }

  async function handleSaveJson() {
    if (!editing) return
    try {
      JSON.parse(editJson) // valida
      await updateTemplate(editing, { layout_json: editJson })
      setEditing(null)
      load()
    } catch { alert('JSON invalido') }
  }

  const selectedTemplate = templates.find(t => t.id === selected)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-lg shadow-pink-500/15">
            <Layout className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-1 tracking-tight">Templates Visuais</h1>
            <p className="text-xs text-content-3 mt-0.5">Defina o layout dos videos — barras, titulos, badges, posicoes</p>
          </div>
        </div>
      </div>

      {/* Natural language creator */}
      <Card glow className="animate-in" style={{ animationDelay: '50ms' }}>
        <CardHeader icon={Wand2} title="Criar template por linguagem natural" subtitle="ia" />
        <div className="space-y-3">
          <textarea value={naturalInput} onChange={e => setNaturalInput(e.target.value)}
            rows={2}
            placeholder="Exemplos:&#10;• Adiciona uma barra preta no topo com o titulo da noticia em branco&#10;• Estilo CNN com badge vermelho BREAKING NEWS no canto superior&#10;• Minimalista so com texto no centro e barra de progresso embaixo"
            className="w-full bg-surface-3 border border-stroke-2 rounded-xl px-3 py-2.5 text-xs text-content-1 placeholder-content-4 outline-none resize-y focus:border-accent/50" />
          <div className="flex items-center gap-3">
            <Button icon={generating ? Loader2 : Wand2} onClick={handleNatural}
              className={generating ? 'opacity-70 pointer-events-none' : ''}>
              {generating ? 'Gerando...' : 'Criar template'}
            </Button>
            {selected && <span className="text-[9px] text-content-4">Base: {selectedTemplate?.name || 'nenhum'}</span>}
          </div>
          {genResult?.status === 'ok' && (
            <div className="p-2.5 bg-success-muted border border-success/20 rounded-xl text-xs text-success">
              ✅ Template "{genResult.template?.name}" criado!
            </div>
          )}
          {genResult?.status === 'error' && (
            <div className="p-2.5 bg-danger-muted border border-danger/20 rounded-xl text-xs text-danger">
              ❌ {genResult.error}
            </div>
          )}
        </div>
      </Card>

      {/* Template grid */}
      <div>
        <p className="text-[10px] font-semibold text-content-3 uppercase tracking-wider mb-3">Templates disponiveis</p>
        <div className="grid grid-cols-4 lg:grid-cols-6 gap-3 stagger">
          {templates.map(t => (
            <TemplateCard key={t.id} template={t} isSelected={selected === t.id}
              onSelect={() => setSelected(t.id)}
              onEdit={() => { setEditing(t.id); setEditJson(t.layout_json) }} />
          ))}
        </div>
      </div>

      {/* Selected template detail */}
      {selectedTemplate && (
        <Card className="animate-in">
          <div className="flex items-start gap-4">
            <div className="w-24">
              <TemplatePreview layoutJson={selectedTemplate.layout_json} selected />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-content-1">{selectedTemplate.name}</h3>
                <Badge variant={selectedTemplate.category === 'news' ? 'danger' : selectedTemplate.category === 'tiktok' ? 'accent' : 'default'}>{selectedTemplate.category}</Badge>
                {selectedTemplate.is_default && <Badge variant="warning"><Star className="w-2.5 h-2.5" /> Padrao</Badge>}
              </div>
              <p className="text-xs text-content-3 mb-3">{selectedTemplate.description}</p>

              <div className="flex gap-2">
                {!selectedTemplate.is_default && (
                  <Button size="sm" variant="secondary" icon={Star} onClick={() => handleSetDefault(selectedTemplate.id)}>Definir como padrao</Button>
                )}
                <Button size="sm" variant="ghost" icon={Eye} onClick={() => { setEditing(selectedTemplate.id); setEditJson(selectedTemplate.layout_json) }}>
                  {editing === selectedTemplate.id ? 'Fechar editor' : 'Editar JSON'}
                </Button>
              </div>
            </div>
          </div>

          {/* JSON editor */}
          {editing === selectedTemplate.id && (
            <div className="mt-4 pt-4 border-t border-stroke-1">
              <p className="text-[10px] font-semibold text-content-3 uppercase tracking-wider mb-2">Layout JSON</p>
              <textarea value={editJson} onChange={e => setEditJson(e.target.value)}
                rows={12}
                className="w-full bg-surface-3 border border-stroke-2 rounded-xl px-3 py-2.5 text-[10px] font-mono text-content-2 outline-none resize-y focus:border-accent/50 leading-relaxed" />
              <div className="flex gap-2 mt-2">
                <Button size="sm" icon={Save} onClick={handleSaveJson}>Salvar</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
