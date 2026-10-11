// Tabs — переключатель вкладок, Chip — фильтр-«таблетка»
export function Tabs({ items, value, onChange, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          className={`tabs__tab ${value === it.id ? 'is-active' : ''}`}
          onClick={() => onChange(it.id)}
        >
          {it.label}
          {it.count != null && <span className="tabs__count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active = false, onClick, children, color }) {
  return (
    <button
      type="button"
      className={`chip ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
      style={color ? { '--chip-dot': color } : undefined}
    >
      {color && <span className="chip__dot" />}
      {children}
    </button>
  );
}
