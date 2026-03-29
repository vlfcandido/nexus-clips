export default function Card({ children, className = '', hover = false, padding = 'p-5', ...props }) {
  return (
    <div
      className={`bg-surface-2 border border-stroke-1 rounded-2xl ${padding} ${
        hover ? 'hover:border-stroke-2 hover:bg-surface-3/50 transition-all duration-150 cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`}>
      <div>
        {subtitle && <p className="text-[10px] font-mono text-content-4 tracking-wider uppercase mb-0.5">{subtitle}</p>}
        <h3 className="text-sm font-semibold text-content-1">{title}</h3>
      </div>
      {action}
    </div>
  )
}
