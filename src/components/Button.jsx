import { Link } from 'react-router-dom';

// variant: primary | outline | ghost; size: md | sm | lg
export default function Button({ variant = 'primary', size = 'md', block = false, to, className = '', children, ...rest }) {
  const cls = ['btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', className].filter(Boolean).join(' ');
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
