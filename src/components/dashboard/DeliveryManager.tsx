import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bike,
  CircleDot,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

const money = (value: number) => value.toFixed(2);

const DELIVERY_LABEL: Record<string, string> = {
  pending: "Awaiting rider",
  assigned: "Assigned",
  picked_up: "Picked up",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function DeliveryManager({ restaurantId }: { restaurantId: Id<"restaurants"> }) {
  const riders = useQuery(api.riders.list, { restaurantId }) ?? [];
  const board = useQuery(api.riders.dispatchBoard, { restaurantId });
  const menuItems = useQuery(api.menuItems.getByRestaurant, { restaurantId }) ?? [];

  const createRider = useMutation(api.riders.create);
  const updateRider = useMutation(api.riders.update);
  const resetPassword = useMutation(api.riders.resetPassword);
  const removeRider = useMutation(api.riders.remove);
  const assignRider = useMutation(api.riders.assignRider);
  const unassignRider = useMutation(api.riders.unassignRider);
  const createDeliveryOrder = useMutation(api.riders.createDeliveryOrder);

  const [riderDialog, setRiderDialog] = useState(false);
  const [riderForm, setRiderForm] = useState({
    name: "",
    phone: "",
    password: "",
    vehicle: "Bike",
  });
  const [resetting, setResetting] = useState<Id<"riders"> | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deliveryDialog, setDeliveryDialog] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    riderId: "",
    paymentMethod: "cash",
  });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const active = board?.active ?? [];
  const onlineRiders = riders.filter((rider) => rider.isOnline);
  const cartTotal = useMemo(
    () =>
      Object.entries(cart).reduce((sum, [id, quantity]) => {
        const item = menuItems.find((menuItem) => menuItem._id === id);
        return sum + (item?.price ?? 0) * quantity;
      }, 0),
    [cart, menuItems],
  );

  const handleCreateRider = async () => {
    if (!riderForm.name.trim() || !riderForm.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    if (riderForm.password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    setBusy("rider");
    try {
      await createRider({
        restaurantId,
        name: riderForm.name,
        phone: riderForm.phone,
        password: riderForm.password,
        vehicle: riderForm.vehicle || undefined,
      });
      toast.success("Rider added — they can now sign in from the rider app");
      setRiderDialog(false);
      setRiderForm({ name: "", phone: "", password: "", vehicle: "Bike" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the rider");
    } finally {
      setBusy(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetting) return;
    if (newPassword.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    setBusy("password");
    try {
      await resetPassword({ id: resetting, password: newPassword });
      toast.success("Password reset — the rider is signed out everywhere");
      setResetting(null);
      setNewPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset the password");
    } finally {
      setBusy(null);
    }
  };

  const handleCreateDelivery = async () => {
    if (!deliveryForm.customerAddress.trim()) {
      toast.error("Delivery address is required");
      return;
    }
    const items = Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemId, quantity]) => ({
        menuItemId: menuItemId as Id<"menuItems">,
        quantity,
      }));
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    setBusy("delivery");
    try {
      await createDeliveryOrder({
        restaurantId,
        customerName: deliveryForm.customerName || undefined,
        customerPhone: deliveryForm.customerPhone,
        customerAddress: deliveryForm.customerAddress,
        items,
        riderId: (deliveryForm.riderId || undefined) as Id<"riders"> | undefined,
        paymentMethod: deliveryForm.paymentMethod as "cash" | "upi" | "card",
      });
      toast.success("Delivery order created");
      setDeliveryDialog(false);
      setCart({});
      setDeliveryForm({
        customerName: "",
        customerPhone: "",
        customerAddress: "",
        riderId: "",
        paymentMethod: "cash",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the delivery");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Riders online", value: `${onlineRiders.length}/${riders.length}`, icon: CircleDot, tone: "text-[#4A8C6F]" },
          { label: "Active deliveries", value: String(active.length), icon: Truck, tone: "text-[#5B9A7C]" },
          { label: "Unassigned", value: String(board?.unassignedCount ?? 0), icon: Clock, tone: "text-amber-600" },
          {
            label: "Cash in the field",
            value: money(active.reduce((sum, order) => sum + order.cashToCollect, 0)),
            icon: Wallet,
            tone: "text-[#3D7A5F]",
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-green-100 bg-white">
            <CardContent className="p-4">
              <div className={`mb-1 flex items-center gap-1.5 ${stat.tone}`}>
                <stat.icon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-green-100 bg-white">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-green-100 px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Riders</h3>
              <p className="text-[11px] text-gray-400">
                Riders sign in at <span className="font-medium text-[#4A8C6F]">/rider</span> with
                their phone number and password.
              </p>
            </div>
            <Button
              size="sm"
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              onClick={() => setRiderDialog(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add rider
            </Button>
          </div>
          {riders.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Bike className="mx-auto mb-2 h-7 w-7 text-green-300" />
              <p className="text-sm text-gray-500">
                No riders yet. Add one to start dispatching your own deliveries.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {riders.map((rider) => (
                <div key={rider._id} className="rounded-xl border border-green-100 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 text-[#4A8C6F]">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{rider.name}</p>
                        <p className="text-[11px] text-gray-500">
                          {rider.phone} · {rider.vehicle ?? "Bike"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        rider.isOnline
                          ? "border-green-200 bg-green-50 text-[#3D7A5F]"
                          : rider.isActive
                            ? "border-gray-200 bg-gray-50 text-gray-500"
                            : "border-red-200 bg-red-50 text-red-600"
                      }`}
                    >
                      {rider.isOnline ? "Online" : rider.isActive ? "Offline" : "Disabled"}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                    <div className="rounded-md bg-gray-50 py-1.5">
                      <p className="text-sm font-bold text-gray-900">{rider.activeDeliveries}</p>
                      <p className="text-[9px] uppercase text-gray-400">Active</p>
                    </div>
                    <div className="rounded-md bg-gray-50 py-1.5">
                      <p className="text-sm font-bold text-gray-900">{rider.deliveredToday}</p>
                      <p className="text-[9px] uppercase text-gray-400">Today</p>
                    </div>
                    <div className="rounded-md bg-gray-50 py-1.5">
                      <p className="text-sm font-bold text-gray-900">{money(rider.cashToday)}</p>
                      <p className="text-[9px] uppercase text-gray-400">Cash</p>
                    </div>
                  </div>

                  <p className="mt-2 text-[10px] text-gray-400">
                    {rider.currentLocation
                      ? `Last seen ${new Date(rider.currentLocation.updatedAt).toLocaleTimeString()}`
                      : "Location not shared yet"}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {rider.currentLocation && (
                      <a
                        href={`https://www.google.com/maps?q=${rider.currentLocation.lat},${rider.currentLocation.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-[10px] font-medium text-[#4A8C6F] hover:bg-green-50"
                      >
                        <MapPin className="h-3 w-3" /> Live location
                      </a>
                    )}
                    <a
                      href={`tel:${rider.phone}`}
                      className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-[10px] font-medium text-[#4A8C6F] hover:bg-green-50"
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                    <button
                      className="rounded-md border border-green-200 px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-50"
                      onClick={() => {
                        setResetting(rider._id);
                        setNewPassword("");
                      }}
                    >
                      Reset password
                    </button>
                    <button
                      className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50"
                      onClick={async () => {
                        try {
                          if (rider.isActive) {
                            await updateRider({ id: rider._id, isActive: false });
                          } else {
                            await removeRider({ id: rider._id });
                          }
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not update");
                        }
                      }}
                    >
                      {rider.isActive ? "Disable" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-green-100 bg-white">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-green-100 px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Live dispatch</h3>
              <p className="text-[11px] text-gray-400">
                Every delivery order, who is carrying it, and the cash they must bring back.
              </p>
            </div>
            <Button
              size="sm"
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              onClick={() => setDeliveryDialog(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> New delivery
            </Button>
          </div>
          {active.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Truck className="mx-auto mb-2 h-7 w-7 text-green-300" />
              <p className="text-sm text-gray-500">No deliveries in flight right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-green-50">
              {active.map((order) => (
                <div key={order._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {order.customerName ?? "Guest"}
                      </p>
                      <Badge
                        variant="outline"
                        className="border-green-200 bg-green-50 text-[10px] text-[#3D7A5F]"
                      >
                        {DELIVERY_LABEL[order.deliveryStatus ?? "pending"]}
                      </Badge>
                      {order.source === "aggregator" && (
                        <Badge variant="outline" className="text-[10px] capitalize text-gray-600">
                          {order.externalPlatform}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-gray-500">
                      {order.customerAddress ?? "No address captured"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {order.items.map((line) => `${line.quantity}× ${line.name}`).join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{money(order.totalAmount)}</p>
                    <p className="text-[10px] text-gray-400">
                      {order.cashToCollect > 0 ? `${money(order.cashToCollect)} to collect` : "Prepaid"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.riderPhone && (
                      <a
                        href={`tel:${order.riderPhone}`}
                        className="rounded-md border border-green-200 p-1.5 text-[#4A8C6F] hover:bg-green-50"
                        title="Call rider"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Select
                      value={order.riderId ?? "none"}
                      onValueChange={async (value) => {
                        try {
                          if (value === "none") {
                            await unassignRider({ orderId: order._id });
                          } else {
                            await assignRider({
                              orderId: order._id,
                              riderId: value as Id<"riders">,
                            });
                          }
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not assign");
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-36 cursor-pointer text-xs">
                        <SelectValue placeholder="Assign rider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="cursor-pointer text-xs">
                          Unassigned
                        </SelectItem>
                        {riders
                          .filter((rider) => rider.isActive)
                          .map((rider) => (
                            <SelectItem key={rider._id} value={rider._id} className="cursor-pointer text-xs">
                              {rider.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add rider */}
      <Dialog open={riderDialog} onOpenChange={setRiderDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add rider</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-xs">Name *</Label>
              <Input
                value={riderForm.name}
                onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
                placeholder="Ravi Kumar"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Phone number *</Label>
              <Input
                value={riderForm.phone}
                onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Password *</Label>
              <Input
                type="text"
                value={riderForm.password}
                onChange={(e) => setRiderForm({ ...riderForm, password: e.target.value })}
                placeholder="Share this with the rider"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Vehicle</Label>
              <Input
                value={riderForm.vehicle}
                onChange={(e) => setRiderForm({ ...riderForm, vehicle: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setRiderDialog(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "rider"}
              onClick={handleCreateRider}
            >
              Add rider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={Boolean(resetting)} onOpenChange={(open) => !open && setResetting(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Reset rider password</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="mb-1.5 block text-xs">New password</Label>
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Existing sessions are revoked immediately, so a lost phone cannot stay signed in.
          </p>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setResetting(null)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "password"}
              onClick={handleResetPassword}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New delivery order */}
      <Dialog open={deliveryDialog} onOpenChange={setDeliveryDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New delivery order</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Customer</Label>
                <Input
                  value={deliveryForm.customerName}
                  onChange={(e) =>
                    setDeliveryForm({ ...deliveryForm, customerName: e.target.value })
                  }
                  placeholder="Name"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Phone *</Label>
                <Input
                  value={deliveryForm.customerPhone}
                  onChange={(e) =>
                    setDeliveryForm({ ...deliveryForm, customerPhone: e.target.value })
                  }
                  placeholder="+91…"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Delivery address *</Label>
              <Input
                value={deliveryForm.customerAddress}
                onChange={(e) =>
                  setDeliveryForm({ ...deliveryForm, customerAddress: e.target.value })
                }
                placeholder="Flat, street, landmark"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Rider</Label>
                <Select
                  value={deliveryForm.riderId || "none"}
                  onValueChange={(value) =>
                    setDeliveryForm({ ...deliveryForm, riderId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="cursor-pointer text-sm">
                    <SelectValue placeholder="Assign later" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="cursor-pointer text-sm">
                      Assign later
                    </SelectItem>
                    {riders
                      .filter((rider) => rider.isActive)
                      .map((rider) => (
                        <SelectItem key={rider._id} value={rider._id} className="cursor-pointer text-sm">
                          {rider.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Payment</Label>
                <Select
                  value={deliveryForm.paymentMethod}
                  onValueChange={(value) =>
                    setDeliveryForm({ ...deliveryForm, paymentMethod: value })
                  }
                >
                  <SelectTrigger className="cursor-pointer text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash" className="cursor-pointer text-sm">
                      Cash on delivery
                    </SelectItem>
                    <SelectItem value="upi" className="cursor-pointer text-sm">
                      UPI on delivery
                    </SelectItem>
                    <SelectItem value="card" className="cursor-pointer text-sm">
                      Card on delivery
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">Items</Label>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-green-100 p-2">
                {menuItems.map((item) => (
                  <div key={item._id} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-green-50/60">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-gray-800">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{money(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="h-6 w-6 cursor-pointer rounded border border-green-200 text-xs text-[#4A8C6F] hover:bg-green-50"
                        onClick={() =>
                          setCart((prev) => ({
                            ...prev,
                            [item._id]: Math.max(0, (prev[item._id] ?? 0) - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-xs font-semibold">
                        {cart[item._id] ?? 0}
                      </span>
                      <button
                        className="h-6 w-6 cursor-pointer rounded border border-green-200 text-xs text-[#4A8C6F] hover:bg-green-50"
                        onClick={() =>
                          setCart((prev) => ({ ...prev, [item._id]: (prev[item._id] ?? 0) + 1 }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
              <span className="text-xs text-[#3D7A5F]">
                {Object.values(cart).reduce((sum, qty) => sum + qty, 0)} item(s)
              </span>
              <span className="text-sm font-bold text-gray-900">{money(cartTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setDeliveryDialog(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "delivery"}
              onClick={handleCreateDelivery}
            >
              <Navigation className="mr-1.5 h-4 w-4" /> Create delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
