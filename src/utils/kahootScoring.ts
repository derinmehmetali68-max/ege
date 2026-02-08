// Kahoot-style speed-based scoring
// Max points per question: 1000
// Points decrease as time passes (faster = more points)

const MAX_POINTS = 1000;
const MIN_POINTS = 100;

export function calculateKahootPoints(
  timeSpentSeconds: number,
  countdownTotal: number,
  isCorrect: boolean,
  streak: number,
  doublePointsActive: boolean
): number {
  if (!isCorrect) return 0;

  // Time ratio: 1.0 = instant, 0.0 = at the deadline
  const timeRatio = Math.max(0, 1 - timeSpentSeconds / countdownTotal);

  // Base points scale linearly with time
  let points = Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * timeRatio);

  // Streak bonus: +10% per streak level (max 50%)
  const streakMultiplier = 1 + Math.min(streak, 5) * 0.1;
  points = Math.round(points * streakMultiplier);

  // Double points power-up
  if (doublePointsActive) {
    points *= 2;
  }

  return points;
}

export function getStreakLabel(streak: number): string {
  if (streak >= 10) return "EFSANE SERi!";
  if (streak >= 7) return "MUHTESEM!";
  if (streak >= 5) return "HARIKA!";
  if (streak >= 3) return "SUPER!";
  if (streak >= 2) return "iYi GiDiYOR!";
  return "";
}

export function getStreakColor(streak: number): string {
  if (streak >= 10) return "text-purple-500";
  if (streak >= 7) return "text-red-500";
  if (streak >= 5) return "text-orange-500";
  if (streak >= 3) return "text-yellow-500";
  if (streak >= 2) return "text-green-500";
  return "";
}

export function getDefaultPowerUps() {
  return [
    { type: "fiftyFifty" as const, label: "50:50", icon: "scissors", used: false },
    { type: "doublePoints" as const, label: "x2 Puan", icon: "zap", used: false },
    { type: "freezeTime" as const, label: "Sure Dondur", icon: "snowflake", used: false },
  ];
}
