import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../services/api.js';
import { useAuth } from './useAuth.jsx';

const LEGACY_STORAGE_KEY = 'shag:progress:v1';
const GUEST_STORAGE_KEY = 'shag:progress:guest:v1';
export const PASS_THRESHOLD = 0.7;

const emptyStats = { lessonsDone: 0, coursesDone: 0, saved: 0 };
const ProgressContext = createContext(null);

function newInitialState() {
  return { completed: {}, saved: [], quiz: {}, last: {} };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidId(value) {
  return typeof value === 'string' && value.length > 0;
}

function normalizeState(value) {
  return {
    completed: Object.fromEntries(
      Object.entries(isRecord(value?.completed) ? value.completed : {})
        .filter(([courseId, lessonIds]) => isValidId(courseId) && Array.isArray(lessonIds))
        .map(([courseId, lessonIds]) => [courseId, [...new Set(lessonIds.filter(isValidId))]]),
    ),
    saved: [...new Set((Array.isArray(value?.saved) ? value.saved : []).filter(isValidId))],
    quiz: Object.fromEntries(
      Object.entries(isRecord(value?.quiz) ? value.quiz : {}).filter(([, result]) =>
        isRecord(result) &&
        Number.isInteger(result.score) &&
        Number.isInteger(result.total) &&
        result.total > 0 &&
        result.score >= 0 &&
        result.score <= result.total &&
        typeof result.passed === 'boolean' &&
        Number.isFinite(result.date),
      ),
    ),
    last: Object.fromEntries(
      Object.entries(isRecord(value?.last) ? value.last : {}).filter(([, visit]) =>
        isRecord(visit) && isValidId(visit.lessonId) && Number.isFinite(visit.at),
      ),
    ),
  };
}

function readGuestState() {
  try {
    const guestData = localStorage.getItem(GUEST_STORAGE_KEY);
    if (guestData !== null) return normalizeState(JSON.parse(guestData));

    const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyData === null) return newInitialState();

    const legacyState = normalizeState(JSON.parse(legacyData));
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(legacyState));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacyState;
  } catch {
    return newInitialState();
  }
}

function writeGuestState(state) {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Браузер может отключить локальное хранилище или ограничить его объем.
  }
}

function deriveStats(state) {
  return {
    lessonsDone: Object.values(state.completed).reduce((sum, lessons) => sum + lessons.length, 0),
    coursesDone: Object.values(state.quiz).filter((result) => result?.passed).length,
    saved: state.saved.length,
  };
}

function normalizeStats(value) {
  return {
    lessonsDone: Number.isInteger(value?.lessonsDone) && value.lessonsDone >= 0 ? value.lessonsDone : 0,
    coursesDone: Number.isInteger(value?.coursesDone) && value.coursesDone >= 0 ? value.coursesDone : 0,
    saved: Number.isInteger(value?.saved) && value.saved >= 0 ? value.saved : 0,
  };
}

function addCompletedLesson(state, courseId, lessonId) {
  const lessons = state.completed[courseId] ?? [];
  if (lessons.includes(lessonId)) return state;
  return { ...state, completed: { ...state.completed, [courseId]: [...lessons, lessonId] } };
}

function addVisit(state, courseId, lessonId) {
  return { ...state, last: { ...state.last, [courseId]: { lessonId, at: Date.now() } } };
}

function setSaved(state, courseId, saved) {
  const hasCourse = state.saved.includes(courseId);
  if (saved === hasCourse) return state;
  return {
    ...state,
    saved: saved ? [...state.saved, courseId] : state.saved.filter((id) => id !== courseId),
  };
}

function addQuizResult(state, courseId, result) {
  const previous = state.quiz[courseId];
  const isBetter =
    !previous || result.score * previous.total >= previous.score * result.total;
  const best = isBetter ? result : previous;
  return {
    ...state,
    quiz: {
      ...state.quiz,
      [courseId]: {
        score: best.score,
        total: best.total,
        passed: Boolean(previous?.passed || result.passed),
        date: best.date,
      },
    },
  };
}

function progressError(authError) {
  return authError ?? new api.ApiError('Не удалось определить аккаунт. Повторите попытку.', 0);
}

function staleSessionError() {
  return new api.ApiError('Сессия изменилась. Повторите действие.', 0);
}

export function ProgressProvider({ children }) {
  const { user, ready: authReady, sessionKey, sessionToken, authError, refreshUser } = useAuth();
  const accountSession = user !== null;
  const isGuestSession = !user && sessionKey.startsWith('guest:');
  const [state, setState] = useState(newInitialState);
  const stateRef = useRef(state);
  const [dataOwner, setDataOwner] = useState(sessionKey);
  const dataOwnerRef = useRef(sessionKey);
  const [serverStats, setServerStats] = useState(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const pendingTasksRef = useRef(new Map());
  const authRef = useRef({ user, authReady, sessionKey, sessionToken, authError });
  const progressRef = useRef({ ready, loading, error });
  const refreshSequenceRef = useRef(0);

  authRef.current = { user, authReady, sessionKey, sessionToken, authError };
  const ownsData = dataOwner === sessionKey;
  const visibleState = ownsData ? state : newInitialState();
  const visibleReady = ownsData && ready;
  const visibleLoading = !ownsData || loading;
  const visibleError = ownsData ? error : null;
  progressRef.current = {
    ready: visibleReady,
    loading: visibleLoading,
    error: visibleError,
    owner: ownsData ? dataOwner : null,
  };

  const isCurrentSession = useCallback((expectedSession, expectedToken) => {
    return (
      authRef.current.sessionKey === expectedSession &&
      authRef.current.sessionToken === expectedToken &&
      api.getSessionToken() === expectedToken
    );
  }, []);

  const commitState = useCallback((expectedSession, nextState, nextServerStats) => {
    stateRef.current = nextState;
    dataOwnerRef.current = expectedSession;
    setDataOwner(expectedSession);
    setState(nextState);
    setServerStats(nextServerStats);
  }, []);

  const setCurrentError = useCallback(
    (nextError, expectedSession, expectedToken) => {
      if (!isCurrentSession(expectedSession, expectedToken) || dataOwnerRef.current !== expectedSession) return;
      setError(nextError);
    },
    [isCurrentSession],
  );

  const loadAccountSnapshot = useCallback(
    async (expectedSession, token) => {
      const sequence = ++refreshSequenceRef.current;
      const [progress, stats] = await Promise.all([api.getProgress(token), api.getProgressStats(token)]);
      if (!isCurrentSession(expectedSession, token) || sequence !== refreshSequenceRef.current) return false;
      commitState(expectedSession, normalizeState(progress), normalizeStats(stats));
      setError(null);
      setReady(true);
      return true;
    },
    [commitState, isCurrentSession],
  );

  useEffect(() => {
    let alive = true;
    const expectedSession = sessionKey;
    const token = sessionToken;

    if (dataOwnerRef.current !== expectedSession) {
      pendingTasksRef.current = new Map();
      setPendingCount(0);
      commitState(expectedSession, newInitialState(), null);
    }

    setLoading(true);
    setReady(false);
    setError(null);

    if (!authReady) {
      return () => {
        alive = false;
      };
    }

    if (user && token) {
      loadAccountSnapshot(expectedSession, token)
        .catch((loadError) => {
          if (!alive || !isCurrentSession(expectedSession, token)) return;
          commitState(expectedSession, newInitialState(), null);
          setError(loadError);
          setReady(false);
        })
        .finally(() => {
          if (alive && isCurrentSession(expectedSession, token)) setLoading(false);
        });
    } else if (!user && expectedSession.startsWith('guest:') && !token) {
      const guestState = readGuestState();
      if (alive && isCurrentSession(expectedSession, token)) {
        commitState(expectedSession, guestState, null);
        setError(null);
        setReady(true);
        setLoading(false);
      }
    } else {
      const nextError = progressError(authError);
      if (alive && isCurrentSession(expectedSession, token)) {
        commitState(expectedSession, newInitialState(), null);
        setError(nextError);
        setReady(true);
        setLoading(false);
      }
    }

    return () => {
      alive = false;
    };
  }, [
    authReady,
    authError,
    commitState,
    isCurrentSession,
    loadAccountSnapshot,
    sessionKey,
    sessionToken,
    user?.id,
  ]);

  useEffect(() => {
    if (
      dataOwner === sessionKey &&
      ready &&
      isGuestSession &&
      !sessionToken &&
      !api.getSessionToken()
    )
      writeGuestState(state);
  }, [dataOwner, isGuestSession, ready, sessionKey, sessionToken, state]);

  const refresh = useCallback(async () => {
    const currentAuth = authRef.current;
    const expectedSession = currentAuth.sessionKey;
    const token = currentAuth.sessionToken;
    setLoading(true);

    try {
      if (currentAuth.user && token) {
        return await loadAccountSnapshot(expectedSession, token);
      }

      if (!currentAuth.user && expectedSession.startsWith('guest:') && !token) {
        if (isCurrentSession(expectedSession, token)) {
          const guestState = readGuestState();
          commitState(expectedSession, guestState, null);
          setError(null);
          setReady(true);
          return true;
        }
        return false;
      }

      if (!currentAuth.user && expectedSession.startsWith('restore:') && token) {
        const restoredUser = await refreshUser();
        if (!restoredUser || !isCurrentSession(expectedSession, token)) return false;
        return await loadAccountSnapshot(expectedSession, token);
      }

      throw progressError(currentAuth.authError);
    } catch (refreshError) {
      setCurrentError(refreshError, expectedSession, token);
      throw refreshError;
    } finally {
      if (isCurrentSession(expectedSession, token)) setLoading(false);
    }
  }, [commitState, isCurrentSession, loadAccountSnapshot, refreshUser, setCurrentError]);

  const runPending = useCallback((key, operation) => {
    const existing = pendingTasksRef.current.get(key);
    if (existing) return existing;

    setPendingCount((count) => count + 1);
    const task = Promise.resolve()
      .then(operation)
      .finally(() => {
        if (pendingTasksRef.current.get(key) === task) {
          pendingTasksRef.current.delete(key);
          setPendingCount((count) => Math.max(0, count - 1));
        }
      });
    pendingTasksRef.current.set(key, task);
    return task;
  }, []);

  const refreshAfterWrite = useCallback(
    async (expectedSession, token) => {
      try {
        await loadAccountSnapshot(expectedSession, token);
      } catch (refreshError) {
        setCurrentError(refreshError, expectedSession, token);
      }
    },
    [loadAccountSnapshot, setCurrentError],
  );

  const assertMutationReady = useCallback(
    (expectedSession, token, account) => {
      if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
      if (
        progressRef.current.owner !== expectedSession ||
        !progressRef.current.ready ||
        progressRef.current.loading
      )
        throw progressRef.current.error ?? progressError(authRef.current.authError);
      const guest = !account && expectedSession.startsWith('guest:') && token === null;
      if ((account && !token) || (!account && !guest)) throw progressError(authRef.current.authError);
    },
    [isCurrentSession],
  );

  const completeLesson = useCallback(
    (courseId, lessonId) => {
      const expectedSession = sessionKey;
      const token = sessionToken;
      const account = accountSession;
      const key = `${expectedSession}:complete:${courseId}:${lessonId}`;

      return runPending(key, async () => {
        assertMutationReady(expectedSession, token, account);

        setCurrentError(null, expectedSession, token);
        try {
          if (account) await api.completeLesson(courseId, lessonId, token);
        } catch (writeError) {
          if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
          setCurrentError(writeError, expectedSession, token);
          throw writeError;
        }

        if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
        const nextState = addCompletedLesson(stateRef.current, courseId, lessonId);
        commitState(expectedSession, nextState, account ? deriveStats(nextState) : null);
        if (account) await refreshAfterWrite(expectedSession, token);
        if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
        return true;
      });
    },
    [
      assertMutationReady,
      commitState,
      isCurrentSession,
      refreshAfterWrite,
      runPending,
      sessionKey,
      sessionToken,
      setCurrentError,
      accountSession,
    ],
  );

  const visitLesson = useCallback(
    (courseId, lessonId) => {
      const expectedSession = sessionKey;
      const token = sessionToken;
      const account = accountSession;
      const key = `${expectedSession}:visit:${courseId}:${lessonId}`;

      return runPending(key, async () => {
        assertMutationReady(expectedSession, token, account);

        setCurrentError(null, expectedSession, token);
        try {
          if (account) await api.visitLesson(courseId, lessonId, token);
        } catch (writeError) {
          if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
          setCurrentError(writeError, expectedSession, token);
          throw writeError;
        }

        if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
        const nextState = addVisit(stateRef.current, courseId, lessonId);
        commitState(expectedSession, nextState, account ? deriveStats(nextState) : null);
        if (account) await refreshAfterWrite(expectedSession, token);
        if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
        return true;
      });
    },
    [
      assertMutationReady,
      commitState,
      isCurrentSession,
      refreshAfterWrite,
      runPending,
      sessionKey,
      sessionToken,
      setCurrentError,
      accountSession,
    ],
  );

  const toggleSaved = useCallback(
    (courseId) => {
      const expectedSession = sessionKey;
      const token = sessionToken;
      const account = accountSession;
      const targetSaved = !stateRef.current.saved.includes(courseId);
      const key = `${expectedSession}:saved:${courseId}`;

      return runPending(key, async () => {
        assertMutationReady(expectedSession, token, account);

        setCurrentError(null, expectedSession, token);
        try {
          if (account) await api.setCourseSaved(courseId, targetSaved, token);
        } catch (writeError) {
          if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
          setCurrentError(writeError, expectedSession, token);
          throw writeError;
        }

        if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
        const nextState = setSaved(stateRef.current, courseId, targetSaved);
        commitState(expectedSession, nextState, account ? deriveStats(nextState) : null);
        if (account) await refreshAfterWrite(expectedSession, token);
        if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
        return true;
      });
    },
    [
      assertMutationReady,
      commitState,
      isCurrentSession,
      refreshAfterWrite,
      runPending,
      sessionKey,
      sessionToken,
      setCurrentError,
      accountSession,
    ],
  );

  const resetAll = useCallback(() => {
    const expectedSession = sessionKey;
    const token = sessionToken;
    const account = accountSession;

    return runPending(`${expectedSession}:reset`, async () => {
      assertMutationReady(expectedSession, token, account);

      setCurrentError(null, expectedSession, token);
      try {
        if (account) await api.resetProgress(token);
      } catch (writeError) {
        if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
        setCurrentError(writeError, expectedSession, token);
        throw writeError;
      }

      if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
      commitState(expectedSession, newInitialState(), account ? emptyStats : null);
      if (account) await refreshAfterWrite(expectedSession, token);
      if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
      return true;
    });
  }, [
    assertMutationReady,
    commitState,
    isCurrentSession,
    refreshAfterWrite,
    runPending,
    sessionKey,
    sessionToken,
    setCurrentError,
    accountSession,
  ]);

  const submitQuiz = useCallback(
    (courseId, answers, clientAttemptId) => {
      const expectedSession = sessionKey;
      const token = sessionToken;
      const account = accountSession;

      return runPending(`${expectedSession}:quiz:${courseId}`, async () => {
        assertMutationReady(expectedSession, token, account);

        setCurrentError(null, expectedSession, token);
        let result;
        try {
          result = await api.submitQuizAttempt(courseId, answers, clientAttemptId, account ? token : null);
        } catch (writeError) {
          if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
          setCurrentError(writeError, expectedSession, token);
          throw writeError;
        }

        if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
        const nextState = addQuizResult(stateRef.current, courseId, result);
        commitState(expectedSession, nextState, account ? deriveStats(nextState) : null);
        if (account) await refreshAfterWrite(expectedSession, token);
        if (!isCurrentSession(expectedSession, token)) throw staleSessionError();
        return result;
      });
    },
    [
      assertMutationReady,
      commitState,
      isCurrentSession,
      refreshAfterWrite,
      runPending,
      sessionKey,
      sessionToken,
      setCurrentError,
      accountSession,
    ],
  );

  const value = useMemo(() => {
    const stats = accountSession
      ? (ownsData ? serverStats : null) ?? deriveStats(visibleState)
      : deriveStats(visibleState);
    const isLessonDone = (courseId, lessonId) => (visibleState.completed[courseId] ?? []).includes(lessonId);
    const isSaved = (courseId) => visibleState.saved.includes(courseId);

    function getCourseProgress(course) {
      const done = (visibleState.completed[course.id] ?? []).length;
      const total = course.lessonsCount ?? course.lessons?.length ?? 0;
      return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
    }

    function getCourseStatus(courseId) {
      if (visibleState.quiz[courseId]?.passed) return 'completed';
      if ((visibleState.completed[courseId] ?? []).length || visibleState.last[courseId]) return 'in-progress';
      return 'new';
    }

    return {
      state: visibleState,
      stats,
      ready: visibleReady,
      loading: visibleLoading,
      error: visibleError,
      refresh,
      pending: ownsData && pendingCount > 0,
      completeLesson,
      visitLesson,
      toggleSaved,
      resetAll,
      submitQuiz,
      isLessonDone,
      isSaved,
      getCourseProgress,
      getCourseStatus,
    };
  }, [
    completeLesson,
    accountSession,
    pendingCount,
    refresh,
    resetAll,
    serverStats,
    submitQuiz,
    toggleSaved,
    visitLesson,
    ownsData,
    visibleError,
    visibleLoading,
    visibleReady,
    visibleState,
  ]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress должен использоваться внутри <ProgressProvider>');
  return ctx;
}
