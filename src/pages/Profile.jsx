import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import InstallBanner from '../components/InstallBanner.jsx';
import { useProgress } from '../hooks/useProgress.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { useAsync } from '../hooks/useAsync.js';
import { formatPrice, getCourses } from '../services/api.js';
import { validateName } from '../utils/validation.js';

function AccountForm({ user, updateName }) {
  const [name, setName] = useState(user.name);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | saving | saved

  useEffect(() => setName(user.name), [user.name]);

  useEffect(() => {
    if (status !== 'saved') return undefined;
    const t = setTimeout(() => setStatus('idle'), 2500);
    return () => clearTimeout(t);
  }, [status]);

  async function submit(e) {
    e.preventDefault();
    const err = validateName(name);
    if (err) {
      setError(err);
      return;
    }
    setStatus('saving');
    try {
      await updateName(name);
      setStatus('saved');
    } catch (ex) {
      setError(ex.message);
      setStatus('idle');
    }
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <h2>Личные данные</h2>
      <label className={`field ${error ? 'field--error' : ''}`}>
        <span>Имя</span>
        <span className="field__control">
          <input
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            autoComplete="given-name"
            aria-invalid={!!error}
          />
        </span>
        {error && (
          <span className="field__error" role="alert">
            {error}
          </span>
        )}
      </label>
      <label className="field">
        <span>Электронная почта</span>
        <span className="field__control">
          <input value={user.email} readOnly disabled />
        </span>
        <span className="field__hint">Почту пока нельзя изменить</span>
      </label>
      <div className="form__actions">
        <Button type="submit" disabled={name.trim() === user.name || status === 'saving'}>
          {status === 'saving' ? 'Сохраняем…' : 'Сохранить'}
        </Button>
        {status === 'saved' && (
          <span className="badge badge--success" role="status">
            <Icon name="check" size={14} /> Изменения сохранены
          </span>
        )}
      </div>
    </form>
  );
}

function Purchases({ user }) {
  const courses = useAsync(() => getCourses({ price: 'paid' }), []);
  const owned = courses.data?.filter((c) => user.purchases.includes(c.id)) ?? [];
  return (
    <section className="card stack">
      <h2>Мои покупки</h2>
      {owned.length ? (
        <ul className="purchases">
          {owned.map((c) => (
            <li key={c.id}>
              <Link to={`/courses/${c.id}`}>{c.title}</Link>
              <span className="muted">{formatPrice(c.price)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Вы ещё не покупали курсы. <Link to="/catalog?price=paid">Посмотреть премиум-курсы</Link>
        </p>
      )}
    </section>
  );
}

export default function Profile() {
  const { stats, resetAll } = useProgress();
  const { user, ready, openAuth, logout, updateName } = useAuth();
  const { isStandalone } = useInstallPrompt();

  function reset() {
    if (window.confirm('Сбросить весь прогресс и избранное на этом устройстве?')) resetAll();
  }

  return (
    <div className="container page profile">
      <section className="card profile__head">
        <span className="avatar avatar--lg">{user ? user.name[0].toUpperCase() : <Icon name="user" size={32} />}</span>
        <div className="profile__who">
          <h1>{user ? user.name : 'Гость'}</h1>
          <p className="muted">{user ? user.email : 'Войдите, чтобы покупать курсы и сохранить аккаунт'}</p>
        </div>
        {ready &&
          (user ? (
            <Button variant="outline" onClick={logout}>
              <Icon name="logout" size={18} /> Выйти
            </Button>
          ) : (
            <div className="profile__auth">
              <Button onClick={() => openAuth({ mode: 'login' })}>Войти</Button>
              <Button variant="outline" onClick={() => openAuth({ mode: 'register' })}>
                Регистрация
              </Button>
            </div>
          ))}
      </section>

      <section className="stats">
        <div className="stat card">
          <strong>{stats.lessonsDone}</strong>
          <span>уроков пройдено</span>
        </div>
        <div className="stat card">
          <strong>{stats.coursesDone}</strong>
          <span>курсов завершено</span>
        </div>
        <div className="stat card">
          <strong>{stats.saved}</strong>
          <span>в избранном</span>
        </div>
      </section>

      <div className="profile__grid">
        {user ? (
          <div className="stack">
            <AccountForm user={user} updateName={updateName} />
            <Purchases user={user} />
          </div>
        ) : (
          <section className="card stack">
            <h2>Аккаунт</h2>
            <p className="muted">
              Бесплатные курсы доступны без регистрации. Аккаунт нужен, чтобы покупать премиум-курсы — они сохранятся за
              вами.
            </p>
            <Button onClick={() => openAuth({ mode: 'register' })}>Создать аккаунт</Button>
          </section>
        )}

        <section className="card stack">
          <h2>Приложение</h2>
          {isStandalone ? (
            <p className="muted">
              <Icon name="check" size={16} /> «Шаг» установлен на это устройство.
            </p>
          ) : (
            <>
              <InstallBanner force />
              <p className="muted">
                Если кнопки установки нет, откройте меню браузера и выберите «Установить приложение» или «На экран
                “Домой”».
              </p>
            </>
          )}
          <hr />
          <h2>Данные</h2>
          <p className="muted">Прогресс, избранное и результаты тестов сохраняются в браузере.</p>
          <Button variant="outline" onClick={reset} className="btn--danger">
            Сбросить прогресс
          </Button>
        </section>
      </div>
    </div>
  );
}
