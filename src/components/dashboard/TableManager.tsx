import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Download,
  Copy,
  Check,
  Trash2,
  Edit2,
  RefreshCw,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  ListPlus,
  Layers,
  ArrowUpCircle,
  Send,
  Loader2,
  CheckCircle,
  MessageSquare,
} from "lucide-react";

export function TableManager({
  restaurantId,
  restaurantName,
}: {
  restaurantId: Id<"restaurants">;
  restaurantName: string;
  restaurantSlug: string;
}) {
  const tables = useQuery(api.tables.getByRestaurant, { restaurantId });
  const tableStats = useQuery(api.tables.getStats, { restaurantId });
  const planLimits = useQuery(api.admin.getPlanLimits, { restaurantId });
  const createTable = useMutation(api.tables.create);
  const updateTable = useMutation(api.tables.update);
  const toggleActive = useMutation(api.tables.toggleActive);
  const removeTable = useMutation(api.tables.remove);
  const regenerateQr = useMutation(api.tables.regenerateQr);
  const submitPlanRequest = useMutation(api.planRequests.submit);
  const sendPlanEmail = useAction(api.planRequests.sendEmail);

  const [showNewTableDialog, setShowNewTableDialog] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState("");
  const [editingTable, setEditingTable] = useState<Id<"tables"> | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bulk add state
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState("Table");
  const [bulkStart, setBulkStart] = useState(1);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkCreating, setBulkCreating] = useState(false);

  // Update Plan / Contact Admin state
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeName, setUpgradeName] = useState("");
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePhone, setUpgradePhone] = useState("");
  const [upgradePlan, setUpgradePlan] = useState("pro");
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [upgradeSending, setUpgradeSending] = useState(false);
  const [upgradeSent, setUpgradeSent] = useState(false);

  if (!tables) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading tables...
      </div>
    );
  }

  const getQrUrl = (qrToken: string) =>
    `${window.location.origin}/q/${qrToken}`;

  const handleCopyLink = (qrToken: string) => {
    navigator.clipboard.writeText(getQrUrl(qrToken));
    setCopiedId(qrToken);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQr = (qrToken: string, label: string) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getQrUrl(qrToken))}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${label.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.target = "_blank";
    a.click();
  };

  const handleCreateTable = async () => {
    if (!newTableLabel.trim()) return;
    try {
      await createTable({
        restaurantId,
        label: newTableLabel.trim(),
      });
      setShowNewTableDialog(false);
      setNewTableLabel("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  };

  const handleUpdateTable = async (id: Id<"tables">) => {
    if (!editLabel.trim()) return;
    await updateTable({ id, label: editLabel.trim() });
    setEditingTable(null);
    setEditLabel("");
  };

  const handleBulkCreate = async () => {
    setBulkCreating(true);
    let created = 0;
    try {
      for (let i = 0; i < bulkCount; i++) {
        const num = bulkStart + i;
        const label = `${bulkPrefix} ${num}`;
        try {
          await createTable({ restaurantId, label });
          created++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("Table limit reached")) {
            alert(`Stopped at ${created} tables. ${msg}`);
            break;
          }
        }
      }
      setShowBulkDialog(false);
      setBulkPrefix("Table");
      setBulkStart(1);
      setBulkCount(10);
    } finally {
      setBulkCreating(false);
    }
  };

  const handleUpgradeSubmit = async () => {
    if (!upgradeName.trim() || !upgradeEmail.trim()) return;
    setUpgradeSending(true);
    try {
      // Store request in database
      await submitPlanRequest({
        restaurantId,
        restaurantName,
        ownerName: upgradeName.trim(),
        ownerEmail: upgradeEmail.trim(),
        ownerPhone: upgradePhone.trim() || undefined,
        currentPlan: planLimits?.plan || "free",
        requestedPlan: upgradePlan,
        message: upgradeMessage.trim() || undefined,
      });

      // Send email to super admin
      await sendPlanEmail({
        restaurantName,
        ownerName: upgradeName.trim(),
        ownerEmail: upgradeEmail.trim(),
        ownerPhone: upgradePhone.trim() || undefined,
        currentPlan: planLimits?.plan || "free",
        requestedPlan: upgradePlan,
        message: upgradeMessage.trim() || undefined,
      });

      setUpgradeSent(true);
    } catch (err) {
      console.error(err);
      alert("Failed to send request. Please try again.");
    } finally {
      setUpgradeSending(false);
    }
  };

  const sortedTables = [...tables].sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  return (
    <div className="space-y-6">
      {/* Plan Limit Banner */}
      {planLimits && (
        <div className={`rounded-xl border p-4 flex items-center justify-between ${
          !planLimits.canAddTable
            ? "bg-amber-50 border-amber-200"
            : planLimits.currentTables >= planLimits.maxTables - 1
              ? "bg-orange-50 border-orange-200"
              : "bg-green-50 border-green-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg px-2 py-1 text-xs font-bold ${
              planLimits.plan === "enterprise"
                ? "bg-purple-100 text-purple-700"
                : planLimits.plan === "pro"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
            }`}>
              {planLimits.planLabel}
            </div>
            <div>
              <p className="text-sm font-medium">
                {planLimits.currentTables} / {planLimits.maxTables === 999 ? "∞" : planLimits.maxTables} tables used
              </p>
              {!planLimits.canAddTable && (
                <p className="text-xs text-amber-700 mt-0.5">
                  Table limit reached. Upgrade your plan to add more tables.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!planLimits.canAddTable && (
              <Button
                size="sm"
                className="cursor-pointer bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 text-xs h-8 px-3 shadow-md"
                onClick={() => setShowUpgradeDialog(true)}
              >
                <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" />
                Contact Admin to Upgrade
              </Button>
            )}
            {planLimits.canAddTable && planLimits.plan === "free" && (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer text-xs h-8 border-orange-200 text-orange-700 hover:bg-orange-50"
                onClick={() => setShowUpgradeDialog(true)}
              >
                <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" />
                Update Plan
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tables</h2>
          <p className="text-sm text-muted-foreground">
            Create tables and generate QR codes for table-based ordering.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => setShowBulkDialog(true)}
            disabled={planLimits ? !planLimits.canAddTable : undefined}
          >
            <ListPlus className="mr-1.5 h-3.5 w-3.5" />
            Bulk Add
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => setShowNewTableDialog(true)}
            disabled={planLimits ? !planLimits.canAddTable : undefined}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Table
          </Button>
        </div>
      </div>

      {sortedTables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutGrid className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No tables yet. Create your first table to start taking orders.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setShowBulkDialog(true)}
              >
                <ListPlus className="mr-1.5 h-3.5 w-3.5" />
                Bulk Add Tables
              </Button>
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={() => setShowNewTableDialog(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add One Table
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedTables.map((table) => (
            <Card
              key={table._id}
              className={`overflow-hidden ${!table.isActive ? "opacity-60" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {editingTable === table._id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-7 w-24 text-sm"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleUpdateTable(table._id)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer h-7 w-7 p-0"
                          onClick={() => handleUpdateTable(table._id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-bold text-lg">{table.label}</span>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        table.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }`}
                    >
                      {table.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-center py-2">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(getQrUrl(table.qrToken))}`}
                    alt={`QR for ${table.label}`}
                    className="rounded-lg"
                  />
                </div>

                <div className="flex gap-1.5 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer flex-1 text-[11px] h-8"
                    onClick={() => handleCopyLink(table.qrToken)}
                  >
                    {copiedId === table.qrToken ? (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3 w-3" />
                        Link
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer flex-1 text-[11px] h-8"
                    onClick={() =>
                      handleDownloadQr(table.qrToken, table.label)
                    }
                  >
                    <Download className="mr-1 h-3 w-3" />
                    QR
                  </Button>
                </div>

                <div className="flex gap-1.5 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-8 w-8 p-0"
                    onClick={() => {
                      setEditingTable(table._id);
                      setEditLabel(table.label);
                    }}
                    title="Edit name"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-8 w-8 p-0"
                    onClick={() => regenerateQr({ id: table._id })}
                    title="Regenerate QR"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-8 w-8 p-0"
                    onClick={() => toggleActive({ id: table._id })}
                    title={table.isActive ? "Disable" : "Enable"}
                  >
                    {table.isActive ? (
                      <XCircle className="h-3.5 w-3.5 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-8 w-8 p-0 text-destructive"
                    onClick={() => removeTable({ id: table._id })}
                    title="Delete table"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Single Table Dialog */}
      <Dialog open={showNewTableDialog} onOpenChange={setShowNewTableDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Table Label
              </label>
              <Input
                placeholder="e.g. Table 1, Counter A, Patio 3"
                value={newTableLabel}
                onChange={(e) => setNewTableLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTable()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A unique QR code will be generated for this table. Customers can
              scan it to view the menu and place orders.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowNewTableDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleCreateTable}
              disabled={!newTableLabel.trim()}
            >
              Create Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Plan / Contact Admin Dialog */}
      <Dialog
        open={showUpgradeDialog}
        onOpenChange={(open) => {
          setShowUpgradeDialog(open);
          if (!open) {
            setUpgradeSent(false);
            setUpgradeName("");
            setUpgradeEmail("");
            setUpgradePhone("");
            setUpgradeMessage("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-orange-500" />
              Update Your Plan
            </DialogTitle>
          </DialogHeader>

          {upgradeSent ? (
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-700">
                Request Sent!
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Your upgrade request has been sent to our team. We'll contact
                you shortly at <strong>{upgradeEmail}</strong> to discuss your
                plan upgrade.
              </p>
              <Button
                className="cursor-pointer mt-2"
                variant="outline"
                onClick={() => setShowUpgradeDialog(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {/* Current Plan Info */}
                {planLimits && (
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-orange-800">
                        Current Plan
                      </span>
                      <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                        {planLimits.planLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-orange-600 mt-1">
                      {planLimits.currentTables} /{" "}
                      {planLimits.maxTables === 999
                        ? "∞"
                        : planLimits.maxTables}{" "}
                      tables used
                    </p>
                  </div>
                )}

                {/* Plan Options */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Select Plan
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        id: "pro",
                        name: "Pro",
                        price: "$29/mo",
                        desc: "10 tables, Staff, Analytics",
                      },
                      {
                        id: "enterprise",
                        name: "Enterprise",
                        price: "$79/mo",
                        desc: "Unlimited tables, API, Priority",
                      },
                    ].map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        className={`cursor-pointer rounded-lg border-2 p-3 text-left transition-all ${
                          upgradePlan === plan.id
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setUpgradePlan(plan.id)}
                      >
                        <div className="font-semibold text-sm">{plan.name}</div>
                        <div className="text-orange-600 font-bold text-xs">
                          {plan.price}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {plan.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact Form */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Your Name *
                  </label>
                  <Input
                    placeholder="John Doe"
                    value={upgradeName}
                    onChange={(e) => setUpgradeName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    placeholder="you@restaurant.com"
                    value={upgradeEmail}
                    onChange={(e) => setUpgradeEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={upgradePhone}
                    onChange={(e) => setUpgradePhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Message (optional)
                  </label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-none"
                    placeholder="Tell us about your needs, expected table count, any questions..."
                    value={upgradeMessage}
                    onChange={(e) => setUpgradeMessage(e.target.value)}
                  />
                </div>

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700">
                    Our team will contact you within 24 hours to process your
                    upgrade. No payment required until you confirm.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setShowUpgradeDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="cursor-pointer bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                  disabled={
                    upgradeSending ||
                    !upgradeName.trim() ||
                    !upgradeEmail.trim()
                  }
                  onClick={handleUpgradeSubmit}
                >
                  {upgradeSending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Send Request
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Bulk Add Tables
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Quick Presets */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Quick Presets
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { prefix: "Table", start: 1, count: 5, label: "5 Tables" },
                  { prefix: "Table", start: 1, count: 10, label: "10 Tables" },
                  { prefix: "Table", start: 1, count: 20, label: "20 Tables" },
                  { prefix: "Counter", start: 1, count: 5, label: "5 Counters" },
                  { prefix: "Seat", start: 1, count: 10, label: "10 Seats" },
                  { prefix: "Stall", start: 1, count: 8, label: "8 Stalls" },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer text-xs h-7"
                    onClick={() => {
                      setBulkPrefix(preset.prefix);
                      setBulkStart(preset.start);
                      setBulkCount(preset.count);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Settings */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Prefix
                </label>
                <Input
                  placeholder="Table"
                  value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Start #
                </label>
                <Input
                  type="number"
                  min={1}
                  value={bulkStart}
                  onChange={(e) => setBulkStart(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Count
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Preview (first 5):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: Math.min(bulkCount, 5) }, (_, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {bulkPrefix} {bulkStart + i}
                  </Badge>
                ))}
                {bulkCount > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{bulkCount - 5} more
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Each table will get a unique QR code. You can manage, rename, or
              disable individual tables after creation.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowBulkDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleBulkCreate}
              disabled={bulkCreating || bulkCount < 1}
            >
              {bulkCreating ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Creating {bulkCount} tables...
                </>
              ) : (
                <>
                  <Layers className="mr-1.5 h-3.5 w-3.5" />
                  Create {bulkCount} Tables
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
