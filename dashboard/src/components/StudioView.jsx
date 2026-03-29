import { useState } from 'react'
import {
  Sparkles, Loader2, Play, Image, Type, Music, Clock, Palette,
  Volume2, AlignLeft, Hash, Zap, Eye, RotateCcw, ChevronDown, ChevronUp,
  Wand2, FileText, Globe, MessageCircle, Tv, BarChart3,
} from 'lucide-react'
import { generateClip } from '../api/client'
import { useApp } from '../context/AppContext'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Card, { CardHeader } from './ui/Card'

// ========== PRESETS ==========
const MOOD_PRESETS = [
  { id: 'urgente', label: 'Urgente', emoji: '🚨', desc: 'Breaking news, tensao, alarme', color: 'bg-danger-muted text-danger border-danger/20' },
  { id: 'impactante', label: 'Impactante', emoji: '💥', desc: 'Chocante, surpreendente', color: 'bg-warning-muted text-warning border-warning/20' },
  { id: 'informativo', label: 'Informativo', emoji: '📊', desc: 'Neutro, analitico, dados', color: 'bg-info-muted text-info border-info/20' },
  { id: 'empolgante', label: 'Empolgante', emoji: '🔥', desc: 'Energia, celebracao, hype', color: 'bg-success-muted text-success border-success/20' },
  { id: 'polemico', label: 'Polemico', emoji: '⚡', desc: 'Divisivo, gera debate', color: 'bg-accent-muted text-accent-light border-accent/20' },
  { id: 'emocional', label: 'Emocional', emoji: '😢', desc: 'Comovente, humano', color: 'bg-warning-muted text-warning border-warning/20' },
]

const VOICE_OPTIONS = [
  { value: 'pt-BR-AntonioNeural', label: 'Antonio', desc: 'Narrador masculino', icon: '🎙️' },
  { value: 'pt-BR-FranciscaNeural', label: 'Francisca', desc: 'Feminina natural', icon: '🎤' },
  { value: 'pt-BR-HumbertoNeural', label: 'Humberto', desc: 'Formal masculino', icon: '📻' },
  { value: 'pt-BR-ThalitaNeural', label: 'Thalita', desc: 'Jovem feminina', icon: '🎧' },
  { value: 'pt-BR-MacerioNeural', label: 'Macerio', desc: 'Jovem masculino', icon: '🔊' },
]

const VISUAL_STYLES = [
  { id: 'news', label: 'News', desc: 'Estilo jornalistico com barra de noticias', icon: <Tv className="w-4 h-4" /> },
  { id: 'cinematic', label: 'Cinematico', desc: 'Imagens grandes, texto minimo', icon: <Image className="w-4 h-4" /> },
  { id: 'tiktok', label: 'TikTok', desc: 'Texto grande central, cortes rapidos', icon: <Type className="w-4 h-4" /> },
  { id: 'minimal', label: 'Minimal', desc: 'Fundo limpo, foco na voz', icon: <AlignLeft className="w-4 h-4" /> },
]

const SUBTITLE_STYLES = [
  { id: 'word_by_word', label: 'Palavra por palavra', desc: 'Estilo TikTok viral' },
  { id: 'sentence', label: 'Frase completa', desc: 'Legenda tradicional' },
  { id: 'highlight', label: 'Destaque', desc: 'Palavras-chave em cor' },
  { id: 'none', label: 'Sem legenda', desc: 'So voz e imagem' },
]

const DURATION_OPTIONS = [
  { value: 15, label: '15s', desc: 'Ultra curto' },
  { value: 30, label: '30s', desc: 'Short ideal' },
  { value: 60, label: '60s', desc: 'Padrao' },
  { value: 90, label: '90s', desc: 'Detalhado' },
  { value: 120, label: '2min', desc: 'Longo' },
]

// ========== SECTION COMPONENT ==========
function Section({ icon: Icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-stroke-1 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-surface-2 hover:bg-surface-3/50 transition-colors text-left">
        <Icon className="w-4 h-4 text-accent-light" />
        <span className="text-xs font-semibold text-content-1 flex-1">{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-content-4" /> : <ChevronDown className="w-3.5 h-3.5 text-content-4" />}
      </button>
      {open && <div className="p-4 bg-surface-2/50">{children}</div>}
    </div>
  )
}

// ========== OPTION GRID ==========
function OptionGrid({ options, selected, onSelect, columns = 3 }) {
  return (
    <div className={`grid grid-cols-${columns} gap-2`}>
      {options.map(opt => (
        <button key={opt.id || opt.value}
          onClick={() => onSelect(opt.id || opt.value)}
          className={`p-3 rounded-xl border text-left transition-all ${
            selected === (opt.id || opt.value)
              ? 'border-accent/40 bg-accent-muted ring-1 ring-accent/20'
              : 'border-stroke-1 bg-surface-3/30 hover:border-stroke-2 hover:bg-surface-3'
          }`}>
          <div className="flex items-center gap-2 mb-1">
            {opt.emoji && <span className="text-base">{opt.emoji}</span>}
            {opt.icon && <span className="text-content-3">{opt.icon}</span>}
            <span className="text-xs font-semibold text-content-1">{opt.label}</span>
          </div>
          {opt.desc && <p className="text-[10px] text-content-4 leading-snug">{opt.desc}</p>}
        </button>
      ))}
    </div>
  )
}

// ========== MAIN STUDIO ==========
export default function StudioView() {
  const { dispatch, refresh } = useApp()
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [brief, setBrief] = useState({
    // Conteudo
    mode: 'topic',        // 'topic' = IA busca, 'custom' = Pedro escreve
    topic_query: '',      // Ex: "guerra no ira" — IA busca e cria
    custom_text: '',      // Texto livre que Pedro escreve
    source: '',

    // Sentimento
    mood: 'urgente',

    // Visual
    visual_style: 'news',
    subtitle_style: 'word_by_word',

    // Audio
    voice: 'pt-BR-AntonioNeural',
    music: true,

    // Formato
    duration: 30,
    platform: 'tiktok',

    // Instrucoes extras (prompt livre)
    extra_instructions: '',
  })

  function set(key, val) { setBrief(b => ({ ...b, [key]: val })) }

  async function handleGenerate() {
    const text = brief.mode === 'topic'
      ? `[TOPIC: ${brief.topic_query}] [MOOD: ${brief.mood}] [STYLE: ${brief.visual_style}] [SUBS: ${brief.subtitle_style}] [DURATION: ${brief.duration}s] [PLATFORM: ${brief.platform}] ${brief.extra_instructions}`
      : brief.custom_text

    if (!text.trim()) return

    setGenerating(true)
    setResult(null)
    try {
      const res = await generateClip({
        text,
        topic: brief.topic_query.includes('guerra') || brief.topic_query.includes('militar') ? 'guerra' :
               brief.topic_query.includes('futebol') || brief.topic_query.includes('gol') ? 'futebol' :
               brief.topic_query.includes('politic') || brief.topic_query.includes('lula') || brief.topic_query.includes('bolsonaro') ? 'política' :
               'entretenimento',
        voice: brief.voice,
        source: brief.source || 'Studio',
      })
      setResult(res)
      if (res.status === 'ok') refresh()
    } catch (e) {
      setResult({ status: 'error', reason: e.message })
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="animate-fade">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-fuchsia-500 flex items-center justify-center">
            <Wand2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-1 tracking-tight">Studio</h1>
            <p className="text-xs text-content-3">Crie conteudo personalizado — descreva o que quer e a IA faz o resto</p>
          </div>
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex bg-surface-2 border border-stroke-1 rounded-xl p-[3px] animate-in" style={{ animationDelay: '50ms' }}>
        <button onClick={() => set('mode', 'topic')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors ${brief.mode === 'topic' ? 'bg-surface-4 text-content-1 shadow-sm' : 'text-content-4 hover:text-content-3'}`}>
          <Globe className="w-3.5 h-3.5" /> IA busca e cria
        </button>
        <button onClick={() => set('mode', 'custom')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors ${brief.mode === 'custom' ? 'bg-surface-4 text-content-1 shadow-sm' : 'text-content-4 hover:text-content-3'}`}>
          <FileText className="w-3.5 h-3.5" /> Escrever texto
        </button>
      </div>

      {/* Content input */}
      <Card className="animate-in" style={{ animationDelay: '100ms' }}>
        {brief.mode === 'topic' ? (
          <div>
            <label className="block text-[11px] font-medium text-content-3 mb-2">Sobre o que quer criar?</label>
            <input
              value={brief.topic_query}
              onChange={e => set('topic_query', e.target.value)}
              placeholder="Ex: guerra no ira, gol do flamengo, fala polemica do bolsonaro, o que ta viralizando hoje..."
              className="w-full bg-surface-3 border border-stroke-2 rounded-xl px-4 py-3 text-sm text-content-1 placeholder-content-4 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
            />
            <p className="text-[10px] text-content-4 mt-2">A IA vai buscar noticias recentes sobre o tema e criar o video automaticamente.</p>
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-medium text-content-3 mb-2">Texto do conteudo</label>
            <textarea
              value={brief.custom_text}
              onChange={e => set('custom_text', e.target.value)}
              placeholder="Cole aqui a noticia, roteiro ou texto que quer transformar em video..."
              rows={5}
              className="w-full bg-surface-3 border border-stroke-2 rounded-xl px-4 py-3 text-sm text-content-1 placeholder-content-4 outline-none focus:border-accent/50 resize-y"
            />
          </div>
        )}
      </Card>

      {/* Mood */}
      <Section icon={Palette} title="Sentimento / Tom">
        <OptionGrid options={MOOD_PRESETS} selected={brief.mood} onSelect={v => set('mood', v)} columns={3} />
      </Section>

      {/* Voice */}
      <Section icon={Volume2} title="Voz">
        <div className="grid grid-cols-5 gap-2">
          {VOICE_OPTIONS.map(v => (
            <button key={v.value} onClick={() => set('voice', v.value)}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                brief.voice === v.value
                  ? 'border-accent/40 bg-accent-muted'
                  : 'border-stroke-1 bg-surface-3/30 hover:border-stroke-2'
              }`}>
              <span className="text-lg block mb-1">{v.icon}</span>
              <span className="text-[11px] font-semibold text-content-1 block">{v.label}</span>
              <span className="text-[9px] text-content-4">{v.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Visual + Subtitles */}
      <Section icon={Image} title="Visual e Legendas">
        <p className="text-[10px] text-content-4 uppercase tracking-wider mb-2">Estilo visual</p>
        <OptionGrid options={VISUAL_STYLES} selected={brief.visual_style} onSelect={v => set('visual_style', v)} columns={4} />
        <p className="text-[10px] text-content-4 uppercase tracking-wider mb-2 mt-4">Legendas</p>
        <OptionGrid options={SUBTITLE_STYLES} selected={brief.subtitle_style} onSelect={v => set('subtitle_style', v)} columns={4} />
      </Section>

      {/* Duration + Platform */}
      <Section icon={Clock} title="Formato">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-content-4 uppercase tracking-wider mb-2">Duracao</p>
            <div className="flex gap-1.5">
              {DURATION_OPTIONS.map(d => (
                <button key={d.value} onClick={() => set('duration', d.value)}
                  className={`flex-1 py-2 rounded-lg text-center border transition-all ${
                    brief.duration === d.value
                      ? 'border-accent/40 bg-accent-muted text-accent-light'
                      : 'border-stroke-1 bg-surface-3/30 text-content-4 hover:border-stroke-2'
                  }`}>
                  <span className="text-xs font-semibold block">{d.label}</span>
                  <span className="text-[8px]">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-content-4 uppercase tracking-wider mb-2">Plataforma principal</p>
            <div className="flex gap-1.5">
              {[
                { v: 'tiktok', l: 'TikTok', e: '🎵' },
                { v: 'instagram', l: 'Reels', e: '📸' },
                { v: 'youtube', l: 'Shorts', e: '▶️' },
                { v: 'twitter', l: 'X', e: '𝕏' },
              ].map(p => (
                <button key={p.v} onClick={() => set('platform', p.v)}
                  className={`flex-1 py-2 rounded-lg text-center border transition-all ${
                    brief.platform === p.v
                      ? 'border-accent/40 bg-accent-muted text-accent-light'
                      : 'border-stroke-1 bg-surface-3/30 text-content-4 hover:border-stroke-2'
                  }`}>
                  <span className="text-base block">{p.e}</span>
                  <span className="text-[9px] font-medium">{p.l}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Extra instructions */}
      <Section icon={MessageCircle} title="Instrucoes extras (opcional)" defaultOpen={false}>
        <textarea
          value={brief.extra_instructions}
          onChange={e => set('extra_instructions', e.target.value)}
          placeholder="Ex: coloca uma barra de noticias no bottom, titulo em caixa alta com fundo vermelho, usa imagens de soldados, faz a legenda aparecer palavra por palavra em amarelo..."
          rows={3}
          className="w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-xs text-content-1 placeholder-content-4 outline-none focus:border-accent/50 resize-y"
        />
        <p className="text-[9px] text-content-4 mt-1.5">Descreva em linguagem natural qualquer personalizacao que quiser. A IA vai interpretar.</p>
      </Section>

      {/* Generate button */}
      <div className="flex items-center gap-4 pt-2">
        <Button size="lg" icon={generating ? Loader2 : Sparkles} onClick={handleGenerate}
          className={`${generating ? 'opacity-70 pointer-events-none' : ''} shadow-lg shadow-accent/20`}>
          {generating ? 'Gerando...' : 'Gerar video'}
        </Button>

        {generating && (
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-content-3 mb-1">
              <Loader2 className="w-3 h-3 animate-spin text-accent-light" />
              Criando conteudo...
            </div>
            <div className="w-full bg-surface-3 rounded-full h-1.5">
              <div className="bg-accent rounded-full h-1.5 animate-pulse" style={{ width: '60%' }} />
            </div>
            <p className="text-[9px] text-content-4 mt-1">Gerando voz + buscando imagens + montando video (30-60s)</p>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <Card className={`animate-in-fast ${
          result.status === 'ok' ? 'border-success/30' :
          result.status === 'skipped' ? 'border-warning/30' :
          'border-danger/30'
        }`}>
          {result.status === 'ok' && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success-muted flex items-center justify-center">
                <Play className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-success">Video criado!</p>
                <p className="text-xs text-content-3">Clip #{result.clip_id} — {result.topic} / {result.category}</p>
              </div>
              <Button size="sm" onClick={() => dispatch({ type: 'SET_PAGE', payload: 'clips' })}>
                Ver conteudo
              </Button>
            </div>
          )}
          {result.status === 'skipped' && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning-muted flex items-center justify-center text-warning text-lg">⚠️</div>
              <div>
                <p className="text-sm font-semibold text-warning">Conteudo pulado</p>
                <p className="text-xs text-content-3">{result.reason}</p>
              </div>
            </div>
          )}
          {result.status === 'error' && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger-muted flex items-center justify-center text-danger text-lg">❌</div>
              <div>
                <p className="text-sm font-semibold text-danger">Erro</p>
                <p className="text-xs text-content-3">{result.reason}</p>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
