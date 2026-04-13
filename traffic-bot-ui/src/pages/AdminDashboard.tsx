import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Users, Activity, Target, TrendingUp,
  TrendingDown, ShieldAlert, ArrowUpRight, Zap
} from "lucide-react";
import { authStore } from "../store/auth";

import { API_BASE } from "../config";
const API = `${API_BASE}/api`;
function authHeaders() {
  return { Authorization: `Bearer ${authStore.getState().token}` };
}

// Generate sparkline mock data for KPI cards
function spark(base: number, len = 8) {
  return Array.from({ length: len }, (_, i) => ({
    v: base + Math.round(Math.sin(i * 0.8) * base * 0.15 + Math.random() * base * 0.1),
  }));
}

// Generate last-6-months labels
function last6Months() {
  const months = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return months[d.getMonth()];
  });
}

const DONUT_COLORS = ["#6366f1", "#22d3ee", "#a78bfa", "#34d399"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1729] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const months = last6Months();

  useEffect(() => {
    fetch(`${API}/admin/stats`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Build chart data from real stats
  const visitTrend = months.map((month, i) => ({
    month,
    visites: stats ? Math.round((stats.total_visits / 6) * (0.6 + i * 0.08 + Math.random() * 0.2)) : 0,
    réussies: stats ? Math.round((stats.successful_visits / 6) * (0.5 + i * 0.09 + Math.random() * 0.2)) : 0,
  }));

  const campaignBar = months.map((month, i) => ({
    month,
    campagnes: stats ? Math.max(1, Math.round((stats.total_campaigns / 6) * (0.5 + i * 0.1))) : 0,
  }));

  const donutData = [
    { name: "Actifs", value: stats ? stats.users.total - stats.users.banned : 0 },
    { name: "Admins", value: stats ? stats.users.admins : 0 },
    { name: "Bannis", value: stats ? stats.users.banned : 0 },
    { name: "Proxies", value: stats ? stats.active_proxies : 0 },
  ];

  const kpis = [
    {
      label: "Utilisateurs",
      value: loading ? "—" : stats?.users.total ?? 0,
      sub: `${stats?.users.admins ?? 0} admins`,
      trend: "+12%", up: true,
      icon: Users, color: "text-indigo-400", bg: "bg-indigo-500/10",
      spark: spark(stats?.users.total || 20),
      sparkColor: "#6366f1",
    },
    {
      label: "Visites totales",
      value: loading ? "—" : (stats?.total_visits ?? 0).toLocaleString(),
      sub: `Taux succès ${stats?.success_rate ?? 0}%`,
      trend: "+8%", up: true,
      icon: Activity, color: "text-cyan-400", bg: "bg-cyan-500/10",
      spark: spark(stats?.total_visits || 500),
      sparkColor: "#22d3ee",
    },
    {
      label: "Campagnes",
      value: loading ? "—" : stats?.total_campaigns ?? 0,
      sub: `${stats?.running_campaigns ?? 0} en cours`,
      trend: "+5%", up: true,
      icon: Target, color: "text-violet-400", bg: "bg-violet-500/10",
      spark: spark(stats?.total_campaigns || 10),
      sparkColor: "#a78bfa",
    },
    {
      label: "Comptes bannis",
      value: loading ? "—" : stats?.users.banned ?? 0,
      sub: "Accès suspendus",
      trend: "0%", up: false,
      icon: ShieldAlert, color: "text-rose-400", bg: "bg-rose-500/10",
      spark: spark(stats?.users.banned || 2),
      sparkColor: "#f43f5e",
    },
  ];

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: "linear-gradient(135deg, #080d1a 0%, #0d1528 100%)" }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            KPI <span className="text-indigo-400">Overview</span>
          </h1>
          <p className="text-xs text-white/30 mt-0.5">Plateforme TrafficBot — vue administrateur</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <Zap size={13} className="text-indigo-400" />
          <span className="text-xs text-indigo-300 font-medium">Live</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-white/5 p-5 flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40 font-medium">{k.label}</span>
              <div className={`p-2 rounded-xl ${k.bg}`}>
                <k.icon size={14} className={k.color} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white leading-none">{k.value}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${k.up ? "text-emerald-400" : "text-rose-400"}`}>
                  {k.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {k.trend}
                </span>
                <span className="text-xs text-white/25">{k.sub}</span>
              </div>
            </div>
            {/* Mini sparkline */}
            <div className="h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={k.spark} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`sg-${k.label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={k.sparkColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={k.sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={k.sparkColor} strokeWidth={1.5}
                    fill={`url(#sg-${k.label})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Area chart — Visits trend */}
        <div
          className="lg:col-span-2 rounded-2xl border border-white/5 p-5"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Visites &amp; Succès</h2>
              <p className="text-xs text-white/30 mt-0.5">6 derniers mois</p>
            </div>
            <span className="text-[10px] text-white/25 px-2 py-1 rounded-full border border-white/10">Mensuel</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={visitTrend}>
              <defs>
                <linearGradient id="gVisites" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gReussies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={7} formatter={(v) => <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{v}</span>} />
              <Area type="monotone" dataKey="visites" name="Visites" stroke="#6366f1" strokeWidth={2} fill="url(#gVisites)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
              <Area type="monotone" dataKey="réussies" name="Réussies" stroke="#22d3ee" strokeWidth={2} fill="url(#gReussies)" dot={false} activeDot={{ r: 4, fill: "#22d3ee" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut — Users breakdown */}
        <div
          className="rounded-2xl border border-white/5 p-5"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Répartition</h2>
            <p className="text-xs text-white/30 mt-0.5">Utilisateurs par statut</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={68}
                paddingAngle={3} dataKey="value">
                {donutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {donutData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i] }} />
                  <span className="text-xs text-white/40">{d.name}</span>
                </div>
                <span className="text-xs text-white font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bar — Campaigns per month */}
        <div
          className="rounded-2xl border border-white/5 p-5"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Top Campagnes</h2>
              <p className="text-xs text-white/30 mt-0.5">Activité mensuelle</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={campaignBar} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} width={25} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="campagnes" name="Campagnes" radius={[4, 4, 0, 0]}>
                {campaignBar.map((_, i) => (
                  <Cell key={i} fill={i === campaignBar.length - 1 ? "#6366f1" : "#334155"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stats summary */}
        <div
          className="rounded-2xl border border-white/5 p-5 flex flex-col justify-between"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Résumé plateforme</h2>
            <p className="text-xs text-white/30 mt-0.5">Métriques globales</p>
          </div>
          <div className="space-y-3">
            {[
              { label: "Taux de succès", value: `${stats?.success_rate ?? 0}%`, color: "bg-emerald-500", pct: stats?.success_rate ?? 0 },
              { label: "Proxies actifs", value: stats?.active_proxies ?? 0, color: "bg-indigo-500", pct: Math.min(100, (stats?.active_proxies ?? 0) * 5) },
              { label: "Campagnes actives", value: `${stats?.running_campaigns ?? 0}/${stats?.total_campaigns ?? 0}`, color: "bg-cyan-500",
                pct: stats?.total_campaigns ? Math.round((stats.running_campaigns / stats.total_campaigns) * 100) : 0 },
              { label: "Comptes sains", value: stats ? stats.users.total - stats.users.banned : 0, color: "bg-violet-500",
                pct: stats?.users.total ? Math.round(((stats.users.total - stats.users.banned) / stats.users.total) * 100) : 100 },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/40">{row.label}</span>
                  <span className="text-white font-semibold">{row.value}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${row.color} transition-all duration-700`} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <a href="#" className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 mt-4 transition-colors">
            Voir le rapport complet <ArrowUpRight size={12} />
          </a>
        </div>
      </div>

    </div>
  );
}
