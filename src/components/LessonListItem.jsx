import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

const TYPE_LABEL = { text: 'Текст', video: 'Видео', quiz: 'Тест' };

export default function LessonListItem({
  index,
  title,
  type = 'text',
  minutes,
  meta,
  to,
  active = false,
  done = false,
  locked = false,
  preview = false,
  compact = false,
}) {
  const cls = ['lesson-item', active && 'is-active', done && 'is-done', locked && 'is-locked', compact && 'lesson-item--compact']
    .filter(Boolean)
    .join(' ');

  let badge = index;
  if (done) badge = <Icon name="check" size={16} />;
  else if (locked) badge = <Icon name="lock" size={16} />;
  else if (type === 'quiz') badge = <Icon name="quiz" size={18} />;

  return (
    <Link to={to} className={cls} aria-current={active ? 'step' : undefined}>
      <span className="lesson-item__num">{badge}</span>
      <span className="lesson-item__text">
        <span className="lesson-item__title">{title}</span>
        <span className="lesson-item__meta">
          {meta ?? `${TYPE_LABEL[type]}${minutes ? ` · ${minutes} мин` : ''}`}
          {preview && <span className="lesson-item__preview">Пробный</span>}
        </span>
      </span>
      {!compact && <Icon name={locked ? 'lock' : 'chevronRight'} size={18} className="lesson-item__chevron" />}
    </Link>
  );
}
