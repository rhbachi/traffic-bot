import { useEffect, useState } from "react";
import { Users, Ban, CheckCircle2, Trash2, Search, ShieldCheck, UserX } from "lucide-react";
import { authStore } from "../store/auth";

import { API_BASE } from "../config";
const API = `${API_BASE}/api`;
function authHeaders() {
  return { Authorization: `Bearer ${authStore.getState().token}`, "Content-Type": "application/json" };
}

interface User {
  id: number;
  email: string;
  role: "user" | "admin";
  is_banned: number;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const fetchUsers = async () => {
    const res = await fetch(`${API}/admin/users`, { headers: authHeaders() });
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateRole = async (id: number, role: string) => {
    await fetch(`${API}/admin/users/${id}/role`, {
      method: "PATCH", headers: authHeaders(), body: JSON.stringify({ role }),
    });
    fetchUsers();
  };

  const toggleBan = async (user: User) => {
    await fetch(`${API}/admin/users/${user.id}/${user.is_banned ? "unban" : "ban"}`, {
      method: "PATCH", headers: authHeaders(),
    });
    fetchUsers();
  };

  const deleteUser = async (id: number) => {
    await fetch(`${API}/admin/users/${id}`, { method: "DELETE", headers: authHeaders() });
    setConfirmDelete(null);
    fetchUsers();
  };

  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()));
  const total = users.length;
  const admins = users.filter(u => u.role === "admin").length;
  const banned = users.filter(u => u.is_banned).length;

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: "linear-gradient(135deg, #080d1a 0%, #0d1528 100%)" }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Gestion <span className="text-indigo-400">Utilisateurs</span>
          </h1>
          <p className="text-xs text-white/30 mt-0.5">{total} comptes enregistrés</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: total, icon: Users, color: "text-indigo-400", bg: "bg-indigo-500/10" },
          { label: "Admins", value: admins, icon: ShieldCheck, color: "text-violet-400", bg: "bg-violet-500/10" },
          { label: "Bannis", value: banned, icon: UserX, color: "text-rose-400", bg: "bg-rose-500/10" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/5 p-4 flex items-center gap-3"
            style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className={`p-2.5 rounded-xl ${c.bg}`}>
              <c.icon size={15} className={c.color} />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{c.value}</div>
              <div className="text-xs text-white/30">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par email…"
          className="w-full rounded-xl border border-white/8 pl-8 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-indigo-500/40 transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/5 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["Utilisateur", "Rôle", "Statut", "Inscrit le", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs text-white/25 font-medium px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map((u) => (
                    <tr key={u.id}
                      className={`border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.02] ${u.is_banned ? "opacity-40" : ""}`}>

                      {/* Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            u.role === "admin" ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-white/50"
                          }`}>
                            {u.email[0].toUpperCase()}
                          </div>
                          <span className="text-white text-sm">{u.email}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-4">
                        <div className="relative inline-flex">
                          <select
                            value={u.role}
                            onChange={(e) => updateRole(u.id, e.target.value)}
                            className={`appearance-none text-xs px-3 py-1 pr-2 rounded-full border cursor-pointer outline-none transition-colors font-medium ${
                              u.role === "admin"
                                ? "border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
                                : "border-white/10 text-white/40 bg-transparent"
                            }`}
                          >
                            <option value="user" className="bg-gray-900">user</option>
                            <option value="admin" className="bg-gray-900">admin</option>
                          </select>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {u.is_banned
                          ? <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">Banni</span>
                          : <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Actif</span>
                        }
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-white/25 text-xs">
                        {new Date(u.created_at).toLocaleDateString("fr-FR")}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleBan(u)} title={u.is_banned ? "Débannir" : "Bannir"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.is_banned
                                ? "text-emerald-400/50 hover:text-emerald-400 hover:bg-emerald-500/10"
                                : "text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/10"
                            }`}>
                            {u.is_banned ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                          </button>
                          <button onClick={() => setConfirmDelete(u.id)}
                            className="p-1.5 rounded-lg text-rose-400/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-14 text-white/20 text-sm">Aucun utilisateur trouvé</div>
          )}
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border border-white/10 p-6 max-w-xs w-full shadow-2xl"
            style={{ background: "#0d1528" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center">
                <Trash2 size={16} className="text-rose-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Supprimer l'utilisateur</p>
                <p className="text-white/30 text-xs mt-0.5">Cette action est irréversible</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-colors">
                Annuler
              </button>
              <button onClick={() => deleteUser(confirmDelete)}
                className="flex-1 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
