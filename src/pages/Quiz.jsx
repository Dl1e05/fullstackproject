import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Button from '../components/Button.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import QuizOption from '../components/QuizOption.jsx';
import Icon from '../components/Icon.jsx';
import { AsyncView } from '../components/Loader.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { PASS_THRESHOLD, useProgress } from '../hooks/useProgress.jsx';
import { getQuiz, submitAttempt } from '../services/api.js';
import Paywall from '../components/Paywall.jsx';

function Result({ course, score, total, onRetry }) {
  const passed = score / total >= PASS_THRESHOLD;
  const percent = Math.round((score / total) * 100);
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
          ? `Вы ответили правильно на ${score} из ${total} вопросов. Отличный результат — курс «${course.title}» завершён.`
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

function QuizRunner({ course, questions }) {
  const { saveQuizResult } = useProgress();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [check, setCheck] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sending, setSending] = useState(false);

  const q = questions[step];
  const isLast = step === questions.length - 1;

  async function submit() {
    setSending(true);
    try {
      const res = await submitAttempt(q.id, selected);
      setCheck(res);
      if (res.correct) setScore((s) => s + 1);
    } finally {
      setSending(false);
    }
  }

  function next() {
    if (isLast) {
      saveQuizResult(course.id, score, questions.length);
      setFinished(true);
      return;
    }
    setStep((s) => s + 1);
    setSelected(null);
    setCheck(null);
  }

  function restart() {
    setStep(0);
    setSelected(null);
    setCheck(null);
    setScore(0);
    setFinished(false);
  }

  if (finished) return <Result course={course} score={score} total={questions.length} onRetry={restart} />;

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
      <h1 className="quiz__question">{q.question}</h1>
      <div className="quiz-options">
        {q.options.map((o) => (
          <QuizOption
            key={o.id}
            letter={o.id.toUpperCase()}
            state={optionState(o.id)}
            disabled={!!check || sending}
            onClick={() => setSelected(o.id)}
          >
            {o.text}
          </QuizOption>
        ))}
      </div>
      {check && (
        <div className={`feedback ${check.correct ? 'feedback--ok' : 'feedback--error'}`} role="status">
          <strong>{check.correct ? 'Верно!' : 'Ошибка'}</strong>
          <span>{check.explanation}</span>
        </div>
      )}
      <div className="quiz__actions">
        {!check ? (
          <Button size="lg" onClick={submit} disabled={!selected || sending}>
            {sending ? 'Проверяем…' : 'Ответить'}
          </Button>
        ) : (
          <Button size="lg" onClick={next}>
            {isLast ? 'Посмотреть результат' : 'Следующий вопрос'} <Icon name="arrowRight" size={18} />
          </Button>
        )}
      </div>
    </div>
  );
}

function LockedQuiz({ course }) {
  return (
    <div className="container page quiz-page">
      <div className="card">
        <Paywall course={course} title="Итоговый тест доступен после покупки курса" previewTo={`/courses/${course.id}/lessons/${course.lessons[0].id}`} />
      </div>
    </div>
  );
}

export default function Quiz() {
  const { course } = useOutletContext();
  if (!course.hasAccess) return <LockedQuiz course={course} />;
  return <OpenQuiz course={course} />;
}

function OpenQuiz({ course }) {
  const quiz = useAsync(() => getQuiz(course.id), [course.id]);
  return (
    <div className="container page quiz-page">
      <AsyncView state={quiz} label="Готовим вопросы…">
        {(questions) => <QuizRunner course={course} questions={questions} />}
      </AsyncView>
    </div>
  );
}
