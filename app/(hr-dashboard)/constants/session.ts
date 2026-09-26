export const OTP_EXPIRY_SECONDS = 2 * 60;
export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const OTP_MAX_RESENDS = 3;

export const LOGIN_OTP_TTL_MINUTES = 2;
export const LOGIN_OTP_TTL_SECONDS = 120;

export const SESSION_INACTIVITY_MINUTES = 5;
export const SESSION_WARNING_SECONDS = 30;

export const SESSION_ABSOLUTE_HOURS = 8;
export const SESSION_ABSOLUTE_MS = SESSION_ABSOLUTE_HOURS * 60 * 60 * 1000;

export const SESSION_START_KEY = "hr_session_start";
export const SESSION_ACTIVITY_KEY = "hr_last_activity";
