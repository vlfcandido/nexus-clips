export default function Card({ children, className = '', hover = false, glow = false, padding = 'p-5', ...props }) {
  return (
    <div
      className={`bg-surface-2 border border-stroke-1 rounded-2xl ${padding} transition-all duration-200 ${
        hover ? 'hover:border-stroke-2 hover:bg-surface-3/30 cursor-pointer hover-lift' : ''
      } ${glow ? 'border-glow' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, icon: Icon, className = '' }) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-accent-light" />
          </div>
        )}
        <div>
          {subtitle && <p className="text-[9px] font-mono text-content-4 tracking-widest uppercase mb-0.5">{subtitle}</p>}
          <h3 className="text-sm font-semibold text-content-1">{title}</h3>
        </div>
      </div>
      {action}
    </div>
  )
}
