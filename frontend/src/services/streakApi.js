import { api } from "./api";

function extractMessage(error, fallback) {
  return error.response?.data?.message || fallback;
}

export async function getStreak() {
  try {
    const { data } = await api.get("/daily-streak");
    return data;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to load your streak. Please try again."));
  }
}

export async function getStreakStatusOnly() {
  try {
    const { data } = await api.get("/daily-streak/status");
    return data;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to refresh your streak."));
  }
}

export async function claimStreak({ day, idempotencyKey }) {
  try {
    const { data } = await api.post("/daily-streak/claim", { day, idempotencyKey });
    return data;
  } catch (error) {
    // Pass the backend's error code through so the UI can react specifically
    // (e.g. show "Your streak has been reset" instead of a generic message).
    const code = error.response?.data?.code;
    const message = extractMessage(error, "Unable to process your reward. Please try again.");
    const err = new Error(message);
    err.code = code;
    throw err;
  }
}

export async function getHistory({ page = 1, limit = 20 } = {}) {
  try {
    const { data } = await api.get(`/daily-streak/history?page=${page}&limit=${limit}`);
    return data;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to load your history."));
  }
}