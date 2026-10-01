import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("veloop_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token is invalid/expired, log the user out automatically
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("veloop_token");
      localStorage.removeItem("veloop_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

function extractMessage(error, fallback) {
  return error.response?.data?.message || fallback;
}

export async function registerRequest({ name, email, password }) {
  try {
    const { data } = await api.post("/auth/register", { name, email, password });
    return data;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to create your account. Please try again."));
  }
}

export async function loginRequest({ email, password }) {
  try {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
  } catch (error) {
    throw new Error(extractMessage(error, "Invalid email or password."));
  }
}

export async function getMeRequest() {
  try {
    const { data } = await api.get("/auth/me");
    return data;
  } catch (error) {
    throw new Error(extractMessage(error, "Unable to load your profile."));
  }
}