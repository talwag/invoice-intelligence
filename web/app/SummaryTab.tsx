import {
  getMonthlyTotals,
  getCumulativeTotal,
  getCompanyBreakdown,
  formatMonthLabel,
  formatILS,
  type Document,
} from "@/lib/dashboardAggregations";

export default function SummaryTab({ documents }: { documents: Document[] }) {
  const monthlyTotals = getMonthlyTotals(documents);
  const cumulativeTotal = getCumulativeTotal(documents);
  const companyBreakdown = getCompanyBreakdown(documents);
  const maxCompanyTotal = companyBreakdown[0]?.total ?? 0;

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Cumulative Total
          </div>
          <div className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatILS(cumulativeTotal)}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Documents Processed
          </div>
          <div className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {documents.filter((d) => d.status === "done").length}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Monthly Summary</h3>
        {monthlyTotals.length === 0 ? (
          <p className="text-sm text-zinc-400">No data yet</p>
        ) : (
          <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {monthlyTotals.map((row) => (
              <div key={row.month} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{formatMonthLabel(row.month)}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatILS(row.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Breakdown by Company</h3>
        {companyBreakdown.length === 0 ? (
          <p className="text-sm text-zinc-400">No data yet</p>
        ) : (
          <div className="space-y-2">
            {companyBreakdown.map((row) => (
              <div key={row.company} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-zinc-600 dark:text-zinc-400">{row.company}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(row.total / maxCompanyTotal) * 100}%` }}
                  />
                </div>
                <span className="w-24 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatILS(row.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
