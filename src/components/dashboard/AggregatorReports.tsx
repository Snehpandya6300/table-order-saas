import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Wallet, Percent, ReceiptText } from "lucide-react";

function money(value: number) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof TrendingUp;
  tone: string;
}) {
  return (
    <Card className="border-green-100 bg-white p-4">
      <div className={`mb-1 flex items-center gap-2 ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>}
    </Card>
  );
}

export function AggregatorReports({
  restaurantId,
}: {
  restaurantId: Id<"restaurants">;
}) {
  const [days, setDays] = useState(30);
  const report = useQuery(api.aggregators.report, { restaurantId, days });

  if (report === undefined) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Building report…
      </div>
    );
  }

  const combinedOrders = report.direct.orders + report.aggregator.orders;
  const combinedGross = report.direct.gross + report.aggregator.gross;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            Sales &amp; reconciliation
          </h3>
          <p className="text-xs text-gray-500">
            Direct versus aggregator sales, commissions and net settlement.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-green-100 bg-white p-1">
          {[7, 30, 90].map((option) => (
            <button
              key={option}
              onClick={() => setDays(option)}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                days === option
                  ? "bg-[#4A8C6F] text-white"
                  : "text-gray-500 hover:text-[#4A8C6F]"
              }`}
            >
              {option}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total sales"
          value={money(combinedGross)}
          hint={`${combinedOrders} order${combinedOrders === 1 ? "" : "s"}`}
          icon={TrendingUp}
          tone="text-[#4A8C6F]"
        />
        <MetricCard
          label="Direct (QR / POS)"
          value={money(report.direct.gross)}
          hint={`${report.direct.orders} orders · AOV ${money(report.direct.aov)}`}
          icon={ReceiptText}
          tone="text-[#5B9A7C]"
        />
        <MetricCard
          label="Aggregator gross"
          value={money(report.aggregator.gross)}
          hint={`${report.aggregator.orders} orders · net ${money(report.aggregator.net)}`}
          icon={Wallet}
          tone="text-amber-600"
        />
        <MetricCard
          label="Commission"
          value={money(report.aggregator.commission)}
          hint={`Cancel rate ${report.aggregator.cancellationRate}%`}
          icon={Percent}
          tone="text-red-500"
        />
      </div>

      {report.platforms.length === 0 ? (
        <Card className="border-dashed border-green-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            No aggregator orders in the last {days} days.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-green-100 bg-white">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead className="bg-green-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Platform</th>
                <th className="px-3 py-2 text-right font-semibold">Orders</th>
                <th className="px-3 py-2 text-right font-semibold">Gross</th>
                <th className="px-3 py-2 text-right font-semibold">Commission</th>
                <th className="px-3 py-2 text-right font-semibold">Net</th>
                <th className="px-3 py-2 text-right font-semibold">AOV</th>
                <th className="px-3 py-2 text-right font-semibold">Cancelled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50">
              {report.platforms.map((row) => (
                <tr key={row.platform} className="text-gray-700">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="font-medium">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.orders}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(row.gross)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">
                    {money(row.commission)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700">
                    {money(row.net)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(row.aov)}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        row.cancelled > 0
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      {row.cancelled} ({row.cancellationRate}%)
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-green-100 bg-white p-3">
          <p className="text-[11px] text-gray-500">Aggregator refunds</p>
          <p className="text-sm font-semibold text-gray-800">
            {report.aggregator.refunded} order(s)
          </p>
        </div>
        <div className="rounded-lg border border-green-100 bg-white p-3">
          <p className="text-[11px] text-gray-500">Rejected orders</p>
          <p className="text-sm font-semibold text-gray-800">
            {report.aggregator.rejected}
          </p>
        </div>
        <div className="rounded-lg border border-green-100 bg-white p-3">
          <p className="text-[11px] text-gray-500">Aggregator share of sales</p>
          <p className="text-sm font-semibold text-gray-800">
            {combinedGross > 0
              ? `${Math.round((report.aggregator.gross / combinedGross) * 100)}%`
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
