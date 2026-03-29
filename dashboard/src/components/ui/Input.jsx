export function Input({ label, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-content-3 mb-1.5">{label}</label>}
      <input
        className={`w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-sm text-content-1 placeholder-content-4 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all ${className}`}
        {...props}
      />
    </div>
  )
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-content-3 mb-1.5">{label}</label>}
      <select
        className={`w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-sm text-content-1 outline-none focus:border-accent/50 transition-all ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-surface-5'}`}
      >
        <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
      </button>
      {label && <span className="text-sm text-content-2">{label}</span>}
    </label>
  )
}
