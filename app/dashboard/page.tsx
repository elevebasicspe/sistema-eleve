"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  APPROVE_ROLES,
  canAccessDashboard,
  normalizeApproveRole,
  normalizeRole,
  type AppRole,
  type ProfileRow,
} from "@/lib/auth/profile";
import { supabase } from "@/lib/supabase/client";

type DashboardUser = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  is_approved: boolean;
  created_at?: string;
};

type SelfProfile = ProfileRow;

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Usuario");
  const [selfProfile, setSelfProfile] = useState<SelfProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const isManager =
    selfProfile?.role === "owner" || selfProfile?.role === "admin";

  const pendingUsers = useMemo(
    () => users.filter((user) => !user.is_approved),
    [users]
  );

  const canDeleteTarget = (target: DashboardUser): boolean => {
    if (!selfProfile) return false;
    if (selfProfile.role === "owner") return true;
    if (selfProfile.role === "admin") return target.role !== "owner";
    return false;
  };

  const loadUsers = async (token: string) => {
    const response = await fetch("/api/admin/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const raw = await response.text();
    const payload = (raw ? JSON.parse(raw) : {}) as {
      users?: DashboardUser[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || "No se pudo listar usuarios.");
    }

    const fetched = payload.users ?? [];
    setUsers(fetched);
    setRoleDrafts((current) => {
      const next = { ...current };
      for (const user of fetched) {
        next[user.id] = normalizeApproveRole(next[user.id] || user.role);
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const [{ data: authData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      const user = authData.user;
      const token = sessionData.session?.access_token ?? null;

      if (!user || !token) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id,full_name,email,role,is_approved")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

      if (!profile) {
        router.replace("/wait");
        return;
      }

      const role = normalizeRole(profile.role);
      if (!canAccessDashboard(role, profile.is_approved)) {
        router.replace("/wait");
        return;
      }

      if (cancelled) return;

      const normalizedSelf: SelfProfile = {
        ...profile,
        role,
      };

      setSelfProfile(normalizedSelf);
      setName(profile.full_name || "Usuario");
      setAccessToken(token);

      const manager = role === "owner" || role === "admin";
      if (manager) {
        try {
          await loadUsers(token);
        } catch (error) {
          setActionError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar la administracion."
          );
        }
      }

      setLoading(false);
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const approveUser = async (userId: string) => {
    if (!accessToken) return;
    setActionError(null);
    setActionSuccess(null);
    setBusyUserId(userId);

    try {
      const role = normalizeApproveRole(roleDrafts[userId]);
      const response = await fetch("/api/admin/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId, role }),
      });

      const raw = await response.text();
      const payload = (raw ? JSON.parse(raw) : {}) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo aprobar usuario.");
      }

      await loadUsers(accessToken);
      setActionSuccess("Usuario aprobado.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Error aprobando usuario."
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!accessToken) return;
    setActionError(null);
    setActionSuccess(null);
    setBusyUserId(userId);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const raw = await response.text();
      const payload = (raw ? JSON.parse(raw) : {}) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo borrar usuario.");
      }

      await loadUsers(accessToken);
      setActionSuccess("Usuario borrado.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Error borrando usuario.");
    } finally {
      setBusyUserId(null);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f2e7df_0%,_#e6d3c5_34%,_#c4a793_62%,_#0a193b_100%)] px-4">
        <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 text-center shadow-[0_18px_45px_rgba(10,25,59,0.3)] sm:p-8">
          <p className="text-sm text-[#0a193b]/80">Cargando dashboard...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f2e7df_0%,_#e6d3c5_34%,_#c4a793_62%,_#0a193b_100%)] px-4 py-8">
      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_18px_45px_rgba(10,25,59,0.3)] sm:p-8">
        <h1 className="text-3xl font-bold text-[#0a193b]">Dashboard</h1>
        <p className="mt-2 text-sm text-[#0a193b]/80">
          Bienvenido, {name}. Rol actual: <strong>{selfProfile?.role}</strong>
        </p>

        {!isManager && (
          <div className="mt-6 rounded-lg border border-[#d7b7a0]/45 bg-[#f8f5f2] p-4 text-sm text-[#0a193b]/85">
            Tu cuenta esta aprobada. No tienes permisos de administracion de usuarios.
          </div>
        )}

        {isManager && (
          <div className="mt-8 space-y-8">
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            {actionSuccess && <p className="text-sm text-emerald-700">{actionSuccess}</p>}

            <section>
              <h2 className="text-xl font-semibold text-[#0a193b]">
                Solicitudes pendientes
              </h2>
              {pendingUsers.length === 0 ? (
                <p className="mt-3 text-sm text-[#0a193b]/70">No hay usuarios pendientes.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {pendingUsers.map((user) => (
                    <article
                      key={user.id}
                      className="rounded-lg border border-[#d7b7a0]/45 bg-[#fcfaf8] p-4"
                    >
                      <p className="text-sm font-semibold text-[#0a193b]">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-[#0a193b]/75">{user.email}</p>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={roleDrafts[user.id] || normalizeApproveRole(user.role)}
                          onChange={(event) =>
                            setRoleDrafts((current) => ({
                              ...current,
                              [user.id]: normalizeApproveRole(event.target.value),
                            }))
                          }
                          className="rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                        >
                          {APPROVE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => approveUser(user.id)}
                          disabled={busyUserId === user.id}
                          className="rounded-md bg-[#0a193b] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-70"
                        >
                          {busyUserId === user.id ? "Aprobando..." : "Aprobar"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0a193b]">Usuarios</h2>
              <div className="mt-4 overflow-x-auto rounded-lg border border-[#d7b7a0]/45">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[#f4ede7] text-[#0a193b]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Nombre</th>
                      <th className="px-3 py-2 font-semibold">Correo</th>
                      <th className="px-3 py-2 font-semibold">Rol</th>
                      <th className="px-3 py-2 font-semibold">Estado</th>
                      <th className="px-3 py-2 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90">
                        <td className="px-3 py-2">{user.full_name}</td>
                        <td className="px-3 py-2">{user.email}</td>
                        <td className="px-3 py-2">{user.role}</td>
                        <td className="px-3 py-2">
                          {user.is_approved ? "Aprobado" : "Pendiente"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            disabled={!canDeleteTarget(user) || busyUserId === user.id}
                            onClick={() => deleteUser(user.id)}
                            className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
                          >
                            {busyUserId === user.id ? "Borrando..." : "Borrar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
