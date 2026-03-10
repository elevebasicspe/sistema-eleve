export default function FormLoading() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#efe4dc_0%,#f7f3f0_16%,#f8f6f4_46%,#f8f6f4_100%)] pb-28 sm:px-6 sm:py-8">
      <section className="mx-auto w-full max-w-3xl sm:rounded-[28px] sm:border sm:border-[#d7b7a0]/45 sm:bg-white sm:shadow-[0_18px_40px_rgba(10,25,59,0.12)]">
        <div className="bg-[#0a193b] px-4 pb-6 pt-5 sm:rounded-t-[28px] sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eleve-skeleton h-9 w-34 rounded-md bg-white/20" />
              <div className="mt-4 eleve-skeleton h-4 w-48 rounded-full bg-white/20" />
            </div>
            <div className="eleve-skeleton h-9 w-18 rounded-full bg-white/20" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-[22px] bg-white/12 p-1.5">
            <div className="eleve-skeleton h-14 rounded-[18px] bg-white/20" />
            <div className="eleve-skeleton h-14 rounded-[18px] bg-white/12" />
          </div>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="rounded-[24px] border border-[#d7b7a0]/35 bg-white p-4 shadow-[0_10px_22px_rgba(10,25,59,0.08)]">
            <div className="eleve-skeleton h-4 w-24 rounded-full" />
            <div className="mt-3 eleve-skeleton h-8 w-44 rounded-md" />
            <div className="mt-4 eleve-skeleton h-14 w-full rounded-2xl" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="eleve-skeleton h-16 w-full rounded-2xl" />
              <div className="eleve-skeleton h-16 w-full rounded-2xl" />
            </div>
          </div>

          <div className="rounded-[24px] border border-[#d7b7a0]/35 bg-white p-4 shadow-[0_10px_22px_rgba(10,25,59,0.08)]">
            <div className="eleve-skeleton h-4 w-28 rounded-full" />
            <div className="mt-4 eleve-skeleton h-14 w-full rounded-2xl" />
            <div className="mt-4 eleve-skeleton h-14 w-full rounded-2xl" />
            <div className="mt-3 eleve-skeleton h-18 w-full rounded-2xl" />
          </div>

          <div className="rounded-[24px] border border-[#d7b7a0]/35 bg-white p-4 shadow-[0_10px_22px_rgba(10,25,59,0.08)]">
            <div className="eleve-skeleton h-4 w-22 rounded-full" />
            <div className="mt-4 eleve-skeleton h-28 w-full rounded-2xl" />
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d7b7a0]/45 bg-white/92 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_28px_rgba(10,25,59,0.1)] backdrop-blur sm:hidden">
        <div className="eleve-skeleton h-14 w-full rounded-[20px]" />
      </div>
    </main>
  );
}
