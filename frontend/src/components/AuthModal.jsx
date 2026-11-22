import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { Tabs } from './Tabs.jsx';
import { forgotPassword } from '../services/api.js';
import { PASSWORD_MAX_LENGTH, passwordRules, validateEmail, validateName, validatePassword } from '../utils/validation.js';

const EMPTY = { name: '', email: '', password: '', confirm: '' };
const MODES = [
  { id: 'login', label: 'Вход' },
  { id: 'register', label: 'Регистрация' },
];

function Field({ label, name, error, hint, trailing, ...props }) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <label className={`field ${error ? 'field--error' : ''}`}>
      <span>{label}</span>
      <span className="field__control">
        <input
          name={name}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          {...props}
        />
        {trailing}
      </span>
      {error ? (
        <span id={errorId} className="field__error" role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span id={hintId} className="field__hint">
            {hint}
          </span>
        )
      )}
    </label>
  );
}

export default function AuthModal({ open, mode, message, onModeChange, onClose, onLogin, onRegister }) {
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const formRef = useRef(null);
  const requestInFlight = useRef(false);
  const isRegister = mode === 'register';
  const isForgot = forgot && !isRegister;

  // Новое открытие окна — чистая форма
  useEffect(() => {
    if (!open) return;
    setValues(EMPTY);
    setShowPassword(false);
  }, [open]);

  // Переключение «Вход ↔ Регистрация»: почту оставляем, остальное сбрасываем
  useEffect(() => {
    setValues((v) => ({ ...EMPTY, email: v.email }));
    setTouched({});
    setServerErrors({});
    setFormError('');
    setForgot(false);
    setForgotSent(false);
  }, [mode, open]);

  const fields = isForgot ? ['email'] : isRegister ? ['name', 'email', 'password', 'confirm'] : ['email', 'password'];

  const errors = useMemo(() => {
    const e = { email: validateEmail(values.email) };
    if (isRegister) {
      e.name = validateName(values.name);
      e.password = validatePassword(values.password);
      if (!values.confirm) e.confirm = 'Повторите пароль';
      else if (values.confirm !== values.password) e.confirm = 'Пароли не совпадают';
    } else if (!isForgot) {
      e.password = values.password ? null : 'Введите пароль';
    }
    return e;
  }, [values, isRegister, isForgot]);

  const errorOf = (f) => serverErrors[f] || (touched[f] ? errors[f] : null);
  const rules = passwordRules(values.password);

  const bind = (f) => ({
    value: values[f],
    onChange: (e) => {
      const value = e.target.value;
      setValues((v) => ({ ...v, [f]: value }));
      setServerErrors((s) => ({ ...s, [f]: null }));
      setFormError('');
      setForgotSent(false);
    },
    onBlur: () => values[f] && setTouched((t) => ({ ...t, [f]: true })),
  });

  async function submit(e) {
    e.preventDefault();
    if (requestInFlight.current) return;
    setTouched(Object.fromEntries(fields.map((f) => [f, true])));
    const firstInvalid = fields.find((f) => errors[f]);
    if (firstInvalid) {
      formRef.current?.querySelector(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    requestInFlight.current = true;
    setLoading(true);
    try {
      if (isForgot) {
        await forgotPassword({ email: values.email });
        setForgotSent(true);
      } else if (isRegister) await onRegister({ name: values.name, email: values.email, password: values.password });
      else await onLogin({ email: values.email, password: values.password });
    } catch (err) {
      if (err.field) {
        setServerErrors({ [err.field]: err.message });
        formRef.current?.querySelector(`[name="${err.field}"]`)?.focus();
      } else {
        setFormError(err.message ?? 'Что-то пошло не так. Попробуйте ещё раз.');
      }
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }

  const eye = (
    <button
      type="button"
      className="field__eye"
      onClick={() => setShowPassword((s) => !s)}
      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
    >
      <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} />
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} title={isForgot ? 'Восстановление пароля' : isRegister ? 'Создайте аккаунт' : 'Вход в "Шаг"'}>
      {!isForgot && <Tabs items={MODES} value={mode} onChange={onModeChange} label="Вход или регистрация" />}

      {message && (
        <p className="auth__message">
          <Icon name="lock" size={18} /> {message}
        </p>
      )}

      {isForgot && forgotSent ? (
        <div className="form auth">
          <div className="feedback feedback--ok" role="status">
            <span>Запрос на восстановление принят.</span>
          </div>
          <Button type="button" size="lg" block variant="outline" onClick={() => { setForgot(false); setForgotSent(false); }}>
            Вернуться ко входу
          </Button>
        </div>
      ) : (
      <form ref={formRef} className="form auth" onSubmit={submit} noValidate aria-busy={loading}>
        {formError && (
          <div className="feedback feedback--error" role="alert">
            <span>{formError}</span>
          </div>
        )}

        {isRegister && (
          <Field label="Имя" name="name" autoComplete="given-name" placeholder="Как к вам обращаться" error={errorOf('name')} {...bind('name')} />
        )}

        <Field
          label="Электронная почта"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="name@example.com"
          error={errorOf('email')}
          {...bind('email')}
        />

        {!isForgot && (
          <Field
            label="Пароль"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder={isRegister ? 'Минимум 8 символов' : 'Ваш пароль'}
            maxLength={PASSWORD_MAX_LENGTH}
            error={errorOf('password')}
            trailing={eye}
            {...bind('password')}
          />
        )}

        {isRegister && values.password && (
          <ul className="password-rules" aria-label="Требования к паролю">
            {rules.map((r) => (
              <li key={r.id} className={r.ok ? 'is-ok' : ''}>
                <Icon name={r.ok ? 'check' : 'x'} size={14} /> {r.label}
              </li>
            ))}
          </ul>
        )}

        {isRegister && (
          <Field
            label="Повторите пароль"
            name="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Ещё раз тот же пароль"
            maxLength={PASSWORD_MAX_LENGTH}
            error={errorOf('confirm')}
            {...bind('confirm')}
          />
        )}

        {!isRegister && !isForgot && (
          <div className="auth__row">
            <button type="button" className="link-btn" onClick={() => { setForgot(true); setForgotSent(false); setFormError(''); }}>
              Забыли пароль?
            </button>
          </div>
        )}

        <Button type="submit" size="lg" block disabled={loading}>
          {loading ? (isForgot ? 'Отправляем...' : isRegister ? 'Создаём аккаунт...' : 'Входим...') : isForgot ? 'Отправить инструкции' : isRegister ? 'Зарегистрироваться' : 'Войти'}
        </Button>

        {!isForgot && <p className="auth__switch">
          {isRegister ? 'Уже есть аккаунт?' : 'Ещё нет аккаунта?'}{' '}
          <button type="button" className="link-btn" onClick={() => onModeChange(isRegister ? 'login' : 'register')}>
            {isRegister ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </p>}
        {isForgot && (
          <button type="button" className="link-btn" onClick={() => { setForgot(false); setFormError(''); }}>
            Вернуться ко входу
          </button>
        )}
      </form>
      )}
    </Modal>
  );
}
