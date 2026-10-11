import { Link } from 'react-router-dom';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="Шаг — на главную">
      <svg className="logo__mark" viewBox="0 0 64 64" width="32" height="32" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="currentColor" />
        <path fill="#fff" d="M14 46h12v-8h12v-8h12v-8h-6v4H32v8H20v8h-6z" />
      </svg>
      <span className="logo__text">шаг</span>
    </Link>
  );
}
