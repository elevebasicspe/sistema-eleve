"use client";

import { useEffect, useMemo, useState } from "react";
import { UsuariosSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import {
  APPROVE_ROLES,
  normalizeApproveRole,
  normalizeRole,
  type AppRole,
} from "@/lib/auth/profile";
import { useProtectedSession } from "@/lib/auth/use-protected-session";

type DashboardUser = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  is_approved: boolean;
};

function parseJsonSafe<T>(raw: string): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

export default function UsuariosPage() {
  const { loading, profile, accessToken, isManager } = useProtectedSession();
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const pendingUsers = useMemo(
    () => users.filter((user) => !user.is_approved),
    [users]
  );

  const canDeleteTarget = (target: DashboardUser): boolean => {
    if (!profile) return false;
    if (target.id === profile.id) return false;
    if (profile.role === "owner") return true;
    if (profile.role === "admin") return target.role !== "owner";
    return false;
  };

  const loadUsers = async (token: string) => {
    const response = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const raw = await response.text();
    const payload = parseJsonSafe<{ users?: DashboardUser[]; error?: string }>(raw);

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
    if (!accessToken || !isManager) return;

    const run = async () => {
      try {
        await loadUsers(accessToken);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando usuarios.");
      }
    };

    void run();
  }, [accessToken, isManager]);

  const approveUser = async (userId: string) => {
    if (!accessToken) return;
    setError(null);
    setSuccess(null);
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
      const payload = parseJsonSafe<{ error?: string }>(raw);
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo aprobar usuario.");
      }

      await loadUsers(accessToken);
      setSuccess("Usuario aprobado.");
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Error aprobando usuario.");
    } finally {
      setBusyUserId(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!accessToken) return;
    setError(null);
    setSuccess(null);
    setBusyUserId(userId);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const raw = await response.text();
      const payload = parseJsonSafe<{ error?: string }>(raw);
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo borrar usuario.");
      }

      await loadUsers(accessToken);
      setSuccess("Usuario borrado.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error borrando usuario.");
    } finally {
      setBusyUserId(null);
    }
  };

  if (loading || !profile) return <UsuariosSkeleton />;

  return (
    <PanelShell
      title="Usuarios"
      subtitle="Gestion y aprobacion de cuentas del sistema."
      profile={profile}
    >
      {!isManager && (
        <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <p className="text-sm text-[#0a193b]/80">
            Solo owner y admin pueden administrar usuarios.
          </p>
        </section>
      )}

      {isManager && (
        <>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
            <h2 className="text-2xl font-semibold text-[#0a193b]">Solicitudes pendientes</h2>
            {pendingUsers.length === 0 ? (
              <p className="mt-3 text-sm text-[#0a193b]/70">No hay usuarios pendientes.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingUsers.map((user) => (
                  <article
                    key={user.id}
                    className="rounded-lg border border-[#d7b7a0]/45 bg-[#fcfaf8] p-4"
                  >
                    <p className="text-sm font-semibold text-[#0a193b]">{user.full_name}</p>
                    <p className="text-xs text-[#0a193b]/75">{user.email}</p>
                    <p className="mt-1 text-xs text-[#0a193b]/65">
                      Rol solicitado: {normalizeRole(user.role)}
                    </p>

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

          <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
            <h2 className="text-2xl font-semibold text-[#0a193b]">Listado general</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-[#d7b7a0]/35">
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
                      <td className="px-3 py-2">{normalizeRole(user.role)}</td>
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
        </>
      )}
    </PanelShell>
  );
}
