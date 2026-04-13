import { useState } from "react";
import { Zap, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import { apiLogin, apiRegister } from "../store/auth";

interface Props { onSuccess: () => void; }

export default function LoginPage({ onSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") await apiLogin(email, password);
      else await apiRegister(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #060b18 0%, #0d1528 100%)" }}>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-2xl shadow-indigo-500/40 mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TrafficBot</h1>
          <p className="text-sm text-white/30 mt-1">SEO Automation Platform</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/8 p-6 shadow-2xl"
          style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)" }}>

          {/* Tabs */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: "rgba(255,255,255,0.05)" }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  mode === m
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                    : "text-white/30 hover:text-white/60"
                }`}>
                {m === "login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium">Adresse email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full rounded-xl border border-white/8 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-indigo-500/50 transition-colors"
                style={{ background: "rgba(255,255,255,0.05)" }} />
            </div>

            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium">Mot de passe</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full rounded-xl border border-white/8 px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-white/20 outline-none focus:border-indigo-500/50 transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)" }} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-400 rounded-xl px-3.5 py-2.5 border border-rose-500/20"
                style={{ background: "rgba(244,63,94,0.08)" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              {loading ? <span className="animate-pulse">Chargement…</span>
                : mode === "login"
                  ? <><LogIn size={15} /> Se connecter</>
                  : <><UserPlus size={15} /> Créer le compte</>}
            </button>
          </form>

          {mode === "register" && (
            <p className="text-xs text-white/20 text-center mt-4">
              Le 1er compte créé devient automatiquement <span className="text-indigo-400">admin</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
