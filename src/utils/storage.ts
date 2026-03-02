import type { Question, UserStats } from "../types";

const QUESTIONS_KEY = "ege-soru-bankasi-questions";
const STATS_KEY = "ege-soru-bankasi-stats";

const defaultStats: UserStats = {
  totalQuestionsSolved: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  categoryStats: {},
  lastActiveAt: Date.now(),
  sessionHistory: [],
};

export function getStoredQuestions(): Question[] {
  try {
    const data = localStorage.getItem(QUESTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveQuestions(questions: Question[]): void {
  try {
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
  } catch (e) {
    console.error("Storage quota exceeded for questions", e);
  }
}

export function addQuestions(newQuestions: Question[]): Question[] {
  const existing = getStoredQuestions();
  const existingIds = new Set(existing.map((q) => q.id));
  const unique = newQuestions.filter((q) => !existingIds.has(q.id));
  const merged = [...existing, ...unique];
  saveQuestions(merged);
  return merged;
}

export function deleteQuestion(id: string): Question[] {
  const existing = getStoredQuestions();
  const filtered = existing.filter((q) => q.id !== id);
  saveQuestions(filtered);
  return filtered;
}

export function updateQuestion(id: string, updates: Partial<Question>): Question[] {
  const existing = getStoredQuestions();
  const updated = existing.map((q) => (q.id === id ? { ...q, ...updates } : q));
  saveQuestions(updated);
  return updated;
}

export function getUserStats(): UserStats {
  try {
    const data = localStorage.getItem(STATS_KEY);
    if (!data) return { ...defaultStats };
    const parsed = JSON.parse(data);
    return { ...defaultStats, ...parsed };
  } catch {
    return { ...defaultStats };
  }
}

export function saveUserStats(stats: UserStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error("Storage quota exceeded for stats", e);
  }
}

export function exportData(): { questions: Question[]; stats: UserStats } {
  return { questions: getStoredQuestions(), stats: getUserStats() };
}

export function importData(data: { questions: Question[] }): Question[] {
  if (data.questions) {
    return addQuestions(data.questions);
  }
  return getStoredQuestions();
}
