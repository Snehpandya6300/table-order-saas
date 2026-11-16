import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { ALL_STATIONS, DEFAULT_STATION, getPlatformDefinition } from "../../convex/aggregatorAdapters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChefHat, Clock, Loader2, Truck, Utensils } from "lucide-react";
import { toast } from "sonner";

type OrderRow = Doc<"orders">;

const NEXT_STATUS: Record<string, { status: "accepted" | "preparing" | "ready" | "served"; label: string }> = {
  received: { status: "accepted", label: "Accept" },
  accepted: { status: "preparing", label: "Start cooking" },
  preparing: { status: "ready", label: "Mark ready" },
  ready: { status: "served", label: "Hand over" },
};

function minutesAgo(timestamp: number) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

export function KitchenDisplay({
  restaurantId,
}: {
  restaurantId: Id<"restaurants">;
}) {
  const orders = useQuery(api.orders.getByRestaurant, { restaurantId });
  const updateStatus = useMutation(api.orders.updateStatus);
  const pushOrderStatus = useAction(api.aggregators.pushOrderStatus);
  const [busy, setBusy] = useState<string | null>(null);

  const activeOrders = useMemo(
    () =>
      (orders ?? []).filter(
        (order) =>
          order.status === "received" ||
          order.status === "accepted" ||
          order.status === "preparing" ||
          order.status === "ready",
      ),
    [orders],
  );

  const stations = useMemo(() => {
    const present = new Set<string>();
    for (const order of activeOrders) {
      for (const station of order.stations ?? [DEFAULT_STATION]) present.add(station);
    }
    const ordered = ALL_STATIONS.filter((station) => present.has(station));
    const extras = Array.from(present).filter(
      (station) => !ALL_STATIONS.includes(station),
    );
    return [...ordered, ...extras];
  }, [activeOrders]);

  const ordersForStation = (station: string) =>
    activeOrders.filter((order) =>
      (order.stations ?? [DEFAULT_STATION]).includes(station),
    );

  const advance = async (order: OrderRow) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setBusy(order._id);
    try {
      await updateStatus({ id: order._id, status: next.status });
      if (order.integrationId) {
        try {
          await pushOrderStatus({ orderId: order._id });
        } catch (error) {
          console.warn("Aggregator status sync failed", error);
        }
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (orders === undefined) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading kitchen queue…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Kitchen display</h2>
        <p className="text-sm text-muted-foreground">
          Live tickets by station — QR and aggregator orders are routed automatically.
        </p>
      </div>

      {activeOrders.length === 0 ? (
        <Card className="border-dashed border-green-200 bg-white">
          <CardContent className="py-12 text-center">
            <ChefHat className="mx-auto mb-3 h-8 w-8 text-green-200" />
            <p className="text-sm text-muted-foreground">
              Kitchen is clear. New orders show up here instantly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {stations.map((station) => {
            const stationOrders = ordersForStation(station);
            return (
              <div key={station} className="min-w-[260px] flex-1 space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-[#4A8C6F] px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white">
                    {station}
                  </span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                    {stationOrders.length}
                  </span>
                </div>

                {stationOrders.map((order) => {
                  const platform = order.externalPlatform
                    ? getPlatformDefinition(order.externalPlatform)
                    : null;
                  const next = NEXT_STATUS[order.status];

                  return (
                    <Card key={order._id} className="border-green-100 bg-white">
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {order.tableLabel ??
                                `#${order._id.slice(-5).toUpperCase()}`}
                            </p>
                            <p className="flex items-center gap-1 text-[10px] text-gray-500">
                              <Clock className="h-2.5 w-2.5" />
                              {minutesAgo(order.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {platform ? (
                              <Badge
                                variant="outline"
                                className="border-transparent text-[9px] font-semibold text-white"
                                style={{ backgroundColor: platform.brandColor }}
                              >
                                {platform.name}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-green-200 bg-green-50 text-[9px] text-[#4A8C6F]"
                              >
                                QR
                              </Badge>
                            )}
                            {order.channel === "delivery" && (
                              <span className="flex items-center gap-1 text-[9px] text-blue-600">
                                <Truck className="h-2.5 w-2.5" /> Delivery
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div key={index} className="text-xs text-gray-800">
                              <span className="font-semibold">{item.quantity}×</span>{" "}
                              {item.name}
                              {item.note && (
                                <p className="pl-4 text-[10px] italic text-amber-700">
                                  {item.note}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t pt-2">
                          <Badge
                            variant="outline"
                            className="border-gray-200 bg-gray-50 text-[9px] capitalize text-gray-600"
                          >
                            {order.status}
                          </Badge>
                          {next && (
                            <Button
                              size="sm"
                              className="h-7 cursor-pointer bg-[#4A8C6F] px-2 text-[10px] text-white hover:bg-[#3D7A5F]"
                              onClick={() => advance(order)}
                              disabled={busy === order._id}
                            >
                              {busy === order._id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : next.status === "served" ? (
                                <Utensils className="mr-1 h-3 w-3" />
                              ) : (
                                <ChefHat className="mr-1 h-3 w-3" />
                              )}
                              {next.label}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
