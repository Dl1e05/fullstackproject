import Icon from './Icon.jsx';
import { useOnline } from '../hooks/useOnline.js';

export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <Icon name="wifiOff" size={18} /> Нет сети. Уроки и ваш прогресс доступны офлайн.
    </div>
  );
}
