export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export interface Question {
  id: string;
  categoryId: string;
  subcategoryId: string;
  imagePath: string;
  imageHash?: string;
  options: string[];
  correctAnswer: string;
  difficulty: "kolay" | "orta" | "zor";
  year?: number;
  examType?: string;
  bookmarked?: boolean;
}

export interface UserAnswer {
  questionId: string;
  selectedAnswer: string | null;
  isCorrect: boolean;
  answeredAt: number;
  timeSpent: number;
}

export interface QuizSession {
  id: string;
  categoryId: string;
  subcategoryId?: string;
  questions: string[];
  answers: Record<string, UserAnswer>;
  startedAt: number;
  completedAt?: number;
  score: QuizScore;
}

export interface QuizScore {
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  netScore: number;
  percentage: number;
}

export interface SessionRecord {
  id: string;
  date: number;
  categoryId: string | null;
  total: number;
  correct: number;
  incorrect: number;
  netScore: number;
  percentage: number;
  timeSpent: number;
}

export interface UserStats {
  totalQuestionsSolved: number;
  totalCorrect: number;
  totalIncorrect: number;
  categoryStats: Record<string, {
    solved: number;
    correct: number;
    incorrect: number;
  }>;
  lastActiveAt: number;
  sessionHistory: SessionRecord[];
}

export type ThemeMode = "light" | "dark";
