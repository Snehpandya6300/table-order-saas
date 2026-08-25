import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
  QrCode,
  Download,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Users,
} from "lucide-react";

export function TableManager({
  restaurantId,
  restaurantSlug,
}: {
  restaurantId: Id<"restaurants">;
  restaurantSlug: string;
}) {
  const tables = useQuery(api.tables.getByRestaurant, { restaurantId });
  const createTable = useMutation(api.tables.create);
  const createMany = useMutation(api.tables.createMany);
  const updateTable = useMutation(api.tables.update);
  const regenerateQr = useMutation(api.tables.regenerateQr);
  const deleteTable = useMutation(api.tables.remove);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState("");
  const [bulkCount, setBulkCount] = useState("");
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!tables) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading tables...
      </div>
    );
  }

  const sortedTables = [...tables].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );

  const handleAdd = async () => {
    if (mode === "single") {
      if (!newTableLabel.trim()) return;
      await createTable({
        restaurantId,
        label: newTableLabel.trim(),
      });
    } else {
      const count = parseInt(bulkCount);
      if (isNaN(count) || count < 1) return;
      await createMany({
        restaurantId,
        count,
      });
    }
    setShowAddDialog(false);
    setNewTableLabel("");
    setBulkCount("");
  };

  const getQrUrl = (token: string) => {
    return `${window.location.origin}/q/${token}`;
  };

  const handleCopyLink = (token: string) => {
    navigator.clipboard.writeText(getQrUrl(token));
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQr = (token: string, label: string) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getQrUrl(token))}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${label.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tables</h2>
          <p className="text-sm text-muted-foreground">
            Create tables and generate QR codes for each one.
          </p>
        </div>
        <Button
          size="sm"
          className="cursor-pointer"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Table
        </Button>
      </div>

      {sortedTables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No tables yet. Add your first table to generate a QR code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedTables.map((table) => (
            <Card key={table._id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm">{table.label}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {table.qrToken}
                    </p>
                  </div>
                  <Badge
                    variant={table.isActive ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {table.isActive ? "Active" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex justify-center py-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(getQrUrl(table.qrToken))}`}
                    alt={`QR code for ${table.label}`}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer h-8 w-8 p-0"
                    onClick={() =>
                      updateTable({
                        id: table._id,
                        isActive: !table.isActive,
                      })
                    }
                    title={table.isActive ? "Disable" : "Enable"}
                  >
                    {table.isActive ? "✓" : "–"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => regenerateQr({ id: table._id })}
                    title="Regenerate QR code"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteTable({ id: table._id })}
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

      {/* Add Table Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Tables</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={mode === "single" ? "default" : "outline"}
                size="sm"
                className="cursor-pointer flex-1"
                onClick={() => setMode("single")}
              >
                Single Table
              </Button>
              <Button
                variant={mode === "bulk" ? "default" : "outline"}
                size="sm"
                className="cursor-pointer flex-1"
                onClick={() => setMode("bulk")}
              >
                Bulk Add
              </Button>
            </div>
            {mode === "single" ? (
              <Input
                placeholder="Table label (e.g. Table 1)"
                value={newTableLabel}
                onChange={(e) => setNewTableLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            ) : (
              <div>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="Number of tables"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Tables will be named Table 1, Table 2, etc.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleAdd}
              disabled={
                mode === "single"
                  ? !newTableLabel.trim()
                  : !bulkCount || parseInt(bulkCount) < 1
              }
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
