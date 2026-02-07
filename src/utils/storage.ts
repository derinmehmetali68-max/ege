import type { Question, UserStats } from "../types";

const QUESTIONS_KEY = "ege-soru-bankasi-questions";
const STATS_KEY = "ege-soru-bankasi-stats";

export function getStoredQuestions(): Question[] {
  try {
    const data = localStorage.getItem(QUESTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveQuestions(questions: Question[]): void {
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
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

export function getUserStats(): UserStats {
  try {
    const data = localStorage.getItem(STATS_KEY);
    return data
      ? JSON.parse(data)
      : {
          totalQuestionsSolved: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          categoryStats: {},
          lastActiveAt: Date.now(),
        };
  } catch {
    return {
      totalQuestionsSolved: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      categoryStats: {},
      lastActiveAt: Date.now(),
    };
  }
}

export function saveUserStats(stats: UserStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function getStoredImages(): Record<string, string> {
  try {
    const data = localStorage.getItem("ege-soru-images");
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveImageData(questionId: string, dataUrl: string): void {
  const images = getStoredImages();
  images[questionId] = dataUrl;
  localStorage.setItem("ege-soru-images", JSON.stringify(images));
}

export function deleteImageData(questionId: string): void {
  const images = getStoredImages();
  delete images[questionId];
  localStorage.setItem("ege-soru-images", JSON.stringify(images));
}
