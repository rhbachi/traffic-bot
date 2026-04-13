import { API_BASE } from "../config";
const API = `${API_BASE}/api`;

export interface AuthUser {
  id: number;
  email: string;
  role: "user" | "admin";
  is_banned: boolean;
  created_at: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

const STORAGE_KEY = "trafficbot_auth";

function load(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { user: null, token: null };
  } catch {
    return { user: null, token: null };
  }
}

function save(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let _state: AuthState = load();
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

export const authStore = {
  getState: () => _state,

  subscribe: (fn: () => void) => {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  setAuth: (user: AuthUser, token: string) => {
    _state = { user, token };
    save(_state);
    notify();
  },

  clearAuth: () => {
    _state = { user: null, token: null };
    localStorage.removeItem(STORAGE_KEY);
    notify();
  },

  isAuthenticated: () => !!_state.token,
  isAdmin: () => _state.user?.role === "admin",
};

// API helpers
export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur de connexion");
  }
  const data = await res.json();
  authStore.setAuth(data.user, data.token);
  return data;
}

export async function apiRegister(email: string, password: string) {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur d'inscription");
  }
  const data = await res.json();
  authStore.setAuth(data.user, data.token);
  return data;
}
