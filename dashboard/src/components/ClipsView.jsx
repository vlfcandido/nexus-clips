import { useState, useEffect } from 'react'
import { Film, Upload, Trash2, ExternalLink, Eye, Clock, Play, X, Copy, Send, Maximize2, Loader2, Check, MessageCircle, RotateCcw, Wand2, Download, AlertTriangle, ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { publishClip, deleteClip, publishClipTo, getAccounts, getClipComments, addClipComment, cloneClip, preparePublish, uploadToYouTube } from '../api/client'
import Button from './ui/Button'
import Badge from './ui/Badge'
import EmptyState from './ui/EmptyState'
import { VideoThumbnail } from './ui/VideoPlayer'

const TOPIC_VARIANT = {
  guerra: 'danger', futebol: 'success', política: 'info', entretenimento: 'accent',
}
const CAT_EMOJI = {
  gol: '⚽', polêmica: '🔥', declaração: '🎙️', treta: '💥',
  breaking: '🚨', humor: '😂', análise: '📊',
}

function PublishTab({ clip, accounts, onPublished }) {
  const [step, setStep] = useState('select') // select, prepare, confirm, done
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const [prepData, setPrepData] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editTags, setEditTags] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState(null)

  const platformEmoji = { tiktok: '🎵', instagram: '📸', youtube: '▶️', twitter: '𝕏', telegram: '✈️' }

  async function handleSelectAccount(acc) {
    setSelectedAccount(acc)
    setPreparing(true)
    setStep('prepare')
    try {
      const data = await preparePublish(clip.id, acc.id)
      setPrepData(data)
      setEditTitle(data.suggestion?.title || clip.caption || '')
      setEditDesc(data.suggestion?.description || clip.moment_text || '')
      setEditTags((data.suggestion?.tags || []).join(', '))
      setStep('confirm')
    } catch (e) {
      setResult({ status: 'error', error: e.message })
      setStep('select')
    }
    setPreparing(false)
  }

  async function handleConfirmPublish() {
    if (!selectedAccount) return
    setPublishing(true)
    try {
      let r
      if (selectedAccount.platform === 'youtube' && prepData?.can_auto_publish) {
        // Upload real pro YouTube via OAuth
        r = await uploadToYouTube(clip.id, selectedAccount.id, editTitle, editDesc, editTags)
      } else {
        r = await publishClipTo(clip.id, selectedAccount.id)
      }
      setResult(r)
      setStep('done')
      if (r.status === 'published') onPublished()
    } catch (e) { setResult({ status: 'error', error: e.message }) }
    setPublishing(false)
  }

  // Step 1: Selecionar conta
  if (step === 'select') {
    return (
      <div className="space-y-3">
        <p className="text-[10px] text-content-4">Escolha onde publicar:</p>
        {accounts.filter(a => a.active).map(acc => (
          <button key={acc.id} onClick={() => handleSelectAccount(acc)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-3/30 hover:bg-surface-3 border border-stroke-1 hover:border-stroke-2 transition-all text-left">
            <span className="text-lg">{platformEmoji[acc.platform] || '📱'}</span>
            <div className="flex-1">
              <p className="text-xs font-medium text-content-1">{acc.name}</p>
              <p className="text-[10px] text-content-4">{acc.platform} · {acc.username}</p>
            </div>
            {acc.has_credentials ? <Badge variant="success" dot>Pronta</Badge> : <Badge variant="warning">Config</Badge>}
          </button>
        ))}
        {accounts.filter(a => a.active).length === 0 && (
          <p className="text-xs text-content-4 py-4 text-center">Nenhuma conta. Va em Contas pra conectar.</p>
        )}
      </div>
    )
  }

  // Step 2: Preparando
  if (step === 'prepare') {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-accent-light animate-spin mr-2" />
        <span className="text-xs text-content-3">Gerando sugestoes de titulo e tags...</span>
      </div>
    )
  }

  // Step 3: Confirmar (titulo, descricao, tags editaveis)
  if (step === 'confirm' && prepData) {
    return (
      <div className="space-y-3">
        <button onClick={() => { setStep('select'); setPrepData(null) }} className="flex items-center gap-1 text-[10px] text-content-4 hover:text-content-2">
          <ArrowLeft className="w-3 h-3" /> Voltar
        </button>

        <div className="flex items-center gap-2 p-2.5 bg-surface-3/30 rounded-xl">
          <span className="text-lg">{platformEmoji[prepData.platform]}</span>
          <div>
            <p className="text-xs font-semibold text-content-1">{prepData.account_name}</p>
            <p className="text-[9px] text-content-4">{prepData.platform}</p>
          </div>
          <Badge variant={prepData.can_auto_publish ? 'success' : 'warning'} className="ml-auto">
            {prepData.can_auto_publish ? 'Upload automatico' : 'Upload manual'}
          </Badge>
        </div>

        {/* Se nao pode auto-publicar */}
        {!prepData.can_auto_publish && prepData.setup_needed?.length > 0 && (
          <div className="p-3 bg-warning-muted border border-warning/20 rounded-xl">
            <p className="text-[11px] font-semibold text-warning mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Upload manual necessario
            </p>
            <ul className="text-[10px] text-content-3 space-y-1">
              {prepData.setup_needed.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5"><span className="text-warning">→</span> {s}</li>
              ))}
            </ul>
            {clip.clip_path && (
              <a href={clip.clip_path} download className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-accent-muted text-accent-light rounded-lg text-[10px] font-medium hover:bg-accent/20">
                <Download className="w-3 h-3" /> Baixar video pra postar manualmente
              </a>
            )}
          </div>
        )}

        {/* Titulo */}
        <div>
          <label className="text-[10px] font-semibold text-content-3 uppercase tracking-wider block mb-1">Titulo</label>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
            className="w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-xs text-content-1 outline-none focus:border-accent/50" />
        </div>

        {/* Descricao */}
        <div>
          <label className="text-[10px] font-semibold text-content-3 uppercase tracking-wider block mb-1">Descricao</label>
          <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
            className="w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-xs text-content-1 outline-none focus:border-accent/50 resize-y" />
        </div>

        {/* Tags */}
        <div>
          <label className="text-[10px] font-semibold text-content-3 uppercase tracking-wider block mb-1">Tags</label>
          <input value={editTags} onChange={e => setEditTags(e.target.value)}
            placeholder="#tag1, #tag2, #tag3"
            className="w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-xs text-content-1 placeholder-content-4 outline-none focus:border-accent/50" />
        </div>

        {/* Copiar tudo (pra upload manual) */}
        <div className="flex gap-2 pt-1">
          {prepData.can_auto_publish ? (
            <Button icon={publishing ? Loader2 : Send} onClick={handleConfirmPublish}
              className={publishing ? 'opacity-70 pointer-events-none' : ''}>
              {publishing ? 'Publicando...' : 'Confirmar e publicar'}
            </Button>
          ) : (
            <Button variant="secondary" icon={Copy} onClick={() => {
              navigator.clipboard.writeText(`${editTitle}\n\n${editDesc}\n\n${editTags}`)
              setResult({ status: 'copied' })
            }}>
              Copiar titulo + descricao + tags
            </Button>
          )}
        </div>

        {result?.status === 'copied' && (
          <p className="text-[10px] text-success">✅ Copiado! Cole no YouTube Studio ao fazer upload manual.</p>
        )}
      </div>
    )
  }

  // Step 4: Resultado
  if (step === 'done') {
    return (
      <div className="space-y-3 py-4">
        {result?.status === 'published' ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-success-muted flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-success" />
            </div>
            <p className="text-sm font-semibold text-success">Publicado com sucesso!</p>
            <p className="text-xs text-content-3 mt-1">O video foi enviado pra {prepData?.account_name}</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-danger-muted flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <p className="text-sm font-semibold text-danger">Falha na publicacao</p>
            <p className="text-xs text-content-3 mt-1">{result?.error}</p>
          </div>
        )}
        <div className="text-center">
          <Button size="sm" variant="secondary" onClick={() => { setStep('select'); setResult(null) }}>Tentar outra conta</Button>
        </div>
      </div>
    )
  }

  return null
}

function ClipDetailModal({ clip, onClose, onPublish, onRefresh }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [tab, setTab] = useState('info')
  const [accounts, setAccounts] = useState([])
  const [publishing, setPublishing] = useState(null)
  const [publishResult, setPublishResult] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [cloneText, setCloneText] = useState('')
  const [cloning, setCloning] = useState(false)
  const [cloneResult, setCloneResult] = useState(null)

  useEffect(() => {
    getAccounts().then(d => setAccounts(d.accounts)).catch(() => {})
    getClipComments(clip.id).then(d => setComments(d.comments)).catch(() => {})
  }, [clip.id])

  async function handlePublishTo(id) {
    setPublishing(id)
    setPublishResult(null)
    try {
      const r = await publishClipTo(clip.id, id)
      setPublishResult(r)
      if (r.status === 'published') onPublish(clip.id)
    } catch (e) { setPublishResult({ status: 'error', error: e.message }) }
    setPublishing(null)
  }

  async function handleComment() {
    if (!newComment.trim()) return
    await addClipComment(clip.id, { text: newComment, type: 'feedback' })
    setNewComment('')
    const d = await getClipComments(clip.id)
    setComments(d.comments)
  }

  async function handleClone() {
    if (!cloneText.trim()) return
    setCloning(true)
    setCloneResult(null)
    try {
      const r = await cloneClip(clip.id, cloneText)
      setCloneResult(r)
      if (r.status === 'ok' && onRefresh) onRefresh()
    } catch (e) { setCloneResult({ status: 'error', error: e.message }) }
    setCloning(false)
  }

  if (!clip) return null

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center animate-fade" onClick={() => setFullscreen(false)}>
        <video src={clip.clip_path} controls autoPlay className="max-h-screen max-w-screen" onClick={e => e.stopPropagation()} />
        <button onClick={() => setFullscreen(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20">
          <X className="w-5 h-5" />
        </button>
      </div>
    )
  }

  const TABS = [
    { id: 'info', label: 'Info', icon: Eye },
    { id: 'comments', label: `Feedback${comments.length ? ` (${comments.length})` : ''}`, icon: MessageCircle },
    { id: 'publish', label: 'Publicar', icon: Send },
    { id: 'clone', label: 'Refazer', icon: RotateCcw },
  ]

  const platformEmoji = { tiktok: '🎵', instagram: '📸', youtube: '▶️', twitter: '𝕏', telegram: '✈️' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div className="bg-surface-2 border border-stroke-1 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scale-in shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stroke-1">
          <div className="flex items-center gap-2">
            <span>{CAT_EMOJI[clip.category] || '📎'}</span>
            <Badge variant={TOPIC_VARIANT[clip.topic] || 'default'}>{clip.topic}</Badge>
            {clip.published && <Badge variant="success" dot>Publicado</Badge>}
            <span className="text-[10px] text-content-4">#{clip.id}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-surface-4 flex items-center justify-center text-content-4 hover:text-content-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex">
          {/* Video */}
          <div className="w-[340px] flex-shrink-0 bg-black flex items-center justify-center relative group">
            {clip.clip_path ? (
              <>
                <video src={clip.clip_path} controls autoPlay className="w-full max-h-[70vh] object-contain" />
                <button onClick={() => setFullscreen(true)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="w-full aspect-[9/16] flex items-center justify-center">
                <Play className="w-10 h-10 text-content-4" />
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="flex-1 flex flex-col max-h-[75vh]">
            {/* Tabs */}
            <div className="flex border-b border-stroke-1 px-2">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-accent text-accent-light'
                      : 'border-transparent text-content-4 hover:text-content-3'
                  }`}>
                  <t.icon className="w-3 h-3" />{t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* INFO TAB */}
              {tab === 'info' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-content-1">{clip.caption || clip.moment_text}</h3>
                  <p className="text-xs text-content-3 leading-relaxed">{clip.moment_text}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { l: 'Duracao', v: `${clip.duration_seconds}s` },
                      { l: 'Fonte', v: clip.source_type },
                      { l: 'Views', v: clip.views.toLocaleString('pt-BR') },
                      { l: 'Likes', v: clip.likes.toLocaleString('pt-BR') },
                    ].map(({ l, v }) => (
                      <div key={l} className="bg-surface-3/50 rounded-lg p-2.5">
                        <p className="text-[9px] text-content-4 uppercase tracking-wider">{l}</p>
                        <p className="text-xs font-mono text-content-1 mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>
                  {clip.hashtags && (
                    <div className="flex flex-wrap gap-1">
                      {clip.hashtags.split(' ').filter(Boolean).map((h, i) => <Badge key={i} variant="accent">{h}</Badge>)}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" icon={Copy} onClick={() => navigator.clipboard.writeText(clip.caption || clip.moment_text)}>Copiar</Button>
                    {clip.clip_path && <a href={clip.clip_path} download><Button size="sm" variant="secondary" icon={ExternalLink}>Baixar</Button></a>}
                  </div>
                </div>
              )}

              {/* COMMENTS TAB */}
              {tab === 'comments' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-content-4">Anote o que ficou bom e o que precisa melhorar nesse video.</p>

                  <div className="flex gap-2">
                    <input value={newComment} onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleComment()}
                      placeholder="Ex: voz ficou robotica, imagens nao tem relacao com o tema..."
                      className="flex-1 bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-xs text-content-1 placeholder-content-4 outline-none focus:border-accent/50" />
                    <Button size="sm" icon={Send} onClick={handleComment}>Enviar</Button>
                  </div>

                  {comments.length === 0 && (
                    <p className="text-xs text-content-4 py-6 text-center">Nenhum feedback ainda. Comente o que achou do video.</p>
                  )}

                  {comments.map(c => (
                    <div key={c.id} className="p-3 bg-surface-3/30 border border-stroke-1 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-content-2">{c.author}</span>
                        <span className="text-[9px] text-content-4">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-content-3">{c.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* PUBLISH TAB */}
              {tab === 'publish' && (
                <PublishTab clip={clip} accounts={accounts} onPublished={() => onPublish(clip.id)} />
              )}

              {/* CLONE/REFAZER TAB */}
              {tab === 'clone' && (
                <div className="space-y-4">
                  <div className="p-3 bg-accent-muted/30 border border-accent/10 rounded-xl">
                    <p className="text-[11px] text-accent-light mb-1 font-semibold flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5" /> Refazer com ajustes
                    </p>
                    <p className="text-[10px] text-content-3">
                      Descreva em linguagem natural o que quer mudar. A IA vai interpretar e gerar um novo video com os ajustes.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-content-3 uppercase tracking-wider block mb-1.5">O que quer mudar?</label>
                    <textarea value={cloneText} onChange={e => setCloneText(e.target.value)}
                      rows={3}
                      placeholder="Exemplos:&#10;• A voz ficou sem emocao, faz mais urgente&#10;• As imagens nao tem nada a ver, busca fotos de soldados&#10;• Muito longo, encurta pra 15 segundos&#10;• Muda o tom pra mais informal, tipo creator do TikTok"
                      className="w-full bg-surface-3 border border-stroke-2 rounded-xl px-3 py-2.5 text-xs text-content-1 placeholder-content-4 outline-none resize-y focus:border-accent/50" />
                  </div>

                  <Button icon={cloning ? Loader2 : RotateCcw} onClick={handleClone}
                    className={cloning ? 'opacity-70 pointer-events-none' : ''}>
                    {cloning ? 'Gerando novo video...' : 'Refazer video'}
                  </Button>

                  {cloning && (
                    <p className="text-[10px] text-content-4 animate-pulse">A IA esta interpretando seus ajustes e gerando um novo video (30-60s)...</p>
                  )}

                  {cloneResult && (
                    <div className={`p-3 rounded-xl text-xs ${cloneResult.status === 'ok' ? 'bg-success-muted text-success border border-success/20' : 'bg-danger-muted text-danger border border-danger/20'}`}>
                      {cloneResult.status === 'ok'
                        ? `✅ Novo video gerado! Clip #${cloneResult.new_clip_id} — verifique na lista de conteudos.`
                        : `❌ ${cloneResult.error}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClipsView() {
  const { state, dispatch, refresh } = useApp()
  const [filter, setFilter] = useState('all')
  const [selectedClip, setSelectedClip] = useState(null)

  const clips = state.clips.filter(c => {
    if (filter === 'published') return c.published
    if (filter === 'pending') return !c.published
    return true
  })

  async function handlePublish(id) {
    try { await publishClip(id); refresh(); setSelectedClip(null) } catch (e) { alert(e.message) }
  }
  async function handleDelete(id) {
    if (!confirm('Deletar?')) return
    try { await deleteClip(id); refresh() } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between animate-fade">
        <div>
          <h1 className="text-xl font-bold text-content-1 tracking-tight">Conteudos</h1>
          <p className="text-xs text-content-3 mt-1">{state.clipsTotal} conteudos gerados</p>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={Film} onClick={() => dispatch({ type: 'SET_PAGE', payload: 'studio' })}>Criar no Studio</Button>
          <div className="flex bg-surface-2 border border-stroke-1 rounded-xl p-[3px]">
            {['all', 'pending', 'published'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${filter === f ? 'bg-surface-4 text-content-1 shadow-sm' : 'text-content-4 hover:text-content-3'}`}>
                {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : 'Publicados'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {clips.length === 0 ? (
        <EmptyState icon={Film} title="Nenhum conteudo ainda" description="Use o Studio pra criar ou ative o pipeline pra gerar automaticamente." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
          {clips.map(clip => (
            <div key={clip.id} className="group bg-surface-2 border border-stroke-1 rounded-2xl overflow-hidden hover:border-stroke-2 transition-all cursor-pointer" onClick={() => setSelectedClip(clip)}>
              <VideoThumbnail src={clip.thumbnail_path} videoSrc={clip.clip_path} duration={`${Math.floor(clip.duration_seconds / 60)}:${String(clip.duration_seconds % 60).padStart(2, '0')}`} className="w-full h-36" />
              <div className="p-3.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs">{CAT_EMOJI[clip.category] || '📎'}</span>
                  <Badge variant={TOPIC_VARIANT[clip.topic] || 'default'}>{clip.topic}</Badge>
                  {clip.published && <Badge variant="success" dot>Pub</Badge>}
                </div>
                <p className="text-[13px] font-medium text-content-1 line-clamp-2 leading-snug mb-2">{clip.caption || clip.moment_text}</p>
                <div className="flex items-center justify-between text-content-4">
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{clip.duration_seconds}s</span>
                    {clip.views > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{clip.views.toLocaleString('pt-BR')}</span>}
                  </div>
                  <span className="text-[10px] font-mono">
                    {new Date(clip.created_at).toLocaleDateString('pt-BR')} {new Date(clip.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
              <div className="flex border-t border-stroke-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!clip.published && (
                  <button onClick={e => { e.stopPropagation(); handlePublish(clip.id) }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] text-accent-light hover:bg-accent-muted transition-colors">
                    <Upload className="w-3 h-3" /> Publicar
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); handleDelete(clip.id) }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] text-content-4 hover:text-danger hover:bg-danger-muted transition-colors">
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {state.clipsTotal > 20 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'SET_FILTERS', payload: { page: Math.max(1, state.filters.page - 1) } })}>Anterior</Button>
          <span className="px-3 py-1.5 text-xs text-content-4 font-mono">{state.filters.page}/{Math.ceil(state.clipsTotal / 20)}</span>
          <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'SET_FILTERS', payload: { page: state.filters.page + 1 } })}>Proximo</Button>
        </div>
      )}

      {selectedClip && <ClipDetailModal clip={selectedClip} onClose={() => setSelectedClip(null)} onPublish={handlePublish} onRefresh={refresh} />}
    </div>
  )
}
