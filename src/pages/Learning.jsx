import { useSearchParams } from 'react-router-dom';
import CourseCard from '../components/CourseCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';
import { Tabs } from '../components/Tabs.jsx';
import { AsyncView } from '../components/Loader.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useProgress } from '../hooks/useProgress.jsx';
import { getCourses } from '../services/api.js';

const EMPTY = {
  progress: {
    icon: 'book',
    title: 'Вы ещё не начали ни одного курса',
    text: 'Выберите курс в каталоге — первый урок займёт всего 5 минут.',
  },
  saved: {
    icon: 'bookmark',
    title: 'В избранном пока пусто',
    text: 'Нажмите «Сохранить» на странице курса, чтобы вернуться к нему позже.',
  },
  done: {
    icon: 'trophy',
    title: 'Завершённых курсов пока нет',
    text: 'Пройдите все уроки и итоговый тест — курс появится здесь.',
  },
};

export default function Learning() {
  const [params, setParams] = useSearchParams();
  const tab = EMPTY[params.get('tab')] ? params.get('tab') : 'progress';
  const courses = useAsync(() => getCourses(), []);
  const { getCourseStatus, isSaved } = useProgress();

  return (
    <div className="container page">
      <header className="page-head">
        <h1>Моё обучение</h1>
        <p className="muted">Курсы, которые вы проходите, сохранили и завершили.</p>
      </header>

      <AsyncView state={courses} label="Загружаем ваши курсы…">
        {(list) => {
          const groups = {
            progress: list.filter((c) => getCourseStatus(c.id) === 'in-progress'),
            saved: list.filter((c) => isSaved(c.id)),
            done: list.filter((c) => getCourseStatus(c.id) === 'completed'),
          };
          const items = groups[tab];
          return (
            <>
              <Tabs
                label="Разделы обучения"
                value={tab}
                onChange={(id) => setParams(id === 'progress' ? {} : { tab: id }, { replace: true })}
                items={[
                  { id: 'progress', label: 'В процессе', count: groups.progress.length },
                  { id: 'saved', label: 'Избранное', count: groups.saved.length },
                  { id: 'done', label: 'Завершённые', count: groups.done.length },
                ]}
              />
              {items.length ? (
                <div className="grid-cards">
                  {items.map((c) => (
                    <CourseCard key={c.id} course={c} showProgress />
                  ))}
                </div>
              ) : (
                <EmptyState {...EMPTY[tab]}>
                  <Button to="/catalog">Перейти в каталог</Button>
                </EmptyState>
              )}
            </>
          );
        }}
      </AsyncView>
    </div>
  );
}
