const variants = {
  primary: 'bg-accent hover:bg-accent-dark active:bg-indigo-700 text-white shadow-lg shadow-accent/15 hover:shadow-accent/25',
  secondary: 'bg-surface-4 hover:bg-surface-5 active:bg-surface-3 text-content-2 border border-stroke-2 hover:border-stroke-3',
  ghost: 'hover:bg-surface-3 active:bg-surface-4 text-content-3 hover:text-content-2',
  danger: 'bg-danger-muted hover:bg-danger/20 active:bg-danger/30 text-danger border border-danger/20',
  success: 'bg-success-muted hover:bg-success/20 text-success border border-success/20',
}

const sizes = {
  xs: 'px-2 py-1 text-[10px] gap-1 rounded-md',
  sm: 'px-2.5 py-1.5 text-[11px] gap-1.5 rounded-lg',
  md: 'px-3.5 py-2 text-xs gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
}

export default function Button({ children, variant = 'primary', size = 'md', icon: Icon, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 focus-ring ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={`${size === 'lg' ? 'w-4 h-4' : size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${props.disabled ? '' : 'transition-transform group-hover:scale-105'}`} />}
      {children}
    </button>
  )
}
