import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, X, ToggleLeft, ToggleRight, Eye, Film, ExternalLink, Shield, Check, Wifi, Loader2, RefreshCw } from 'lucide-react'
import { getAccounts, createAccount, updateAccount, deleteAccount, verifyAccount, syncAccount } from '../api/client'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Card, { CardHeader } from './ui/Card'
import { Input, Select, Toggle } from './ui/Input'
import EmptyState from './ui/EmptyState'

const PLATFORM_ICONS = {
  tiktok: '🎵',
  instagram: '📸',
  youtube: '▶️',
  twitter: '𝕏',
  telegram: '✈️',
}

const PLATFORM_COLORS = {
  tiktok: 'accent',
  instagram: 'danger',
  youtube: 'danger',
  twitter: 'info',
  telegram: 'info',
}

const TOPIC_OPTIONS = [
  { value: 'guerra', label: 'Guerra' },
  { value: 'futebol', label: 'Futebol' },
  { value: 'política', label: 'Politica' },
  { value: 'entretenimento', label: 'Entretenimento' },
  { value: 'trending', label: 'Trending' },
]

export default function AccountsView() {
  const [accounts, setAccounts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [verifying, setVerifying] = useState(null)
  const [syncing, setSyncing] = useState(null)
  const [verifyResults, setVerifyResults] = useState({})
  const [form, setForm] = useState({
    name: '', platform: 'tiktok', username: '', topics: [],
    auto_publish: false, max_posts_per_day: 5,
    api_key: '', access_token: '',
  })

  async function load() {
    try {
      const data = await getAccounts()
      setAccounts(data.accounts)
    } catch {}
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ name: '', platform: 'tiktok', username: '', topics: [], auto_publish: false, max_posts_per_day: 5, api_key: '', access_token: '' })
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    try {
      if (editingId) {
        await updateAccount(editingId, form)
      } else {
        await createAccount(form)
      }
      resetForm()
      load()
    } catch (e) { alert(e.message) }
  }

  async function handleDelete(id) {
    if (!confirm('Remover conta?')) return
    await deleteAccount(id)
    load()
  }

  async function handleToggle(acc) {
    await updateAccount(acc.id, { active: !acc.active })
    load()
  }

  function startEdit(acc) {
    setForm({
      name: acc.name, platform: acc.platform, username: acc.username,
      topics: acc.topics, auto_publish: acc.auto_publish,
      max_posts_per_day: acc.max_posts_per_day, api_key: '', access_token: '',
    })
    setEditingId(acc.id)
    setShowForm(true)
  }

  function toggleTopic(topic) {
    setForm(f => ({
      ...f,
      topics: f.topics.includes(topic)
        ? f.topics.filter(t => t !== topic)
        : [...f.topics, topic],
    }))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between animate-fade">
        <div>
          <h1 className="text-xl font-bold text-content-1 tracking-tight">Contas</h1>
          <p className="text-xs text-content-3 mt-1">Gerencie contas de publicacao — cada conta eh um canal em uma plataforma</p>
        </div>
        <Button icon={Plus} onClick={() => { resetForm(); setShowForm(true) }}>Nova conta</Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="animate-in-fast">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-content-1">{editingId ? 'Editar conta' : 'Nova conta'}</h3>
            <button onClick={resetForm} className="text-content-4 hover:text-content-2"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Input label="Nome do canal" placeholder="Guerra Agora" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
            <Select label="Plataforma" value={form.platform}
              onChange={e => setForm({ ...form, platform: e.target.value })}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram Reels</option>
              <option value="youtube">YouTube Shorts</option>
              <option value="twitter">Twitter/X</option>
              <option value="telegram">Telegram</option>
            </Select>
            <Input label="Username" placeholder="@guerraagora" value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })} />
            <Input label="Posts max/dia" type="number" value={form.max_posts_per_day}
              onChange={e => setForm({ ...form, max_posts_per_day: parseInt(e.target.value) || 5 })} />
          </div>

          {/* Topics */}
          <div className="mb-4">
            <p className="text-[11px] font-medium text-content-3 mb-2">Topicos desta conta</p>
            <div className="flex flex-wrap gap-1.5">
              {TOPIC_OPTIONS.map(({ value, label }) => (
                <button key={value} onClick={() => toggleTopic(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    form.topics.includes(value)
                      ? 'bg-accent-muted text-accent-light border-accent/30'
                      : 'bg-surface-3 text-content-4 border-stroke-2 hover:text-content-3'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ===== YOUTUBE ===== */}
          {form.platform === 'youtube' && (
            <div className="mb-4 space-y-3">
              <div className="p-4 bg-danger-muted/30 border border-danger/10 rounded-xl">
                <p className="text-xs font-semibold text-danger mb-3 flex items-center gap-1.5">▶️ Conectar YouTube</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-4 flex items-center justify-center text-[10px] font-bold text-content-2 flex-shrink-0 mt-0.5">1</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Acesse o Google Cloud Console</p>
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-[10px] text-accent-light hover:underline">console.cloud.google.com/apis/credentials ↗</a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-4 flex items-center justify-center text-[10px] font-bold text-content-2 flex-shrink-0 mt-0.5">2</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Ative a YouTube Data API v3</p>
                      <p className="text-[10px] text-content-4">Biblioteca → busque "YouTube Data API v3" → Ativar</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-4 flex items-center justify-center text-[10px] font-bold text-content-2 flex-shrink-0 mt-0.5">3</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Crie uma API Key</p>
                      <p className="text-[10px] text-content-4">Credenciais → Criar credenciais → Chave de API</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">4</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Cole a API Key abaixo</p>
                      <p className="text-[10px] text-content-4">Eh so esse campo — nao precisa de mais nada pra sincronizar</p>
                    </div>
                  </div>
                </div>
              </div>
              <Input label="API Key do YouTube" placeholder="AIzaSy... (começa com AIza)" value={form.api_key}
                onChange={e => setForm({ ...form, api_key: e.target.value })} />
              <p className="text-[9px] text-content-4">Essa key permite sincronizar dados do canal (inscritos, views, videos). Para upload automatico de videos, sera necessario OAuth2 (etapa futura).</p>
            </div>
          )}

          {/* ===== TELEGRAM ===== */}
          {form.platform === 'telegram' && (
            <div className="mb-4 space-y-3">
              <div className="p-4 bg-info-muted/30 border border-info/10 rounded-xl">
                <p className="text-xs font-semibold text-info mb-3 flex items-center gap-1.5">✈️ Conectar Telegram</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-4 flex items-center justify-center text-[10px] font-bold text-content-2 flex-shrink-0 mt-0.5">1</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Abra o Telegram e busque @BotFather</p>
                      <a href="https://t.me/BotFather" target="_blank" className="text-[10px] text-accent-light hover:underline">t.me/BotFather ↗</a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-4 flex items-center justify-center text-[10px] font-bold text-content-2 flex-shrink-0 mt-0.5">2</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Envie /newbot e siga as instrucoes</p>
                      <p className="text-[10px] text-content-4">Escolha nome e username pro bot</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-4 flex items-center justify-center text-[10px] font-bold text-content-2 flex-shrink-0 mt-0.5">3</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Copie o token que o BotFather gerar</p>
                      <p className="text-[10px] text-content-4">Formato: 123456789:ABCdef... </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">4</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Cole o token abaixo</p>
                    </div>
                  </div>
                </div>
              </div>
              <Input label="Bot Token" placeholder="123456789:ABCdefGHI..." value={form.access_token}
                onChange={e => setForm({ ...form, access_token: e.target.value })} />
              <Input label="Chat ID do canal/grupo" placeholder="@nomedocanal ou -100123456" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })} hint="Crie um canal, adicione o bot como admin, e coloque o @username do canal aqui" />
            </div>
          )}

          {/* ===== TIKTOK ===== */}
          {form.platform === 'tiktok' && (
            <div className="mb-4 space-y-3">
              <div className="p-4 bg-accent-muted/30 border border-accent/10 rounded-xl">
                <p className="text-xs font-semibold text-accent-light mb-3 flex items-center gap-1.5">🎵 Conectar TikTok</p>
                <div className="space-y-2 text-[10px] text-content-3">
                  <p>O TikTok requer aprovacao do app pra upload automatico.</p>
                  <p><strong>Por enquanto:</strong> gere os videos aqui e baixe pra postar manualmente no TikTok.</p>
                  <p><strong>Futuro:</strong> vamos integrar com a Content Posting API quando aprovado.</p>
                </div>
              </div>
              <Input label="Username do TikTok" placeholder="@seucanal" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })} hint="So pra referencia — upload automatico ainda nao disponivel" />
            </div>
          )}

          {/* ===== INSTAGRAM ===== */}
          {form.platform === 'instagram' && (
            <div className="mb-4 space-y-3">
              <div className="p-4 bg-danger-muted/30 border border-danger/10 rounded-xl">
                <p className="text-xs font-semibold text-danger mb-3 flex items-center gap-1.5">📸 Conectar Instagram</p>
                <div className="space-y-2 text-[10px] text-content-3">
                  <p>Instagram Reels requer uma <strong>conta Business</strong> + app no Facebook Developers.</p>
                  <p><strong>Por enquanto:</strong> gere os videos aqui e baixe pra postar manualmente.</p>
                  <p><strong>Futuro:</strong> vamos integrar com a Graph API.</p>
                </div>
              </div>
              <Input label="Username do Instagram" placeholder="@seucanal" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>
          )}

          {/* ===== TWITTER ===== */}
          {form.platform === 'twitter' && (
            <div className="mb-4 space-y-3">
              <div className="p-4 bg-info-muted/30 border border-info/10 rounded-xl">
                <p className="text-xs font-semibold text-info mb-3 flex items-center gap-1.5">𝕏 Conectar Twitter/X</p>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-4 flex items-center justify-center text-[10px] font-bold text-content-2 flex-shrink-0 mt-0.5">1</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Acesse developer.twitter.com</p>
                      <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" className="text-[10px] text-accent-light hover:underline">developer.twitter.com ↗</a>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-4 flex items-center justify-center text-[10px] font-bold text-content-2 flex-shrink-0 mt-0.5">2</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Crie app → gere Bearer Token</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">3</div>
                    <div>
                      <p className="text-[11px] text-content-1 font-medium">Cole o Bearer Token abaixo</p>
                    </div>
                  </div>
                </div>
              </div>
              <Input label="Bearer Token" placeholder="AAAA..." value={form.access_token}
                onChange={e => setForm({ ...form, access_token: e.target.value })} />
            </div>
          )}

          {/* Auto publish */}
          <div className="mb-4">
            <Toggle checked={form.auto_publish}
              onChange={() => setForm({ ...form, auto_publish: !form.auto_publish })}
              label="Publicar automaticamente nesta conta" />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave}>{editingId ? 'Salvar' : 'Criar conta'}</Button>
            <Button variant="secondary" onClick={resetForm}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Platform specs info */}
      <div className="grid grid-cols-5 gap-2 stagger">
        {['tiktok', 'instagram', 'youtube', 'twitter', 'telegram'].map(p => {
          const count = accounts.filter(a => a.platform === p).length
          return (
            <div key={p} className="bg-surface-2 border border-stroke-1 rounded-xl p-3 text-center">
              <span className="text-xl">{PLATFORM_ICONS[p]}</span>
              <p className="text-[11px] text-content-2 mt-1 font-medium capitalize">{p === 'twitter' ? 'X' : p}</p>
              <p className="text-lg font-bold text-content-1">{count}</p>
              <p className="text-[9px] text-content-4">{count === 1 ? 'conta' : 'contas'}</p>
            </div>
          )
        })}
      </div>

      {/* Accounts list */}
      <div className="space-y-2 stagger">
        {accounts.length === 0 && (
          <EmptyState icon={Users} title="Nenhuma conta configurada"
            description="Adicione contas pra publicar conteudo automaticamente" />
        )}

        {accounts.map(acc => (
          <div key={acc.id}
            className={`bg-surface-2 border border-stroke-1 rounded-xl p-4 hover:border-stroke-2 transition-all ${!acc.active ? 'opacity-40' : ''}`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center text-lg flex-shrink-0">
                {PLATFORM_ICONS[acc.platform]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-content-1">{acc.name}</span>
                  <Badge variant={PLATFORM_COLORS[acc.platform] || 'default'}>{acc.platform}</Badge>
                  {acc.auto_publish && <Badge variant="success" dot>Auto</Badge>}
                  {acc.has_credentials && <Badge variant="accent"><Shield className="w-2.5 h-2.5" /> Conectada</Badge>}
                </div>
                {acc.username && <p className="text-xs text-content-3">{acc.username}</p>}
                <div className="flex items-center gap-2 mt-2">
                  {acc.topics.map(t => <Badge key={t} variant="default">{t}</Badge>)}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-content-4">
                  <span className="flex items-center gap-1"><Film className="w-3 h-3" />{acc.total_posts} posts</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{acc.total_views.toLocaleString('pt-BR')} views</span>
                  <span>Max {acc.max_posts_per_day}/dia</span>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={async () => {
                  setVerifying(acc.id)
                  try {
                    const r = await verifyAccount(acc.id)
                    setVerifyResults(prev => ({ ...prev, [acc.id]: r }))
                  } catch (e) { setVerifyResults(prev => ({ ...prev, [acc.id]: { status: 'error', message: e.message } })) }
                  setVerifying(null)
                }}
                  className={`p-1.5 rounded-lg transition-colors ${verifying === acc.id ? 'text-accent-light' : 'text-content-4 hover:text-accent-light hover:bg-accent-muted'}`}
                  title="Verificar conexao">
                  {verifying === acc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                </button>
                <button onClick={async () => {
                  setSyncing(acc.id)
                  try {
                    const r = await syncAccount(acc.id)
                    if (r.status === 'synced') load()
                    else setVerifyResults(prev => ({ ...prev, [acc.id]: { status: r.status, message: r.error || r.message || 'Sync feito' } }))
                  } catch (e) { setVerifyResults(prev => ({ ...prev, [acc.id]: { status: 'error', message: e.message } })) }
                  setSyncing(null)
                }}
                  className={`p-1.5 rounded-lg transition-colors ${syncing === acc.id ? 'text-success' : 'text-content-4 hover:text-success hover:bg-success-muted'}`}
                  title="Sincronizar dados do canal">
                  {syncing === acc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
                <button onClick={() => startEdit(acc)} className="px-2 py-1.5 rounded-lg text-[11px] text-content-4 hover:text-content-2 hover:bg-surface-3 transition-colors">
                  Editar
                </button>
                <button onClick={() => handleToggle(acc)} className="p-1.5 rounded-lg hover:bg-surface-3 transition-colors">
                  {acc.active ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5 text-content-4" />}
                </button>
                <button onClick={() => handleDelete(acc.id)} className="p-1.5 rounded-lg text-content-4 hover:text-danger hover:bg-danger-muted transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {verifyResults[acc.id] && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-[10px] ${
                verifyResults[acc.id].status === 'connected' ? 'bg-success-muted text-success' :
                verifyResults[acc.id].status === 'manual' ? 'bg-warning-muted text-warning' :
                'bg-danger-muted text-danger'
              }`}>
                <p className="font-medium">{verifyResults[acc.id].message}</p>
                {verifyResults[acc.id].permissions?.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-content-3">
                    {verifyResults[acc.id].permissions.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
