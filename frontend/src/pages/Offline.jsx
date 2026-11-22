import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';
import { useOnline } from '../hooks/useOnline.js';

// Поясняет, какие данные доступны без подключения.
export default function Offline() {
  const online = useOnline();
  return (
    <div className="container page">
      <EmptyState
        icon="wifiOff"
        title={online ? 'Соединение восстановлено' : 'Нет подключения к интернету'}
        text={
          online
            ? 'Можно снова попробовать открыть курсы.'
            : 'Проверьте Wi-Fi или мобильный интернет. Приложение можно открыть без сети, но для загрузки курсов и сохранения прогресса в аккаунте нужно подключение. Гостевой прогресс остается в этом браузере.'
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
