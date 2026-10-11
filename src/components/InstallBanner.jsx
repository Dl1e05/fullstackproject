import { useState } from 'react';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';

const DISMISS_KEY = 'shag:install-dismissed';

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

// Android/Chrome/Edge — системный диалог через beforeinstallprompt,
// iOS Safari — подсказка «Поделиться → На экран „Домой“» (макет install-ios)
export default function InstallBanner({ force = false }) {
  const { canInstall, isIOS, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showIOSHint, setShowIOSHint] = useState(false);

  if ((!canInstall && !isIOS) || (dismissed && !force)) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="install">
      <img className="install__logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="48" height="48" />
      <div className="install__text">
        <strong>Установите «Шаг» на телефон</strong>
        <span>Уроки откроются в один тап и будут доступны даже без интернета.</span>
        {showIOSHint && (
          <ol className="install__ios">
            <li>
              Нажмите <Icon name="share" size={16} /> «Поделиться» внизу Safari
            </li>
            <li>
              Выберите <Icon name="plusSquare" size={16} /> «На экран “Домой”»
            </li>
            <li>Нажмите «Добавить»</li>
          </ol>
        )}
      </div>
      <div className="install__actions">
        {canInstall && (
          <Button size="sm" onClick={promptInstall}>
            <Icon name="download" size={18} /> Установить
          </Button>
        )}
        {!canInstall && !showIOSHint && (
          <Button size="sm" onClick={() => setShowIOSHint(true)}>
            Как установить
          </Button>
        )}
        {!force && (
          <button type="button" className="install__close" onClick={dismiss} aria-label="Скрыть">
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
    </section>
  );
}
