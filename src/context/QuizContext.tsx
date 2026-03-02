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
  KahootState,
  PowerUpType,
} from "../types";
import { calculateScore } from "../utils/scoring";
import { calculateKahootPoints, getDefaultPowerUps } from "../utils/kahootScoring";
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

const DEFAULT_COUNTDOWN = 30;
const LOBBY_COUNTDOWN = 5;

function initKahoot(): KahootState {
  return {
    enabled: false,
    totalPoints: 0,
    streak: 0,
    bestStreak: 0,
    countdownPerQuestion: DEFAULT_COUNTDOWN,
    countdownRemaining: DEFAULT_COUNTDOWN,
    powerUps: getDefaultPowerUps(),
    eliminatedOptions: [],
    doublePointsActive: false,
    freezeTimeActive: false,
    showAnswerDistribution: false,
    lobbyCountdown: LOBBY_COUNTDOWN,
    inLobby: false,
  };
}

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
  kahoot: KahootState;
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
        kahootMode?: boolean;
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
  | { type: "REVIEW_GO_TO"; payload: number }
  | { type: "KAHOOT_COUNTDOWN_TICK" }
  | { type: "KAHOOT_USE_POWERUP"; payload: PowerUpType }
  | { type: "KAHOOT_DISMISS_DISTRIBUTION" }
  | { type: "KAHOOT_LOBBY_TICK" }
  | { type: "KAHOOT_LOBBY_DONE" };

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
    kahoot: initKahoot(),
  };
}

function reducer(state: QuizState, action: Action): QuizState {
  switch (action.type) {
    case "SET_QUESTIONS": {
      saveQuestions(action.payload);
      return { ...state, questions: action.payload };
    }

    case "START_QUIZ": {
      const { categoryId, subcategoryId, difficulty, count, bookmarkedOnly, kahootMode } = action.payload;
      let filtered = [...state.questions];
      if (categoryId) filtered = filtered.filter((q) => q.categoryId === categoryId);
      if (subcategoryId) filtered = filtered.filter((q) => q.subcategoryId === subcategoryId);
      if (difficulty) filtered = filtered.filter((q) => q.difficulty === difficulty);
      if (bookmarkedOnly) filtered = filtered.filter((q) => q.bookmarked);
      const shuffled = shuffleArray(filtered);
      const selected = count ? shuffled.slice(0, count) : shuffled;

      const kahoot: KahootState = {
        ...initKahoot(),
        enabled: !!kahootMode,
        inLobby: !!kahootMode,
        lobbyCountdown: LOBBY_COUNTDOWN,
        countdownRemaining: DEFAULT_COUNTDOWN,
      };

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
        kahoot,
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
        kahootPoints: state.kahoot.enabled ? state.kahoot.totalPoints : undefined,
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
      const isCorrect = answer === question.correctAnswer;

      let kahootPoints = 0;
      let newStreak = state.kahoot.streak;
      let bestStreak = state.kahoot.bestStreak;

      if (state.kahoot.enabled) {
        if (isCorrect) {
          newStreak = state.kahoot.streak + 1;
          kahootPoints = calculateKahootPoints(
            timeSpent,
            state.kahoot.countdownPerQuestion,
            true,
            newStreak,
            state.kahoot.doublePointsActive
          );
        } else {
          newStreak = 0;
        }
        bestStreak = Math.max(bestStreak, newStreak);
      }

      const userAnswer: UserAnswer = {
        questionId,
        selectedAnswer: answer,
        isCorrect,
        answeredAt: now,
        timeSpent,
        kahootPoints,
        streak: newStreak,
      };
      const newAnswers = { ...state.answers, [questionId]: userAnswer };
      const score = calculateScore(newAnswers, state.sessionQuestions.length);

      return {
        ...state,
        answers: newAnswers,
        score,
        kahoot: {
          ...state.kahoot,
          totalPoints: state.kahoot.totalPoints + kahootPoints,
          streak: newStreak,
          bestStreak,
          doublePointsActive: false,
          freezeTimeActive: false,
          showAnswerDistribution: state.kahoot.enabled,
          eliminatedOptions: [],
        },
      };
    }

    case "GO_TO_QUESTION": {
      const idx = Math.max(0, Math.min(action.payload, state.sessionQuestions.length - 1));
      return {
        ...state,
        currentIndex: idx,
        questionStartTime: Date.now(),
        kahoot: {
          ...state.kahoot,
          countdownRemaining: state.kahoot.countdownPerQuestion,
          showAnswerDistribution: false,
          eliminatedOptions: [],
          doublePointsActive: false,
          freezeTimeActive: false,
        },
      };
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

    case "KAHOOT_COUNTDOWN_TICK": {
      if (!state.kahoot.enabled || state.kahoot.freezeTimeActive) return state;
      const remaining = state.kahoot.countdownRemaining - 1;
      if (remaining <= 0) {
        const question = state.sessionQuestions[state.currentIndex];
        if (question && !state.answers[question.id]) {
          const now = Date.now();
          const timeSpent = Math.round((now - state.questionStartTime) / 1000);
          const userAnswer: UserAnswer = {
            questionId: question.id,
            selectedAnswer: null,
            isCorrect: false,
            answeredAt: now,
            timeSpent,
            kahootPoints: 0,
            streak: 0,
          };
          const newAnswers = { ...state.answers, [question.id]: userAnswer };
          const score = calculateScore(newAnswers, state.sessionQuestions.length);
          return {
            ...state,
            answers: newAnswers,
            score,
            kahoot: {
              ...state.kahoot,
              countdownRemaining: 0,
              streak: 0,
              showAnswerDistribution: true,
            },
          };
        }
      }
      return {
        ...state,
        kahoot: { ...state.kahoot, countdownRemaining: remaining },
      };
    }

    case "KAHOOT_USE_POWERUP": {
      const powerUpType = action.payload;
      const kahoot = { ...state.kahoot };
      const question = state.sessionQuestions[state.currentIndex];

      kahoot.powerUps = kahoot.powerUps.map((p) =>
        p.type === powerUpType ? { ...p, used: true } : p
      );

      switch (powerUpType) {
        case "fiftyFifty": {
          if (question) {
            const wrongOptions = question.options.filter((o) => o !== question.correctAnswer);
            const shuffled = shuffleArray(wrongOptions);
            kahoot.eliminatedOptions = shuffled.slice(0, 2);
          }
          break;
        }
        case "doublePoints":
          kahoot.doublePointsActive = true;
          break;
        case "freezeTime":
          kahoot.freezeTimeActive = true;
          break;
      }

      return { ...state, kahoot };
    }

    case "KAHOOT_DISMISS_DISTRIBUTION":
      return {
        ...state,
        kahoot: { ...state.kahoot, showAnswerDistribution: false },
      };

    case "KAHOOT_LOBBY_TICK": {
      const remaining = state.kahoot.lobbyCountdown - 1;
      if (remaining <= 0) {
        return {
          ...state,
          kahoot: { ...state.kahoot, lobbyCountdown: 0, inLobby: false },
          questionStartTime: Date.now(),
        };
      }
      return {
        ...state,
        kahoot: { ...state.kahoot, lobbyCountdown: remaining },
      };
    }

    case "KAHOOT_LOBBY_DONE":
      return {
        ...state,
        kahoot: { ...state.kahoot, inLobby: false, lobbyCountdown: 0 },
        questionStartTime: Date.now(),
      };

    default:
      return state;
  }
}

interface QuizContextType {
  state: QuizState;
  setQuestions: (q: Question[]) => void;
  startQuiz: (opts: { categoryId?: string; subcategoryId?: string; difficulty?: string; count?: number; bookmarkedOnly?: boolean; kahootMode?: boolean }) => void;
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
  kahootCountdownTick: () => void;
  kahootUsePowerUp: (type: PowerUpType) => void;
  kahootDismissDistribution: () => void;
  kahootLobbyTick: () => void;
  kahootLobbyDone: () => void;
}

const QuizContext = createContext<QuizContextType | null>(null);

export function QuizProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  const setQuestions = useCallback((q: Question[]) => dispatch({ type: "SET_QUESTIONS", payload: q }), []);
  const startQuiz = useCallback((opts: { categoryId?: string; subcategoryId?: string; difficulty?: string; count?: number; bookmarkedOnly?: boolean; kahootMode?: boolean }) => dispatch({ type: "START_QUIZ", payload: opts }), []);
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
  const kahootCountdownTick = useCallback(() => dispatch({ type: "KAHOOT_COUNTDOWN_TICK" }), []);
  const kahootUsePowerUp = useCallback((type: PowerUpType) => dispatch({ type: "KAHOOT_USE_POWERUP", payload: type }), []);
  const kahootDismissDistribution = useCallback(() => dispatch({ type: "KAHOOT_DISMISS_DISTRIBUTION" }), []);
  const kahootLobbyTick = useCallback(() => dispatch({ type: "KAHOOT_LOBBY_TICK" }), []);
  const kahootLobbyDone = useCallback(() => dispatch({ type: "KAHOOT_LOBBY_DONE" }), []);

  return (
    <QuizContext.Provider value={{
      state, setQuestions, startQuiz, endQuiz, submitAnswer, goToQuestion,
      goNext, goPrev, setCategory, setSubcategory, setDifficulty, resetStats,
      toggleBookmark, deleteQuestionById, updateQuestionById,
      enterReview, exitReview, reviewGoTo,
      kahootCountdownTick, kahootUsePowerUp, kahootDismissDistribution,
      kahootLobbyTick, kahootLobbyDone,
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
