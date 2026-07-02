import type { ReachMoonCompletedHighscorePayload } from '@/scenario/specific-scenarios/reachMoonScenario'
import type { ReachMoonScoreSummary } from '@/scenario/specific-scenarios/reachMoonScore'

export const reachMoonCompletedRunInput = {
  fuelRemainingRatio: 0.5,
  missionElapsedSeconds: 90_000,
} satisfies ReachMoonCompletedHighscorePayload['input']

export const reachMoonCompletedRunScore = {
  baseScorePoints: 0,
  fuelBonusPoints: 121.5,
  fuelRemainingKg: 16_000,
  missionElapsedSeconds: 90_000,
  timePenaltyPoints: 49.7,
  totalScore: 171.2,
} satisfies ReachMoonScoreSummary

export const reachMoonCompletedRunHighscore = {
  input: reachMoonCompletedRunInput,
  score: reachMoonCompletedRunScore,
} satisfies ReachMoonCompletedHighscorePayload
