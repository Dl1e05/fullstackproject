// Слой доступа к данным. Сейчас работает на mock-данных из src/data и «сервере» в localStorage,
// при подключении FastAPI меняется только этот файл:
//   getTopics()             → GET  /topics
//   getCourses()            → GET  /courses?q=&topic=&price=
//   getCourse(id)           → GET  /courses/{id}
//   getLesson(id)           → GET  /lessons/{id}
//   getQuiz(courseId)       → GET  /courses/{id}/quiz
//   submitAttempt()         → POST /exercises/{id}/attempts
//   register() / login()    → POST /auth/register, POST /auth/login
//   logout()                → POST /auth/logout
//   getCurrentUser()        → GET  /users/me
//   updateUser()            → PATCH /users/me
//   purchaseCourse(id)      → POST /courses/{id}/purchase
import { topics } from '../data/topics.js';
import { courses } from '../data/courses.js';
import { lessons } from '../data/lessons.js';
import { exercises } from '../data/exercises.js';
import { normalizeEmail, validateEmail, validateName, validatePassword } from '../utils/validation.js';

const MIN_DELAY = 250;
const MAX_DELAY = 550;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms ?? MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)));
}

export class ApiError extends Error {
  constructor(message, status = 500, field = null) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

function notFound(what) {
  throw new ApiError(`${what} не найден`, 404);
}

const clone = (v) => structuredClone(v);

// ——— Mock-«сервер» аккаунтов (localStorage) ———
const USERS_KEY = 'shag:users';
const SESSION_KEY = 'shag:session';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const readUsers = () => readJSON(USERS_KEY, {});
const writeUsers = (users) => writeJSON(USERS_KEY, users);

function sessionUser() {
  const email = readJSON(SESSION_KEY, null);
  return email ? readUsers()[email] ?? null : null;
}

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return clone(rest);
}

// Пароль не хранится в открытом виде даже в mock-режиме
async function hashPassword(password, email) {
  const data = new TextEncoder().encode(`shag:${email}:${password}`);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // crypto.subtle недоступен по http с другого устройства — простой запасной хэш
  let h = 5381;
  for (const b of data) h = ((h << 5) + h + b) >>> 0;
  return `djb2-${h.toString(16)}`;
}

export async function register({ name, email, password }) {
  await delay(600);
  const nameError = validateName(name);
  if (nameError) throw new ApiError(nameError, 422, 'name');
  const emailError = validateEmail(email);
  if (emailError) throw new ApiError(emailError, 422, 'email');
  const passwordError = validatePassword(password);
  if (passwordError) throw new ApiError(passwordError, 422, 'password');

  const key = normalizeEmail(email);
  const users = readUsers();
  if (users[key]) throw new ApiError('Пользователь с такой почтой уже зарегистрирован. Попробуйте войти.', 409, 'email');

  const user = {
    id: `u_${Date.now().toString(36)}`,
    name: name.trim(),
    email: key,
    passwordHash: await hashPassword(password, key),
    purchases: [],
    createdAt: Date.now(),
  };
  writeUsers({ ...users, [key]: user });
  writeJSON(SESSION_KEY, key);
  return publicUser(user);
}

export async function login({ email, password }) {
  await delay(600);
  const emailError = validateEmail(email);
  if (emailError) throw new ApiError(emailError, 422, 'email');
  if (!password) throw new ApiError('Введите пароль', 422, 'password');

  const key = normalizeEmail(email);
  const user = readUsers()[key];
  if (!user || user.passwordHash !== (await hashPassword(password, key))) {
    throw new ApiError('Неверная почта или пароль', 401);
  }
  writeJSON(SESSION_KEY, key);
  return publicUser(user);
}

export async function logout() {
  await delay(150);
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function getCurrentUser() {
  await delay(100);
  return publicUser(sessionUser());
}

export async function updateUser({ name }) {
  await delay();
  const user = sessionUser();
  if (!user) throw new ApiError('Нужно войти в аккаунт', 401);
  const nameError = validateName(name);
  if (nameError) throw new ApiError(nameError, 422, 'name');
  const users = readUsers();
  users[user.email] = { ...user, name: name.trim() };
  writeUsers(users);
  return publicUser(users[user.email]);
}

// Демо-оплата: деньги не списываются, курс просто открывается в аккаунте
export async function purchaseCourse(courseId) {
  await delay(900);
  const user = sessionUser();
  if (!user) throw new ApiError('Чтобы купить курс, войдите в аккаунт', 401);
  const course = courses.find((c) => c.id === courseId);
  if (!course) notFound('Курс');
  if (!course.price) throw new ApiError('Этот курс бесплатный', 400);
  const users = readUsers();
  if (!user.purchases.includes(courseId)) {
    users[user.email] = { ...user, purchases: [...user.purchases, courseId] };
    writeUsers(users);
  }
  return publicUser(users[user.email]);
}

// ——— Курсы и уроки ———
function hasAccess(course) {
  return !course.price || !!sessionUser()?.purchases.includes(course.id);
}

function lessonsOf(courseId) {
  return lessons.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);
}

export function formatMinutes(total) {
  if (total < 60) return `${total} мин`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function formatPrice(price) {
  return price ? `$${price}` : 'Бесплатно';
}

function withStats(course) {
  const list = lessonsOf(course.id);
  const minutes = list.reduce((s, l) => s + l.minutes, 0);
  return {
    ...course,
    topic: topics.find((t) => t.id === course.topicId),
    lessonsCount: list.length,
    minutes,
    duration: formatMinutes(minutes),
    hasAccess: hasAccess(course),
  };
}

// Вопрос без правильного ответа — как будет отдавать сервер
function publicExercise(ex) {
  if (!ex) return null;
  const { correctId, explanation, ...rest } = ex;
  return clone(rest);
}

export async function getTopics() {
  await delay();
  return clone(topics);
}

// price: '' | 'free' | 'paid'
export async function getCourses({ q = '', topic = '', price = '' } = {}) {
  await delay();
  const query = q.trim().toLowerCase();
  return courses
    .filter((c) => !topic || c.topicId === topic)
    .filter((c) => !price || (price === 'paid' ? c.price > 0 : !c.price))
    .filter(
      (c) =>
        !query ||
        c.title.toLowerCase().includes(query) ||
        c.subtitle.toLowerCase().includes(query) ||
        lessonsOf(c.id).some((l) => l.title.toLowerCase().includes(query)),
    )
    .map((c) => clone(withStats(c)));
}

export async function getCourse(courseId) {
  await delay();
  const course = courses.find((c) => c.id === courseId);
  if (!course) notFound('Курс');
  const access = hasAccess(course);
  return clone({
    ...withStats(course),
    lessons: lessonsOf(courseId).map(({ id, order, title, type, minutes }) => ({
      id,
      order,
      title,
      type,
      minutes,
      preview: !!course.price && order === 1,
      locked: !access && order !== 1,
    })),
    quizCount: exercises.filter((e) => e.kind === 'quiz' && e.courseId === courseId).length,
  });
}

export async function getLesson(courseId, lessonId) {
  await delay();
  const course = courses.find((c) => c.id === courseId);
  const list = lessonsOf(courseId);
  const index = list.findIndex((l) => l.id === lessonId);
  if (!course || index === -1) notFound('Урок');
  const base = {
    index,
    total: list.length,
    prevId: list[index - 1]?.id ?? null,
    nextId: list[index + 1]?.id ?? null,
  };
  const { id, order, title, type, minutes } = list[index];

  // Закрытый урок платного курса: только заголовок, без содержимого
  if (!hasAccess(course) && order !== 1) {
    return clone({ id, courseId, order, title, type, minutes, ...base, locked: true });
  }
  return clone({
    ...list[index],
    ...base,
    locked: false,
    practice: publicExercise(exercises.find((e) => e.kind === 'practice' && e.lessonId === lessonId)),
  });
}

export async function getQuiz(courseId) {
  await delay();
  const course = courses.find((c) => c.id === courseId);
  if (!course) notFound('Курс');
  if (!hasAccess(course)) throw new ApiError('Тест доступен после покупки курса', 402);
  return exercises
    .filter((e) => e.kind === 'quiz' && e.courseId === courseId)
    .sort((a, b) => a.order - b.order)
    .map(publicExercise);
}

export async function submitAttempt(exerciseId, optionId) {
  await delay();
  const ex = exercises.find((e) => e.id === exerciseId);
  if (!ex) notFound('Задание');
  return { correct: ex.correctId === optionId, correctId: ex.correctId, explanation: ex.explanation };
}
