import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Log, Campaign } from "../lib/api";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Filter } from "lucide-react";

const STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle size={12} className="text-emerald-400" />,
  failed: <XCircle size={12} className="text-red-400" />,
  error: <AlertCircle size={12} className="text-yellow-400" />,
};

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filterCampaign, setFilterCampaign] = useState<number | undefined>();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = async () => {
    try {
      const [l, c] = await Promise.all([
        api.getLogs(filterCampaign, 200),
        api.getCampaigns(),
      ]);
      setLogs(l);
      setCampaigns(c);
    } catch {}
  };

  useEffect(() => {
    load();
  }, [filterCampaign]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [autoRefresh, filterCampaign]);

  const successCount = logs.filter(l => l.status === "success").length;
  const failCount = logs.filter(l => l.status !== "success").length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Logs</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {successCount} success · {failCount} failed · {logs.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Campaign filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-gray-500" />
            <select
              className="input text-xs py-1"
              value={filterCampaign ?? ""}
              onChange={e => setFilterCampaign(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All campaigns</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${
              autoRefresh
                ? "border-emerald-800 text-emerald-400 bg-emerald-500/10"
                : "border-gray-700 text-gray-500 hover:text-gray-300"
            }`}
          >
            <RefreshCw size={11} className={autoRefresh ? "animate-spin" : ""} />
            Live
          </button>

          <button onClick={load} className="p-1.5 text-gray-500 hover:text-gray-300 border border-gray-700 rounded transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Log table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[auto_2fr_2fr_1fr_1fr_1fr] text-[11px] text-gray-500 px-4 py-2 border-b border-gray-800 uppercase tracking-wider">
          <span className="w-5"></span>
          <span>Keyword</span>
          <span>Proxy</span>
          <span>Engine</span>
          <span className="text-center">Time</span>
          <span>Date</span>
        </div>
        <div className="divide-y divide-gray-800 max-h-[600px] overflow-y-auto">
          {logs.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-600">
              No logs yet. Start a campaign to see visit logs here.
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="grid grid-cols-[auto_2fr_2fr_1fr_1fr_1fr] items-center px-4 py-2 hover:bg-gray-800/30 transition-colors gap-3">
              <div className="w-5 flex items-center">
                {STATUS_ICON[log.status] ?? STATUS_ICON.error}
              </div>
              <div>
                <div className="text-xs text-gray-300 truncate">{log.keyword || "—"}</div>
                {log.campaign_name && (
                  <div className="text-[10px] text-gray-600 truncate">{log.campaign_name}</div>
                )}
              </div>
              <div className="text-xs text-gray-500 truncate">{log.proxy_used || "direct"}</div>
              <div className="text-xs text-gray-500">{log.search_engine}</div>
              <div className="text-xs text-gray-400 text-center">{log.time_on_site}s</div>
              <div className="text-[10px] text-gray-600">{new Date(log.created_at).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
