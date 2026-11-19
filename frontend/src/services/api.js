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
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'shag:token';

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
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
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

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE_URL + path, window.location.origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.', 0);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw errorFromResponse(res.status, data);
  return data;
}

// ——— Аккаунт ———
function startSession({ accessToken, user }) {
  setToken(accessToken);
  return user;
}

export async function register({ name, email, password }) {
  try {
    return startSession(await request('/auth/register', { method: 'POST', body: { name, email, password } }));
  } catch (err) {
    // 409 — почта занята
    if (err.status === 409) err.field = 'email';
    throw err;
  }
}

export async function login({ email, password }) {
  return startSession(await request('/auth/login', { method: 'POST', body: { email, password } }));
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    /* токен всё равно удаляем */
  }
  setToken(null);
}

export async function getCurrentUser() {
  if (!getToken()) return null;
  try {
    return await request('/users/me');
  } catch (err) {
    if (err.status === 401) setToken(null); // токен просрочен
    return null;
  }
}

export function updateUser({ name }) {
  return request('/users/me', { method: 'PATCH', body: { name } });
}

// Демо-оплата: деньги не списываются, курс просто открывается в аккаунте
export function purchaseCourse(courseId) {
  return request(`/courses/${encodeURIComponent(courseId)}/purchase`, { method: 'POST' });
}

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
export const getCourses = ({ q = '', topic = '', price = '' } = {}) =>
  request('/courses', { params: { q: q.trim(), topic, price } });

export const getCourse = (courseId) => request(`/courses/${encodeURIComponent(courseId)}`);

export const getLesson = (courseId, lessonId) =>
  request(`/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`);

export const getQuiz = (courseId) => request(`/courses/${encodeURIComponent(courseId)}/quiz`);

export const submitAttempt = (exerciseId, optionId) =>
  request(`/exercises/${encodeURIComponent(exerciseId)}/attempts`, { method: 'POST', body: { optionId } });
