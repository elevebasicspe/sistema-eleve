import Image from "next/image";

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`eleve-skeleton rounded-lg ${className}`} />;
}

function ShellSkeleton({ children }: { children: React.ReactNode }) {
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
                className="h-auto w-[128px] opacity-85"
                priority
              />
            </div>

            <div className="space-y-2 px-1">
              <SkeletonBlock className="h-8 w-full" />
              <SkeletonBlock className="h-8 w-11/12" />
              <SkeletonBlock className="h-8 w-10/12" />
              <SkeletonBlock className="h-8 w-full" />
              <SkeletonBlock className="h-8 w-9/12" />
              <SkeletonBlock className="h-8 w-10/12" />
              <SkeletonBlock className="h-8 w-11/12" />
            </div>

            <div className="mt-auto border-t border-[#d7b7a0]/40 pt-3">
              <SkeletonBlock className="h-8 w-5/6" />
            </div>
          </div>
        </aside>

        <section className="bg-[#f3f1ef] px-4 py-5 sm:px-6 md:px-8 md:py-8">{children}</section>
      </div>
    </main>
  );
}

export function DashboardSkeleton() {
  return (
    <ShellSkeleton>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-10 w-56" />
          <SkeletonBlock className="h-4 w-96 max-w-[70vw]" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <SkeletonBlock className="h-9 w-16" />
          <SkeletonBlock className="h-9 w-16" />
          <SkeletonBlock className="h-9 w-16" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-5 shadow-[0_6px_16px_rgba(10,25,59,0.12)]"
          >
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="mt-3 h-9 w-20" />
            <SkeletonBlock className="mt-3 h-4 w-full" />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
        <SkeletonBlock className="h-7 w-64" />
        <SkeletonBlock className="mt-4 h-[260px] w-full rounded-xl" />
      </div>

      <div className="mt-6 rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
        <SkeletonBlock className="h-7 w-52" />
        <div className="mt-4 space-y-2">
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
        </div>
      </div>
    </ShellSkeleton>
  );
}

export function UsuariosSkeleton() {
  return (
    <ShellSkeleton>
      <div className="mb-6 space-y-2">
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-4 w-80 max-w-[70vw]" />
      </div>

      <div className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
        <SkeletonBlock className="h-7 w-72" />
        <div className="mt-4 space-y-3">
          <SkeletonBlock className="h-20 w-full rounded-xl" />
          <SkeletonBlock className="h-20 w-full rounded-xl" />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
        <SkeletonBlock className="h-7 w-56" />
        <div className="mt-4 space-y-2">
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
        </div>
      </div>
    </ShellSkeleton>
  );
}

export function ModuleSkeleton({ title }: { title: string }) {
  return (
    <ShellSkeleton>
      <div className="mb-6 space-y-2">
        <SkeletonBlock className="h-10 w-40" />
        <SkeletonBlock className="h-4 w-80 max-w-[70vw]" />
      </div>
      <div className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
        <SkeletonBlock className="h-7 w-64" />
        <SkeletonBlock className="mt-3 h-4 w-80 max-w-[90%]" />
        <SkeletonBlock className="mt-6 h-36 w-full rounded-xl" />
        <p className="sr-only">{title}</p>
      </div>
    </ShellSkeleton>
  );
}

export function MiCuentaSkeleton() {
  return (
    <ShellSkeleton>
      <div className="mb-6 space-y-2">
        <SkeletonBlock className="h-10 w-44" />
        <SkeletonBlock className="h-4 w-80 max-w-[70vw]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <SkeletonBlock className="h-7 w-48" />
          <SkeletonBlock className="mt-4 h-4 w-2/3" />
          <SkeletonBlock className="mt-2 h-4 w-3/4" />
          <SkeletonBlock className="mt-2 h-4 w-1/2" />
          <SkeletonBlock className="mt-2 h-4 w-2/5" />
        </div>
        <div className="rounded-2xl border border-[#d7b7a0]/45 bg-white p-6 shadow-[0_6px_16px_rgba(10,25,59,0.12)]">
          <SkeletonBlock className="h-7 w-28" />
          <SkeletonBlock className="mt-4 h-4 w-11/12" />
          <SkeletonBlock className="mt-6 h-10 w-40" />
        </div>
      </div>
    </ShellSkeleton>
  );
}
