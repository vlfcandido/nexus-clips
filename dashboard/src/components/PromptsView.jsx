import { useState, useEffect } from 'react'
import {
  MessageSquare, Save, Play, Check, X, ChevronDown, ChevronUp,
  Thermometer, Hash, Sparkles, Loader2, Volume2, Image, Target,
  TrendingUp, Type, FileText, AlertCircle, Eye,
} from 'lucide-react'
import { getPrompts, updatePrompt, testPrompt } from '../api/client'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Card from './ui/Card'
import EmptyState from './ui/EmptyState'

// ==================== CONFIG ====================

const PROMPT_META = {
  narration: {
    group: 'video',
    icon: Volume2,
    color: 'from-rose-500 to-orange-500',
    badge: 'danger',
    title: 'Narracao do Video',
    subtitle: 'O que a voz fala',
    help: 'Este prompt controla EXATAMENTE o texto que a voz narra. Mude o tom, estilo, tamanho e estrutura aqui.',
    tips: [
      'Use "fale como..." pra definir o tom (jornalista, creator, narrador)',
      'Defina o tamanho: "maximo 80 palavras, frases curtas"',
      'Estruture: "comece com pergunta, depois fato, depois opiniao"',
      'Teste com o botao abaixo antes de salvar',
    ],
  },
  image_search: {
    group: 'video',
    icon: Image,
    color: 'from-cyan-500 to-blue-500',
    badge: 'info',
    title: 'Busca de Imagens',
    subtitle: 'Que fotos aparecem no video',
    help: 'Controla as palavras usadas pra buscar imagens no Pexels. Quanto mais especifico, melhores as imagens.',
    tips: [
      'Seja especifico: "soldados americanos no deserto" > "guerra"',
      'Mencione lugares, pessoas, objetos do conteudo',
    ],
  },
  classify: {
    group: 'decisao',
    icon: Target,
    color: 'from-violet-500 to-indigo-500',
    badge: 'accent',
    title: 'Classificador',
    subtitle: 'Decide se vira video',
    help: 'Analisa cada noticia e decide: e relevante? Qual topico? Qual viralidade? Se mudar os criterios aqui, muda o que vira video.',
    tips: [
      'Aumente viralidade minima pra ser mais seletivo',
      'Adicione categorias novas se quiser',
    ],
  },
  strategy: {
    group: 'decisao',
    icon: FileText,
    color: 'from-amber-500 to-yellow-500',
    badge: 'warning',
    title: 'Estrategista',
    subtitle: 'Formato e plataforma',
    help: 'Decide o formato (short, reel), plataforma prioritaria, duracao e se usa voz ou nao.',
  },
  growth_hook: {
    group: 'growth',
    icon: TrendingUp,
    color: 'from-emerald-500 to-green-500',
    badge: 'success',
    title: 'Growth Hook',
    subtitle: 'Gancho de abertura',
    help: 'Gera o gancho que prende nos primeiros 2 segundos. Crucial pra viralizar.',
    tips: [
      'Hooks que funcionam: perguntas, numeros chocantes, "voce nao vai acreditar"',
      'Peca CTAs que geram comentarios (algoritmo ama comentarios)',
    ],
  },
  caption_tiktok: {
    group: 'captions',
    icon: Type,
    color: 'from-pink-500 to-rose-500',
    badge: 'danger',
    title: 'Caption TikTok',
    subtitle: 'Titulo e hashtags',
    help: 'Texto que aparece no TikTok. Maximo 150 chars no titulo, 5-8 hashtags.',
  },
  caption_instagram: {
    group: 'captions',
    icon: Type,
    color: 'from-purple-500 to-pink-500',
    badge: 'accent',
    title: 'Caption Instagram',
    subtitle: 'Reels description',
    help: 'Caption do Instagram. Pode ser mais longa, 20-30 hashtags.',
  },
  caption_youtube: {
    group: 'captions',
    icon: Type,
    color: 'from-red-500 to-rose-500',
    badge: 'danger',
    title: 'Caption YouTube',
    subtitle: 'Titulo SEO + descricao',
    help: 'Titulo otimizado pra SEO do YouTube. Descricao com keywords.',
  },
}

const GROUP_INFO = {
  video: { label: 'Producao do Video', desc: 'Controlam o que aparece e o que a voz fala', icon: '🎬' },
  decisao: { label: 'Decisoes da IA', desc: 'Controlam o que vira video e como', icon: '🎯' },
  growth: { label: 'Crescimento', desc: 'Estrategias pra viralizar e engajar', icon: '🚀' },
  captions: { label: 'Textos de Publicacao', desc: 'Titulos e descricoes por plataforma', icon: '✍️' },
}

// ==================== PROMPT CARD ====================

function PromptCard({ prompt, meta, onSave, onTest }) {
  const [open, setOpen] = useState(false)
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

  const Icon = meta?.icon || MessageSquare

  async function handleSave() {
    await onSave(prompt.id, form)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const r = await onTest(prompt.id)
    setTestResult(r)
    setTesting(false)
  }

  // Conta placeholders
  const vars = [...new Set((form.user_prompt_template.match(/\{(\w+)\}/g) || []).map(p => p.replace(/[{}]/g, '')))]

  return (
    <div className={`bg-surface-2 border rounded-2xl overflow-hidden transition-all duration-200 ${
      open ? 'border-stroke-2 shadow-lg shadow-black/10' : 'border-stroke-1 hover:border-stroke-2'
    }`}>
      {/* Header — sempre visível */}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 text-left group">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center shadow-md flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-content-1">{meta?.title || prompt.name}</span>
            {saved && <Badge variant="success"><Check className="w-2.5 h-2.5" /> Salvo</Badge>}
          </div>
          <p className="text-[11px] text-content-3 mt-0.5">{meta?.subtitle || prompt.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-content-4 hidden sm:block">temp: {prompt.temperature}</span>
          {open ? <ChevronUp className="w-4 h-4 text-content-4" /> : <ChevronDown className="w-4 h-4 text-content-4 group-hover:text-content-3" />}
        </div>
      </button>

      {/* Expanded */}
      {open && (
        <div className="border-t border-stroke-1 animate-in-fast">
          {/* Help section */}
          {meta?.help && (
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-start gap-2 p-3 bg-accent-muted/30 border border-accent/10 rounded-xl">
                <AlertCircle className="w-4 h-4 text-accent-light flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-content-2 leading-relaxed">{meta.help}</p>
                  {meta.tips && (
                    <ul className="mt-2 space-y-1">
                      {meta.tips.map((tip, i) => (
                        <li key={i} className="text-[10px] text-content-3 flex items-start gap-1.5">
                          <span className="text-accent-light mt-0.5">→</span> {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="px-4 pb-4 space-y-3">
            {/* System prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-content-3 uppercase tracking-wider">Instrucao do sistema</label>
                {!editing && (
                  <button onClick={() => setEditing(true)} className="text-[10px] text-accent-light hover:underline font-medium">
                    Editar
                  </button>
                )}
              </div>
              <textarea
                value={form.system_prompt}
                onChange={e => setForm({ ...form, system_prompt: e.target.value })}
                readOnly={!editing}
                rows={2}
                className={`w-full bg-surface-3/50 border rounded-xl px-3 py-2.5 text-xs font-mono text-content-2 resize-y outline-none leading-relaxed transition-all ${
                  editing ? 'border-accent/30 bg-surface-3 focus:border-accent/50 focus:ring-1 focus:ring-accent/20' : 'border-stroke-1'
                }`}
              />
            </div>

            {/* User prompt */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-[10px] font-semibold text-content-3 uppercase tracking-wider">Template do prompt</label>
                {vars.length > 0 && (
                  <div className="flex gap-1">
                    {vars.slice(0, 5).map(v => (
                      <span key={v} className="px-1.5 py-0.5 bg-accent-muted rounded text-[8px] font-mono text-accent-light">{`{${v}}`}</span>
                    ))}
                    {vars.length > 5 && <span className="text-[8px] text-content-4">+{vars.length - 5}</span>}
                  </div>
                )}
              </div>
              <textarea
                value={form.user_prompt_template}
                onChange={e => setForm({ ...form, user_prompt_template: e.target.value })}
                readOnly={!editing}
                rows={8}
                className={`w-full bg-surface-3/50 border rounded-xl px-3 py-2.5 text-xs font-mono text-content-2 resize-y outline-none leading-relaxed transition-all ${
                  editing ? 'border-accent/30 bg-surface-3 focus:border-accent/50 focus:ring-1 focus:ring-accent/20' : 'border-stroke-1'
                }`}
              />
            </div>

            {/* Settings row */}
            {editing && (
              <div className="flex items-center gap-4 p-3 bg-surface-3/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-3.5 h-3.5 text-content-4" />
                  <label className="text-[10px] text-content-3">Criatividade:</label>
                  <input type="range" min="0" max="1" step="0.1" value={form.temperature}
                    onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                    className="w-20" />
                  <span className="text-[10px] font-mono text-accent-light w-6">{form.temperature}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-content-4" />
                  <label className="text-[10px] text-content-3">Max tokens:</label>
                  <input type="number" min="100" max="2000" step="50" value={form.max_tokens}
                    onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) || 600 })}
                    className="w-16 bg-surface-4 border border-stroke-2 rounded-lg px-2 py-1 text-[10px] font-mono text-content-1 outline-none" />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {editing ? (
                <>
                  <Button size="sm" icon={Save} onClick={handleSave}>Salvar</Button>
                  <Button size="sm" variant="secondary" onClick={() => {
                    setEditing(false)
                    setForm({ system_prompt: prompt.system_prompt, user_prompt_template: prompt.user_prompt_template, temperature: prompt.temperature, max_tokens: prompt.max_tokens })
                  }}>Cancelar</Button>
                </>
              ) : null}
              <Button size="sm" variant="secondary" icon={testing ? Loader2 : Play} onClick={handleTest}
                className={testing ? 'opacity-50 pointer-events-none' : ''}>
                {testing ? 'Testando...' : 'Testar'}
              </Button>
              <Button size="sm" variant="ghost" icon={Eye} onClick={() => setOpen(false)}>Fechar</Button>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`p-3 rounded-xl text-xs ${
                testResult.status === 'ok' ? 'bg-success-muted border border-success/20' : 'bg-danger-muted border border-danger/20'
              }`}>
                <p className={`font-semibold mb-1.5 ${testResult.status === 'ok' ? 'text-success' : 'text-danger'}`}>
                  {testResult.status === 'ok' ? '✅ Resultado do teste:' : '❌ Erro:'}
                </p>
                <pre className="text-content-2 whitespace-pre-wrap text-[10px] font-mono max-h-48 overflow-auto leading-relaxed">
                  {testResult.status === 'ok' ? JSON.stringify(testResult.result, null, 2) : testResult.error}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== MAIN VIEW ====================

export default function PromptsView() {
  const [prompts, setPrompts] = useState([])

  async function load() {
    try { const d = await getPrompts(); setPrompts(d.prompts) } catch {}
  }
  useEffect(() => { load() }, [])

  async function handleSave(id, data) { await updatePrompt(id, data); load() }
  async function handleTest(id) { return await testPrompt(id) }

  // Agrupa
  const groups = {}
  prompts.forEach(p => {
    const meta = PROMPT_META[p.key]
    const g = meta?.group || 'outro'
    if (!groups[g]) groups[g] = []
    groups[g].push(p)
  })

  const groupOrder = ['video', 'decisao', 'growth', 'captions']

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="animate-fade">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-fuchsia-500 flex items-center justify-center shadow-lg shadow-accent/15">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-1 tracking-tight">Prompts da IA</h1>
            <p className="text-xs text-content-3 mt-0.5">Controle tudo que a IA faz — do texto narrado ate as hashtags</p>
          </div>
        </div>
      </div>

      {/* Quick guide */}
      <div className="grid grid-cols-4 gap-2 animate-in" style={{ animationDelay: '50ms' }}>
        {groupOrder.map(g => {
          const info = GROUP_INFO[g]
          if (!info) return null
          const count = groups[g]?.length || 0
          return (
            <div key={g} className="bg-surface-2 border border-stroke-1 rounded-xl p-3 text-center hover:border-stroke-2 transition-colors">
              <span className="text-xl block">{info.icon}</span>
              <p className="text-[11px] font-semibold text-content-1 mt-1">{info.label}</p>
              <p className="text-[9px] text-content-4 mt-0.5">{count} {count === 1 ? 'prompt' : 'prompts'}</p>
            </div>
          )
        })}
      </div>

      {/* Grouped prompts */}
      {prompts.length === 0 && <EmptyState icon={MessageSquare} title="Carregando prompts..." />}

      {groupOrder.map(g => {
        const info = GROUP_INFO[g]
        const items = groups[g]
        if (!info || !items?.length) return null

        return (
          <div key={g} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="text-base">{info.icon}</span>
              <div>
                <h2 className="text-xs font-bold text-content-1">{info.label}</h2>
                <p className="text-[9px] text-content-4">{info.desc}</p>
              </div>
            </div>

            <div className="space-y-2 stagger">
              {items.map(p => (
                <PromptCard key={p.id} prompt={p} meta={PROMPT_META[p.key]} onSave={handleSave} onTest={handleTest} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
