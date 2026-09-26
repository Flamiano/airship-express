export const PERFORMANCE_RATINGS = [
  "E",
  "S",
  "VG",
  "G",
  "NI",
  "F",
] as const;

export type PerformanceRating = (typeof PERFORMANCE_RATINGS)[number];

export const PERFORMANCE_RATING_LABELS: Record<PerformanceRating, string> = {
  E: "Excellent",
  S: "Superior",
  VG: "Very Good",
  G: "Good",
  NI: "Needs Improvement",
  F: "Failing",
};

export const LETTER_GRADES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
] as const;

export type LetterGrade = (typeof LETTER_GRADES)[number];

export const LETTER_GRADE_LABELS: Record<LetterGrade, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
  F: "F",
};
