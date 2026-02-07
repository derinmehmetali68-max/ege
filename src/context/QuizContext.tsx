import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type {
  Question,
  QuizScore,
  UserAnswer,
  UserStats,
  Category,
  SessionRecord,
} from "../types";
import { calculateScore } from "../utils/scoring";
import {
  getStoredQuestions,
  saveQuestions,
  getUserStats,
  saveUserStats,
  updateQuestion as updateQuestionStorage,
  deleteQuestion as deleteQuestionStorage,
} from "../utils/storage";
import { shuffleArray, generateId } from "../utils/shuffle";
import categoriesData from "../data/categories.json";

interface QuizState {
  questions: Question[];
  categories: Category[];
  userStats: UserStats;
  sessionId: string | null;
  sessionQuestions: Question[];
  currentIndex: number;
  answers: Record<string, UserAnswer>;
  isCompleted: boolean;
  score: QuizScore;
  questionStartTime: number;
  totalTimeSpent: number;
  reviewMode: boolean;
  reviewIndex: number;
  selectedCategory: string | null;
  selectedSubcategory: string | null;
  selectedDifficulty: string | null;
}

type Action =
  | { type: "SET_QUESTIONS"; payload: Question[] }
  | {
      type: "START_QUIZ";
      payload: {
        categoryId?: string;
        subcategoryId?: string;
        difficulty?: string;
        count?: number;
        bookmarkedOnly?: boolean;
      };
    }
  | { type: "END_QUIZ"; payload: { totalTime: number } }
  | { type: "SUBMIT_ANSWER"; payload: { questionId: string; answer: string } }
  | { type: "GO_TO_QUESTION"; payload: number }
  | { type: "SET_CATEGORY"; payload: string | null }
  | { type: "SET_SUBCATEGORY"; payload: string | null }
  | { type: "SET_DIFFICULTY"; payload: string | null }
  | { type: "RESET_STATS" }
  | { type: "TOGGLE_BOOKMARK"; payload: string }
  | { type: "DELETE_QUESTION"; payload: string }
  | { type: "UPDATE_QUESTION"; payload: { id: string; updates: Partial<Question> } }
  | { type: "ENTER_REVIEW"; payload?: number }
  | { type: "EXIT_REVIEW" }
  | { type: "REVIEW_GO_TO"; payload: number };

const emptyScore: QuizScore = {
  total: 0, correct: 0, incorrect: 0, unanswered: 0, netScore: 0, percentage: 0,
};

function initState(): QuizState {
  return {
    questions: getStoredQuestions(),
    categories: categoriesData.categories as Category[],
    userStats: getUserStats(),
    sessionId: null,
    sessionQuestions: [],
    currentIndex: 0,
    answers: {},
    isCompleted: false,
    score: emptyScore,
    questionStartTime: Date.now(),
    totalTimeSpent: 0,
    reviewMode: false,
    reviewIndex: 0,
    selectedCategory: null,
    selectedSubcategory: null,
    selectedDifficulty: null,
  };
}

function reducer(state: QuizState, action: Action): QuizState {
  switch (action.type) {
    case "SET_QUESTIONS": {
      saveQuestions(action.payload);
      return { ...state, questions: action.payload };
    }

    case "START_QUIZ": {
      const { categoryId, subcategoryId, difficulty, count, bookmarkedOnly } = action.payload;
      let filtered = [...state.questions];
      if (categoryId) filtered = filtered.filter((q) => q.categoryId === categoryId);
      if (subcategoryId) filtered = filtered.filter((q) => q.subcategoryId === subcategoryId);
      if (difficulty) filtered = filtered.filter((q) => q.difficulty === difficulty);
      if (bookmarkedOnly) filtered = filtered.filter((q) => q.bookmarked);
      const shuffled = shuffleArray(filtered);
      const selected = count ? shuffled.slice(0, count) : shuffled;
      return {
        ...state,
        sessionId: generateId(),
        sessionQuestions: selected,
        currentIndex: 0,
        answers: {},
        isCompleted: false,
        score: { ...emptyScore, total: selected.length },
        questionStartTime: Date.now(),
        totalTimeSpent: 0,
        reviewMode: false,
        reviewIndex: 0,
        selectedCategory: categoryId || null,
        selectedSubcategory: subcategoryId || null,
      };
    }

    case "END_QUIZ": {
      const score = calculateScore(state.answers, state.sessionQuestions.length);
      const stats: UserStats = { ...state.userStats };
      stats.totalQuestionsSolved += score.total;
      stats.totalCorrect += score.correct;
      stats.totalIncorrect += score.incorrect;
      stats.lastActiveAt = Date.now();
      if (state.selectedCategory) {
        const cat = stats.categoryStats[state.selectedCategory] || { solved: 0, correct: 0, incorrect: 0 };
        cat.solved += score.total;
        cat.correct += score.correct;
        cat.incorrect += score.incorrect;
        stats.categoryStats[state.selectedCategory] = cat;
      }
      const record: SessionRecord = {
        id: state.sessionId || generateId(),
        date: Date.now(),
        categoryId: state.selectedCategory,
        total: score.total,
        correct: score.correct,
        incorrect: score.incorrect,
        netScore: score.netScore,
        percentage: score.percentage,
        timeSpent: action.payload.totalTime,
      };
      if (!stats.sessionHistory) stats.sessionHistory = [];
      stats.sessionHistory = [record, ...stats.sessionHistory].slice(0, 50);
      saveUserStats(stats);
      return { ...state, isCompleted: true, score, userStats: stats, totalTimeSpent: action.payload.totalTime };
    }

    case "SUBMIT_ANSWER": {
      const { questionId, answer } = action.payload;
      const question = state.sessionQuestions.find((q) => q.id === questionId);
      if (!question) return state;
      const now = Date.now();
      const timeSpent = Math.round((now - state.questionStartTime) / 1000);
      const userAnswer: UserAnswer = {
        questionId,
        selectedAnswer: answer,
        isCorrect: answer === question.correctAnswer,
        answeredAt: now,
        timeSpent,
      };
      const newAnswers = { ...state.answers, [questionId]: userAnswer };
      const score = calculateScore(newAnswers, state.sessionQuestions.length);
      return { ...state, answers: newAnswers, score };
    }

    case "GO_TO_QUESTION": {
      const idx = Math.max(0, Math.min(action.payload, state.sessionQuestions.length - 1));
      return { ...state, currentIndex: idx, questionStartTime: Date.now() };
    }

    case "SET_CATEGORY":
      return { ...state, selectedCategory: action.payload, selectedSubcategory: null };
    case "SET_SUBCATEGORY":
      return { ...state, selectedSubcategory: action.payload };
    case "SET_DIFFICULTY":
      return { ...state, selectedDifficulty: action.payload };

    case "RESET_STATS": {
      const fresh: UserStats = {
        totalQuestionsSolved: 0, totalCorrect: 0, totalIncorrect: 0,
        categoryStats: {}, lastActiveAt: Date.now(), sessionHistory: [],
      };
      saveUserStats(fresh);
      return { ...state, userStats: fresh };
    }

    case "TOGGLE_BOOKMARK": {
      const qId = action.payload;
      const updated = state.questions.map((q) => q.id === qId ? { ...q, bookmarked: !q.bookmarked } : q);
      saveQuestions(updated);
      const sessionUpdated = state.sessionQuestions.map((q) => q.id === qId ? { ...q, bookmarked: !q.bookmarked } : q);
      return { ...state, questions: updated, sessionQuestions: sessionUpdated };
    }

    case "DELETE_QUESTION": {
      const remaining = deleteQuestionStorage(action.payload);
      return { ...state, questions: remaining };
    }

    case "UPDATE_QUESTION": {
      const { id, updates } = action.payload;
      const updated = updateQuestionStorage(id, updates);
      return { ...state, questions: updated };
    }

    case "ENTER_REVIEW":
      return { ...state, reviewMode: true, reviewIndex: action.payload ?? 0 };
    case "EXIT_REVIEW":
      return { ...state, reviewMode: false };
    case "REVIEW_GO_TO":
      return { ...state, reviewIndex: Math.max(0, Math.min(action.payload, state.sessionQuestions.length - 1)) };

    default:
      return state;
  }
}

interface QuizContextType {
  state: QuizState;
  setQuestions: (q: Question[]) => void;
  startQuiz: (opts: { categoryId?: string; subcategoryId?: string; difficulty?: string; count?: number; bookmarkedOnly?: boolean }) => void;
  endQuiz: (totalTime: number) => void;
  submitAnswer: (questionId: string, answer: string) => void;
  goToQuestion: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;
  setCategory: (id: string | null) => void;
  setSubcategory: (id: string | null) => void;
  setDifficulty: (d: string | null) => void;
  resetStats: () => void;
  toggleBookmark: (questionId: string) => void;
  deleteQuestionById: (id: string) => void;
  updateQuestionById: (id: string, updates: Partial<Question>) => void;
  enterReview: (startIndex?: number) => void;
  exitReview: () => void;
  reviewGoTo: (index: number) => void;
}

const QuizContext = createContext<QuizContextType | null>(null);

export function QuizProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  const setQuestions = useCallback((q: Question[]) => dispatch({ type: "SET_QUESTIONS", payload: q }), []);
  const startQuiz = useCallback((opts: { categoryId?: string; subcategoryId?: string; difficulty?: string; count?: number; bookmarkedOnly?: boolean }) => dispatch({ type: "START_QUIZ", payload: opts }), []);
  const endQuiz = useCallback((totalTime: number) => dispatch({ type: "END_QUIZ", payload: { totalTime } }), []);
  const submitAnswer = useCallback((questionId: string, answer: string) => dispatch({ type: "SUBMIT_ANSWER", payload: { questionId, answer } }), []);
  const goToQuestion = useCallback((index: number) => dispatch({ type: "GO_TO_QUESTION", payload: index }), []);
  const goNext = useCallback(() => dispatch({ type: "GO_TO_QUESTION", payload: state.currentIndex + 1 }), [state.currentIndex]);
  const goPrev = useCallback(() => dispatch({ type: "GO_TO_QUESTION", payload: state.currentIndex - 1 }), [state.currentIndex]);
  const setCategory = useCallback((id: string | null) => dispatch({ type: "SET_CATEGORY", payload: id }), []);
  const setSubcategory = useCallback((id: string | null) => dispatch({ type: "SET_SUBCATEGORY", payload: id }), []);
  const setDifficulty = useCallback((d: string | null) => dispatch({ type: "SET_DIFFICULTY", payload: d }), []);
  const resetStats = useCallback(() => dispatch({ type: "RESET_STATS" }), []);
  const toggleBookmark = useCallback((qId: string) => dispatch({ type: "TOGGLE_BOOKMARK", payload: qId }), []);
  const deleteQuestionById = useCallback((id: string) => dispatch({ type: "DELETE_QUESTION", payload: id }), []);
  const updateQuestionById = useCallback((id: string, updates: Partial<Question>) => dispatch({ type: "UPDATE_QUESTION", payload: { id, updates } }), []);
  const enterReview = useCallback((startIndex?: number) => dispatch({ type: "ENTER_REVIEW", payload: startIndex }), []);
  const exitReview = useCallback(() => dispatch({ type: "EXIT_REVIEW" }), []);
  const reviewGoTo = useCallback((index: number) => dispatch({ type: "REVIEW_GO_TO", payload: index }), []);

  return (
    <QuizContext.Provider value={{
      state, setQuestions, startQuiz, endQuiz, submitAnswer, goToQuestion,
      goNext, goPrev, setCategory, setSubcategory, setDifficulty, resetStats,
      toggleBookmark, deleteQuestionById, updateQuestionById,
      enterReview, exitReview, reviewGoTo,
    }}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuiz must be used within QuizProvider");
  return ctx;
}
