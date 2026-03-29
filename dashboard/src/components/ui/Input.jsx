export function Input({ label, hint, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-content-3 mb-1.5">{label}</label>}
      <input
        className={`w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-sm text-content-1 placeholder-content-4 outline-none transition-all duration-150 focus-ring ${className}`}
        {...props}
      />
      {hint && <p className="text-[9px] text-content-4 mt-1">{hint}</p>}
    </div>
  )
}

export function Textarea({ label, hint, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-content-3 mb-1.5">{label}</label>}
      <textarea
        className={`w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-sm text-content-1 placeholder-content-4 outline-none resize-y transition-all duration-150 focus-ring ${className}`}
        {...props}
      />
      {hint && <p className="text-[9px] text-content-4 mt-1">{hint}</p>}
    </div>
  )
}

export function Select({ label, children, hint, className = '', ...props }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-content-3 mb-1.5">{label}</label>}
      <select
        className={`w-full bg-surface-3 border border-stroke-2 rounded-lg px-3 py-2 text-sm text-content-1 outline-none transition-all duration-150 focus-ring ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint && <p className="text-[9px] text-content-4 mt-1">{hint}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 flex-shrink-0 mt-0.5 ${checked ? 'bg-accent' : 'bg-surface-5'}`}
      >
        <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
      </button>
      {(label || description) && (
        <div>
          {label && <span className="text-sm text-content-2 group-hover:text-content-1 transition-colors">{label}</span>}
          {description && <p className="text-[10px] text-content-4 mt-0.5">{description}</p>}
        </div>
      )}
    </label>
  )
}
