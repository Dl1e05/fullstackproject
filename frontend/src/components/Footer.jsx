import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Logo />
          <p>Короткие понятные курсы. Учитесь новому по шагу в день — в браузере или в приложении.</p>
        </div>
        <nav className="footer__col" aria-label="Платформа">
          <h4>Платформа</h4>
          <Link to="/">Главная</Link>
          <Link to="/catalog">Каталог курсов</Link>
          <Link to="/learning">Моё обучение</Link>
        </nav>
        <nav className="footer__col" aria-label="Аккаунт">
          <h4>Аккаунт</h4>
          <Link to="/profile">Профиль</Link>
          <Link to="/learning?tab=saved">Избранное</Link>
          <Link to="/learning?tab=done">Завершённые курсы</Link>
        </nav>
      </div>
      <div className="container footer__bottom">© {new Date().getFullYear()} Шаг. Учебный проект.</div>
    </footer>
  );
}
