import { useCallback, useEffect, useRef, useState } from 'react';
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
export function Practice({ exercise, onSolved, sessionToken }) {
  const { ready, loading: progressLoading, pending } = useProgress();
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const requestInFlight = useRef(false);

  async function check() {
    if (!selected || sending || result || requestInFlight.current || !ready || progressLoading || pending) return;
    requestInFlight.current = true;
    setSending(true);
    setError('');
    try {
      const res = await submitAttempt(exercise.id, selected, sessionToken);
      setResult(res);
      if (res.correct) onSolved?.();
    } catch (ex) {
      setError(ex.message || 'Не удалось проверить ответ. Попробуйте еще раз.');
    } finally {
      requestInFlight.current = false;
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
      {error && <div className="feedback feedback--error" role="alert">{error}</div>}
      <div className="practice__actions">
        {!result && (
          <Button onClick={check} disabled={!selected || sending || !ready || progressLoading || pending}>
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

function LessonView({ course, lesson, sessionKey, sessionToken }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('summary');
  const { ready, loading: progressLoading, pending, completeLesson, visitLesson, isLessonDone, getCourseProgress } = useProgress();
  const [visitError, setVisitError] = useState('');
  const [finishError, setFinishError] = useState('');
  const [visiting, setVisiting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const visitInFlight = useRef(false);
  const finishInFlight = useRef(false);
  const autoVisited = useRef(new Set());
  const done = isLessonDone(course.id, lesson.id);
  const progress = getCourseProgress(course);

  const recordVisit = useCallback(async () => {
    if (!ready || progressLoading || lesson.locked || visitInFlight.current) return;
    visitInFlight.current = true;
    setVisiting(true);
    setVisitError('');
    try {
      await visitLesson(course.id, lesson.id);
    } catch (error) {
      setVisitError(error.message || 'Не удалось сохранить открытый урок. Попробуйте еще раз.');
    } finally {
      visitInFlight.current = false;
      setVisiting(false);
    }
  }, [ready, progressLoading, lesson.locked, lesson.id, visitLesson, course.id]);

  useEffect(() => {
    setTab('summary');
  }, [course.id, lesson.id]);

  useEffect(() => {
    if (lesson.locked || !ready || progressLoading) return;
    const key = `${sessionKey}:${course.id}:${lesson.id}`;
    if (autoVisited.current.has(key)) return;
    autoVisited.current.add(key);
    void recordVisit();
  }, [lesson.locked, ready, progressLoading, sessionKey, course.id, lesson.id, recordVisit]);

  async function finish() {
    if (!ready || progressLoading || pending || finishing || finishInFlight.current) return;
    finishInFlight.current = true;
    setFinishing(true);
    setFinishError('');
    try {
      await completeLesson(course.id, lesson.id);
      navigate(lesson.nextId ? `/courses/${course.id}/lessons/${lesson.nextId}` : `/courses/${course.id}/quiz`);
    } catch (error) {
      setFinishError(error.message || 'Не удалось сохранить прогресс. Попробуйте еще раз.');
    } finally {
      finishInFlight.current = false;
      setFinishing(false);
    }
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
        {visitError && (
          <div className="feedback feedback--error" role="alert">
            <span>{visitError}</span>
            <Button variant="outline" onClick={() => void recordVisit()} disabled={visiting || pending}>
              Повторить
            </Button>
          </div>
        )}

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
            <Practice key={lesson.practice.id} exercise={lesson.practice} sessionToken={sessionToken} />
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
          <Button onClick={finish} disabled={!ready || progressLoading || pending || finishing}>
            {finishing ? 'Сохраняем...' : finishError ? 'Повторить сохранение' : lesson.nextId ? (done ? 'Следующий урок' : 'Урок пройден, дальше') : 'Перейти к тесту'}
            <Icon name="arrowRight" size={18} />
          </Button>
          )}
        </nav>
        {finishError && <p className="feedback feedback--error" role="alert">{finishError}</p>}
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
  const { accessKey, sessionKey, sessionToken } = useAuth();
  return (
    <LessonData
      key={`${course.id}:${lessonId}:${sessionKey}:${accessKey}`}
      course={course}
      lessonId={lessonId}
      sessionKey={sessionKey}
      sessionToken={sessionToken}
    />
  );
}

function LessonData({ course, lessonId, sessionKey, sessionToken }) {
  const lesson = useAsync(() => getLesson(course.id, lessonId, sessionToken), [course.id, lessonId, sessionToken]);
  return (
    <AsyncView state={lesson} label="Открываем урок...">
      {(data) => (data.id === lessonId ? <LessonView course={course} lesson={data} sessionKey={sessionKey} sessionToken={sessionToken} /> : <Loader label="Открываем урок..." />)}
    </AsyncView>
  );
}
