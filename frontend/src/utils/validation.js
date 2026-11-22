// Проверки на клиенте помогают заполнить форму; API повторно проверяет значения.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// Возвращает текст ошибки или null
export function validateEmail(raw) {
  const email = normalizeEmail(raw);
  if (!email) return 'Введите электронную почту';
  if (/\s/.test(raw.trim())) return 'Почта не должна содержать пробелов';
  if (!email.includes('@')) return 'В адресе не хватает символа «@»';
  if ((email.match(/@/g) || []).length > 1) return 'В адресе должен быть только один символ «@»';
  const [local, domain] = email.split('@');
  if (!local) return 'Укажите имя почты перед «@»';
  if (!domain) return 'Укажите домен после «@», например gmail.com';
  if (/[а-яё]/i.test(email)) return 'Почта пишется латинскими буквами';
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return 'Точка не может стоять в начале, в конце или дважды подряд';
  if (!EMAIL_RE.test(email)) return 'Проверьте адрес: похоже, в нём ошибка';
  return null;
}

// Требования к паролю — показываются списком с галочками
export function passwordRules(password) {
  return [
    { id: 'length', label: `Не меньше ${PASSWORD_MIN_LENGTH} символов`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'letter', label: 'Есть латинская буква', ok: /[a-z]/i.test(password) },
    { id: 'digit', label: 'Есть цифра', ok: /\d/.test(password) },
    { id: 'spaces', label: 'Без пробелов и русских букв', ok: password.length > 0 && !/[\sа-яё]/i.test(password) },
  ];
}

export function validatePassword(password) {
  if (!password) return 'Введите пароль';
  if (password.length > PASSWORD_MAX_LENGTH) return `Пароль должен быть не длиннее ${PASSWORD_MAX_LENGTH} символов`;
  if (/\s/.test(password)) return 'Пароль не должен содержать пробелов';
  if (/[а-яё]/i.test(password)) return 'Пароль вводится латинскими буквами — проверьте раскладку';
  if (password.length < PASSWORD_MIN_LENGTH) return `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`;
  if (!/[a-z]/i.test(password)) return 'Добавьте в пароль хотя бы одну латинскую букву';
  if (!/\d/.test(password)) return 'Добавьте в пароль хотя бы одну цифру';
  if (/^(.)\1+$/.test(password) || ['12345678', 'qwerty123', 'password1', '11111111'].includes(password.toLowerCase()))
    return 'Пароль слишком простой — его легко подобрать';
  return null;
}

export function validateName(raw) {
  const name = raw.trim();
  if (!name) return 'Введите имя';
  if (name.length < 2) return 'Имя слишком короткое';
  if (name.length > 40) return 'Имя слишком длинное';
  if (!/^[a-zа-яё\s'-]+$/i.test(name)) return 'Имя может содержать только буквы, пробел и дефис';
  return null;
}
