import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AuthModal from '../components/AuthModal.jsx';
import PurchaseModal from '../components/PurchaseModal.jsx';
import * as api from '../services/api.js';

// Аккаунт пользователя + окна входа/регистрации и покупки курса.
// Провайдер подключён внутри роутера (см. App.jsx), поэтому окна могут переходить по страницам.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState({ open: false, mode: 'login', message: '', onSuccess: null });
  const [purchaseCourse, setPurchaseCourse] = useState(null);

  useEffect(() => {
    api
      .getCurrentUser()
      .then(setUser)
      .finally(() => setReady(true));
  }, []);

  const openAuth = useCallback(({ mode = 'login', message = '', onSuccess = null } = {}) => {
    setAuth({ open: true, mode, message, onSuccess });
  }, []);

  const closeAuth = useCallback(() => setAuth((a) => ({ ...a, open: false, onSuccess: null })), []);

  const finishAuth = useCallback(
    (u) => {
      setUser(u);
      const after = auth.onSuccess;
      setAuth((a) => ({ ...a, open: false, onSuccess: null }));
      after?.(u);
    },
    [auth.onSuccess],
  );

  const login = useCallback(async (data) => finishAuth(await api.login(data)), [finishAuth]);
  const register = useCallback(async (data) => finishAuth(await api.register(data)), [finishAuth]);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const updateName = useCallback(async (name) => {
    const u = await api.updateUser({ name });
    setUser(u);
    return u;
  }, []);

  // Покупка: гость сначала входит или регистрируется, затем сразу открывается оплата
  const buyCourse = useCallback(
    (course) => {
      if (user) {
        setPurchaseCourse(course);
        return;
      }
      openAuth({
        mode: 'register',
        message: `Чтобы купить курс «${course.title}», войдите или создайте аккаунт.`,
        onSuccess: (u) => {
          if (!u.purchases.includes(course.id)) setPurchaseCourse(course);
        },
      });
    },
    [user, openAuth],
  );

  const confirmPurchase = useCallback(async (courseId) => {
    const u = await api.purchaseCourse(courseId);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      openAuth,
      login,
      register,
      logout,
      updateName,
      buyCourse,
      hasPurchased: (courseId) => !!user?.purchases.includes(courseId),
      // меняется при входе/выходе и покупке — страницы перезапрашивают данные курса
      accessKey: user ? `${user.id}:${user.purchases.join(',')}` : 'guest',
    }),
    [user, ready, openAuth, login, register, logout, updateName, buyCourse],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        open={auth.open}
        mode={auth.mode}
        message={auth.message}
        onModeChange={(mode) => setAuth((a) => ({ ...a, mode }))}
        onClose={closeAuth}
        onLogin={login}
        onRegister={register}
      />
      <PurchaseModal course={purchaseCourse} onClose={() => setPurchaseCourse(null)} onConfirm={confirmPurchase} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри <AuthProvider>');
  return ctx;
}
