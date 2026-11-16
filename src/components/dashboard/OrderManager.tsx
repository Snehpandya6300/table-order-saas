import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { getPlatformDefinition } from "../../convex/aggregatorAdapters";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  Truck,
  Store,
  MapPin,
  Loader2,
  Receipt,
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

const SOURCE_FILTERS = [
  { id: "all", label: "All orders" },
  { id: "zomato", label: "Zomato" },
  { id: "swiggy", label: "Swiggy" },
  { id: "urbanpiper", label: "UrbanPiper" },
  { id: "petpooja", label: "Petpooja" },
  { id: "qr", label: "Direct QR" },
  { id: "pos", label: "POS" },
  { id: "delivery", label: "Delivery" },
] as const;

const STATUS_FILTERS = [
  { id: "all", label: "All statuses" },
  { id: "pending", label: "Pending" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

type OrderRow = Doc<"orders">;

type SourceFilter = (typeof SOURCE_FILTERS)[number]["id"];
type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

function money(value: number) {
  return `₹${value.toFixed(2)}`;
}

export function OrderManager({
  restaurantId,
}: {
  restaurantId: Id<"restaurants">;
}) {
  const orders = useQuery(api.orders.getByRestaurant, { restaurantId });
  const updateStatus = useMutation(api.orders.updateStatus);
  const updatePayment = useMutation(api.orders.updatePayment);
  const pushOrderStatus = useAction(api.aggregators.pushOrderStatus);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rejectTarget, setRejectTarget] = useState<OrderRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      const source = order.source ?? "qr";
      const matchesSource =
        sourceFilter === "all"
          ? true
          : sourceFilter === "delivery"
            ? order.channel === "delivery"
            : sourceFilter === "qr" || sourceFilter === "pos"
              ? source === sourceFilter
              : order.externalPlatform === sourceFilter;

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "pending"
            ? order.status === "received" || order.status === "accepted"
            : statusFilter === "preparing"
              ? order.status === "preparing"
              : statusFilter === "ready"
                ? order.status === "ready"
                : statusFilter === "completed"
                  ? order.status === "served"
                  : order.status === "cancelled";

      return matchesSource && matchesStatus;
    });
  }, [orders, sourceFilter, statusFilter]);

  if (!orders) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading orders...
      </div>
    );
  }

  const activeOrders = filtered.filter(
    (order) => order.status !== "served" && order.status !== "cancelled",
  );
  const completedOrders = filtered.filter(
    (order) => order.status === "served" || order.status === "cancelled",
  );

  const syncWithPlatform = async (orderId: Id<"orders">, isAggregator: boolean) => {
    if (!isAggregator) return;
    try {
      await pushOrderStatus({ orderId });
    } catch (error) {
      console.warn("Status sync failed", error);
    }
  };

  const handleAdvance = async (order: OrderRow, nextStatus: string) => {
    if (nextStatus === "cancelled") {
      setRejectReason("");
      setRejectTarget(order);
      return;
    }
    setBusyOrderId(order._id);
    try {
      await updateStatus({
        id: order._id,
        status: nextStatus as "accepted" | "preparing" | "ready" | "served",
      });
      await syncWithPlatform(order._id, Boolean(order.integrationId));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    setBusyOrderId(rejectTarget._id);
    try {
      await updateStatus({
        id: rejectTarget._id,
        status: "cancelled",
        rejectionReason: rejectReason.trim() || undefined,
      });
      await syncWithPlatform(rejectTarget._id, Boolean(rejectTarget.integrationId));
      toast("Order rejected");
      setRejectTarget(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyOrderId(null);
    }
  };

  const handlePayment = async (order: OrderRow, method: "cash" | "upi" | "card") => {
    try {
      await updatePayment({
        id: order._id,
        paymentStatus: "paid",
        paymentMethod: method,
      });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderOrder = (order: OrderRow, showActions: boolean) => {
    const config = STATUS_CONFIG[order.status];
    const StatusIcon = config.icon;
    const nextStatuses = STATUS_FLOW[order.status] ?? [];
    const isAggregator = order.source === "aggregator" || Boolean(order.integrationId);
    const platform = order.externalPlatform
      ? getPlatformDefinition(order.externalPlatform)
      : null;

    return (
      <Card key={order._id} className="overflow-hidden border-green-100 bg-white">
        <CardContent className="p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-semibold">
                    {order.tableLabel ?? `#${order._id.slice(-6).toUpperCase()}`}
                  </span>
                </div>
                {platform ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-transparent text-[10px] font-semibold text-white"
                    style={{ backgroundColor: platform.brandColor }}
                  >
                    {platform.name}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-green-200 bg-green-50 text-[10px] text-[#4A8C6F]"
                  >
                    QR order
                  </Badge>
                )}
                {order.channel === "delivery" ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-blue-200 bg-blue-50 text-[10px] text-blue-700"
                  >
                    <Truck className="h-2.5 w-2.5" /> Delivery
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 border-gray-200 bg-gray-50 text-[10px] text-gray-600"
                  >
                    <Store className="h-2.5 w-2.5" /> {isAggregator ? "Takeaway" : "Dine-in"}
                  </Badge>
                )}
                <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {config.label}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTime(order.createdAt)}
                {order.externalOrderId && ` · ${order.externalOrderId}`}
                {order.customerName && ` · ${order.customerName}`}
              </p>
              {order.customerPhone && (
                <div className="mt-1 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {order.customerPhone}
                  </a>
                </div>
              )}
              {order.customerAddress && (
                <div className="mt-1 flex items-start gap-1">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {order.customerAddress}
                  </span>
                </div>
              )}
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {money(order.totalAmount)}
            </span>
          </div>

          {/* Payment + delivery status */}
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2">
            <CreditCard className="h-3 w-3 text-muted-foreground" />
            <span
              className={`text-[11px] font-medium ${
                order.paymentStatus === "paid"
                  ? "text-emerald-600"
                  : order.paymentStatus === "refunded"
                    ? "text-amber-600"
                    : "text-muted-foreground"
              }`}
            >
              {order.isPlatformPaid
                ? `Paid on ${platform?.name ?? "platform"}`
                : order.paymentStatus === "paid"
                  ? `Paid${order.paymentMethod ? ` via ${order.paymentMethod}` : ""}`
                  : order.paymentStatus === "refunded"
                    ? "Refunded via platform"
                    : "Collect on delivery"}
            </span>
            {order.deliveryStatus && (
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-[10px] capitalize text-blue-700"
              >
                {order.deliveryStatus.replace("_", " ")}
              </Badge>
            )}
            {showActions && order.paymentStatus === "unpaid" && !order.isPlatformPaid && (
              <div className="ml-auto flex gap-1">
                {(["cash", "upi", "card"] as const).map((method) => (
                  <Button
                    key={method}
                    variant="ghost"
                    size="sm"
                    className="h-6 cursor-pointer px-2 text-[10px] capitalize text-emerald-600"
                    onClick={() => handlePayment(order, method)}
                  >
                    <Banknote className="mr-1 h-3 w-3" />
                    {method}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3 space-y-1.5">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {item.quantity}× {item.name}
                  {item.note && (
                    <span className="ml-1 italic text-muted-foreground/70">
                      — {item.note}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {money(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {order.stations && order.stations.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {order.stations.map((station) => (
                <Badge
                  key={station}
                  variant="outline"
                  className="gap-1 border-orange-200 bg-orange-50 text-[10px] text-orange-700"
                >
                  <ChefHat className="h-2.5 w-2.5" /> {station}
                </Badge>
              ))}
            </div>
          )}

          {isAggregator &&
            (order.subtotal !== undefined ||
              order.commission !== undefined ||
              order.netSettlement !== undefined) && (
              <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-green-100 bg-green-50/40 p-2 text-[11px] text-gray-600">
                {order.subtotal !== undefined && (
                  <span>Subtotal {money(order.subtotal)}</span>
                )}
                {order.taxAmount !== undefined && (
                  <span>Tax {money(order.taxAmount)}</span>
                )}
                {order.deliveryFee !== undefined && (
                  <span>Delivery {money(order.deliveryFee)}</span>
                )}
                {order.commission !== undefined && (
                  <span className="text-red-600">
                    Commission {money(order.commission)}
                  </span>
                )}
                {order.netSettlement !== undefined && (
                  <span className="font-medium text-emerald-700">
                    Net {money(order.netSettlement)}
                  </span>
                )}
              </div>
            )}

          {order.rejectionReason && (
            <p className="mb-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
              Rejected: {order.rejectionReason}
            </p>
          )}

          {showActions && nextStatuses.length > 0 && (
            <div className="flex gap-1.5 border-t pt-2">
              {nextStatuses.map((status) => (
                <Button
                  key={status}
                  variant={status === "cancelled" ? "destructive" : "default"}
                  size="sm"
                  className={`h-8 flex-1 cursor-pointer text-[11px] ${
                    status === "cancelled"
                      ? ""
                      : "bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                  }`}
                  disabled={busyOrderId === order._id}
                  onClick={() => handleAdvance(order, status)}
                >
                  {busyOrderId === order._id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  {status === "cancelled"
                    ? "Reject"
                    : STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Orders</h2>
          <p className="text-sm text-muted-foreground">
            {activeOrders.length} active · {orders.length} total across QR, POS and
            aggregators
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SOURCE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSourceFilter(filter.id)}
              className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                sourceFilter === filter.id
                  ? "border-[#4A8C6F] bg-[#4A8C6F] text-white"
                  : "border-green-200 bg-white text-gray-600 hover:border-[#4A8C6F] hover:text-[#4A8C6F]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`shrink-0 cursor-pointer rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === filter.id
                  ? "border-gray-800 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-green-100 bg-white">
          <CardContent className="py-12 text-center">
            <Receipt className="mx-auto mb-3 h-8 w-8 text-green-200" />
            <p className="text-sm text-muted-foreground">
              No orders match this filter. Orders appear here the moment a customer
              scans a QR or an aggregator sends a webhook.
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
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Completed &amp; cancelled
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {completedOrders.slice(0, 12).map((order) => renderOrder(order, false))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              The reason is stored on the order and sent back to{" "}
              {rejectTarget?.externalPlatform
                ? getPlatformDefinition(rejectTarget.externalPlatform).name
                : "the customer"}
              .
            </p>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              placeholder="Out of stock, kitchen closed, delivery area…"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setRejectTarget(null)}
            >
              Keep order
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={handleConfirmReject}
              disabled={busyOrderId !== null}
            >
              Reject order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
