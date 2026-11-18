import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { REPORT_CATALOGUE, type ReportGroup } from "../../convex/reportCatalogue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileBarChart, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

const RANGES = [
  { id: "today", label: "Today", days: 0 },
  { id: "7d", label: "7 days", days: 6 },
  { id: "30d", label: "30 days", days: 29 },
  { id: "90d", label: "90 days", days: 89 },
] as const;

const GROUP_ORDER: ReportGroup[] = ["Sales", "Menu", "Stock", "Customers", "Floor", "Delivery"];

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function ReportsCenter({ restaurantId }: { restaurantId: Id<"restaurants"> }) {
  const [reportKey, setReportKey] = useState("sales_daily");
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("7d");

  const rangeConfig = RANGES.find((entry) => entry.id === range) ?? RANGES[1];
  const { from, to } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - rangeConfig.days);
    return { from: start.getTime(), to: end.getTime() };
  }, [rangeConfig.days]);

  const result = useQuery(api.reports.get, { restaurantId, report: reportKey, from, to });
  const meta = REPORT_CATALOGUE.find((entry) => entry.key === reportKey);

  const downloadCsv = () => {
    if (!result) return;
    const lines = [result.columns.map(csvCell).join(",")];
    for (const row of result.rows) lines.push(row.map(csvCell).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.key}-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const printReport = () => {
    if (!result) return;
    const escape = (value: string | number) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<!doctype html><html><head><title>${escape(result.title)}</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;color:#111827}
        h1{font-size:20px;margin:0 0 4px}
        p{color:#6b7280;font-size:12px;margin:0 0 16px}
        table{border-collapse:collapse;width:100%;font-size:12px}
        th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left}
        th{background:#f3f7f4;font-weight:600}
      </style></head><body>
      <h1>${escape(result.title)}</h1>
      <p>${escape(result.description)} · ${new Date(from).toLocaleDateString()} → ${new Date(to).toLocaleDateString()}</p>
      <table><thead><tr>${result.columns.map((column) => `<th>${escape(column)}</th>`).join("")}</tr></thead>
      <tbody>${result.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>
      </body></html>`;
    const frame = window.open("", "_blank", "width=900,height=700");
    if (!frame) {
      toast.error("Allow pop-ups to print this report");
      return;
    }
    frame.document.write(html);
    frame.document.close();
    frame.focus();
    frame.print();
  };

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    reports: REPORT_CATALOGUE.filter((entry) => entry.group === group),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit border-green-100 bg-white">
        <CardContent className="p-2">
          {grouped.map(({ group, reports }) => (
            <div key={group} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {group}
              </p>
              {reports.map((entry) => (
                <button
                  key={entry.key}
                  className={`w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                    reportKey === entry.key
                      ? "bg-green-50 font-semibold text-[#3D7A5F]"
                      : "text-gray-600 hover:bg-green-50/60 hover:text-[#4A8C6F]"
                  }`}
                  onClick={() => setReportKey(entry.key)}
                >
                  {entry.title}
                </button>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-green-100 bg-white">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-green-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <FileBarChart className="h-4 w-4 text-[#4A8C6F]" />
                {meta?.title ?? "Report"}
              </h3>
              <p className="mt-0.5 max-w-xl text-[11px] text-gray-500">{meta?.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {RANGES.map((entry) => (
                <button
                  key={entry.id}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    range === entry.id
                      ? "bg-[#4A8C6F] text-white"
                      : "text-gray-500 hover:bg-green-50 hover:text-[#4A8C6F]"
                  }`}
                  onClick={() => setRange(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="ml-1 h-7 cursor-pointer border-green-200 text-[11px] text-[#4A8C6F] hover:bg-green-50"
                onClick={printReport}
                disabled={!result || result.rows.length === 0}
              >
                <Printer className="mr-1 h-3 w-3" /> Print
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer border-green-200 text-[11px] text-[#4A8C6F] hover:bg-green-50"
                onClick={downloadCsv}
                disabled={!result || result.rows.length === 0}
              >
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            </div>
          </div>

          {!result ? (
            <div className="flex items-center justify-center py-20 text-sm text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building report…
            </div>
          ) : (
            <>
              {result.summary.length > 0 && (
                <div className="flex flex-wrap gap-2 border-b border-green-50 px-5 py-3">
                  {result.summary.map((entry) => (
                    <div key={entry.label} className="rounded-lg bg-green-50/70 px-3 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-[#5B9A7C]">
                        {entry.label}
                      </p>
                      <p className="text-sm font-bold text-gray-900">{entry.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {result.rows.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <FileBarChart className="mx-auto mb-2 h-7 w-7 text-green-300" />
                  <p className="text-sm text-gray-500">No data for this period yet.</p>
                </div>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-green-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                        {result.columns.map((column) => (
                          <th key={column} className="whitespace-nowrap px-4 py-2 font-medium">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-50">
                      {result.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-green-50/40">
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className={`whitespace-nowrap px-4 py-2 ${
                                cellIndex === 0 ? "font-medium text-gray-800" : "text-gray-600"
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.note && (
                <p className="border-t border-green-50 px-5 py-2 text-[11px] text-gray-400">
                  {result.note}
                </p>
              )}
            </>
          )}

          <div className="flex items-center justify-between border-t border-green-50 px-5 py-2">
            <Badge variant="outline" className="border-green-200 bg-green-50 text-[10px] text-[#4A8C6F]">
              {result?.rows.length ?? 0} row(s)
            </Badge>
            <span className="text-[10px] text-gray-400">
              {new Date(from).toLocaleDateString()} → {new Date(to).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
