import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Proxy } from "../lib/api";
import { Plus, Trash2, Upload, X, Check, Shield, ShieldOff } from "lucide-react";

export default function Proxies() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({ address: "", port: "", username: "", password: "", type: "http" });
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { setProxies(await api.getProxies()); } catch {}
  };

  useEffect(() => { load(); }, []);

  const addProxy = async () => {
    if (!form.address || !form.port) return;
    setLoading(true);
    try {
      await api.addProxy({ ...form, port: Number(form.port) });
      setForm({ address: "", port: "", username: "", password: "", type: "http" });
      setShowAdd(false);
      load();
    } catch {}
    setLoading(false);
  };

  const bulkImport = async () => {
    if (!bulkText.trim()) return;
    setLoading(true);
    try {
      const res = await api.bulkImportProxies(bulkText);
      alert(`Added ${res.added} proxies`);
      setBulkText("");
      setShowBulk(false);
      load();
    } catch {}
    setLoading(false);
  };

  const remove = async (id: number) => {
    await api.deleteProxy(id);
    load();
  };

  const activeCount = proxies.filter(p => p.status === "active").length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Proxies</h1>
          <p className="text-xs text-gray-500 mt-0.5">{activeCount} active · {proxies.length} total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-200 text-sm rounded transition-colors"
          >
            <Upload size={13} /> Bulk Import
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-sm font-semibold rounded transition-colors"
          >
            <Plus size={14} /> Add Proxy
          </button>
        </div>
      </div>

      {/* Format hint */}
      <div className="bg-gray-900/50 border border-gray-800 rounded px-3 py-2 text-[11px] text-gray-600">
        Supported formats: <code className="text-gray-400">ip:port</code> or <code className="text-gray-400">ip:port:user:pass</code>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] text-[11px] text-gray-500 px-4 py-2 border-b border-gray-800 uppercase tracking-wider">
          <span>Address</span>
          <span>Type</span>
          <span className="text-center">Success</span>
          <span className="text-center">Fail</span>
          <span></span>
        </div>
        <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
          {proxies.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-600">
              No proxies yet. Add proxies to enable IP rotation.
            </div>
          )}
          {proxies.map((p) => (
            <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center px-4 py-2.5 hover:bg-gray-800/30 transition-colors">
              <div className="flex items-center gap-2">
                {p.status === "active"
                  ? <Shield size={12} className="text-emerald-400 shrink-0" />
                  : <ShieldOff size={12} className="text-gray-600 shrink-0" />
                }
                <span className="text-sm text-gray-300 truncate">{p.address}:{p.port}</span>
                {p.username && <span className="text-[10px] text-gray-600 hidden md:block">auth</span>}
              </div>
              <span className="text-xs text-gray-500">{p.type}</span>
              <span className="text-xs text-emerald-400 text-center">{p.success_count}</span>
              <span className="text-xs text-red-400 text-center">{p.fail_count}</span>
              <button
                onClick={() => remove(p.id)}
                className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add single modal */}
      {showAdd && (
        <Modal title="Add Proxy" onClose={() => setShowAdd(false)}>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="IP Address">
                <input className="input" placeholder="192.168.1.1" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </Field>
              <Field label="Port">
                <input className="input" placeholder="8080" value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username (optional)">
                <input className="input" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
              </Field>
              <Field label="Password (optional)">
                <input type="password" className="input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </Field>
            </div>
            <Field label="Type">
              <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                <option>http</option>
                <option>https</option>
                <option>socks5</option>
                <option>socks4</option>
              </select>
            </Field>
          </div>
          <ModalFooter onClose={() => setShowAdd(false)} onSubmit={addProxy} loading={loading} />
        </Modal>
      )}

      {/* Bulk import modal */}
      {showBulk && (
        <Modal title="Bulk Import Proxies" onClose={() => setShowBulk(false)}>
          <div className="p-5">
            <p className="text-xs text-gray-500 mb-3">
              One proxy per line. Formats: <code className="text-gray-400">ip:port</code> or <code className="text-gray-400">ip:port:user:pass</code>
            </p>
            <textarea
              className="input resize-none h-48 text-xs"
              placeholder={"1.2.3.4:8080\n5.6.7.8:3128:user:pass\n..."}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />
          </div>
          <ModalFooter onClose={() => setShowBulk(false)} onSubmit={bulkImport} loading={loading} label="Import" />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-white text-sm">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onClose, onSubmit, loading, label = "Save" }: any) {
  return (
    <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
      <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-400 border border-gray-700 rounded hover:text-gray-200">Cancel</button>
      <button
        onClick={onSubmit}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-sm font-semibold rounded disabled:opacity-50 transition-colors"
      >
        <Check size={13} /> {loading ? "..." : label}
      </button>
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
