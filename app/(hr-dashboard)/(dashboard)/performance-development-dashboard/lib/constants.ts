/**
 * Canonical maximum-length constants for PerDev validation.
 *
 * This file is client-safe: it must NOT import server-only modules.
 * Server modules re-export these constants for backward compatibility.
 */

/* ── Appraisals ─────────────────────────────────────────────────────── */
export const MAX_REVIEW_PERIOD_LENGTH = 120;
export const MAX_APPRAISAL_TEXT_LENGTH = 2000;

/* ── Check-ins ──────────────────────────────────────────────────────── */
export const MAX_CHECK_IN_MESSAGE_LENGTH = 1000;

/* ── Competencies ───────────────────────────────────────────────────── */
export const MAX_COMPETENCY_NAME_LENGTH = 200;
export const MAX_COMPETENCY_DESCRIPTION_LENGTH = 2000;

/* ── Learning & Development ─────────────────────────────────────────── */
export const MAX_COURSE_TITLE_LENGTH = 200;
export const MAX_COURSE_DESCRIPTION_LENGTH = 2000;
export const MAX_COURSE_URL_LENGTH = 2000;
export const MAX_SESSION_TITLE_LENGTH = 200;
export const MAX_SHORT_TEXT_LENGTH = 60;
export const MAX_EVALUATION_COMMENT_LENGTH = 2000;
export const MAX_CERT_URL_LENGTH = 2000;

/* ── Succession Planning ────────────────────────────────────────────── */
export const SUCCESSION_MAX_RISK_LEVEL_LENGTH = 100;
export const SUCCESSION_MAX_REASON_LENGTH = 2000;
export const SUCCESSION_MAX_READINESS_LENGTH = 100;
export const SUCCESSION_MAX_NOTES_LENGTH = 2000;

/* ── Recognition & Rewards ──────────────────────────────────────────── */
export const REWARDS_MAX_MESSAGE_LENGTH = 2000;
export const REWARDS_MAX_REWARD_DESCRIPTION_LENGTH = 2000;
export const REWARDS_MAX_REASON_CATEGORY_LENGTH = 100;
export const REWARDS_MAX_VISIBILITY_LENGTH = 50;

/* ── Development Plan Items ─────────────────────────────────────────── */
export const MAX_DEV_PLAN_ACTION_LENGTH = 2000;
export const MAX_DEV_PLAN_TARGET_LENGTH = 2000;

/* ── Goal Evidence ──────────────────────────────────────────────────── */
export const EVIDENCE_STORAGE_BUCKET = "hr3";
export const EVIDENCE_STORAGE_FOLDER = "goal-evidence";
export const ALLOWED_EVIDENCE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;
export const MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_EVIDENCE_NOTE_LENGTH = 2000;
export const MAX_EVIDENCE_ATTACHMENT_NAME_LENGTH = 255;
export const EVIDENCE_SIGNED_URL_EXPIRY_SECONDS = 5 * 60;

/* ── Feedback Requests ──────────────────────────────────────────────── */
export const MAX_FEEDBACK_REQUEST_MESSAGE_LENGTH = 2000;
export const MAX_FEEDBACK_RESPONSE_MESSAGE_LENGTH = 2000;

/* ── Goal Measurement (hybrid progress) ───────────────────────────────── */
export const MAX_GOAL_MEASUREMENT_UNIT_LENGTH = 24;
export const MAX_GOAL_PROGRESS_NOTE_LENGTH = 1000;

/* ── Goal Proposal Review ─────────────────────────────────────────────── */
export const MAX_GOAL_REVIEW_NOTE_LENGTH = 2000;
