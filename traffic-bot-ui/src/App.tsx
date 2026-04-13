import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import Proxies from "./pages/Proxies";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import LoginPage from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import { authStore } from "./store/auth";
import {
  LayoutDashboard, Target, Globe, ScrollText,
  Settings2, LogOut, ShieldCheck, Users, Zap, Activity,
} from "lucide-react";

type Page = "dashboard" | "campaigns" | "proxies" | "logs" | "settings" | "admin-dashboard" | "admin-users";

const NAV = [
  { id: "dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { id: "campaigns",  label: "Campaigns",  icon: Target },
  { id: "proxies",    label: "Proxies",    icon: Globe },
  { id: "logs",       label: "Logs",       icon: ScrollText },
  { id: "settings",   label: "Settings",   icon: Settings2 },
] as const;

const ADMIN_NAV = [
  { id: "admin-dashboard", label: "Vue globale",    icon: Activity },
  { id: "admin-users",     label: "Utilisateurs",   icon: Users },
] as const;

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [auth, setAuth] = useState(authStore.getState());

  useEffect(() => authStore.subscribe(() => setAuth({ ...authStore.getState() })), []);

  if (!auth.token) {
    return <LoginPage onSuccess={() => setAuth({ ...authStore.getState() })} />;
  }

  const isAdmin = auth.user?.role === "admin";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#080d1a" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 h-screen flex flex-col border-r"
        style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)" }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">TrafficBot</div>
              <div className="text-[10px] text-white/25">SEO Automation</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = page === id;
            return (
              <button key={id} onClick={() => setPage(id as Page)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-indigo-500/15 text-indigo-300 shadow-sm"
                    : "text-white/35 hover:text-white/70 hover:bg-white/5"
                }`}>
                <Icon size={15} className={active ? "text-indigo-400" : ""} />
                {label}
              </button>
            );
          })}

          {isAdmin && (
            <div className="pt-4 mt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-1.5 px-3 mb-2">
                <ShieldCheck size={10} className="text-indigo-400" />
                <span className="text-[10px] text-indigo-400/70 font-semibold uppercase tracking-widest">Admin</span>
              </div>
              {ADMIN_NAV.map(({ id, label, icon: Icon }) => {
                const active = page === id;
                return (
                  <button key={id} onClick={() => setPage(id as Page)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-indigo-500/15 text-indigo-300"
                        : "text-indigo-400/40 hover:text-indigo-300 hover:bg-indigo-500/8"
                    }`}>
                    <Icon size={15} className={active ? "text-indigo-400" : ""} />
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
              isAdmin ? "bg-indigo-500/20 text-indigo-400" : "bg-white/10 text-white/50"
            }`}>
              {auth.user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/70 truncate">{auth.user?.email}</p>
              <p className={`text-[10px] font-medium ${isAdmin ? "text-indigo-400" : "text-white/25"}`}>
                {isAdmin ? "Administrateur" : "Utilisateur"}
              </p>
            </div>
            <button onClick={() => authStore.clearAuth()} title="Déconnexion"
              className="text-white/20 hover:text-white/60 transition-colors">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {page === "dashboard"       && <Dashboard onNavigate={setPage} />}
        {page === "campaigns"       && <Campaigns />}
        {page === "proxies"         && <Proxies />}
        {page === "logs"            && <Logs />}
        {page === "settings"        && <Settings />}
        {page === "admin-dashboard" && isAdmin && <AdminDashboard />}
        {page === "admin-users"     && isAdmin && <AdminUsers />}
      </main>
    </div>
  );
}
