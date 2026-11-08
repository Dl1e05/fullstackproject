import { NavLink, Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

const links = [
  { to: '/', label: 'Главная', end: true },
  { to: '/catalog', label: 'Каталог' },
  { to: '/learning', label: 'Моё обучение' },
];

export default function Navbar() {
  const { user, ready, openAuth } = useAuth();

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Logo />

        {/* ПК: ссылки и кнопки */}
        <nav className="navbar__links" aria-label="Основное меню">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="navbar__link">
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="navbar__actions" style={ready ? undefined : { visibility: 'hidden' }}>
          {user ? (
            <Link to="/profile" className="navbar__user">
              <span className="avatar avatar--sm">{user.name[0].toUpperCase()}</span>
              {user.name}
            </Link>
          ) : (
            ready && (
              <Button variant="ghost" onClick={() => openAuth({ mode: 'login' })}>
                Войти
              </Button>
            )
          )}
          {user ? (
            <Button to="/catalog">Каталог курсов</Button>
          ) : (
            <Button onClick={() => openAuth({ mode: 'register' })}>Начать учиться</Button>
          )}
        </div>

        {/* Телефон: поиск и профиль, остальное — в нижнем таб-баре */}
        <div className="navbar__mobile">
          <Link to="/catalog?focus=1" className="icon-btn" aria-label="Поиск">
            <Icon name="search" size={22} />
          </Link>
          {user ? (
            <Link to="/profile" className="icon-btn" aria-label="Профиль">
              <span className="avatar avatar--sm">{user.name[0].toUpperCase()}</span>
            </Link>
          ) : (
            <button type="button" className="icon-btn" aria-label="Войти" onClick={() => openAuth({ mode: 'login' })}>
              <Icon name="user" size={22} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
