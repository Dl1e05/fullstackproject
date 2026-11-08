import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatPrice } from '../services/api.js';

export default function Paywall({ course, title = 'Урок доступен после покупки курса', previewTo }) {
  const { buyCourse } = useAuth();
  return (
    <div className="paywall">
      <span className="paywall__icon">
        <Icon name="lock" size={28} />
      </span>
      <h2>{title}</h2>
      <p className="muted">
        Откройте все {course.lessonsCount} уроков и итоговый тест курса «{course.title}» за {formatPrice(course.price)}. Оплата
        разовая, доступ навсегда.
      </p>
      <div className="empty__actions">
        <Button size="lg" onClick={() => buyCourse(course)}>
          Купить за {formatPrice(course.price)}
        </Button>
        {previewTo && (
          <Button size="lg" variant="outline" to={previewTo}>
            Пробный урок
          </Button>
        )}
      </div>
    </div>
  );
}
