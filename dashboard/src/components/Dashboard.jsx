import { Eye, Heart, Film, Upload, TrendingUp, DollarSign } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#5c7cfa', '#845ef7', '#20c997', '#fcc419', '#ff6b6b']

function StatCard({ icon: Icon, label, value, color = 'nexus-500' }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">{label}</span>
        <div className={`w-9 h-9 bg-${color}/10 rounded-lg flex items-center justify-center`}>
          <Icon className={`w-5 h-5 text-${color}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { state } = useApp()
  const a = state.analytics || {}

  const topCategories = (a.top_categories || []).map((c, i) => ({
    name: c.category,
    views: c.avg_views,
    fill: COLORS[i % COLORS.length],
  }))

  // Dados mock pra visualização inicial
  const recentPerformance = [
    { day: 'Seg', views: 12400, clips: 8 },
    { day: 'Ter', views: 18200, clips: 12 },
    { day: 'Qua', views: 9800, clips: 6 },
    { day: 'Qui', views: 24500, clips: 15 },
    { day: 'Sex', views: 31200, clips: 18 },
    { day: 'Sab', views: 28700, clips: 14 },
    { day: 'Dom', views: 35100, clips: 20 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">Visao geral do Nexus Clips</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Film} label="Total Clips" value={a.total_clips || 0} />
        <StatCard icon={Upload} label="Publicados" value={a.published || 0} color="green-500" />
        <StatCard icon={Eye} label="Views Total" value={(a.total_views || 0).toLocaleString('pt-BR')} color="purple-500" />
        <StatCard icon={Heart} label="Likes Total" value={(a.total_likes || 0).toLocaleString('pt-BR')} color="red-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views por dia */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">Views por Dia</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={recentPerformance}>
              <XAxis dataKey="day" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="views" fill="#5c7cfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top categorias */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">Performance por Categoria</h3>
          {topCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={topCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="views"
                  nameKey="name"
                  label={({ name }) => name}
                >
                  {topCategories.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-600">
              Sem dados ainda — publique clips pra ver analytics
            </div>
          )}
        </div>
      </div>

      {/* Trending rápido */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-nexus-400" />
          <h3 className="text-sm font-semibold text-gray-400">Trending Agora</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {(state.trending || []).slice(0, 10).map((t, i) => (
            <span
              key={i}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                t.should_monitor
                  ? 'bg-nexus-600/20 text-nexus-400 border border-nexus-600/30'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {t.name}
              {t.should_monitor && <span className="ml-1">🔥</span>}
            </span>
          ))}
          {(!state.trending || state.trending.length === 0) && (
            <span className="text-gray-600 text-sm">Carregando trends...</span>
          )}
        </div>
      </div>
    </div>
  )
}
