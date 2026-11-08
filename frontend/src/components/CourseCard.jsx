import { Link } from 'react-router-dom';
import CourseCover from './CourseCover.jsx';
import ProgressBar from './ProgressBar.jsx';
import Icon from './Icon.jsx';
import { useProgress } from '../hooks/useProgress.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatPrice } from '../services/api.js';

export default function CourseCard({ course, showProgress = false }) {
  const { getCourseProgress, getCourseStatus, isSaved } = useProgress();
  const { hasPurchased } = useAuth();
  const progress = getCourseProgress(course);
  const status = getCourseStatus(course.id);
  const purchased = hasPurchased(course.id);

  return (
    <Link to={`/courses/${course.id}`} className="course-card">
      <div className="course-card__cover">
        <CourseCover topic={course.topic} />
        {course.price > 0 && (
          <span className={`price-tag ${purchased ? 'price-tag--owned' : ''}`}>
            {purchased ? (
              <>
                <Icon name="check" size={14} /> Куплен
              </>
            ) : (
              <>
                <Icon name="tag" size={14} /> {formatPrice(course.price)}
              </>
            )}
          </span>
        )}
      </div>
      <div className="course-card__body">
        <div className="course-card__top">
          <span className="course-card__topic">{course.topic?.title}</span>
          {isSaved(course.id) && <Icon name="bookmarkFilled" size={18} className="course-card__saved" title="В избранном" />}
        </div>
        <h3 className="course-card__title">{course.title}</h3>
        <p className="course-card__subtitle">{course.subtitle}</p>
        <div className="course-card__meta">
          <span>
            <Icon name="book" size={16} /> {course.lessonsCount} уроков
          </span>
          <span>
            <Icon name="clock" size={16} /> {course.duration}
          </span>
          {!course.price && <span className="course-card__free">Бесплатно</span>}
        </div>
        {status === 'completed' ? (
          <span className="badge badge--success">
            <Icon name="check" size={14} /> Курс пройден
          </span>
        ) : (
          showProgress && (
            <ProgressBar value={progress.percent} label={`${progress.done} из ${progress.total} уроков`} showValue size="sm" />
          )
        )}
      </div>
    </Link>
  );
}
