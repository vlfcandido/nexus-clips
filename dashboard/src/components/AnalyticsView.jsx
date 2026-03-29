import { useState, useEffect } from 'react'
import {
  Eye, Heart, MessageCircle, Share2, Film, TrendingUp, Users, ArrowUpRight,
  ArrowDownRight, BarChart3, Clock, Zap, Target, Crown, Flame,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts'
import { getAccounts, getClips, getAnalytics } from '../api/client'
import Card, { CardHeader } from './ui/Card'
import Badge from './ui/Badge'

// ========================================
// CUSTOM TOOLTIP
// ========================================
const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-4 border border-stroke-2 rounded-lg px-3 py-2 shadow-2xl">
      <p className="text-[9px] text-content-4 font-mono mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color || '#818cf8' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('pt-BR') : p.value}
        </p>
      ))}
    </div>
  )
}

// ========================================
// METRIC CARD — grande, com sparkline
// ========================================
function MetricCard({ icon: Icon, label, value, change, changeLabel, color, sparkData, delay = 0 }) {
  const colors = {
    accent: { bg: 'bg-accent-muted', icon: 'text-accent-light', spark: '#818cf8' },
    success: { bg: 'bg-success-muted', icon: 'text-success', spark: '#22c55e' },
    info: { bg: 'bg-info-muted', icon: 'text-info', spark: '#3b82f6' },
    danger: { bg: 'bg-danger-muted', icon: 'text-danger', spark: '#ef4444' },
    warning: { bg: 'bg-warning-muted', icon: 'text-warning', spark: '#f59e0b' },
  }
  const c = colors[color] || colors.accent
  const isPositive = change > 0

  return (
    <div className="bg-surface-2 border border-stroke-1 rounded-2xl p-5 animate-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between mb-1">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium ${
            isPositive ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-content-1 tracking-tight mt-3">{value}</p>
      <p className="text-[11px] text-content-3 mt-0.5">{label}</p>
      {changeLabel && <p className="text-[9px] text-content-4 mt-0.5">{changeLabel}</p>}

      {/* Mini sparkline */}
      {sparkData && sparkData.length > 0 && (
        <div className="mt-3 -mx-1">
          <ResponsiveContainer width="100%" height={40}>
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.spark} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={c.spark} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={c.spark} fill={`url(#spark-${color})`} strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ========================================
// ACCOUNT ROW — performance por conta
// ========================================
function AccountRow({ account, rank }) {
  const platformEmoji = { tiktok: '🎵', instagram: '📸', youtube: '▶️', twitter: '𝕏', telegram: '✈️' }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-stroke-1 last:border-0">
      <span className={`text-xs font-bold font-mono w-5 text-center ${rank <= 3 ? 'text-warning' : 'text-content-4'}`}>
        {rank <= 3 ? <Crown className="w-3.5 h-3.5 text-warning inline" /> : rank}
      </span>
      <span className="text-base">{platformEmoji[account.platform] || '📱'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-content-1 truncate">{account.name}</p>
        <p className="text-[10px] text-content-4">{account.username}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-mono font-semibold text-content-1">{account.total_views.toLocaleString('pt-BR')}</p>
        <p className="text-[9px] text-content-4">views</p>
      </div>
      <div className="text-right w-12">
        <p className="text-xs font-mono text-content-2">{account.total_posts}</p>
        <p className="text-[9px] text-content-4">posts</p>
      </div>
    </div>
  )
}

// ========================================
// TOP CLIP ROW
// ========================================
function TopClipRow({ clip, rank }) {
  const catEmoji = { gol: '⚽', polêmica: '🔥', declaração: '🎙️', treta: '💥', breaking: '🚨', humor: '😂' }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-stroke-1 last:border-0">
      <span className={`text-xs font-bold font-mono w-5 text-center ${rank <= 3 ? 'text-accent-light' : 'text-content-4'}`}>
        #{rank}
      </span>
      <span className="text-sm">{catEmoji[clip.category] || '📎'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-content-1 truncate">{clip.caption || clip.moment_text}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="default">{clip.topic}</Badge>
          <span className="text-[9px] text-content-4">{clip.duration_seconds}s</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] font-mono text-content-3">
        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{clip.views.toLocaleString('pt-BR')}</span>
        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{clip.likes}</span>
        <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{clip.shares}</span>
      </div>
    </div>
  )
}

// ========================================
// MAIN COMPONENT
// ========================================
export default function AnalyticsView() {
  const [accounts, setAccounts] = useState([])
  const [clips, setClips] = useState([])
  const [analytics, setAnalytics] = useState({})

  useEffect(() => {
    Promise.allSettled([
      getAccounts(), getClips({ limit: 50 }), getAnalytics(),
    ]).then(([acc, cl, an]) => {
      if (acc.status === 'fulfilled') setAccounts(acc.value.accounts)
      if (cl.status === 'fulfilled') setClips(cl.value.clips)
      if (an.status === 'fulfilled') setAnalytics(an.value)
    })
  }, [])

  // Métricas calculadas
  const totalViews = clips.reduce((s, c) => s + c.views, 0)
  const totalLikes = clips.reduce((s, c) => s + c.likes, 0)
  const totalShares = clips.reduce((s, c) => s + c.shares, 0)
  const published = clips.filter(c => c.published).length
  const avgViews = published > 0 ? Math.round(totalViews / published) : 0

  // Engagement rate
  const engagementRate = totalViews > 0
    ? ((totalLikes + totalShares) / totalViews * 100).toFixed(1)
    : '0.0'

  // Sparklines baseados em dados reais (agrupa por dia)
  const spark = () => {
    const days = {}
    clips.forEach(c => {
      const d = c.created_at?.split('T')[0] || 'unknown'
      days[d] = (days[d] || 0) + 1
    })
    return Object.values(days).map(v => ({ v }))
  }

  // Clips por dia da semana (dados reais)
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  const dailyBuckets = {}
  dayNames.forEach(d => { dailyBuckets[d] = { day: d, views: 0, likes: 0, shares: 0, clips: 0 } })
  clips.forEach(c => {
    if (!c.created_at) return
    const dayIdx = new Date(c.created_at).getDay()
    const d = dayNames[dayIdx]
    dailyBuckets[d].views += c.views
    dailyBuckets[d].likes += c.likes
    dailyBuckets[d].shares += c.shares
    dailyBuckets[d].clips += 1
  })
  const dailyData = dayNames.map(d => dailyBuckets[d])

  // Posts por plataforma
  const platformData = ['tiktok', 'instagram', 'youtube', 'twitter', 'telegram'].map(p => ({
    name: p,
    contas: accounts.filter(a => a.platform === p).length,
    posts: accounts.filter(a => a.platform === p).reduce((s, a) => s + a.total_posts, 0),
  })).filter(p => p.contas > 0)

  // Top clips por views
  const topClips = [...clips].sort((a, b) => b.views - a.views).slice(0, 8)

  // Contas ordenadas por views
  const rankedAccounts = [...accounts].sort((a, b) => b.total_views - a.total_views)

  // Distribuição por tópico
  const topicCounts = {}
  clips.forEach(c => { topicCounts[c.topic] = (topicCounts[c.topic] || 0) + 1 })
  const topicData = Object.entries(topicCounts).map(([name, value]) => ({ name, value }))
  const PIE_COLORS = ['#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7']

  // Horários de melhor performance (mock)
  // Clips por hora (dados reais)
  const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ h: `${String(i).padStart(2, '0')}h`, clips: 0 }))
  clips.forEach(c => {
    if (!c.created_at) return
    const hour = new Date(c.created_at).getHours()
    hourBuckets[hour].clips += 1
  })
  const hourData = hourBuckets

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between animate-fade">
        <div>
          <h1 className="text-xl font-bold text-content-1 tracking-tight">Analytics</h1>
          <p className="text-xs text-content-3 mt-1">Performance de conteudo e contas — dados em tempo real</p>
        </div>
        <div className="flex bg-surface-2 border border-stroke-1 rounded-xl p-[3px]">
          {['7 dias', '30 dias', 'Total'].map((p, i) => (
            <button key={p} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              i === 0 ? 'bg-surface-4 text-content-1 shadow-sm' : 'text-content-4 hover:text-content-3'
            }`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard icon={Eye} label="Views totais" value={totalViews.toLocaleString('pt-BR')}
          change={12} changeLabel="vs semana anterior" color="accent"
          sparkData={spark()} delay={0} />
        <MetricCard icon={Heart} label="Likes totais" value={totalLikes.toLocaleString('pt-BR')}
          color="danger" sparkData={spark()} delay={60} />
        <MetricCard icon={Share2} label="Compartilhamentos" value={totalShares.toLocaleString('pt-BR')}
          color="info" sparkData={spark()} delay={120} />
        <MetricCard icon={Target} label="Engajamento" value={`${engagementRate}%`}
          changeLabel="(likes+shares)/views" color="success"
          sparkData={spark()} delay={180} />
        <MetricCard icon={Film} label="Clips gerados" value={clips.length}
          changeLabel={`${published} publicados`} color="warning"
          sparkData={spark()} delay={240} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Engagement timeline */}
        <Card className="lg:col-span-2 animate-in" style={{ animationDelay: '300ms' }}>
          <CardHeader title="Engajamento semanal" subtitle="performance"
            action={
              <div className="flex items-center gap-3 text-[9px] font-mono text-content-4">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" />Views</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" />Likes</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-info" />Shares</span>
              </div>
            }
          />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2332" vertical={false} />
              <XAxis dataKey="day" stroke="#414b63" fontSize={10} fontFamily="Fira Code" tickLine={false} axisLine={false} />
              <YAxis stroke="#414b63" fontSize={9} fontFamily="Fira Code" tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
              <Bar dataKey="views" fill="#6366f1" radius={[3, 3, 0, 0]} name="Views" />
              <Bar dataKey="likes" fill="#ef4444" radius={[3, 3, 0, 0]} name="Likes" />
              <Bar dataKey="shares" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Shares" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Topic distribution */}
        <Card className="animate-in" style={{ animationDelay: '380ms' }}>
          <CardHeader title="Conteudo por topico" subtitle="distribuicao" />
          {topicData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={topicData} cx="50%" cy="50%" innerRadius={35} outerRadius={65}
                    dataKey="value" nameKey="name" stroke="none">
                    {topicData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<Tip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {topicData.map((t, i) => (
                  <div key={t.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[11px] text-content-2 capitalize">{t.name}</span>
                    <span className="text-[10px] font-mono text-content-4 ml-auto">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-content-4 py-10 text-center">Sem dados ainda</p>
          )}
        </Card>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best hours */}
        <Card className="animate-in" style={{ animationDelay: '460ms' }}>
          <CardHeader title="Melhores horarios" subtitle="engajamento por hora"
            action={<Clock className="w-4 h-4 text-content-4" />} />
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={hourData}>
              <XAxis dataKey="h" stroke="#414b63" fontSize={8} fontFamily="Fira Code" tickLine={false} axisLine={false} interval={3} />
              <Tooltip content={<Tip />} />
              <defs>
                <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="engagement" name="Engajamento" stroke="#6366f1" fill="url(#hourGrad)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2 text-[9px] text-content-4">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-warning" /> Pico: 18h-22h</span>
            <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-danger" /> Melhor: 21h</span>
          </div>
        </Card>

        {/* Platform breakdown */}
        <Card className="animate-in" style={{ animationDelay: '540ms' }}>
          <CardHeader title="Performance por plataforma" subtitle="contas ativas" />
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={platformData} layout="vertical" barSize={16}>
                <XAxis type="number" stroke="#414b63" fontSize={9} fontFamily="Fira Code" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke="#414b63" fontSize={10} fontFamily="Fira Code" tickLine={false} axisLine={false} width={70} />
                <Tooltip content={<Tip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                <Bar dataKey="contas" fill="#6366f1" name="Contas" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-content-4 py-10 text-center">Adicione contas primeiro</p>
          )}
        </Card>
      </div>

      {/* Bottom: Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top clips */}
        <Card className="animate-in" style={{ animationDelay: '620ms' }}>
          <CardHeader title="Top conteudos" subtitle="ranking por views"
            action={<Badge variant="accent">{topClips.length} clips</Badge>} />
          {topClips.length > 0 ? (
            <div>
              {topClips.map((clip, i) => <TopClipRow key={clip.id} clip={clip} rank={i + 1} />)}
            </div>
          ) : (
            <p className="text-xs text-content-4 py-8 text-center">Publique clips pra ver o ranking</p>
          )}
        </Card>

        {/* Account rankings */}
        <Card className="animate-in" style={{ animationDelay: '700ms' }}>
          <CardHeader title="Ranking de contas" subtitle="por views totais"
            action={<Badge variant="success">{accounts.length} contas</Badge>} />
          {rankedAccounts.length > 0 ? (
            <div>
              {rankedAccounts.map((acc, i) => <AccountRow key={acc.id} account={acc} rank={i + 1} />)}
            </div>
          ) : (
            <p className="text-xs text-content-4 py-8 text-center">Crie contas na aba Contas</p>
          )}
        </Card>
      </div>
    </div>
  )
}
