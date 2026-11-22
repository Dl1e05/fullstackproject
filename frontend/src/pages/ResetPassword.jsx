import { useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { resetPassword } from '../services/api.js';
import { PASSWORD_MAX_LENGTH, passwordRules, validatePassword } from '../utils/validation.js';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const hasValidToken = token.length >= 20 && token.length <= 200;
  const { refreshUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const requestInFlight = useRef(false);
  const complete = Boolean(location.state?.passwordResetComplete);

  const passwordError = touched ? validatePassword(password) : '';
  const confirmError = confirmTouched && confirm !== password ? 'Пароли не совпадают' : '';
  const rules = passwordRules(password);

  async function submit(event) {
    event.preventDefault();
    if (requestInFlight.current) return;
    setTouched(true);
    setConfirmTouched(true);
    setError('');
    const invalidPassword = validatePassword(password);
    if (invalidPassword || confirm !== password) return;
    if (!hasValidToken) {
      setError('Ссылка недействительна или срок ее действия истек. Запросите восстановление еще раз.');
      return;
    }

    requestInFlight.current = true;
    setSending(true);
    try {
      await resetPassword({ token, password });
      navigate('/reset-password', { replace: true, state: { passwordResetComplete: true } });
      try {
        await refreshUser();
      } catch {
        // Ошибка обновления сессии не отменяет успешную смену пароля.
      }
    } catch (requestError) {
      setError(
        requestError.status === 400 || requestError.field === 'token'
          ? 'Ссылка недействительна или срок ее действия истек. Запросите восстановление еще раз.'
          : requestError.message || 'Не удалось изменить пароль. Попробуйте еще раз.',
      );
    } finally {
      requestInFlight.current = false;
      setSending(false);
    }
  }

  return (
    <div className="container page reset-password-page">
      <section className="card reset-password">
        <span className="reset-password__icon" aria-hidden="true"><Icon name="lock" size={24} /></span>
        <h1>{complete ? 'Пароль изменен' : 'Задайте новый пароль'}</h1>
        {complete ? (
          <>
            <p className="muted">Войдите с новым паролем, чтобы продолжить обучение.</p>
            <Button size="lg" to="/login">Перейти ко входу</Button>
          </>
        ) : !hasValidToken ? (
          <div className="feedback feedback--error" role="alert">
            <span>Ссылка недействительна или срок ее действия истек. Запросите восстановление еще раз.</span>
            <Button variant="outline" to="/">На главную</Button>
          </div>
        ) : (
          <form className="form reset-password__form" onSubmit={submit} noValidate aria-busy={sending}>
            {error && <div className="feedback feedback--error" role="alert">{error}</div>}
            <label className={`field ${passwordError ? 'field--error' : ''}`}>
              <span>Новый пароль</span>
              <span className="field__control">
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  maxLength={PASSWORD_MAX_LENGTH}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'reset-password-error' : undefined}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }}
                  onBlur={() => setTouched(true)}
                />
              </span>
              {passwordError && <span id="reset-password-error" className="field__error" role="alert">{passwordError}</span>}
            </label>
            <ul className="password-rules" aria-label="Требования к паролю">
              {rules.map((rule) => (
                <li key={rule.id} className={rule.ok ? 'is-ok' : ''}>
                  <Icon name={rule.ok ? 'check' : 'x'} size={14} /> {rule.label}
                </li>
              ))}
            </ul>
            <label className={`field ${confirmError ? 'field--error' : ''}`}>
              <span>Повторите пароль</span>
              <span className="field__control">
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  maxLength={PASSWORD_MAX_LENGTH}
                  aria-invalid={!!confirmError}
                  aria-describedby={confirmError ? 'reset-confirm-error' : undefined}
                  onChange={(event) => { setConfirm(event.target.value); setError(''); }}
                  onBlur={() => setConfirmTouched(true)}
                />
              </span>
              {confirmError && <span id="reset-confirm-error" className="field__error" role="alert">{confirmError}</span>}
            </label>
            <Button type="submit" size="lg" block disabled={sending || !password || !confirm}>
              {sending ? 'Сохраняем...' : 'Изменить пароль'}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
