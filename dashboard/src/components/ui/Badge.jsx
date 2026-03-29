const variants = {
  default: 'bg-surface-4/80 text-content-2 border-stroke-1',
  accent: 'bg-accent-muted text-accent-light border-accent/20',
  success: 'bg-success-muted text-success border-success/20',
  warning: 'bg-warning-muted text-warning border-warning/20',
  danger: 'bg-danger-muted text-danger border-danger/20',
  info: 'bg-info-muted text-info border-info/20',
}

export default function Badge({ children, variant = 'default', dot, pulse, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border transition-colors ${variants[variant]} ${className}`}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}
