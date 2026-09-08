import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
  QrCode,
  CheckCircle2,
  ChefHat,
  Utensils,
  XCircle,
  Phone,
  Clock,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_STEPS = [
  { key: "received", label: "Received", icon: Clock },
  { key: "accepted", label: "Accepted", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: Utensils },
  { key: "served", label: "Served", icon: CheckCircle2 },
] as const;

const STATUS_ORDER = [
  "received",
  "accepted",
  "preparing",
  "ready",
  "served",
  "cancelled",
];

export default function OrderStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useQuery(
    api.orders.getById,
    orderId ? { id: orderId as Id<"orders"> } : "skip",
  );

  if (!orderId || order === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#EEF5F0" }}>
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: "#EEF5F0" }}>
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
            <QrCode className="h-8 w-8 text-green-300" />
          </div>
          <h1 className="text-xl font-semibold mb-2 text-gray-900">Order Not Found</h1>
          <p className="text-sm text-gray-500">
            This order could not be found. Please check your order number.
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_ORDER.indexOf(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#EEF5F0" }}>
      <header className="sticky top-0 z-40 border-b border-green-200/50 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <h1 className="text-sm font-semibold text-gray-900">Order Status</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <Card className="border-green-100 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-900">{order.tableLabel}</span>
              <span className="text-sm font-bold tabular-nums text-[#4A8C6F]">
                ${order.totalAmount.toFixed(2)}
              </span>
            </div>
            {order.customerName && (
              <p className="text-xs text-gray-500">
                {order.customerName}
              </p>
            )}
            {order.customerPhone && (
              <div className="flex items-center gap-1 mt-1">
                <Phone className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">
                  {order.customerPhone}
                </span>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(order.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </CardContent>
        </Card>

        {isCancelled ? (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <X className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  Order Cancelled
                </p>
                <p className="text-xs text-red-600/70">
                  This order has been cancelled.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {STATUS_STEPS.map((step) => {
              const stepIndex = STATUS_ORDER.indexOf(step.key);
              const isCompleted = stepIndex <= currentStepIndex;
              const isCurrent = step.key === order.status;
              const StepIcon = step.icon;

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    isCurrent
                      ? "border-green-200 bg-green-50 shadow-sm"
                      : isCompleted
                        ? "border-green-100 bg-green-50/30"
                        : "border-gray-100 bg-white opacity-50"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isCurrent
                        ? "bg-[#4A8C6F] text-white"
                        : isCompleted
                          ? "bg-green-100 text-[#4A8C6F]"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <StepIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        isCurrent || isCompleted
                          ? "text-gray-900"
                          : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-medium text-[#4A8C6F] bg-green-100 rounded-full px-2 py-0.5">
                      Current
                    </span>
                  )}
                  {isCompleted && !isCurrent && (
                    <CheckCircle2 className="h-4 w-4 text-[#4A8C6F] shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Card className="border-green-100 bg-white shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-900">Items Ordered</h3>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    {item.quantity}× {item.name}
                    {item.note && (
                      <span className="italic text-gray-400 ml-1">
                        — {item.note}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums font-medium text-gray-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-green-100 flex justify-between text-sm font-semibold">
              <span className="text-gray-900">Total</span>
              <span className="tabular-nums text-[#4A8C6F]">
                ${order.totalAmount.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
