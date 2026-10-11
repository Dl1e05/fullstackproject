import Icon from './Icon.jsx';

export default function CourseCover({ topic, size = 'md' }) {
  const color = topic?.color ?? 'var(--color-primary)';
  return (
    <div className={`cover cover--${size}`} style={{ '--cover': color }}>
      <span className="cover__icon">
        <Icon name={topic?.icon ?? 'book'} size={size === 'lg' ? 40 : 28} />
      </span>
    </div>
  );
}
