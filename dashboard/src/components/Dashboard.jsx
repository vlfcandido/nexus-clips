import { useState, useEffect } from 'react'
import { Eye, Heart, Film, Upload, TrendingUp, Clock, Flame, BarChart3 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { getAccounts } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import StatCard from './ui/StatCard'
import Card, { CardHeader } from './ui/Card'
import Badge from './ui/Badge'

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-4 border border-stroke-2 rounded-lg px-3 py-1.5 shadow-xl">
      <p className="text-[9px] text-content-4 font-mono">{label}</p>
      <p className="text-xs font-semibold text-content-1">{payload[0].value?.toLocaleString('pt-BR')}</p>
    </div>
  )
}

export default function Dashboard() {
  const { state } = useApp()
  const a = state.analytics || {}

  const perfData = [
    { d: 'Seg', v: 12400 }, { d: 'Ter', v: 18200 }, { d: 'Qua', v: 9800 },
    { d: 'Qui', v: 24500 }, { d: 'Sex', v: 31200 }, { d: 'Sab', v: 28700 }, { d: 'Dom', v: 35100 },
  ]

  const hourData = Array.from({ length: 24 }, (_, i) => ({
    h: `${String(i).padStart(2, '0')}h`,
    c: Math.floor(Math.random() * 10) + 1,
  }))

  const [accounts, setAccounts] = useState([])
  useEffect(() => { getAccounts().then(d => setAccounts(d.accounts)).catch(() => {}) }, [])

  const platformEmoji = { tiktok: '🎵', instagram: '📸', youtube: '▶️', twitter: '𝕏', telegram: '✈️' }
  const platformColor = { tiktok: 'accent', instagram: 'danger', youtube: 'danger', twitter: 'info', telegram: 'info' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade">
        <h1 className="text-xl font-bold text-content-1 tracking-tight">Dashboard</h1>
        <p className="text-xs text-content-3 mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <StatCard icon={Film} label="Total clips" value={a.total_clips || 0} color="accent" />
        <StatCard icon={Upload} label="Publicados" value={a.published || 0} color="success" />
        <StatCard icon={Eye} label="Views" value={(a.total_views || 0).toLocaleString('pt-BR')} color="info" />
        <StatCard icon={Heart} label="Engajamento" value={(a.total_likes || 0).toLocaleString('pt-BR')} color="danger" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 animate-in" style={{ animationDelay: '200ms' }}>
          <CardHeader title="Performance semanal" subtitle="views" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={perfData} barSize={24}>
              <XAxis dataKey="d" stroke="#414b63" fontSize={10} fontFamily="Fira Code" tickLine={false} axisLine={false} />
              <YAxis stroke="#414b63" fontSize={9} fontFamily="Fira Code" tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
              <Bar dataKey="v" fill="#6366f1" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="lg:col-span-2 animate-in" style={{ animationDelay: '280ms' }}>
          <CardHeader title="Canais" subtitle="contas conectadas" />
          <div className="space-y-1.5">
            {accounts.length === 0 && (
              <p className="text-xs text-content-4 py-4 text-center">Nenhuma conta conectada</p>
            )}
            {accounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-3/50 hover:bg-surface-3 transition-colors">
                <span className="text-sm">{platformEmoji[acc.platform] || '📱'}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-content-2 truncate block">{acc.name}</span>
                  <span className="text-[9px] text-content-4">{acc.username}</span>
                </div>
                <div className="text-right">
                  {acc.total_followers > 0 && <span className="text-[9px] font-mono text-content-3 block">{acc.total_followers.toLocaleString('pt-BR')} subs</span>}
                  <Badge variant={acc.has_credentials ? 'success' : 'warning'} dot>{acc.active ? 'ON' : 'OFF'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="animate-in" style={{ animationDelay: '360ms' }}>
          <CardHeader title="Atividade 24h" subtitle="timeline" action={<Clock className="w-4 h-4 text-content-4" />} />
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={hourData}>
              <XAxis dataKey="h" stroke="#414b63" fontSize={8} fontFamily="Fira Code" tickLine={false} axisLine={false} interval={3} />
              <Tooltip content={<ChartTooltip />} />
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="c" stroke="#6366f1" fill="url(#aGrad)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="animate-in" style={{ animationDelay: '440ms' }}>
          <CardHeader title="Trending agora" subtitle="hot topics" action={<Flame className="w-4 h-4 text-content-4" />} />
          <div className="flex flex-wrap gap-1.5">
            {(state.trending || []).slice(0, 12).map((t, i) => (
              <Badge key={i} variant={t.should_monitor ? 'accent' : 'default'}>
                {t.name}
              </Badge>
            ))}
            {(!state.trending || !state.trending.length) && (
              <p className="text-xs text-content-4 py-6 w-full text-center">Aguardando dados do pipeline...</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
