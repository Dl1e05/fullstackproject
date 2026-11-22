import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AuthModal from '../components/AuthModal.jsx';
import PurchaseModal from '../components/PurchaseModal.jsx';
import * as api from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(() => api.getSessionToken());
  const [sessionKey, setSessionKey] = useState(() => (sessionToken ? 'restore:0' : 'guest:0'));
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [auth, setAuth] = useState({ open: false, mode: 'login', message: '', onSuccess: null });
  const [purchaseIntent, setPurchaseIntent] = useState(null);
  const purchaseIntentRef = useRef(null);
  const purchaseIntentCounterRef = useRef(0);
  const sessionCounterRef = useRef(0);
  const sessionKeyRef = useRef(sessionKey);
  const sessionTokenRef = useRef(sessionToken);
  const authOperationRef = useRef(0);

  const switchSession = useCallback((kind, token, nextUser) => {
    const nextKey = `${kind}:${++sessionCounterRef.current}`;
    sessionKeyRef.current = nextKey;
    sessionTokenRef.current = token;
    setSessionKey(nextKey);
    setSessionToken(token);
    setUser(nextUser);
    purchaseIntentRef.current = null;
    setPurchaseIntent(null);
    return nextKey;
  }, []);

  const isCurrentSession = useCallback((expectedKey, expectedToken) => {
    return (
      sessionKeyRef.current === expectedKey &&
      sessionTokenRef.current === expectedToken &&
      api.getSessionToken() === expectedToken
    );
  }, []);

  const refreshUser = useCallback(async () => {
    const expectedKey = sessionKeyRef.current;
    const expectedToken = sessionTokenRef.current;

    if (!expectedToken) {
      if (!expectedKey.startsWith('guest:')) switchSession('guest', null, null);
      setAuthError(null);
      setReady(true);
      return null;
    }
    if (api.getSessionToken() !== expectedToken) return null;

    try {
      const currentUser = await api.getCurrentUser(expectedToken);
      if (
        sessionKeyRef.current !== expectedKey ||
        sessionTokenRef.current !== expectedToken ||
        api.getSessionToken() !== expectedToken
      )
        return null;
      setUser(currentUser);
      setAuthError(null);
      setReady(true);
      return currentUser;
    } catch (error) {
      if (
        sessionKeyRef.current !== expectedKey ||
        sessionTokenRef.current !== expectedToken ||
        api.getSessionToken() !== expectedToken
      )
        return null;

      if (error.status === 401) {
        api.clearSessionIfMatches(expectedToken);
        switchSession('guest', null, null);
      }
      setAuthError(error);
      setReady(true);
      throw error;
    }
  }, [switchSession]);

  useEffect(() => {
    function handleInvalidated(event) {
      const token = event.detail?.token;
      if (!token || token !== sessionTokenRef.current || token !== api.getSessionToken()) return;
      if (!api.clearSessionIfMatches(token)) return;

      authOperationRef.current += 1;
      switchSession('guest', null, null);
      setAuthError(new api.ApiError('Сессия завершилась. Войдите снова.', 401));
      setReady(true);
    }

    window.addEventListener(api.AUTH_INVALIDATED_EVENT, handleInvalidated);
    return () => window.removeEventListener(api.AUTH_INVALIDATED_EVENT, handleInvalidated);
  }, [switchSession]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== api.SESSION_STORAGE_KEY && event.key !== null) return;
      const nextToken = api.getSessionToken();
      if (nextToken === sessionTokenRef.current) return;

      authOperationRef.current += 1;
      setAuthError(null);
      if (!nextToken) {
        switchSession('guest', null, null);
        setReady(true);
        return;
      }

      switchSession('restore', nextToken, null);
      setReady(false);
      refreshUser().catch(() => {});
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshUser, switchSession]);

  useEffect(() => {
    if (!sessionTokenRef.current) {
      setReady(true);
      return;
    }
    refreshUser().catch(() => {});
  }, [refreshUser]);

  const openAuth = useCallback(({ mode = 'login', message = '', onSuccess = null } = {}) => {
    setAuth({ open: true, mode, message, onSuccess });
  }, []);

  const closeAuth = useCallback(() => setAuth((current) => ({ ...current, open: false, onSuccess: null })), []);

  const finishAuth = useCallback(
    (currentUser, session) => {
      const after = auth.onSuccess;
      setAuth((current) => ({ ...current, open: false, onSuccess: null }));
      after?.(currentUser, session);
    },
    [auth.onSuccess],
  );

  const closePurchase = useCallback((intent) => {
    if (!intent || purchaseIntentRef.current !== intent) return;
    purchaseIntentRef.current = null;
    setPurchaseIntent(null);
  }, []);

  const login = useCallback(
    async (data) => {
      const startingKey = sessionKey;
      const startingToken = sessionToken;
      const operation = ++authOperationRef.current;
      let acceptedSession = null;
      setAuthError(null);
      const currentUser = await api.login(data, {
        isCurrent: () =>
          operation === authOperationRef.current && isCurrentSession(startingKey, startingToken),
        onSession: (token, signedInUser) => {
          if (operation !== authOperationRef.current) return;
          const key = switchSession('account', token, signedInUser);
          acceptedSession = { sessionKey: key, sessionToken: token };
          setReady(true);
          setAuthError(null);
        },
      });
      if (
        operation !== authOperationRef.current ||
        !currentUser ||
        !acceptedSession ||
        !isCurrentSession(acceptedSession.sessionKey, acceptedSession.sessionToken)
      )
        return null;
      finishAuth(currentUser, acceptedSession);
      return currentUser;
    },
    [finishAuth, isCurrentSession, sessionKey, sessionToken, switchSession],
  );

  const register = useCallback(
    async (data) => {
      const startingKey = sessionKey;
      const startingToken = sessionToken;
      const operation = ++authOperationRef.current;
      let acceptedSession = null;
      setAuthError(null);
      const currentUser = await api.register(data, {
        isCurrent: () =>
          operation === authOperationRef.current && isCurrentSession(startingKey, startingToken),
        onSession: (token, signedInUser) => {
          if (operation !== authOperationRef.current) return;
          const key = switchSession('account', token, signedInUser);
          acceptedSession = { sessionKey: key, sessionToken: token };
          setReady(true);
          setAuthError(null);
        },
      });
      if (
        operation !== authOperationRef.current ||
        !currentUser ||
        !acceptedSession ||
        !isCurrentSession(acceptedSession.sessionKey, acceptedSession.sessionToken)
      )
        return null;
      finishAuth(currentUser, acceptedSession);
      return currentUser;
    },
    [finishAuth, isCurrentSession, sessionKey, sessionToken, switchSession],
  );

  const logout = useCallback(async () => {
    const token = sessionToken;
    const key = sessionKey;
    if (!token || !isCurrentSession(key, token)) return;
    authOperationRef.current += 1;
    await api.logout(token);
    if (
      sessionKeyRef.current === key &&
      sessionTokenRef.current === token &&
      api.getSessionToken() === null
    ) {
      switchSession('guest', null, null);
      setAuthError(null);
      setReady(true);
    }
  }, [isCurrentSession, sessionKey, sessionToken, switchSession]);

  const updateName = useCallback(
    async (name) => {
      const token = sessionToken;
      const key = sessionKey;
      if (!token || !isCurrentSession(key, token)) throw new api.ApiError('Нужно войти в аккаунт', 401);
      const updatedUser = await api.updateUser({ name }, token);
      if (!isCurrentSession(key, token)) throw new api.ApiError('Сессия изменилась. Повторите действие.', 0);
      setUser(updatedUser);
      return updatedUser;
    },
    [isCurrentSession, sessionKey, sessionToken],
  );

  const buyCourse = useCallback(
    (course) => {
      if (user) {
        if (!isCurrentSession(sessionKey, sessionToken)) return;
        const intent = { id: ++purchaseIntentCounterRef.current, course, sessionKey, sessionToken };
        purchaseIntentRef.current = intent;
        setPurchaseIntent(intent);
        return;
      }
      openAuth({
        mode: 'register',
        message: `Чтобы купить курс «${course.title}», войдите или создайте аккаунт.`,
        onSuccess: (currentUser, session) => {
          if (
            !currentUser.purchases?.includes(course.id) &&
            isCurrentSession(session.sessionKey, session.sessionToken)
          ) {
            const intent = { id: ++purchaseIntentCounterRef.current, course, ...session };
            purchaseIntentRef.current = intent;
            setPurchaseIntent(intent);
          }
        },
      });
    },
    [user, openAuth, isCurrentSession, sessionKey, sessionToken],
  );

  const confirmPurchase = useCallback(
    async (courseId, intent) => {
      if (
        !intent ||
        purchaseIntentRef.current !== intent ||
        !isCurrentSession(intent.sessionKey, intent.sessionToken)
      )
        throw new api.ApiError('Сессия изменилась. Повторите действие.', 0);
      const updatedUser = await api.purchaseCourse(courseId, intent.sessionToken);
      if (!isCurrentSession(intent.sessionKey, intent.sessionToken))
        throw new api.ApiError('Сессия изменилась. Повторите действие.', 0);
      if (purchaseIntentRef.current !== intent) {
        const currentUser = await refreshUser();
        if (!currentUser || !isCurrentSession(intent.sessionKey, intent.sessionToken))
          throw new api.ApiError('Сессия изменилась. Повторите действие.', 0);
        return currentUser;
      }
      setUser(updatedUser);
      return updatedUser;
    },
    [isCurrentSession, refreshUser],
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      authError,
      sessionKey,
      sessionToken,
      openAuth,
      login,
      register,
      logout,
      updateName,
      buyCourse,
      confirmPurchase,
      refreshUser,
      hasPurchased: (courseId) => Boolean(user?.purchases?.includes(courseId)),
      accessKey: user ? `${user.id}:${user.purchases?.join(',') ?? ''}` : 'guest',
    }),
    [
      user,
      ready,
      authError,
      sessionKey,
      sessionToken,
      openAuth,
      login,
      register,
      logout,
      updateName,
      buyCourse,
      confirmPurchase,
      refreshUser,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        open={auth.open}
        mode={auth.mode}
        message={auth.message}
        onModeChange={(mode) => setAuth((current) => ({ ...current, mode }))}
        onClose={closeAuth}
        onLogin={login}
        onRegister={register}
      />
      <PurchaseModal
        key={purchaseIntent?.id ?? 'closed'}
        course={purchaseIntent?.course ?? null}
        onClose={() => closePurchase(purchaseIntent)}
        onConfirm={(courseId) => confirmPurchase(courseId, purchaseIntent)}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри <AuthProvider>');
  return ctx;
}
