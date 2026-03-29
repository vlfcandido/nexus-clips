const variants = {
  primary: 'bg-accent hover:bg-accent-dark text-white shadow-lg shadow-accent/10',
  secondary: 'bg-surface-4 hover:bg-surface-5 text-content-2 border border-stroke-2',
  ghost: 'hover:bg-surface-3 text-content-3 hover:text-content-2',
  danger: 'bg-danger-muted hover:bg-danger/20 text-danger border border-danger/20',
}

const sizes = {
  sm: 'px-2.5 py-1.5 text-[11px] gap-1.5 rounded-lg',
  md: 'px-3.5 py-2 text-xs gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
}

export default function Button({ children, variant = 'primary', size = 'md', icon: Icon, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  )
}
