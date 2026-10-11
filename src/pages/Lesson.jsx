import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import InfoBox from '../components/InfoBox.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import LessonListItem from '../components/LessonListItem.jsx';
import QuizOption from '../components/QuizOption.jsx';
import Icon from '../components/Icon.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { AsyncView, Loader } from '../components/Loader.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useProgress } from '../hooks/useProgress.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import Paywall from '../components/Paywall.jsx';
import { getLesson, submitAttempt } from '../services/api.js';

const TABS = [
  { id: 'summary', label: 'Кратко' },
  { id: 'practice', label: 'Практика' },
];

// Задание к уроку: выбрать ответ → «Проверить» → верно/ошибка и пояснение
export function Practice({ exercise, onSolved }) {
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  async function check() {
    setSending(true);
    try {
      const res = await submitAttempt(exercise.id, selected);
      setResult(res);
      if (res.correct) onSolved?.();
    } finally {
      setSending(false);
    }
  }

  function retry() {
    setSelected(null);
    setResult(null);
  }

  function optionState(id) {
    if (result) {
      if (id === result.correctId) return 'correct';
      if (id === selected) return 'wrong';
      return 'default';
    }
    return id === selected ? 'selected' : 'default';
  }

  return (
    <div className="practice">
      <h3 className="practice__question">{exercise.question}</h3>
      <div className="quiz-options">
        {exercise.options.map((o) => (
          <QuizOption
            key={o.id}
            letter={o.id.toUpperCase()}
            state={optionState(o.id)}
            disabled={!!result || sending}
            onClick={() => setSelected(o.id)}
          >
            {o.text}
          </QuizOption>
        ))}
      </div>
      {result && (
        <div className={`feedback ${result.correct ? 'feedback--ok' : 'feedback--error'}`} role="status">
          <strong>{result.correct ? 'Верно!' : 'Не совсем так'}</strong>
          <span>{result.explanation}</span>
        </div>
      )}
      <div className="practice__actions">
        {!result && (
          <Button onClick={check} disabled={!selected || sending}>
            {sending ? 'Проверяем…' : 'Проверить'}
          </Button>
        )}
        {result && !result.correct && (
          <Button variant="outline" onClick={retry}>
            <Icon name="refresh" size={18} /> Попробовать ещё раз
          </Button>
        )}
      </div>
    </div>
  );
}

function LessonView({ course, lesson }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('summary');
  const { completeLesson, visitLesson, isLessonDone, getCourseProgress } = useProgress();
  const done = isLessonDone(course.id, lesson.id);
  const progress = getCourseProgress(course);

  useEffect(() => {
    if (!lesson.locked) visitLesson(course.id, lesson.id);
    setTab('summary');
  }, [course.id, lesson.id, lesson.locked, visitLesson]);

  function finish() {
    completeLesson(course.id, lesson.id);
    navigate(lesson.nextId ? `/courses/${course.id}/lessons/${lesson.nextId}` : `/courses/${course.id}/quiz`);
  }

  return (
    <div className="container page lesson-page">
      <article className="lesson-main">
        <div className="lesson-main__head">
          <span className="eyebrow">
            Урок {lesson.index + 1} из {lesson.total}
          </span>
          <h1>{lesson.title}</h1>
          <div className="meta-list">
            <span>
              <Icon name={lesson.type === 'video' ? 'play' : 'text'} size={16} /> {lesson.type === 'video' ? 'Видео' : 'Текст'}
            </span>
            <span>
              <Icon name="clock" size={16} /> {lesson.minutes} мин
            </span>
            {done && (
              <span className="badge badge--success">
                <Icon name="check" size={14} /> Пройден
              </span>
            )}
          </div>
        </div>

        {lesson.locked ? (
          <div className="card">
            <Paywall course={course} previewTo={`/courses/${course.id}/lessons/${course.lessons[0].id}`} />
          </div>
        ) : (
          <>
        <Tabs items={TABS} value={tab} onChange={setTab} label="Разделы урока" />

        <div className="card lesson-body">
          {tab === 'summary' ? (
            <>
              {lesson.type === 'video' && (
                <div className="video-placeholder">
                  <span className="video-placeholder__play">
                    <Icon name="play" size={28} />
                  </span>
                  <span>Видео урока · {lesson.minutes} мин</span>
                </div>
              )}
              <div className="prose">
                {lesson.summary.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <InfoBox items={lesson.keyPoints} />
              {lesson.practice && (
                <Button variant="outline" onClick={() => setTab('practice')}>
                  Перейти к практике <Icon name="arrowRight" size={18} />
                </Button>
              )}
            </>
          ) : lesson.practice ? (
            <Practice key={lesson.practice.id} exercise={lesson.practice} />
          ) : (
            <p className="muted">Для этого урока нет практического задания.</p>
          )}
        </div>
          </>
        )}

        <nav className="lesson-nav">
          <Button
            variant="ghost"
            to={lesson.prevId ? `/courses/${course.id}/lessons/${lesson.prevId}` : `/courses/${course.id}`}
          >
            <Icon name="arrowLeft" size={18} /> {lesson.prevId ? 'Предыдущий' : 'К курсу'}
          </Button>
          {!lesson.locked && (
          <Button onClick={finish}>
            {lesson.nextId ? (done ? 'Следующий урок' : 'Урок пройден, дальше') : 'Перейти к тесту'}
            <Icon name="arrowRight" size={18} />
          </Button>
          )}
        </nav>
      </article>

      <aside className="lesson-aside card">
        <h2>{course.title}</h2>
        <ProgressBar value={progress.percent} label={`${progress.done} из ${progress.total} уроков`} showValue size="sm" />
        <div className="lesson-list lesson-list--compact">
          {course.lessons.map((l, i) => (
            <LessonListItem
              key={l.id}
              compact
              index={i + 1}
              title={l.title}
              type={l.type}
              minutes={l.minutes}
              to={`/courses/${course.id}/lessons/${l.id}`}
              active={l.id === lesson.id}
              done={isLessonDone(course.id, l.id)}
              locked={l.locked}
            />
          ))}
          <LessonListItem
            compact
            title="Итоговый тест"
            type="quiz"
            meta={course.hasAccess ? 'Проверьте знания' : 'После покупки'}
            locked={!course.hasAccess}
            to={`/courses/${course.id}/quiz`}
          />
        </div>
      </aside>
    </div>
  );
}

export default function Lesson() {
  const { course } = useOutletContext();
  const { lessonId } = useParams();
  const { accessKey } = useAuth();
  const lesson = useAsync(() => getLesson(course.id, lessonId), [course.id, lessonId, accessKey]);
  return (
    <AsyncView state={lesson} label="Открываем урок…">
      {(data) => (data.id === lessonId ? <LessonView course={course} lesson={data} /> : <Loader label="Открываем урок…" />)}
    </AsyncView>
  );
}
