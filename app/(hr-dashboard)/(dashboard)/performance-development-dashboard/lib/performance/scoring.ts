/**
 * Performance scoring — authoritative calculation rules (approved).
 *
 *   Final Score =
 *     (Goal Score × 0.60) + (Competency Score × 0.40)   on a 1.00–5.00 scale
 *
 *   Goal Score = Σ(goal rating × goal weight), weights as percentages (%) and
 *               required to total exactly 100%.
 *   Competency Score = average of the applicable appraisal competency ratings
 *               (competencies are equally weighted — no per-competency weights).
 *
 *   Final Performance Rating = the single approved rating band whose
 *               mathematical boundaries contain the UNROUNDED final score.
 *
 * This module is PURE and CLIENT-SAFE (no server-only import): the same
 * calculation drives the reviewer's finalize-time preview and the server's
 * official finalization, so they can never disagree.
 *
 * `self_rating` never contributes to any score. `letter_grade` is never used.
 */
import {
  performanceRatingBandFromScore,
  type PerformanceRatingBand,
} from "@/performance-development-dashboard/types";

export const SCORING_GOALS_COMPONENT_WEIGHT = 0.6;
export const SCORING_COMPETENCIES_COMPONENT_WEIGHT = 0.4;
export const SCORING_RATING_MIN = 1;
export const SCORING_RATING_MAX = 5;
export const SCORING_MIN_SCORE = 1;
export const SCORING_MAX_SCORE = 5;
export const SCORING_WEIGHTS_TOTAL = 100;

/** A formal 1–5 integer rating (used for both goals and competencies). */
export function isScoreRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= SCORING_RATING_MIN &&
    value <= SCORING_RATING_MAX
  );
}

/** Rounds to `precision` decimals for persisted display values. */
export function roundScore(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export type GoalScoreEntry = {
  rating: number;
  weight: number;
};

/**
 * Goal Score = Σ(goal rating × goal weight), weights as percentages.
 * Returns the score, or a human-readable validation message string on failure.
 */
export function calculateGoalScore(
  entries: GoalScoreEntry[]
): number | string {
  if (entries.length === 0) {
    return "At least one applicable goal is required to calculate the goal score.";
  }

  let weightTotal = 0;
  for (const entry of entries) {
    if (!isScoreRating(entry.rating)) {
      return `Goal ratings must be whole numbers between ${SCORING_RATING_MIN} and ${SCORING_RATING_MAX}.`;
    }
    if (
      typeof entry.weight !== "number" ||
      !Number.isFinite(entry.weight) ||
      entry.weight <= 0 ||
      entry.weight > SCORING_WEIGHTS_TOTAL
    ) {
      return `Every evaluated goal needs a valid weight greater than 0 and at most ${SCORING_WEIGHTS_TOTAL} (%).`;
    }
    weightTotal += entry.weight;
  }

  if (Math.abs(weightTotal - SCORING_WEIGHTS_TOTAL) > 1e-6) {
    return `The evaluated goals' weights must total exactly ${SCORING_WEIGHTS_TOTAL}% (found ${roundScore(weightTotal, 2)}%).`;
  }

  return entries.reduce(
    (sum, entry) => sum + entry.rating * (entry.weight / 100),
    0
  );
}

/**
 * Competency Score = average of the applicable appraisal competency ratings
 * (equal weighting). Returns the score, or a validation message on failure.
 */
export function calculateCompetencyScore(
  ratings: number[]
): number | string {
  if (ratings.length === 0) {
    return "At least one applicable competency rating is required to calculate the competency score.";
  }
  for (const rating of ratings) {
    if (!isScoreRating(rating)) {
      return `Competency ratings must be whole numbers between ${SCORING_RATING_MIN} and ${SCORING_RATING_MAX}.`;
    }
  }
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  return total / ratings.length;
}

export type ScoreCalculation = {
  goalScore: number;
  competencyScore: number;
  finalScore: number;
  /** Persisted/displayed `final_score`, rounded to 2 decimals. */
  finalScoreDisplay: number;
  band: PerformanceRatingBand;
};

export type ScoreCalculationResult =
  | { ok: true; calculation: ScoreCalculation }
  | { ok: false; error: string };

/**
 * Computes the complete official result. The band is resolved from the
 * UNROUNDED final score (display rounding never determines a band). The
 * persisted final score is rounded for a clean numeric column value.
 */
export function calculateScoring(input: {
  goalEntries: GoalScoreEntry[];
  competencyRatings: number[];
}): ScoreCalculationResult {
  const goalScore = calculateGoalScore(input.goalEntries);
  if (typeof goalScore === "string") return { ok: false, error: goalScore };

  const competencyScore = calculateCompetencyScore(input.competencyRatings);
  if (typeof competencyScore === "string") {
    return { ok: false, error: competencyScore };
  }

  const finalScore =
    goalScore * SCORING_GOALS_COMPONENT_WEIGHT +
    competencyScore * SCORING_COMPETENCIES_COMPONENT_WEIGHT;

  const band = performanceRatingBandFromScore(finalScore);
  if (
    !band ||
    finalScore < SCORING_MIN_SCORE ||
    finalScore > SCORING_MAX_SCORE
  ) {
    return {
      ok: false,
      error: `The computed final score (${roundScore(finalScore, 2)}) does not fall within the approved 1–5 range.`,
    };
  }

  return {
    ok: true,
    calculation: {
      goalScore,
      competencyScore,
      finalScore,
      finalScoreDisplay: roundScore(finalScore),
      band,
    },
  };
}