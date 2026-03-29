import { useState, useEffect } from 'react'
import { MessageSquare, Save, Play, Check, X, ChevronDown, ChevronUp, Thermometer, Hash } from 'lucide-react'
import { getPrompts, updatePrompt, testPrompt } from '../api/client'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Card from './ui/Card'
import EmptyState from './ui/EmptyState'

function PromptEditor({ prompt, onSave, onTest }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    system_prompt: prompt.system_prompt,
    user_prompt_template: prompt.user_prompt_template,
    temperature: prompt.temperature,
    max_tokens: prompt.max_tokens,
  })
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await onSave(prompt.id, form)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const result = await onTest(prompt.id)
    setTestResult(result)
    setTesting(false)
  }

  // Conta placeholders no template
  const placeholders = (form.user_prompt_template.match(/\{(\w+)\}/g) || [])
    .map(p => p.replace(/[{}]/g, ''))
    .filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="bg-surface-2 border border-stroke-1 rounded-2xl overflow-hidden">
      {/* Header — sempre visível */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-3/30 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-accent-light" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-content-1">{prompt.name}</span>
            <Badge variant="default">{prompt.key}</Badge>
            {!prompt.active && <Badge variant="danger">Desativado</Badge>}
            {saved && <Badge variant="success"><Check className="w-2.5 h-2.5" /> Salvo</Badge>}
          </div>
          <p className="text-[11px] text-content-3 mt-0.5 truncate">{prompt.description}</p>
        </div>
        <div className="flex items-center gap-2 text-content-4">
          <span className="text-[9px] font-mono">temp:{prompt.temperature}</span>
          <span className="text-[9px] font-mono">max:{prompt.max_tokens}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-stroke-1 p-4 space-y-4 animate-in-fast">
          {/* System prompt */}
          <div>
            <label className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-content-3">System Prompt</span>
              {!editing && (
                <button onClick={() => setEditing(true)} className="text-[10px] text-accent-light hover:underline">
                  Editar
                </button>
              )}
            </label>
            <textarea
              value={form.system_prompt}
              onChange={e => setForm({ ...form, system_prompt: e.target.value })}
              readOnly={!editing}
              rows={3}
              className={`w-full bg-surface-3 border rounded-lg px-3 py-2 text-xs font-mono text-content-2 resize-y outline-none ${
                editing ? 'border-accent/40 focus:border-accent/60' : 'border-stroke-2'
              }`}
            />
          </div>

          {/* User prompt template */}
          <div>
            <label className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-medium text-content-3">User Prompt Template</span>
              {placeholders.length > 0 && (
                <span className="text-[9px] text-content-4">
                  Vars: {placeholders.map(p => `{${p}}`).join(', ')}
                </span>
              )}
            </label>
            <textarea
              value={form.user_prompt_template}
              onChange={e => setForm({ ...form, user_prompt_template: e.target.value })}
              readOnly={!editing}
              rows={10}
              className={`w-full bg-surface-3 border rounded-lg px-3 py-2 text-xs font-mono text-content-2 resize-y outline-none leading-relaxed ${
                editing ? 'border-accent/40 focus:border-accent/60' : 'border-stroke-2'
              }`}
            />
          </div>

          {/* Temperature + Max tokens */}
          {editing && (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Thermometer className="w-3.5 h-3.5 text-content-4" />
                <span className="text-[11px] text-content-3">Temperature:</span>
                <input type="number" min="0" max="1" step="0.1"
                  value={form.temperature}
                  onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) || 0.3 })}
                  className="w-16 bg-surface-3 border border-stroke-2 rounded px-2 py-1 text-xs font-mono text-content-1 outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-content-4" />
                <span className="text-[11px] text-content-3">Max tokens:</span>
                <input type="number" min="100" max="2000" step="50"
                  value={form.max_tokens}
                  onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) || 600 })}
                  className="w-20 bg-surface-3 border border-stroke-2 rounded px-2 py-1 text-xs font-mono text-content-1 outline-none focus:border-accent/50"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-stroke-1">
            {editing && (
              <>
                <Button size="sm" icon={Save} onClick={handleSave}>Salvar</Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  setEditing(false)
                  setForm({
                    system_prompt: prompt.system_prompt,
                    user_prompt_template: prompt.user_prompt_template,
                    temperature: prompt.temperature,
                    max_tokens: prompt.max_tokens,
                  })
                }}>Cancelar</Button>
              </>
            )}
            <Button size="sm" variant="secondary" icon={Play} onClick={handleTest}
              className={testing ? 'opacity-50 pointer-events-none' : ''}>
              {testing ? 'Testando...' : 'Testar prompt'}
            </Button>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`rounded-lg p-3 text-xs font-mono ${
              testResult.status === 'ok'
                ? 'bg-success-muted border border-success/20'
                : 'bg-danger-muted border border-danger/20'
            }`}>
              <p className={`font-semibold mb-1 ${testResult.status === 'ok' ? 'text-success' : 'text-danger'}`}>
                {testResult.status === 'ok' ? 'Sucesso!' : 'Erro:'}
              </p>
              <pre className="text-content-2 whitespace-pre-wrap text-[10px] max-h-40 overflow-auto">
                {testResult.status === 'ok'
                  ? JSON.stringify(testResult.result, null, 2)
                  : testResult.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PromptsView() {
  const [prompts, setPrompts] = useState([])

  async function load() {
    try {
      const data = await getPrompts()
      setPrompts(data.prompts)
    } catch {}
  }

  useEffect(() => { load() }, [])

  async function handleSave(id, data) {
    await updatePrompt(id, data)
    load()
  }

  async function handleTest(id) {
    return await testPrompt(id)
  }

  return (
    <div className="space-y-5">
      <div className="animate-fade">
        <h1 className="text-xl font-bold text-content-1 tracking-tight">Prompts</h1>
        <p className="text-xs text-content-3 mt-1">
          Edite as instrucoes da IA — mude o tom, estilo, regras de classificacao, etc.
          Tudo que a IA faz e controlado por estes prompts.
        </p>
      </div>

      {/* Info card */}
      <div className="bg-accent-muted border border-accent/20 rounded-xl p-4 animate-in" style={{ animationDelay: '50ms' }}>
        <p className="text-xs text-accent-light">
          <strong>Dica:</strong> Cada prompt tem variaveis entre {'{chaves}'} que sao preenchidas automaticamente.
          Voce pode mudar o texto, tom e regras livremente. Use o botao "Testar" pra ver o resultado antes de salvar.
        </p>
      </div>

      <div className="space-y-2 stagger">
        {prompts.length === 0 && (
          <EmptyState icon={MessageSquare} title="Carregando prompts..." />
        )}
        {prompts.map(p => (
          <PromptEditor key={p.id} prompt={p} onSave={handleSave} onTest={handleTest} />
        ))}
      </div>
    </div>
  )
}
