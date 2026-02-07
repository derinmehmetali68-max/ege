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
} from "../types";
import { calculateScore } from "../utils/scoring";
import {
  getStoredQuestions,
  saveQuestions,
  getUserStats,
  saveUserStats,
} from "../utils/storage";
import { shuffleArray, generateId } from "../utils/shuffle";
import categoriesData from "../data/categories.json";

interface QuizState {
  questions: Question[];
  categories: Category[];
  userStats: UserStats;
  // quiz session
  sessionId: string | null;
  sessionQuestions: Question[];
  currentIndex: number;
  answers: Record<string, UserAnswer>;
  isCompleted: boolean;
  score: QuizScore;
  // filters
  selectedCategory: string | null;
  selectedSubcategory: string | null;
  selectedDifficulty: string | null;
}

type Action =
  | { type: "LOAD_QUESTIONS"; payload: Question[] }
  | { type: "SET_QUESTIONS"; payload: Question[] }
  | {
      type: "START_QUIZ";
      payload: {
        categoryId?: string;
        subcategoryId?: string;
        difficulty?: string;
        count?: number;
      };
    }
  | { type: "END_QUIZ" }
  | {
      type: "SUBMIT_ANSWER";
      payload: { questionId: string; answer: string };
    }
  | { type: "GO_TO_QUESTION"; payload: number }
  | { type: "SET_CATEGORY"; payload: string | null }
  | { type: "SET_SUBCATEGORY"; payload: string | null }
  | { type: "SET_DIFFICULTY"; payload: string | null }
  | { type: "RESET_STATS" };

const emptyScore: QuizScore = {
  total: 0,
  correct: 0,
  incorrect: 0,
  unanswered: 0,
  netScore: 0,
  percentage: 0,
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
    selectedCategory: null,
    selectedSubcategory: null,
    selectedDifficulty: null,
  };
}

function reducer(state: QuizState, action: Action): QuizState {
  switch (action.type) {
    case "LOAD_QUESTIONS":
    case "SET_QUESTIONS": {
      saveQuestions(action.payload);
      return { ...state, questions: action.payload };
    }

    case "START_QUIZ": {
      const { categoryId, subcategoryId, difficulty, count } = action.payload;
      let filtered = [...state.questions];
      if (categoryId) filtered = filtered.filter((q) => q.categoryId === categoryId);
      if (subcategoryId) filtered = filtered.filter((q) => q.subcategoryId === subcategoryId);
      if (difficulty) filtered = filtered.filter((q) => q.difficulty === difficulty);
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
        selectedCategory: categoryId || null,
        selectedSubcategory: subcategoryId || null,
      };
    }

    case "END_QUIZ": {
      const score = calculateScore(state.answers, state.sessionQuestions.length);
      // update user stats
      const stats = { ...state.userStats };
      stats.totalQuestionsSolved += score.total;
      stats.totalCorrect += score.correct;
      stats.totalIncorrect += score.incorrect;
      stats.lastActiveAt = Date.now();
      if (state.selectedCategory) {
        const cat = stats.categoryStats[state.selectedCategory] || {
          solved: 0,
          correct: 0,
          incorrect: 0,
        };
        cat.solved += score.total;
        cat.correct += score.correct;
        cat.incorrect += score.incorrect;
        stats.categoryStats[state.selectedCategory] = cat;
      }
      saveUserStats(stats);
      return { ...state, isCompleted: true, score, userStats: stats };
    }

    case "SUBMIT_ANSWER": {
      const { questionId, answer } = action.payload;
      const question = state.sessionQuestions.find((q) => q.id === questionId);
      if (!question) return state;
      const userAnswer: UserAnswer = {
        questionId,
        selectedAnswer: answer,
        isCorrect: answer === question.correctAnswer,
        answeredAt: Date.now(),
        timeSpent: 0,
      };
      const newAnswers = { ...state.answers, [questionId]: userAnswer };
      const score = calculateScore(newAnswers, state.sessionQuestions.length);
      return { ...state, answers: newAnswers, score };
    }

    case "GO_TO_QUESTION":
      return {
        ...state,
        currentIndex: Math.max(
          0,
          Math.min(action.payload, state.sessionQuestions.length - 1)
        ),
      };

    case "SET_CATEGORY":
      return { ...state, selectedCategory: action.payload, selectedSubcategory: null };

    case "SET_SUBCATEGORY":
      return { ...state, selectedSubcategory: action.payload };

    case "SET_DIFFICULTY":
      return { ...state, selectedDifficulty: action.payload };

    case "RESET_STATS": {
      const freshStats: UserStats = {
        totalQuestionsSolved: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        categoryStats: {},
        lastActiveAt: Date.now(),
      };
      saveUserStats(freshStats);
      return { ...state, userStats: freshStats };
    }

    default:
      return state;
  }
}

interface QuizContextType {
  state: QuizState;
  loadQuestions: (q: Question[]) => void;
  setQuestions: (q: Question[]) => void;
  startQuiz: (opts: {
    categoryId?: string;
    subcategoryId?: string;
    difficulty?: string;
    count?: number;
  }) => void;
  endQuiz: () => void;
  submitAnswer: (questionId: string, answer: string) => void;
  goToQuestion: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;
  setCategory: (id: string | null) => void;
  setSubcategory: (id: string | null) => void;
  setDifficulty: (d: string | null) => void;
  resetStats: () => void;
}

const QuizContext = createContext<QuizContextType | null>(null);

export function QuizProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  const loadQuestions = useCallback(
    (q: Question[]) => dispatch({ type: "LOAD_QUESTIONS", payload: q }),
    []
  );
  const setQuestions = useCallback(
    (q: Question[]) => dispatch({ type: "SET_QUESTIONS", payload: q }),
    []
  );
  const startQuiz = useCallback(
    (opts: {
      categoryId?: string;
      subcategoryId?: string;
      difficulty?: string;
      count?: number;
    }) => dispatch({ type: "START_QUIZ", payload: opts }),
    []
  );
  const endQuiz = useCallback(() => dispatch({ type: "END_QUIZ" }), []);
  const submitAnswer = useCallback(
    (questionId: string, answer: string) =>
      dispatch({ type: "SUBMIT_ANSWER", payload: { questionId, answer } }),
    []
  );
  const goToQuestion = useCallback(
    (index: number) => dispatch({ type: "GO_TO_QUESTION", payload: index }),
    []
  );
  const goNext = useCallback(
    () =>
      dispatch({
        type: "GO_TO_QUESTION",
        payload: state.currentIndex + 1,
      }),
    [state.currentIndex]
  );
  const goPrev = useCallback(
    () =>
      dispatch({
        type: "GO_TO_QUESTION",
        payload: state.currentIndex - 1,
      }),
    [state.currentIndex]
  );
  const setCategory = useCallback(
    (id: string | null) => dispatch({ type: "SET_CATEGORY", payload: id }),
    []
  );
  const setSubcategory = useCallback(
    (id: string | null) =>
      dispatch({ type: "SET_SUBCATEGORY", payload: id }),
    []
  );
  const setDifficulty = useCallback(
    (d: string | null) => dispatch({ type: "SET_DIFFICULTY", payload: d }),
    []
  );
  const resetStats = useCallback(
    () => dispatch({ type: "RESET_STATS" }),
    []
  );

  return (
    <QuizContext.Provider
      value={{
        state,
        loadQuestions,
        setQuestions,
        startQuiz,
        endQuiz,
        submitAnswer,
        goToQuestion,
        goNext,
        goPrev,
        setCategory,
        setSubcategory,
        setDifficulty,
        resetStats,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuiz must be used within QuizProvider");
  return ctx;
}
