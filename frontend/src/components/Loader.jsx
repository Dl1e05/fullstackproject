import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';
import NotFound from '../pages/NotFound.jsx';

export function Loader({ label = 'Загружаем…' }) {
  return (
    <div className="loader" role="status">
      <span className="loader__spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  if (error?.status === 404) return <NotFound />;
  return (
    <EmptyState
      icon="wifiOff"
      title="Не удалось загрузить данные"
      text={error?.message ?? 'Проверьте подключение и попробуйте ещё раз.'}
    >
      {onRetry && <Button onClick={onRetry}>Попробовать снова</Button>}
    </EmptyState>
  );
}

// Обёртка над useAsync: показывает загрузку, ошибку или контент
export function AsyncView({ state, children, label }) {
  if (state.loading && !state.data) return <Loader label={label} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  return children(state.data);
}
