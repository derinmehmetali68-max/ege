import type { QuizScore, UserAnswer } from "../types";

export function calculateScore(
  answers: Record<string, UserAnswer>,
  total: number
): QuizScore {
  let correct = 0;
  let incorrect = 0;

  Object.values(answers).forEach((a) => {
    if (a.selectedAnswer === null) return;
    if (a.isCorrect) correct++;
    else incorrect++;
  });

  const unanswered = total - correct - incorrect;
  const netScore = correct - incorrect * 0.25;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  return { total, correct, incorrect, unanswered, netScore, percentage };
}

export function calculateNetScore(
  correct: number,
  incorrect: number
): number {
  return correct - incorrect * 0.25;
}
