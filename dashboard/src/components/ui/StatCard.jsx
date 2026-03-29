export default function StatCard({ icon: Icon, label, value, change, color = 'accent', className = '' }) {
  const colors = {
    accent: 'bg-accent-muted text-accent-light',
    success: 'bg-success-muted text-success',
    info: 'bg-info-muted text-info',
    danger: 'bg-danger-muted text-danger',
    warning: 'bg-warning-muted text-warning',
  }

  return (
    <div className={`bg-surface-2 border border-stroke-1 rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-content-3 font-medium">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-content-1 tracking-tight">{value}</span>
        {change && (
          <span className={`text-[10px] font-mono font-medium ${change.startsWith('+') ? 'text-success' : 'text-danger'}`}>
            {change}
          </span>
        )}
      </div>
    </div>
  )
}
