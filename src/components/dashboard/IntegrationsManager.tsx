import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  PLATFORM_CATALOG,
  getPlatformDefinition,
  type PlatformId,
} from "../../convex/aggregatorAdapters";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Link2,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  RotateCw,
  Send,
  ShieldCheck,
  Trash2,
  Unplug,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

type IntegrationRow = {
  _id: Id<"integrations">;
  platform: PlatformId;
  displayName: string;
  outletId?: string;
  isEnabled: boolean;
  webhookKey: string;
  hasApiCredentials: boolean;
  apiBaseUrl?: string;
  lastEventAt?: number;
  lastSuccessfulSync?: number;
  lastError?: string;
  failureCount: number;
  unmappedCount: number;
  duplicateCount: number;
  eventsReceived: number;
  createdAt: number;
  status: "connected" | "error" | "pending" | "disabled";
};

const STATUS_STYLES: Record<
  IntegrationRow["status"],
  { label: string; className: string }
> = {
  connected: {
    label: "Connected",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  error: {
    label: "Needs attention",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  pending: {
    label: "Awaiting first order",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  disabled: {
    label: "Disabled",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

const EVENT_STATUS_STYLES: Record<string, string> = {
  processed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  duplicate: "bg-blue-50 text-blue-700 border-blue-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  unmapped: "bg-amber-50 text-amber-700 border-amber-200",
};

function formatTime(timestamp?: number) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number) {
  return `₹${value.toFixed(2)}`;
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast(`${label} copied`);
  } catch {
    toast.error("Could not copy — select the text manually");
  }
}

function PlatformMark({ platform }: { platform: string }) {
  const definition = getPlatformDefinition(platform);
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
      style={{ backgroundColor: definition.brandColor }}
    >
      {definition.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function IntegrationsManager({
  restaurantId,
}: {
  restaurantId: Id<"restaurants">;
}) {
  const integrations = useQuery(api.aggregators.list, { restaurantId });
  const menuItems = useQuery(api.menuItems.getByRestaurant, { restaurantId });
  const createIntegration = useAction(api.aggregators.createIntegration);
  const updateIntegration = useMutation(api.aggregators.updateIntegration);
  const deleteIntegration = useMutation(api.aggregators.deleteIntegration);
  const revealCredentials = useAction(api.aggregators.revealCredentials);
  const webhookExample = useAction(api.aggregators.webhookExample);
  const rotateSecret = useAction(api.aggregators.rotateWebhookSecret);
  const simulateOrder = useMutation(api.aggregators.simulateOrder);
  const replayEvent = useMutation(api.aggregators.replayEvent);
  const autoMapMenu = useMutation(api.aggregators.autoMapMenu);
  const mapItem = useMutation(api.aggregators.mapItem);
  const unmapItem = useMutation(api.aggregators.unmapItem);

  const [connectPlatform, setConnectPlatform] = useState<PlatformId | null>(null);
  const [connectForm, setConnectForm] = useState({
    displayName: "",
    outletId: "",
    apiBaseUrl: "",
    apiKey: "",
  });
  const [connectSaving, setConnectSaving] = useState(false);

  const [detailId, setDetailId] = useState<Id<"integrations"> | null>(null);
  const [detailTab, setDetailTab] = useState("webhook");
  const [credentials, setCredentials] = useState<{
    webhookUrl: string;
    webhookSecret: string;
    signatureHeader: string;
  } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [curlExample, setCurlExample] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const detailIntegration =
    integrations?.find((integration) => integration._id === detailId) ?? null;

  const mappings = useQuery(
    api.aggregators.mappings,
    detailId ? { integrationId: detailId } : "skip",
  );
  const pendingItems = useQuery(
    api.aggregators.pendingItems,
    detailId ? { integrationId: detailId } : "skip",
  );
  const deliveryLog = useQuery(
    api.aggregators.logs,
    detailId ? { restaurantId, integrationId: detailId, limit: 25 } : "skip",
  );

  const [pendingSelections, setPendingSelections] = useState<Record<string, string>>(
    {},
  );

  const totals = useMemo(() => {
    const list = integrations ?? [];
    return {
      connected: list.filter((integration) => integration.isEnabled).length,
      failures: list.reduce((sum, integration) => sum + integration.failureCount, 0),
      unmapped: list.reduce((sum, integration) => sum + integration.unmappedCount, 0),
    };
  }, [integrations]);

  const openConnect = (platform: PlatformId) => {
    setConnectPlatform(platform);
    setConnectForm({
      displayName: getPlatformDefinition(platform).name,
      outletId: "",
      apiBaseUrl: "",
      apiKey: "",
    });
  };

  const handleConnect = async () => {
    if (!connectPlatform) return;
    setConnectSaving(true);
    try {
      const result = await createIntegration({
        restaurantId,
        platform: connectPlatform,
        displayName: connectForm.displayName,
        outletId: connectForm.outletId || undefined,
        apiBaseUrl: connectForm.apiBaseUrl || undefined,
        apiKey: connectForm.apiKey || undefined,
      });
      toast.success(`${getPlatformDefinition(connectPlatform).name} connected`);
      setConnectPlatform(null);
      setDetailId(result.integrationId);
      setDetailTab("webhook");
      setCredentials(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setConnectSaving(false);
    }
  };

  const openDetail = (integrationId: Id<"integrations">) => {
    setDetailId(integrationId);
    setDetailTab("webhook");
    setCredentials(null);
    setShowSecret(false);
    setCurlExample(null);
  };

  const handleReveal = async () => {
    if (!detailIntegration) return;
    setWorking("reveal");
    try {
      const result = await revealCredentials({
        integrationId: detailIntegration._id,
      });
      setCredentials(result);
      setShowSecret(true);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(null);
    }
  };

  const handleCurl = async () => {
    if (!detailIntegration) return;
    setWorking("curl");
    try {
      const result = await webhookExample({ integrationId: detailIntegration._id });
      setCurlExample(result.curl);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(null);
    }
  };

  const handleRotate = async () => {
    if (!detailIntegration) return;
    setWorking("rotate");
    try {
      const result = await rotateSecret({ integrationId: detailIntegration._id });
      setCredentials((current) =>
        current ? { ...current, webhookSecret: result.webhookSecret } : current,
      );
      setShowSecret(true);
      toast.success("Webhook secret rotated — update the aggregator dashboard");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(null);
    }
  };

  const handleTestOrder = async (integrationId: Id<"integrations">) => {
    setWorking(`test-${integrationId}`);
    try {
      const result = await simulateOrder({ integrationId });
      if (result.status === "processed") {
        toast.success("Test order imported — check the Orders tab");
      } else {
        toast.warning(`Test order ${result.status}: ${result.reason ?? ""}`);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(null);
    }
  };

  const handleToggle = async (integration: IntegrationRow) => {
    try {
      await updateIntegration({
        integrationId: integration._id,
        isEnabled: !integration.isEnabled,
      });
      toast(
        integration.isEnabled
          ? `${integration.displayName} disabled`
          : `${integration.displayName} enabled`,
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async (integration: IntegrationRow) => {
    if (
      !window.confirm(
        `Delete ${integration.displayName}? Its delivery log and menu mappings will be removed.`,
      )
    ) {
      return;
    }
    try {
      await deleteIntegration({ integrationId: integration._id });
      setDetailId(null);
      toast("Integration deleted");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAutoMap = async () => {
    if (!detailIntegration) return;
    setWorking("automap");
    try {
      const result = await autoMapMenu({ integrationId: detailIntegration._id });
      toast.success(
        `${result.mapped} item(s) matched by name${
          result.stillUnmapped.length > 0
            ? ` — ${result.stillUnmapped.length} still need mapping`
            : ""
        }`,
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(null);
    }
  };

  const handleMapItem = async (externalItemId: string, externalItemName: string) => {
    if (!detailIntegration) return;
    const menuItemId = pendingSelections[externalItemId];
    if (!menuItemId) {
      toast.error("Pick a POS menu item first");
      return;
    }
    setWorking(`map-${externalItemId}`);
    try {
      await mapItem({
        integrationId: detailIntegration._id,
        externalItemId,
        externalItemName,
        menuItemId: menuItemId as Id<"menuItems">,
      });
      toast.success(`${externalItemName} mapped`);
      setPendingSelections((current) => {
        const next = { ...current };
        delete next[externalItemId];
        return next;
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(null);
    }
  };

  const handleReplay = async (eventId: Id<"aggregatorEvents">) => {
    setWorking(`replay-${eventId}`);
    try {
      const result = await replayEvent({ eventId });
      if (result.status === "processed") toast.success("Event reprocessed");
      else toast.warning(`${result.status}: ${result.reason ?? "no changes"}`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(null);
    }
  };

  const connectedPlatforms = new Set(
    (integrations ?? []).map((integration) => integration.platform),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-gray-900">
          Online Ordering
        </h2>
        <p className="text-sm text-gray-500">
          Settings → Integrations → Online Ordering. Aggregator orders land in the
          same Orders and Kitchen screens as QR orders.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-green-100 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-[#4A8C6F]">
            <Plug className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Active integrations</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totals.connected}</p>
        </Card>
        <Card className="border-green-100 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Webhook failures</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totals.failures}</p>
        </Card>
        <Card className="border-green-100 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-[#5B9A7C]">
            <UtensilsCrossed className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Items needing mapping</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totals.unmapped}</p>
        </Card>
      </div>

      {/* Connected integrations */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Connected platforms</h3>
        {integrations === undefined ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading integrations…
          </div>
        ) : integrations.length === 0 ? (
          <Card className="border-dashed border-green-200 bg-white">
            <CardContent className="py-8 text-center">
              <Unplug className="mx-auto mb-3 h-7 w-7 text-green-300" />
              <p className="text-sm text-gray-500">
                No aggregator connected yet. Pick a platform below to start receiving
                Zomato / Swiggy orders.
              </p>
            </CardContent>
          </Card>
        ) : (
          integrations.map((integration) => {
            const statusStyle = STATUS_STYLES[integration.status];
            return (
              <Card key={integration._id} className="border-green-100 bg-white">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <PlatformMark platform={integration.platform} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {integration.displayName}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${statusStyle.className}`}
                          >
                            {statusStyle.label}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {integration.outletId
                            ? `Outlet ${integration.outletId}`
                            : "No outlet id set"}
                          {" · "}
                          Last sync {formatTime(integration.lastSuccessfulSync)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-500">
                          <span>{integration.eventsReceived} webhooks</span>
                          <span className={integration.failureCount ? "text-red-600" : ""}>
                            {integration.failureCount} failures
                          </span>
                          <span
                            className={integration.unmappedCount ? "text-amber-600" : ""}
                          >
                            {integration.unmappedCount} unmapped
                          </span>
                          <span>{integration.duplicateCount} duplicates blocked</span>
                        </div>
                        {integration.lastError && (
                          <p className="mt-1 max-w-xl text-[11px] text-red-600">
                            {integration.lastError}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg border border-green-100 bg-green-50/60 px-2 py-1">
                        <span className="text-[11px] font-medium text-gray-600">
                          {integration.isEnabled ? "Enabled" : "Disabled"}
                        </span>
                        <Switch
                          checked={integration.isEnabled}
                          onCheckedChange={() => handleToggle(integration)}
                          className="cursor-pointer"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer border-green-200 text-[#4A8C6F] hover:bg-green-50"
                        onClick={() => openDetail(integration._id)}
                      >
                        Manage
                      </Button>
                      <Button
                        size="sm"
                        className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                        onClick={() => handleTestOrder(integration._id)}
                        disabled={working === `test-${integration._id}`}
                      >
                        {working === `test-${integration._id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Available platforms */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Add a platform</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_CATALOG.map((platform) => {
            const already = connectedPlatforms.has(platform.id);
            const capabilities = [
              platform.capabilities.orderIngest ? "Orders" : null,
              platform.capabilities.acceptReject ? "Accept/Reject" : null,
              platform.capabilities.statusSync ? "Status sync" : null,
              platform.capabilities.menuSync ? "Menu sync" : null,
              platform.capabilities.settlement ? "Settlement" : null,
            ].filter(Boolean);

            return (
              <Card key={platform.id} className="border-green-100 bg-white">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-center gap-2">
                    <PlatformMark platform={platform.id} />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {platform.name}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {platform.capabilities.statusSync
                          ? "Two-way status sync"
                          : "One-way order intake"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {capabilities.map((capability) => (
                      <Badge
                        key={capability}
                        variant="outline"
                        className="border-green-200 bg-green-50/60 text-[10px] text-[#4A8C6F]"
                      >
                        {capability}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    {platform.note}
                  </p>
                  <Button
                    size="sm"
                    variant={already ? "outline" : "default"}
                    className={`mt-auto w-full cursor-pointer ${
                      already
                        ? "border-green-200 text-[#4A8C6F]"
                        : "bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                    }`}
                    disabled={already}
                    onClick={() => openConnect(platform.id)}
                  >
                    {already ? (
                      "Connected"
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Connect
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Connect dialog */}
      <Dialog
        open={connectPlatform !== null}
        onOpenChange={(open) => {
          if (!open) setConnectPlatform(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Connect {connectPlatform ? getPlatformDefinition(connectPlatform).name : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block text-sm">Display name</Label>
              <Input
                value={connectForm.displayName}
                onChange={(event) =>
                  setConnectForm({ ...connectForm, displayName: event.target.value })
                }
                placeholder="Zomato — Koramangala"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Outlet / branch id</Label>
              <Input
                value={connectForm.outletId}
                onChange={(event) =>
                  setConnectForm({ ...connectForm, outletId: event.target.value })
                }
                placeholder="Optional — used to validate branch mapping"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Aggregator API base URL</Label>
              <Input
                value={connectForm.apiBaseUrl}
                onChange={(event) =>
                  setConnectForm({ ...connectForm, apiBaseUrl: event.target.value })
                }
                placeholder="Optional — enables outbound status sync"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">API key</Label>
              <Input
                type="password"
                value={connectForm.apiKey}
                onChange={(event) =>
                  setConnectForm({ ...connectForm, apiKey: event.target.value })
                }
                placeholder="Optional — sent as a bearer token"
              />
            </div>
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-700">
              A webhook URL and signing secret are generated for you. Paste them into
              the aggregator&apos;s partner dashboard after connecting.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setConnectPlatform(null)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
              onClick={handleConnect}
              disabled={connectSaving}
            >
              {connectSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailIntegration && (
                <PlatformMark platform={detailIntegration.platform} />
              )}
              {detailIntegration?.displayName ?? "Integration"}
            </DialogTitle>
          </DialogHeader>

          {detailIntegration && (
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="w-full">
                <TabsTrigger value="webhook" className="cursor-pointer">
                  Webhook
                </TabsTrigger>
                <TabsTrigger value="mapping" className="cursor-pointer">
                  Menu mapping
                </TabsTrigger>
                <TabsTrigger value="log" className="cursor-pointer">
                  Delivery log
                </TabsTrigger>
              </TabsList>

              <TabsContent value="webhook" className="space-y-4 pt-3">
                <div className="rounded-lg border border-green-100 bg-green-50/50 p-3 text-[11px] text-gray-600">
                  <p className="mb-1 font-semibold text-gray-800">Capabilities</p>
                  {getPlatformDefinition(detailIntegration.platform).note}
                </div>

                {credentials ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1.5 block text-xs">Webhook URL</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={credentials.webhookUrl} className="text-xs" />
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => copyText(credentials.webhookUrl, "Webhook URL")}
                        >
                          <ClipboardCopy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">
                        Signing secret ({credentials.signatureHeader})
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={
                            showSecret
                              ? credentials.webhookSecret
                              : "•".repeat(credentials.webhookSecret.length)
                          }
                          className="font-mono text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => setShowSecret((value) => !value)}
                        >
                          {showSecret ? "Hide" : "Show"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() =>
                            copyText(credentials.webhookSecret, "Signing secret")
                          }
                        >
                          <ClipboardCopy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer border-green-200 text-[#4A8C6F]"
                        onClick={handleRotate}
                        disabled={working === "rotate"}
                      >
                        {working === "rotate" ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Rotate secret
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer border-green-200 text-[#4A8C6F]"
                        onClick={handleCurl}
                        disabled={working === "curl"}
                      >
                        {working === "curl" ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Signed curl example
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                    onClick={handleReveal}
                    disabled={working === "reveal"}
                  >
                    {working === "reveal" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    Show webhook URL &amp; secret
                  </Button>
                )}

                {curlExample && (
                  <div>
                    <Label className="mb-1.5 block text-xs">
                      Test with a correctly signed request
                    </Label>
                    <pre className="max-h-40 overflow-auto rounded-lg border border-green-100 bg-gray-900 p-3 text-[10px] leading-relaxed text-green-200">
                      {curlExample}
                    </pre>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                    onClick={() => handleTestOrder(detailIntegration._id)}
                    disabled={working === `test-${detailIntegration._id}`}
                  >
                    {working === `test-${detailIntegration._id}` ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Send test order
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(detailIntegration)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete integration
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-4 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    External items must map to a POS menu item before their orders can
                    be imported.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer border-green-200 text-[#4A8C6F]"
                    onClick={handleAutoMap}
                    disabled={working === "automap"}
                  >
                    {working === "automap" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Auto-map by name
                  </Button>
                </div>

                {pendingItems && pendingItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-amber-700">
                      Unmapped items ({pendingItems.length})
                    </p>
                    {pendingItems.map((item) => (
                      <div
                        key={item.externalItemId}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-800">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {item.count} order line(s) waiting
                          </p>
                        </div>
                        <Select
                          value={pendingSelections[item.externalItemId] ?? ""}
                          onValueChange={(value) =>
                            setPendingSelections((current) => ({
                              ...current,
                              [item.externalItemId]: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 w-44 cursor-pointer text-xs">
                            <SelectValue placeholder="Choose POS item" />
                          </SelectTrigger>
                          <SelectContent>
                            {(menuItems ?? []).map((menuItem) => (
                              <SelectItem
                                key={menuItem._id}
                                value={menuItem._id}
                                className="cursor-pointer text-xs"
                              >
                                {menuItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="cursor-pointer bg-[#4A8C6F] text-white hover:bg-[#3D7A5F]"
                          onClick={() => handleMapItem(item.externalItemId, item.name)}
                          disabled={working === `map-${item.externalItemId}`}
                        >
                          Map
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700">
                    Current mappings ({mappings?.length ?? 0})
                  </p>
                  {mappings && mappings.length > 0 ? (
                    <div className="divide-y divide-green-100 rounded-lg border border-green-100">
                      {mappings.map((mapping) => (
                        <div
                          key={mapping._id}
                          className="flex items-center justify-between gap-2 p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-gray-800">
                              {mapping.externalItemName}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              → {mapping.menuItemName} · {formatMoney(mapping.menuItemPrice)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                mapping.menuItemAvailable
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-red-200 bg-red-50 text-red-700"
                              }`}
                            >
                              {mapping.menuItemAvailable ? "Available" : "86'd"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 cursor-pointer px-2 text-[10px] text-red-600"
                              onClick={async () => {
                                await unmapItem({ mappingId: mapping._id });
                                toast("Mapping removed");
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No menu items mapped yet.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="log" className="space-y-2 pt-3">
                <p className="text-xs text-gray-500">
                  Every webhook is logged with its idempotency outcome. Duplicates are
                  blocked, failures can be replayed.
                </p>
                {deliveryLog && deliveryLog.length > 0 ? (
                  <div className="divide-y divide-green-100 rounded-lg border border-green-100">
                    {deliveryLog.map((event) => (
                      <div key={event._id} className="space-y-1 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              EVENT_STATUS_STYLES[event.status] ??
                              "border-gray-200 bg-gray-50 text-gray-600"
                            }`}
                          >
                            {event.status}
                          </Badge>
                          <span className="text-[11px] font-medium text-gray-700">
                            {event.eventType}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatTime(event.receivedAt)}
                          </span>
                          {event.externalOrderId && (
                            <span className="text-[10px] text-gray-400">
                              #{event.externalOrderId}
                            </span>
                          )}
                        </div>
                        {event.reason && (
                          <p className="text-[11px] text-gray-500">{event.reason}</p>
                        )}
                        {(event.status === "rejected" ||
                          event.status === "unmapped" ||
                          event.status === "failed") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 cursor-pointer px-2 text-[10px] text-[#4A8C6F]"
                            onClick={() => handleReplay(event._id)}
                            disabled={working === `replay-${event._id}`}
                          >
                            {working === `replay-${event._id}` ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Activity className="mr-1 h-3 w-3" />
                            )}
                            Replay
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-green-200 p-6 text-center">
                    <XCircle className="mx-auto mb-2 h-6 w-6 text-green-200" />
                    <p className="text-xs text-gray-400">
                      No webhook activity yet. Send a test order to verify the pipe.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-start gap-2 rounded-lg border border-green-100 bg-white p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4A8C6F]" />
        <p className="text-[11px] leading-relaxed text-gray-500">
          Aggregator orders are stored as normal internal orders — one record per order,
          no duplicates. Platform-paid orders are locked so they cannot be collected
          again at the counter.
        </p>
      </div>
    </div>
  );
}
