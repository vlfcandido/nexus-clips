import { useState, useEffect } from 'react'
import {
  Sparkles, Loader2, Play, Image, Type, Clock, Palette,
  Volume2, Wand2, FileText, Globe, MessageCircle, Layout, Star,
  ChevronDown, ChevronUp, Eye,
} from 'lucide-react'
import { generateClip, getTemplates, createTemplateFromNatural } from '../api/client'
import { useApp } from '../context/AppContext'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Card, { CardHeader } from './ui/Card'

// ========== PRESETS ==========

const MOODS = [
  { id: 'urgente', label: 'Urgente', emoji: '🚨', color: '#ef4444', bg: 'from-red-600/20 to-red-900/10', border: 'border-red-500/30',
    preview: 'Tom alarmante e tenso. Frases curtas. Ritmo rapido. "ATENCAO! Isso acabou de acontecer..."' },
  { id: 'impactante', label: 'Impactante', emoji: '💥', color: '#f59e0b', bg: 'from-amber-600/20 to-amber-900/10', border: 'border-amber-500/30',
    preview: 'Chocante e surpreendente. "Voce NAO vai acreditar no que..."' },
  { id: 'informativo', label: 'Informativo', emoji: '📊', color: '#3b82f6', bg: 'from-blue-600/20 to-blue-900/10', border: 'border-blue-500/30',
    preview: 'Neutro e analitico. Dados e fatos. "Segundo especialistas..."' },
  { id: 'empolgante', label: 'Empolgante', emoji: '🔥', color: '#22c55e', bg: 'from-green-600/20 to-green-900/10', border: 'border-green-500/30',
    preview: 'Energia alta! Celebracao! "GOOOL! Que jogada incrivel!"' },
  { id: 'polemico', label: 'Polemico', emoji: '⚡', color: '#8b5cf6', bg: 'from-violet-600/20 to-violet-900/10', border: 'border-violet-500/30',
    preview: 'Divisivo e provocador. "Concordam ou nao? Comenta ai!"' },
  { id: 'emocional', label: 'Emocional', emoji: '😢', color: '#ec4899', bg: 'from-pink-600/20 to-pink-900/10', border: 'border-pink-500/30',
    preview: 'Comovente e humano. "Uma historia que vai tocar seu coracao..."' },
]

const VOICES = [
  { value: 'pt-BR-AntonioNeural', label: 'Antonio', desc: 'Narrador masculino', emoji: '🎙️',
    tone: 'Voz grave, firme, profissional. Ideal pra noticias serias.',
    sample: 'Como se fosse o apresentador do Jornal Nacional.',
    audioSrc: '/media/samples/voice_antonio.mp3' },
  { value: 'pt-BR-FranciscaNeural', label: 'Francisca', desc: 'Feminina natural', emoji: '🎤',
    tone: 'Voz suave, clara, confiante. Boa pra conteudo informativo.',
    sample: 'Como uma reporter de campo experiente.',
    audioSrc: '/media/samples/voice_francisca.mp3' },
  { value: 'pt-BR-ThalitaNeural', label: 'Thalita', desc: 'Jovem feminina', emoji: '🎧',
    tone: 'Voz jovem, energetica. Perfeita pra TikTok e conteudo leve.',
    sample: 'Como uma creator de redes sociais.',
    audioSrc: '/media/samples/voice_thalita.mp3' },
]


const SUBTITLE_STYLES = [
  { id: 'word_by_word', label: 'Palavra por palavra', icon: '💬',
    desc: 'Estilo TikTok viral',
    preview: 'Cada palavra aparece sincronizada com a voz. MAXIMO impacto visual. A mais usada por creators.' },
  { id: 'sentence', label: 'Frase completa', icon: '📝',
    desc: 'Legenda tradicional',
    preview: 'Frase inteira aparece de uma vez. Mais facil de ler. Menos dinamica.' },
  { id: 'highlight', label: 'Destaque', icon: '✨',
    desc: 'Palavras-chave em cor',
    preview: 'Palavras importantes ficam destacadas em cor diferente. Bom pra dados e numeros.' },
  { id: 'none', label: 'Sem legenda', icon: '🔇',
    desc: 'So voz e imagem',
    preview: 'Nenhuma legenda. Foco total nas imagens e na voz.' },
]

const DURATIONS = [
  { value: 15, label: '15s', desc: 'Ultra curto', bar: 'w-1/5' },
  { value: 30, label: '30s', desc: 'Short ideal', bar: 'w-2/5' },
  { value: 60, label: '60s', desc: 'Padrao', bar: 'w-3/5' },
  { value: 90, label: '90s', desc: 'Detalhado', bar: 'w-4/5' },
  { value: 120, label: '2min', desc: 'Longo', bar: 'w-full' },
]

// ========== SECTION ==========
function Section({ icon: Icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-surface-2 border border-stroke-1 rounded-2xl overflow-hidden transition-all">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-surface-3/30 transition-colors text-left">
        <Icon className="w-4 h-4 text-accent-light" />
        <span className="text-xs font-semibold text-content-1 flex-1">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-content-4" /> : <ChevronDown className="w-3.5 h-3.5 text-content-4" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ========== VIDEO PREVIEW — mockup visual do resultado ==========
function VideoPreview({ brief, selectedMood, selectedVoice, selectedVisual, selectedSub, template }) {
  const [adjustInput, setAdjustInput] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustResult, setAdjustResult] = useState(null)

  const moodColor = selectedMood?.color || '#6366f1'
  const topicText = brief.topic_query || brief.custom_text?.slice(0, 50) || 'Titulo da noticia aqui...'
  const isNews = brief.visual_style === 'news'
  const isCinematic = brief.visual_style === 'cinematic'
  const isMinimal = brief.visual_style === 'minimal'

  // Parse template elements
  let templateElements = []
  if (template?.layout_json) {
    try { templateElements = JSON.parse(template.layout_json)?.elements || [] } catch {}
  }

  const hasBadge = templateElements.some(e => e.type === 'badge')
  const hasProgressBar = templateElements.some(e => e.type === 'progress_bar')
  const hasLetterbox = templateElements.some(e => e.type === 'letterbox')
  const badgeEl = templateElements.find(e => e.type === 'badge')
  const progressEl = templateElements.find(e => e.type === 'progress_bar')

  async function handleAdjust() {
    if (!adjustInput.trim()) return
    setAdjusting(true)
    try {
      const r = await createTemplateFromNatural(adjustInput, template?.id || null)
      setAdjustResult(r)
      if (r.status === 'ok') setAdjustInput('')
    } catch (e) { setAdjustResult({ status: 'error', error: e.message }) }
    setAdjusting(false)
  }

  return (
    <div className="bg-surface-2 border border-stroke-1 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-accent-light" />
        <span className="text-xs font-semibold text-content-1">Preview do video</span>
        <Badge variant="accent">ao vivo</Badge>
      </div>

      <div className="flex gap-4">
        {/* Phone mockup */}
        <div className="w-[180px] flex-shrink-0">
          <div className="relative w-full aspect-[9/16] bg-surface-4 rounded-2xl overflow-hidden border-2 border-stroke-2 shadow-xl">
            {/* Background image placeholder */}
            <div className="absolute inset-0 bg-gradient-to-b from-surface-5/80 via-surface-4 to-surface-5/80">
              <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Crect%20width%3D%2260%22%20height%3D%2260%22%20fill%3D%22none%22/%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22%20fill%3D%22%23333%22/%3E%3C/svg%3E')]" />
            </div>

            {/* Letterbox */}
            {hasLetterbox && (
              <>
                <div className="absolute top-0 left-0 right-0 h-[8%] bg-black z-10" />
                <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-black z-10" />
              </>
            )}

            {/* Top accent bar */}
            {(isNews || hasBadge) && (
              <div className="absolute top-0 left-0 right-0 h-[2px] z-20" style={{ backgroundColor: moodColor }} />
            )}

            {/* Top overlay */}
            {!isMinimal && !isCinematic && (
              <div className="absolute top-0 left-0 right-0 h-[28%] bg-gradient-to-b from-black/70 to-transparent z-10" />
            )}

            {/* Badge */}
            {hasBadge && badgeEl && (
              <div className="absolute top-[4%] left-[5%] z-20 px-1.5 py-0.5 rounded text-[5px] font-bold tracking-wider"
                style={{ backgroundColor: badgeEl.color || moodColor, color: 'white' }}>
                {badgeEl.text || 'URGENTE'}
              </div>
            )}

            {/* Separator line under badge */}
            {hasBadge && (
              <div className="absolute top-[8%] left-[5%] w-[12%] h-[1px] z-20" style={{ backgroundColor: moodColor }} />
            )}

            {/* Title */}
            <div className={`absolute z-20 left-[5%] right-[5%] ${
              isCinematic ? 'bottom-[14%]' : isMinimal ? 'top-[45%]' : 'top-[10%]'
            }`}>
              <div className="h-[5px] bg-white/90 rounded-full w-[80%] mb-1" />
              <div className="h-[5px] bg-white/60 rounded-full w-[55%]" />
            </div>

            {/* Summary (news style) */}
            {isNews && (
              <div className="absolute z-20 left-[5%] right-[5%] top-[42%]">
                <div className="bg-black/50 rounded-lg p-2">
                  <div className="h-[3px] bg-white/40 rounded-full w-full mb-1" />
                  <div className="h-[3px] bg-white/30 rounded-full w-[85%] mb-1" />
                  <div className="h-[3px] bg-white/25 rounded-full w-[65%]" />
                </div>
              </div>
            )}

            {/* Subtitle preview */}
            {brief.subtitle_style !== 'none' && (
              <div className="absolute z-20 left-[10%] right-[10%] bottom-[18%] text-center">
                {brief.subtitle_style === 'word_by_word' && (
                  <div className="flex justify-center gap-0.5">
                    <span className="bg-white/90 text-black text-[5px] font-bold px-1 py-0.5 rounded">GUERRA</span>
                    <span className="bg-white/40 text-white text-[5px] px-1 py-0.5 rounded">NO</span>
                    <span className="bg-white/40 text-white text-[5px] px-1 py-0.5 rounded">ORIENTE</span>
                  </div>
                )}
                {brief.subtitle_style === 'sentence' && (
                  <div className="bg-black/60 rounded px-2 py-1">
                    <div className="h-[3px] bg-white/70 rounded-full w-[90%] mx-auto" />
                  </div>
                )}
                {brief.subtitle_style === 'highlight' && (
                  <div className="flex justify-center gap-0.5">
                    <span className="text-white text-[5px] px-0.5">Fuzileiros</span>
                    <span className="text-[5px] px-0.5 font-bold" style={{ color: moodColor }}>3500</span>
                    <span className="text-white text-[5px] px-0.5">chegam</span>
                  </div>
                )}
              </div>
            )}

            {/* Bottom overlay */}
            {!isMinimal && (
              <div className="absolute bottom-0 left-0 right-0 h-[12%] bg-gradient-to-t from-black/80 to-transparent z-10" />
            )}

            {/* Source */}
            <div className="absolute bottom-[4%] left-[5%] z-20">
              <div className="h-[2px] bg-white/30 rounded-full w-[30%]" />
            </div>

            {/* Progress bar */}
            {hasProgressBar && (
              <div className="absolute bottom-0 left-0 right-0 h-[1.5px] z-30">
                <div className="h-full w-[65%] rounded-r-full" style={{ backgroundColor: progressEl?.color || moodColor }} />
              </div>
            )}

            {/* Phone notch */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[30%] h-1 bg-black rounded-full z-30" />
          </div>

          {/* Labels under preview */}
          <div className="mt-2 text-center">
            <p className="text-[9px] text-content-4">
              {brief.duration}s · {brief.platform} · {selectedVisual?.label}
            </p>
          </div>
        </div>

        {/* Controls ao lado */}
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-[10px] text-content-3 mb-1">O que voce esta vendo:</p>
            <ul className="text-[9px] text-content-4 space-y-1">
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: moodColor }} />
                Cor de acento: <strong className="text-content-2">{selectedMood?.label}</strong> ({moodColor})
              </li>
              {hasBadge && <li>✓ Badge "{badgeEl?.text}" no topo</li>}
              {hasProgressBar && <li>✓ Barra de progresso no bottom</li>}
              {hasLetterbox && <li>✓ Letterbox (barras pretas)</li>}
              <li>✓ Estilo: {selectedVisual?.label}</li>
              <li>✓ Legenda: {selectedSub?.label}</li>
              <li>✓ Voz: {selectedVoice?.label}</li>
            </ul>
          </div>

          {/* Ajuste por linguagem natural */}
          <div className="pt-2 border-t border-stroke-1">
            <p className="text-[10px] font-semibold text-content-3 mb-1.5 flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-accent-light" /> Ajustar layout
            </p>
            <div className="flex gap-1.5">
              <input value={adjustInput} onChange={e => setAdjustInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdjust()}
                placeholder="Ex: diminui o rodape, aumenta a opacidade do topo..."
                className="flex-1 bg-surface-3 border border-stroke-2 rounded-lg px-2.5 py-1.5 text-[10px] text-content-1 placeholder-content-4 outline-none focus:border-accent/50" />
              <button onClick={handleAdjust}
                className={`px-2.5 py-1.5 bg-accent-muted text-accent-light rounded-lg text-[10px] font-medium hover:bg-accent/20 transition-colors ${adjusting ? 'opacity-50' : ''}`}>
                {adjusting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ajustar'}
              </button>
            </div>
            {adjustResult?.status === 'ok' && (
              <p className="text-[9px] text-success mt-1">✅ Template ajustado! Recarregue a pagina pra ver.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== MAIN ==========
export default function StudioView() {
  const { dispatch, refresh } = useApp()
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [templates, setTemplates] = useState([])

  useEffect(() => { getTemplates().then(d => setTemplates(d.templates)).catch(() => {}) }, [])

  const [brief, setBrief] = useState({
    mode: 'topic', topic_query: '', custom_text: '', source: '',
    mood: 'urgente', visual_style: 'news', subtitle_style: 'word_by_word',
    voice: 'pt-BR-AntonioNeural', music: true, duration: 30,
    platform: 'tiktok', template_id: null, extra_instructions: '',
  })

  function set(k, v) { setBrief(b => ({ ...b, [k]: v })) }

  const selectedMood = MOODS.find(m => m.id === brief.mood)
  const selectedVoice = VOICES.find(v => v.value === brief.voice)
  const selectedTemplate = templates.find(t => t.id === brief.template_id)
  const selectedVisual = selectedTemplate ? { label: selectedTemplate.name, icon: { news: '📺', tiktok: '📱', cinematic: '🎬', minimal: '◻️', custom: '🎨' }[selectedTemplate.category] || '📎' } : { label: brief.visual_style, icon: '📎' }
  const selectedSub = SUBTITLE_STYLES.find(s => s.id === brief.subtitle_style)

  async function handleGenerate() {
    const text = brief.mode === 'topic'
      ? `[TOPIC: ${brief.topic_query}] [MOOD: ${brief.mood}] [STYLE: ${brief.visual_style}] [SUBS: ${brief.subtitle_style}] [DURATION: ${brief.duration}s] [PLATFORM: ${brief.platform}] ${brief.extra_instructions}`
      : brief.custom_text
    if (!text.trim()) return
    setGenerating(true); setResult(null)
    try {
      const r = await generateClip({
        text, voice: brief.voice, mood: brief.mood, source: brief.source || 'Studio',
        topic: brief.topic_query?.includes('guerra') ? 'guerra' : brief.topic_query?.includes('futebol') ? 'futebol' : 'política',
        visual_style: brief.visual_style, subtitle_style: brief.subtitle_style,
        duration: brief.duration, platform: brief.platform, extra_instructions: brief.extra_instructions,
      })
      setResult(r)
      if (r.status === 'ok') refresh()
    } catch (e) { setResult({ status: 'error', reason: e.message }) }
    setGenerating(false)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="animate-fade">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent via-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-accent/15 animate-float">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-1 tracking-tight">Studio</h1>
            <p className="text-xs text-content-3">Crie conteudo personalizado — cada opcao tem preview do resultado</p>
          </div>
        </div>
      </div>

      {/* Mode */}
      <div className="flex bg-surface-2 border border-stroke-1 rounded-xl p-[3px]">
        <button onClick={() => set('mode', 'topic')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors ${brief.mode === 'topic' ? 'bg-surface-4 text-content-1 shadow-sm' : 'text-content-4'}`}>
          <Globe className="w-3.5 h-3.5" /> IA busca e cria
        </button>
        <button onClick={() => set('mode', 'custom')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors ${brief.mode === 'custom' ? 'bg-surface-4 text-content-1 shadow-sm' : 'text-content-4'}`}>
          <FileText className="w-3.5 h-3.5" /> Escrever texto
        </button>
      </div>

      {/* Content */}
      <Card>
        {brief.mode === 'topic' ? (
          <div>
            <label className="block text-[11px] font-medium text-content-3 mb-2">Sobre o que quer criar?</label>
            <input value={brief.topic_query} onChange={e => set('topic_query', e.target.value)}
              placeholder="Ex: guerra no ira, gol do flamengo, fala polemica do bolsonaro..."
              className="w-full bg-surface-3 border border-stroke-2 rounded-xl px-4 py-3 text-sm text-content-1 placeholder-content-4 outline-none focus:border-accent/50" />
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-medium text-content-3 mb-2">Texto do conteudo</label>
            <textarea value={brief.custom_text} onChange={e => set('custom_text', e.target.value)}
              placeholder="Cole a noticia ou roteiro aqui..." rows={4}
              className="w-full bg-surface-3 border border-stroke-2 rounded-xl px-4 py-3 text-sm text-content-1 placeholder-content-4 outline-none focus:border-accent/50 resize-y" />
          </div>
        )}
      </Card>

      {/* ===== MOOD — com preview ===== */}
      <Section icon={Palette} title="Sentimento / Tom">
        <div className="grid grid-cols-3 gap-2">
          {MOODS.map(m => (
            <button key={m.id} onClick={() => set('mood', m.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                brief.mood === m.id
                  ? `bg-gradient-to-br ${m.bg} ${m.border} ring-1 ring-current/10`
                  : 'border-stroke-1 bg-surface-3/20 hover:border-stroke-2'
              }`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{m.emoji}</span>
                <span className="text-xs font-bold text-content-1">{m.label}</span>
              </div>
              <p className="text-[9px] text-content-3 leading-snug italic">"{m.preview}"</p>
            </button>
          ))}
        </div>
        {/* Preview do mood selecionado */}
        {selectedMood && (
          <div className="mt-3 p-3 rounded-xl border border-stroke-1 bg-surface-3/30">
            <p className="text-[9px] text-content-4 uppercase tracking-wider mb-1">Preview da narracao</p>
            <p className="text-xs text-content-2 italic" style={{ color: selectedMood.color }}>
              {selectedMood.preview}
            </p>
          </div>
        )}
      </Section>

      {/* ===== VOZ — com preview ===== */}
      <Section icon={Volume2} title="Voz">
        <div className="grid grid-cols-3 gap-2">
          {VOICES.map(v => (
            <button key={v.value} onClick={() => set('voice', v.value)}
              className={`p-3 rounded-xl border text-left transition-all ${
                brief.voice === v.value
                  ? 'border-accent/40 bg-accent-muted ring-1 ring-accent/20'
                  : 'border-stroke-1 bg-surface-3/20 hover:border-stroke-2'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{v.emoji}</span>
                <div>
                  <span className="text-xs font-bold text-content-1 block">{v.label}</span>
                  <span className="text-[9px] text-content-4">{v.desc}</span>
                </div>
              </div>
              <p className="text-[9px] text-content-3 mt-1.5 leading-snug">{v.tone}</p>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={(e) => { e.stopPropagation(); new Audio(v.audioSrc).play() }}
                  className="flex items-center gap-1 px-2 py-1 bg-surface-4 hover:bg-surface-5 rounded-md text-[9px] text-accent-light transition-colors">
                  <Play className="w-2.5 h-2.5" /> Ouvir
                </button>
                <span className="text-[8px] text-content-4 italic">{v.sample}</span>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* ===== LAYOUT VISUAL (unificado: templates do DB) ===== */}
      {templates.length > 0 && (
        <Section icon={Layout} title="Layout do Video">
          <p className="text-[9px] text-content-4 mb-2">Escolha o layout visual. Edite ou crie novos em Templates.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {templates.filter(t => t.active).map(t => {
              const isSelected = brief.template_id === t.id
              const categoryIcon = { news: '📺', tiktok: '📱', cinematic: '🎬', minimal: '◻️', custom: '🎨' }
              return (
                <button key={t.id} onClick={() => { set('template_id', t.id); set('visual_style', t.category) }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-accent/40 bg-accent-muted ring-1 ring-accent/20'
                      : 'border-stroke-1 bg-surface-3/20 hover:border-stroke-2'
                  }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{categoryIcon[t.category] || '📎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-content-1 truncate">{t.name}</span>
                        {t.is_default && <Star className="w-2.5 h-2.5 text-warning fill-warning flex-shrink-0" />}
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-content-4 leading-snug line-clamp-2">{t.description}</p>
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {/* ===== LEGENDAS — com preview ===== */}
      <Section icon={Type} title="Legendas">
        <div className="grid grid-cols-2 gap-2">
          {SUBTITLE_STYLES.map(s => (
            <button key={s.id} onClick={() => set('subtitle_style', s.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                brief.subtitle_style === s.id
                  ? 'border-accent/40 bg-accent-muted ring-1 ring-accent/20'
                  : 'border-stroke-1 bg-surface-3/20 hover:border-stroke-2'
              }`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{s.icon}</span>
                <div>
                  <span className="text-xs font-bold text-content-1">{s.label}</span>
                  <span className="text-[9px] text-content-4 block">{s.desc}</span>
                </div>
              </div>
              <p className="text-[9px] text-content-3 leading-snug">{s.preview}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* ===== DURACAO + PLATAFORMA ===== */}
      <Section icon={Clock} title="Formato">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-content-4 uppercase tracking-wider mb-2">Duracao</p>
            <div className="space-y-1">
              {DURATIONS.map(d => (
                <button key={d.value} onClick={() => set('duration', d.value)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all ${
                    brief.duration === d.value
                      ? 'border-accent/30 bg-accent-muted'
                      : 'border-transparent hover:bg-surface-3/50'
                  }`}>
                  <span className={`text-xs font-bold ${brief.duration === d.value ? 'text-accent-light' : 'text-content-3'}`}>{d.label}</span>
                  <div className="flex-1 h-1.5 bg-surface-4 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${brief.duration === d.value ? 'bg-accent' : 'bg-content-4/30'} ${d.bar}`} />
                  </div>
                  <span className="text-[9px] text-content-4 w-16 text-right">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-content-4 uppercase tracking-wider mb-2">Plataforma</p>
            <div className="space-y-1">
              {[
                { v: 'tiktok', l: 'TikTok', e: '🎵', specs: '9:16 · max 3min' },
                { v: 'instagram', l: 'Reels', e: '📸', specs: '9:16 · max 90s' },
                { v: 'youtube', l: 'Shorts', e: '▶️', specs: '9:16 · max 60s' },
                { v: 'twitter', l: 'X', e: '𝕏', specs: '9:16 · max 2:20' },
              ].map(p => (
                <button key={p.v} onClick={() => set('platform', p.v)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all ${
                    brief.platform === p.v
                      ? 'border-accent/30 bg-accent-muted'
                      : 'border-transparent hover:bg-surface-3/50'
                  }`}>
                  <span className="text-base">{p.e}</span>
                  <span className={`text-xs font-medium flex-1 ${brief.platform === p.v ? 'text-accent-light' : 'text-content-3'}`}>{p.l}</span>
                  <span className="text-[9px] text-content-4 font-mono">{p.specs}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ===== INSTRUCOES EXTRAS ===== */}
      <Section icon={MessageCircle} title="Instrucoes extras (opcional)" defaultOpen={false}>
        <textarea value={brief.extra_instructions} onChange={e => set('extra_instructions', e.target.value)}
          rows={3}
          placeholder="Ex: foca em imagens de soldados, usa tom mais serio, coloca barra de noticias no bottom..."
          className="w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-xs text-content-1 placeholder-content-4 outline-none focus:border-accent/50 resize-y" />
      </Section>

      {/* ===== PREVIEW VISUAL DO VIDEO ===== */}
      <VideoPreview
        brief={brief}
        selectedMood={selectedMood}
        selectedVoice={selectedVoice}
        selectedVisual={selectedVisual}
        selectedSub={selectedSub}
        template={templates.find(t => t.id === brief.template_id)}
      />

      {/* ===== RESUMO + GERAR ===== */}
      <Card glow>
        <CardHeader icon={Eye} title="Resumo da criacao" />
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            { l: 'Tom', v: selectedMood?.emoji + ' ' + (selectedMood?.label || '') },
            { l: 'Voz', v: selectedVoice?.emoji + ' ' + (selectedVoice?.label || '') },
            { l: 'Visual', v: selectedVisual?.icon + ' ' + (selectedVisual?.label || '') },
            { l: 'Legenda', v: selectedSub?.icon + ' ' + (selectedSub?.label || '') },
            { l: 'Formato', v: `${brief.duration}s · ${brief.platform}` },
          ].map(({ l, v }) => (
            <div key={l} className="bg-surface-3/50 rounded-lg p-2 text-center">
              <p className="text-[8px] text-content-4 uppercase tracking-wider">{l}</p>
              <p className="text-[10px] text-content-1 font-medium mt-0.5">{v}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Button size="lg" icon={generating ? Loader2 : Sparkles} onClick={handleGenerate}
            className={`shadow-lg shadow-accent/20 ${generating ? 'opacity-70 pointer-events-none' : ''}`}>
            {generating ? 'Gerando video...' : 'Gerar video'}
          </Button>
          {generating && (
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs text-content-3 mb-1">
                <Loader2 className="w-3 h-3 animate-spin text-accent-light" /> Criando...
              </div>
              <div className="w-full bg-surface-3 rounded-full h-1.5">
                <div className="bg-accent rounded-full h-1.5 animate-pulse" style={{ width: '60%' }} />
              </div>
              <p className="text-[9px] text-content-4 mt-1">Voz + imagens + montagem (30-60s)</p>
            </div>
          )}
        </div>
      </Card>

      {/* Result */}
      {result && (
        <Card className={`animate-in-fast ${result.status === 'ok' ? 'border-success/30' : result.status === 'skipped' ? 'border-warning/30' : 'border-danger/30'}`}>
          {result.status === 'ok' && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success-muted flex items-center justify-center"><Play className="w-5 h-5 text-success" /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-success">Video criado!</p>
                <p className="text-xs text-content-3">Clip #{result.clip_id} — {result.topic} / {result.category}</p>
              </div>
              <Button size="sm" onClick={() => dispatch({ type: 'SET_PAGE', payload: 'clips' })}>Ver video</Button>
            </div>
          )}
          {result.status === 'skipped' && (
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div><p className="text-sm font-semibold text-warning">Pulado</p><p className="text-xs text-content-3">{result.reason}</p></div>
            </div>
          )}
          {result.status === 'error' && (
            <div className="flex items-center gap-3">
              <span className="text-xl">❌</span>
              <div><p className="text-sm font-semibold text-danger">Erro</p><p className="text-xs text-content-3">{result.reason}</p></div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
