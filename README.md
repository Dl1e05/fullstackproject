# Шаг — платформа коротких онлайн-курсов (frontend)

PWA-сайт для обучения «по шагу в день»: каталог бесплатных и премиум-курсов, уроки с кратким конспектом и практикой, итоговые тесты, раздел «Моё обучение», вход и регистрация, профиль. Прогресс сохраняется в браузере, сайт можно установить на телефон как приложение и открыть без интернета.

**Демо:** _ссылка после деплоя_

## Стек

- React 18 + Vite 5
- React Router v6 (`createBrowserRouter`, для GitHub Pages — `createHashRouter`)
- vite-plugin-pwa: manifest, service worker (Workbox), офлайн-кэш
- Обычный CSS с дизайн-токенами (`src/styles/tokens.css`): зелёный `#176b52`, фон `#f6f7f3`, шрифт Inter, скругления 12–16px
- Mock-данные в JS-файлах; бэкенд на FastAPI подключается позже через `src/services/api.js`

## Запуск

```bash
npm i
npm run dev       # http://localhost:5173
npm run build     # сборка в dist/
npm run preview   # проверка собранной версии с service worker (http://localhost:4173)
```

`npm run icons` заново генерирует PNG-иконки PWA (`scripts/gen-icons.mjs`, без зависимостей).

## Маршруты

| Маршрут | Страница |
| --- | --- |
| `/` | Главная: hero, «Продолжить обучение», популярные курсы, «Как это работает», баннер установки |
| `/catalog` | Каталог: поиск, фильтры по теме и цене, пустой результат (`?q=`, `?topic=`, `?price=free|paid`) |
| `/courses/:courseId` | Курс: описание, программа, прогресс, «Сохранить», покупка платного курса |
| `/courses/:courseId/lessons/:lessonId` | Урок: вкладки «Кратко» и «Практика», боковая панель прогресса |
| `/courses/:courseId/quiz` | Итоговый тест и результат (пройден / не пройден, порог 70%) |
| `/learning` | Моё обучение: «В процессе», «Избранное», «Завершённые» (`?tab=saved`, `?tab=done`) |
| `/profile` | Профиль: вход/выход, имя, мои покупки, статистика, установка приложения, сброс прогресса |
| `/login`, `/register` | Открывают окно входа или регистрации поверх главной |
| `/offline` | Состояние «нет сети» |
| `*` | 404 |

Урок и тест открываются в `LessonLayout` (упрощённая шапка с названием курса и кнопкой «Выйти из урока», без футера), остальные страницы — в `MainLayout` (Navbar, контент, Footer, на телефоне нижний таб-бар).

## Структура

```
src/
  components/   Button, CourseCard, CourseCover, ProgressBar, LessonListItem, Tabs/Chip,
                SearchInput, EmptyState, QuizOption, InfoBox, InstallBanner, OfflineBanner,
                Loader (Loader/ErrorState/AsyncView), Navbar, TabBar, Footer, Logo, Icon,
                Modal, AuthModal (вход/регистрация), PurchaseModal, Paywall
  layouts/      MainLayout, LessonLayout
  pages/        Home, Catalog, Course, Lesson, Quiz, Learning, Profile, Offline, NotFound
  data/         topics.js, courses.js, lessons.js, exercises.js
  services/     api.js — все запросы к данным (Promise с задержкой)
  hooks/        useProgress (Context + localStorage), useAuth (аккаунт, окна входа и покупки),
                useAsync, useInstallPrompt, useOnline
  utils/        validation.js — проверки почты, пароля и имени
  styles/       tokens.css, global.css, components.css, pages.css
  App.jsx       маршрутизация
public/         иконки PWA, favicon
scripts/        генератор иконок
```

## Данные и API

Сущности: `Topic`, `Course`, `Lesson`, `Exercise` + `AnswerOption`. Функции `api.js` возвращают Promise с задержкой 250–550 мс, поэтому на страницах есть состояния загрузки и ошибки. Правильные ответы не отдаются вместе с вопросами — их проверяет `submitAttempt()`, как будет делать сервер.

| Функция | Будущий эндпоинт FastAPI |
| --- | --- |
| `getTopics()` | `GET /topics` |
| `getCourses({ q, topic })` | `GET /courses?q=&topic=` |
| `getCourse(id)` | `GET /courses/{id}` |
| `getLesson(courseId, lessonId)` | `GET /lessons/{id}` |
| `getQuiz(courseId)` | `GET /courses/{id}/quiz` |
| `submitAttempt(exerciseId, optionId)` | `POST /exercises/{id}/attempts` |
| `register({ name, email, password })` | `POST /auth/register` |
| `login({ email, password })` / `logout()` | `POST /auth/login`, `POST /auth/logout` |
| `getCurrentUser()` / `updateUser({ name })` | `GET /users/me`, `PATCH /users/me` |
| `purchaseCourse(courseId)` | `POST /courses/{id}/purchase` |

Чтобы подключить бэкенд, достаточно заменить тела функций в `api.js` на `fetch(...)`.

Прогресс (пройденные уроки, последний урок, избранное, результаты тестов, профиль) хранится в `localStorage` под ключом `shag:progress:v1` и сохраняется после повторного открытия.

Контент: 11 курсов, 3–5 уроков в каждом, практика к каждому уроку и тест на 3–4 вопроса.

- Бесплатные (8): Цифровая безопасность, Excel с нуля, Английский для путешествий, Смартфон без стресса, Личный бюджет, Госуслуги онлайн, Безопасные покупки в интернете, Деловая переписка
- Платные (3, это 27% каталога): Нейросети в повседневной жизни — $3, Инвестиции для начинающих — $3, Excel: продвинутый уровень — $2

## Аккаунты и платные курсы

- Окно входа и регистрации (`AuthModal`) открывается из шапки, профиля, по ссылкам `/login` и `/register` и при попытке купить курс. На телефоне оно выезжает снизу.
- Проверки (`src/utils/validation.js`), ошибки показываются под полем после ухода с него и при отправке:
  - почта: формат адреса, латиница, без пробелов, только домены `gmail.com`, `mail.ru`, `inbox.ru`, `list.ru`, `bk.ru`, `yandex.ru`, `ya.ru`, `icloud.com`, `outlook.com`; на частые опечатки (`gmial.com`, `mail.com`…) — подсказка «Возможно, вы имели в виду …»;
  - пароль: от 8 символов, есть латинская буква и цифра, без пробелов и русских букв, не из списка самых простых; требования видны списком с галочками;
  - повтор пароля должен совпадать, имя — от 2 букв.
- Ошибки «сервера»: почта уже зарегистрирована, неверная почта или пароль.
- Аккаунты хранятся в `localStorage` (`shag:users`), пароль — только в виде SHA-256-хэша. Это заглушка до FastAPI: на сервере проверки нужно повторить.
- В платном курсе первый урок открыт как пробный. Остальные уроки и тест показывают экран «Доступно после покупки» (`Paywall`), содержимое закрытых уроков `api.js` не отдаёт.
- Покупка (`PurchaseModal`) — демо: деньги не списываются, данные карты не запрашиваются, курс просто добавляется в аккаунт. Гостя сначала попросят войти или зарегистрироваться, затем сразу откроется оплата.

## Адаптивность

- до 640px — телефон (макеты 390px): шапка с лого, поиском и профилем, нижний таб-бар, карточки в 1 колонку
- 640–1024px — планшет: 2 колонки, боковая панель урока уходит под контент
- от 1024px — ПК: контейнер 1120px, 3 колонки

## PWA

- `manifest.webmanifest`: название, иконки 192/512 и maskable, `theme_color #176b52`, `display: standalone`
- Service worker кэширует всю статику и шрифты, навигация офлайн отдаёт `index.html` — уроки и прогресс работают без сети
- Кнопка «Установить» через событие `beforeinstallprompt` (Chrome, Edge, Android), для iOS — подсказка «Поделиться → На экран „Домой“»
- При потере сети показывается баннер, есть страница `/offline`

Service worker работает в `npm run preview` и на проде; в `npm run dev` он выключен.

## Деплой

**Vercel** (проще): импортировать репозиторий, Framework — Vite. `vercel.json` уже перенаправляет все маршруты на `index.html`.

**GitHub Pages:** `npm run build:pages` собирает с относительными путями и HashRouter (адреса вида `/#/catalog`), затем содержимое `dist/` публикуется, например, через `gh-pages` или GitHub Actions.

## Кто что делал

| Этап | Что | Кто |
| --- | --- | --- |
| 1 | Репозиторий, Vite, роутер, токены, заглушки | все / лид |
| 2 | Layout: Navbar, Footer, таб-бар | A |
| 3 | Базовые компоненты, mock-данные, api.js | B |
| 4 | Главная, Каталог, Курс | A |
| 5 | Урок, Тест, Результат, хук прогресса | B |
| 6 | Моё обучение, Профиль, 404, пустые состояния | C |
| 7 | Адаптивность 390/768/1440, PWA | C |
| 8 | README, деплой, скриншоты | все |

## Скриншоты

_Добавить: `docs/desktop.png`, `docs/mobile.png`_

## Планы

- Бэкенд на FastAPI и замена mock-данных
- Авторизация на сервере, восстановление пароля, синхронизация прогресса между устройствами
- Настоящая оплата через платёжного провайдера (ЮKassa, Stripe и т. п.)
- Страница помощи `/help`
- Настоящие видео в уроках
