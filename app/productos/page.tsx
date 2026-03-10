"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ProductosSkeleton } from "@/components/panel/loading-skeletons";
import { PanelShell } from "@/components/panel/panel-shell";
import { useProtectedSession } from "@/lib/auth/use-protected-session";
import { supabase } from "@/lib/supabase/client";

type ProductRow = {
  id: string;
  name: string;
  product_type: string;
  category: string;
  sku: string | null;
  price: number;
  base_cost: number;
  stock: number;
  sales_count: number;
  sales_units: number;
  sales_total: number;
  is_active: boolean;
  created_at: string;
};

type ProductFormState = {
  name: string;
  productType: string;
  category: string;
  sku: string;
  price: string;
  baseCost: string;
  stock: string;
};

const INITIAL_PRODUCT_FORM: ProductFormState = {
  name: "",
  productType: "Polo",
  category: "Basicos",
  sku: "",
  price: "",
  baseCost: "",
  stock: "0",
};

type SaleFormState = {
  productId: string;
  saleChannel: "presencial" | "tiktok_live";
  quantity: string;
  unitPrice: string;
};

const INITIAL_SALE_FORM: SaleFormState = {
  productId: "",
  saleChannel: "presencial",
  quantity: "1",
  unitPrice: "",
};

function formatPen(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

function dbErrorMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code === "42P01") {
    return "No existe la tabla de productos/ventas. Ejecuta supabase/products.sql en Supabase.";
  }
  return error.message || fallback;
}

export default function ProductosPage() {
  const { loading, profile, isManager } = useProtectedSession();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);

  const [productsLoading, setProductsLoading] = useState(false);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [productForm, setProductForm] = useState<ProductFormState>(INITIAL_PRODUCT_FORM);
  const [saleForm, setSaleForm] = useState<SaleFormState>(INITIAL_SALE_FORM);

  const productsMap = useMemo(() => {
    const map = new Map<string, ProductRow>();
    for (const product of products) map.set(product.id, product);
    return map;
  }, [products]);

  const summary = useMemo(() => {
    const stockTotal = products.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
    const activeProducts = products.filter((item) => item.is_active).length;
    const totalSales = products.reduce((sum, item) => sum + (Number(item.sales_total) || 0), 0);
    const salesCount = products.reduce((sum, item) => sum + (Number(item.sales_count) || 0), 0);
    const unitsSold = products.reduce((sum, item) => sum + (Number(item.sales_units) || 0), 0);
    const estimatedMargin = products.reduce(
      (sum, item) =>
        sum + (Number(item.sales_units) || 0) * ((Number(item.price) || 0) - (Number(item.base_cost) || 0)),
      0
    );

    return {
      stockTotal,
      activeProducts,
      totalSales,
      salesCount,
      unitsSold,
      estimatedMargin,
    };
  }, [products]);

  const loadProducts = async () => {
    setProductsLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProductsLoading(false);

    if (error) {
      setPageError(dbErrorMessage(error, "No se pudieron cargar productos."));
      return;
    }

    setProducts((data ?? []) as ProductRow[]);
  };

  useEffect(() => {
    if (loading || !profile) return;
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, profile]);

  const openSaleModal = (product: ProductRow) => {
    setSaleForm({
      productId: product.id,
      saleChannel: "presencial",
      quantity: "1",
      unitPrice: `${Number(product.price) || 0}`,
    });
    setIsSaleModalOpen(true);
  };

  const onSubmitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !isManager) return;

    const name = productForm.name.trim();
    const productType = productForm.productType.trim();
    const category = productForm.category.trim();
    const sku = productForm.sku.trim();
    const price = parseNumber(productForm.price);
    const baseCost = parseNumber(productForm.baseCost);
    const stock = Number(productForm.stock);

    if (!name || !productType || !category) {
      setPageError("Nombre, tipo y categoria son obligatorios.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setPageError("Precio debe ser un numero valido.");
      return;
    }

    if (!Number.isFinite(baseCost) || baseCost < 0) {
      setPageError("Costo base debe ser un numero valido.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setPageError("Stock debe ser un entero mayor o igual a 0.");
      return;
    }

    setSavingProduct(true);
    setPageError(null);
    setPageSuccess(null);

    const { error } = await supabase.from("products").insert({
      name,
      product_type: productType,
      category,
      sku: sku || null,
      price,
      base_cost: baseCost,
      stock,
      created_by: profile.id,
    });

    setSavingProduct(false);

    if (error) {
      if (error.code === "23505") {
        setPageError("Ya existe un producto con ese nombre o SKU.");
      } else {
        setPageError(dbErrorMessage(error, "No se pudo registrar producto."));
      }
      return;
    }

    setPageSuccess("Producto registrado.");
    setProductForm(INITIAL_PRODUCT_FORM);
    setIsProductModalOpen(false);
    await loadProducts();
  };

  const onSubmitSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    const quantity = Number(saleForm.quantity);
    const unitPrice = parseNumber(saleForm.unitPrice);
    if (!saleForm.productId) {
      setPageError("Selecciona un producto.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setPageError("Cantidad debe ser entero mayor a 0.");
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setPageError("Precio de venta debe ser un numero valido.");
      return;
    }

    setSavingSale(true);
    setPageError(null);
    setPageSuccess(null);

    const { error } = await supabase.from("product_sales").insert({
      product_id: saleForm.productId,
      sale_channel: saleForm.saleChannel,
      quantity,
      unit_price: unitPrice,
      registered_by: profile.id,
    });

    setSavingSale(false);

    if (error) {
      setPageError(dbErrorMessage(error, "No se pudo registrar venta."));
      return;
    }

    setPageSuccess("Venta registrada. Stock y metricas actualizadas.");
    setIsSaleModalOpen(false);
    setSaleForm(INITIAL_SALE_FORM);
    await loadProducts();
  };

  if (loading || !profile) return <ProductosSkeleton />;

  return (
    <PanelShell
      title="Productos"
      subtitle="Catalogo, stock y ventas de productos ELEVE."
      profile={profile}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {isManager && (
            <button
              type="button"
              onClick={() => setIsProductModalOpen(true)}
              className="rounded-lg bg-[#0a193b] px-3 py-2 text-xs font-semibold text-white"
            >
              Registrar producto
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (products.length > 0) {
                openSaleModal(products[0]);
              } else {
                setPageError("Primero registra un producto.");
              }
            }}
            className="rounded-lg border border-[#d7b7a0]/80 bg-white px-3 py-2 text-xs font-semibold text-[#0a193b]"
          >
            Registrar venta
          </button>
        </div>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <p className="text-sm text-[#0a193b]/70">Stock total</p>
          <p className="mt-2 text-3xl font-bold text-[#0a193b]">{summary.stockTotal}</p>
        </article>
        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <p className="text-sm text-[#0a193b]/70">Productos activos</p>
          <p className="mt-2 text-3xl font-bold text-[#0a193b]">{summary.activeProducts}</p>
        </article>
        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <p className="text-sm text-[#0a193b]/70">Total ventas</p>
          <p className="mt-2 text-3xl font-bold text-[#0a193b]">{formatPen(summary.totalSales)}</p>
        </article>
        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <p className="text-sm text-[#0a193b]/70">Numero de ventas</p>
          <p className="mt-2 text-3xl font-bold text-[#0a193b]">{summary.salesCount}</p>
        </article>
        <article className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <p className="text-sm text-[#0a193b]/70">Margen estimado</p>
          <p className="mt-2 text-3xl font-bold text-[#0a193b]">{formatPen(summary.estimatedMargin)}</p>
          <p className="mt-2 text-xs text-[#0a193b]/65">Unidades vendidas: {summary.unitsSold}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)] sm:p-6">
        <h2 className="text-2xl font-semibold text-[#0a193b]">Productos</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#d7b7a0]/35">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f4ede7] text-[#0a193b]">
              <tr>
                <th className="px-3 py-3 font-semibold">Nombre</th>
                <th className="px-3 py-3 font-semibold">Tipo</th>
                <th className="px-3 py-3 font-semibold">Categoria</th>
                <th className="px-3 py-3 font-semibold">Precio</th>
                <th className="px-3 py-3 font-semibold">Costo base</th>
                <th className="px-3 py-3 font-semibold">Stock</th>
                <th className="px-3 py-3 font-semibold">Nro ventas</th>
                <th className="px-3 py-3 font-semibold">Total ventas</th>
                <th className="px-3 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productsLoading &&
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`product-skel-${index}`} className="border-t border-[#d7b7a0]/35">
                    {Array.from({ length: 9 }).map((__, c) => (
                      <td key={c} className="px-3 py-3">
                        <div className="eleve-skeleton h-5 w-full rounded-md" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!productsLoading &&
                products.map((product) => (
                  <tr key={product.id} className="border-t border-[#d7b7a0]/35 text-[#0a193b]/90">
                    <td className="px-3 py-3 font-semibold">{product.name}</td>
                    <td className="px-3 py-3">{product.product_type}</td>
                    <td className="px-3 py-3">{product.category}</td>
                    <td className="px-3 py-3">{formatPen(Number(product.price) || 0)}</td>
                    <td className="px-3 py-3">{formatPen(Number(product.base_cost) || 0)}</td>
                    <td className="px-3 py-3">{product.stock}</td>
                    <td className="px-3 py-3">{product.sales_count}</td>
                    <td className="px-3 py-3 font-semibold text-[#0a193b]">
                      {formatPen(Number(product.sales_total) || 0)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => openSaleModal(product)}
                        className="rounded-md border border-[#d7b7a0]/80 bg-white px-2.5 py-1 text-xs font-semibold text-[#0a193b] transition hover:bg-[#f6ebe3]"
                      >
                        Vender
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/55 bg-white p-5 shadow-[0_20px_45px_rgba(10,25,59,0.3)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#0a193b]">Registrar producto</h2>
                <p className="mt-1 text-sm text-[#0a193b]/70">
                  Nombre, tipo, categoria, precio, costo y stock inicial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="rounded-md border border-[#d7b7a0]/60 px-2 py-1 text-sm text-[#0a193b]"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={onSubmitProduct}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="productName">
                  Nombre
                </label>
                <input
                  id="productName"
                  value={productForm.name}
                  onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="productType">
                    Tipo
                  </label>
                  <input
                    id="productType"
                    value={productForm.productType}
                    onChange={(event) => setProductForm((current) => ({ ...current, productType: event.target.value }))}
                    placeholder="Polo, pantalon..."
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="productCategory">
                    Categoria
                  </label>
                  <input
                    id="productCategory"
                    value={productForm.category}
                    onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))}
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="productPrice">
                    Precio
                  </label>
                  <input
                    id="productPrice"
                    inputMode="decimal"
                    value={productForm.price}
                    onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))}
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="productBaseCost">
                    Costo base
                  </label>
                  <input
                    id="productBaseCost"
                    inputMode="decimal"
                    value={productForm.baseCost}
                    onChange={(event) => setProductForm((current) => ({ ...current, baseCost: event.target.value }))}
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="productStock">
                    Stock inicial
                  </label>
                  <input
                    id="productStock"
                    inputMode="numeric"
                    value={productForm.stock}
                    onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))}
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="productSku">
                    SKU (opcional)
                  </label>
                  <input
                    id="productSku"
                    value={productForm.sku}
                    onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
                >
                  {savingProduct ? "Guardando..." : "Registrar producto"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-lg border border-[#d7b7a0]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[#0a193b]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-lg rounded-2xl border border-[#d7b7a0]/55 bg-white p-5 shadow-[0_20px_45px_rgba(10,25,59,0.3)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#0a193b]">Registrar venta</h2>
                <p className="mt-1 text-sm text-[#0a193b]/70">
                  Canal presencial o TikTok Live. Actualiza stock y metricas automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSaleModalOpen(false)}
                className="rounded-md border border-[#d7b7a0]/60 px-2 py-1 text-sm text-[#0a193b]"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={onSubmitSale}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="saleProduct">
                  Producto
                </label>
                <select
                  id="saleProduct"
                  value={saleForm.productId}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    setSaleForm((current) => ({
                      ...current,
                      productId: selectedId,
                      unitPrice: `${Number(productsMap.get(selectedId)?.price || 0)}`,
                    }));
                  }}
                  className="w-full rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} (stock {product.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="saleChannel">
                    Canal
                  </label>
                  <select
                    id="saleChannel"
                    value={saleForm.saleChannel}
                    onChange={(event) =>
                      setSaleForm((current) => ({
                        ...current,
                        saleChannel: event.target.value as "presencial" | "tiktok_live",
                      }))
                    }
                    className="w-full rounded-md border border-[#d7b7a0]/55 bg-white px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  >
                    <option value="presencial">Presencial</option>
                    <option value="tiktok_live">TikTok Live</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[#0a193b]" htmlFor="saleQuantity">
                    Cantidad
                  </label>
                  <input
                    id="saleQuantity"
                    inputMode="numeric"
                    value={saleForm.quantity}
                    onChange={(event) => setSaleForm((current) => ({ ...current, quantity: event.target.value }))}
                    className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#0a193b]" htmlFor="salePrice">
                  Precio unitario de venta
                </label>
                <input
                  id="salePrice"
                  inputMode="decimal"
                  value={saleForm.unitPrice}
                  onChange={(event) => setSaleForm((current) => ({ ...current, unitPrice: event.target.value }))}
                  className="w-full rounded-md border border-[#d7b7a0]/55 px-3 py-2 text-sm text-[#0a193b] outline-none focus:border-[#0a193b]"
                  required
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingSale || products.length === 0}
                  className="rounded-lg bg-[#0a193b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#12285e] disabled:opacity-60"
                >
                  {savingSale ? "Guardando..." : "Registrar venta"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSaleModalOpen(false)}
                  className="rounded-lg border border-[#d7b7a0]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[#0a193b]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </PanelShell>
  );
}
