import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Utensils,
  XCircle,
  Phone,
  Hash,
  CreditCard,
  Banknote,
} from "lucide-react";

const STATUS_CONFIG = {
  received: {
    label: "Received",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Clock,
  },
  accepted: {
    label: "Accepted",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: CheckCircle2,
  },
  preparing: {
    label: "Preparing",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    icon: ChefHat,
  },
  ready: {
    label: "Ready",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Utensils,
  },
  served: {
    label: "Served",
    color: "bg-gray-50 text-gray-600 border-gray-200",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
} as const;

const STATUS_FLOW: Record<string, string[]> = {
  received: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
};

export function OrderManager({
  restaurantId,
}: {
  restaurantId: Id<"restaurants">;
}) {
  const orders = useQuery(api.orders.getByRestaurant, { restaurantId });
  const updateStatus = useMutation(api.orders.updateStatus);
  const updatePayment = useMutation(api.orders.updatePayment);

  if (!orders) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading orders...
      </div>
    );
  }

  const activeOrders = orders.filter(
    (o) => o.status !== "served" && o.status !== "cancelled",
  );
  const completedOrders = orders.filter(
    (o) => o.status === "served" || o.status === "cancelled",
  );

  const handleAdvance = (orderId: Id<"orders">, currentStatus: string) => {
    const next = STATUS_FLOW[currentStatus]?.[0];
    if (next) {
      updateStatus({ id: orderId, status: next as any });
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderOrder = (order: (typeof orders)[0], showActions: boolean) => {
    const config = STATUS_CONFIG[order.status];
    const StatusIcon = config.icon;
    const nextStatuses = STATUS_FLOW[order.status] ?? [];

    return (
      <Card key={order._id} className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold text-sm">
                    Token #{order.tokenNumber ?? "—"}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${config.color}`}
                >
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatTime(order.createdAt)}
                {order.customerName && ` · ${order.customerName}`}
              </p>
              {order.customerPhone && (
                <div className="flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {order.customerPhone}
                  </a>
                </div>
              )}
            </div>
            <span className="text-sm font-bold tabular-nums">
              ${order.totalAmount.toFixed(2)}
            </span>
          </div>

          {/* Payment Status */}
          {order.paymentStatus && (
            <div className="flex items-center gap-1.5 mb-3 p-2 rounded-lg bg-muted/50">
              <CreditCard className="h-3 w-3 text-muted-foreground" />
              <span
                className={`text-[11px] font-medium ${order.paymentStatus === "paid" ? "text-emerald-600" : order.paymentStatus === "refunded" ? "text-amber-600" : "text-muted-foreground"}`}
              >
                {order.paymentStatus === "paid"
                  ? `Paid${order.paymentMethod ? ` via ${order.paymentMethod}` : ""}`
                  : order.paymentStatus === "refunded"
                    ? "Refunded"
                    : "Unpaid"}
              </span>
              {showActions && order.paymentStatus === "unpaid" && (
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-6 px-2 text-[10px] text-emerald-600"
                    onClick={() =>
                      updatePayment({
                        id: order._id,
                        paymentStatus: "paid",
                        paymentMethod: "cash",
                      })
                    }
                  >
                    <Banknote className="mr-1 h-3 w-3" />
                    Cash
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-6 px-2 text-[10px] text-emerald-600"
                    onClick={() =>
                      updatePayment({
                        id: order._id,
                        paymentStatus: "paid",
                        paymentMethod: "upi",
                      })
                    }
                  >
                    UPI
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-6 px-2 text-[10px] text-emerald-600"
                    onClick={() =>
                      updatePayment({
                        id: order._id,
                        paymentStatus: "paid",
                        paymentMethod: "card",
                      })
                    }
                  >
                    Card
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5 mb-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {item.quantity}× {item.name}
                  {item.note && (
                    <span className="italic ml-1 text-muted-foreground/70">
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

          {showActions && nextStatuses.length > 0 && (
            <div className="flex gap-1.5 pt-2 border-t">
              {nextStatuses.map((status) => (
                <Button
                  key={status}
                  variant={status === "cancelled" ? "destructive" : "default"}
                  size="sm"
                  className="cursor-pointer flex-1 text-[11px] h-8"
                  onClick={() => handleAdvance(order._id, order.status)}
                >
                  {status === "cancelled"
                    ? "Cancel"
                    : STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
                        ?.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Orders</h2>
        <p className="text-sm text-muted-foreground">
          {activeOrders.length} active order
          {activeOrders.length !== 1 ? "s" : ""}
        </p>
      </div>

      {activeOrders.length === 0 && completedOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No orders yet. Orders will appear here when customers place them.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeOrders.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeOrders.map((order) => renderOrder(order, true))}
            </div>
          )}

          {completedOrders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Completed
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {completedOrders.slice(0, 10).map((order) =>
                  renderOrder(order, false),
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
