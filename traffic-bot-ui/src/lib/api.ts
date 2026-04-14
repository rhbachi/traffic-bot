import { API_BASE } from "../config";
import { authStore } from "../store/auth";
const BASE = `${API_BASE}/api`;

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = authStore.getState().token;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  // Stats
  getStats: () => req<Stats>("/stats"),

  // Campaigns
  getCampaigns: () => req<Campaign[]>("/campaigns"),
  getCampaign: (id: number) => req<Campaign>(`/campaigns/${id}`),
  createCampaign: (data: Partial<Campaign>) =>
    req<Campaign>("/campaigns", { method: "POST", body: JSON.stringify(data) }),
  updateCampaign: (id: number, data: Partial<Campaign>) =>
    req<Campaign>(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCampaign: (id: number) =>
    req(`/campaigns/${id}`, { method: "DELETE" }),
  startCampaign: (id: number) =>
    req(`/campaigns/${id}/start`, { method: "POST" }),
  stopCampaign: (id: number) =>
    req(`/campaigns/${id}/stop`, { method: "POST" }),

  // Proxies
  getProxies: () => req<Proxy[]>("/proxies"),
  addProxy: (data: Partial<Proxy>) =>
    req<Proxy>("/proxies", { method: "POST", body: JSON.stringify(data) }),
  bulkImportProxies: (proxies: string, country = "") =>
    req<{ added: number }>("/proxies/bulk", {
      method: "POST",
      body: JSON.stringify({ proxies, country }),
    }),
  deleteProxy: (id: number) =>
    req(`/proxies/${id}`, { method: "DELETE" }),

  // Logs
  getLogs: (campaignId?: number, limit = 100) =>
    req<Log[]>(`/logs${campaignId ? `?campaign_id=${campaignId}` : ""}${limit ? `${campaignId ? "&" : "?"}limit=${limit}` : ""}`),

  // Settings
  getSettings: () => req<Record<string, string>>("/settings"),
  updateSettings: (data: Record<string, string>) =>
    req("/settings", { method: "PUT", body: JSON.stringify({ data }) }),
};

export interface Stats {
  total_campaigns: number;
  running_campaigns: number;
  total_visits: number;
  successful_visits: number;
  failed_visits: number;
  success_rate: number;
  active_proxies: number;
}

export interface Campaign {
  id: number;
  name: string;
  status: string;
  running: boolean;
  search_engine: string;
  keywords: string[];
  target_url: string;
  daily_visits: number;
  min_time_on_site: number;
  max_time_on_site: number;
  bounce_rate: number;
  use_proxies: boolean;
  device_type: string;
  country: string;
  schedule_enabled: boolean;
  schedule_start?: string;
  schedule_end?: string;
  total_visits: number;
  successful_visits: number;
  failed_visits: number;
  created_at: string;
}

export interface Proxy {
  id: number;
  address: string;
  port: number;
  username?: string;
  password?: string;
  type: string;
  country: string;
  status: string;
  last_used?: string;
  success_count: number;
  fail_count: number;
}

export interface Log {
  id: number;
  campaign_id: number;
  campaign_name: string;
  keyword: string;
  status: string;
  proxy_used: string;
  time_on_site: number;
  search_engine: string;
  created_at: string;
}
