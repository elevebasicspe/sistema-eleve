"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MiCuentaSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import { useProtectedSession } from "@/lib/auth/use-protected-session";
import { supabase } from "@/lib/supabase/client";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function MiCuentaPage() {
  const router = useRouter();
  const { loading, profile, refresh } = useProtectedSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const initials = useMemo(
    () =>
      profile
        ? profile.full_name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("") || "E"
        : "E",
    [profile]
  );

  const onSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/");
  };

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);

    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSelectedFile(null);
      setUploadError("Formato no permitido. Usa PNG, JPG o WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null);
      setUploadError("La imagen supera 5MB.");
      return;
    }

    setSelectedFile(file);
  };

  const uploadAvatar = async () => {
    if (!profile || !selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const extension = selectedFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["png", "jpg", "jpeg", "webp"].includes(extension)
      ? extension
      : "jpg";
    const path = `${profile.id}/avatar.${safeExt}`;

    const { error: uploadStorageError } = await supabase.storage
      .from("avatars")
      .upload(path, selectedFile, {
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadStorageError) {
      setIsUploading(false);
      setUploadError(`No se pudo subir la imagen: ${uploadStorageError.message}`);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    const avatarUrl = `${publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", profile.id);

    if (updateError) {
      setIsUploading(false);
      setUploadError(
        updateError.message.toLowerCase().includes("avatar_url")
          ? "Falta la columna avatar_url. Ejecuta el SQL de supabase/avatar_profile.sql."
          : `No se pudo guardar el avatar: ${updateError.message}`
      );
      return;
    }

    await refresh();
    setIsUploading(false);
    setUploadSuccess("Foto de perfil actualizada.");
    setSelectedFile(null);
  };

  if (loading || !profile) return <MiCuentaSkeleton />;

  return (
    <PanelShell
      title="Mi cuenta"
      subtitle="Informacion del perfil y sesion actual."
      profile={profile}
    >
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <h2 className="text-xl font-semibold text-[#0a193b]">Perfil</h2>

          <div className="mt-4 flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-[#d7b7a0]/55 bg-[#e9d3c3]">
              {profile.avatar_url ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${profile.avatar_url}")` }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-[#0a193b]">
                  {initials}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[#0a193b]">{profile.full_name}</p>
              <p className="truncate text-sm text-[#0a193b]/75">{profile.email}</p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <label htmlFor="avatar" className="text-sm font-medium text-[#0a193b]">
              Subir foto de perfil
            </label>
            <input
              id="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onSelectFile}
              className="block w-full text-sm text-[#0a193b]/80 file:mr-3 file:rounded-md file:border-0 file:bg-[#0a193b] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#12285e]"
            />
            {selectedFile && (
              <p className="text-xs text-[#0a193b]/65">Archivo: {selectedFile.name}</p>
            )}
            {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
            {uploadSuccess && <p className="text-xs text-emerald-700">{uploadSuccess}</p>}
            <button
              type="button"
              onClick={uploadAvatar}
              disabled={!selectedFile || isUploading}
              className="mt-1 rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-50"
            >
              {isUploading ? "Subiendo..." : "Guardar foto"}
            </button>
          </div>

          <dl className="mt-6 space-y-2 text-sm text-[#0a193b]/85">
            <div>
              <dt className="font-medium text-[#0a193b]/65">Rol</dt>
              <dd className="mt-0.5 uppercase tracking-wide">{profile.role}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#0a193b]/65">Aprobacion</dt>
              <dd className="mt-0.5">{profile.is_approved ? "Aprobado" : "Pendiente"}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <h2 className="text-xl font-semibold text-[#0a193b]">Sesion</h2>
          <p className="mt-3 text-sm text-[#0a193b]/75">
            Cierra sesion de forma segura en este dispositivo.
          </p>
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="mt-6 rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
          >
            {isSigningOut ? "Cerrando..." : "Cerrar sesion"}
          </button>
        </article>
      </section>
    </PanelShell>
  );
}
