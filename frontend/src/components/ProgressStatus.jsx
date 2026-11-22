import Button from './Button.jsx';
import { useProgress } from '../hooks/useProgress.jsx';

export default function ProgressStatus() {
  const { ready, loading, error, pending, refresh } = useProgress();

  async function retry() {
    try {
      await refresh();
    } catch {
      // Ошибка остается в состоянии хука.
    }
  }

  if (error) {
    return (
      <div className="progress-status progress-status--error" role="alert">
        <span>Не удалось обновить прогресс.</span>
        <Button variant="outline" size="sm" onClick={retry} disabled={loading || pending}>
          Повторить
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="progress-status" role="status">
        <span className="loader__spinner" aria-hidden="true" />
        <span>{ready ? 'Обновляем прогресс...' : 'Загружаем прогресс...'}</span>
      </div>
    );
  }

  return null;
}
