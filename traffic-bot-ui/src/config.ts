// In development: set VITE_API_URL=http://localhost:8000 in .env.local
// In production: leave empty — the backend serves both API and frontend
export const API_BASE = (import.meta.env.VITE_API_URL as string) || "";
