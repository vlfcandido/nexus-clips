import { Eye, Heart, Film, Upload, TrendingUp, Clock, Flame } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

function StatCard({ icon: Icon, label, value, change, color = 'violet', delay = 0 }) {
  const colors = {
    violet: 'from-violet-500/10 to-transparent border-violet-500/20 text-violet-400',
    emerald: 'from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400',
    sky: 'from-sky-500/10 to-transparent border-sky-500/20 text-sky-400',
    rose: 'from-rose-500/10 to-transparent border-rose-500/20 text-rose-400',
  }

  return (
    <div
      className="anim-fade-up bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition-colors"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-zinc-500 font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-b ${colors[color]} flex items-center justify-center border`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-zinc-100 tracking-tight">{value}</span>
        {change && (
          <span className={`text-[11px] font-mono mb-1 ${change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
            {change}
          </span>
        )}
      </div>
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-zinc-400 font-mono">{label}</p>
      <p className="text-sm font-semibold text-zinc-100">{payload[0].value?.toLocaleString('pt-BR')}</p>
    </div>
  )
}

export default function Dashboard() {
  const { state } = useApp()
  const a = state.analytics || {}

  const perfData = [
    { day: 'Seg', views: 12400 },
    { day: 'Ter', views: 18200 },
    { day: 'Qua', views: 9800 },
    { day: 'Qui', views: 24500 },
    { day: 'Sex', views: 31200 },
    { day: 'Sab', views: 28700 },
    { day: 'Dom', views: 35100 },
  ]

  const hourData = Array.from({ length: 24 }, (_, i) => ({
    h: `${String(i).padStart(2, '0')}`,
    clips: Math.floor(Math.random() * 10) + 1,
  }))

  const channels = [
    { name: 'Guerra Agora', topic: 'guerra', clips: 0, color: 'bg-red-500' },
    { name: 'Gol a Gol', topic: 'futebol', clips: 0, color: 'bg-emerald-500' },
    { name: 'Brasil Livre News', topic: 'politica', clips: 0, color: 'bg-sky-500' },
    { name: 'Povo Informa', topic: 'politica', clips: 0, color: 'bg-amber-500' },
    { name: 'Viralizou BR', topic: 'trending', clips: 0, color: 'bg-fuchsia-500' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="anim-fade">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Visao geral da operacao — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Film} label="Total clips" value={a.total_clips || 0} color="violet" delay={0} />
        <StatCard icon={Upload} label="Publicados" value={a.published || 0} color="emerald" delay={60} />
        <StatCard icon={Eye} label="Total views" value={(a.total_views || 0).toLocaleString('pt-BR')} color="sky" delay={120} />
        <StatCard icon={Heart} label="Total likes" value={(a.total_likes || 0).toLocaleString('pt-BR')} color="rose" delay={180} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Performance */}
        <div className="lg:col-span-3 anim-fade-up bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Performance semanal</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Views por dia da semana</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={perfData} barSize={28}>
              <XAxis dataKey="day" stroke="#3f3f46" fontSize={11} fontFamily="IBM Plex Mono" tickLine={false} axisLine={false} />
              <YAxis stroke="#3f3f46" fontSize={10} fontFamily="IBM Plex Mono" tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }} />
              <Bar dataKey="views" radius={[6, 6, 0, 0]}>
                {perfData.map((_, i) => (
                  <rect key={i} fill={i === perfData.length - 1 ? '#8b5cf6' : '#3f3f46'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Canais */}
        <div className="lg:col-span-2 anim-fade-up bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5" style={{ animationDelay: '350ms' }}>
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">Canais</h3>
          <div className="space-y-2.5">
            {channels.map((ch) => (
              <div key={ch.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/70 transition-colors">
                <div className={`w-2 h-2 rounded-full ${ch.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">{ch.name}</p>
                  <p className="text-[10px] text-zinc-600">{ch.topic}</p>
                </div>
                <span className="text-xs font-mono text-zinc-500">{ch.clips}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timeline */}
        <div className="anim-fade-up bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5" style={{ animationDelay: '450ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-200">Atividade 24h</h3>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={hourData}>
              <XAxis dataKey="h" stroke="#3f3f46" fontSize={9} fontFamily="IBM Plex Mono" tickLine={false} axisLine={false} interval={3} />
              <Tooltip content={<ChartTooltip />} />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="clips" stroke="#8b5cf6" fill="url(#grad)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Trending tags */}
        <div className="anim-fade-up bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5" style={{ animationDelay: '550ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-200">Trending agora</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(state.trending || []).slice(0, 15).map((t, i) => (
              <span
                key={i}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-default ${
                  t.should_monitor
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                    : 'bg-zinc-800/60 text-zinc-500 border border-zinc-800 hover:text-zinc-400'
                }`}
              >
                {t.name}
              </span>
            ))}
            {(!state.trending || !state.trending.length) && (
              <p className="text-xs text-zinc-600 py-6 w-full text-center">Carregando trending topics...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
