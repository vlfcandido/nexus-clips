import { useState } from 'react'
import { Film, Upload, Trash2, ExternalLink, Eye, Clock, Play, X, Copy, Send, Maximize2, Plus, Loader2, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { publishClip, deleteClip, generateClip } from '../api/client'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Card, { CardHeader } from './ui/Card'
import { Input, Select } from './ui/Input'
import EmptyState from './ui/EmptyState'
import VideoPlayer, { VideoThumbnail } from './ui/VideoPlayer'

const TOPIC_VARIANT = {
  guerra: 'danger',
  futebol: 'success',
  política: 'info',
  entretenimento: 'accent',
}

const CAT_EMOJI = {
  gol: '⚽', polêmica: '🔥', declaração: '🎙️', treta: '💥',
  breaking: '🚨', humor: '😂', análise: '📊',
}

function ClipDetailModal({ clip, onClose, onPublish }) {
  const [fullscreen, setFullscreen] = useState(false)

  if (!clip) return null

  // Fullscreen video mode
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center animate-fade" onClick={() => setFullscreen(false)}>
        <video
          src={clip.clip_path}
          controls
          autoPlay
          className="max-h-screen max-w-screen"
          onClick={e => e.stopPropagation()}
        />
        <button onClick={() => setFullscreen(false)}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20">
          <X className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div className="bg-surface-2 border border-stroke-1 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scale-in shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stroke-1">
          <div className="flex items-center gap-2">
            <span>{CAT_EMOJI[clip.category] || '📎'}</span>
            <Badge variant={TOPIC_VARIANT[clip.topic] || 'default'}>{clip.topic}</Badge>
            <Badge>{clip.category}</Badge>
            {clip.published && <Badge variant="success" dot>Publicado</Badge>}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-surface-4 flex items-center justify-center text-content-4 hover:text-content-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex">
          {/* Video — grande */}
          <div className="w-[360px] flex-shrink-0 bg-black flex items-center justify-center relative group">
            {clip.clip_path ? (
              <>
                <video
                  src={clip.clip_path}
                  controls
                  autoPlay
                  className="w-full max-h-[70vh] object-contain"
                />
                {/* Fullscreen button */}
                <button
                  onClick={() => setFullscreen(true)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Tela cheia"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="w-full aspect-[9/16] flex items-center justify-center">
                <Play className="w-10 h-10 text-content-4" />
              </div>
            )}
          </div>

          {/* Detail side */}
          <div className="flex-1 p-5 overflow-y-auto max-h-[70vh]">
            <h3 className="text-sm font-semibold text-content-1 mb-1">{clip.caption || clip.moment_text}</h3>
            <p className="text-xs text-content-3 mb-4 leading-relaxed">{clip.moment_text}</p>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                { l: 'Duracao', v: `${clip.duration_seconds}s` },
                { l: 'Fonte', v: clip.source_type },
                { l: 'Views', v: clip.views.toLocaleString('pt-BR') },
                { l: 'Likes', v: clip.likes.toLocaleString('pt-BR') },
              ].map(({ l, v }) => (
                <div key={l} className="bg-surface-3 rounded-lg p-2.5">
                  <p className="text-[9px] text-content-4 uppercase tracking-wider">{l}</p>
                  <p className="text-xs font-mono text-content-1 mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            {/* Hashtags */}
            {clip.hashtags && (
              <div className="mb-4">
                <p className="text-[9px] text-content-4 uppercase tracking-wider mb-1.5">Hashtags</p>
                <div className="flex flex-wrap gap-1">
                  {clip.hashtags.split(' ').filter(Boolean).map((h, i) => (
                    <Badge key={i} variant="accent">{h}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {clip.published && (clip.tiktok_url || clip.instagram_url || clip.twitter_url || clip.youtube_url) && (
              <div className="mb-4">
                <p className="text-[9px] text-content-4 uppercase tracking-wider mb-1.5">Publicado em</p>
                <div className="space-y-1">
                  {[
                    { url: clip.tiktok_url, label: 'TikTok' },
                    { url: clip.instagram_url, label: 'Instagram' },
                    { url: clip.youtube_url, label: 'YouTube' },
                    { url: clip.twitter_url, label: 'Twitter/X' },
                  ].filter(x => x.url).map(({ url, label }) => (
                    <a key={label} href={url} target="_blank" className="flex items-center gap-2 text-xs text-accent-light hover:underline">
                      <ExternalLink className="w-3 h-3" />{label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-stroke-1">
              {!clip.published && (
                <Button icon={Send} onClick={() => onPublish(clip.id)}>Publicar</Button>
              )}
              <Button variant="secondary" icon={Copy} onClick={() => navigator.clipboard.writeText(clip.caption || clip.moment_text)}>
                Copiar texto
              </Button>
              {clip.source_url && (
                <a href={clip.source_url} target="_blank">
                  <Button variant="ghost" icon={ExternalLink}>Fonte</Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateClipForm({ onCreated }) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [form, setForm] = useState({
    text: '',
    topic: 'guerra',
    voice: 'pt-BR-AntonioNeural',
    source: '',
  })

  const VOICES = [
    { value: 'pt-BR-AntonioNeural', label: 'Antonio (narrador masculino)' },
    { value: 'pt-BR-FranciscaNeural', label: 'Francisca (feminina natural)' },
    { value: 'pt-BR-HumbertoNeural', label: 'Humberto (formal masculino)' },
    { value: 'pt-BR-ThalitaNeural', label: 'Thalita (jovem feminina)' },
    { value: 'pt-BR-MacerioNeural', label: 'Macerio (jovem masculino)' },
  ]

  async function handleGenerate() {
    if (!form.text.trim()) return
    setGenerating(true)
    setResult(null)
    try {
      const res = await generateClip(form)
      setResult(res)
      if (res.status === 'ok') {
        setTimeout(() => { onCreated(); setOpen(false); setResult(null); setForm({ ...form, text: '', source: '' }) }, 2000)
      }
    } catch (e) {
      setResult({ status: 'error', reason: e.message })
    }
    setGenerating(false)
  }

  if (!open) {
    return (
      <Button icon={Plus} onClick={() => setOpen(true)}>Criar conteudo</Button>
    )
  }

  return (
    <Card className="animate-in-fast">
      <div className="flex items-center justify-between mb-4">
        <CardHeader title="Criar conteudo manualmente" subtitle="gerador" />
        <button onClick={() => { setOpen(false); setResult(null) }} className="text-content-4 hover:text-content-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-content-3 mb-1.5">Texto / Noticia</label>
          <textarea
            value={form.text}
            onChange={e => setForm({ ...form, text: e.target.value })}
            placeholder="Cole aqui a noticia, texto ou ideia que quer transformar em video..."
            rows={4}
            className="w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-sm text-content-1 placeholder-content-4 outline-none focus:border-accent/50 resize-y"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Select label="Topico" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}>
            <option value="guerra">Guerra</option>
            <option value="futebol">Futebol</option>
            <option value="política">Politica</option>
            <option value="entretenimento">Entretenimento</option>
          </Select>
          <Select label="Voz" value={form.voice} onChange={e => setForm({ ...form, voice: e.target.value })}>
            {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </Select>
          <Input label="Fonte (opcional)" placeholder="BBC, G1..." value={form.source}
            onChange={e => setForm({ ...form, source: e.target.value })} />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button icon={generating ? Loader2 : Sparkles} onClick={handleGenerate}
            className={generating ? 'opacity-70 pointer-events-none' : ''}>
            {generating ? 'Gerando video...' : 'Gerar video'}
          </Button>
          <Button variant="secondary" onClick={() => { setOpen(false); setResult(null) }}>Cancelar</Button>

          {generating && (
            <span className="text-[10px] text-content-4 animate-pulse">
              Gerando voz + buscando imagens + montando video... pode levar 30-60s
            </span>
          )}
        </div>

        {result && (
          <div className={`p-3 rounded-lg text-xs ${
            result.status === 'ok' ? 'bg-success-muted text-success' :
            result.status === 'skipped' ? 'bg-warning-muted text-warning' :
            'bg-danger-muted text-danger'
          }`}>
            {result.status === 'ok' && <p>Video gerado! Clip #{result.clip_id} — {result.topic} / {result.category}</p>}
            {result.status === 'skipped' && <p>Conteudo pulado: {result.reason}</p>}
            {result.status === 'error' && <p>Erro: {result.reason}</p>}
          </div>
        )}
      </div>
    </Card>
  )
}

export default function ClipsView() {
  const { state, dispatch, refresh } = useApp()
  const [filter, setFilter] = useState('all')
  const [selectedClip, setSelectedClip] = useState(null)

  const clips = state.clips.filter((c) => {
    if (filter === 'published') return c.published
    if (filter === 'pending') return !c.published
    return true
  })

  async function handlePublish(id) {
    try { await publishClip(id); refresh(); setSelectedClip(null) }
    catch (e) { alert(e.message) }
  }

  async function handleDelete(id) {
    if (!confirm('Deletar este conteudo?')) return
    try { await deleteClip(id); refresh() }
    catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between animate-fade">
        <div>
          <h1 className="text-xl font-bold text-content-1 tracking-tight">Conteudos</h1>
          <p className="text-xs text-content-3 mt-1">{state.clipsTotal} conteudos gerados pelo pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <CreateClipForm onCreated={refresh} />
          <div className="flex bg-surface-2 border border-stroke-1 rounded-xl p-[3px]">
            {['all', 'pending', 'published'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  filter === f ? 'bg-surface-4 text-content-1 shadow-sm' : 'text-content-4 hover:text-content-3'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Publicados'}
              </button>
          ))}
        </div>
      </div>

      {/* Grid of clips */}
      {clips.length === 0 ? (
        <EmptyState icon={Film} title="Nenhum conteudo ainda" description="O pipeline esta monitorando fontes e vai gerar conteudo automaticamente." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
          {clips.map(clip => (
            <div
              key={clip.id}
              className="group bg-surface-2 border border-stroke-1 rounded-2xl overflow-hidden hover:border-stroke-2 transition-all duration-150 cursor-pointer"
              onClick={() => setSelectedClip(clip)}
            >
              {/* Thumbnail */}
              <VideoThumbnail
                src={clip.thumbnail_path}
                duration={`${Math.floor(clip.duration_seconds / 60)}:${String(clip.duration_seconds % 60).padStart(2, '0')}`}
                className="w-full h-36"
              />

              {/* Info */}
              <div className="p-3.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs">{CAT_EMOJI[clip.category] || '📎'}</span>
                  <Badge variant={TOPIC_VARIANT[clip.topic] || 'default'}>{clip.topic}</Badge>
                  {clip.published && <Badge variant="success" dot>Pub</Badge>}
                </div>

                <p className="text-[13px] font-medium text-content-1 line-clamp-2 leading-snug mb-2">
                  {clip.caption || clip.moment_text}
                </p>

                <div className="flex items-center justify-between text-content-4">
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{clip.duration_seconds}s</span>
                    {clip.views > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{clip.views.toLocaleString('pt-BR')}</span>}
                  </div>
                  <span className="text-[10px]">{new Date(clip.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              {/* Quick actions on hover */}
              <div className="flex border-t border-stroke-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!clip.published && (
                  <button onClick={(e) => { e.stopPropagation(); handlePublish(clip.id) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] text-accent-light hover:bg-accent-muted transition-colors">
                    <Upload className="w-3 h-3" /> Publicar
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleDelete(clip.id) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] text-content-4 hover:text-danger hover:bg-danger-muted transition-colors">
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {state.clipsTotal > 20 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'SET_FILTERS', payload: { page: Math.max(1, state.filters.page - 1) } })}>
            Anterior
          </Button>
          <span className="px-3 py-1.5 text-xs text-content-4 font-mono">{state.filters.page}/{Math.ceil(state.clipsTotal / 20)}</span>
          <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'SET_FILTERS', payload: { page: state.filters.page + 1 } })}>
            Proximo
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedClip && (
        <ClipDetailModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          onPublish={handlePublish}
        />
      )}
    </div>
  )
}
