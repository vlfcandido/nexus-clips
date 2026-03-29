const variants = {
  default: 'bg-surface-4 text-content-2 border-stroke-1',
  accent: 'bg-accent-muted text-accent-light border-accent/20',
  success: 'bg-success-muted text-success border-success/20',
  warning: 'bg-warning-muted text-warning border-warning/20',
  danger: 'bg-danger-muted text-danger border-danger/20',
  info: 'bg-info-muted text-info border-info/20',
}

export default function Badge({ children, variant = 'default', dot, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border ${variants[variant]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full bg-current`} />}
      {children}
    </span>
  )
}
