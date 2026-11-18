import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bike,
  CircleDot,
  LocateFixed,
  LogOut,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Power,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

const TOKEN_KEY = "rider_session_token";

function playNewDeliverySound() {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const gain = context.createGain();
    gain.gain.value = 0.18;
    gain.connect(context.destination);
    [0, 0.25, 0.5].forEach((offset) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = offset === 0.25 ? 1180 : 880;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.18);
    });
    setTimeout(() => void context.close(), 1200);
  } catch {
    // Browsers can block audio until a user gesture — the visual card is enough.
  }
}

export default function RiderPage() {
  const [token, setToken] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [deliveryBusy, setDeliveryBusy] = useState<string | null>(null);
  const previousAssigned = useRef(0);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);

  const login = useMutation(api.riders.login);
  const logout = useMutation(api.riders.logout);
  const setOnline = useMutation(api.riders.setOnline);
  const updateLocation = useMutation(api.riders.updateLocation);
  const claimDelivery = useMutation(api.riders.claimDelivery);
  const pickUp = useMutation(api.riders.pickUpDelivery);
  const markDelivered = useMutation(api.riders.markDelivered);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) setToken(stored);
  }, []);

  const session = useQuery(api.riders.session, token ? { token } : "skip");
  const deliveries = useQuery(api.riders.myDeliveries, token ? { token } : "skip");

  const assigned = useMemo(() => deliveries?.assigned ?? [], [deliveries]);
  const available = useMemo(() => deliveries?.available ?? [], [deliveries]);

  useEffect(() => {
    if (deliveries === undefined) return;
    const count = assigned.length;
    if (previousAssigned.current > 0 && count > previousAssigned.current) {
      playNewDeliverySound();
      toast.success("New delivery assigned");
    }
    previousAssigned.current = count;
  }, [assigned.length, deliveries]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      const result = await login({ phone, password });
      window.localStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setPassword("");
      toast.success(`Welcome, ${result.rider.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (token) {
      try {
        await logout({ token });
      } catch {
        // Session may already be expired server-side.
      }
    }
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setTracking(false);
  };

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (!token) return;
    if (!("geolocation" in navigator)) {
      toast.error("This device cannot share location");
      return;
    }
    if (watchId.current !== null) return;

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        setTracking(true);
        const now = Date.now();
        // Throttle writes so a moving bike does not spam the database.
        if (now - lastSent.current < 12000) return;
        lastSent.current = now;
        try {
          await updateLocation({
            token,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy || undefined,
          });
        } catch {
          // Silent: the next position will retry.
        }
      },
      (error) => {
        setTracking(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied — enable it to share your live position"
            : "Could not read your location",
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  }, [token, updateLocation]);

  useEffect(() => {
    if (!token) stopTracking();
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [token, stopTracking]);

  useEffect(() => {
    if (session?.rider.isOnline) startTracking();
    if (session && !session.rider.isOnline) stopTracking();
  }, [session, startTracking, stopTracking]);

  const toggleOnline = async () => {
    if (!token || !session) return;
    const next = !session.rider.isOnline;
    try {
      await setOnline({ token, isOnline: next });
      if (next) {
        startTracking();
        toast.success("You're online — deliveries will appear here");
      } else {
        stopTracking();
        toast.success("You're offline");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change status");
    }
  };

  const handlePickUp = async (orderId: Id<"orders">) => {
    if (!token) return;
    setDeliveryBusy(orderId);
    try {
      await pickUp({ token, orderId });
      toast.success("Marked picked up");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    } finally {
      setDeliveryBusy(null);
    }
  };

  const handleDelivered = async (orderId: Id<"orders">, cashToCollect: number, method?: string) => {
    if (!token) return;
    setDeliveryBusy(orderId);
    try {
      await markDelivered({
        token,
        orderId,
        cashCollected: cashToCollect > 0 ? cashToCollect : undefined,
        paymentMethod: (method as "cash" | "upi" | "card") ?? "cash",
      });
      toast.success("Delivery completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete the delivery");
    } finally {
      setDeliveryBusy(null);
    }
  };

  // ── Signed out ────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EEF5F0] p-5">
        <Card className="w-full max-w-sm border-green-100 bg-white shadow-lg">
          <CardContent className="p-6">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4A8C6F] text-white">
                <Bike className="h-7 w-7" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Delivery rider</h1>
              <p className="mt-1 text-xs text-gray-500">
                Sign in with the phone number and password your restaurant gave you.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block text-xs">Phone number</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                />
              </div>
              <Button
                className="w-full cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                disabled={signingIn || !phone.trim() || !password}
                onClick={handleSignIn}
              >
                {signingIn ? "Signing in…" : "Sign in"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EEF5F0] p-5">
        <Card className="w-full max-w-sm border-green-100 bg-white">
          <CardContent className="space-y-3 p-6 text-center">
            <p className="text-sm text-gray-600">
              This rider session has expired. Sign in again to see your deliveries.
            </p>
            <Button
              className="w-full cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              onClick={handleSignOut}
            >
              Sign in again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rider = session?.rider;
  const cashToCollect = assigned.reduce(
    (sum, order) =>
      sum + (order.isPlatformPaid || order.paymentStatus === "paid" ? 0 : order.totalAmount),
    0,
  );

  return (
    <div className="min-h-screen bg-[#EEF5F0] pb-10">
      <header className="sticky top-0 z-30 border-b border-green-200/50 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4A8C6F] text-white">
              <Bike className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-gray-900">{rider?.name}</p>
              <p className="text-[11px] text-gray-500">{session?.restaurant?.name}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer text-gray-500 hover:bg-green-50 hover:text-[#4A8C6F]"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card className="border-green-100 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    rider?.isOnline ? "bg-green-100 text-[#4A8C6F]" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <Power className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {rider?.isOnline ? "Online" : "Offline"}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {rider?.isOnline
                      ? tracking
                        ? "Sharing live location"
                        : "Location permission needed"
                      : "Go online to receive deliveries"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className={`cursor-pointer ${
                  rider?.isOnline
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                }`}
                onClick={toggleOnline}
              >
                {rider?.isOnline ? "Go offline" : "Go online"}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 py-2">
                <p className="text-lg font-bold text-gray-900">{deliveries?.completedToday ?? 0}</p>
                <p className="text-[10px] uppercase text-[#5B9A7C]">Delivered today</p>
              </div>
              <div className="rounded-lg bg-green-50 py-2">
                <p className="text-lg font-bold text-gray-900">{assigned.length}</p>
                <p className="text-[10px] uppercase text-[#5B9A7C]">In hand</p>
              </div>
              <div className="rounded-lg bg-green-50 py-2">
                <p className="text-lg font-bold text-gray-900">
                  {(deliveries?.cashToday ?? 0).toFixed(0)}
                </p>
                <p className="text-[10px] uppercase text-[#5B9A7C]">Cash today</p>
              </div>
            </div>

            {rider?.isOnline && !tracking && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full cursor-pointer border-green-200 text-[11px] text-[#4A8C6F] hover:bg-green-50"
                onClick={startTracking}
              >
                <LocateFixed className="mr-1.5 h-3.5 w-3.5" /> Share my location
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">My deliveries</h2>
          {cashToCollect > 0 && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
              <Wallet className="mr-1 h-3 w-3" /> {cashToCollect.toFixed(2)} to collect
            </Badge>
          )}
        </div>

        {assigned.length === 0 ? (
          <Card className="border-dashed border-green-200 bg-white/60">
            <CardContent className="py-8 text-center">
              <PackageCheck className="mx-auto mb-2 h-7 w-7 text-green-300" />
              <p className="text-sm text-gray-500">
                {rider?.isOnline
                  ? "No deliveries assigned yet. New ones arrive with a sound."
                  : "Go online to start receiving deliveries."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {assigned.map((order) => {
              const cash = order.isPlatformPaid || order.paymentStatus === "paid"
                ? 0
                : order.totalAmount;
              const pickedUp = order.deliveryStatus === "picked_up";
              return (
                <Card key={order._id} className="border-green-100 bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {order.customerName ?? "Guest"}
                        </p>
                        <p className="text-[11px] text-gray-500">#{order._id.slice(-6)}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          pickedUp
                            ? "border-blue-200 bg-blue-50 text-blue-600"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {pickedUp ? "Picked up" : "Ready to collect"}
                      </Badge>
                    </div>

                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-800">
                        {order.items.map((line) => `${line.quantity}× ${line.name}`).join(", ")}
                      </p>
                      {order.customerAddress && (
                        <p className="mt-1 flex items-start gap-1 text-[11px] text-gray-500">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          {order.customerAddress}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                      <span className="text-[11px] text-[#3D7A5F]">
                        {cash > 0 ? "Cash to collect" : "Prepaid — no cash"}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{cash.toFixed(2)}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {order.customerAddress && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                            order.customerAddress,
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-green-200 text-xs font-medium text-[#4A8C6F] hover:bg-green-50"
                        >
                          <Navigation className="h-3.5 w-3.5" /> Navigate
                        </a>
                      )}
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-green-200 text-xs font-medium text-[#4A8C6F] hover:bg-green-50"
                      >
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                    </div>

                    <div className="mt-2">
                      {!pickedUp ? (
                        <Button
                          className="w-full cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                          disabled={deliveryBusy === order._id}
                          onClick={() => handlePickUp(order._id)}
                        >
                          <RefreshCw className="mr-1.5 h-4 w-4" /> Mark picked up
                        </Button>
                      ) : (
                        <Button
                          className="w-full cursor-pointer bg-[#3D7A5F] text-white hover:bg-[#2F634B]"
                          disabled={deliveryBusy === order._id}
                          onClick={() =>
                            handleDelivered(order._id, cash, order.paymentMethod ?? "cash")
                          }
                        >
                          <PackageCheck className="mr-1.5 h-4 w-4" />
                          {cash > 0 ? `Delivered · collect ${cash.toFixed(2)}` : "Mark delivered"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {available.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-2">
              <h2 className="text-sm font-semibold text-gray-900">Open deliveries</h2>
              <span className="text-[11px] text-gray-400">First come, first served</span>
            </div>
            <div className="space-y-2">
              {available.map((order) => (
                <Card key={order._id} className="border-dashed border-green-200 bg-white/80">
                  <CardContent className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {order.customerName ?? "Guest"} · {order.totalAmount.toFixed(2)}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {order.customerAddress ?? order.items.map((l) => l.name).join(", ")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                      disabled={deliveryBusy === order._id}
                      onClick={async () => {
                        if (!token) return;
                        setDeliveryBusy(order._id);
                        try {
                          await claimDelivery({ token, orderId: order._id });
                          toast.success("Delivery claimed");
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Could not claim the delivery",
                          );
                        } finally {
                          setDeliveryBusy(null);
                        }
                      }}
                    >
                      <CircleDot className="mr-1 h-3.5 w-3.5" /> Take
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <p className="pt-2 text-center text-[10px] text-gray-400">
          Keep the app open while you ride — locations update every few seconds.
        </p>
      </div>
    </div>
  );
}
