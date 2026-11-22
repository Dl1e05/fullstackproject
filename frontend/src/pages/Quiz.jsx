import { useCallback, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Button from '../components/Button.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import QuizOption from '../components/QuizOption.jsx';
import Icon from '../components/Icon.jsx';
import { AsyncView } from '../components/Loader.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { PASS_THRESHOLD, useProgress } from '../hooks/useProgress.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { getQuiz, getQuizAttempts, submitAttempt } from '../services/api.js';
import Paywall from '../components/Paywall.jsx';

const HISTORY_LIMIT = 20;

function createClientAttemptId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('Для отправки результата нужна поддержка безопасных случайных чисел.');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function Result({ course, result, onRetry }) {
  const { score, total, passed } = result;
  const percent = total ? Math.round((score / total) * 100) : 0;
  return (
    <div className={`card result ${passed ? 'result--ok' : 'result--fail'}`}>
      <div className="result__ring" style={{ '--p': percent }}>
        <span>
          {score}/{total}
        </span>
      </div>
      <h1>{passed ? 'Курс пройден!' : 'Почти получилось'}</h1>
      <p className="lead">
        {passed
          ? `Вы ответили правильно на ${score} из ${total} вопросов. Отличный результат - курс "${course.title}" завершён.`
          : `Правильных ответов: ${score} из ${total}. Для прохождения нужно ${Math.ceil(total * PASS_THRESHOLD)}. Повторите уроки и попробуйте ещё раз.`}
      </p>
      <div className="result__actions">
        {passed ? (
          <>
            <Button size="lg" to="/learning?tab=done">
              <Icon name="trophy" size={18} /> Моё обучение
            </Button>
            <Button size="lg" variant="outline" to="/catalog">
              Выбрать новый курс
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" onClick={onRetry}>
              <Icon name="refresh" size={18} /> Пройти ещё раз
            </Button>
            <Button size="lg" variant="outline" to={`/courses/${course.id}`}>
              Повторить уроки
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function QuizRunner({ course, questions, sessionToken, onAttemptSubmitted }) {
  const { submitQuiz, ready, loading: progressLoading, pending } = useProgress();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [check, setCheck] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionError, setQuestionError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [sendingAnswer, setSendingAnswer] = useState(false);
  const [sendingResult, setSendingResult] = useState(false);
  const [result, setResult] = useState(null);
  const clientAttemptId = useRef(null);
  if (!clientAttemptId.current) clientAttemptId.current = createClientAttemptId();
  const answerRequestInFlight = useRef(false);
  const finalAnswers = useRef(null);
  const finalRequestInFlight = useRef(false);

  const question = questions[step];
  const isLast = step === questions.length - 1;

  async function submitAnswer() {
    if (!selected || check || sendingAnswer || answerRequestInFlight.current || !ready || progressLoading || pending) return;
    answerRequestInFlight.current = true;
    setSendingAnswer(true);
    setQuestionError('');
    try {
      const response = await submitAttempt(question.id, selected, sessionToken);
      setCheck(response);
      setAnswers((current) => ({ ...current, [question.id]: selected }));
    } catch (error) {
      setQuestionError(error.message || 'Не удалось проверить ответ. Попробуйте еще раз.');
    } finally {
      answerRequestInFlight.current = false;
      setSendingAnswer(false);
    }
  }

  async function submitResult() {
    if (finalRequestInFlight.current || result || !ready || progressLoading || pending) return;
    if (!finalAnswers.current) {
      const answersForRequest = questions.map((item) => ({ exerciseId: item.id, optionId: answers[item.id] }));
      if (answersForRequest.some((answer) => !answer.optionId)) {
        setSubmitError('Ответьте на каждый вопрос перед отправкой результата.');
        return;
      }
      finalAnswers.current = answersForRequest;
    }

    finalRequestInFlight.current = true;
    setSendingResult(true);
    setSubmitError('');
    try {
      const response = await submitQuiz(course.id, finalAnswers.current, clientAttemptId.current);
      setResult(response);
      onAttemptSubmitted?.();
    } catch (error) {
      setSubmitError(error.message || 'Не удалось отправить результат. Попробуйте еще раз.');
    } finally {
      finalRequestInFlight.current = false;
      setSendingResult(false);
    }
  }

  function next() {
    if (!check || sendingResult) return;
    if (isLast) {
      void submitResult();
      return;
    }
    setStep((current) => current + 1);
    setSelected(null);
    setCheck(null);
    setQuestionError('');
  }

  function restart() {
    setStep(0);
    setSelected(null);
    setCheck(null);
    setAnswers({});
    setQuestionError('');
    setSubmitError('');
    setResult(null);
    finalAnswers.current = null;
    clientAttemptId.current = createClientAttemptId();
  }

  if (result) return <Result course={course} result={result} onRetry={restart} />;

  function optionState(id) {
    if (check) {
      if (id === check.correctId) return 'correct';
      if (id === selected) return 'wrong';
      return 'default';
    }
    return id === selected ? 'selected' : 'default';
  }

  return (
    <div className="card quiz">
      <div className="quiz__head">
        <span className="eyebrow">Итоговый тест</span>
        <span className="muted">
          Вопрос {step + 1} из {questions.length}
        </span>
      </div>
      <ProgressBar value={((step + (check ? 1 : 0)) / questions.length) * 100} size="sm" />
      <h1 className="quiz__question">{question.question}</h1>
      <div className="quiz-options">
        {question.options.map((option) => (
          <QuizOption
            key={option.id}
            letter={option.id.toUpperCase()}
            state={optionState(option.id)}
            disabled={!!check || sendingAnswer || sendingResult || !ready || progressLoading || pending}
            onClick={() => setSelected(option.id)}
          >
            {option.text}
          </QuizOption>
        ))}
      </div>
      {check && (
        <div className={`feedback ${check.correct ? 'feedback--ok' : 'feedback--error'}`} role="status">
          <strong>{check.correct ? 'Верно!' : 'Ошибка'}</strong>
          <span>{check.explanation}</span>
        </div>
      )}
      {questionError && <div className="feedback feedback--error" role="alert">{questionError}</div>}
      {submitError && <div className="feedback feedback--error" role="alert">{submitError}</div>}
      <div className="quiz__actions">
        {!check ? (
          <Button size="lg" onClick={submitAnswer} disabled={!selected || sendingAnswer || !ready || progressLoading || pending}>
            {sendingAnswer ? 'Проверяем...' : 'Ответить'}
          </Button>
        ) : (
          <Button size="lg" onClick={next} disabled={sendingResult || !ready || progressLoading || pending} aria-busy={sendingResult}>
            {sendingResult ? 'Отправляем результат...' : submitError && isLast ? 'Повторить отправку' : isLast ? 'Завершить тест' : 'Следующий вопрос'}
            {!sendingResult && <Icon name="arrowRight" size={18} />}
          </Button>
        )}
      </div>
    </div>
  );
}

function QuizHistory({ courseId, sessionKey, sessionToken, user, offset, setOffset, refreshVersion, onRefresh }) {
  const history = useAsync(
    () => user ? getQuizAttempts(courseId, { limit: HISTORY_LIMIT, offset }, sessionToken) : Promise.resolve(null),
    [courseId, sessionKey, sessionToken, user?.id, offset, refreshVersion],
  );

  if (!user) return null;

  if (history.loading && !history.data) {
    return (
      <section className="card quiz-history" aria-live="polite">
        <h2>История попыток</h2>
        <p className="muted">Загружаем историю...</p>
      </section>
    );
  }

  if (history.error) {
    return (
      <section className="card quiz-history">
        <h2>История попыток</h2>
        <div className="feedback feedback--error" role="alert">
          <span>Не удалось загрузить историю попыток.</span>
          <Button variant="outline" size="sm" onClick={history.reload}>Повторить</Button>
        </div>
      </section>
    );
  }

  const data = history.data;
  if (!data) return null;
  if (data.offset !== offset) {
    return (
      <section className="card quiz-history" aria-live="polite">
        <h2>История попыток</h2>
        <p className="muted">Загружаем историю...</p>
      </section>
    );
  }
  const page = Math.floor(offset / HISTORY_LIMIT) + 1;
  const pages = Math.max(1, Math.ceil(data.total / HISTORY_LIMIT));
  const refresh = () => {
    setOffset(0);
    onRefresh();
  };

  return (
    <section className="card quiz-history" aria-busy={history.loading}>
      <div className="quiz-history__head">
        <div>
          <h2>История попыток</h2>
          <p className="muted">{data.total ? `Всего попыток: ${data.total}` : 'Попыток пока нет.'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={history.loading}>Обновить</Button>
      </div>
      {history.loading && <p className="muted" role="status">Обновляем историю...</p>}
      {data.items.length > 0 && (
        <>
          <ol className="quiz-history__list">
            {data.items.map((attempt) => (
              <li key={attempt.id}>
                <span>{new Date(attempt.date).toLocaleString()}</span>
                <strong>{attempt.score}/{attempt.total}</strong>
                <span className={attempt.passed ? 'quiz-history__passed' : 'quiz-history__failed'}>
                  {attempt.passed ? 'Пройден' : 'Не пройден'}
                </span>
              </li>
            ))}
          </ol>
          <div className="quiz-history__pagination">
            <Button variant="outline" size="sm" onClick={() => setOffset((value) => Math.max(0, value - HISTORY_LIMIT))} disabled={offset === 0 || history.loading}>
              Назад
            </Button>
            <span className="muted">Страница {page} из {pages}</span>
            <Button variant="outline" size="sm" onClick={() => setOffset((value) => value + HISTORY_LIMIT)} disabled={offset + HISTORY_LIMIT >= data.total || history.loading}>
              Дальше
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function LockedQuiz({ course }) {
  const firstLesson = course.lessons?.[0];
  return (
    <div className="container page quiz-page">
      <div className="card">
        <Paywall
          course={course}
          title="Итоговый тест доступен после покупки курса"
          previewTo={firstLesson ? `/courses/${course.id}/lessons/${firstLesson.id}` : undefined}
        />
      </div>
    </div>
  );
}

export default function Quiz() {
  const { course } = useOutletContext();
  const { user, accessKey, sessionKey, sessionToken } = useAuth();
  if (!course.hasAccess) return <LockedQuiz course={course} />;
  return <OpenQuiz key={`${course.id}:${sessionKey}:${accessKey}`} course={course} user={user} sessionKey={sessionKey} sessionToken={sessionToken} />;
}

function OpenQuiz({ course, user, sessionKey, sessionToken }) {
  const quiz = useAsync(() => getQuiz(course.id, sessionToken), [course.id, sessionToken]);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const refreshHistory = useCallback(() => {
    setHistoryOffset(0);
    setHistoryRefresh((value) => value + 1);
  }, []);

  return (
    <div className="container page quiz-page">
      <AsyncView state={quiz} label="Готовим вопросы...">
        {(questions) =>
          !questions?.length ? (
            <EmptyState icon="quiz" title="В этом курсе пока нет вопросов" text="Попробуйте открыть этот курс позже." />
          ) : (
            <>
              <QuizRunner
                key={`${course.id}:${sessionKey}:${questions.map((question) => question.id).join(',')}`}
                course={course}
                questions={questions}
                sessionToken={sessionToken}
                onAttemptSubmitted={refreshHistory}
              />
              <QuizHistory
                courseId={course.id}
                sessionKey={sessionKey}
                sessionToken={sessionToken}
                user={user}
                offset={historyOffset}
                setOffset={setHistoryOffset}
                refreshVersion={historyRefresh}
                onRefresh={refreshHistory}
              />
            </>
          )
        }
      </AsyncView>
    </div>
  );
}
