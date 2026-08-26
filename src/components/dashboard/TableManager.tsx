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
  Download,
  Copy,
  Check,
  Trash2,
  Edit2,
  RefreshCw,
  LayoutGrid,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export function TableManager({
  restaurantId,
}: {
  restaurantId: Id<"restaurants">;
  restaurantSlug: string;
}) {
  const tables = useQuery(api.tables.getByRestaurant, { restaurantId });
  const createTable = useMutation(api.tables.create);
  const updateTable = useMutation(api.tables.update);
  const toggleActive = useMutation(api.tables.toggleActive);
  const removeTable = useMutation(api.tables.remove);
  const regenerateQr = useMutation(api.tables.regenerateQr);

  const [showNewTableDialog, setShowNewTableDialog] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState("");
  const [editingTable, setEditingTable] = useState<Id<"tables"> | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    await createTable({
      restaurantId,
      label: newTableLabel.trim(),
    });
    setShowNewTableDialog(false);
    setNewTableLabel("");
  };

  const handleUpdateTable = async (id: Id<"tables">) => {
    if (!editLabel.trim()) return;
    await updateTable({ id, label: editLabel.trim() });
    setEditingTable(null);
    setEditLabel("");
  };

  const sortedTables = [...tables].sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tables</h2>
          <p className="text-sm text-muted-foreground">
            Create tables and generate QR codes for table-based ordering.
          </p>
        </div>
        <Button
          size="sm"
          className="cursor-pointer"
          onClick={() => setShowNewTableDialog(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Table
        </Button>
      </div>

      {sortedTables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutGrid className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No tables yet. Create your first table to start taking orders.
            </p>
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
    </div>
  );
}
