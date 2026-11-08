import { useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import CourseCover from '../components/CourseCover.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import LessonListItem from '../components/LessonListItem.jsx';
import Icon from '../components/Icon.jsx';
import { AsyncView } from '../components/Loader.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useProgress } from '../hooks/useProgress.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { formatPrice, getCourse } from '../services/api.js';

function CourseView({ course }) {
  const { state, isSaved, toggleSaved, isLessonDone, getCourseProgress, getCourseStatus } = useProgress();
  const { buyCourse } = useAuth();
  const progress = getCourseProgress(course);
  const status = getCourseStatus(course.id);
  const saved = isSaved(course.id);
  const quiz = state.quiz[course.id];
  const locked = !course.hasAccess;

  const nextLesson = course.lessons.find((l) => !isLessonDone(course.id, l.id));
  const lastId = state.last[course.id]?.lessonId;
  const startTo = nextLesson
    ? `/courses/${course.id}/lessons/${status === 'new' ? course.lessons[0].id : nextLesson.id}`
    : `/courses/${course.id}/quiz`;
  const startLabel = status === 'new' ? 'Начать курс' : nextLesson ? 'Продолжить' : quiz?.passed ? 'Пройти тест ещё раз' : 'Перейти к тесту';

  return (
    <div className="container page">
      <section className="course-hero card">
        <CourseCover topic={course.topic} size="lg" />
        <div className="course-hero__body">
          <span className="eyebrow">{course.topic.title}</span>
          <h1>{course.title}</h1>
          <p className="lead">{course.subtitle}</p>
          <ul className="meta-list">
            <li>
              <Icon name="book" size={18} /> {course.lessonsCount} уроков
            </li>
            <li>
              <Icon name="clock" size={18} /> {course.duration}
            </li>
            <li>
              <Icon name="quiz" size={18} /> Тест · {course.quizCount} вопроса
            </li>
            <li>
              <Icon name="sparkle" size={18} /> {course.level}
            </li>
            <li>
              <Icon name="tag" size={18} /> {course.price ? (course.hasAccess ? 'Куплен' : formatPrice(course.price)) : 'Бесплатно'}
            </li>
          </ul>

          {locked && (
            <div className="price-box">
              <div>
                <strong>{formatPrice(course.price)}</strong>
                <span>Разовая оплата · доступ навсегда · первый урок бесплатно</span>
              </div>
            </div>
          )}

          {status !== 'new' && (
            <ProgressBar value={progress.percent} label={`Пройдено ${progress.done} из ${progress.total} уроков`} showValue />
          )}
          {status === 'completed' && (
            <span className="badge badge--success">
              <Icon name="trophy" size={16} /> Курс пройден · тест {quiz.score}/{quiz.total}
            </span>
          )}
          <div className="course-hero__actions">
            {locked ? (
              <>
                <Button size="lg" onClick={() => buyCourse(course)}>
                  Купить за {formatPrice(course.price)}
                </Button>
                <Button size="lg" variant="outline" to={`/courses/${course.id}/lessons/${course.lessons[0].id}`}>
                  Пробный урок
                </Button>
              </>
            ) : (
              <Button size="lg" to={startTo}>
                {startLabel} <Icon name="arrowRight" size={18} />
              </Button>
            )}
            <Button
              size="lg"
              variant={saved ? 'soft' : 'outline'}
              onClick={() => toggleSaved(course.id)}
              aria-pressed={saved}
              aria-label={saved ? 'Убрать из избранного' : 'Сохранить в избранное'}
            >
              <Icon name={saved ? 'bookmarkFilled' : 'bookmark'} size={18} />
              {saved ? 'Сохранено' : 'Сохранить'}
            </Button>
          </div>
          {saved && <p className="hint">Курс добавлен в «Моё обучение → Избранное».</p>}
        </div>
      </section>

      <div className="course-layout">
        <section className="card">
          <h2>Программа курса</h2>
          <div className="lesson-list">
            {course.lessons.map((l, i) => (
              <LessonListItem
                key={l.id}
                index={i + 1}
                title={l.title}
                type={l.type}
                minutes={l.minutes}
                to={`/courses/${course.id}/lessons/${l.id}`}
                done={isLessonDone(course.id, l.id)}
                locked={l.locked}
                preview={l.preview && locked}
                active={l.id === lastId && !isLessonDone(course.id, l.id)}
              />
            ))}
            <LessonListItem
              title="Итоговый тест"
              type="quiz"
              meta={
                locked
                  ? 'Доступен после покупки'
                  : quiz
                    ? `Лучший результат: ${quiz.score} из ${quiz.total}`
                    : `${course.quizCount} вопроса · проходной балл 70%`
              }
              to={`/courses/${course.id}/quiz`}
              done={!!quiz?.passed}
              locked={locked}
            />
          </div>
        </section>

        <aside className="stack">
          <section className="card">
            <h2>О курсе</h2>
            <p>{course.description}</p>
          </section>
          <section className="card">
            <h2>Чему научитесь</h2>
            <ul className="check-list">
              {course.outcomes.map((o) => (
                <li key={o}>
                  <Icon name="check" size={18} /> {o}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function Course() {
  const { courseId } = useParams();
  const { accessKey } = useAuth();
  const course = useAsync(() => getCourse(courseId), [courseId, accessKey]);
  return (
    <AsyncView state={course} label="Загружаем курс…">
      {(data) => <CourseView course={data} />}
    </AsyncView>
  );
}
