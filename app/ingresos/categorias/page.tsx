"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import { useProtectedSession } from "@/lib/auth/use-protected-session";
import { supabase } from "@/lib/supabase/client";

type ExpenseCategory = {
  id: string;
  name: string;
  category_name?: string | null;
  subcategory_name?: string | null;
  description: string | null;
  created_at: string;
};

type EditDraft = {
  category: string;
  subcategory: string;
  description: string;
};

function dbErrorMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code === "42P01") {
    return "No existe la tabla de categorias. Ejecuta supabase/incomes.sql en Supabase.";
  }
  return error.message || fallback;
}

function getParts(category: ExpenseCategory): { category: string; subcategory: string } {
  const main = category.category_name?.trim();
  const sub = category.subcategory_name?.trim();
  if (main || sub) {
    return { category: main || category.name || "-", subcategory: sub || "-" };
  }

  const parts = (category.name || "").split("/").map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { category: parts[0], subcategory: parts.slice(1).join(" / ") };
  }
  return { category: category.name || "-", subcategory: "-" };
}

export default function IngresosCategoriasPage() {
  const { loading, profile, isManager } = useProtectedSession();
  const [items, setItems] = useState<ExpenseCategory[]>([]);
  const [supportsColumns, setSupportsColumns] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ category: "", subcategory: "", description: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const total = useMemo(() => items.length, [items]);

  const loadCategories = useCallback(async () => {
    setIsLoadingList(true);
    setPageError(null);

    const modern = await supabase
      .from("income_categories")
      .select("id,name,category_name,subcategory_name,description,created_at")
      .order("category_name", { ascending: true })
      .order("subcategory_name", { ascending: true });

    if (!modern.error) {
      setSupportsColumns(true);
      setItems(modern.data ?? []);
      setIsLoadingList(false);
      return;
    }

    if (!modern.error.message.toLowerCase().includes("category_name")) {
      setPageError(dbErrorMessage(modern.error, "No se pudieron cargar categorias."));
      setIsLoadingList(false);
      return;
    }

    const legacy = await supabase
      .from("income_categories")
      .select("id,name,description,created_at")
      .order("name", { ascending: true });

    if (legacy.error) {
      setPageError(dbErrorMessage(legacy.error, "No se pudieron cargar categorias."));
      setIsLoadingList(false);
      return;
    }

    setSupportsColumns(false);
    setItems(legacy.data ?? []);
    setIsLoadingList(false);
  }, []);

  useEffect(() => {
    if (loading || !profile) return;
    const timer = window.setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, profile, loadCategories]);

  const startEdit = (item: ExpenseCategory) => {
    const parts = getParts(item);
    setEditingId(item.id);
    setDraft({
      category: parts.category === "-" ? "" : parts.category,
      subcategory: parts.subcategory === "-" ? "" : parts.subcategory,
      description: item.description || "",
    });
    setPageError(null);
    setPageSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ category: "", subcategory: "", description: "" });
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId || !isManager) return;

    const category = draft.category.trim();
    const subcategory = draft.subcategory.trim();
    const description = draft.description.trim();
    if (!category || !subcategory) {
      setPageError("Categoria y subcategoria son obligatorias.");
      return;
    }

    setIsSaving(true);
    setPageError(null);
    setPageSuccess(null);

    const payload: Record<string, string | null> = {
      name: `${category} / ${subcategory}`,
      description: description || null,
    };

    if (supportsColumns) {
      payload.category_name = category;
      payload.subcategory_name = subcategory;
    }

    const { error } = await supabase.from("income_categories").update(payload).eq("id", editingId);
    setIsSaving(false);

    if (error) {
      if (error.code === "23505") {
        setPageError("Esa combinacion categoria/subcategoria ya existe.");
      } else {
        setPageError(dbErrorMessage(error, "No se pudo guardar cambios."));
      }
      return;
    }

    setPageSuccess("Categoria actualizada.");
    cancelEdit();
    await loadCategories();
  };

  const deleteCategory = async (item: ExpenseCategory) => {
    if (!isManager) return;
    const parts = getParts(item);
    const confirmed = window.confirm(
      `Vas a borrar la categoria "${parts.category} / ${parts.subcategory}". Esta accion no se puede deshacer.`
    );
    if (!confirmed) return;

    setIsDeletingId(item.id);
    setPageError(null);
    setPageSuccess(null);
    const { error } = await supabase.from("income_categories").delete().eq("id", item.id);
    setIsDeletingId(null);

    if (error) {
      setPageError(dbErrorMessage(error, "No se pudo borrar categoria."));
      return;
    }

    setPageSuccess("Categoria eliminada.");
    setItems((current) => current.filter((row) => row.id !== item.id));
  };

  if (loading || !profile) return <ModuleSkeleton title="Categorias de ingresos" />;

  return (
    <PanelShell
      title="Categorias de ingresos"
      subtitle="Administra categoria, subcategoria y descripcion."
      profile={profile}
      actions={
        <Link
          href="/ingresos"
          className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b] transition hover:bg-[#f6ebe3]"
        >
          Volver a ingresos
        </Link>
      }
    >
      {pageError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {pageError}
        </p>
      )}
      {pageSuccess && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {pageSuccess}
        </p>
      )}

      <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-[#0a193b]/70">{total} categorias registradas</p>
          {!isManager && (
            <p className="text-xs text-[#0a193b]/65">Solo owner/admin pueden editar y borrar.</p>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#d7b7a0]/35">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f4ede7] text-[#0a193b]">
              <tr>
                <th className="px-3 py-2 font-semibold">Categoria</th>
                <th className="px-3 py-2 font-semibold">Subcategoria</th>
                <th className="px-3 py-2 font-semibold">Descripcion</th>
                <th className="px-3 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingList && (
                <tr>
                  <td colSpan={4} className="px-3 py-4">
                    <div className="space-y-2">
                      <div className="eleve-skeleton h-8 w-full rounded-md" />
                      <div className="eleve-skeleton h-8 w-full rounded-md" />
                      <div className="eleve-skeleton h-8 w-full rounded-md" />
                    </div>
                  </td>
                </tr>
              )}

              {!isLoadingList &&
                items.map((item) => {
                  const parts = getParts(item);
                  return (
                    <tr key={item.id} className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90">
                      <td className="px-3 py-2">{parts.category}</td>
                      <td className="px-3 py-2">{parts.subcategory}</td>
                      <td className="px-3 py-2">{item.description || "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!isManager}
                            onClick={() => startEdit(item)}
                            className="rounded-md border border-[#d7b7a0]/80 bg-white px-2.5 py-1 text-xs font-semibold text-[#0a193b] disabled:opacity-40"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={!isManager || isDeletingId === item.id}
                            onClick={() => void deleteCategory(item)}
                            className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 disabled:opacity-40"
                          >
                            {isDeletingId === item.id ? "Borrando..." : "Borrar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!isLoadingList && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-center text-sm text-[#0a193b]/70">
                    No hay categorias registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingId && (
        <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
          <h2 className="text-2xl font-semibold text-[#0a193b]">Editar categoria</h2>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={saveEdit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0a193b]" htmlFor="editCategory">
                Categoria
              </label>
              <input
                id="editCategory"
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                maxLength={40}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#0a193b]" htmlFor="editSubcategory">
                Subcategoria
              </label>
              <input
                id="editSubcategory"
                value={draft.subcategory}
                onChange={(event) => setDraft((current) => ({ ...current, subcategory: event.target.value }))}
                className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                maxLength={40}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-[#0a193b]" htmlFor="editDescription">
                Descripcion
              </label>
              <textarea
                id="editDescription"
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                maxLength={180}
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
              >
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-[#d7b7a0]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[#0a193b]"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}
    </PanelShell>
  );
}
