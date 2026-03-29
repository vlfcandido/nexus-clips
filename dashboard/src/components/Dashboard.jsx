import { useState, useEffect } from 'react'
import { Eye, Heart, Film, Upload, TrendingUp, Clock, Flame, Wand2, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { getAccounts } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import StatCard from './ui/StatCard'
import Card, { CardHeader } from './ui/Card'
import Badge from './ui/Badge'
import Button from './ui/Button'

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-4 border border-stroke-2 rounded-lg px-3 py-1.5 shadow-xl">
      <p className="text-[9px] text-content-4 font-mono">{label}</p>
      <p className="text-xs font-semibold text-content-1">{payload[0].value?.toLocaleString('pt-BR')}</p>
    </div>
  )
}

export default function Dashboard() {
  const { state, dispatch } = useApp()
  const a = state.analytics || {}
  const [accounts, setAccounts] = useState([])

  useEffect(() => { getAccounts().then(d => setAccounts(d.accounts)).catch(() => {}) }, [])

  const platformEmoji = { tiktok: '🎵', instagram: '📸', youtube: '▶️', twitter: '𝕏', telegram: '✈️' }

  // Clips por dia (real)
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  const dayBuckets = Object.fromEntries(dayNames.map(d => [d, 0]))
  state.clips.forEach(c => {
    if (c.created_at) dayBuckets[dayNames[new Date(c.created_at).getDay()]] += 1
  })
  const clipsByDay = dayNames.map(d => ({ d, clips: dayBuckets[d] }))

  // Clips por hora (real)
  const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ h: `${String(i).padStart(2, '0')}h`, c: 0 }))
  state.clips.forEach(c => { if (c.created_at) hourBuckets[new Date(c.created_at).getHours()].c += 1 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between animate-fade">
        <div>
          <h1 className="text-xl font-bold text-content-1 tracking-tight">Dashboard</h1>
          <p className="text-xs text-content-3 mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button icon={Wand2} onClick={() => dispatch({ type: 'SET_PAGE', payload: 'studio' })}>Criar video</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <StatCard icon={Film} label="Videos gerados" value={a.total_clips || state.clips.length} color="accent" />
        <StatCard icon={Upload} label="Publicados" value={a.published || 0} color="success" />
        <StatCard icon={Users} label="Contas" value={accounts.length} color="info" />
        <StatCard icon={Eye} label="Views total" value={(a.total_views || accounts.reduce((s, a) => s + a.total_views, 0)).toLocaleString('pt-BR')} color="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Clips por dia */}
        <Card className="lg:col-span-3 animate-in" style={{ animationDelay: '200ms' }}>
          <CardHeader title="Videos por dia" subtitle="producao" />
          {state.clips.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={clipsByDay} barSize={28}>
                <XAxis dataKey="d" stroke="#414b63" fontSize={10} fontFamily="Fira Code" tickLine={false} axisLine={false} />
                <YAxis stroke="#414b63" fontSize={9} fontFamily="Fira Code" tickLine={false} axisLine={false} width={20} allowDecimals={false} />
                <Tooltip content={<Tip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Bar dataKey="clips" fill="#6366f1" radius={[5, 5, 0, 0]} name="Videos" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-content-4 py-12 text-center">Gere videos no Studio pra ver os dados aqui</p>
          )}
        </Card>

        {/* Contas conectadas */}
        <Card className="lg:col-span-2 animate-in" style={{ animationDelay: '280ms' }}>
          <CardHeader title="Contas conectadas" subtitle="canais" />
          <div className="space-y-1.5">
            {accounts.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-content-4 mb-2">Nenhuma conta conectada</p>
                <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'SET_PAGE', payload: 'accounts' })}>Conectar conta</Button>
              </div>
            )}
            {accounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-3/50 hover:bg-surface-3 transition-colors">
                <span className="text-sm">{platformEmoji[acc.platform] || '📱'}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-content-2 truncate block">{acc.name}</span>
                  <span className="text-[9px] text-content-4">{acc.username}</span>
                </div>
                <div className="text-right">
                  {acc.total_followers > 0 && <span className="text-[9px] font-mono text-content-3 block">{acc.total_followers.toLocaleString('pt-BR')}</span>}
                  <Badge variant={acc.has_credentials ? 'success' : 'warning'} dot pulse={acc.has_credentials}>{acc.active ? 'ON' : 'OFF'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timeline */}
        <Card className="animate-in" style={{ animationDelay: '360ms' }}>
          <CardHeader title="Atividade por hora" subtitle="hoje" icon={Clock} />
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={hourBuckets}>
              <XAxis dataKey="h" stroke="#414b63" fontSize={8} fontFamily="Fira Code" tickLine={false} axisLine={false} interval={3} />
              <Tooltip content={<Tip />} />
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="c" stroke="#6366f1" fill="url(#aGrad)" strokeWidth={1.5} name="Videos" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Trending */}
        <Card className="animate-in" style={{ animationDelay: '440ms' }}>
          <CardHeader title="Trending agora" subtitle="temas" icon={Flame} />
          <div className="flex flex-wrap gap-1.5">
            {(state.trending || []).slice(0, 12).map((t, i) => (
              <Badge key={i} variant={t.should_monitor ? 'accent' : 'default'}>
                {t.name}
              </Badge>
            ))}
            {(!state.trending || !state.trending.length) && (
              <p className="text-xs text-content-4 py-6 w-full text-center">Ative o pipeline pra ver trends</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
