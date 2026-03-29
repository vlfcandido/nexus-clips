export default function PageHeader({ title, description, icon: Icon, actions, badge }) {
  return (
    <div className="flex items-end justify-between animate-fade mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-fuchsia-500/80 flex items-center justify-center shadow-lg shadow-accent/10 animate-float">
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-content-1 tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && <p className="text-xs text-content-3 mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
