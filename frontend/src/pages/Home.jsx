import Button from '../components/Button.jsx';
import CourseCard from '../components/CourseCard.jsx';
import CourseCover from '../components/CourseCover.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import InstallBanner from '../components/InstallBanner.jsx';
import Icon from '../components/Icon.jsx';
import { AsyncView } from '../components/Loader.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useProgress } from '../hooks/useProgress.jsx';
import { getCourses } from '../services/api.js';

const steps = [
  { icon: 'grid', title: 'Выберите курс', text: 'Короткие курсы по 30–40 минут на понятные жизненные темы.' },
  { icon: 'book', title: 'Учитесь по шагу', text: 'Уроки по 5–8 минут: кратко о главном и практика сразу после.' },
  { icon: 'trophy', title: 'Проверьте себя', text: 'Итоговый тест покажет, что вы всё усвоили. Прогресс сохраняется.' },
];

function ContinueCard({ course }) {
  const { state, getCourseProgress } = useProgress();
  const progress = getCourseProgress(course);
  const lessonId = state.last[course.id]?.lessonId;
  return (
    <section className="continue card">
      <CourseCover topic={course.topic} size="sm" />
      <div className="continue__body">
        <span className="eyebrow">Продолжить обучение</span>
        <h3>{course.title}</h3>
        <ProgressBar value={progress.percent} label={`${progress.done} из ${progress.total} уроков`} showValue size="sm" />
      </div>
      <Button to={lessonId ? `/courses/${course.id}/lessons/${lessonId}` : `/courses/${course.id}`}>
        Продолжить <Icon name="arrowRight" size={18} />
      </Button>
    </section>
  );
}

export default function Home() {
  const courses = useAsync(() => getCourses(), []);
  const { state, getCourseStatus } = useProgress();

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__text">
            <span className="eyebrow">Онлайн-обучение без спешки</span>
            <h1>
              Учитесь новому <span className="accent">по шагу в день</span>
            </h1>
            <p className="lead">
              Короткие уроки по цифровой безопасности, Excel, английскому и другим полезным темам. Занимайтесь с
              компьютера или телефона — прогресс сохранится.
            </p>
            <div className="hero__actions">
              <Button size="lg" to="/catalog">
                Начать учиться
              </Button>
              <Button size="lg" variant="outline" to="/learning">
                Моё обучение
              </Button>
            </div>
            <ul className="hero__facts">
              <li>
                <Icon name="clock" size={18} /> Уроки по 5–8 минут
              </li>
              <li>
                <Icon name="check" size={18} /> Практика после каждого урока
              </li>
              <li>
                <Icon name="wifiOff" size={18} /> Работает офлайн
              </li>
            </ul>
          </div>
          <div className="hero__visual" aria-hidden="true">
            <div className="hero-card">
              <div className="hero-card__head">
                <span className="lesson-item__num">2</span>
                <div>
                  <strong>Менеджер паролей</strong>
                  <span>Текст · 5 мин</span>
                </div>
              </div>
              <div className="hero-card__line" />
              <div className="hero-card__line hero-card__line--short" />
              <div className="infobox infobox--mini">
                <div className="infobox__title">
                  <Icon name="sparkle" size={16} /> Запоминаем главное
                </div>
                <div className="hero-card__line" />
              </div>
              <ProgressBar value={40} label="2 из 5 уроков" showValue size="sm" />
            </div>
          </div>
        </div>
      </section>

      <div className="container stack-xl">
        <InstallBanner />

        <AsyncView state={courses} label="Загружаем курсы…">
          {(list) => {
            const inProgress = list
              .filter((c) => getCourseStatus(c.id) === 'in-progress')
              .sort((a, b) => (state.last[b.id]?.at ?? 0) - (state.last[a.id]?.at ?? 0));
            const popular = list.filter((c) => c.popular);
            const paid = list.filter((c) => c.price > 0);
            return (
              <>
                {inProgress[0] && <ContinueCard course={inProgress[0]} />}
                <section>
                  <div className="section-head">
                    <h2>Популярные курсы</h2>
                    <Button variant="ghost" to="/catalog">
                      Все курсы <Icon name="arrowRight" size={18} />
                    </Button>
                  </div>
                  <div className="grid-cards">
                    {popular.map((c) => (
                      <CourseCard key={c.id} course={c} showProgress={getCourseStatus(c.id) !== 'new'} />
                    ))}
                  </div>
                </section>
                <section>
                  <div className="section-head">
                    <div>
                      <h2>Премиум-курсы</h2>
                      <p className="muted">Самые востребованные темы за $2–3 · первый урок бесплатно</p>
                    </div>
                    <Button variant="ghost" to="/catalog?price=paid">
                      Все платные <Icon name="arrowRight" size={18} />
                    </Button>
                  </div>
                  <div className="grid-cards">
                    {paid.map((c) => (
                      <CourseCard key={c.id} course={c} showProgress={getCourseStatus(c.id) !== 'new'} />
                    ))}
                  </div>
                </section>
              </>
            );
          }}
        </AsyncView>

        <section>
          <div className="section-head">
            <h2>Как это работает</h2>
          </div>
          <div className="steps">
            {steps.map((s, i) => (
              <div key={s.title} className="step card">
                <span className="step__icon">
                  <Icon name={s.icon} size={24} />
                </span>
                <span className="step__num">Шаг {i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
