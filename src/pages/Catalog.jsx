import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchInput from '../components/SearchInput.jsx';
import CourseCard from '../components/CourseCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';
import { Chip } from '../components/Tabs.jsx';
import { Loader, ErrorState } from '../components/Loader.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useProgress } from '../hooks/useProgress.jsx';
import { getCourses, getTopics } from '../services/api.js';

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const topic = params.get('topic') ?? '';
  const price = params.get('price') ?? '';
  const inputRef = useRef(null);
  const { getCourseStatus } = useProgress();

  const topics = useAsync(() => getTopics(), []);
  const courses = useAsync(() => getCourses({ q, topic, price }), [q, topic, price]);

  // /catalog?focus=1 — переход с иконки поиска в мобильной шапке
  useEffect(() => {
    if (params.get('focus')) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(next) {
    const p = new URLSearchParams(params);
    p.delete('focus');
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  }

  const reset = () => setParams({}, { replace: true });
  const hasFilters = q || topic || price;

  return (
    <div className="container page">
      <header className="page-head">
        <h1>Каталог курсов</h1>
        <p className="muted">Выберите тему или найдите курс по названию.</p>
      </header>

      <div className="catalog-filters">
        <SearchInput value={q} onChange={(v) => update({ q: v })} inputRef={inputRef} />
        <div className="chips" role="group" aria-label="Темы">
          <Chip active={!topic} onClick={() => update({ topic: '' })}>
            Все темы
          </Chip>
          {topics.data?.map((t) => (
            <Chip key={t.id} active={topic === t.id} color={t.color} onClick={() => update({ topic: topic === t.id ? '' : t.id })}>
              {t.title}
            </Chip>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Стоимость">
          <Chip active={!price} onClick={() => update({ price: '' })}>
            Любая цена
          </Chip>
          <Chip active={price === 'free'} onClick={() => update({ price: price === 'free' ? '' : 'free' })}>
            Бесплатные
          </Chip>
          <Chip active={price === 'paid'} onClick={() => update({ price: price === 'paid' ? '' : 'paid' })}>
            Платные · от $2
          </Chip>
        </div>
      </div>

      {courses.error ? (
        <ErrorState error={courses.error} onRetry={courses.reload} />
      ) : !courses.data ? (
        <Loader label="Ищем курсы…" />
      ) : courses.data.length === 0 ? (
        <EmptyState
          icon="search"
          title="Ничего не нашлось"
          text={q ? `По запросу «${q}» курсов пока нет. Попробуйте другое слово или сбросьте фильтры.` : 'В этой теме пока нет курсов.'}
        >
          <Button variant="outline" onClick={reset}>
            Сбросить фильтры
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="catalog-count muted" aria-live="polite">
            {hasFilters ? `Найдено курсов: ${courses.data.length}` : `Всего курсов: ${courses.data.length}`}
            {courses.loading && ' · обновляем…'}
          </div>
          <div className="grid-cards">
            {courses.data.map((c) => (
              <CourseCard key={c.id} course={c} showProgress={getCourseStatus(c.id) !== 'new'} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
