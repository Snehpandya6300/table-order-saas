import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  BellRing,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  Users,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const STATUS_STYLE: Record<string, string> = {
  booked: "bg-amber-50 text-amber-700 border-amber-200",
  seated: "bg-green-50 text-[#3D7A5F] border-green-200",
  completed: "bg-slate-50 text-slate-600 border-slate-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  no_show: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export function ReservationsManager({ restaurantId }: { restaurantId: Id<"restaurants"> }) {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [showBooking, setShowBooking] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [seatingEntry, setSeatingEntry] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const data = useQuery(api.reservations.listForDate, { restaurantId, date });
  const stats = useQuery(api.reservations.getDayStats, { restaurantId, date });
  const createReservation = useMutation(api.reservations.create);
  const setStatus = useMutation(api.reservations.setStatus);
  const removeReservation = useMutation(api.reservations.remove);
  const addToWaitlist = useMutation(api.reservations.addToWaitlist);
  const notifyGuest = useMutation(api.reservations.notifyWaitlistGuest);
  const seatGuest = useMutation(api.reservations.seatWaitlistGuest);
  const cancelGuest = useMutation(api.reservations.cancelWaitlistGuest);

  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    partySize: "2",
    time: "19:00",
    tableId: "",
    notes: "",
  });
  const [waitForm, setWaitForm] = useState({ guestName: "", guestPhone: "", partySize: "2", notes: "" });
  const [seatTableId, setSeatTableId] = useState("");

  const tables = data?.tables ?? [];
  const reservations = data?.reservations ?? [];
  const waitlist = data?.waitlist ?? [];

  const isToday = date === isoDate(new Date());
  const dayLabel = useMemo(() => {
    const parsed = new Date(`${date}T12:00:00`);
    return parsed.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  }, [date]);

  const shiftDate = (days: number) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    setDate(isoDate(next));
  };

  const openBooking = () => {
    setForm({
      guestName: "",
      guestPhone: "",
      guestEmail: "",
      partySize: "2",
      time: isToday
        ? `${String(new Date().getHours()).padStart(2, "0")}:${String(
            Math.ceil(new Date().getMinutes() / 15) * 15,
          ).padStart(2, "0")}`
        : "19:00",
      tableId: "",
      notes: "",
    });
    setShowBooking(true);
  };

  const handleCreate = async () => {
    if (!form.guestName.trim()) {
      toast.error("Guest name is required");
      return;
    }
    setBusy("create");
    try {
      await createReservation({
        restaurantId,
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        guestEmail: form.guestEmail || undefined,
        partySize: Number(form.partySize) || 1,
        date,
        time: form.time,
        tableId: (form.tableId || undefined) as Id<"tables"> | undefined,
        notes: form.notes || undefined,
        source: "staff",
      });
      toast.success("Table booked");
      setShowBooking(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the booking");
    } finally {
      setBusy(null);
    }
  };

  const handleStatus = async (
    id: string,
    status: "booked" | "seated" | "completed" | "cancelled" | "no_show",
  ) => {
    setBusy(`${id}-${status}`);
    try {
      await setStatus({ id: id as Id<"reservations">, status });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the booking");
    } finally {
      setBusy(null);
    }
  };

  const handleAddWaitlist = async () => {
    if (!waitForm.guestName.trim()) {
      toast.error("Guest name is required");
      return;
    }
    setBusy("waitlist");
    try {
      await addToWaitlist({
        restaurantId,
        guestName: waitForm.guestName,
        guestPhone: waitForm.guestPhone,
        partySize: Number(waitForm.partySize) || 1,
        notes: waitForm.notes || undefined,
      });
      toast.success("Guest added to the waitlist");
      setShowWaitlist(false);
      setWaitForm({ guestName: "", guestPhone: "", partySize: "2", notes: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the guest");
    } finally {
      setBusy(null);
    }
  };

  const handleSeatWaitlist = async () => {
    if (!seatingEntry) return;
    setBusy(`seat-${seatingEntry}`);
    try {
      await seatGuest({
        id: seatingEntry as Id<"waitlistEntries">,
        tableId: (seatTableId || undefined) as Id<"tables"> | undefined,
      });
      toast.success("Guest seated");
      setSeatingEntry(null);
      setSeatTableId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not seat the guest");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 cursor-pointer border-green-200 text-[#4A8C6F] hover:bg-green-50"
            onClick={() => shiftDate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[190px] text-center">
            <p className="text-sm font-semibold text-gray-900">{dayLabel}</p>
            <p className="text-[11px] text-gray-400">{date}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 cursor-pointer border-green-200 text-[#4A8C6F] hover:bg-green-50"
            onClick={() => shiftDate(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              className="cursor-pointer text-xs text-[#4A8C6F] hover:bg-green-50"
              onClick={() => setDate(isoDate(new Date()))}
            >
              Today
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="cursor-pointer border-green-200 text-[#4A8C6F] hover:bg-green-50"
            onClick={() => setShowWaitlist(true)}
          >
            <Clock className="mr-1.5 h-4 w-4" />
            Add to waitlist
          </Button>
          <Button
            className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
            onClick={openBooking}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New booking
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Covers", value: stats?.covers ?? 0, icon: Users },
          { label: "Booked", value: stats?.booked ?? 0, icon: CalendarClock },
          { label: "Seated", value: stats?.seated ?? 0, icon: UserCheck },
          { label: "No-shows", value: stats?.noShows ?? 0, icon: UserX },
          { label: "Waiting", value: stats?.waitlistWaiting ?? 0, icon: Clock },
        ].map((stat) => (
          <Card key={stat.label} className="border-green-100 bg-white">
            <CardContent className="p-4">
              <div className="mb-1 flex items-center gap-1.5 text-[#4A8C6F]">
                <stat.icon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="border-green-100 bg-white">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-green-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Seating plan</h3>
              <span className="text-[11px] text-gray-400">
                {tables.length} active tables · {data?.avgTurnMinutes ?? 50} min average turn
              </span>
            </div>
            {reservations.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Utensils className="mx-auto mb-2 h-7 w-7 text-green-300" />
                <p className="text-sm text-gray-500">No bookings for this day yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 cursor-pointer border-green-200 text-[#4A8C6F]"
                  onClick={openBooking}
                >
                  Take the first booking
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-green-50">
                {reservations.map((reservation) => (
                  <div
                    key={reservation._id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-green-50/40"
                  >
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-sm font-bold text-gray-900">{reservation.time}</p>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400">
                        {reservation.durationMinutes}m
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {reservation.guestName}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${STATUS_STYLE[reservation.status]}`}
                        >
                          {STATUS_LABEL[reservation.status]}
                        </Badge>
                        {reservation.tableLabel && (
                          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-[#4A8C6F]">
                            {reservation.tableLabel}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {reservation.partySize}
                        </span>
                        {reservation.guestPhone && (
                          <a
                            href={`tel:${reservation.guestPhone}`}
                            className="flex items-center gap-1 hover:text-[#4A8C6F]"
                          >
                            <Phone className="h-3 w-3" /> {reservation.guestPhone}
                          </a>
                        )}
                        {reservation.notes && <span className="truncate">{reservation.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {reservation.status === "booked" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 cursor-pointer border-green-200 px-2 text-[11px] text-[#4A8C6F] hover:bg-green-50"
                            disabled={busy === `${reservation._id}-seated`}
                            onClick={() => handleStatus(reservation._id, "seated")}
                          >
                            <UserCheck className="mr-1 h-3 w-3" /> Seat
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 cursor-pointer px-2 text-[11px] text-gray-500 hover:bg-gray-100"
                            disabled={busy === `${reservation._id}-no_show`}
                            onClick={() => handleStatus(reservation._id, "no_show")}
                          >
                            No-show
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 cursor-pointer px-2 text-[11px] text-red-500 hover:bg-red-50"
                            disabled={busy === `${reservation._id}-cancelled`}
                            onClick={() => handleStatus(reservation._id, "cancelled")}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {reservation.status === "seated" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 cursor-pointer border-green-200 px-2 text-[11px] text-[#4A8C6F] hover:bg-green-50"
                          disabled={busy === `${reservation._id}-completed`}
                          onClick={() => handleStatus(reservation._id, "completed")}
                        >
                          <Check className="mr-1 h-3 w-3" /> Table done
                        </Button>
                      )}
                      {(reservation.status === "cancelled" ||
                        reservation.status === "no_show" ||
                        reservation.status === "completed") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 cursor-pointer text-gray-400 hover:bg-red-50 hover:text-red-500"
                          onClick={async () => {
                            try {
                              await removeReservation({ id: reservation._id });
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "Could not delete",
                              );
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
              <h3 className="text-sm font-semibold text-gray-900">Live waitlist</h3>
              <Badge variant="outline" className="border-green-200 bg-green-50 text-[10px] text-[#4A8C6F]">
                {stats?.waitlistGuests ?? 0} guests
              </Badge>
            </div>
            {waitlist.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Clock className="mx-auto mb-2 h-7 w-7 text-green-300" />
                <p className="text-sm text-gray-500">Nobody is waiting right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-green-50">
                {waitlist.map((entry) => (
                  <div key={entry._id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{entry.guestName}</p>
                        <p className="text-[11px] text-gray-500">
                          Party of {entry.partySize} · waiting {entry.waitedMinutes} min · quoted{" "}
                          {entry.quotedMinutes} min
                        </p>
                        {entry.notes && (
                          <p className="mt-0.5 text-[11px] text-gray-400">{entry.notes}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`h-7 w-7 cursor-pointer ${
                            entry.notifiedAt ? "text-[#4A8C6F]" : "text-gray-400 hover:text-[#4A8C6F]"
                          }`}
                          title="Mark table ready"
                          onClick={() => notifyGuest({ id: entry._id })}
                        >
                          <BellRing className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 cursor-pointer text-[#4A8C6F] hover:bg-green-50"
                          title="Seat guest"
                          onClick={() => {
                            setSeatingEntry(entry._id);
                            setSeatTableId("");
                          }}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 cursor-pointer text-gray-400 hover:bg-red-50 hover:text-red-500"
                          title="Remove from waitlist"
                          onClick={() => cancelGuest({ id: entry._id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New booking */}
      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Guest name *</Label>
                <Input
                  value={form.guestName}
                  onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                  placeholder="Priya Sharma"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Phone</Label>
                <Input
                  value={form.guestPhone}
                  onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Guests</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.partySize}
                  onChange={(e) => setForm({ ...form, partySize: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Time</Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Table</Label>
                <Select
                  value={form.tableId || "none"}
                  onValueChange={(value) =>
                    setForm({ ...form, tableId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="h-9 cursor-pointer text-xs">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="cursor-pointer text-xs">
                      Unassigned
                    </SelectItem>
                    {tables.map((table) => (
                      <SelectItem key={table._id} value={table._id} className="cursor-pointer text-xs">
                        {table.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Email (optional)</Label>
              <Input
                value={form.guestEmail}
                onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
                placeholder="guest@email.com"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Window seat, birthday, allergy…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setShowBooking(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "create"}
              onClick={handleCreate}
            >
              Book table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to waitlist */}
      <Dialog open={showWaitlist} onOpenChange={setShowWaitlist}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to waitlist</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Guest name *</Label>
              <Input
                value={waitForm.guestName}
                onChange={(e) => setWaitForm({ ...waitForm, guestName: e.target.value })}
                placeholder="Walk-in guest"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Phone</Label>
                <Input
                  value={waitForm.guestPhone}
                  onChange={(e) => setWaitForm({ ...waitForm, guestPhone: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Guests</Label>
                <Input
                  type="number"
                  min={1}
                  value={waitForm.partySize}
                  onChange={(e) => setWaitForm({ ...waitForm, partySize: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Notes</Label>
              <Input
                value={waitForm.notes}
                onChange={(e) => setWaitForm({ ...waitForm, notes: e.target.value })}
              />
            </div>
            <p className="rounded-lg bg-green-50 px-3 py-2 text-[11px] text-[#3D7A5F]">
              The estimated wait is calculated from the parties ahead and the number of active
              tables, so it updates as the queue moves.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setShowWaitlist(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={busy === "waitlist"}
              onClick={handleAddWaitlist}
            >
              Add guest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seat waitlist guest */}
      <Dialog open={Boolean(seatingEntry)} onOpenChange={(open) => !open && setSeatingEntry(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Seat guest</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="mb-1.5 block text-xs">Table</Label>
            <Select value={seatTableId || "none"} onValueChange={(v) => setSeatTableId(v === "none" ? "" : v)}>
              <SelectTrigger className="cursor-pointer text-sm">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="cursor-pointer text-sm">
                  Unassigned
                </SelectItem>
                {tables.map((table) => (
                  <SelectItem key={table._id} value={table._id} className="cursor-pointer text-sm">
                    {table.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setSeatingEntry(null)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              disabled={Boolean(seatingEntry && busy === `seat-${seatingEntry}`)}
              onClick={handleSeatWaitlist}
            >
              Seat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
