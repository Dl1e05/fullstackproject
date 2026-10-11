import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';
import { useOnline } from '../hooks/useOnline.js';

// Состояние «нет сети» из макета. Приложение закэшировано service worker'ом,
// поэтому уроки и прогресс доступны и без интернета.
export default function Offline() {
  const online = useOnline();
  return (
    <div className="container page">
      <EmptyState
        icon="wifiOff"
        title={online ? 'Соединение восстановлено' : 'Нет подключения к интернету'}
        text={
          online
            ? 'Можно продолжать обучение.'
            : 'Проверьте Wi‑Fi или мобильный интернет. Уже открытые курсы и ваш прогресс доступны офлайн.'
        }
      >
        <Button onClick={() => window.location.reload()}>Попробовать снова</Button>
        <Button variant="outline" to="/learning">
          Моё обучение
        </Button>
      </EmptyState>
    </div>
  );
}
