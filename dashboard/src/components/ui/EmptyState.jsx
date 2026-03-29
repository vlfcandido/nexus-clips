export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-surface-3 border border-stroke-1 flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-content-4" />
        </div>
      )}
      <p className="text-sm font-medium text-content-3">{title}</p>
      {description && <p className="text-xs text-content-4 mt-1 max-w-xs text-center">{description}</p>}
    </div>
  )
}
