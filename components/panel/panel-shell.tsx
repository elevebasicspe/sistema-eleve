"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";
import { type ProtectedProfile } from "@/lib/auth/use-protected-session";
import { supabase } from "@/lib/supabase/client";

type MenuItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const MAIN_MENU: MenuItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3h8v6h-8zM3 21h8v-6H3z" />
      </svg>
    ),
  },
  {
    label: "Gastos",
    href: "/gastos",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7h18M6 3v4M18 3v4M5 11h14v10H5z" />
      </svg>
    ),
  },
  {
    label: "Ingresos",
    href: "/ingresos",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 20h16M7 14l3-3 3 2 4-5" />
      </svg>
    ),
  },
  {
    label: "Productos",
    href: "/productos",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7" />
      </svg>
    ),
  },
  {
    label: "Proveedores",
    href: "/proveedores",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 21h18M5 21V9l7-4 7 4v12M9 13h6" />
      </svg>
    ),
  },
  {
    label: "Clientes",
    href: "/clientes",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
      </svg>
    ),
  },
  {
    label: "Cuentas bancarias",
    href: "/cuentas-bancarias",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 10l9-6 9 6M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M3 18h18" />
      </svg>
    ),
  },
  {
    label: "Usuarios",
    href: "/usuarios",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
      </svg>
    ),
  },
];

const ACCOUNT_MENU: MenuItem = {
  label: "Mi cuenta",
  href: "/mi-cuenta",
  icon: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
    </svg>
  ),
};

type PanelShellProps = {
  title: string;
  subtitle?: string;
  profile: ProtectedProfile;
  actions?: ReactNode;
  children: ReactNode;
};

function itemClass(active: boolean) {
  return active
    ? "flex items-center gap-2 rounded-lg bg-[#d7b7a0]/35 px-3 py-2 text-sm font-semibold text-[#0a193b]"
    : "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#0a193b]/85 transition hover:bg-[#f6ebe3]";
}

export function PanelShell({
  title,
  subtitle,
  profile,
  actions,
  children,
}: PanelShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const initials =
    profile.full_name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E";

  const onSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <main className="min-h-screen bg-[#f3f1ef]">
      <div className="md:grid md:min-h-screen md:grid-cols-[228px_1fr]">
        <aside className="border-b border-[#d7b7a0]/50 bg-white md:border-r md:border-b-0">
          <div className="flex h-full flex-col px-3 py-4 md:sticky md:top-0 md:max-h-screen">
            <div className="mb-4 px-2">
              <Image
                src="/ELEVe-logo-transparente.svg"
                alt="ELEVE"
                width={140}
                height={40}
                className="h-auto w-[128px]"
                priority
              />
            </div>

            <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-[#0a193b]/45">
              Principal
            </div>

            <nav className="overflow-x-auto pb-2 md:overflow-visible md:pb-0">
              <ul className="flex min-w-max gap-1 md:min-w-0 md:flex-col">
                {MAIN_MENU.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className={itemClass(active)}>
                        {item.icon}
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mt-3 border-t border-[#d7b7a0]/40 pt-3 md:mt-auto">
              <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-[#0a193b]/45">
                Cuenta
              </div>
              <div className="rounded-xl border border-[#d7b7a0]/45 bg-[#faf4ef] p-2">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={ACCOUNT_MENU.href}
                    className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-[#f6ebe3]"
                  >
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-[#d7b7a0]/45 bg-[#e9d3c3]">
                      {profile.avatar_url ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url("${profile.avatar_url}")` }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#0a193b]">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0a193b]">
                        {profile.full_name}
                      </p>
                      <p className="truncate text-xs uppercase tracking-wide text-[#0a193b]/70">
                        {profile.role}
                      </p>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={onSignOut}
                    title="Cerrar sesion"
                    aria-label="Cerrar sesion"
                    className="rounded-lg p-2 text-[#0a193b]/70 transition hover:bg-[#f6ebe3] hover:text-[#0a193b]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" />
                      <path d="M21 12H9" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="bg-[#f3f1ef] px-4 py-5 sm:px-6 md:px-8 md:py-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#0a193b] sm:text-4xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-[#0a193b]/70">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </header>

          <div className="space-y-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
