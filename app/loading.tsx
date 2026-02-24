export default function GlobalLoading() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--line-soft)] bg-white/60 p-5 sm:p-8">
        <div className="h-3 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 h-10 w-2/3 animate-pulse rounded bg-zinc-200" />
        <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-zinc-100" />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="rounded-2xl border border-[var(--line-soft)] bg-white/55 p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="mt-3 h-7 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="mt-3 h-4 w-full animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </section>
    </div>
  );
}

