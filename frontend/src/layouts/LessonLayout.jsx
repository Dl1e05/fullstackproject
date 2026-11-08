import { Link, Outlet, ScrollRestoration, useParams } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import OfflineBanner from '../components/OfflineBanner.jsx';
import { AsyncView } from '../components/Loader.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { getCourse } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

// Упрощённая шапка для урока и теста: название курса и «Выйти из урока», без футера и таб-бара.
// Курс загружается один раз и передаётся страницам через Outlet context.
export default function LessonLayout() {
  const { courseId } = useParams();
  const { accessKey } = useAuth();
  const course = useAsync(() => getCourse(courseId), [courseId, accessKey]);

  return (
    <div className="layout layout--lesson">
      <header className="lesson-header">
        <div className="container lesson-header__inner">
          <Logo />
          <span className="lesson-header__course">{course.data?.title ?? ''}</span>
          <Link to={`/courses/${courseId}`} className="btn btn--outline btn--sm lesson-header__exit">
            <Icon name="logout" size={18} />
            <span>Выйти из урока</span>
          </Link>
        </div>
      </header>
      <OfflineBanner />
      <main className="layout__content">
        <AsyncView state={course} label="Открываем курс…">
          {(data) => <Outlet context={{ course: data }} />}
        </AsyncView>
      </main>
      <ScrollRestoration />
    </div>
  );
}
