import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Campaign } from "../lib/api";
import { Plus, Play, Square, Trash2, Edit, X, Check } from "lucide-react";

const ENGINES = ["google", "bing", "duckduckgo", "google_maps"];
const COUNTRIES = ["US", "GB", "FR", "DE", "CA", "AU", "IN", "BR", "KR", "TR", "MA"];
const DEVICES = ["desktop", "mobile", "safari"];

const defaultForm = {
  name: "",
  search_engine: "google",
  keywords: "",
  target_url: "",
  daily_visits: 100,
  min_time_on_site: 30,
  max_time_on_site: 180,
  bounce_rate: 30,
  use_proxies: true,
  device_type: "desktop",
  country: "US",
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setCampaigns(await api.getCampaigns());
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const openCreate = () => {
    setForm(defaultForm);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (c: Campaign) => {
    setForm({
      name: c.name,
      search_engine: c.search_engine,
      keywords: Array.isArray(c.keywords) ? c.keywords.join("\n") : "",
      target_url: c.target_url,
      daily_visits: c.daily_visits,
      min_time_on_site: c.min_time_on_site,
      max_time_on_site: c.max_time_on_site,
      bounce_rate: c.bounce_rate,
      use_proxies: Boolean(c.use_proxies),
      device_type: c.device_type,
      country: c.country,
    });
    setEditId(c.id);
    setShowForm(true);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        keywords: form.keywords.split("\n").map(k => k.trim()).filter(Boolean),
      };
      if (editId) {
        await api.updateCampaign(editId, payload);
      } else {
        await api.createCampaign(payload);
      }
      setShowForm(false);
      load();
    } catch {}
    setLoading(false);
  };

  const toggle = async (c: Campaign) => {
    try {
      if (c.running) {
        await api.stopCampaign(c.id);
      } else {
        await api.startCampaign(c.id);
      }
      load();
    } catch {}
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this campaign?")) return;
    await api.deleteCampaign(id);
    load();
  };

  const f = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Campaigns</h1>
          <p className="text-xs text-gray-500 mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-sm font-semibold rounded transition-colors"
        >
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {/* Campaign cards */}
      <div className="space-y-3">
        {campaigns.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-12 text-center text-gray-600 text-sm">
            No campaigns. Click "New Campaign" to get started.
          </div>
        )}
        {campaigns.map((c) => (
          <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${c.running ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {c.search_engine} · {c.device_type} · {c.country} · {c.daily_visits}/day
                  </div>
                  {c.target_url && (
                    <div className="text-xs text-gray-600 truncate mt-0.5">{c.target_url}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggle(c)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                    c.running
                      ? "bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-800"
                  }`}
                >
                  {c.running ? <><Square size={11} /> Stop</> : <><Play size={11} /> Start</>}
                </button>
                <button
                  onClick={() => openEdit(c)}
                  className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
                >
                  <Edit size={13} />
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm font-bold text-gray-200">{c.total_visits.toLocaleString()}</div>
                <div className="text-[10px] text-gray-600">total</div>
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-400">{c.successful_visits.toLocaleString()}</div>
                <div className="text-[10px] text-gray-600">success</div>
              </div>
              <div>
                <div className="text-sm font-bold text-red-400">{c.failed_visits.toLocaleString()}</div>
                <div className="text-[10px] text-gray-600">failed</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-bold text-white">{editId ? "Edit Campaign" : "New Campaign"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="Campaign Name">
                <input
                  className="input"
                  value={form.name}
                  onChange={e => f("name", e.target.value)}
                  placeholder="My SEO Campaign"
                />
              </Field>

              <Field label="Target URL">
                <input
                  className="input"
                  value={form.target_url}
                  onChange={e => f("target_url", e.target.value)}
                  placeholder="https://example.com"
                />
              </Field>

              <Field label="Keywords (one per line)">
                <textarea
                  className="input resize-none h-24"
                  value={form.keywords}
                  onChange={e => f("keywords", e.target.value)}
                  placeholder={"seo tools\nbest seo software\nrank tracker"}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Search Engine">
                  <select className="input" value={form.search_engine} onChange={e => f("search_engine", e.target.value)}>
                    {ENGINES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </Field>
                <Field label="Device">
                  <select className="input" value={form.device_type} onChange={e => f("device_type", e.target.value)}>
                    {DEVICES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Country">
                  <select className="input" value={form.country} onChange={e => f("country", e.target.value)}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Daily Visits">
                  <input
                    type="number"
                    className="input"
                    value={form.daily_visits}
                    onChange={e => f("daily_visits", Number(e.target.value))}
                    min={1}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Min Time (s)">
                  <input type="number" className="input" value={form.min_time_on_site} onChange={e => f("min_time_on_site", Number(e.target.value))} min={5} />
                </Field>
                <Field label="Max Time (s)">
                  <input type="number" className="input" value={form.max_time_on_site} onChange={e => f("max_time_on_site", Number(e.target.value))} min={10} />
                </Field>
                <Field label="Bounce Rate %">
                  <input type="number" className="input" value={form.bounce_rate} onChange={e => f("bounce_rate", Number(e.target.value))} min={0} max={100} />
                </Field>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.use_proxies}
                  onChange={e => f("use_proxies", e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-sm text-gray-300">Use proxies</span>
              </label>
            </div>

            <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={loading || !form.name}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-sm font-semibold rounded disabled:opacity-50 transition-colors"
              >
                <Check size={13} /> {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
