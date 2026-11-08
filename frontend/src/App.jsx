import { useEffect } from 'react';
import { createBrowserRouter, createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { ProgressProvider } from './hooks/useProgress.jsx';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import LessonLayout from './layouts/LessonLayout.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Course from './pages/Course.jsx';
import Lesson from './pages/Lesson.jsx';
import Quiz from './pages/Quiz.jsx';
import Learning from './pages/Learning.jsx';
import Profile from './pages/Profile.jsx';
import Offline from './pages/Offline.jsx';
import NotFound from './pages/NotFound.jsx';

// Корневой маршрут: аккаунт и окна входа/покупки доступны на всех страницах
function Root() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

// /login и /register открывают окно входа поверх главной (для прямых ссылок)
function AuthRoute({ mode }) {
  const { openAuth, user } = useAuth();
  useEffect(() => {
    if (!user) openAuth({ mode });
  }, [mode, user, openAuth]);
  return <Navigate to={user ? '/profile' : '/'} replace />;
}

const routes = [
  {
    element: <Root />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'catalog', element: <Catalog /> },
          { path: 'courses/:courseId', element: <Course /> },
          { path: 'learning', element: <Learning /> },
          { path: 'profile', element: <Profile /> },
          { path: 'login', element: <AuthRoute mode="login" /> },
          { path: 'register', element: <AuthRoute mode="register" /> },
          { path: 'offline', element: <Offline /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        // layout без собственного пути, чтобы не конфликтовать с /courses/:courseId
        element: <LessonLayout />,
        children: [
          { path: '/courses/:courseId/lessons/:lessonId', element: <Lesson /> },
          { path: '/courses/:courseId/quiz', element: <Quiz /> },
        ],
      },
    ],
  },
];

// Для GitHub Pages (npm run build:pages) используем HashRouter, для Vercel/Netlify — обычный
const createRouter = import.meta.env.VITE_HASH_ROUTER === 'true' ? createHashRouter : createBrowserRouter;
const router = createRouter(routes);

export default function App() {
  return (
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>
  );
}
