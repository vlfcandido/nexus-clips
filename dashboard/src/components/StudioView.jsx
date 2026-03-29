import { useState, useEffect } from 'react'
import {
  Sparkles, Loader2, Play, Image, Type, Clock, Palette,
  Volume2, Wand2, FileText, Globe, MessageCircle, Layout, Star,
  ChevronDown, ChevronUp, Eye,
} from 'lucide-react'
import { generateClip, getTemplates } from '../api/client'
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

const VISUAL_STYLES = [
  { id: 'news', label: 'News', icon: '📺',
    desc: 'Estilo jornalistico',
    preview: ['Barra de titulo no topo', 'Badge de categoria', 'Overlay escuro sobre imagens', 'Barra de progresso'] },
  { id: 'cinematic', label: 'Cinematico', icon: '🎬',
    desc: 'Imagens grandes',
    preview: ['Letterbox (barras pretas)', 'Texto so embaixo', 'Imagens em fullscreen', 'Minimo de overlays'] },
  { id: 'tiktok', label: 'TikTok', icon: '📱',
    desc: 'Texto central grande',
    preview: ['Titulo grande no centro', 'Legenda word-by-word', 'Pouco overlay', 'Foco na legenda'] },
  { id: 'minimal', label: 'Minimal', icon: '◻️',
    desc: 'Limpo e simples',
    preview: ['Titulo centrado', 'Sem badge', 'Sem barras', 'Fundo com imagens suaves'] },
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
  const selectedVisual = VISUAL_STYLES.find(v => v.id === brief.visual_style)
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

      {/* ===== TEMPLATE VISUAL ===== */}
      {templates.length > 0 && (
        <Section icon={Layout} title="Template Visual">
          <div className="grid grid-cols-4 gap-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => set('template_id', t.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  brief.template_id === t.id
                    ? 'border-accent/40 bg-accent-muted ring-1 ring-accent/20'
                    : 'border-stroke-1 bg-surface-3/20 hover:border-stroke-2'
                }`}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-bold text-content-1">{t.name}</span>
                  {t.is_default && <Star className="w-2.5 h-2.5 text-warning fill-warning" />}
                </div>
                <p className="text-[9px] text-content-4 leading-snug line-clamp-2">{t.description}</p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ===== VISUAL STYLE — com preview ===== */}
      <Section icon={Image} title="Estilo Visual">
        <div className="grid grid-cols-2 gap-2">
          {VISUAL_STYLES.map(v => (
            <button key={v.id} onClick={() => set('visual_style', v.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                brief.visual_style === v.id
                  ? 'border-accent/40 bg-accent-muted ring-1 ring-accent/20'
                  : 'border-stroke-1 bg-surface-3/20 hover:border-stroke-2'
              }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{v.icon}</span>
                <div>
                  <span className="text-xs font-bold text-content-1">{v.label}</span>
                  <span className="text-[9px] text-content-4 block">{v.desc}</span>
                </div>
              </div>
              <ul className="space-y-0.5">
                {v.preview.map((p, i) => (
                  <li key={i} className="text-[9px] text-content-3 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-accent-light/50" /> {p}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </Section>

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
