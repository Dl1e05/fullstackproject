import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Прогресс, избранное и результаты тестов хранятся в localStorage,
// поэтому сохраняются после повторного открытия сайта (критерий MVP).
const STORAGE_KEY = 'shag:progress:v1';
export const PASS_THRESHOLD = 0.7;

const initialState = {
  completed: {}, // { [courseId]: string[] lessonIds }
  saved: [], // courseIds
  quiz: {}, // { [courseId]: { score, total, passed, date } }
  last: {}, // { [courseId]: { lessonId, at } }
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...initialState, ...JSON.parse(raw) } : initialState;
  } catch {
    return initialState;
  }
}

const ProgressContext = createContext(null);

export function ProgressProvider({ children }) {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* приватный режим или переполнение — работаем без сохранения */
    }
  }, [state]);

  const completeLesson = useCallback((courseId, lessonId) => {
    setState((s) => {
      const list = s.completed[courseId] ?? [];
      if (list.includes(lessonId)) return s;
      return { ...s, completed: { ...s.completed, [courseId]: [...list, lessonId] } };
    });
  }, []);

  const visitLesson = useCallback((courseId, lessonId) => {
    setState((s) => ({ ...s, last: { ...s.last, [courseId]: { lessonId, at: Date.now() } } }));
  }, []);

  const toggleSaved = useCallback((courseId) => {
    setState((s) => ({
      ...s,
      saved: s.saved.includes(courseId) ? s.saved.filter((id) => id !== courseId) : [...s.saved, courseId],
    }));
  }, []);

  const saveQuizResult = useCallback((courseId, score, total) => {
    setState((s) => {
      const prev = s.quiz[courseId];
      const passed = score / total >= PASS_THRESHOLD || !!prev?.passed;
      const best = Math.max(score, prev?.score ?? 0);
      return { ...s, quiz: { ...s.quiz, [courseId]: { score: best, total, passed, date: Date.now() } } };
    });
  }, []);


  const resetAll = useCallback(() => setState(initialState), []);

  const value = useMemo(() => {
    const isLessonDone = (courseId, lessonId) => (state.completed[courseId] ?? []).includes(lessonId);
    const isSaved = (courseId) => state.saved.includes(courseId);

    function getCourseProgress(course) {
      const done = (state.completed[course.id] ?? []).length;
      const total = course.lessonsCount ?? course.lessons?.length ?? 0;
      return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
    }

    // 'new' | 'in-progress' | 'completed'
    function getCourseStatus(courseId) {
      if (state.quiz[courseId]?.passed) return 'completed';
      if ((state.completed[courseId] ?? []).length || state.last[courseId]) return 'in-progress';
      return 'new';
    }

    const stats = {
      lessonsDone: Object.values(state.completed).reduce((s, l) => s + l.length, 0),
      coursesDone: Object.values(state.quiz).filter((q) => q.passed).length,
      saved: state.saved.length,
    };

    return {
      state,
      stats,
      completeLesson,
      visitLesson,
      toggleSaved,
      saveQuizResult,
      resetAll,
      isLessonDone,
      isSaved,
      getCourseProgress,
      getCourseStatus,
    };
  }, [state, completeLesson, visitLesson, toggleSaved, saveQuizResult, resetAll]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress должен использоваться внутри <ProgressProvider>');
  return ctx;
}
