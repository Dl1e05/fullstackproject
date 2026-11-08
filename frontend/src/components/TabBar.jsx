import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';

const tabs = [
  { to: '/', label: 'Главная', icon: 'home', end: true },
  { to: '/catalog', label: 'Каталог', icon: 'grid' },
  { to: '/learning', label: 'Учусь', icon: 'book' },
  { to: '/profile', label: 'Профиль', icon: 'user' },
];

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Нижнее меню">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="tabbar__item">
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
