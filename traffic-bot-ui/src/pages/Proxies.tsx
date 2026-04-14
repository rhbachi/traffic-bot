import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Proxy } from "../lib/api";
import { Plus, Trash2, Upload, X, Check, Shield, ShieldOff, Globe } from "lucide-react";

const COUNTRIES = [
  { code: "", label: "Any country" },
  { code: "US", label: "🇺🇸 United States" },
  { code: "GB", label: "🇬🇧 United Kingdom" },
  { code: "FR", label: "🇫🇷 France" },
  { code: "DE", label: "🇩🇪 Germany" },
  { code: "CA", label: "🇨🇦 Canada" },
  { code: "AU", label: "🇦🇺 Australia" },
  { code: "IN", label: "🇮🇳 India" },
  { code: "BR", label: "🇧🇷 Brazil" },
  { code: "KR", label: "🇰🇷 South Korea" },
  { code: "TR", label: "🇹🇷 Turkey" },
  { code: "MA", label: "🇲🇦 Morocco" },
];

const countryLabel = (code: string) => COUNTRIES.find(c => c.code === code)?.label ?? (code || "—");

export default function Proxies() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkCountry, setBulkCountry] = useState("");
  const [form, setForm] = useState({ address: "", port: "", username: "", password: "", type: "http", country: "" });
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
      setForm({ address: "", port: "", username: "", password: "", type: "http", country: "" });
      setShowAdd(false);
      load();
    } catch {}
    setLoading(false);
  };

  const bulkImport = async () => {
    if (!bulkText.trim()) return;
    setLoading(true);
    try {
      const res = await api.bulkImportProxies(bulkText, bulkCountry);
      alert(`Added ${res.added} proxies`);
      setBulkText("");
      setBulkCountry("");
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

  // Group stats by country
  const byCountry = COUNTRIES.filter(c => c.code).map(c => ({
    ...c,
    count: proxies.filter(p => p.country === c.code).length,
  })).filter(c => c.count > 0);

  return (
    <div className="p-6 space-y-4" style={{ background: "linear-gradient(135deg, #080d1a 0%, #0d1528 100%)", minHeight: "100vh" }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Proxies</h1>
          <p className="text-xs text-white/30 mt-0.5">{activeCount} actifs · {proxies.length} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:border-white/20 text-white/40 hover:text-white/70 text-sm rounded-xl transition-colors">
            <Upload size={13} /> Import groupé
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20">
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* Country breakdown */}
      {byCountry.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byCountry.map(c => (
            <span key={c.code} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/8 text-xs text-white/50"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <Globe size={10} className="text-indigo-400" />
              {c.label} <span className="text-indigo-400 font-semibold">{c.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Format hint */}
      <div className="rounded-xl border border-white/5 px-3 py-2 text-[11px] text-white/25"
        style={{ background: "rgba(255,255,255,0.02)" }}>
        Formats supportés : <code className="text-white/40">ip:port</code> ou <code className="text-white/40">ip:port:user:pass</code>
        {" · "}Le pays du proxy doit correspondre à celui de la campagne pour être sélectionné en priorité.
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] text-[11px] text-white/25 px-4 py-2.5 border-b border-white/5 uppercase tracking-wider">
          <span>Adresse</span>
          <span>Type</span>
          <span>Pays</span>
          <span className="text-center">Succès</span>
          <span className="text-center">Échecs</span>
          <span></span>
        </div>
        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
          {proxies.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-white/20">
              Aucun proxy. Ajoutez des proxies pour activer la rotation d'IP.
            </div>
          )}
          {proxies.map((p) => (
            <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2">
                {p.status === "active"
                  ? <Shield size={12} className="text-emerald-400 shrink-0" />
                  : <ShieldOff size={12} className="text-white/20 shrink-0" />
                }
                <span className="text-sm text-white/70 truncate">{p.address}:{p.port}</span>
                {p.username && <span className="text-[10px] text-white/25 hidden md:block">auth</span>}
              </div>
              <span className="text-xs text-white/40">{p.type}</span>
              <span className="text-xs text-indigo-400/70">{p.country ? countryLabel(p.country) : <span className="text-white/20">—</span>}</span>
              <span className="text-xs text-emerald-400 text-center">{p.success_count}</span>
              <span className="text-xs text-rose-400 text-center">{p.fail_count}</span>
              <button onClick={() => remove(p.id)}
                className="p-1.5 text-white/20 hover:text-rose-400 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add single modal */}
      {showAdd && (
        <Modal title="Ajouter un proxy" onClose={() => setShowAdd(false)}>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adresse IP">
                <input className="input" placeholder="192.168.1.1" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </Field>
              <Field label="Port">
                <input className="input" placeholder="8080" value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Utilisateur (optionnel)">
                <input className="input" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
              </Field>
              <Field label="Mot de passe (optionnel)">
                <input type="password" className="input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="http">http</option>
                  <option value="https">https</option>
                  <option value="socks5">socks5</option>
                  <option value="socks4">socks4</option>
                </select>
              </Field>
              <Field label="Pays du proxy">
                <select className="input" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <ModalFooter onClose={() => setShowAdd(false)} onSubmit={addProxy} loading={loading} />
        </Modal>
      )}

      {/* Bulk import modal */}
      {showBulk && (
        <Modal title="Import groupé de proxies" onClose={() => setShowBulk(false)}>
          <div className="p-5 space-y-3">
            <Field label="Pays de tous ces proxies">
              <select className="input" value={bulkCountry} onChange={e => setBulkCountry(e.target.value)}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
            <p className="text-xs text-white/25">
              Un proxy par ligne : <code className="text-white/40">ip:port</code> ou <code className="text-white/40">ip:port:user:pass</code>
            </p>
            <textarea
              className="input resize-none h-40 text-xs"
              placeholder={"1.2.3.4:8080\n5.6.7.8:3128:user:pass\n..."}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />
          </div>
          <ModalFooter onClose={() => setShowBulk(false)} onSubmit={bulkImport} loading={loading} label="Importer" />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl border border-white/10 w-full max-w-md shadow-2xl" style={{ background: "#0d1528" }}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-bold text-white text-sm">{title}</h2>
          <button onClick={onClose} className="text-white/25 hover:text-white/60"><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onClose, onSubmit, loading, label = "Sauvegarder" }: any) {
  return (
    <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">
      <button onClick={onClose} className="px-4 py-1.5 text-sm text-white/40 border border-white/10 rounded-xl hover:text-white/60 transition-colors">Annuler</button>
      <button onClick={onSubmit} disabled={loading}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
        <Check size={13} /> {loading ? "..." : label}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/40 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}
