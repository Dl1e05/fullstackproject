// Слой доступа к данным: запросы к FastAPI (backend/). Адрес берётся из VITE_API_URL (см. .env.example).
// Токен входа хранится в localStorage и отправляется в заголовке Authorization.
//   getTopics()             → GET   /topics
//   getCourses()            → GET   /courses?q=&topic=&price=
//   getCourse(id)           → GET   /courses/{id}
//   getLesson(c, l)         → GET   /courses/{c}/lessons/{l}
//   getQuiz(courseId)       → GET   /courses/{id}/quiz
//   submitAttempt()         → POST  /exercises/{id}/attempts
//   register() / login()    → POST  /auth/register, /auth/login
//   logout()                → POST  /auth/logout
//   getCurrentUser()        → GET   /users/me
//   updateUser()            → PATCH /users/me
//   purchaseCourse(id)      → POST  /courses/{id}/purchase
//   getProgress()           -> GET   /users/me/progress
//   getProgressStats()      -> GET   /users/me/stats
//   submitQuizAttempt()     -> POST  /courses/{id}/quiz/attempts
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
export const SESSION_STORAGE_KEY = 'shag:token';
export const AUTH_INVALIDATED_EVENT = 'shag:auth-invalidated';

export class ApiError extends Error {
  constructor(message, status = 500, field = null) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

// ——— Токен ———
function getToken() {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}
function setToken(token) {
  try {
    if (token) localStorage.setItem(SESSION_STORAGE_KEY, token);
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getSessionToken() {
  return getToken();
}

export function clearSessionIfMatches(token) {
  if (!token || getToken() !== token) return false;
  setToken(null);
  return true;
}

// ——— HTTP ———
// Ошибка проверки данных (422) приходит массивом: берём первое сообщение и имя поля
function errorFromResponse(status, body) {
  const detail = body?.detail;
  if (Array.isArray(detail) && detail.length) {
    const field = detail[0].loc?.[detail[0].loc.length - 1];
    return new ApiError(detail[0].msg ?? 'Проверьте введённые данные', status, typeof field === 'string' ? field : null);
  }
  return new ApiError(typeof detail === 'string' ? detail : 'Что-то пошло не так. Попробуйте ещё раз.', status);
}

async function request(path, { method = 'GET', body, params, token } = {}) {
  const requestToken = token === undefined ? getToken() : token;
  const url = new URL(BASE_URL + path, window.location.origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (requestToken) headers.Authorization = `Bearer ${requestToken}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.', 0);
  }

  if (res.status === 401 && requestToken && requestToken === getToken()) {
    window.dispatchEvent(new CustomEvent(AUTH_INVALIDATED_EVENT, { detail: { token: requestToken } }));
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw errorFromResponse(res.status, data);
  return data;
}

// ——— Аккаунт ———
function startSession({ accessToken, user }, onSession) {
  setToken(accessToken);
  onSession?.(accessToken, user);
  return user;
}

export async function register(
  { name, email, password },
  { isCurrent = () => true, onSession } = {},
) {
  try {
    const result = await request('/auth/register', {
      method: 'POST',
      body: { name, email, password },
      token: null,
    });
    return isCurrent() ? startSession(result, onSession) : null;
  } catch (err) {
    // 409 — почта занята
    if (err.status === 409) err.field = 'email';
    throw err;
  }
}

export async function login({ email, password }, { isCurrent = () => true, onSession } = {}) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
    token: null,
  });
  return isCurrent() ? startSession(result, onSession) : null;
}

export async function logout(token = getToken()) {
  if (!token) return;
  try {
    await request('/auth/logout', { method: 'POST', token });
  } catch {
    /* токен всё равно удаляем */
  }
  clearSessionIfMatches(token);
}

export async function getCurrentUser(token = getToken()) {
  if (!token) return null;
  return request('/users/me', { token });
}

export function updateUser({ name }, token = getToken()) {
  return request('/users/me', { method: 'PATCH', body: { name }, token });
}

// Демо-оплата: деньги не списываются, курс просто открывается в аккаунте
export function purchaseCourse(courseId, token = getToken()) {
  return request(`/courses/${encodeURIComponent(courseId)}/purchase`, { method: 'POST', token });
}

export const getProgressStats = (token = getToken()) => request('/users/me/stats', { token });

export const getProgress = (token = getToken()) => request('/users/me/progress', { token });

export const completeLesson = (courseId, lessonId, token = getToken()) =>
  request(
    `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/completion`,
    { method: 'PUT', token },
  );

export const visitLesson = (courseId, lessonId, token = getToken()) =>
  request(
    `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/visit`,
    { method: 'PUT', token },
  );

export const setCourseSaved = (courseId, saved, token = getToken()) =>
  request(`/users/me/saved/${encodeURIComponent(courseId)}`, {
    method: saved ? 'PUT' : 'DELETE',
    token,
  });

export const resetProgress = (token = getToken()) => request('/users/me/progress', { method: 'DELETE', token });

export const submitQuizAttempt = (courseId, answers, clientAttemptId, token = getToken()) =>
  request(`/courses/${encodeURIComponent(courseId)}/quiz/attempts`, {
    method: 'POST',
    body: { answers, ...(clientAttemptId ? { clientAttemptId } : {}) },
    token,
  });

export const getQuizAttempts = (courseId, { limit = 20, offset = 0 } = {}, token = getToken()) =>
  request(`/courses/${encodeURIComponent(courseId)}/quiz/attempts`, { params: { limit, offset }, token });

export const forgotPassword = ({ email }) =>
  request('/auth/forgot-password', { method: 'POST', body: { email }, token: null });

export const resetPassword = ({ token, password }) =>
  request('/auth/reset-password', { method: 'POST', body: { token, password }, token: null });

// ——— Курсы и уроки ———
export function formatMinutes(total) {
  if (total < 60) return `${total} мин`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function formatPrice(price) {
  return price ? `$${price}` : 'Бесплатно';
}

export const getTopics = () => request('/topics');

// price: '' | 'free' | 'paid'
export const getCourses = ({ q = '', topic = '', price = '' } = {}, token = getToken()) =>
  request('/courses', { params: { q: q.trim(), topic, price }, token });

export const getCourse = (courseId, token = getToken()) =>
  request(`/courses/${encodeURIComponent(courseId)}`, { token });

export const getLesson = (courseId, lessonId, token = getToken()) =>
  request(`/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`, { token });

export const getQuiz = (courseId, token = getToken()) =>
  request(`/courses/${encodeURIComponent(courseId)}/quiz`, { token });

export const submitAttempt = (exerciseId, optionId, token = getToken()) =>
  request(`/exercises/${encodeURIComponent(exerciseId)}/attempts`, {
    method: 'POST',
    body: { optionId },
    token,
  });
