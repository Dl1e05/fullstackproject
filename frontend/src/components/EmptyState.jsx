import Icon from './Icon.jsx';

export default function EmptyState({ icon = 'search', code, title, text, children }) {
  return (
    <div className="empty">
      {code ? (
        <div className="empty__code">{code}</div>
      ) : (
        <div className="empty__icon">
          <Icon name={icon} size={32} />
        </div>
      )}
      <h2 className="empty__title">{title}</h2>
      {text && <p className="empty__text">{text}</p>}
      {children && <div className="empty__actions">{children}</div>}
    </div>
  );
}
