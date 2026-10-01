// Maps backend error codes to the exact user-facing messages from PDF section 92.
// Never shown to the user: raw Mongo/Axios errors, stack traces, or internal codes.
export const CLAIM_ERROR_MESSAGES = {
  ALREADY_CLAIMED: "This reward has already been claimed.",
  STILL_LOCKED: "Your next reward is not available yet.",
  STREAK_RESET: "Your streak has been reset. Start again from Day 1.",
  INVALID_DAY: "That reward is not available to claim.",
  UNAUTHENTICATED: "Please log in to continue.",
  ACCOUNT_DISABLED: "This account is not eligible to claim rewards.",
  CYCLE_COMPLETE: "You have completed this streak. A new one will start soon.",
  RATE_LIMITED: "You're going a bit fast. Please wait a moment and try again.",
};

export function friendlyClaimError(err) {
  return CLAIM_ERROR_MESSAGES[err.code] || "Unable to process your reward. Please try again.";
}