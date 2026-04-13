import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Stats, Campaign } from "../lib/api";
import {
  Activity, Target, Globe, CheckCircle, XCircle,
  TrendingUp, Play, Plus
} from "lucide-react";

interface Props {
  onNavigate: (page: any) => void;
}

export default function Dashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState(false);

  const load = async () => {
    try {
      const [s, c] = await Promise.all([api.getStats(), api.getCampaigns()]);
      setStats(s);
      setCampaigns(c.slice(0, 5));
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const statCards = stats
    ? [
        { label: "Total Visits", value: stats.total_visits.toLocaleString(), icon: Activity, color: "text-emerald-400" },
        { label: "Success Rate", value: `${stats.success_rate}%`, icon: TrendingUp, color: "text-blue-400" },
        { label: "Running", value: `${stats.running_campaigns}/${stats.total_campaigns}`, icon: Play, color: "text-yellow-400" },
        { label: "Proxies", value: stats.active_proxies.toString(), icon: Globe, color: "text-purple-400" },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Real-time traffic overview</p>
        </div>
        <button
          onClick={() => onNavigate("campaigns")}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-sm font-semibold rounded transition-colors"
        >
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded px-4 py-3 text-sm text-red-400">
          Cannot connect to backend. Make sure the server is running on port 8000.
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{label}</span>
              <Icon size={14} className={color} />
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Success / Failed bar */}
      {stats && stats.total_visits > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span className="flex items-center gap-1"><CheckCircle size={11} className="text-emerald-400" /> {stats.successful_visits} successful</span>
            <span className="flex items-center gap-1"><XCircle size={11} className="text-red-400" /> {stats.failed_visits} failed</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${stats.success_rate}%` }}
            />
          </div>
        </div>
      )}

      {/* Recent campaigns */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Target size={14} /> Recent Campaigns
          </span>
          <button onClick={() => onNavigate("campaigns")} className="text-xs text-emerald-400 hover:underline">
            View all
          </button>
        </div>
        <div className="divide-y divide-gray-800">
          {campaigns.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-600">
              No campaigns yet. <button onClick={() => onNavigate("campaigns")} className="text-emerald-400 hover:underline">Create one</button>
            </div>
          )}
          {campaigns.map((c) => (
            <div key={c.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${c.running ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
                <div>
                  <div className="text-sm text-gray-200">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.search_engine} · {c.daily_visits}/day</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-300">{c.total_visits.toLocaleString()}</div>
                <div className="text-xs text-gray-600">visits</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
