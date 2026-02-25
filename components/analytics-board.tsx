type AnalyticsPoint = { pv: number; uv?: number };
type TopPageItem = { path: string; pv: number };
type SourceItem = { source: string; pv: number };
type DeviceItem = { device: string; pv: number };
type CategoryItem = { name: string; pv: number };

export type AnalyticsSummary = {
  today: AnalyticsPoint;
  sevenDays: AnalyticsPoint;
  topPages: TopPageItem[];
  sources: SourceItem[];
  devices: DeviceItem[];
  categories: CategoryItem[];
};

function StatBar({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) {
  const safeMax = Math.max(1, max);
  const percent = Math.max(6, Math.round((value / safeMax) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-600">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-medium text-zinc-700">
          {value}
          {sub ? ` · ${sub}` : ''}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200/70">
        <div className="h-2 rounded-full bg-gradient-to-r from-zinc-700 to-zinc-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function AnalyticsBoard({ summary }: { summary: AnalyticsSummary }) {
  const topPages = (summary.topPages || []).slice(0, 5);
  const sources = (summary.sources || []).slice(0, 5);
  const devices = (summary.devices || []).slice(0, 5);
  const categories = (summary.categories || []).slice(0, 5);

  const maxTop = Math.max(1, ...topPages.map((x) => x.pv));
  const maxSource = Math.max(1, ...sources.map((x) => x.pv));
  const maxDevice = Math.max(1, ...devices.map((x) => x.pv));
  const maxCategory = Math.max(1, ...categories.map((x) => x.pv));

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-800">访客统计看板</h2>
        <span className="text-xs text-zinc-500">today / 7d</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--line-soft)] bg-white/70 p-3">
          <p className="text-xs text-zinc-500">今日 PV</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-800">{summary.today?.pv ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[var(--line-soft)] bg-white/70 p-3">
          <p className="text-xs text-zinc-500">今日 UV</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-800">{summary.today?.uv ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[var(--line-soft)] bg-white/70 p-3">
          <p className="text-xs text-zinc-500">近7天 PV</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-800">{summary.sevenDays?.pv ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[var(--line-soft)] bg-white/70 p-3">
          <p className="text-xs text-zinc-500">近7天 UV</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-800">{summary.sevenDays?.uv ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--line-soft)] bg-white/70 p-3 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700">Top 页面</h3>
          {topPages.length === 0 ? <p className="text-sm text-zinc-500">暂无数据</p> : topPages.map((x) => <StatBar key={x.path} label={x.path} value={x.pv} max={maxTop} />)}
        </div>

        <div className="rounded-xl border border-[var(--line-soft)] bg-white/70 p-3 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700">来源分布</h3>
          {sources.length === 0 ? <p className="text-sm text-zinc-500">暂无数据</p> : sources.map((x) => <StatBar key={x.source} label={x.source} value={x.pv} max={maxSource} />)}
        </div>

        <div className="rounded-xl border border-[var(--line-soft)] bg-white/70 p-3 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700">设备分布</h3>
          {devices.length === 0 ? <p className="text-sm text-zinc-500">暂无数据</p> : devices.map((x) => <StatBar key={x.device} label={x.device} value={x.pv} max={maxDevice} />)}
        </div>

        <div className="rounded-xl border border-[var(--line-soft)] bg-white/70 p-3 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700">分类热度</h3>
          {categories.length === 0 ? <p className="text-sm text-zinc-500">暂无数据</p> : categories.map((x) => <StatBar key={x.name} label={x.name} value={x.pv} max={maxCategory} />)}
        </div>
      </div>
    </section>
  );
}
