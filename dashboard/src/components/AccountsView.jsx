import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, X, ToggleLeft, ToggleRight, Eye, Film, ExternalLink, Shield, Check } from 'lucide-react'
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../api/client'
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

          {/* Credenciais */}
          <details className="mb-4">
            <summary className="text-[11px] font-medium text-content-3 cursor-pointer hover:text-content-2 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Credenciais (API keys)
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input label="API Key" placeholder="Opcional" type="password" value={form.api_key}
                onChange={e => setForm({ ...form, api_key: e.target.value })} />
              <Input label="Access Token" placeholder="Opcional" type="password" value={form.access_token}
                onChange={e => setForm({ ...form, access_token: e.target.value })} />
            </div>
          </details>

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
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center text-lg flex-shrink-0">
                {PLATFORM_ICONS[acc.platform]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-content-1">{acc.name}</span>
                  <Badge variant={PLATFORM_COLORS[acc.platform] || 'default'}>{acc.platform}</Badge>
                  {acc.auto_publish && <Badge variant="success" dot>Auto</Badge>}
                  {acc.has_credentials && <Badge variant="accent"><Shield className="w-2.5 h-2.5" /> Conectada</Badge>}
                </div>

                {acc.username && <p className="text-xs text-content-3">{acc.username}</p>}

                <div className="flex items-center gap-2 mt-2">
                  {acc.topics.map(t => (
                    <Badge key={t} variant="default">{t}</Badge>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-2 text-[10px] text-content-4">
                  <span className="flex items-center gap-1"><Film className="w-3 h-3" />{acc.total_posts} posts</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{acc.total_views.toLocaleString('pt-BR')} views</span>
                  <span>Max {acc.max_posts_per_day}/dia</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => startEdit(acc)}
                  className="px-2 py-1.5 rounded-lg text-[11px] text-content-4 hover:text-content-2 hover:bg-surface-3 transition-colors">
                  Editar
                </button>
                <button onClick={() => handleToggle(acc)}
                  className="p-1.5 rounded-lg hover:bg-surface-3 transition-colors">
                  {acc.active
                    ? <ToggleRight className="w-5 h-5 text-success" />
                    : <ToggleLeft className="w-5 h-5 text-content-4" />}
                </button>
                <button onClick={() => handleDelete(acc.id)}
                  className="p-1.5 rounded-lg text-content-4 hover:text-danger hover:bg-danger-muted transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
