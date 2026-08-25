import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  QrCode,
  Clock,
  CheckCircle2,
  ChefHat,
  Utensils,
  ArrowLeft,
  XCircle,
} from "lucide-react";

const STATUS_STEPS = [
  { key: "received", label: "Received", icon: Clock },
  { key: "accepted", label: "Accepted", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: Utensils },
  { key: "served", label: "Served", icon: CheckCircle2 },
] as const;

const STATUS_ORDER = ["received", "accepted", "preparing", "ready", "served", "cancelled"];

export default function OrderStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useQuery(
    api.orders.getById,
    orderId ? { id: orderId as Id<"orders"> } : "skip",
  );

  if (!orderId || order === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <QrCode className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Order Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This order could not be found. Please check your order number.
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_ORDER.indexOf(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <h1 className="text-sm font-semibold">Order Status</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Order Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">{order.tableLabel}</span>
              <span className="text-sm font-bold tabular-nums">
                ${order.totalAmount.toFixed(2)}
              </span>
            </div>
            {order.customerName && (
              <p className="text-xs text-muted-foreground">
                {order.customerName}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(order.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </CardContent>
        </Card>

        {/* Status Progress */}
        {isCancelled ? (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600 shrink-0" />
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
            {STATUS_STEPS.map((step, i) => {
              const stepIndex = STATUS_ORDER.indexOf(step.key);
              const isCompleted = stepIndex <= currentStepIndex;
              const isCurrent = step.key === order.status;
              const StepIcon = step.icon;

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    isCurrent
                      ? "border-foreground bg-card shadow-sm"
                      : isCompleted
                        ? "border-border/50 bg-muted/30"
                        : "border-border/30 bg-transparent opacity-50"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isCompleted
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <StepIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        isCurrent ? "text-foreground" : isCompleted ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      Current
                    </span>
                  )}
                  {isCompleted && !isCurrent && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Ordered Items */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Items Ordered</h3>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.quantity}× {item.name}
                    {item.note && (
                      <span className="italic text-muted-foreground/70 ml-1">
                        — {item.note}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums font-medium">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">${order.totalAmount.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
